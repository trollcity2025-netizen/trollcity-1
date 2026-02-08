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

  const roomRef = useRef<Room | null>(null);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [minutes, setMinutes] = useState({ audio: 0, video: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [lowMinutesWarning, setLowMinutesWarning] = useState(false);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const dialCtxRef = useRef<AudioContext | null>(null);
  const dialOscRef = useRef<OscillatorNode | null>(null);
  const dialGainRef = useRef<GainNode | null>(null);
  const dialAudioRef = useRef<HTMLAudioElement | null>(null);
  const [dialToneSrc, setDialToneSrc] = useState('/sounds/calls/dialtone-classic.mp3');

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
          navigate('/tcps');
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

  useEffect(() => {
    if (!user?.id) return;
    const loadDialTone = async () => {
      try {
        const { data } = await supabase
          .from('user_call_sounds')
          .select('is_active,call_sound_catalog(asset_url,sound_type)')
          .eq('user_id', user.id)
          .eq('is_active', true);
        const rows = (data || []) as any[];
        const active = rows.find((row) => {
          const catalog = Array.isArray(row.call_sound_catalog)
            ? row.call_sound_catalog[0]
            : row.call_sound_catalog;
          return catalog?.sound_type === 'dialtone';
        });
        const soundCatalog = active
          ? Array.isArray(active.call_sound_catalog)
            ? active.call_sound_catalog[0]
            : active.call_sound_catalog
          : null;
        if (soundCatalog?.asset_url) {
          setDialToneSrc(soundCatalog.asset_url);
        }
      } catch (error) {
        // ignore
        void error;
      }
    };

    loadDialTone();
  }, [user?.id]);

  // End call
  const endCall = React.useCallback(async () => {
    try {
      if (isEnding) return;
      setIsEnding(true);

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (minuteDeductionIntervalRef.current) clearInterval(minuteDeductionIntervalRef.current);
      
      setIsCallStarted(false);
      setIsStartingCall(false);
      
      // Calculate final duration
      const durationMinutes = callStartTimeRef.current
        ? Math.ceil((new Date().getTime() - callStartTimeRef.current.getTime()) / 60000)
        : 0;

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

      // Update DB status if needed (for active room)
      if (roomId && user) {
        await supabase
          .from('call_rooms')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', roomId);
      }
      
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      
      toast.success('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      navigate('/messages');
    }
  }, [roomId, user, navigate, otherUserId, callType, isEnding]);

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

        // Start outgoing dial tone until remote audio or video is received
        try {
          if (dialAudioRef.current) {
            dialAudioRef.current.loop = true;
            await dialAudioRef.current.play();
          }
        } catch (error) {
          void error;
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 440;
            gain.gain.value = 0.03;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            dialCtxRef.current = ctx;
            dialOscRef.current = osc;
            dialGainRef.current = gain;
          } catch (fallbackError) {
            void fallbackError;
          }
        }

        newRoom.on(RoomEvent.Connected, () => {
          console.log('✅ Connected to call room');

          // Handle remote tracks
          newRoom!.on(RoomEvent.TrackSubscribed, (track, _publication, _participant) => {
            if (track.kind === 'video' && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            } else if (track.kind === 'audio') {
              track.attach();
            }
            // Stop dial tone when any remote track arrives
            if (dialAudioRef.current) {
              try {
                dialAudioRef.current.pause();
                dialAudioRef.current.currentTime = 0;
              } catch (error) {
                void error;
              }
            }
            if (dialOscRef.current) {
              try {
                dialOscRef.current.stop();
                dialOscRef.current.disconnect();
              } catch (error) {
                void error;
              }
              dialOscRef.current = null;
            }
            if (dialCtxRef.current) {
              try {
                dialCtxRef.current.close();
              } catch (error) {
                void error;
              }
              dialCtxRef.current = null;
            }
          });
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('❌ Disconnected from call');
          endCall();
        });

        await newRoom.connect(livekitUrl, token);
        roomRef.current = newRoom;
      } catch (err: any) {
        console.error('Call connection error:', err);
        toast.error('Failed to connect to call');
        navigate('/tcps');
      }
    };

    connectCall();

    const currentOsc = dialOscRef.current;
    const currentCtx = dialCtxRef.current;
    const currentAudio = dialAudioRef.current;

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
      // Clean up dial tone
      if (currentOsc) {
        try {
          currentOsc.stop();
          currentOsc.disconnect();
        } catch (error) {
          void error;
        }
        dialOscRef.current = null;
      }

      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        } catch (error) {
          void error;
        }
      }

      if (currentCtx) {
        try {
          currentCtx.close();
        } catch (error) {
          void error;
        }
        dialCtxRef.current = null;
      }
    };
  }, [roomId, user, livekitUrl, token, callType, isVideoOff, navigate, endCall]);

  // Get LiveKit token
  useEffect(() => {
    if (!roomId || !user) return;

    const getToken = async () => {
      try {
        const tokenResponse = await api.post('/livekit-token', {
          room: roomId,
          identity: user.email || user.id,
          isHost: true,
          canPublish: true, // Explicitly request publish permission
        });

        console.log('[Call] Token response:', { 
          success: tokenResponse.success,
          hasToken: !!tokenResponse.token,
          hasDataToken: !!tokenResponse.data?.token,
          keys: Object.keys(tokenResponse)
        });

        if (tokenResponse.error) {
          throw new Error(tokenResponse.error);
        }

        // Handle both flat and nested structure
        let tokenVal = tokenResponse.token || tokenResponse.data?.token;
        
        if (!tokenVal || typeof tokenVal !== 'string') {
          console.error('[Call] Invalid token received:', tokenResponse);
          throw new Error('Invalid token format received from server');
        }

        // Clean up token - remove whitespace and potential double quotes
        tokenVal = tokenVal.trim();
        if (tokenVal.startsWith('"') && tokenVal.endsWith('"')) {
            tokenVal = tokenVal.slice(1, -1);
        }

        const serverUrl = tokenResponse.livekitUrl || tokenResponse.serverUrl || tokenResponse.url || tokenResponse.data?.livekitUrl;
        
        if (!serverUrl) {
          throw new Error('LiveKit server URL not found');
        }

        console.log('[Call] Token received successfully', { 
          tokenLen: tokenVal.length, 
          tokenPreview: tokenVal.substring(0, 10) + '...',
          serverUrl 
        });

        setLivekitUrl(serverUrl);
        setToken(tokenVal);
      } catch (err: any) {
        console.error('Token error:', err);
        toast.error('Failed to initialize call');
        navigate('/tcps');
      }
    };

    getToken();
  }, [roomId, user, navigate]);

  const startCall = async () => {
    if (!roomRef.current || isStartingCall) return;
    setIsStartingCall(true);

    try {
      callStartTimeRef.current = new Date();
      setIsCallStarted(true);

      // Publish audio track
      if (callType === 'audio' || !isVideoOff) {
        const audioTrack = await createLocalAudioTrack();
        await roomRef.current.localParticipant.publishTrack(audioTrack);
      }

      // Publish video track if video call
      if (callType === 'video' && !isVideoOff) {
        const videoTrack = await createLocalVideoTrack({ facingMode: 'user' });
        await roomRef.current.localParticipant.publishTrack(videoTrack);
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
          videoRef.current.muted = true;
        }
      }

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

    } catch (err) {
      console.error('Error starting call:', err);
      toast.error('Failed to start call');
    } finally {
      setIsStartingCall(false);
    }
  };

  const toggleMute = async () => {
    if (!roomRef.current?.localParticipant) return;
    const enabled = !isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  };

  const toggleVideo = async () => {
    if (!roomRef.current?.localParticipant || callType === 'audio') return;
    const enabled = isVideoOff;
    await roomRef.current.localParticipant.setCameraEnabled(enabled);
    setIsVideoOff(!enabled);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <audio ref={dialAudioRef} src={dialToneSrc} />
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

