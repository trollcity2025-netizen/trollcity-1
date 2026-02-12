import { useMemo, useState, type CSSProperties } from 'react';
import { useParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, MicOff, VideoOff, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';

import BroadcasterStatsModal from './BroadcasterStatsModal';
import { SeatSession } from '../../hooks/useStreamSeats';
import { getGlowingTextStyle } from '../../lib/perkEffects';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { toast } from 'sonner';

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  maxItems?: number;
  onGift: (userId: string) => void;
  onGiftAll: (ids: string[]) => void;
  mode?: 'viewer' | 'stage';
  seats?: Record<number, SeatSession>;
  onJoinSeat?: (index: number) => void;
  onKick?: (userId: string) => void;
  broadcasterProfile?: any;
  hideEmptySeats?: boolean;
  seatPriceOverride?: number;
}

export default function BroadcastGrid({
  stream,
  isHost,
  isModerator,
  maxItems,
  onGift,
  onGiftAll: _onGiftAll,
  mode: _mode = 'stage', // Default to stage (legacy behavior)
  seats = {},
  onJoinSeat,
  onKick,
  broadcasterProfile,
  hideEmptySeats = false,
  seatPriceOverride,
}: BroadcastGridProps) {
  const allParticipants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTracks = useTracks([Track.Source.Microphone]); // Monitor audio tracks for mute state
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const [showHostStats, setShowHostStats] = useState(false);

  // Deduplicate user IDs (prevents redundant attribute lookups)
  const userIds = useMemo(() => {
    const set = new Set<string>();
    if (stream.user_id) set.add(stream.user_id); // Always include host
    Object.values(seats).forEach((seat) => {
      if (seat?.user_id) set.add(seat.user_id);
    });
    return Array.from(set);
  }, [stream.user_id, seats]);

  const attributes = useParticipantAttributes(userIds, stream.id);

  // Calculate how many boxes we must render (never hide occupied seats)
  const seatKeys = Object.keys(seats);
  const maxOccupiedSeatIndex = seatKeys.length ? Math.max(...seatKeys.map(Number)) : -1;
  const requiredBoxes = Math.max(1, maxOccupiedSeatIndex + 1); // 0-indexed

  const streamBoxCount = Math.max(1, Number(stream.box_count || 1));
  const baseCount = Math.max(streamBoxCount, requiredBoxes);

  const HARD_CAP = 6;

  // Only apply maxItems if it won't hide requiredBoxes
  const maxCap = typeof maxItems === 'number' ? Math.min(maxItems, HARD_CAP) : HARD_CAP;
  
  let effectiveBoxCount: number;
  let boxes: number[];

  if (hideEmptySeats) {
    // In hideEmptySeats mode, we only render active participants
    // Slot 0 (Host) is always included
    const activeIndices = [0];
    
    // Add occupied seat indices
    seatKeys.forEach((key) => {
      const index = Number(key);
      if (seats[index]?.user_id) {
        activeIndices.push(index);
      }
    });
    
    // Sort indices to maintain order
    activeIndices.sort((a, b) => a - b);
    
    // Apply HARD_CAP just in case, though ideally we show all active
    const visibleIndices = activeIndices.slice(0, HARD_CAP);
    
    effectiveBoxCount = visibleIndices.length;
    boxes = visibleIndices;
  } else {
    effectiveBoxCount =
      typeof maxItems === 'number' && maxCap < requiredBoxes
        ? Math.min(baseCount, HARD_CAP) // ignore maxItems if it would hide an occupied seat
        : Math.min(baseCount, maxCap);
    boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
  }

  return (
    <div
      className={cn(
        'grid gap-2 w-full h-full p-2',
        effectiveBoxCount === 1 && 'grid-cols-1 grid-rows-1',
        effectiveBoxCount === 2 && 'grid-cols-1 md:grid-cols-2 grid-rows-1',
        effectiveBoxCount === 3 && 'grid-cols-2 grid-rows-2',
        effectiveBoxCount === 4 && 'grid-cols-2 grid-rows-2',
        effectiveBoxCount >= 5 && 'grid-cols-2 grid-rows-3',
        effectiveBoxCount === 6 && 'grid-cols-3 grid-rows-2'
      )}
    >
      {boxes.map((seatIndex) => {
        const seat = seats[seatIndex];
        let userId = seat?.user_id;

        // FORCE HOST INTO BOX 0
        if (seatIndex === 0) {
          userId = stream.user_id;
        }

        const isStreamHost = userId === stream.user_id;

        // Find participant + tracks
        const participant = allParticipants.find((p) => p.identity === userId);
        const track = cameraTracks.find((t) => t.participant.identity === userId);
        const audioTrack = audioTracks.find((t) => t.participant.identity === userId);

        const isMicOn = audioTrack ? !audioTrack.publication.isMuted : false;
        const isCamOn = track ? !track.publication.isMuted : false;

        // Determine profile used for visuals
        let displayProfile = seat?.user_profile;
        if (seatIndex === 0 && isStreamHost) {
          displayProfile = broadcasterProfile;
        }

        // Use real-time attributes if available
        const userAttrs = userId ? attributes[userId] : null;

        let boxClass = 'relative bg-black/50 rounded-xl overflow-hidden border border-white/10 transition-all duration-300';

        const hasGold =
          !!displayProfile?.is_gold || userAttrs?.activePerks?.includes('perk_gold_username' as any);

        const hasRgbProfile =
          (!!displayProfile?.rgb_username_expires_at &&
            new Date(displayProfile.rgb_username_expires_at) > new Date()) ||
          userAttrs?.activePerks?.includes('perk_rgb_username' as any);

        const hasStreamRgb = !!stream.has_rgb_effect && !(participant?.metadata && JSON.parse(participant.metadata).rgb_disabled);

        if (hasGold) {
          boxClass =
            'relative bg-black/50 rounded-xl overflow-hidden border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all duration-300';
        } else if (hasRgbProfile || hasStreamRgb) {
          boxClass = 'relative bg-black/50 rounded-xl overflow-hidden rgb-box transition-all duration-300';
        }

        return (
          <div
            key={seatIndex}
            className={boxClass}
            onClick={() => {
              if (isStreamHost && seatIndex === 0) {
                 setShowHostStats(true);
              } else if (userId) {
                 setSelectedUserForAction(userId);
              }
            }}
            role={userId ? 'button' : undefined}
            tabIndex={userId ? 0 : -1}
            onKeyDown={(e) => {
              if (!userId) return;
              if (e.key === 'Enter' || e.key === ' ') {
                 if (isStreamHost && seatIndex === 0) setShowHostStats(true);
                 else setSelectedUserForAction(userId);
              }
            }}
          >
            {/* Render Video if Participant Exists and Track is active */}
            {track && isCamOn && (
              <VideoTrack
                trackRef={track}
                className={cn('w-full h-full object-cover', track.participant.isLocal && 'scale-x-[-1]')}
              />
            )}

            {/* Video Off / Audio Only State */}
            {userId && participant && (!track || !isCamOn) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90">
                <div className="relative">
                  <img
                    src={
                      displayProfile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        displayProfile?.username || 'User'
                      )}&background=random`
                    }
                    alt={displayProfile?.username}
                    className="w-16 h-16 rounded-full border-2 border-white/20"
                  />
                  {!isMicOn && (
                    <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                      <MicOff size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <span className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
                  <VideoOff size={10} />
                  Camera Off
                </span>
              </div>
            )}

            {/* Fallback / Loading - Only if participant NOT found yet */}
            {userId && !participant && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-zinc-800 w-full h-full" />
                <span className="absolute text-xs text-white/50">
                  {isStreamHost ? 'Host Connecting...' : 'Connecting...'}
                </span>
              </div>
            )}

            {/* Empty Seat */}
            {!userId && (
              <div className="absolute inset-0 flex items-center justify-center">
                {onJoinSeat ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Allow host to click to trigger onJoinSeat (which might open invite menu or similar)
                      // if (isHost && seatIndex !== 0) {
                      //     toast.info("Seat is open for guests to join!");
                      //     return;
                      // }
                      onJoinSeat(seatIndex);
                    }}
                    className="flex flex-col items-center text-zinc-500 hover:text-white transition-colors"
                  >
                    <div className="p-3 rounded-full border border-dashed border-zinc-600 hover:border-white mb-2">
                      <Plus size={24} />
                    </div>
                    <span className="text-xs font-medium">Join Stage</span>
                    {(typeof seatPriceOverride === 'number' ? seatPriceOverride : stream.seat_price) > 0 && (
                      <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full mt-2 border border-yellow-500/30">
                        <Coins size={12} className="text-yellow-500" />
                        <span className="text-xs font-bold text-yellow-400">
                          {typeof seatPriceOverride === 'number' ? seatPriceOverride : stream.seat_price}
                        </span>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="text-zinc-600 flex flex-col items-center">
                    <User size={24} className="opacity-20" />
                    <span className="text-xs mt-2">Empty</span>
                  </div>
                )}
              </div>
            )}

            {/* Metadata Overlay (Bubble Style) - Moved to Top Left to avoid controls */}
            {userId && (
              <div className="absolute top-3 left-3 flex items-center gap-2 max-w-[85%] z-10 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                  <div className="flex flex-col min-w-0">
                    <div className="text-white text-sm font-bold truncate flex items-center gap-2">
                        {(() => {
                        const profile =
                            isStreamHost && broadcasterProfile ? broadcasterProfile : seat?.user_profile;

                        const name = isStreamHost
                            ? broadcasterProfile?.username || 'Host'
                            : participant?.name || profile?.username || 'User';

                        let className = 'text-white';
                        let style: CSSProperties | undefined = undefined;

                        if (profile) {
                            if (profile.is_gold) {
                            className = 'gold-username';
                            } else if (
                            profile.rgb_username_expires_at &&
                            new Date(profile.rgb_username_expires_at) > new Date()
                            ) {
                            className = 'rgb-username';
                            } else if (profile.glowing_username_color) {
                            style = getGlowingTextStyle(profile.glowing_username_color);
                            className = 'font-bold';
                            } else if (userAttrs?.activePerks?.includes('perk_global_highlight' as any)) {
                            className = 'glowing-username';
                            } else if (['admin', 'moderator', 'secretary'].includes(profile.role || '')) {
                            className = 'silver-username';
                            }
                        }

                        return (
                            <span className={className} style={style}>
                            {name}
                            </span>
                        );
                        })()}
                        
                        {isStreamHost && (
                            <span className="text-[9px] bg-red-600 px-1 rounded text-white font-bold uppercase tracking-wider">
                            HOST
                            </span>
                        )}
                    </div>
                  </div>
                  
                  {/* Coins in Bubble - REMOVED as per request (duplicate of header) */}
                  {/* <div className="flex items-center gap-1 text-yellow-500 text-xs border-l border-white/10 pl-2 ml-1">
                    <Coins size={10} />
                    <span>{(displayProfile?.troll_coins || 0).toLocaleString()}</span>
                  </div> */}
                </div>

                {/* Mic Status Indicator (Outside Bubble) */}
                {!isMicOn && (
                  <div
                    className="bg-red-500/90 p-1.5 rounded-full backdrop-blur-md shadow-sm animate-in zoom-in duration-200"
                    title="Mic Muted"
                  >
                    <MicOff size={14} className="text-white" />
                  </div>
                )}
              </div>
            )}

            {/* Action Modal -> Now UserStatsModal */}
            {selectedUserForAction && selectedUserForAction === userId && userId && (
              <UserActionModal
                onClose={() => setSelectedUserForAction(null)}
                userId={userId}
                streamId={stream.id}
                username={displayProfile?.username}
                role={displayProfile?.role || displayProfile?.troll_role}
                createdAt={displayProfile?.created_at}
                isHost={isHost}
                isModerator={isModerator}
                onGift={() => onGift(userId)}
                onKickStage={onKick ? () => onKick(userId) : undefined}
              />
            )}
          </div>
        );
      })}
      
      {/* Broadcaster Stats Modal */}
      {showHostStats && isHost && (
          <BroadcasterStatsModal 
              stream={stream} 
              onClose={() => setShowHostStats(false)} 
              broadcasterProfile={broadcasterProfile} 
          />
      )}
    </div>
  );
}
