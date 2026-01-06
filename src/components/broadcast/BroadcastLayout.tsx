import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Participant, Track } from 'livekit-client'
import { User, Minus, Plus } from 'lucide-react'

interface BroadcastLayoutProps {
  room: any
  broadcasterId: string
  isHost: boolean
  totalCoins?: number
  children?: React.ReactNode
}

interface VideoTileProps {
  participant: Participant
  isBroadcaster?: boolean
  className?: string
}

const VideoTile = ({ participant, isBroadcaster, className }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const onSpeakingChanged = (p: Participant) => {
        setSpeaking(p.isSpeaking);
    };
    participant.on('speakingChanged', () => setSpeaking(participant.isSpeaking));
    setSpeaking(participant.isSpeaking);
    
    // Attach video
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub && pub.isSubscribed && pub.videoTrack) {
        pub.videoTrack.attach(videoRef.current!);
    }
    
    const onTrackSubscribed = (track: Track) => {
        if (track.kind === Track.Kind.Video) {
            track.attach(videoRef.current!);
        }
    };
    participant.on('trackSubscribed', onTrackSubscribed);

    return () => {
        participant.off('speakingChanged', () => setSpeaking(participant.isSpeaking));
        participant.off('trackSubscribed', onTrackSubscribed);
    };
  }, [participant]);

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden transition-all duration-300 ${className} ${speaking ? 'speaking-glow' : 'border border-white/10'}`}>
      <style>{`
        .speaking-glow {
          border: 3px solid transparent;
          border-image: linear-gradient(45deg, #ff00ff, #00ffff, #00ff00, #ff9900);
          border-image-slice: 1;
          animation: rgbGlow 1s linear infinite;
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
          z-index: 10;
        }
        @keyframes rgbGlow {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `}</style>
      <video ref={videoRef} className="w-full h-full object-cover" />
      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-sm z-10">
        {isBroadcaster ? '👑 ' : ''}{participant.name || participant.identity || 'Guest'}
      </div>
    </div>
  );
};

export default function BroadcastLayout({ room, broadcasterId, isHost, totalCoins = 0, children }: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  const [guestSlotCount, setGuestSlotCount] = useState(5);

  const broadcaster = useMemo(() => {
    return participants.find(p => p.identity === broadcasterId);
  }, [participants, broadcasterId]);

  const guests = useMemo(() => {
    return participants.filter(p => p.identity !== broadcasterId);
  }, [participants, broadcasterId]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Main Broadcaster Area - Top 70-80% on Mobile, flexible on Desktop */}
      <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)] min-h-0">
        {broadcaster ? (
          <VideoTile participant={broadcaster} isBroadcaster={true} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            Waiting for broadcaster...
          </div>
        )}
        
        {/* Coin Counter Overlay */}
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg z-10">
           <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-xs">C</div>
           <span className="text-yellow-400 font-bold text-lg">{totalCoins.toLocaleString()}</span>
        </div>

        {/* Injected Overlays (e.g. Gifts) */}
        {children}
      </div>

      {/* Guest Row - Scrollable on Mobile, Grid on Desktop if needed, but user asked for scrollable row below */}
      <div className="shrink-0 h-[25%] min-h-[120px] max-h-[180px]">
        <div className="flex items-center justify-between mb-1 px-1">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Guests</h3>
          {isHost && (
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button 
                onClick={() => setGuestSlotCount(prev => Math.max(1, prev - 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs font-mono w-4 text-center">{guestSlotCount}</span>
              <button 
                onClick={() => setGuestSlotCount(prev => Math.min(6, prev + 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
        
        {/* Scrollable Guest Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide h-[calc(100%-20px)]">
          {Array.from({ length: guestSlotCount }).map((_, i) => (
            <div key={i} className="aspect-video h-full shrink-0 bg-white/5 rounded-lg border border-white/5 overflow-hidden relative">
              {guests[i] ? (
                <VideoTile 
                  participant={guests[i]} 
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10">
                  <User size={20} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
