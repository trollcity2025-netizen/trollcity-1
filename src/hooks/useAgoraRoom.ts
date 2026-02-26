import { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { supabase } from '../lib/supabase';

/**
 * Unified hook for hybrid Mux + Agora rooms
 * 
 * @param config - Configuration object
 * @param config.roomId - Room/stream ID
 * @param config.roomType - Type of room: 'broadcast' | 'pod' | 'church' | 'talent' | 'tcps' | 'jail' | 'court' | 'election'
 * @param config.role - 'publisher' | 'viewer'
 * @param config.audioOnly - Whether room is audio-only (pods)
 * @param config.publish - Whether user should publish (host/speaker/guest)
 * @param config.muxPlaybackId - Mux playback ID for viewers
 * @param config.onUserJoined - Callback when user joins
 * @param config.onUserLeft - Callback when user leaves
 * @param config.onError - Error callback
 */
export function useAgoraRoom({
  roomId,
  roomType = 'broadcast',
  role = 'viewer',
  audioOnly = false,
  publish = false,
  muxPlaybackId,
  onUserJoined,
  onUserLeft,
  onError
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [error, setError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  // Refs
  const clientRef = useRef(null);
  const joinedRef = useRef(false);
  const channelNameRef = useRef(roomId);

  // Convert UUID to numeric UID for Agora
  const uuidToNumericUid = useCallback((uuid) => {
    if (!uuid) return Math.floor(Math.random() * 100000);
    // Simple hash to convert UUID to number
    let hash = 0;
    const str = typeof uuid === 'string' ? uuid : String(uuid);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100000;
  }, []);

  // Fetch Agora token via edge function
  const fetchToken = useCallback(async (channelName, userId) => {
    try {
      const numericUid = uuidToNumericUid(userId);
      
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channel: channelName,
          uid: numericUid
        }
      });

      if (error) {
        console.error('Error fetching token:', error);
        throw error;
      }

      if (!data?.token) {
        throw new Error('No token available for this room');
      }

      return data.token;
    } catch (err) {
      console.error('Token fetch error:', err);
      throw err;
    }
  }, []);

  // Create local tracks based on room type
  const createLocalTracks = useCallback(async () => {
    const tracks = [];
    
    try {
      // Audio track - always create for publishers
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      tracks.push(audioTrack);
      setLocalAudioTrack(audioTrack);

      // Video track - only create if not audio-only room
      if (!audioOnly && roomType !== 'pod') {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        });
        tracks.push(videoTrack);
        setLocalVideoTrack(videoTrack);
      }

      // Auto-enable tracks immediately
      for (const track of tracks) {
        await track.setEnabled(true);
      }

      return tracks;
    } catch (err) {
      console.error('Error creating local tracks:', err);
      throw err;
    }
  }, [audioOnly, roomType]);

  // Handle user published
  const handleUserPublished = useCallback(async (user, mediaType) => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.subscribe(user, mediaType);
      
      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
      }

      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) {
          return prev.map(u => u.uid === user.uid ? user : u);
        }
        return [...prev, user];
      });

      onUserJoined?.(user);
    } catch (err) {
      console.error('Error subscribing to user:', err);
    }
  }, [onUserJoined]);

  // Handle user unpublished
  const handleUserUnpublished = useCallback((user) => {
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    onUserLeft?.(user);
  }, [onUserLeft]);

  // Join Agora as publisher
  const joinAsPublisher = useCallback(async () => {
    if (joinedRef.current || !roomId) return;

    setIsJoining(true);
    setError(null);

    try {
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      clientRef.current = client;

      const numericUid = uuidToNumericUid(roomId);
      const token = await fetchToken(roomId, numericUid);

      await client.join(
        import.meta.env.VITE_AGORA_APP_ID!,
        roomId,
        token,
        numericUid
      );

      // Set up event listeners
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);

      // Create and publish local tracks if publishing
      if (publish) {
        const localTracks = await createLocalTracks();
        if (localTracks.length > 0) {
          await client.publish(localTracks);
          setIsPublishing(true);
        }
      }

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);

      return client;
    } catch (err) {
      console.error('Error joining as publisher:', err);
      setError(err.message || 'Failed to join room');
      setIsJoining(false);
      onError?.(err);
      throw err;
    }
  }, [roomId, publish, createLocalTracks, fetchToken, handleUserPublished, handleUserUnpublished, uuidToNumericUid, onError]);

  // Join as audience (Agora)
  const joinAsAudience = useCallback(async () => {
    if (joinedRef.current || !roomId) return;

    setIsJoining(true);
    setError(null);

    try {
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      clientRef.current = client;

      const numericUid = uuidToNumericUid(roomId);
      const token = await fetchToken(roomId, numericUid);

      await client.join(
        import.meta.env.VITE_AGORA_APP_ID!,
        roomId,
        token,
        numericUid
      );

      // Set up event listeners
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);

      // Automatically subscribe to existing users
      const users = await client.getUsers();
      for (const user of users) {
        if (user.audioTrack || user.videoTrack) {
          if (user.audioTrack) {
            await client.subscribe(user, 'audio');
            user.audioTrack.play();
          }
          if (user.videoTrack) {
            await client.subscribe(user, 'video');
          }
          setRemoteUsers(prev => [...prev, user]);
        }
      }

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);

      return client;
    } catch (err) {
      console.error('Error joining as audience:', err);
      setError(err.message || 'Failed to join room');
      setIsJoining(false);
      onError?.(err);
      throw err;
    }
  }, [roomId, fetchToken, handleUserPublished, handleUserUnpublished, uuidToNumericUid, onError]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    try {
      // Stop and close local tracks
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }

      // Leave Agora client
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      joinedRef.current = false;
      setIsConnected(false);
      setIsPublishing(false);
      setRemoteUsers([]);
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  }, [localAudioTrack, localVideoTrack]);

  // Determine if user should use Mux (viewer) or Agora (publisher)
  const shouldUseMux = useCallback(() => {
    if (role === 'viewer' && muxPlaybackId) {
      return true;
    }
    return false;
  }, [role, muxPlaybackId]);

  // Auto-join based on role
  useEffect(() => {
    if (!roomId || joinedRef.current) return;

    // Determine join method based on role and mux availability
    const useMux = shouldUseMux();
    
    if (!useMux && (publish || role === 'publisher')) {
      joinAsPublisher();
    } else if (!useMux) {
      // Viewer without mux - join as audience
      joinAsAudience();
    }
    // If useMux is true, viewer will use Mux player instead

    return () => {
      leaveRoom();
    };
  }, [roomId, role, publish, muxPlaybackId, shouldUseMux, joinAsPublisher, joinAsAudience, leaveRoom]);

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
    shouldUseMux,
    
    // For Mux playback
    muxPlaybackId,
    
    // Client ref for external access
    client: clientRef.current
  };
}

export default useAgoraRoom;