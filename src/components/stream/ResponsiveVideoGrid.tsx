import React from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import VideoTile from '../broadcast/VideoTile';
import { Camera, Monitor } from 'lucide-react';

interface ResponsiveVideoGridProps {
  participants: Participant[];
  localParticipant?: LocalParticipant;
  broadcasterId?: string;
  seats?: any[];
  isHost?: boolean;
  hostSeatIndex?: number;
  onLeaveSession?: () => void;
  joinPrice?: number;
  onJoinRequest?: (seatIndex: number) => void;
  onDisableGuestMedia?: (participantId: string, disableVideo: boolean, disableAudio: boolean) => void;
  coinBalances?: Record<string, number>;
  onHostSeatChange?: (seatIndex: number) => void;
  onSeatAction?: (params: { seatIndex: number; seat: any; participant?: Participant }) => void;
  boxCount?: number;
  onUserClick?: (participant: Participant) => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  isCameraOn?: boolean;
  isScreenShareOn?: boolean;
}

export default function ResponsiveVideoGrid({
  participants,
  localParticipant,
  broadcasterId,
  seats,
  isHost,
  hostSeatIndex: _hostSeatIndex,
  onLeaveSession,
  joinPrice = 0,
  onJoinRequest,
  onDisableGuestMedia,
  coinBalances,
  onHostSeatChange: _onHostSeatChange,
  onSeatAction: _onSeatAction,
  boxCount = 0,
  onUserClick,
  onToggleCamera,
  onToggleScreenShare,
  isCameraOn,
  isScreenShareOn
}: ResponsiveVideoGridProps) {
  const broadcaster =
    (broadcasterId && participants.find((p) => p.identity === broadcasterId)) ||
    participants[0] ||
    null;

  if (!broadcaster) {
    return null;
  }

  const isLocalBroadcaster = localParticipant && broadcaster.identity === localParticipant.identity;

  const maxGuestSeats = 6;
  const guestSeatCount = Math.max(0, Math.min(maxGuestSeats, boxCount || 0));
  const guestAssignments = Array.from({ length: guestSeatCount }, (_, index) => {
    // Seats are 0-indexed in the UI request (#1-#6)
    const seatIndex = index; 
    const seat = Array.isArray(seats) && seats.length > seatIndex ? seats[seatIndex] : null;
    let participant: Participant | undefined;

    if (seat && (seat as any).user_id) {
      participant = participants.find((p) => p.identity === (seat as any).user_id);
    }

    if (!participant) {
       // Simple mapping for guests not in seats (fallback)
       const guests = participants.filter(p => p.identity !== broadcaster.identity);
       // Avoid duplicates if possible, but for now simple index
       if (index < guests.length) {
         // Check if this guest is already assigned to a seat? 
         // For now, assume seats are the source of truth.
       }
    }

    return {
      key: `seat-${index}`,
      seatIndex: index,
      participant: participant || null,
      seat
    };
  });

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6">
      {/* Main Broadcaster Area */}
      <div className="w-full flex-1 min-h-0 relative rounded-3xl overflow-hidden border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-black/40 group">
        <VideoTile
          participant={broadcaster}
          isBroadcaster
          isLocal={!!isLocalBroadcaster}
          isHost={isHost}
          onLeave={isLocalBroadcaster && !isHost ? onLeaveSession : undefined}
          onDisableGuestMedia={onDisableGuestMedia}
          price={joinPrice}
          coinBalance={broadcaster.identity ? coinBalances?.[broadcaster.identity] : undefined}
          compact={false}
          className="w-full h-full object-cover"
          style={{ width: '100%', height: '100%' }}
          onClick={() => onUserClick?.(broadcaster)}
        />
        
        {/* Broadcaster Controls Overlay (Start Camera / Screen Share) */}
        {isLocalBroadcaster && !isCameraOn && !isScreenShareOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="flex gap-6">
              <button 
                onClick={onToggleCamera}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 hover:border-purple-400 hover:scale-105 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.5)] group-hover:shadow-[0_0_30px_rgba(147,51,234,0.7)]">
                  <Camera size={32} className="text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-wide">Start Camera</span>
              </button>
              
              <button 
                onClick={onToggleScreenShare}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 hover:border-blue-400 hover:scale-105 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.5)] group-hover:shadow-[0_0_30px_rgba(37,99,235,0.7)]">
                  <Monitor size={32} className="text-white" />
                </div>
                <span className="text-lg font-bold text-white tracking-wide">Start Screen Share</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {guestSeatCount > 0 && (
        <div className="h-[180px] sm:h-[200px] lg:h-[240px] shrink-0 grid grid-cols-3 grid-rows-2 gap-4">
          {guestAssignments.map(({ key, seatIndex, participant }) => (
            <div 
              key={key} 
              className="relative rounded-xl overflow-hidden bg-[#1a0b2e]/50 border border-purple-500/20 shadow-inner group transition-all hover:border-purple-500/40 hover:bg-[#1a0b2e]/70"
            >
              {participant ? (
                <VideoTile
                  participant={participant}
                  isLocal={!!(localParticipant && participant.identity === localParticipant.identity)}
                  isHost={isHost}
                  onDisableGuestMedia={onDisableGuestMedia}
                  price={joinPrice}
                  coinBalance={participant.identity ? coinBalances?.[participant.identity] : undefined}
                  compact
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                  onClick={() => onUserClick?.(participant)}
                />
              ) : (
                <div 
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => onJoinRequest?.(seatIndex)}
                >
                  <div className="text-2xl font-bold text-purple-300/30 mb-1 group-hover:text-purple-300/50 transition-colors">
                    #{seatIndex + 1}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)] group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
