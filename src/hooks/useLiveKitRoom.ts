import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Room, 
  RoomEvent, 
  LocalVideoTrack, 
  LocalAudioTrack, 
  RemoteParticipant,
  RemoteVideoTrack,
  RemoteAudioTrack,
  VideoCaptureOptions,
  AudioCaptureOptions,
  VideoPresets,
  AudioPresets,
  createLocalAudioTrack
} from 'livekit-client';
import { supabase } from '../lib/supabase';

/**
 * Unified hook for LiveKit rooms
 * 
 * @param config - Configuration object
 * @param config.roomId - Room/stream ID
 * @param config.roomType - Type of room: 'broadcast' | 'pod' | 'church' | 'talent' | 'tcps' | 'jail' | 'court' | 'election'
 * @param config.role - 'publisher' | 'viewer'
 * @param config.audioOnly - Whether room is audio-only (pods)
 * @param config.publish - Whether user should publish (host/speaker/guest)
 * @param config.isAdmin - Whether user is admin (1080p) vs regular (720p)
 * @param config.onUserJoined - Callback when user joins
 * @param config.onUserLeft - Callback when user leaves
 * @param config.onError - Error callback
 */
export function useLiveKitRoom({
  roomId,
  roomType = 'broadcast',
  role = 'viewer',
  audioOnly = false,
  publish = false,
  isAdmin = false,
  onUserJoined,
  onUserLeft,
  onError
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const joinedRef = useRef(false);
  const localUserIdRef = useRef<string | null>(null);
  const joiningRef = useRef(false); // Track joining state to prevent race conditions

  // Get LiveKit credentials from environment
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;

  // Fetch LiveKit token via edge function
  const fetchToken = useCallback(async (roomName: string, userId: string) => {
    try {
      // Use livekit-token edge function
      const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          userId: userId,
          // Determine role based on publish parameter
          role: publish ? 'publisher' : 'viewer'
        }
      });

      if (tokenError) {
        console.error('[useLiveKitRoom] Error fetching token:', tokenError);
        throw tokenError;
      }

      if (!data?.token) {
        throw new Error('No token available for this room');
      }

      return data.token;
    } catch (err: any) {
      console.error('[useLiveKitRoom] Token fetch error:', err);
      throw err;
    }
  }, [publish]);

  // Resolve video preset based on admin status
  const videoPreset = isAdmin ? VideoPresets.h1080 : VideoPresets.h720;

  // Create local tracks based on room type
  const createLocalTracks = useCallback(async () => {
    try {
      // Audio track - always create for publishers
      const audioTrack = await createLocalAudioTrack();
      setLocalAudioTrack(audioTrack);

      // Video track - only create if not audio-only room
      if (!audioOnly && roomType !== 'pod') {
        const videoTrack = await LocalVideoTrack.create(videoPreset);
        setLocalVideoTrack(videoTrack);
      }

      return { audioTrack, videoTrack: localVideoTrack };
    } catch (err) {
      console.error('[useLiveKitRoom] Error creating local tracks:', err);
      throw err;
    }
  }, [audioOnly, roomType, videoPreset]);

  // Handle participant joined
  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Participant joined:', participant.identity);
    setRemoteUsers(prev => {
      const exists = prev.find(p => p.identity === participant.identity);
      if (exists) return prev;
      return [...prev, participant];
    });
    onUserJoined?.(participant);
  }, [onUserJoined]);

  // Handle participant left
  const handleParticipantLeft = useCallback((participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Participant left:', participant.identity);
    setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
    onUserLeft?.(participant);
  }, [onUserLeft]);

  // Handle track subscribed
  const handleTrackSubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Track subscribed:', track.kind, 'from', participant.identity);
    // Force re-render to show the new track
    setRemoteUsers(prev => [...prev]);
  }, []);

  // Handle track unsubscribed
  const handleTrackUnsubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
    console.log('[useLiveKitRoom] Track unsubscribed:', track.kind, 'from', participant.identity);
    setRemoteUsers(prev => [...prev]);
  }, []);

  // Join LiveKit as publisher
  const joinAsPublisher = useCallback(async (userId: string) => {
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joined');
      return roomRef.current;
    }
    
    if (joiningRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joining');
      // Wait for existing join to complete
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }
    
    if (!roomId || !userId) {
      console.warn('[useLiveKitRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          ...videoPreset,
          facingMode: 'user'
        },
        audioCaptureDefaults: {
          ...AudioPresets.audio,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Handle disconnection events to reset state
      room.on(RoomEvent.Disconnected, () => {
        console.log('[useLiveKitRoom] Room disconnected');
        joinedRef.current = false;
        joiningRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
      });

      // Handle reconnection events
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      // Get token
      const token = await fetchToken(roomId, userId);
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (!token || !url || !apiKey) {
        throw new Error('Missing LiveKit configuration');
      }

      // Connect to room
      await room.connect(url, token, {
        name: roomId,
        identity: userId
      });

      // Create and publish local tracks if publishing
      if (publish) {
        // Check if room is still connected before publishing
        if (!roomRef.current || room.state !== 'connected') {
          console.warn('[useLiveKitRoom] Room not connected, skipping track publishing');
        } else {
          // Create audio track
          const audioTrack = await createLocalAudioTrack();
          audioTrack.enable(); // Ensure audio is enabled
          setLocalAudioTrack(audioTrack);
          await room.localParticipant.publishTrack(audioTrack);

          // Create video track if not audio-only
          if (!audioOnly && roomType !== 'pod') {
            const videoTrack = await LocalVideoTrack.create(videoPreset);
            setLocalVideoTrack(videoTrack);
            await room.localParticipant.publishTrack(videoTrack);
          }

          setIsPublishing(true);
        }
      }

      // Get existing participants - guard against undefined
      const existingParticipants = room.participants ? Array.from(room.participants.values()) : [];
      setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      return room;
    } catch (err: any) {
      console.error('[useLiveKitRoom] Error joining as publisher:', err);
      
      // Check if this is a getUserMedia error - these often happen in LiveKit's internal
      // reconnection logic and don't necessarily mean the connection failed
      const errorMessage = err?.message || String(err) || '';
      const isGetUserMediaError = errorMessage.includes('getUserMedia');
      
      // Only reset state and call onError if it's NOT a getUserMedia error
      // or if we haven't successfully connected yet
      if (!isGetUserMediaError || !roomRef.current) {
        // Reset state on error
        joinedRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
        setError(err.message || 'Failed to join room');
        setIsJoining(false);
        joiningRef.current = false;
        onError?.(err);
        throw err;
      } else {
        // For getUserMedia errors, just log but don't fail
        console.warn('[useLiveKitRoom] Ignoring getUserMedia error - connection may still work');
        // If we got here, the connection might have succeeded despite the error
        if (roomRef.current && !joinedRef.current) {
          joinedRef.current = true;
          setIsConnected(true);
          setIsJoining(false);
          joiningRef.current = false;
          return roomRef.current;
        }
      }
    }
  }, [roomId, publish, audioOnly, roomType, videoPreset, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError]);

  // Join as viewer (LiveKit)
  const joinAsAudience = useCallback(async (userId: string) => {
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joined');
      return roomRef.current;
    }
    
    if (joiningRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joining');
      // Wait for existing join to complete
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }
    
    if (!roomId || !userId) {
      console.warn('[useLiveKitRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Handle disconnection events to reset state
      room.on(RoomEvent.Disconnected, () => {
        console.log('[useLiveKitRoom] Room disconnected');
        joinedRef.current = false;
        joiningRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
      });

      // Handle reconnection events
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      // Get token
      const token = await fetchToken(roomId, userId);
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (!token || !url || !apiKey) {
        throw new Error('Missing LiveKit configuration');
      }

      // Connect to room
      await room.connect(url, token, {
        name: roomId,
        identity: userId
      });

      // Get existing participants - guard against undefined
      const existingParticipants = room.participants ? Array.from(room.participants.values()) : [];
      setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      return room;
    } catch (err: any) {
      console.error('[useLiveKitRoom] Error joining as audience:', err);
      
      // Check if this is a getUserMedia error - these often happen in LiveKit's internal
      // reconnection logic and don't necessarily mean the connection failed
      const errorMessage = err?.message || String(err) || '';
      const isGetUserMediaError = errorMessage.includes('getUserMedia');
      
      // Only reset state and call onError if it's NOT a getUserMedia error
      // or if we haven't successfully connected yet
      if (!isGetUserMediaError || !roomRef.current) {
        // Reset state on error
        joinedRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
        setError(err.message || 'Failed to join room');
        setIsJoining(false);
        joiningRef.current = false;
        onError?.(err);
        throw err;
      } else {
        // For getUserMedia errors, just log but don't fail
        console.warn('[useLiveKitRoom] Ignoring getUserMedia error - connection may still work');
        // If we got here, the connection might have succeeded despite the error
        if (roomRef.current && !joinedRef.current) {
          joinedRef.current = true;
          setIsConnected(true);
          setIsJoining(false);
          joiningRef.current = false;
          return roomRef.current;
        }
      }
    }
  }, [roomId, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    try {
      // Stop and close local tracks
      if (localAudioTrack) {
        localAudioTrack.stop();
        setLocalAudioTrack(null);
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        setLocalVideoTrack(null);
      }

      // Disconnect from LiveKit room
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      // Reset all state and refs
      joinedRef.current = false;
      joiningRef.current = false;
      localUserIdRef.current = null;
      setIsConnected(false);
      setIsPublishing(false);
      setRemoteUsers([]);
    } catch (err) {
      console.error('[useLiveKitRoom] Error leaving room:', err);
      // Ensure state is reset even on error
      joinedRef.current = false;
      joiningRef.current = false;
      roomRef.current = null;
      setIsConnected(false);
      setIsPublishing(false);
    }
  }, [localAudioTrack, localVideoTrack]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (!localVideoTrack || !roomRef.current) return;

    try {
      if (localVideoTrack.isEnabled) {
        await roomRef.current.localParticipant.unpublishTrack(localVideoTrack);
        localVideoTrack.stop();
      } else {
        const newTrack = await LocalVideoTrack.create(videoPreset);
        setLocalVideoTrack(newTrack);
        await roomRef.current.localParticipant.publishTrack(newTrack);
      }
    } catch (err) {
      console.error('[useLiveKitRoom] Error toggling camera:', err);
    }
  }, [localVideoTrack, videoPreset]);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    if (!localAudioTrack || !roomRef.current) return;

    try {
      if (localAudioTrack.isEnabled) {
        await roomRef.current.localParticipant.unpublishTrack(localAudioTrack);
        localAudioTrack.stop();
      } else {
        const newTrack = await createLocalAudioTrack();
        setLocalAudioTrack(newTrack);
        await roomRef.current.localParticipant.publishTrack(newTrack);
      }
    } catch (err) {
      console.error('[useLiveKitRoom] Error toggling microphone:', err);
    }
  }, [localAudioTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    // State
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    
    // Methods
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    toggleCamera,
    toggleMicrophone,
    
    // Room ref for external access
    room: roomRef.current
  };
}

export default useLiveKitRoom;
