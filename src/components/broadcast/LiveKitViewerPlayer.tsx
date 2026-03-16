import React, { useEffect, useRef, useState } from 'react';
import { Room, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface LiveKitViewerPlayerProps {
  streamId: string;
  broadcasterId: string;
  roomName: string;
}

const LiveKitViewerPlayer: React.FC<LiveKitViewerPlayerProps> = ({ streamId, broadcasterId, roomName }) => {
  const roomRef = useRef<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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

        room.on('participantConnected', (participant: RemoteParticipant) => {
          if (!mounted) return;
          setRemoteParticipants(prev => [...prev, participant]);
          
          // Play video when participant connects
          participant.videoTrackPublications.forEach((pub) => {
            if (pub.track && pub.track.kind === 'video') {
              const videoTrack = pub.track as RemoteVideoTrack;
              if (videoContainerRef.current) {
                videoTrack.play(videoContainerRef.current);
              }
            }
            if (pub.track && pub.track.kind === 'audio') {
              const audioTrack = pub.track as RemoteAudioTrack;
              audioTrack.play();
            }
          });
        });

        room.on('participantDisconnected', (participant: RemoteParticipant) => {
          if (!mounted) return;
          setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
        });

        await room.connect(
          import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
          data.token
        );

        console.log('LiveKit viewer joined room:', roomName);

        // If there are already participants, play their video
        room.participants.forEach((participant) => {
          setRemoteParticipants(prev => [...prev, participant]);
          
          participant.videoTrackPublications.forEach((pub) => {
            if (pub.track && pub.track.kind === 'video') {
              const videoTrack = pub.track as RemoteVideoTrack;
              if (videoContainerRef.current) {
                videoTrack.play(videoContainerRef.current);
              }
            }
            if (pub.track && pub.track.kind === 'audio') {
              const audioTrack = pub.track as RemoteAudioTrack;
              audioTrack.play();
            }
          });
        });

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
  }, [roomName]);

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
