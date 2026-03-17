import { useRef, useCallback, useEffect, useState } from 'react';
import { 
  Room, 
  RoomEvent, 
  LocalVideoTrack, 
  LocalAudioTrack, 
  RemoteParticipant,
  RemoteVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  Track,
} from 'livekit-client';
import { supabase } from '../lib/supabase';

interface UseBattleRoomOptions {
  battleId: string;
  challengerUserId: string;
  opponentUserId: string;
  currentUserId: string;
  isPublisher: boolean;
  localTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null;
  onRoomConnected?: (room: Room) => void;
  onRoomDisconnected?: () => void;
}

interface UseBattleRoomReturn {
  room: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  remoteParticipants: RemoteParticipant[];
  localAudioTrack: LocalAudioTrack | null;
  localVideoTrack: LocalVideoTrack | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Generate deterministic room ID from two user IDs
// Both users will generate the SAME room ID regardless of order
const generateDeterministicRoomId = (userId1: string, userId2: string): string => {
  const sortedIds = [userId1, userId2].sort();
  return `battle_${sortedIds[0]}_${sortedIds[1]}`;
};

export function useBattleRoom({
  battleId,
  challengerUserId,
  opponentUserId,
  currentUserId,
  isPublisher,
  localTracks,
  onRoomConnected,
  onRoomDisconnected,
}: UseBattleRoomOptions): UseBattleRoomReturn {
  
  // Refs for connection management
  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);
  const isConnectedRef = useRef(false);
  const mountedRef = useRef(true);
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate the deterministic room ID
  const roomId = generateDeterministicRoomId(challengerUserId, opponentUserId);
  
  console.log('[useBattleRoom] Deterministic room ID:', roomId);
  console.log('[useBattleRoom] Current user:', currentUserId, 'isPublisher:', isPublisher);

  // Handle participant connected
  const handleParticipantConnected = useCallback((participant: RemoteParticipant) => {
    console.log('[useBattleRoom] Participant connected:', participant.identity);
    setRemoteParticipants(prev => {
      if (prev.some(p => p.identity === participant.identity)) return prev;
      return [...prev, participant];
    });
  }, []);

  // Handle participant disconnected
  const handleParticipantDisconnected = useCallback((participant: RemoteParticipant) => {
    console.log('[useBattleRoom] Participant disconnected:', participant.identity);
    setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
  }, []);

  // Handle track subscribed
  const handleTrackSubscribed = useCallback((
    track: RemoteVideoTrack | RemoteAudioTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    console.log('[useBattleRoom] Track subscribed:', track.kind, 'from', participant.identity);
    // Force re-render to update UI
    setRemoteParticipants(prev => [...prev]);
  }, []);

  // Handle track unsubscribed
  const handleTrackUnsubscribed = useCallback((
    track: RemoteVideoTrack | RemoteAudioTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    console.log('[useBattleRoom] Track unsubscribed:', track.kind, 'from', participant.identity);
    setRemoteParticipants(prev => [...prev]);
  }, []);

  // Connect to the battle room
  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('[useBattleRoom] Already connecting, skipping duplicate attempt');
      return;
    }

    // Prevent if already connected
    if (isConnectedRef.current && roomRef.current) {
      console.log('[useBattleRoom] Already connected, skipping');
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    console.log('[useBattleRoom] Starting connection to room:', roomId);

    try {
      // Fetch token for the deterministic room
      const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: { 
          room: roomId, 
          userId: currentUserId, 
          role: isPublisher ? 'publisher' : 'viewer' 
        },
      });

      if (tokenError) {
        throw new Error(`Token error: ${tokenError.message}`);
      }

      if (!data?.token) {
        throw new Error('No token received');
      }

      // Create new Room instance
      const room = new Room({
        mode: 'rtc',
        codec: 'vp8',
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;
      
      // Set up event listeners BEFORE connecting
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

      // Get existing participants (in case already connected)
      const existingParticipants = Array.from(room.remoteParticipants.values());
      console.log('[useBattleRoom] Existing participants on connect:', existingParticipants.length);
      setRemoteParticipants(existingParticipants);

      // Connect to LiveKit
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud';
      
      await room.connect(livekitUrl, data.token, {
        name: roomId,
        identity: currentUserId,
      });

      if (!mountedRef.current) {
        // Component unmounted during connection
        room.disconnect();
        return;
      }

      console.log('[useBattleRoom] Connected to room:', roomId);
      isConnectedRef.current = true;
      setIsConnected(true);

      // If publisher, publish local tracks
      if (isPublisher && localTracks) {
        const [audioTrack, videoTrack] = localTracks;
        
        if (audioTrack) {
          try {
            await room.localParticipant.publishTrack(audioTrack, { name: 'audio' });
            setLocalAudioTrack(audioTrack);
            console.log('[useBattleRoom] Published audio track');
          } catch (e) {
            console.warn('[useBattleRoom] Failed to publish audio:', e);
          }
        }
        
        if (videoTrack) {
          try {
            await room.localParticipant.publishTrack(videoTrack, { name: 'video' });
            setLocalVideoTrack(videoTrack);
            console.log('[useBattleRoom] Published video track');
          } catch (e) {
            console.warn('[useBattleRoom] Failed to publish video:', e);
          }
        }
      }

      onRoomConnected?.(room);

    } catch (err: any) {
      console.error('[useBattleRoom] Connection error:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to connect to battle');
      }
    } finally {
      if (mountedRef.current) {
        isConnectingRef.current = false;
        setIsConnecting(false);
      }
    }
  }, [
    roomId, 
    currentUserId, 
    isPublisher, 
    localTracks, 
    handleParticipantConnected, 
    handleParticipantDisconnected,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    onRoomConnected
  ]);

  // Disconnect from the battle room
  const disconnect = useCallback(() => {
    console.log('[useBattleRoom] Disconnecting...');
    
    if (roomRef.current) {
      // Remove event listeners
      roomRef.current.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      roomRef.current.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      roomRef.current.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      roomRef.current.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Disconnect
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    
    isConnectedRef.current = false;
    isConnectingRef.current = false;
    setIsConnected(false);
    setRemoteParticipants([]);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    
    onRoomDisconnected?.();
  }, [handleParticipantConnected, handleParticipantDisconnected, handleTrackSubscribed, handleTrackUnsubscribed, onRoomDisconnected]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, []);

  return {
    room: roomRef.current,
    isConnected,
    isConnecting,
    remoteParticipants,
    localAudioTrack,
    localVideoTrack,
    error,
    connect,
    disconnect,
  };
}
