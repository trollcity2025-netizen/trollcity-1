import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';
import { useTickerStore } from '../stores/tickerStore';
import {
  TickerMessage,
  TickerCategory,
  DEFAULT_TICKER_SETTINGS,
} from '../types/ticker';

interface UseBroadcastTickerOptions {
  streamId: string;
  userId: string;
  isHost: boolean;
  enabled?: boolean;
}

interface TickerBroadcastPayload {
  type: 'ticker-message' | 'ticker-priority' | 'ticker-clear-priority' | 'ticker-settings' | 'ticker-remove';
  message?: TickerMessage;
  settings?: Record<string, any>;
  messageId?: string;
}

export function useBroadcastTicker({
  streamId,
  userId,
  isHost,
  enabled = true,
}: UseBroadcastTickerOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedUsersRef = useRef<Set<string>>(new Set());
  const {
    addMessage,
    removeMessage,
    setPriorityMessage,
    setSettings,
    settings,
  } = useTickerStore();

  // Helper to add a ticker message locally (without broadcast)
  const addLocalTickerMessage = useCallback(
    (content: string, category: TickerCategory = 'system', tags: string[] = []) => {
      const message: TickerMessage = {
        id: generateUUID(),
        stream_id: streamId,
        user_id: userId,
        content,
        category,
        is_priority: false,
        is_pinned: false,
        tags,
        created_at: new Date().toISOString(),
      };
      addMessage(message);
      return message;
    },
    [streamId, userId, addMessage]
  );

  // Initialize ticker broadcast channel
  useEffect(() => {
    if (!streamId || !enabled) return;

    const channelName = `broadcast-ticker-${streamId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'ticker' }, (payload) => {
      const data = payload.payload as TickerBroadcastPayload;

      switch (data.type) {
        case 'ticker-message':
          if (data.message) {
            addMessage(data.message);
          }
          break;

        case 'ticker-priority':
          if (data.message) {
            setPriorityMessage(data.message);
            const duration = settings.priority_duration_ms || 5000;
            setTimeout(() => {
              setPriorityMessage(null);
            }, duration);
          }
          break;

        case 'ticker-clear-priority':
          setPriorityMessage(null);
          break;

        case 'ticker-settings':
          if (data.settings) {
            setSettings(data.settings);
          }
          break;

        case 'ticker-remove':
          if (data.messageId) {
            removeMessage(data.messageId);
          }
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Ticker] Subscribed to channel:', channelName);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId, enabled]);

  // Subscribe to presence for join/leave ticker messages
  useEffect(() => {
    if (!streamId || !enabled || !userId) return;

    const presenceChannel = supabase
      .channel(`ticker-presence:${streamId}`)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          if (p.user_id === userId) return;
          if (joinedUsersRef.current.has(p.user_id)) return;
          joinedUsersRef.current.add(p.user_id);

          const username = p.username || 'Someone';
          addLocalTickerMessage(`${username} joined ❤️`, 'recognition', ['👋']);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          if (p.user_id === userId) return;
          if (!joinedUsersRef.current.has(p.user_id)) return;
          joinedUsersRef.current.delete(p.user_id);

          const username = p.username || 'Someone';
          addLocalTickerMessage(`${username} left 👋`, 'system', []);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [streamId, enabled, userId, addLocalTickerMessage]);

  // Send a ticker message
  const sendMessage = useCallback(
    (
      content: string,
      category: TickerCategory = 'hype',
      isPriority = false,
      tags: string[] = []
    ) => {
      if (!channelRef.current || !content.trim()) return;

      const message: TickerMessage = {
        id: generateUUID(),
        stream_id: streamId,
        user_id: userId,
        content: content.trim(),
        category,
        is_priority: isPriority,
        is_pinned: false,
        tags,
        created_at: new Date().toISOString(),
      };

      addMessage(message);

      if (isPriority) {
        setPriorityMessage(message);
        const duration = settings.priority_duration_ms || 5000;
        setTimeout(() => setPriorityMessage(null), duration);
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'ticker',
        payload: {
          type: isPriority ? 'ticker-priority' : 'ticker-message',
          message,
        } as TickerBroadcastPayload,
      });

      return message;
    },
    [streamId, userId, settings.priority_duration_ms, addMessage, setPriorityMessage]
  );

  const sendPriority = useCallback(
    (content: string, category: TickerCategory = 'announcement', tags: string[] = []) => {
      return sendMessage(content, category, true, tags);
    },
    [sendMessage]
  );

  const clearPriority = useCallback(() => {
    setPriorityMessage(null);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ticker',
        payload: { type: 'ticker-clear-priority' } as TickerBroadcastPayload,
      });
    }
  }, [setPriorityMessage]);

  const deleteMessage = useCallback(
    (messageId: string) => {
      removeMessage(messageId);
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ticker',
          payload: {
            type: 'ticker-remove',
            messageId,
          } as TickerBroadcastPayload,
        });
      }
    },
    [removeMessage]
  );

  const broadcastSettings = useCallback(
    (partialSettings: Record<string, any>) => {
      setSettings(partialSettings);
      if (channelRef.current && isHost) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ticker',
          payload: {
            type: 'ticker-settings',
            settings: partialSettings,
          } as TickerBroadcastPayload,
        });
      }
    },
    [isHost, setSettings]
  );

  const generateSystemMessage = useCallback(
    (
      event: 'goal_progress' | 'top_fan_change' | 'mission_complete' | 'viewer_milestone',
      data: Record<string, any>
    ) => {
      let content = '';
      let category: TickerCategory = 'system';
      const tags: string[] = [];

      switch (event) {
        case 'goal_progress':
          content = `GOAL: ${data.progress}% COMPLETE ${data.progress >= 75 ? '🔥' : '📊'}`;
          category = 'mission';
          tags.push('🎯');
          break;
        case 'top_fan_change':
          content = `NEW TOP FAN: ${data.username} 👑`;
          category = 'recognition';
          tags.push('👑');
          break;
        case 'mission_complete':
          content = `MISSION COMPLETE: ${data.missionName} ✅`;
          category = 'mission';
          tags.push('✅', '🏆');
          break;
        case 'viewer_milestone':
          content = `${data.count} VIEWERS! LET'S GO! 🚀`;
          category = 'hype';
          tags.push('🚀', '🔥');
          break;
      }

      if (content) {
        sendMessage(content, category, false, tags);
      }
    },
    [sendMessage]
  );

  return {
    sendMessage,
    sendPriority,
    clearPriority,
    deleteMessage,
    broadcastSettings,
    generateSystemMessage,
    channel: channelRef.current,
  };
}
