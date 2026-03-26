import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack, RoomEvent } from 'livekit-client';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LiveKitViewerPlayerProps {
  streamId: string;
  broadcasterId: string;
  roomName: string;
}

const LiveKitViewerPlayer: React.FC<LiveKitViewerPlayerProps> = ({ streamId, broadcasterId, roomName }) => {
  const navigate = useNavigate();
  const roomRef = useRef<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<Map<string, RemoteParticipant>>(new Map());
  const streamEndedRef = useRef(false);

  // Helper function to play tracks for a participant
  const playParticipantTracks = useCallback((participant: RemoteParticipant) => {
    // LiveKit videoTrackPublications is a Map, convert to array
    const videoPubs = Array.from(participant.videoTrackPublications.values());
    const audioPubs = Array.from(participant.audioTrackPublications.values());
    
    console.log('[LiveKitViewerPlayer] Playing tracks for participant:', participant.identity, {
      videoPubsCount: videoPubs.length,
      audioPubsCount: audioPubs.length
    });
    
    // Play video tracks
    videoPubs.forEach((pub) => {
      if (pub.track && typeof (pub.track as any).play === 'function' && pub.track.kind === 'video') {
        const videoTrack = pub.track as RemoteVideoTrack;
        if (videoContainerRef.current) {
          console.log('[LiveKitViewerPlayer] Playing video track for:', participant.identity);
          try { videoTrack.play(videoContainerRef.current); } catch (e) { console.warn('[LiveKitViewerPlayer] video play failed:', e); }
        }
      }
    });
    
    // Play audio tracks
    audioPubs.forEach((pub) => {
      if (pub.track && typeof (pub.track as any).play === 'function' && pub.track.kind === 'audio') {
        const audioTrack = pub.track as RemoteAudioTrack;
        console.log('[LiveKitViewerPlayer] Playing audio track for:', participant.identity);
        try { audioTrack.play(); } catch (e) { console.warn('[LiveKitViewerPlayer] audio play failed:', e); }
      }
    });
  }, []);

  // Monitor stream status - redirect to summary when stream ends
  useEffect(() => {
    if (!streamId || streamEndedRef.current) return;

    const checkStreamStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('status')
          .eq('id', streamId)
          .single();

        if (error) {
          console.error('[LiveKitViewerPlayer] Error checking stream status:', error);
          return;
        }

        if (data?.status === 'ended') {
          console.log('[LiveKitViewerPlayer] Stream ended, navigating to summary');
          streamEndedRef.current = true;
          
          // Disconnect from LiveKit room
          if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
          }
          
          // Navigate to summary
          navigate(`/broadcast/summary/${streamId}`);
        }
      } catch (err) {
        console.error('[LiveKitViewerPlayer] Exception checking stream status:', err);
      }
    };

    // Check immediately
    checkStreamStatus();

    // Poll every 3 seconds
    const pollInterval = setInterval(checkStreamStatus, 3000);

    // Also subscribe to realtime changes
    const channel = supabase
      .channel(`stream-viewer-status:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new?.status === 'ended') {
            console.log('[LiveKitViewerPlayer] Realtime: Stream ended, navigating to summary');
            streamEndedRef.current = true;
            
            // Disconnect from LiveKit room
            if (roomRef.current) {
              roomRef.current.disconnect();
              roomRef.current = null;
            }
            
            // Navigate to summary
            navigate(`/broadcast/summary/${streamId}`);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate]);

  // Process all participants and their tracks
  const processParticipants = useCallback(() => {
    if (!roomRef.current) return;
    
    const participants = Array.from(roomRef.current.participants.values());
    console.log('[LiveKitViewerPlayer] Processing participants:', participants.length);
    
    participants.forEach((participant) => {
      participantsRef.current.set(participant.identity, participant);
      playParticipantTracks(participant);
    });
    
    // Update state with all participants
    setRemoteParticipants(Array.from(participantsRef.current.values()));
  }, [playParticipantTracks]);

  useEffect(() => {
    let mounted = true;

    const initLiveKitViewer = async () => {
      try {
        const viewerIdentity = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: {
            room: roomName,
            identity: viewerIdentity,
            name: 'Viewer',
            role: 'audience',
            isHost: false
          },
        });

        if (error) throw error;
        if (!data?.token) throw new Error('LiveKit token not received');

        const room = new Room();
        roomRef.current = room;

        // Handle participant connected - use RoomEvent
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          if (!mounted) return;
          console.log('[LiveKitViewerPlayer] Participant connected:', participant.identity);
          participantsRef.current.set(participant.identity, participant);
          setRemoteParticipants(Array.from(participantsRef.current.values()));
          
          // Play video when participant connects
          playParticipantTracks(participant);
        });

        // Handle participant disconnected - use RoomEvent
        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          if (!mounted) return;
          console.log('[LiveKitViewerPlayer] Participant disconnected:', participant.identity);
          participantsRef.current.delete(participant.identity);
          setRemoteParticipants(Array.from(participantsRef.current.values()));
        });

        // CRITICAL: Handle track subscribed - this is when tracks actually become available
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (!mounted) return;
          console.log('[LiveKitViewerPlayer] Track subscribed:', track.kind, 'from', participant.identity);
          // Update the participant in our ref
          participantsRef.current.set(participant.identity, participant);
          setRemoteParticipants(Array.from(participantsRef.current.values()));
          // Play the track
          playParticipantTracks(participant);
        });

        // Handle track unsubscribed
        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (!mounted) return;
          console.log('[LiveKitViewerPlayer] Track unsubscribed:', track.kind, 'from', participant.identity);
          participantsRef.current.set(participant.identity, participant);
          setRemoteParticipants(Array.from(participantsRef.current.values()));
        });

        await room.connect(
          import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
          data.token
        );

        console.log('LiveKit viewer joined room:', roomName);

        // If there are already participants, play their video
        // room.participants is a Map, not an array - convert using Array.from
        // Wait a moment for tracks to be subscribed
        setTimeout(() => {
          if (mounted) {
            processParticipants();
          }
        }, 1000);

      } catch (err: any) {
        console.error('LiveKit viewer error:', err);
        toast.error(`Failed to join stream: ${err.message}`);
      }
    };

    initLiveKitViewer();

    return () => {
      mounted = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
        console.log('LiveKit viewer left room:', roomName);
      }
    };
  }, [roomName, playParticipantTracks, processParticipants]);

  return (
    <div ref={videoContainerRef} className="w-full h-full bg-black relative">
      {remoteParticipants.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-lg">
          Waiting for broadcaster...
        </div>
      )}
    </div>
  );
};

export default LiveKitViewerPlayer;
