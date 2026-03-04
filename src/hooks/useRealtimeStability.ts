import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeStabilityOptions {
  channelName: string;
  tables?: string[];
  onReconnect?: () => void;
  onDisconnect?: () => void;
  maxRetries?: number;
  retryDelay?: number;
}

interface ConnectionState {
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  lastPing: number;
  retryCount: number;
}

/**
 * Hook for managing realtime connection stability
 * Handles auto-reconnect on network drops, device sleep, and tab suspension
 */
export function useRealtimeStability(options: RealtimeStabilityOptions) {
  const {
    channelName,
    onReconnect,
    onDisconnect,
    maxRetries = 10,
    retryDelay = 3000
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connecting',
    lastPing: Date.now(),
    retryCount: 0
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReconnectingRef = useRef(false);

  // Clean up function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  // Initialize channel
  const initializeChannel = useCallback(() => {
    cleanup();

    setConnectionState(prev => ({
      ...prev,
      status: 'connecting',
      retryCount: 0
    }));

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: { key: '' }
      }
    });

    // Handle subscription status changes
    channel
      .on('system', {}, (payload) => {
        if (payload.type === 'connected') {
          setConnectionState({
            status: 'connected',
            lastPing: Date.now(),
            retryCount: 0
          });
          isReconnectingRef.current = false;
          
          // Notify app of successful connection
          window.dispatchEvent(new CustomEvent('supabase-realtime-activity'));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState(prev => ({
            ...prev,
            status: 'connected',
            lastPing: Date.now()
          }));
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionState(prev => ({
            ...prev,
            status: 'disconnected'
          }));
          
          if (onDisconnect) {
            onDisconnect();
          }
          
          // Trigger reconnect
          attemptReconnect();
        }
      });

    channelRef.current = channel;

    // Set up ping interval to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now() }
        }).catch(() => {
          // Ping failed, connection might be dead
          setConnectionState(prev => ({
            ...prev,
            status: 'disconnected'
          }));
        });
      }
    }, 30000); // Ping every 30 seconds

    return channel;
  }, [channelName, cleanup, onDisconnect]);

  // Reconnect logic
  const attemptReconnect = useCallback(() => {
    if (isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    
    setConnectionState(prev => ({
      ...prev,
      status: 'reconnecting',
      retryCount: prev.retryCount + 1
    }));

    const attempt = () => {
      if (connectionState.retryCount >= maxRetries) {
        console.error('[Realtime] Max retries reached, giving up');
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected'
        }));
        isReconnectingRef.current = false;
        return;
      }

      console.log(`[Realtime] Reconnecting... attempt ${connectionState.retryCount + 1}/${maxRetries}`);
      
      initializeChannel();
      
      if (onReconnect) {
        onReconnect();
      }
    };

    // Exponential backoff
    const delay = Math.min(retryDelay * Math.pow(1.5, connectionState.retryCount), 30000);
    
    retryTimeoutRef.current = setTimeout(attempt, delay);
  }, [connectionState.retryCount, initializeChannel, maxRetries, onReconnect, retryDelay]);

  // Manual reconnect trigger
  const triggerReconnect = useCallback(() => {
    setConnectionState(prev => ({
      ...prev,
      retryCount: 0
    }));
    isReconnectingRef.current = false;
    attemptReconnect();
  }, [attemptReconnect]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we've been away too long
        const timeSinceLastPing = Date.now() - connectionState.lastPing;
        
        if (timeSinceLastPing > 60000 && connectionState.status !== 'connected') {
          console.log('[Realtime] Tab became visible, checking connection...');
          triggerReconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionState.lastPing, connectionState.status, triggerReconnect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Realtime] Browser came online, reconnecting...');
      triggerReconnect();
    };

    const handleOffline = () => {
      console.log('[Realtime] Browser went offline');
      setConnectionState(prev => ({
        ...prev,
        status: 'disconnected'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerReconnect]);

  // Listen for PWA-triggered reconnects
  useEffect(() => {
    const handlePWAReconnect = (event: CustomEvent) => {
      console.log('[Realtime] PWA triggered reconnect:', event.detail);
      triggerReconnect();
    };

    window.addEventListener('pwa-trigger-reconnect', handlePWAReconnect as EventListener);
    return () => window.removeEventListener('pwa-trigger-reconnect', handlePWAReconnect as EventListener);
  }, [triggerReconnect]);

  // Initialize on mount
  useEffect(() => {
    initializeChannel();
    return cleanup;
  }, [initializeChannel, cleanup]);

  return {
    channel: channelRef.current,
    connectionState,
    triggerReconnect,
    isConnected: connectionState.status === 'connected',
    isReconnecting: connectionState.status === 'reconnecting'
  };
}

/**
 * Hook for managing Agora livestream stability
 */
export function useLivestreamStability(streamId?: string) {
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const handleReconnect = useCallback(async () => {
    if (!streamId) return;
    
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('[Livestream] Max reconnection attempts reached');
      setConnectionState('disconnected');
      return;
    }

    reconnectAttempts.current++;
    setConnectionState('reconnecting');

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    
    setTimeout(() => {
      // This would trigger a reconnect in the actual Agora implementation
      window.dispatchEvent(new CustomEvent('agora-reconnect', { 
        detail: { streamId, attempt: reconnectAttempts.current } 
      }));
    }, delay);
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;

    // Reset reconnect attempts when stream changes
    reconnectAttempts.current = 0;
    setConnectionState('connected');

    const handleOnline = () => {
      console.log('[Livestream] Network restored, attempting reconnect');
      handleReconnect();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [streamId, handleReconnect]);

  return {
    connectionState,
    reconnectAttempts: reconnectAttempts.current,
    handleReconnect
  };
}

export default useRealtimeStability;
