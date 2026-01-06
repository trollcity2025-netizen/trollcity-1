import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import { useBroadcastLayout } from '../../hooks/useBroadcastLayout';
import VideoTile from '../broadcast/VideoTile';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  onLeaveSession?: () => void;
}

export default function ResponsiveVideoGrid({ 
  participants, 
  localParticipant,
  broadcasterId,
  onLeaveSession
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

  // Sort participants: Broadcaster first, then others
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.identity === broadcasterId) return -1;
      if (b.identity === broadcasterId) return 1;
      return 0;
    });
  }, [participants, broadcasterId]);

  const { layoutMode, tileStyles } = useBroadcastLayout(
    sortedParticipants,
    dimensions.width,
    dimensions.height,
    isLandscape
  );

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full overflow-hidden bg-black/50"
    >
      {sortedParticipants.map((p, i) => {
        const style = tileStyles[i];
        if (!style) return null;

        const isLocal = localParticipant && p.identity === localParticipant.identity;
        const isBroadcaster = p.identity === broadcasterId;

        return (
          <VideoTile
            key={p.identity}
            participant={p}
            isBroadcaster={isBroadcaster}
            isLocal={isLocal}
            onLeave={isLocal ? onLeaveSession : undefined}
            style={{
              ...style,
              position: 'absolute',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
