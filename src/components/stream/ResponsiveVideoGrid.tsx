import React from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import { MoreHorizontal } from 'lucide-react';
import VideoTile from '../broadcast/VideoTile';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  seats?: any[];
  onLeaveSession?: () => void;
  joinPrice?: number;
  onJoinRequest?: (seatIndex: number) => void;
  onDisableGuestMedia?: (participantId: string) => void;
  coinBalances?: Record<string, number>;
  onSeatAction?: (params: { seatIndex: number; seat: any; participant?: Participant }) => void;
}

export default function ResponsiveVideoGrid({
  participants,
  localParticipant,
  broadcasterId,
  seats,
  onLeaveSession,
  joinPrice = 0,
  onJoinRequest,
  onDisableGuestMedia,
  coinBalances,
  onSeatAction
}: ResponsiveVideoGridProps) {
  const TOTAL_SLOTS = 6;

  return (
    <div className="seats-grid w-full h-full bg-black/50">
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
        const seat = seats && seats[i];
        let p = seat ? participants.find(p => p.identity === seat.user_id) : null;

        // Special case: Broadcaster slot (i=0) always shows broadcaster if they exist
        if (i === 0 && !p) {
          p = participants.find(p => p.identity === broadcasterId) || null;
        }
        
        // Debug: Log participant assignment for troubleshooting
        if (seat && !p) {
          console.log(`Seat ${i} assigned to ${seat.user_id} but participant not found in list`, {
            seatUserId: seat.user_id,
            availableParticipants: participants.map(p => p.identity)
          });
        }
        
        // Additional fallback: If seat is assigned but participant not found, check if any participant matches the seat
        if (seat && !p && seat.user_id) {
          // Check if the seat user is actually in the participants list with different identity format
          p = participants.find(participant =>
            participant.identity === seat.user_id ||
            participant.name === seat.user_id ||
            participant.identity === String(seat.user_id)
          );
          
          if (p) {
            console.log(`Found participant for seat ${i} using extended matching`, {
              seatUserId: seat.user_id,
              matchedParticipant: p.identity
            });
          }
        }

        if (p) {
          const isLocal = localParticipant && p.identity === localParticipant.identity;
          const isBroadcaster = p.identity === broadcasterId;

          return (
            <div key={p.identity} className="seat relative">
              <VideoTile
                participant={p}
                isBroadcaster={isBroadcaster}
                isLocal={isLocal}
                isHost={isBroadcaster} // Broadcaster is the host
                onLeave={isLocal && !isBroadcaster ? onLeaveSession : undefined}
                onDisableGuestMedia={onDisableGuestMedia}
                price={joinPrice}
                coinBalance={p.identity ? coinBalances?.[p.identity] : undefined}
                compact
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
              {onSeatAction && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeatAction({ seatIndex: i, seat, participant: p });
                  }}
                  className="absolute top-2 right-2 z-20 rounded-full bg-black/60 hover:bg-black/80 text-white p-1 shadow-lg border border-white/20 transition"
                  aria-label="Seat options"
                >
                  <MoreHorizontal size={16} />
                </button>
              )}
            </div>
          );
        } else if (seat) {
          // Seat assigned but participant not connected
          return (
            <div
              key={`waiting-${i}`}
              className="seat bg-zinc-900/50 border border-white/5 flex items-center justify-center"
            >
              <div className="text-white/20 uppercase tracking-widest text-[10px] flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                     <span className="text-base">⏳</span>
                  </div>
                  <span className="truncate max-w-[90%]">Waiting for {seat.username}</span>
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
              className={`seat bg-zinc-900/50 border border-white/5 flex items-center justify-center ${canJoin ? 'cursor-pointer hover:bg-zinc-800/50 hover:border-white/10 transition-colors' : ''}`}
              onClick={
                canJoin
                  ? (event) => {
                      event.stopPropagation();
                      onJoinRequest?.(i);
                    }
                  : undefined
              }
            >
              <div className="text-white/20 uppercase tracking-widest text-[10px] flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                     <span className="text-base">+</span>
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
