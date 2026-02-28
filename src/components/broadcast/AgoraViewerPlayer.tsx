import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface AgoraViewerPlayerProps {
  streamId: string;
  broadcasterId: string;
  agoraChannel: string;
}

const AgoraViewerPlayer: React.FC<AgoraViewerPlayerProps> = ({ streamId, broadcasterId, agoraChannel }) => {
  const client = useRef<IAgoraRTCClient | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const initAgoraViewer = async () => {
      try {
        client.current = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp8',
        });

        client.current.on('user-published', async (user, mediaType) => {
          await client.current?.subscribe(user, mediaType);
          if (!mounted) return;

          if (mediaType === 'video') {
            setRemoteUsers(prev => {
              const existing = prev.find(u => u.uid === user.uid);
              if (existing) {
                return prev.map(u => u.uid === user.uid ? user : u);
              } else {
                return [...prev, user];
              }
            });
            user.videoTrack?.play(videoContainerRef.current || undefined);
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }
        });

        client.current.on('user-unpublished', (user) => {
          if (!mounted) return;
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        client.current.on('user-joined', (user) => {
          console.log('Remote user joined:', user.uid);
        });

        client.current.on('user-left', (user) => {
          console.log('Remote user left:', user.uid);
          if (!mounted) return;
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        // Fetch Agora token for viewer
        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channel: agoraChannel,
            uid: 0, // Use 0 for viewer role
            role: 'audience',
          },
        });

        if (error) throw error;
        if (!data?.token) throw new Error('Agora token not received');

        const appId = import.meta.env.VITE_AGORA_APP_ID;
        if (!appId) {
          toast.error('Agora App ID is not configured in environment variables.');
          throw new Error('VITE_AGORA_APP_ID is not configured');
        }

        await client.current.join(appId, agoraChannel, data.token, null);
        console.log('Agora viewer joined channel:', agoraChannel);

      } catch (err: any) {
        console.error('Agora viewer error:', err);
        toast.error(`Failed to join stream: ${err.message}`);
      }
    };

    initAgoraViewer();

    return () => {
      mounted = false;
      if (client.current) {
        client.current.leave();
        client.current = null;
        console.log('Agora viewer left channel:', agoraChannel);
      }
    };
  }, [agoraChannel]);

  return (
    <div ref={videoContainerRef} className="w-full h-full bg-black relative">
      {remoteUsers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-lg">
          Waiting for broadcaster...
        </div>
      )}
      {/* Remote users' video will be played inside this container */}
    </div>
  );
};

export default AgoraViewerPlayer;
