import React, { useRef, useState, useEffect } from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import { useBroadcastLayout } from '../../hooks/useBroadcastLayout';
import VideoTile from '../broadcast/VideoTile';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  seats?: any[];
  onLeaveSession?: () => void;
  joinPrice?: number;
  onJoinRequest?: (seatIndex: number) => void;
}

export default function ResponsiveVideoGrid({
  participants,
  localParticipant,
  broadcasterId,
  seats,
  onLeaveSession,
  joinPrice = 0,
  onJoinRequest
}: ResponsiveVideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLandscape, setIsLandscape] = useState(true);

  // Monitor container size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        setIsLandscape(width > height);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const TOTAL_SLOTS = 6;
  
  const { tileStyles } = useBroadcastLayout(
    participants,
    dimensions.width,
    dimensions.height,
    isLandscape,
    TOTAL_SLOTS
  );

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden bg-black/50"
    >
      {/* Render Slots */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
        const style = tileStyles[i];
        if (!style) return null;

        const seat = seats && seats[i];
        let p = seat ? participants.find(p => p.identity === seat.user_id) : null;

        // Special case: Broadcaster slot (i=0) always shows broadcaster if they exist
        if (i === 0 && !p) {
          p = participants.find(p => p.identity === broadcasterId) || null;
        }

        if (p) {
          const isLocal = localParticipant && p.identity === localParticipant.identity;
          const isBroadcaster = p.identity === broadcasterId;

          return (
            <VideoTile
              key={p.identity}
              participant={p}
              isBroadcaster={isBroadcaster}
              isLocal={isLocal}
              onLeave={isLocal ? onLeaveSession : undefined}
              price={joinPrice}
              style={{
                ...style,
                position: 'absolute',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              } as React.CSSProperties}
            />
          );
        } else if (seat) {
          // Seat assigned but participant not connected
          return (
            <div
              key={`waiting-${i}`}
              className="absolute bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center backdrop-blur-sm"
              style={{
                ...style,
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              } as React.CSSProperties}
            >
              <div className="text-white/20 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                     <span className="text-lg">⏳</span>
                  </div>
                  Waiting for {seat.username}
                </div>
            </div>
          );
        } else {
          // Empty Slot Placeholder
          const isCurrentUserSlot = localParticipant && !participants.find(p => p.identity === localParticipant.identity);
          const canJoin = onJoinRequest && !isCurrentUserSlot && i > 0; // Don't allow joining broadcaster slot

          return (
            <div
              key={`empty-${i}`}
              className={`absolute bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center backdrop-blur-sm ${canJoin ? 'cursor-pointer hover:bg-zinc-800/50 hover:border-white/10 transition-colors' : ''}`}
              style={{
                ...style,
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              } as React.CSSProperties}
              onClick={canJoin ? () => onJoinRequest?.(i) : undefined}
            >
              <div className="text-white/20 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                     <span className="text-lg">+</span>
                  </div>
                  {i === 0 ? 'Broadcaster' : `Seat ${i + 1}`}
                </div>
            </div>
          );
        }
      })}
    </div>
  );
}
