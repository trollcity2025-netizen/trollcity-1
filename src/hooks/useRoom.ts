import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Room, 
  RoomEvent, 
  LocalVideoTrack, 
  LocalAudioTrack, 
  RemoteParticipant,
  RemoteVideoTrack,
  RemoteAudioTrack,
  VideoPresets,
  AudioPresets
} from "livekit-client";
import { supabase } from "../lib/supabase";

interface UseRoomOptions {
  url?: string;
  token?: string;
  isAdmin?: boolean;
  onConnected?: (room: Room) => void;
  onDisconnected?: () => void;
}

// Convert URL to room name (strip any protocol/path)
const extractRoomName = (url?: string): string => {
  if (!url) return '';
  // URL format: wss://[host]/live/[roomName]
  const parts = url.split('/');
  return parts[parts.length - 1] || '';
};

export function useRoom({ url, token, isAdmin = false, onConnected, onDisconnected }: UseRoomOptions = {}) {
  const [room, _setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const roomRef = useRef<Room | null>(null);

  // Fetch LiveKit token
  const fetchToken = useCallback(async (roomName: string, userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          userId: userId,
          role: 'publisher' // useRoom always publishes
        }
      });

      if (error) throw error;
      return data?.token;
    } catch (err) {
      console.error('[useRoom] Token fetch error:', err);
      return null;
    }
  }, []);

  // Handle participant connected
  const handleParticipantConnected = useCallback((participant: RemoteParticipant) => {
    console.log('[useRoom] Participant connected:', participant.identity);
    setRemoteUsers(prev => {
      if (prev.find(p => p.identity === participant.identity)) return prev;
      return [...prev, participant];
    });
    setViewerCount(prev => prev + 1);
  }, []);

  // Handle participant disconnected
  const handleParticipantDisconnected = useCallback((participant: RemoteParticipant) => {
    console.log('[useRoom] Participant disconnected:', participant.identity);
    setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
    setViewerCount(prev => Math.max(0, prev - 1));
  }, []);

  // Handle track subscribed
  const handleTrackSubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
    console.log('[useRoom] Track subscribed:', track.kind, 'from', participant.identity);
    // Force re-render
    setRemoteUsers(prev => [...prev]);
  }, []);

  // Handle track unsubscribed
  const handleTrackUnsubscribed = useCallback((track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
    console.log('[useRoom] Track unsubscribed:', track.kind, 'from', participant.identity);
    setRemoteUsers(prev => [...prev]);
  }, []);

  useEffect(() => {
    if (!url || !token) return;

    const roomName = extractRoomName(url);
    if (!roomName) {
      console.error('[useRoom] Invalid room URL');
      return;
    }

    const connect = async () => {
      try {
        // Generate a random user ID for this session
        const userId = `user-${Math.random().toString(36).substring(2, 15)}`;

        // If we have a token, use it directly; otherwise fetch one
        let actualToken = token;
        if (!token || token.length < 10) {
          actualToken = await fetchToken(roomName, userId);
          if (!actualToken) {
            console.error('[useRoom] Failed to get token');
            return;
          }
        }

        const videoPreset = isAdmin ? VideoPresets.h1080 : VideoPresets.h720;

        const livekitRoom = new Room({
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

        roomRef.current = livekitRoom;

        // Set up event listeners
        livekitRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        livekitRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        livekitRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        livekitRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

        // Get LiveKit URL from env
        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        
        if (!livekitUrl) {
          console.error('[useRoom] Missing VITE_LIVEKIT_URL');
          return;
        }

        // Connect to room
        await livekitRoom.connect(livekitUrl, actualToken, {
          name: roomName,
          identity: userId
        });

        _setRoom(livekitRoom);
        setIsConnected(true);
        onConnected?.(livekitRoom);

        // Create and publish local tracks
        const audioTrack = await LocalAudioTrack.create(AudioPresets.audio);
        const videoTrack = await LocalVideoTrack.create(videoPreset);
        
        await livekitRoom.localParticipant.publishTrack(audioTrack);
        await livekitRoom.localParticipant.publishTrack(videoTrack);
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        setIsCameraEnabled(true);
        setIsMicrophoneEnabled(true);

        // Get existing participants
        const existingParticipants = Array.from(livekitRoom.participants.values());
        setRemoteUsers(existingParticipants);
        setViewerCount(existingParticipants.length);

      } catch (error) {
        console.error("[useRoom] Failed to connect to room:", error);
      }
    };

    connect();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
      }
      onDisconnected?.();
    };
  }, [url, token, onConnected, onDisconnected, fetchToken, handleParticipantConnected, handleParticipantDisconnected, handleTrackSubscribed, handleTrackUnsubscribed, localAudioTrack, localVideoTrack]);

  const toggleCamera = async () => {
    if (localVideoTrack && roomRef.current) {
      const videoPreset = isAdmin ? VideoPresets.h1080 : VideoPresets.h720;
      try {
        if (isCameraEnabled) {
          await roomRef.current.localParticipant.unpublishTrack(localVideoTrack);
          localVideoTrack.stop();
        } else {
          const newTrack = await LocalVideoTrack.create(videoPreset);
          setLocalVideoTrack(newTrack);
          await roomRef.current.localParticipant.publishTrack(newTrack);
        }
        setIsCameraEnabled(!isCameraEnabled);
      } catch (err) {
        console.error('[useRoom] Error toggling camera:', err);
      }
    }
  };

  const toggleMicrophone = async () => {
    if (localAudioTrack && roomRef.current) {
      try {
        if (isMicrophoneEnabled) {
          await roomRef.current.localParticipant.unpublishTrack(localAudioTrack);
          localAudioTrack.stop();
        } else {
          const newTrack = await LocalAudioTrack.create(AudioPresets.audio);
          setLocalAudioTrack(newTrack);
          await roomRef.current.localParticipant.publishTrack(newTrack);
        }
        setIsMicrophoneEnabled(!isMicrophoneEnabled);
      } catch (err) {
        console.error('[useRoom] Error toggling microphone:', err);
      }
    }
  };

  return {
    room,
    isConnected,
    participants: remoteUsers,
    localParticipant: { isCameraEnabled, isMicrophoneEnabled, audioTrack: localAudioTrack, videoTrack: localVideoTrack },
    viewerCount,
    isCameraEnabled,
    isMicrophoneEnabled,
    toggleCamera,
    toggleMicrophone,
    // Legacy API aliases for backwards compatibility
    join: () => {}, // No-op - connection is automatic when url/token provided
    localTracks: [localVideoTrack, localAudioTrack],
    remoteUsers,
    leave: () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    },
  };
}

// Legacy alias for backwards compatibility - now uses LiveKit
export function useLiveKitRoomLegacy() {
  return useRoom({});
}

// LiveKit room hook - used by InterviewRoom and other components
export function useLiveKitRoom(options?: UseRoomOptions) {
  return useRoom(options || {});
}
