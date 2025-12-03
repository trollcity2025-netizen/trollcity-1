import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
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

export default function Call({ roomId: propRoomId, callType: propCallType, otherUserId: propOtherUserId }: CallProps) {
  const { roomId: paramRoomId, type: paramType, userId: paramUserId } = useParams<{ roomId?: string; type?: string; userId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // Require authentication
  useEffect(() => {
    if (!user || !profile) {
      toast.error('Please log in to make calls');
      navigate('/auth');
    }
  }, [user, profile, navigate]);

  const roomId = propRoomId || paramRoomId || '';
  const callType = (propCallType || paramType || 'audio') as 'audio' | 'video';
  const otherUserId = propOtherUserId || paramUserId || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [minutes, setMinutes] = useState({ audio: 0, video: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [lowMinutesWarning, setLowMinutesWarning] = useState(false);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const minuteDeductionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  // Load minute balance
  useEffect(() => {
    if (!user?.id) return;

    const loadMinutes = async () => {
      try {
        const { data, error } = await supabase.rpc('get_call_balances', { p_user_id: user.id });
        if (error) throw error;
        
        const audio = data?.audio_minutes || 0;
        const video = data?.video_minutes || 0;
        setMinutes({ audio, video });

        // Check if user has enough minutes
        const requiredMinutes = callType === 'audio' ? 1 : 2;
        const hasMinutes = callType === 'audio' ? audio >= requiredMinutes : video >= requiredMinutes;

        if (!hasMinutes) {
          toast.error(`You don't have enough ${callType} minutes. Please purchase a package.`);
          navigate('/messages');
          return;
        }

        // Show warning if low on minutes
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

  // Initialize LiveKit connection
  useEffect(() => {
    if (!roomId || !user || !livekitUrl || !token) return;

    let newRoom: Room | null = null;

    const connectCall = async () => {
      try {
        newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        newRoom.on(RoomEvent.Connected, async () => {
          console.log('✅ Connected to call room');
          setIsConnected(true);
          callStartTimeRef.current = new Date();

          // Publish audio track
          if (callType === 'audio' || !isVideoOff) {
            const audioTrack = await createLocalAudioTrack();
            await newRoom!.localParticipant.publishTrack(audioTrack);
          }

          // Publish video track if video call
          if (callType === 'video' && !isVideoOff) {
            const videoTrack = await createLocalVideoTrack({ facingMode: 'user' });
            await newRoom!.localParticipant.publishTrack(videoTrack);
            if (videoRef.current) {
              videoTrack.attach(videoRef.current);
              videoRef.current.muted = true;
            }
          }

          // Handle remote tracks
          newRoom!.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === 'video' && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            } else if (track.kind === 'audio') {
              track.attach();
            }
          });

          // Start duration timer
          durationIntervalRef.current = setInterval(() => {
            if (callStartTimeRef.current) {
              const elapsed = Math.floor((new Date().getTime() - callStartTimeRef.current.getTime()) / 1000);
              setCallDuration(elapsed);
            }
          }, 1000);

          // Start minute deduction (every 60 seconds)
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

              // Check if out of minutes
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
          }, 60000); // Every 60 seconds
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('❌ Disconnected from call');
          endCall();
        });

        await newRoom.connect(livekitUrl, token);
        setRoom(newRoom);
      } catch (err: any) {
        console.error('Call connection error:', err);
        toast.error('Failed to connect to call');
        navigate('/messages');
      }
    };

    connectCall();

    return () => {
      if (newRoom) {
        newRoom.disconnect();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (minuteDeductionIntervalRef.current) {
        clearInterval(minuteDeductionIntervalRef.current);
      }
    };
  }, [roomId, user, livekitUrl, token, callType, isVideoOff, navigate]);

  // Get LiveKit token
  useEffect(() => {
    if (!roomId || !user) return;

    const getToken = async () => {
      try {
        const tokenResponse = await api.post('/livekit-token', {
          room: roomId,
          identity: user.email || user.id,
          isHost: true,
        });

        if (tokenResponse.error || !tokenResponse.token) {
          throw new Error(tokenResponse.error || 'Failed to get LiveKit token');
        }

        const serverUrl = tokenResponse.livekitUrl || tokenResponse.serverUrl;
        if (!serverUrl) {
          throw new Error('LiveKit server URL not found');
        }

        setLivekitUrl(serverUrl);
        setToken(tokenResponse.token);
      } catch (err: any) {
        console.error('Token error:', err);
        toast.error('Failed to initialize call');
        navigate('/messages');
      }
    };

    getToken();
  }, [roomId, user, navigate]);

  const endCall = async () => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      // Calculate final duration
      const durationMinutes = callStartTimeRef.current
        ? Math.ceil((new Date().getTime() - callStartTimeRef.current.getTime()) / 60000)
        : Math.ceil(callDuration / 60);

      // Save call history
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

      // Disconnect room
      if (room) {
        room.disconnect();
      }

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (minuteDeductionIntervalRef.current) {
        clearInterval(minuteDeductionIntervalRef.current);
      }
    } catch (err) {
      console.error('Error ending call:', err);
    } finally {
      navigate('/messages');
    }
  };

  const toggleMute = async () => {
    if (!room?.localParticipant) return;
    const enabled = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  };

  const toggleVideo = async () => {
    if (!room?.localParticipant || callType === 'audio') return;
    const enabled = isVideoOff;
    await room.localParticipant.setCameraEnabled(enabled);
    setIsVideoOff(!enabled);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Low Minutes Warning */}
      {lowMinutesWarning && (
        <div className="bg-yellow-600 text-black px-4 py-2 text-center font-semibold">
          ⚠️ Low on {callType} minutes! You have {callType === 'audio' ? minutes.audio : minutes.video} minutes remaining.
        </div>
      )}

      {/* Call Header */}
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

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
        {callType === 'video' && (
          <>
            {/* Remote Video */}
            <div className="absolute inset-0">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            {/* Local Video */}
            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-purple-500">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
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

      {/* Controls */}
      <div className="p-6 bg-black/80 backdrop-blur-sm border-t border-purple-500/30">
        <div className="flex items-center justify-center gap-4">
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
        </div>
      </div>
    </div>
  );
}

