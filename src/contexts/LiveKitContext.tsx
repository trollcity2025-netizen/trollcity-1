import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Room, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { createLiveKitService, LiveKitService, LiveKitParticipant } from '../lib/LiveKitService';

interface LiveKitContextType {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Participants
  participants: Map<string, LiveKitParticipant>;
  localParticipant: LiveKitParticipant | null;

  // Room reference
  room: Room | null;

  // Control methods
  connect: (roomName: string, user: any, options?: { autoPublish?: boolean; role?: string }) => Promise<boolean>;
  disconnect: () => void;
  toggleCamera: () => Promise<boolean>;
  toggleMicrophone: () => Promise<boolean>;
  startPublishing: () => Promise<void>;

  // Service reference for advanced usage
  service: LiveKitService | null;
}

const LiveKitContext = createContext<LiveKitContextType | null>(null);

export function useLiveKit() {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
}

interface LiveKitProviderProps {
  children: React.ReactNode;
}

export function LiveKitProvider({ children }: LiveKitProviderProps) {
  const [service, setService] = useState<LiveKitService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

  // Initialize service on mount
  useEffect(() => {
    console.log('🎥 Initializing global LiveKit service...');

    const liveKitService = createLiveKitService({
      roomName: '', // Will be set when connecting
      user: null, // Will be set when connecting
      autoPublish: true,
      maxReconnectAttempts: 5,
      onConnected: () => {
        console.log('✅ Global LiveKit connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        setRoom(liveKitService.getRoom());
      },
      onDisconnected: () => {
        console.log('❌ Global LiveKit disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        setRoom(null);
      },
      onParticipantJoined: (participant) => {
        console.log('👤 Global participant joined:', participant.identity);
        setParticipants(prev => new Map(prev.set(participant.identity, participant)));
      },
      onParticipantLeft: (participant) => {
        console.log('👤 Global participant left:', participant.identity);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(participant.identity);
          return newMap;
        });
      },
      onTrackSubscribed: (track, participant) => {
        console.log('📥 Global track subscribed:', track.kind, participant.identity);
      },
      onTrackUnsubscribed: (track, participant) => {
        console.log('📤 Global track unsubscribed:', track.kind, participant.identity);
      },
      onError: (errorMsg) => {
        console.error('🔴 Global LiveKit error:', errorMsg);
        setError(errorMsg);
        setIsConnecting(false);
      }
    });

    setService(liveKitService);

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up global LiveKit service');
      liveKitService.destroy();
    };
  }, []);

  // Update local participant state
  useEffect(() => {
    if (service) {
      const local = service.getLocalParticipant();
      setLocalParticipant(local);
    }
  }, [service, participants]);

  const connect = useCallback(async (
    roomName: string,
    user: any,
    options: { autoPublish?: boolean; role?: string } = {}
  ): Promise<boolean> => {
    if (!service) {
      setError('LiveKit service not initialized');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Create new service instance for this connection
      const connectionService = createLiveKitService({
        roomName,
        user: { ...user, role: options.role || user.role },
        autoPublish: options.autoPublish !== false,
        maxReconnectAttempts: 5,
        onConnected: () => {
          console.log('✅ Room connected');
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          setRoom(connectionService.getRoom());
        },
        onDisconnected: () => {
          console.log('❌ Room disconnected');
          setIsConnected(false);
          setIsConnecting(false);
          setRoom(null);
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
        },
        onTrackUnsubscribed: (track, participant) => {
          console.log('📤 Track unsubscribed:', track.kind, participant.identity);
        },
        onError: (errorMsg) => {
          console.error('🔴 Connection error:', errorMsg);
          setError(errorMsg);
          setIsConnecting(false);
        }
      });

      setService(connectionService);

      const success = await connectionService.connect();
      return success;
    } catch (err) {
      setError('Failed to connect');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [service]);

  const disconnect = useCallback(() => {
    if (service) {
      service.disconnect();
    }
  }, [service]);

  const toggleCamera = useCallback(async () => {
    if (!service) return false;
    return await service.toggleCamera();
  }, [service]);

  const toggleMicrophone = useCallback(async () => {
    if (!service) return false;
    return await service.toggleMicrophone();
  }, [service]);

  const startPublishing = useCallback(async () => {
    if (!service) throw new Error('Service not available');
    return await service.startPublishing();
  }, [service]);

  const value: LiveKitContextType = {
    isConnected,
    isConnecting,
    error,
    participants,
    localParticipant,
    room,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    service
  };

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  );
}