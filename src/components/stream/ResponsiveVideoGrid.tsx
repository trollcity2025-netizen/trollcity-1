import React from 'react';
import { Participant, LocalParticipant } from 'livekit-client';
import VideoTile from '../broadcast/VideoTile';
import { Camera } from 'lucide-react';

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
  isCameraOn?: boolean;
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
  isCameraOn
}: ResponsiveVideoGridProps) {
  const broadcaster =
    (broadcasterId && participants.find((p) => p.identity === broadcasterId)) ||
    participants[0] ||
    null;

  const [frameMode, setFrameMode] = React.useState<'none' | 'neon' | 'rgb'>(() => {
    if (typeof window === 'undefined') return 'neon';
    const stored = window.localStorage.getItem('troll_frame_mode');
    if (stored === 'none' || stored === 'neon' || stored === 'rgb') return stored;
    return 'neon';
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('troll_frame_mode', frameMode);
  }, [frameMode]);

  const isLocalBroadcaster =
    !!(localParticipant && broadcaster && broadcaster.identity === localParticipant.identity);

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
       const guests = broadcaster
        ? participants.filter((p) => p.identity !== broadcaster.identity)
        : participants;
       if (index < guests.length) {
       }
    }

    return {
      key: `seat-${index}`,
      seatIndex: index,
      participant: participant || null,
      seat
    };
  });

  const hasGuests = guestSeatCount > 0;
  const canControlFrames = !!isLocalBroadcaster || !!isHost;

  if (!broadcaster) {
    return null;
  }

  const hostFrameClass =
    frameMode === 'neon'
      ? 'border-2 border-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.7)] animate-neon-pulse'
      : frameMode === 'rgb'
        ? 'border-2 border-transparent rgb-frame'
        : 'border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]';

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6">
      {canControlFrames && (
        <div className="flex items-center justify-end gap-2 mb-1 text-[11px] sm:text-xs">
          <span className="text-gray-400">Frames</span>
          <button
            type="button"
            onClick={() => setFrameMode('none')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'none'
                ? 'bg-zinc-800 border-zinc-500 text-white'
                : 'bg-transparent border-zinc-700 text-gray-400'
            }`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => setFrameMode('neon')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'neon'
                ? 'bg-purple-700 border-purple-400 text-white shadow-[0_0_16px_rgba(168,85,247,0.8)]'
                : 'bg-transparent border-purple-700 text-purple-300'
            }`}
          >
            Neon
          </button>
          <button
            type="button"
            onClick={() => setFrameMode('rgb')}
            className={`px-2 py-1 rounded-full border text-xs ${
              frameMode === 'rgb'
                ? 'bg-pink-700 border-pink-400 text-white shadow-[0_0_16px_rgba(244,114,182,0.8)]'
                : 'bg-transparent border-pink-700 text-pink-300'
            }`}
          >
            RGB
          </button>
        </div>
      )}
      <div className={`w-full flex-none min-h-0 ${
        hasGuests
          ? 'h-[clamp(180px,32vh,230px)] lg:h-[clamp(190px,38vh,340px)]'
          : 'h-[clamp(240px,46vh,360px)] lg:h-[clamp(260px,52vh,520px)]'
      } relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/40 group ${hostFrameClass}`}>
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
        
        {/* Broadcaster Controls Overlay (Start Camera) */}
        {isLocalBroadcaster && !isCameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
              <button 
                onClick={onToggleCamera}
                className="group flex flex-col items-center gap-3 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 hover:border-purple-400 hover:scale-105 transition-all duration-300"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.5)] group-hover:shadow-[0_0_30px_rgba(147,51,234,0.7)]">
                  <Camera size={24} className="sm:w-8 sm:h-8 text-white" />
                </div>
                <span className="text-base sm:text-lg font-bold text-white tracking-wide">Start Camera</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {guestSeatCount > 0 && (
        <div className="shrink-0 h-[clamp(170px,36vh,260px)] sm:h-[clamp(80px,16vw,130px)] lg:h-[210px]">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 lg:gap-4 h-full">
            {guestAssignments.slice(0, 6).map(({ key, seatIndex, participant }) => (
              <div 
                key={key}
                className={`h-full aspect-square sm:aspect-square lg:aspect-auto relative rounded-lg sm:rounded-xl overflow-hidden bg-[#1a0b2e]/50 shadow-inner group transition-all hover:bg-[#1a0b2e]/70 ${
                  frameMode === 'neon'
                    ? 'border border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.6)] animate-neon-pulse'
                    : frameMode === 'rgb'
                      ? 'border border-transparent rgb-frame-small'
                      : 'border border-purple-500/20 hover:border-purple-500/40'
                }`}
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
                    <div className="text-xl sm:text-2xl font-bold text-purple-300/30 mb-1 group-hover:text-purple-300/50 transition-colors">
                      #{seatIndex + 1}
                    </div>
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)] group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
