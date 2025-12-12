import { useState, useEffect, useCallback, useRef } from 'react';
import { createLiveKitService, LiveKitService, LiveKitParticipant } from '../lib/LiveKitService';

export interface UnifiedLiveKitConfig {
  roomName: string;
  user: any;
  autoPublish?: boolean;
  maxReconnectAttempts?: number;
}

export function useUnifiedLiveKit(config: UnifiedLiveKitConfig) {
  const serviceRef = useRef<LiveKitService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);

  // Create service once
  if (!serviceRef.current) {
    console.log('🎥 Creating unified LiveKit service');
    serviceRef.current = createLiveKitService({
      roomName: config.roomName,
      user: config.user,
      autoPublish: config.autoPublish !== false, // Default to true
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      onConnected: () => {
        console.log('✅ LiveKit connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      },
      onDisconnected: () => {
        console.log('❌ LiveKit disconnected');
        setIsConnected(false);
        setIsConnecting(false);
      },
      onParticipantJoined: (participant) => {
        console.log('👤 Participant joined:', participant.identity);
        setParticipants(prev => new Map(prev.set(participant.identity, participant)));
      },
      onParticipantLeft: (participant) => {
        console.log('👤 Participant left:', participant.identity);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(participant.identity);
          return newMap;
        });
      },
      onTrackSubscribed: (track, participant) => {
        console.log('📥 Track subscribed:', track.kind, participant.identity);
        // Update participant with track info
        setParticipants(prev => {
          const newMap = new Map(prev);
          const updatedParticipant = { ...participant };
          if (track.kind === 'video') {
            // Store video track reference if needed
          } else if (track.kind === 'audio') {
            // Store audio track reference if needed
          }
          newMap.set(participant.identity, updatedParticipant);
          return newMap;
        });
      },
      onTrackUnsubscribed: (track, participant) => {
        console.log('📤 Track unsubscribed:', track.kind, participant.identity);
      },
      onError: (errorMsg) => {
        console.error('🔴 LiveKit error:', errorMsg);
        setError(errorMsg);
        setIsConnecting(false);
      }
    });
  }

  // Connect once on mount
  useEffect(() => {
    if (serviceRef.current && config.roomName && config.user) {
      console.log('🎥 Connecting LiveKit service');
      serviceRef.current.connect().catch(err => {
        console.error('Failed to connect:', err);
      });
    }

    // Cleanup on unmount
    return () => {
      if (serviceRef.current) {
        console.log('🧹 Cleaning up LiveKit service');
        serviceRef.current.destroy();
        serviceRef.current = null;
      }
    };
  }, []); // Empty dependency array - connect only once

  // Update config when it changes
  useEffect(() => {
    if (serviceRef.current) {
      serviceRef.current.updateConfig({
        roomName: config.roomName,
        user: config.user,
        autoPublish: config.autoPublish !== false,
        maxReconnectAttempts: config.maxReconnectAttempts || 5,
      });
    }
  }, [config.roomName, config.user?.id, config.autoPublish, config.maxReconnectAttempts]);

  // Update local participant state
  useEffect(() => {
    if (serviceRef.current) {
      const local = serviceRef.current.getLocalParticipant();
      setLocalParticipant(local);
    }
  }, [participants]); // Remove service from deps since it's stable

  // Control methods
  const connect = useCallback(async () => {
    if (!serviceRef.current) return false;

    setIsConnecting(true);
    setError(null);

    try {
      const success = await serviceRef.current.connect();
      return success;
    } catch (err) {
      setError('Failed to connect');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!serviceRef.current) return false;
    return await serviceRef.current.toggleCamera();
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!serviceRef.current) return false;
    return await serviceRef.current.toggleMicrophone();
  }, []);

  // Get room for advanced operations
  const getRoom = useCallback(() => {
    return serviceRef.current?.getRoom() || null;
  }, []);

  return {
    // State
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,

    // Methods
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    getRoom,

    // Service reference for advanced usage
    service: serviceRef.current
  };
}