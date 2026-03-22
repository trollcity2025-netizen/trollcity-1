import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Room, 
  LocalAudioTrack, 
  createLocalAudioTrack, 
  RemoteParticipant, 
  RemoteTrack, 
  RemoteTrackPublication,
  RemoteAudioTrack 
} from 'livekit-client';
import { supabase } from '@/lib/supabase';
import { useTrollStationStore } from '@/stores/useTrollStationStore';

interface UseTrollStationLiveKitOptions {
  roomName: string;
  isHost: boolean;
  onParticipantSpeaking?: (participantId: string, speaking: boolean) => void;
  onAudienceCountChange?: (count: number) => void;
}

export function useTrollStationLiveKit({ roomName, isHost, onParticipantSpeaking, onAudienceCountChange }: UseTrollStationLiveKitOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [speakers, setSpeakers] = useState<{ id: string; name: string; isSpeaking: boolean }[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const connect = useCallback(async () => {
    if (isConnecting || isConnected || !roomName) return;

    setIsConnecting(true);

    try {
      console.log('Connecting to LiveKit as host:', isHost);
      
      // Get LiveKit URL from env
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) {
        console.error('VITE_LIVEKIT_URL not configured');
        setIsConnecting(false);
        return;
      }

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: `troll-station-${roomName}`,
          role: isHost ? 'publisher' : 'subscriber',
          userId: `troll-station-${Date.now()}`,
        },
      });

      if (error || !data?.token) {
        console.error('Failed to get LiveKit token:', error);
        setIsConnecting(false);
        return;
      }

      console.log('Got LiveKit token, connecting to room...');

      // Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Handle participant events
      room.on('participantConnected', (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        updateSpeakersList(room);
        // Update audience count (include local participant + all remote participants)
        const count = 1 + Array.from(room.participants.values()).length;
        onAudienceCountChange?.(count);
      });

      room.on('participantDisconnected', (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        updateSpeakersList(room);
        // Update audience count
        const count = 1 + Array.from(room.participants.values()).length;
        onAudienceCountChange?.(count);
      });

      room.on('trackSubscribed', (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === 'audio' && track instanceof RemoteAudioTrack) {
          const audioElement = document.createElement('audio');
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElementsRef.current.set(participant.identity, audioElement);
          track.attach(audioElement);
        }
      });

      room.on('trackUnsubscribed', (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        const audioElement = audioElementsRef.current.get(participant.identity);
        if (audioElement) {
          audioElement.remove();
          audioElementsRef.current.delete(participant.identity);
        }
      });

      // Handle speaking events
      room.on('speakerChanged', (speakers) => {
        updateSpeakersList(room);
        speakers.forEach((participant) => {
          const isSpeaking = room.activeSpeakers.includes(participant);
          onParticipantSpeaking?.(participant.identity, isSpeaking);
        });
      });

      // Connect to room - use the URL directly
      const wsUrl = livekitUrl.startsWith('wss://') ? livekitUrl : `wss://${livekitUrl}`;
      console.log('Connecting to:', wsUrl);
      await room.connect(wsUrl, data.token);
      setIsConnected(true);
      console.log('Connected to LiveKit!');
      
      // Initial audience count (host + any existing participants)
      const initialCount = 1 + Array.from(room.participants.values()).length;
      onAudienceCountChange?.(initialCount);

      // Publish local audio if host
      if (isHost) {
        try {
          console.log('Publishing microphone...');
          const audioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
          });
          await room.localParticipant.publishTrack(audioTrack);
          console.log('Microphone published!');
        } catch (micError) {
          console.error('Failed to publish microphone:', micError);
        }
      }

      // Initial speakers update
      updateSpeakersList(room);
    } catch (error) {
      console.error('Error connecting to LiveKit:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [roomName, isHost, isConnecting, isConnected]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    audioElementsRef.current.forEach((el) => el.remove());
    audioElementsRef.current.clear();
    setIsConnected(false);
    setSpeakers([]);
  }, []);

  const updateSpeakersList = (room: Room) => {
    try {
      const participants = Array.from(room.participants?.values() || []);
      const speakersList = participants.map((p: RemoteParticipant) => ({
        id: p.identity,
        name: p.name || p.identity,
        isSpeaking: room.activeSpeakers?.includes(p) || false,
      }));
      setSpeakers(speakersList);
    } catch (error) {
      console.error('Error updating speakers list:', error);
      setSpeakers([]);
    }
  };

  // Audio ducking when someone is speaking
  const enableDucking = useCallback((audioElement: HTMLAudioElement, duckVolume: number = 0.2) => {
    const originalVolume = audioElement.volume;
    audioElement.volume = duckVolume;
    return () => {
      audioElement.volume = originalVolume;
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Mute/unmute local audio
  const toggleMute = useCallback(() => {
    if (!roomRef.current) return;
    
    const localParticipant = roomRef.current.localParticipant;
    const audioTracks = Array.from(localParticipant.audioTrackPublications.values());
    
    audioTracks.forEach((publication) => {
      if (publication.track) {
        if (micMuted) {
          // Unmute - enable track
          publication.track.enable();
        } else {
          // Mute - disable track
          publication.track.disable();
        }
      }
    });
  }, [micMuted]);

  return {
    isConnected,
    isConnecting,
    speakers,
    connect,
    disconnect,
    room: roomRef.current,
    enableDucking,
    toggleMute,
    micMuted,
    setMicMuted,
  };
}

// Hook to manage LiveKit connection state in store
export function useTrollStationVoice() {
  const { currentSession, permissions, setVoiceConnected, updateSpeakers, setSpeaking, setAudienceCount } = useTrollStationStore();
  const [roomName, setRoomName] = useState<string | null>(null);

  const isHost = currentSession?.dj_id === useTrollStationStore.getState().station?.current_dj_id || permissions.isDJ;

  const { isConnected, isConnecting, speakers, connect, disconnect, micMuted, setMicMuted, toggleMute } = useTrollStationLiveKit({
    roomName: roomName || '',
    isHost,
    onParticipantSpeaking: (participantId, speaking) => {
      if (speaking) {
        setSpeaking(true);
      } else {
        setSpeaking(false);
      }
    },
    onAudienceCountChange: (count) => {
      setAudienceCount(count);
    },
  });

  useEffect(() => {
    if (currentSession?.livekit_room_name) {
      setRoomName(currentSession.livekit_room_name);
      if (!isConnected) {
        connect();
      }
    } else {
      disconnect();
    }
  }, [currentSession?.livekit_room_name]);

  useEffect(() => {
    setVoiceConnected(isConnected);
    updateSpeakers(speakers);
  }, [isConnected, speakers]);

  return {
    isConnected,
    isConnecting,
    speakers,
    connect,
    disconnect,
    micMuted,
    setMicMuted,
    toggleMute,
  };
}
