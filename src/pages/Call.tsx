import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { 
  Room, 
  RoomEvent, 
  LocalVideoTrack, 
  LocalAudioTrack,
  RemoteParticipant,
  VideoPresets,
  AudioPresets
} from 'livekit-client';

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

  // LiveKit refs
  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [minutes, setMinutes] = useState({ audio: 0, video: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [lowMinutesWarning, setLowMinutesWarning] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);
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

  // Get LiveKit credentials
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;

  // Fetch LiveKit token
  const fetchLiveKitToken = useCallback(async (roomName: string, userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: roomName,
          userId: userId,
          role: 'publisher'
        }
      });

      if (error) {
        console.error('[Call] Error fetching LiveKit token:', error);
        throw error;
      }

      if (!data?.token) {
        throw new Error('No token available for this room');
      }

      return data.token;
    } catch (err) {
      console.error('[Call] Token fetch error:', err);
      throw err;
    }
  }, []);

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
      }
    };

    loadDialTone();
  }, [user?.id]);

  // Stop dial tone
  const stopDialTone = useCallback(() => {
    if (dialAudioRef.current) {
      try {
        dialAudioRef.current.pause();
        dialAudioRef.current.currentTime = 0;
      } catch (error) {
        // ignore
      }
    }
    if (dialOscRef.current) {
      try {
        dialOscRef.current.stop();
        dialOscRef.current.disconnect();
      } catch (error) {
        // ignore
      }
      dialOscRef.current = null;
    }
    if (dialCtxRef.current) {
      try {
        dialCtxRef.current.close();
      } catch (error) {
        // ignore
      }
      dialCtxRef.current = null;
    }
  }, []);

  // Handle participant joined
  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    console.log('[Call] Participant joined:', participant.identity);
    setRemoteParticipant(participant);
    stopDialTone();
  }, [stopDialTone]);

  // Handle participant left
  const handleParticipantLeft = useCallback((participant: RemoteParticipant) => {
    console.log('[Call] Participant left:', participant.identity);
    setRemoteParticipant(null);
  }, []);

  // Handle track subscribed
  const handleTrackSubscribed = useCallback((track: any, participant: RemoteParticipant) => {
    console.log('[Call] Track subscribed:', track.kind);
    
    if (track.kind === 'video' && remoteVideoRef.current) {
      const videoTrack = track as any;
      if (videoTrack.attach) {
        const mediaElement = videoTrack.attach();
        remoteVideoRef.current.srcObject = mediaElement.srcObject;
      }
    }
    
    if (track.kind === 'audio') {
      const audioTrack = track as any;
      if (audioTrack.attach) {
        const mediaElement = audioTrack.attach();
        mediaElement.play();
      }
    }
  }, []);

  // Initialize LiveKit connection
  useEffect(() => {
    if (!roomId || !user || !livekitToken) return;

    let room: Room | null = null;

    const connectCall = async () => {
      try {
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            ...VideoPresets.hd,
            facingMode: 'user'
          },
          audioCaptureDefaults: {
            ...AudioPresets.audio,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        roomRef.current = room;

        // Handle remote users
        room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

        const url = getLiveKitUrl();
        const apiKey = getLiveKitApiKey();

        if (!livekitToken || !url || !apiKey) {
          throw new Error('Missing LiveKit configuration');
        }

        // Connect to room
        await room.connect(url, livekitToken, {
          name: roomId,
          identity: user.id
        });

        // Check for existing participants
        const existingParticipants = Array.from(room.participants.values());
        if (existingParticipants.length > 0) {
          setRemoteParticipant(existingParticipants[0]);
          stopDialTone();
        }

        // Start dial tone until remote user joins
        try {
          if (dialAudioRef.current) {
            dialAudioRef.current.loop = true;
            await dialAudioRef.current.play();
          }
        } catch (error) {
          // fallback to oscillator
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
            // ignore
          }
        }

      } catch (err: any) {
        console.error('[Call] LiveKit connection error:', err);
        toast.error('Failed to connect to call');
        navigate('/tcps');
      }
    };

    connectCall();

    return () => {
      const leaveChannel = async () => {
        if (roomRef.current) {
          if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
          }
          if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
          }
          await roomRef.current.disconnect();
          roomRef.current = null;
        }
      };
      leaveChannel();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (minuteDeductionIntervalRef.current) {
        clearInterval(minuteDeductionIntervalRef.current);
      }
      stopDialTone();
    };
  }, [roomId, user, livekitToken, callType, navigate, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, stopDialTone]);

  // Get LiveKit Connection Details
  useEffect(() => {
    if (!roomId || !user) return;

    const getConnection = async () => {
      try {
        const token = await fetchLiveKitToken(roomId, user.id);
        setLivekitToken(token);
      } catch (err: any) {
        console.error('[Call] Token error:', err);
        toast.error('Failed to initialize call');
        navigate('/tcps');
      }
    };

    getConnection();
  }, [roomId, user, navigate, fetchLiveKitToken]);

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
      
      // Disconnect from LiveKit
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      
      toast.success('Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      navigate('/messages');
    }
  }, [roomId, user, otherUserId, callType, isEnding, navigate]);

  const startCall = async () => {
    if (!roomRef.current || isStartingCall || !user) return;
    setIsStartingCall(true);

    try {
      callStartTimeRef.current = new Date();
      setIsCallStarted(true);

      // Create and publish local tracks
      const audioTrack = await LocalAudioTrack.create(AudioPresets.audio);
      localAudioTrackRef.current = audioTrack;
      await roomRef.current.localParticipant.publishTrack(audioTrack);

      if (callType === 'video') {
        const videoTrack = await LocalVideoTrack.create(VideoPresets.hd);
        localVideoTrackRef.current = videoTrack;
        await roomRef.current.localParticipant.publishTrack(videoTrack);
        
        if (videoRef.current) {
          const mediaElement = videoTrack.attach();
          videoRef.current.srcObject = mediaElement.srcObject;
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
      }, 60000);

    } catch (err) {
      console.error('Error starting call:', err);
      toast.error('Failed to start call');
    } finally {
      setIsStartingCall(false);
    }
  };

  const toggleMute = async () => {
    if (!localAudioTrackRef.current || !roomRef.current) return;
    
    const shouldMute = !isMuted;
    
    try {
      if (shouldMute) {
        await roomRef.current.localParticipant.unpublishTrack(localAudioTrackRef.current);
        localAudioTrackRef.current.stop();
      } else {
        const newTrack = await LocalAudioTrack.create(AudioPresets.audio);
        localAudioTrackRef.current = newTrack;
        await roomRef.current.localParticipant.publishTrack(newTrack);
      }
    } catch (err) {
      console.error('Error toggling mute:', err);
    }
    
    setIsMuted(shouldMute);
  };

  const toggleVideo = async () => {
    if (!localVideoTrackRef.current || !roomRef.current || callType === 'audio') return;
    
    const shouldTurnOn = isVideoOff;
    
    try {
      if (shouldTurnOn) {
        const newTrack = await LocalVideoTrack.create(VideoPresets.hd);
        localVideoTrackRef.current = newTrack;
        await roomRef.current.localParticipant.publishTrack(newTrack);
        
        if (videoRef.current) {
          const mediaElement = newTrack.attach();
          videoRef.current.srcObject = mediaElement.srcObject;
        }
      } else {
        await roomRef.current.localParticipant.unpublishTrack(localVideoTrackRef.current);
        localVideoTrackRef.current.stop();
      }
    } catch (err) {
      console.error('Error toggling video:', err);
    }
    
    setIsVideoOff(!shouldTurnOn);
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
