import { useMemo, useState, type CSSProperties, useRef, useEffect, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ILocalVideoTrack, ILocalAudioTrack, IRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, MicOff, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';

import BroadcasterStatsModal from './BroadcasterStatsModal';
import { SeatSession } from '../../hooks/useStreamSeats';
import { getGlowingTextStyle } from '../../lib/perkEffects';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { useAuthStore } from '../../lib/store';
import { getAllPersistentGifts, type PersistentGift } from '../../lib/persistentGiftStore';

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  streamStatus: Stream['status'];
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
  localTracks: [ILocalVideoTrack | undefined, ILocalAudioTrack | undefined];
  remoteUsers: IRemoteUser[];
  localUserId: string;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  // Mapping of user IDs to Agora UIDs for remote users
  userIdToAgoraUid?: Record<string, number>;
  // Callback to get user box positions for gift animations
  onGetUserPositions?: (getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => void;
}

const AgoraVideoPlayer = memo(({ videoTrack, isLocal = false }: { videoTrack: ILocalVideoTrack | IRemoteVideoTrack; isLocal?: boolean }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Defensive: ensure we have a valid container and track
    if (!videoRef.current || !videoTrack) {
      console.log('[AgoraVideoPlayer] Skipping play - no container or track:', { hasContainer: !!videoRef.current, hasTrack: !!videoTrack });
      return;
    }

    // Already playing - just return to avoid re-creating video element
    if (isPlayingRef.current) {
      return;
    }

    try {
      videoTrack.play(videoRef.current);
      isPlayingRef.current = true;
      console.log('[AgoraVideoPlayer] Video playing successfully');
    } catch (err) {
      console.error('[AgoraVideoPlayer] Failed to play video:', err);
    }

    return () => {
      try {
        videoTrack.stop();
        isPlayingRef.current = false;
      } catch (err) {
        console.warn('[AgoraVideoPlayer] Error stopping video:', err);
      }
    };
  }, [videoTrack]);

  // Use absolute positioning to fill parent container completely
  // This ensures video renders even when parent has flex/grid layout
  // Apply mirror transform for local video (self-view) to make it natural
  return (
    <div 
      ref={videoRef} 
      className="absolute inset-0 w-full h-full"
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Mirror local video horizontally for natural self-view
        transform: isLocal ? 'scaleX(-1)' : undefined
      }}
    />
  );
});

AgoraVideoPlayer.displayName = 'AgoraVideoPlayer';

const AgoraAudioPlayer = memo(({ audioTrack }: { audioTrack: ILocalAudioTrack | IRemoteAudioTrack }) => {
  const audioRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Defensive: ensure we have a valid track
    if (!audioTrack) {
      console.log('[AgoraAudioPlayer] No audio track');
      return;
    }

    // Already playing
    if (isPlayingRef.current) {
      return;
    }

    try {
      audioTrack.play();
      isPlayingRef.current = true;
      console.log('[AgoraAudioPlayer] Audio playing');
    } catch (err) {
      console.error('[AgoraAudioPlayer] Failed to play audio:', err);
    }

    return () => {
      try {
        audioTrack.stop();
        isPlayingRef.current = false;
      } catch (err) {
        console.warn('[AgoraAudioPlayer] Error stopping audio:', err);
      }
    };
  }, [audioTrack]);

  return <div ref={audioRef}></div>;
});

AgoraAudioPlayer.displayName = 'AgoraAudioPlayer';

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
  localTracks,
  remoteUsers,
  localUserId,
  toggleCamera,
  toggleMicrophone,
  userIdToAgoraUid = {},
  onGetUserPositions,
  streamStatus,
}: BroadcastGridProps) {
  const { profile } = useAuthStore();
  
  // Log when stream changes to debug updates
  const prevStreamRef = useRef(stream?.box_count);
  useEffect(() => {
    if (prevStreamRef.current !== stream?.box_count) {
      console.log('[BroadcastGrid] Stream box_count changed:', prevStreamRef.current, '->', stream?.box_count);
      prevStreamRef.current = stream?.box_count;
    }
  }, [stream?.box_count]);
  
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const [showHostStats, setShowHostStats] = useState(false);
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [persistentGifts, setPersistentGifts] = useState<Map<string, PersistentGift[]>>(new Map());

  // Update persistent gifts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPersistentGifts(getAllPersistentGifts());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Expose positions when callback is provided
  const getPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}));
  
  useEffect(() => {
    if (onGetUserPositions) {
      // Store the callback that calculates positions from DOM refs
      getPositionsRef.current = () => {
        const positions: Record<string, { top: number; left: number; width: number; height: number }> = {};
        Object.entries(boxRefs.current).forEach(([userId, el]) => {
          if (el) {
            const rect = el.getBoundingClientRect();
            positions[userId] = {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            };
          }
        });
        return positions;
      };
      // Also pass the function to the callback so parent can call it
      onGetUserPositions(getPositionsRef.current);
    }
  }, [onGetUserPositions]);

  // Update positions when seats or user change
  useEffect(() => {
    // Trigger position update after render
    const timeoutId = setTimeout(() => {
      if (getPositionsRef.current) {
        getPositionsRef.current();
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [seats, stream.user_id, stream.box_count]);

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

  const getParticipantAndTracks = useCallback((userId: string | undefined) => {
    if (!userId) return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };

    let participant: IRemoteUser | undefined;
    let videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined;
    let audioTrack: ILocalAudioTrack | IRemoteAudioTrack | undefined;
    let isLocal = false;

    if (userId === localUserId) {
      // Local user
      isLocal = true;
      videoTrack = localTracks[0];
      audioTrack = localTracks[1];
      // For local participant, we don't have an IRemoteUser object, so we'll use a dummy one for consistent typing
      // and to carry the identity for attribute lookup
      participant = { uid: localUserId, hasAudio: !!audioTrack, hasVideo: !!videoTrack, audioTrack, videoTrack } as IRemoteUser;
    } else {
      // Remote user - use the userIdToAgoraUid mapping if available
      const agoraUid = userIdToAgoraUid[userId];
      if (agoraUid !== undefined) {
        participant = remoteUsers.find(u => u.uid === agoraUid);
      } else {
        // Fallback: try to find by matching numeric Agora UID with user ID patterns
        participant = remoteUsers.find(u => {
          const uidStr = String(u.uid);
          return uidStr === userId || uidStr === userId.replace(/-/g, '').substring(0, 8);
        });
      }
      
      if (participant) {
        videoTrack = participant.videoTrack;
        audioTrack = participant.audioTrack;
      } else {
        // Last resort: find any remote user with video (for host case)
        const remoteWithVideo = remoteUsers.find(u => u.videoTrack);
        if (remoteWithVideo) {
          participant = remoteWithVideo;
          videoTrack = participant.videoTrack;
          audioTrack = participant.audioTrack;
        }
      }
    }
    
    // For remote users, we assume camera is on if we have a video track
    // The enabled property works differently for remote vs local tracks
    const isMicOn = isLocal ? (audioTrack ? (audioTrack as any).enabled !== false : false) : !!audioTrack;
    const isCamOn = isLocal ? (videoTrack ? (videoTrack as any).enabled !== false : false) : !!videoTrack;

    return { participant, videoTrack, audioTrack, isLocal, isMicOn, isCamOn };
  }, [localUserId, localTracks, remoteUsers, userIdToAgoraUid]);

  // Calculate how many boxes we must render (never hide occupied seats)
  const seatKeys = Object.keys(seats);
  const maxOccupiedSeatIndex = seatKeys.length ? Math.max(...seatKeys.map(Number)) : -1;
  const requiredBoxes = Math.max(1, maxOccupiedSeatIndex + 1); // 0-indexed

  const streamBoxCount = Math.max(1, Number(stream.box_count || 1));
  console.log('[BroadcastGrid] Box count calculation:', { 
    streamBoxCount, 
    requiredBoxes, 
    seatKeys,
    maxOccupiedSeatIndex 
  });
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
        'grid gap-2 w-full h-full p-2 min-w-0 overflow-hidden max-w-full',
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
        const { participant, videoTrack, audioTrack, isLocal, isMicOn, isCamOn } = getParticipantAndTracks(userId);

        // Debug logging
        if (userId && !isLocal) {
          console.log('[BroadcastGrid] Remote user:', userId, { participant: !!participant, videoTrack: !!videoTrack, audioTrack: !!audioTrack, isCamOn, remoteUsersCount: remoteUsers.length });
        }

        // Determine profile used for visuals
        let displayProfile = seat?.user_profile;
        if (seatIndex === 0 && isStreamHost) {
          displayProfile = broadcasterProfile;
        }

        // Use real-time attributes if available
        const userAttrs = userId ? attributes[userId] : null;

        const baseBoxClass = 'relative bg-black/50 rounded-xl overflow-hidden border border-white/10 transition-all duration-300 min-w-0';

        const hasGold =
          !!displayProfile?.is_gold || userAttrs?.activePerks?.includes('perk_gold_username' as any);

        const hasRgbProfile =
          (!!displayProfile?.rgb_username_expires_at &&
            new Date(displayProfile.rgb_username_expires_at) > new Date()) ||
          userAttrs?.activePerks?.includes('perk_rgb_username' as any);

        const hasStreamRgb = !!stream.has_rgb_effect;

        const boxClass = cn(
          baseBoxClass,
          hasGold && 'border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]',
          !hasGold && (hasRgbProfile || (hasStreamRgb && !isLocal)) && 'rgb-box'
        );

        return (
          <div
            key={seatIndex}
            className={boxClass}
            ref={(el) => {
              if (userId) {
                boxRefs.current[userId] = el;
              }
            }}
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
            {videoTrack && isCamOn ? (
              <AgoraVideoPlayer
                videoTrack={videoTrack}
                isLocal={isLocal}
              />
            ) : userId && participant ? (
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
            ) : userId && !participant && streamStatus !== 'ended' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse bg-zinc-800 w-full h-full" />
                <span className="absolute text-xs text-white/50">
                  {isStreamHost ? 'Host Connecting...' : 'Connecting...'}
                </span>
              </div>
            ) : null}

            {audioTrack && !isLocal && <AgoraAudioPlayer audioTrack={audioTrack} />}

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

            {/* Coin Balance in Top Right */}
            {userId && (
              <div className="absolute top-3 right-3 z-10 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg">
                  <Coins size={12} className="text-yellow-400" />
                  <span className="text-sm font-bold text-white">
                    {(displayProfile?.troll_coins || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Persistent Gifts Badge */}
            {userId && persistentGifts.get(userId) && persistentGifts.get(userId)!.length > 0 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
                {persistentGifts.get(userId)!.slice(0, 3).map((gift, idx) => (
                  <motion.div
                    key={`${gift.giftId}-${gift.expiresAt}-${idx}`}
                    initial={{ scale: 0, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0, y: 20 }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full font-bold text-xs shadow-lg",
                      gift.amount >= 10000 
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
                        : gift.amount >= 5000
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                    )}
                  >
                    <span>{gift.giftIcon}</span>
                    <span>x{gift.amount >= 1000 ? Math.floor(gift.amount / 1000) : 1}</span>
                  </motion.div>
                ))}
                {persistentGifts.get(userId)!.length > 3 && (
                  <div className="text-xs text-yellow-400 font-bold">
                    +{persistentGifts.get(userId)!.length - 3} more
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