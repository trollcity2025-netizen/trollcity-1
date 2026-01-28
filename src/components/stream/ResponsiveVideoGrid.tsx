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

  const [frameMode, setFrameMode] = React.useState<'none' | 'rgb'>(() => {
    if (typeof window === 'undefined') return 'none';
    const stored = window.localStorage.getItem('troll_frame_mode');
    if (stored === 'none' || stored === 'rgb') return stored;
    return 'none';
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('troll_frame_mode', frameMode);
  }, [frameMode]);

  const isLocalBroadcaster =
    !!(localParticipant && broadcaster && broadcaster.identity === localParticipant.identity);

  // Fixed 8 guest slots max for 3x3 grid
  const maxGuestSeats = 8;
  const activeGuestCount = Math.max(0, Math.min(maxGuestSeats, boxCount || 0));
  
  // Create fixed guest slots
  const guestSlots = Array.from({ length: maxGuestSeats }, (_, index) => {
    const seatIndex = index;
    const isActive = index < activeGuestCount;
    const seat = Array.isArray(seats) && seats.length > seatIndex ? seats[seatIndex] : null;
    let participant: Participant | undefined;

    if (isActive && seat && (seat as any).user_id) {
      participant = participants.find((p) => p.identity === (seat as any).user_id);
    }

    // Removed fallback logic that auto-filled slots with random participants.
    // Slots should only be filled if there is an explicit seat assignment.

    return {
      key: `slot-${index}`,
      seatIndex: index,
      position: ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'][index],
      participant: participant || null,
      seat,
      isActive
    };
  });

  const canControlFrames = !!isLocalBroadcaster || !!isHost;

  if (!broadcaster) {
    return null;
  }

  const hostFrameClass =
    frameMode === 'rgb'
      ? 'border-2 border-transparent rgb-frame'
      : 'border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]';

  const guestFrameClass = (position: string) => {
    const baseClass =
      frameMode === 'rgb'
        ? 'border border-transparent rgb-frame-small'
        : 'border border-purple-500/20 hover:border-purple-500/40';

    // Keep positional class for testing/debugging and potential layout tweaks
    const safePosition = position?.toString().replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'slot';
    return `${baseClass} guest-${safePosition}`.trim();
  };

  return (
    <div className="w-full h-auto min-h-0 flex flex-col gap-3 p-2 md:p-4">
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
      
      {/* Fixed Grid Layout: 3x3 Grid with Dynamic Broadcaster Size */}
      <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full mx-auto">
        
        {/* Broadcaster Tile */}
        <div className={`relative transition-all duration-500 ease-in-out ${
          activeGuestCount === 0
            ? 'col-span-3 row-span-3'
            : activeGuestCount <= 5 
              ? 'col-span-2 row-span-2' 
              : 'col-span-1 row-span-1'
        }`}>
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
            frameMode={frameMode}
          />
          
          {/* Broadcaster Controls Overlay (Start Camera) */}
          {isLocalBroadcaster && !isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 rounded-2xl">
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

        {/* Guest Slots */}
        {guestSlots.map((slot, index) => {
           // Calculate grid position for Large Broadcaster mode
           // Slots 0-1 go to Right Column (Row 1-2)
           // Slots 2-4 go to Bottom Row (Col 1-3)
           // If Small Broadcaster mode, they just flow (starting from index 1?)
           
           // Actually, we can just let CSS Grid auto-placement handle it if we are careful?
           // No, because Broadcaster takes 2x2.
           
           // If Large Broadcaster (activeGuestCount <= 5):
           // Index 0 -> Col 3, Row 1
           // Index 1 -> Col 3, Row 2
           // Index 2 -> Col 1, Row 3
           // Index 3 -> Col 2, Row 3
           // Index 4 -> Col 3, Row 3
           
           let gridClass = '';
           if (index === 0) gridClass = 'col-start-3 row-start-1';
           else if (index === 1) gridClass = 'col-start-3 row-start-2';
           else if (index === 2) gridClass = 'col-start-1 row-start-3';
           else if (index === 3) gridClass = 'col-start-2 row-start-3';
           else if (index === 4) gridClass = 'col-start-3 row-start-3';
           
           // Only render slots up to limit (5)
           if (activeGuestCount === 0) return null;
           if (index >= 5) return null;
 
           return (
            <div 
              key={slot.key}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${gridClass}`}
              onClick={() => !slot.participant && slot.isActive && onJoinRequest?.(slot.seatIndex)}
            >
              {slot.participant && slot.isActive ? (
                <VideoTile
                  participant={slot.participant}
                  isLocal={!!(localParticipant && slot.participant.identity === localParticipant.identity)}
                  isHost={isHost}
                  onDisableGuestMedia={onDisableGuestMedia}
                  price={joinPrice}
                  coinBalance={slot.participant.identity ? coinBalances?.[slot.participant.identity] : undefined}
                  compact
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                  onClick={
                    !isHost &&
                    !(localParticipant && slot.participant.identity === localParticipant.identity) &&
                    onUserClick
                      ? () => onUserClick(slot.participant!)
                      : undefined
                  }
                  frameMode={frameMode}
                />
              ) : slot.isActive ? (
                <div className={`w-full h-full flex items-center justify-center cursor-pointer transition-colors border-2 border-dashed ${'border-white/10 hover:border-white/30 bg-white/5'}`}>
                  <div className={`text-4xl font-bold transition-colors ${'text-white/20 group-hover:text-white/40'}`}>
                    +
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/40 rounded-2xl border border-white/5">
                   {/* Empty inactive slot */}
                </div>
              )}
            </div>
           );
        })}
      </div>

    </div>
  );
}
