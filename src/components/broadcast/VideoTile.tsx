import React, { useState, useEffect, useRef } from 'react'
import { Participant, Track, LocalParticipant } from 'livekit-client'
import { User, Mic, MicOff, Camera, CameraOff, X, RefreshCw, Maximize2, Minimize2, Crown, Coins } from 'lucide-react'
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
  price?: number
  isHost?: boolean
  onDisableGuestMedia?: (participantId: string, disableVideo: boolean, disableAudio: boolean) => void
}

export default function VideoTile({
  participant,
  isBroadcaster,
  className = '',
  style,
  onLeave,
  isLocal,
  fit = 'cover',
  price,
  isHost = false,
  onDisableGuestMedia
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
        const { data } = await supabase.from('user_profiles').select('avatar_url').eq('id', participant.identity).maybeSingle();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchProfile();
  }, [participant.identity]);

  useEffect(() => {
    const attachVideo = () => {
        const vidPub = participant.getTrackPublication(Track.Source.Camera);
        // For LocalParticipant, isSubscribed might be false/undefined but track is present
        const isLocalParticipant = participant instanceof LocalParticipant;
        const canAttach = vidPub && (vidPub.isSubscribed || isLocalParticipant) && vidPub.videoTrack;
        
        if (canAttach && videoRef.current) {
            console.log(`[VideoTile] Attaching video track for ${participant.identity} (Local: ${isLocalParticipant})`);
            vidPub.videoTrack!.attach(videoRef.current);
            if (isLocalParticipant) {
                videoRef.current.muted = true;
                videoRef.current.volume = 0;
            }
            videoRef.current.playsInline = true;
            videoRef.current.play().catch(e => console.error("Video play failed", e));
            setIsVideoEnabled(!vidPub.isMuted);
        } else {
             // If we can't attach yet, maybe it's because track isn't subscribed/published
             console.log(`[VideoTile] Cannot attach video for ${participant.identity}. Pub: ${!!vidPub}, Track: ${!!vidPub?.videoTrack}`);
        }
    };

    const onSpeakingChanged = () => setSpeaking(participant.isSpeaking);
    const onTrackMuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) setIsVideoEnabled(false);
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(false);
    };
    const onTrackUnmuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) {
            setIsVideoEnabled(true);
            attachVideo(); // Re-attach just in case
        }
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(true);
    };
    const onTrackSubscribed = (track: Track) => {
        if (track.kind === Track.Kind.Video) {
            attachVideo();
        }
        if (track.kind === Track.Kind.Audio) {
            setIsAudioEnabled(true);
        }
    };
    const onTrackUnsubscribed = (track: Track) => {
         if (track.kind === Track.Kind.Video) setIsVideoEnabled(false);
    };

    const onTrackPublished = (pub: any) => {
        if (pub.kind === Track.Kind.Video) {
             // Small delay to ensure track is fully ready
             setTimeout(attachVideo, 100);
        }
    };

    (participant as any).on('speakingChanged', onSpeakingChanged);
    (participant as any).on('trackMuted', onTrackMuted);
    (participant as any).on('trackUnmuted', onTrackUnmuted);
    (participant as any).on('trackSubscribed', onTrackSubscribed);
    (participant as any).on('trackUnsubscribed', onTrackUnsubscribed);
    (participant as any).on('trackPublished', onTrackPublished);
    
    // Initial state check
    setSpeaking(participant.isSpeaking);
    attachVideo();
    const audPub = participant.getTrackPublication(Track.Source.Microphone);
    if (audPub) {
        setIsAudioEnabled(!audPub.isMuted);
    }

    return () => {
        (participant as any).off('speakingChanged', onSpeakingChanged);
        (participant as any).off('trackMuted', onTrackMuted);
        (participant as any).off('trackUnmuted', onTrackUnmuted);
        (participant as any).off('trackSubscribed', onTrackSubscribed);
        (participant as any).off('trackUnsubscribed', onTrackUnsubscribed);
        (participant as any).off('trackPublished', onTrackPublished);
    };
  }, [participant]);

  const toggleCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          const enabled = await participant.setCameraEnabled(!isVideoEnabled);
          setIsVideoEnabled(!!enabled);
      }
  };

  const toggleMic = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          await participant.setMicrophoneEnabled(!isAudioEnabled);
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

  // Extract metadata
  const metadata = React.useMemo(() => {
    try {
      return JSON.parse(participant.metadata || '{}');
    } catch {
      return {};
    }
  }, [participant.metadata]);

  const level = metadata.level || 1;
  const role = metadata.role || 'Guest';
  const roleColor = role === 'Admin' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 'text-purple-400 border-purple-500/30 bg-purple-500/10';

  const handleBroadcasterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent any action if this is the broadcaster's own tile
    if (isBroadcaster) {
      return;
    }
    if (isHost && !isLocal && !isBroadcaster && onDisableGuestMedia) {
      // Disable guest media when broadcaster clicks on guest box
      onDisableGuestMedia(participant.identity, true, true);
    } else if (isLocal) {
      setShowLocalControls(!showLocalControls);
    }
  };

  const handleDisableVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDisableGuestMedia) {
      onDisableGuestMedia(participant.identity, true, false);
      setShowLocalControls(false);
    }
  };

  const handleDisableAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDisableGuestMedia) {
      onDisableGuestMedia(participant.identity, false, true);
      setShowLocalControls(false);
    }
  };

  const handleDisableBoth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDisableGuestMedia) {
      onDisableGuestMedia(participant.identity, true, true);
      setShowLocalControls(false);
    }
  };

  return (
    <div className={`rgb-border ${speaking ? 'speaking' : ''} occupied`} style={style}>
      <div
        className={`tile-inner relative bg-zinc-900 rounded-2xl overflow-hidden transition-all duration-300 group shadow-lg ${className}`}
        onClick={handleBroadcasterClick}
      >
      {/* Video Element */}
      <video 
        ref={videoRef} 
        className="w-full h-full transition-all duration-300"
        muted={isLocal}
        playsInline
        autoPlay
        style={{ 
          objectFit,
          transform: isLocal ? 'scaleX(-1)' : 'none' 
        }}
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

      {/* Broadcaster Crown */}
      {isBroadcaster && (
         <div className="absolute top-4 left-4 z-10 drop-shadow-lg filter">
             <div className="relative">
                <Crown size={24} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                <div className="absolute inset-0 bg-yellow-400/50 blur-lg rounded-full" />
             </div>
         </div>
      )}

      {/* User Info Badge (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 max-w-[85%]">
        {/* Name Badge */}
        <div className="flex items-center gap-2 bg-[#1a0b2e]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/30 shadow-lg w-fit">
            {/* Connection Indicator */}
            <div className={`w-2 h-2 rounded-full ${(participant as any).isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm font-bold text-white truncate max-w-[120px]">
                {participant.name || participant.identity || 'Guest'}
            </span>
            {!isAudioEnabled && <MicOff size={12} className="text-red-400" />}
        </div>
        
        {/* Role/Level Badge */}
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded border border-white/10">
                <span className="text-[10px] font-bold text-yellow-500">LV {level}</span>
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${roleColor}`}>
                <span className="text-[10px] font-medium uppercase tracking-wider">{role}</span>
            </div>
        </div>
      </div>

      {/* Price Badge (Bottom Right) */}
      {typeof price === 'number' && price > 0 && (
        <div className="absolute bottom-4 right-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/30 text-yellow-300 text-sm flex items-center gap-1">
          <Coins className="w-4 h-4" />
          <span>{price.toLocaleString()} coins</span>
        </div>
      )}

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
      
      {/* Broadcaster Controls Overlay (for disabling guest media) */}
      {isHost && !isLocal && !isBroadcaster && showLocalControls && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-6 animate-fadeIn">
              <h3 className="text-white font-bold text-lg">Control Guest Media</h3>
              <div className="flex items-center gap-4">
                  <button onClick={handleDisableVideo} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-transform hover:scale-110">
                      <CameraOff size={28} />
                  </button>
                  <button onClick={handleDisableAudio} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-transform hover:scale-110">
                      <MicOff size={28} />
                  </button>
                  <button onClick={handleDisableBoth} className="p-4 rounded-full bg-red-700 hover:bg-red-800 text-white transition-transform hover:scale-110">
                      <CameraOff size={20} />
                      <MicOff size={20} />
                  </button>
              </div>
              <div className="flex gap-4 text-sm text-white/80">
                  <span>Disable Video</span>
                  <span>Disable Audio</span>
                  <span>Disable Both</span>
              </div>
              <p className="text-white/30 text-xs mt-4">Tap anywhere to close</p>
          </div>
      )}
      </div>
    </div>
  );
}
