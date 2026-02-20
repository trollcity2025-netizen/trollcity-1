import { useAgora } from '../../hooks/useAgora';
import AgoraVideoPlayer from './AgoraVideoPlayer';
import { useMemo, useState, type CSSProperties } from 'react';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, MicOff, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';
import BroadcasterStatsModal from './BroadcasterStatsModal';
import { SeatSession } from '../../hooks/useStreamSeats';
import { getGlowingTextStyle } from '../../lib/perkEffects';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';

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
  hideBroadcasterName?: boolean;
  isChurch?: boolean;
}

export default function BroadcastGrid({
  stream,
  isHost,
  isModerator,
  maxItems,
  onGift,
  onGiftAll: _onGiftAll,
  mode: _mode = 'stage',
  seats = {},
  onJoinSeat,
  onKick,
  broadcasterProfile,
  hideEmptySeats = false,
  seatPriceOverride,
  hideBroadcasterName = false,
  isChurch = false,
}: BroadcastGridProps) {
  const { remoteUsers, localVideoTrack } = useAgora();
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const [showHostStats, setShowHostStats] = useState(false);

  const userIds = useMemo(() => {
    const set = new Set<string>();
    if (stream.user_id) set.add(stream.user_id);
    Object.values(seats).forEach((seat) => {
      if (seat?.user_id) set.add(seat.user_id);
    });
    return Array.from(set);
  }, [stream.user_id, seats]);

  const attributes = useParticipantAttributes(userIds, stream.id);

  const seatKeys = Object.keys(seats);
  const maxOccupiedSeatIndex = seatKeys.length > 0 ? Math.max(...seatKeys.map(Number)) : -1;
  const requiredBoxes = Math.max(1, maxOccupiedSeatIndex + 1);

  const streamBoxCount = Math.max(1, Number(stream.box_count || 1));
  const baseCount = Math.max(streamBoxCount, requiredBoxes);

  const HARD_CAP = 6;

  const maxCap = typeof maxItems === 'number' ? Math.min(maxItems, HARD_CAP) : HARD_CAP;

  let effectiveBoxCount: number;
  let boxes: number[];

  if (hideEmptySeats) {
    const activeIndices = [0];
    seatKeys.forEach((key) => {
      const index = Number(key);
      if (seats[index]?.user_id) {
        activeIndices.push(index);
      }
    });
    activeIndices.sort((a, b) => a - b);
    const visibleIndices = activeIndices.slice(0, HARD_CAP);
    effectiveBoxCount = visibleIndices.length;
    boxes = visibleIndices;
  } else {
    effectiveBoxCount =
      typeof maxItems === 'number' && maxCap < requiredBoxes
        ? Math.min(baseCount, HARD_CAP)
        : Math.min(baseCount, maxCap);
    boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
  }

  if (isChurch) {
    const pastorVideoTrack = isHost ? localVideoTrack : remoteUsers.find((u) => String(u.uid) === stream.user_id)?.videoTrack;

    if (pastorVideoTrack) {
      return (
        <AgoraVideoPlayer
          videoTrack={pastorVideoTrack}
          className={cn('w-full h-full object-contain', isHost && 'scale-x-[-1]')}
          style={{ filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.5))' }}
        />
      );
    }
    return null; // Or a loader
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

        if (seatIndex === 0) {
          userId = stream.user_id;
        }

        const isStreamHost = userId === stream.user_id;

        const remoteUser = remoteUsers.find((u) => String(u.uid) === userId);
        const videoTrack = isStreamHost ? localVideoTrack : remoteUser?.videoTrack;
        const isCamOn = isStreamHost ? !!localVideoTrack : !!remoteUser?.hasVideo;
        const isMicOn = isStreamHost ? (localVideoTrack ? true : false) : !!remoteUser?.hasAudio;

        let displayProfile = seat?.user_profile;
        if (seatIndex === 0 && isStreamHost) {
          displayProfile = broadcasterProfile;
        }

        const userAttrs = userId ? attributes[userId] : null;

        let boxClass = 'relative bg-gradient-to-br from-zinc-900 to-black rounded-2xl overflow-hidden border border-white/5 shadow-lg shadow-black/50 transition-all duration-300';

        const hasGold =
          !!displayProfile?.is_gold || userAttrs?.activePerks?.includes('perk_gold_username' as any);

        const hasRgbProfile =
          (!!displayProfile?.rgb_username_expires_at &&
            new Date(displayProfile.rgb_username_expires_at) > new Date()) ||
          userAttrs?.activePerks?.includes('perk_rgb_username' as any);

        const hasStreamRgb = !!stream.has_rgb_effect;

        if (hasGold) {
          boxClass = 'relative bg-gradient-to-br from-yellow-900/50 to-black rounded-2xl overflow-hidden border-2 border-yellow-400/80 shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all duration-300 ring-2 ring-yellow-500/50 ring-inset';
        } else if (hasRgbProfile || hasStreamRgb) {
          boxClass = 'relative bg-black rounded-2xl overflow-hidden rgb-box-glow transition-all duration-300';
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
            {videoTrack && isCamOn ? (
              <AgoraVideoPlayer
                videoTrack={videoTrack}
                className={cn('w-full h-full object-cover', isStreamHost && 'scale-x-[-1]')}
              />
            ) : (
              <>
                {userId && (
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
                {!userId && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {onJoinSeat ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJoinSeat(seatIndex);
                        }}
                        className="flex flex-col items-center text-zinc-500 hover:text-white transition-colors"
                      >
                        <div className="p-4 rounded-full border-2 border-dashed border-zinc-700 group-hover:border-white group-hover:bg-white/10 mb-2 transition-all duration-300">
                          <Plus size={32} />
                        </div>
                        <span className="text-sm font-semibold">Join Stage</span>
                        {(typeof seatPriceOverride === 'number'
                          ? seatPriceOverride
                          : stream.seat_price) > 0 && (
                          <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full mt-2 border border-yellow-500/30">
                            <Coins size={12} className="text-yellow-500" />
                            <span className="text-xs font-bold text-yellow-400">
                              {typeof seatPriceOverride === 'number'
                                ? seatPriceOverride
                                : stream.seat_price}
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
              </>
            )}
            {userId && !hideBroadcasterName && (
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                  <div className="flex flex-col min-w-0">
                    <div className="text-white text-sm font-bold truncate flex items-center gap-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                      {(() => {
                        const profile =
                          isStreamHost && broadcasterProfile
                            ? broadcasterProfile
                            : seat?.user_profile;

                        const name = isStreamHost
                          ? broadcasterProfile?.username || 'Host'
                          : displayProfile?.username || 'User';

                        let className = 'text-white';
                        let style: CSSProperties | undefined = undefined;

                        if (profile) {
                          if (profile.is_gold) {
                            className = 'gold-username-glow';
                          } else if (
                            profile.rgb_username_expires_at &&
                            new Date(profile.rgb_username_expires_at) > new Date()
                          ) {
                            className = 'rgb-username-glow';
                          } else if (profile.glowing_username_color) {
                            style = getGlowingTextStyle(profile.glowing_username_color);
                            className = 'font-bold';
                          } else if (userAttrs?.activePerks?.includes('perk_global_highlight' as any)) {
                            className = 'glowing-username';
                          } else if (['admin', 'moderator', 'secretary'].includes(profile.role || '')) {
                            className = 'silver-username-glow';
                          }
                        }

                        return (
                          <span className={className} style={style}>
                            {name}
                          </span>
                        );
                      })()}

                      {isStreamHost && (
                        <span className="ml-1 text-[9px] bg-red-600 px-1.5 py-0.5 rounded text-white font-bold uppercase tracking-wider shadow-md">
                          HOST
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!isMicOn && (
                  <div
                    className="bg-red-600/90 p-2 rounded-full backdrop-blur-md shadow-lg border border-white/10 animate-in zoom-in duration-200"
                    title="Mic Muted"
                  >
                    <MicOff size={16} className="text-white" />
                  </div>
                )}
              </div>
            )}

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
