import React from 'react';
import JudgeSeat from './JudgeSeat';

interface Judge {
  id: string;
  seatNumber: number;
  user?: any;
}

interface JudgeRowProps {
  seats: Judge[];
  currentUserId?: string;
  localVideoTrack?: any;
  localAudioTrack?: any;
  canPublish?: boolean;
  agoraClient?: any;
  onJoinSeat?: (seatNumber: number) => void;
  onLeaveSeat?: (seatNumber: number) => void;
}

/**
 * JudgeRow - Row of judge seats with:
 * - Large cinematic judge chairs
 * - Perspective depth (slightly angled or shadowed)
 * - Current user seat labeled "You (Judge)"
 */
export const JudgeRow: React.FC<JudgeRowProps> = ({
  seats,
  currentUserId,
  localVideoTrack,
  localAudioTrack,
  canPublish = false,
  agoraClient,
  onJoinSeat,
  onLeaveSeat,
}) => {
  return (
    <div className="relative">
      {/* Row label */}
      <div className="flex items-center justify-center mb-4">
        <div className="px-4 py-1 bg-slate-900/80 rounded-full border border-yellow-500/30">
          <span className="text-yellow-400 text-xs font-medium tracking-wider uppercase">Judges Panel</span>
        </div>
      </div>
      
      {/* Judge seats row */}
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 justify-center">
        {seats.map((seat) => (
          <JudgeSeat
            key={seat.id || seat.seatNumber}
            seatNumber={seat.seatNumber}
            user={seat.user}
            isCurrentUser={seat.user?.id === currentUserId}
            localVideoTrack={seat.user?.id === currentUserId ? localVideoTrack : undefined}
            localAudioTrack={seat.user?.id === currentUserId ? localAudioTrack : undefined}
            canPublish={seat.user?.id === currentUserId && canPublish}
            agoraClient={agoraClient}
            onJoin={() => onJoinSeat?.(seat.seatNumber)}
            onLeave={() => onLeaveSeat?.(seat.seatNumber)}
          />
        ))}
        
        {/* Empty seats for visual fill */}
        {seats.length < 4 && Array.from({ length: 4 - seats.length }).map((_, index) => (
          <div 
            key={`empty-${index}`}
            className="w-48 h-40 rounded-xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-center"
          >
            <span className="text-slate-600 text-xs">Seat {seats.length + index + 1}</span>
          </div>
        ))}
      </div>
      
      {/* Stage floor reflection */}
      <div className="absolute -bottom-8 left-0 right-0 h-8 bg-gradient-to-t from-yellow-500/5 to-transparent blur-lg" />
    </div>
  );
};

export default JudgeRow;
