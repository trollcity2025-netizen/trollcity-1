import React, { useMemo } from 'react';
import { UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeatSession } from '../../hooks/useStreamSeats';

interface ParticipantStripProps {
  seats: Record<number, SeatSession>;
  onJoinRequest?: (index: number) => void;
  className?: string;
  compact?: boolean;
  orientation?: 'portrait' | 'landscape';
}

export default function ParticipantStrip({
  seats,
  onJoinRequest,
  className,
  compact = false,
  orientation: _orientation = 'portrait',
}: ParticipantStripProps) {
  // Get active seats only
  const activeSeats = useMemo(() => {
    const seatArray = Object.entries(seats)
      .filter(([_, seat]) => seat?.status === 'active')
      .sort(([a], [b]) => Number(a) - Number(b));
    return seatArray;
  }, [seats]);

  // Show max 4 in compact mode, 6 otherwise
  const maxVisible = compact ? 4 : 6;
  const visibleSeats = activeSeats.slice(0, maxVisible);
  const hasMore = activeSeats.length > maxVisible;

  if (activeSeats.length === 0) {
    return (
      <div className={cn("flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide", className)}>
        {/* Show placeholder for potential guests */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1">
            <button 
              onClick={() => onJoinRequest?.(i)}
              className={cn(
                "rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors border border-dashed border-white/20",
                compact ? "w-10 h-10" : "w-12 h-12"
              )}
            >
              <UserPlus size={compact ? 16 : 18} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide items-center", className)}>
      {visibleSeats.map(([index, seat]) => {
        const profile = seat.user_profile;
        return (
          <div key={index} className="flex-shrink-0 flex flex-col items-center gap-1">
            <div 
              className={cn(
                "rounded-full overflow-hidden border-2 flex items-center justify-center relative",
                compact ? "w-10 h-10" : "w-12 h-12"
              )}
              style={{ borderColor: profile?.glowing_username_color || 'rgba(255,255,255,0.2)' }}
            >
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.username || 'Guest'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                  {(profile?.username || 'Guest').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <span className={cn(
              "text-white/80 truncate max-w-[48px] text-center",
              compact ? "text-[9px]" : "text-[10px]"
            )}>
              {profile?.username || 'Guest'}
            </span>
          </div>
        );
      })}

      {/* Empty slots for future guests */}
      {activeSeats.length < 3 && Array.from({ length: 3 - activeSeats.length }).map((_, i) => (
        <div key={`empty-${i}`} className="flex-shrink-0 flex flex-col items-center gap-1">
          <button 
            onClick={() => onJoinRequest?.(activeSeats.length + i + 1)}
            className={cn(
              "rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors border border-dashed border-white/20",
              compact ? "w-10 h-10" : "w-12 h-12"
            )}
          >
            <UserPlus size={compact ? 16 : 18} />
          </button>
        </div>
      ))}

      {/* "More" indicator */}
      {hasMore && (
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className={cn(
            "rounded-full bg-black/60 flex items-center justify-center text-white/60",
            compact ? "w-10 h-10 text-xs" : "w-12 h-12 text-sm"
          )}>
            +{activeSeats.length - maxVisible}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact horizontal strip for landscape mode
export function CompactParticipantStrip({
  seats,
  onJoinRequest,
}: {
  seats: Record<number, SeatSession>;
  onJoinRequest?: (index: number) => void;
}) {
  const activeSeats = useMemo(() => {
    return Object.entries(seats)
      .filter(([_, seat]) => seat?.status === 'active')
      .slice(0, 4);
  }, [seats]);

  return (
    <div className="flex gap-2 overflow-x-auto px-2">
      {activeSeats.map(([index, seat]) => {
        const profile = seat.user_profile;
        return (
          <div 
            key={index}
            className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/20"
          >
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile?.username || 'Guest'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold">
                {(profile?.username || 'G').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
      
      {/* Add button */}
      {activeSeats.length < 4 && (
        <button 
          onClick={() => onJoinRequest?.(activeSeats.length + 1)}
          className="flex-shrink-0 w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center text-white/30 hover:text-white"
        >
          <UserPlus size={14} />
        </button>
      )}
    </div>
  );
}
