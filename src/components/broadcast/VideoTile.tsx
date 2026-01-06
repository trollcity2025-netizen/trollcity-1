import React, { useState, useEffect, useRef } from 'react'
import { Participant, Track, LocalParticipant } from 'livekit-client'
import { User, Mic, MicOff, Camera, CameraOff, X, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface VideoTileProps {
  participant: Participant
  isBroadcaster?: boolean
  className?: string
  style?: React.CSSProperties
  onLeave?: () => void
  isLocal?: boolean
  showControls?: boolean
  fit?: 'cover' | 'contain'
}

export default function VideoTile({ 
  participant, 
  isBroadcaster, 
  className = '', 
  style,
  onLeave, 
  isLocal,
  fit = 'cover'
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [showLocalControls, setShowLocalControls] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>(fit);

  // Sync prop fit with state
  useEffect(() => {
    setObjectFit(fit);
  }, [fit]);

  // Fetch profile for avatar
  useEffect(() => {
    const fetchProfile = async () => {
        if (!participant.identity) return;
        const { data } = await supabase.from('user_profiles').select('avatar_url').eq('id', participant.identity).single();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchProfile();
  }, [participant.identity]);

  useEffect(() => {
    const onSpeakingChanged = () => setSpeaking(participant.isSpeaking);
    const onTrackMuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) setIsVideoEnabled(false);
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(false);
    };
    const onTrackUnmuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) setIsVideoEnabled(true);
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(true);
    };
    const onTrackSubscribed = (track: Track) => {
        if (track.kind === Track.Kind.Video) {
            track.attach(videoRef.current!);
            setIsVideoEnabled(true);
        }
        if (track.kind === Track.Kind.Audio) {
            setIsAudioEnabled(true);
        }
    };
    const onTrackUnsubscribed = (track: Track) => {
         if (track.kind === Track.Kind.Video) setIsVideoEnabled(false);
    };

    participant.on('speakingChanged', onSpeakingChanged);
    participant.on('trackMuted', onTrackMuted);
    participant.on('trackUnmuted', onTrackUnmuted);
    participant.on('trackSubscribed', onTrackSubscribed);
    participant.on('trackUnsubscribed', onTrackUnsubscribed);
    
    // Initial state check
    setSpeaking(participant.isSpeaking);
    const vidPub = participant.getTrackPublication(Track.Source.Camera);
    if (vidPub && vidPub.isSubscribed && vidPub.videoTrack) {
        vidPub.videoTrack.attach(videoRef.current!);
        setIsVideoEnabled(!vidPub.isMuted);
    }
    const audPub = participant.getTrackPublication(Track.Source.Microphone);
    if (audPub) {
        setIsAudioEnabled(!audPub.isMuted);
    }

    return () => {
        participant.off('speakingChanged', onSpeakingChanged);
        participant.off('trackMuted', onTrackMuted);
        participant.off('trackUnmuted', onTrackUnmuted);
        participant.off('trackSubscribed', onTrackSubscribed);
        participant.off('trackUnsubscribed', onTrackUnsubscribed);
    };
  }, [participant]);

  const toggleCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          const enabled = await participant.setCameraEnabled(!isVideoEnabled);
          setIsVideoEnabled(enabled);
      }
  };

  const toggleMic = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          const enabled = await participant.setMicrophoneEnabled(!isAudioEnabled);
          const pub = participant.getTrackPublication(Track.Source.Microphone);
          setIsAudioEnabled(pub ? !pub.isMuted : false);
      }
  };

  const switchCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
         try {
             const devices = await navigator.mediaDevices.enumerateDevices();
             const videoDevices = devices.filter(d => d.kind === 'videoinput');
             if (videoDevices.length > 1) {
                 const currentTrack = participant.getTrackPublication(Track.Source.Camera)?.videoTrack;
                 const currentDeviceId = currentTrack?.mediaStreamTrack.getSettings().deviceId;
                 const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
                 if (nextDevice) {
                     await participant.setCameraEnabled(false);
                     await participant.setCameraEnabled(true, { deviceId: nextDevice.deviceId });
                 }
             }
         } catch (err) {
             console.error("Failed to switch camera", err);
         }
      }
  };

  const toggleFit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setObjectFit(prev => prev === 'cover' ? 'contain' : 'cover');
  };

  return (
    <div 
        className={`relative bg-zinc-900 rounded-2xl overflow-hidden transition-all duration-300 group shadow-lg ${className} ${speaking ? 'ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'ring-1 ring-white/10'}`}
        style={style}
        onClick={() => isLocal && setShowLocalControls(!showLocalControls)}
    >
      {/* Video Element */}
      <video 
        ref={videoRef} 
        className="w-full h-full transition-all duration-300"
        style={{ objectFit }}
      />
      
      {/* Fallback Profile Picture */}
      {!isVideoEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1625] to-[#0b091f]">
              <div className={`relative ${speaking ? 'animate-pulse' : ''}`}>
                  {avatarUrl ? (
                      <img src={avatarUrl} alt={participant.identity} className="w-24 h-24 rounded-full border-4 border-purple-500/30 shadow-xl" />
                  ) : (
                      <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-4 border-white/10">
                        <User size={40} className="text-white/20" />
                      </div>
                  )}
                  {!isAudioEnabled && (
                    <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-1.5 border-2 border-[#1a1625]">
                        <MicOff size={12} className="text-white" />
                    </div>
                  )}
              </div>
              <p className="mt-3 text-white/50 text-sm font-medium">Camera Off</p>
          </div>
      )}

      {/* Name Label */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[80%] z-10">
        <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/5">
            {isBroadcaster && <span className="text-yellow-400 text-xs">👑</span>}
            <span className="text-xs font-bold text-white truncate max-w-[100px]">{participant.name || participant.identity || 'Guest'}</span>
            {!isAudioEnabled && <MicOff size={10} className="text-red-400" />}
        </div>
      </div>

      {/* View Fit Toggle (Hover only) */}
      <button 
        onClick={toggleFit}
        className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20"
        title="Toggle Fit"
      >
        {objectFit === 'cover' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {/* Local Controls Overlay */}
      {isLocal && showLocalControls && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-6 animate-fadeIn">
              <div className="flex items-center gap-6">
                  <button onClick={toggleMic} className={`p-4 rounded-full transition-transform hover:scale-110 ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}>
                      {isAudioEnabled ? <Mic size={28} /> : <MicOff size={28} />}
                  </button>
                  <button onClick={toggleCamera} className={`p-4 rounded-full transition-transform hover:scale-110 ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}>
                      {isVideoEnabled ? <Camera size={28} /> : <CameraOff size={28} />}
                  </button>
                  <button onClick={switchCamera} className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform hover:scale-110">
                      <RefreshCw size={28} />
                  </button>
              </div>
              {onLeave && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onLeave(); }}
                    className="px-6 py-2 bg-red-600/20 border border-red-500/50 hover:bg-red-600 hover:text-white text-red-400 rounded-full font-bold text-sm flex items-center gap-2 transition-all"
                  >
                      <X size={16} /> Leave Seat
                  </button>
              )}
              <p className="text-white/30 text-xs mt-4">Tap anywhere to close</p>
          </div>
      )}
    </div>
  );
}
