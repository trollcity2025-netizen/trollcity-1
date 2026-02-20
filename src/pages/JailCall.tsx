
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface CallProps {
  roomId?: string;
  callType?: 'audio' | 'video';
  otherUserId?: string;
}

export default function JailCall({ roomId: propRoomId, callType: propCallType, otherUserId: propOtherUserId }: CallProps) {
  const { roomId: paramRoomId, type: paramType, userId: paramUserId } = useParams<{ roomId?: string; type?: string; userId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  useEffect(() => {
    if (!user || !profile) {
      toast.error('Please log in to make calls');
      navigate('/auth');
    }
  }, [user, profile, navigate]);

  const roomId = propRoomId || paramRoomId || '';
  const callType = (propCallType || paramType || 'audio') as 'audio' | 'video';
  const otherUserId = propOtherUserId || paramUserId || '';

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [minutes, setMinutes] = useState({ audio: 0, video: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [lowMinutesWarning, setLowMinutesWarning] = useState(false);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const remoteUsers = useRef<IAgoraRTCRemoteUser[]>([]);

  const videoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const minuteDeductionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadMinutes = async () => {
      try {
        const { data, error } = await supabase.rpc('get_call_balances', { p_user_id: user.id });
        if (error) throw error;
        
        const audio = data?.audio_minutes || 0;
        const video = data?.video_minutes || 0;
        setMinutes({ audio, video });

        const requiredMinutes = callType === 'audio' ? 1 : 2;
        const hasMinutes = callType === 'audio' ? audio >= requiredMinutes : video >= requiredMinutes;

        if (!hasMinutes) {
          toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`);
          navigate('/tcps');
          return;
        }

        if (callType === 'audio' && audio < 5) {
          setLowMinutesWarning(true);
        } else if (callType === 'video' && video < 10) {
          setLowMinutesWarning(true);
        }
      } catch (err: any) {
        console.error('Error loading minutes:', err);
        toast.error('Failed to load call minutes');
      }
    };

    loadMinutes();
  }, [user?.id, callType, navigate]);

  const endCall = React.useCallback(async () => {
    try {
      if (isEnding) return;
      setIsEnding(true);

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (minuteDeductionIntervalRef.current) clearInterval(minuteDeductionIntervalRef.current);
      
      setIsCallStarted(false);
      setIsStartingCall(false);
      
      const durationMinutes = callStartTimeRef.current
        ? Math.ceil((new Date().getTime() - callStartTimeRef.current.getTime()) / 60000)
        : 0;

      if (otherUserId && user?.id) {
        await supabase.from('call_history').insert({
          caller_id: user.id,
          receiver_id: otherUserId,
          room_id: roomId,
          type: callType,
          duration_minutes: durationMinutes,
          ended_at: new Date().toISOString(),
        });
      }

      if (roomId && user) {
        await supabase
          .from('call_rooms')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', roomId);
      }
      
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current = null;
      }
      
      toast.success('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      window.location.href = '/messages';
    }
  }, [roomId, user, otherUserId, callType, isEnding]);

  useEffect(() => {
    if (!roomId || !user || !agoraToken) return;

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        if (remoteVideoRef.current) {
            user.videoTrack?.play(remoteVideoRef.current);
        }
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
        //
    };

    const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
      remoteUsers.current.push(user);
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      remoteUsers.current = remoteUsers.current.filter(u => u.uid !== user.uid);
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);

    const connect = async () => {
        try {
            await client.join(import.meta.env.VITE_AGORA_APP_ID, roomId, agoraToken, user.id);
        } catch (error) {
            console.error('Failed to join Agora channel', error);
            toast.error('Failed to connect to call');
            navigate('/tcps');
        }
    }

    connect();

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
      client.leave();
    };
  }, [roomId, user, agoraToken, navigate]);

  useEffect(() => {
    if (!roomId || !user) return;

    const getToken = async () => {
      try {
        const { token } = await api.post('/agora-token', {
          room: roomId,
          identity: user.email || user.id,
          role: 'host',
        });
        setAgoraToken(token);
      } catch (err: any) {
        console.error('Failed to get agora token:', err);
        toast.error('Failed to initialize call');
        navigate('/tcps');
      }
    };

    getToken();
  }, [roomId, user, navigate]);

  const startCall = async () => {
    if (!clientRef.current || isStartingCall) return;
    setIsStartingCall(true);

    try {
      callStartTimeRef.current = new Date();
      setIsCallStarted(true);

      if (callType === 'audio' || !isVideoOff) {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await clientRef.current.publish(audioTrack);
        localAudioTrackRef.current = audioTrack;
      }

      if (callType === 'video' && !isVideoOff) {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        await clientRef.current.publish(videoTrack);
        if (videoRef.current) {
            videoTrack.play(videoRef.current);
        }
        localVideoTrackRef.current = videoTrack;
      }

      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - callStartTimeRef.current.getTime()) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

      minuteDeductionIntervalRef.current = setInterval(async () => {
        if (!user?.id) return;

        const deductionAmount = callType === 'audio' ? 1 : 2;
        const { data, error } = await supabase.rpc('deduct_call_minutes', {
          p_user_id: user.id,
          p_minutes: deductionAmount,
          p_type: callType
        });

        if (error) {
          console.error('Error deducting minutes:', error);
        } else {
          const newAudio = data?.audio_minutes || 0;
          const newVideo = data?.video_minutes || 0;
          setMinutes({ audio: newAudio, video: newVideo });

          const hasMinutes = callType === 'audio' ? newAudio > 0 : newVideo > 0;
          if (!hasMinutes) {
            toast.error('You ran out of minutes. Call ending...');
            endCall();
          } else if (callType === 'audio' && newAudio < 5) {
            setLowMinutesWarning(true);
          } else if (callType === 'video' && newVideo < 10) {
            setLowMinutesWarning(true);
          }
        }
      }, 60000);

    } catch (err) {
      console.error('Error starting call:', err);
      toast.error('Failed to start call');
    } finally {
      setIsStartingCall(false);
    }
  };

  const toggleMute = async () => {
    if (!localAudioTrackRef.current) return;
    await localAudioTrackRef.current.setMuted(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (!localVideoTrackRef.current || callType === 'audio') return;
    await localVideoTrackRef.current.setEnabled(!isVideoOff);
    setIsVideoOff(!isVideoOff);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {lowMinutesWarning && (
        <div className="bg-yellow-600 text-black px-4 py-2 text-center font-semibold">
          ⚠️ Low on {callType} minutes! You have {callType === 'audio' ? minutes.audio : minutes.video} minutes remaining.
        </div>
      )}

      <div className="p-4 bg-black/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">{callType === 'audio' ? 'Audio' : 'Video'} Call</p>
            <p className="text-gray-400 text-sm">{formatDuration(callDuration)}</p>
          </div>
          <div className="text-right">
            <p className="text-purple-300 text-sm">
              {callType === 'audio' ? `${minutes.audio}` : `${minutes.video}`} {callType} min
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        {callType === 'video' && (
          <>
            <div className="absolute inset-0" ref={remoteVideoRef}></div>
            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-purple-500" ref={videoRef}></div>
          </>
        )}
        {callType === 'audio' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-16 h-16 text-white" />
              </div>
              <p className="text-white text-xl font-semibold">Audio Call</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-black/80 backdrop-blur-sm border-t border-purple-500/30">
        <div className="flex items-center justify-center gap-4">
          {!isCallStarted ? (
            <button
              onClick={startCall}
              disabled={isStartingCall}
              className="px-8 py-4 rounded-full bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 font-semibold flex items-center gap-2"
            >
              {isStartingCall ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Phone className="w-6 h-6" />
                  Start Call
                </>
              )}
            </button>
          ) : (
            <>
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} text-white hover:bg-opacity-80 transition`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} text-white hover:bg-opacity-80 transition`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button
                onClick={endCall}
                disabled={isEnding}
                className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
