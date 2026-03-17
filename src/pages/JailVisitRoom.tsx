
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Room } from 'livekit-client';
import { toast } from 'sonner';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

const VideoPlayer = ({ videoTrack, style }: { videoTrack: ILocalVideoTrack | IRemoteVideoTrack, style?: React.CSSProperties }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const playerRef = ref.current;
    if (playerRef && videoTrack) {
      videoTrack.play(playerRef);
    }
    return () => {
      if (playerRef && videoTrack) {
        videoTrack.stop();
      }
    };
  }, [videoTrack]);

  return <div ref={ref} style={{ width: '100%', height: '100%', ...style }}></div>;
};


const JailVisitRoom: React.FC = () => {
    const { visitId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
    const [remoteUser, setRemoteUser] = useState<IRemoteUser | null>(null);
    const [isJoining, setIsJoining] = useState(true);

    useEffect(() => {
        if (!user || !visitId) {
            toast.error("Invalid visit session.");
            navigate('/jail');
            return;
        }

        const client = new Room(({ mode: 'rtc', codec: 'vp8' });

        const joinCall = async () => {
            setIsJoining(true);
            try {
                const { data, error } = await supabase.functions.invoke('get-livekit-token', {
                    body: { channelName: visitId, userId: user.id },
                });

                if (error) throw new Error('Failed to get token');

                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_APP_ID!, visitId, data.token, user.id);

                const audioTrack = await  LocalAudioTrack.create();
                const videoTrack = await  LocalVideoTrack.create();

                setLocalAudioTrack(audioTrack);
                setLocalVideoTrack(videoTrack);

                await client.publish([audioTrack, videoTrack]);

                toast.success("Connected to visit.");
            } catch (error) {
                console.error("Failed to join jail visit:", error);
                toast.error("Could not connect to the visit. Please try again.");
                navigate('/jail');
            } finally {
                setIsJoining(false);
            }
        };

        const handleUserPublished = async (user: IRemoteUser, mediaType: 'audio' | 'video') => {
            await client.subscribe(user, mediaType);
            setRemoteUser(user);
        };

        const handleUserUnpublished = () => {
            setRemoteUser(null);
        };

        client.on('user-published', handleUserPublished);
        client.on('user-unpublished', handleUserUnpublished);

        joinCall();

        return () => {
            client.off('user-published', handleUserPublished);
            client.off('user-unpublished', handleUserUnpublished);
            localAudioTrack?.close();
            localVideoTrack?.close();
            room.disconnect();
        };
    }, [visitId, user, navigate, localAudioTrack, localVideoTrack]);



    if (isJoining) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-lg">Connecting to Visit...</p>
            </div>
        );
    }

    return (
        <div className="h-screen bg-black text-white flex flex-col relative">
            {/* Remote Video (Inmate) */}
            <div className="flex-1 bg-gray-900 relative">
                {remoteUser?.videoTrack ? (
                    <VideoPlayer videoTrack={remoteUser.videoTrack} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <p className="text-2xl font-bold">Waiting for inmate...</p>
                            <p className="text-gray-400">The other party has not connected yet.</p>
                        </div>
                    </div>
                )}
                 <div className="absolute top-4 left-4 bg-black/50 p-2 rounded">
                    <p className="font-bold">{remoteUser?.uid || 'Inmate'}</p>
                </div>
            </div>

            {/* Local Video (Visitor) */}
            <div className="absolute bottom-24 right-4 w-48 h-32 md:w-64 md:h-48 rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                {localVideoTrack ? (
                    <VideoPlayer videoTrack={localVideoTrack} />
                ) : (
                     <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <VideoOff className="w-10 h-10 text-gray-500" />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-gray-900/80 backdrop-blur-sm h-20 flex items-center justify-center gap-4 absolute bottom-0 w-full">
                <button
                    onClick={() => localAudioTrack?.setMuted(!localAudioTrack.muted)}
                    className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                    title={localAudioTrack?.muted ? "Unmute" : "Mute"}
                >
                    {localAudioTrack?.muted ? <MicOff className="w-6 h-6 text-red-500" /> : <Mic className="w-6 h-6" />}
                </button>
                <button
                    onClick={() => localVideoTrack?.setMuted(!localVideoTrack.muted)}
                    className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                    title={localVideoTrack?.muted ? "Turn Camera On" : "Turn Camera Off"}
                >
                    {localVideoTrack?.muted ? <VideoOff className="w-6 h-6 text-red-500" /> : <Video className="w-6 h-6" />}
                </button>
                <button
                    onClick={() => navigate('/jail')}
                    className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                    title="End Call"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default JailVisitRoom;
