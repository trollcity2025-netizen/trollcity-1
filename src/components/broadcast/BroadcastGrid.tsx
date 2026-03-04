import { useMemo, useState, type CSSProperties, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ILocalVideoTrack, ILocalAudioTrack, IRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, MicOff, VideoOff, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';
import { supabase } from '../../lib/supabase';

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
  localTracks: [ILocalAudioTrack | undefined, ILocalVideoTrack | undefined];
  remoteUsers: IRemoteUser[];
  localUserId: string;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  // Mapping of user IDs to Agora UIDs for remote users
  userIdToAgoraUid?: Record<string, number>;
  // Callback to get user box positions for gift animations
  onGetUserPositions?: (getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => void;
  // Optional box count override (from useBoxCount hook for performance)
  boxCount?: number;
}

function AgoraVideoPlayer({
  videoTrack,
  isLocal = false,
}: {
  videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined;
  isLocal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      console.log('[AgoraVideoPlayer] Skipping - missing track or container');
      return;
    }

    if (hasPlayedRef.current) {
      console.log('[AgoraVideoPlayer] Already played this track - skipping duplicate');
      return;
    }

    const playWithRetry = () => {
      if (!containerRef.current) return;

      try {
        console.log('[AgoraVideoPlayer] Calling play() - attempt', retryCountRef.current + 1);
        videoTrack.play(containerRef.current);
        hasPlayedRef.current = true;
        console.log('[AgoraVideoPlayer] play() called successfully');

        // Inspect injected video after Agora has time to inject it
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          console.log('[AgoraVideoPlayer] Inner <video> inspection:', {
            exists: !!inner,
            width: inner?.videoWidth ?? 0,
            height: inner?.videoHeight ?? 0,
            readyState: inner?.readyState ?? -1, // 0=NOTHING, 1=metadata, 2=current, 3=future, 4=enough
            paused: inner?.paused ?? false,
            muted: inner?.muted ?? false,
            srcObjectPresent: !!inner?.srcObject,
          });

          // If no frames or not ready → retry
          if (inner && (inner.videoWidth === 0 || inner.readyState < 2)) {
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              console.warn(`[AgoraVideoPlayer] No frames yet (attempt ${retryCountRef.current}/${maxRetries}) - retrying in 400ms`);
              hasPlayedRef.current = false; // allow re-play
              setTimeout(playWithRetry, 400);
            } else {
              console.error('[AgoraVideoPlayer] Max retries reached - no frames flowing');
            }
          }
        }, 600); // give Agora time to create <video> + start frames

      } catch (err) {
        console.error('[AgoraVideoPlayer] play() threw error:', err);
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(playWithRetry, 500);
        }
      }
    };

    // Slight delay to ensure container is painted
    const initialTimer = setTimeout(playWithRetry, 150);

    return () => {
      clearTimeout(initialTimer);
      if (videoTrack) {
        console.log('[AgoraVideoPlayer] Cleanup - stopping track');
        try {
          videoTrack.stop();
        } catch (e) {}
      }
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-black overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
        position: 'absolute',
        inset: 0,
        // TEMPORARILY DISABLE mirroring to rule it out (re-enable after test)
        // transform: isLocal ? 'scaleX(-1)' : undefined,
        zIndex: 1,
      }}
    />
  );
}

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
  boxCount: boxCountProp,
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
  const [userReceivedGifts, setUserReceivedGifts] = useState<Record<string, number>>({});

  // Update persistent gifts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPersistentGifts(getAllPersistentGifts());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch received gifts for all users in this stream
  useEffect(() => {
    if (!stream?.id) return;

    const fetchUserGifts = async () => {
      // Get all user IDs currently in seats
      const userIdsInStream = Object.values(seats)
        .filter((seat): seat is SeatSession & { user_id: string } => !!seat?.user_id)
        .map(seat => seat.user_id);
      
      // Also include host
      if (stream.user_id && !userIdsInStream.includes(stream.user_id)) {
        userIdsInStream.push(stream.user_id);
      }

      if (userIdsInStream.length === 0) return;

      try {
        // Fetch gifts from gift_ledger for this stream
        const { data: giftData } = await supabase
          .from('gift_ledger')
          .select('receiver_id, amount')
          .eq('stream_id', stream.id)
          .eq('status', 'processed')
          .in('receiver_id', userIdsInStream);

        if (giftData) {
          // Sum gifts per user
          const giftsByUser: Record<string, number> = {};
          giftData.forEach((gift: { receiver_id: string; amount: number }) => {
            giftsByUser[gift.receiver_id] = (giftsByUser[gift.receiver_id] || 0) + (gift.amount || 0);
          });
          setUserReceivedGifts(giftsByUser);
        }
      } catch (err) {
        console.error('[BroadcastGrid] Error fetching user gifts:', err);
      }
    };

    fetchUserGifts();
    // Refresh every 10 seconds
    const interval = setInterval(fetchUserGifts, 10000);
    return () => clearInterval(interval);
  }, [stream?.id, stream?.user_id, seats]);

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

  const getParticipantAndTracks = (userId: string | undefined) => {
    if (!userId) return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };

    let participant: IRemoteUser | undefined;
    let videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined;
    let audioTrack: ILocalAudioTrack | IRemoteAudioTrack | undefined;
    let isLocal = false;

    if (userId === localUserId) {
      // Local user - use array index since we know the structure is [audio, video]
      // Note: localTracks doesn't have trackMediaType property (only remote tracks do)
      isLocal = true;
      audioTrack = localTracks[0] as ILocalAudioTrack | undefined;
      videoTrack = localTracks[1] as ILocalVideoTrack | undefined;
      console.log('[BroadcastGrid] Local user tracks for', userId?.substring(0, 8), ':', {
        hasVideoTrack: !!videoTrack,
        hasAudioTrack: !!audioTrack,
        localTracksLength: localTracks.length,
        localTracks0: localTracks[0]?.constructor?.name,
        localTracks1: localTracks[1]?.constructor?.name,
        videoTrackId: videoTrack?.getTrackId?.(),
        videoEnabled: (videoTrack as any)?.enabled,
      });
      // For local participant, we don't have an IRemoteUser object, so we'll use a dummy one for consistent typing
      // and to carry the identity for attribute lookup
      participant = { uid: localUserId, hasAudio: !!audioTrack, hasVideo: !!videoTrack, audioTrack, videoTrack } as IRemoteUser;
    } else {
      // Remote user - try to find by any available method
      // First: use the userIdToAgoraUid mapping if available
      const agoraUid = userIdToAgoraUid[userId];
      if (agoraUid !== undefined) {
        participant = remoteUsers.find(u => u.uid === agoraUid);
        console.log('[BroadcastGrid] Looking up remote by agoraUid:', agoraUid, 'found:', !!participant);
      }
      
      // Second: try to find by matching numeric Agora UID with user ID patterns
      if (!participant) {
        participant = remoteUsers.find(u => {
          const uidStr = String(u.uid);
          return uidStr === userId || uidStr === userId.replace(/-/g, '').substring(0, 8);
        });
        if (participant) {
          console.log('[BroadcastGrid] Found remote by userId pattern match');
        }
      }
      
      // Third: if this is the host user and we still don't have a participant,
      // the host might be publishing as a remote user (different connection)
      if (!participant && userId === stream.user_id) {
        // Host should be found - try to find any user that might be the host
        participant = remoteUsers.find(u => u.hasVideo || u.hasAudio);
        if (participant) {
          console.log('[BroadcastGrid] Using fallback for host - found remote with media:', participant.uid);
        }
      }
      
      if (participant) {
        videoTrack = participant.videoTrack;
        audioTrack = participant.audioTrack;
        console.log('[BroadcastGrid] Remote user tracks:', {
          uid: participant.uid,
          hasVideoTrack: !!videoTrack,
          hasAudioTrack: !!audioTrack,
          hasVideo: participant.hasVideo,
          hasAudio: participant.hasAudio
        });
      } else {
        console.log('[BroadcastGrid] No participant found for userId:', userId?.substring(0, 8), 'remoteUsers count:', remoteUsers.length);
      }
    }
    
    // For remote users, we assume camera is on if we have a video track
    // For local users, check if track exists and is enabled (default to true if enabled is undefined)
    const isMicOn = isLocal 
      ? (audioTrack ? (audioTrack as any).enabled !== false : false) 
      : !!audioTrack;
    const isCamOn = isLocal 
      ? (videoTrack ? ((videoTrack as any).enabled === true || (videoTrack as any).enabled === undefined) : false) 
      : !!videoTrack;

    if (isLocal) {
      console.log('[BroadcastGrid] Local track states:', { isMicOn, isCamOn, videoTrackExists: !!videoTrack, audioTrackExists: !!audioTrack });
    }

    return { participant, videoTrack, audioTrack, isLocal, isMicOn, isCamOn };
  };

  // Calculate how many boxes we must render (never hide occupied seats)
  const seatKeys = Object.keys(seats);
  const occupiedSeatIndices = seatKeys
    .map(Number)
    .filter(idx => seats[idx]?.user_id);
  const maxOccupiedSeatIndex = occupiedSeatIndices.length > 0 ? Math.max(...occupiedSeatIndices) : -1;
  const requiredBoxes = Math.max(1, maxOccupiedSeatIndex + 1); // 0-indexed

  // Use boxCount prop if provided (from useBoxCount hook), otherwise fall back to stream.box_count
  const streamBoxCount = Math.max(1, Number(boxCountProp !== undefined ? boxCountProp : (stream.box_count || 1)));
  
  // ALWAYS ensure we have enough boxes for all occupied seats PLUS the configured box_count
  // This ensures guests in higher seats are always visible
  const totalRequiredBoxes = Math.max(streamBoxCount, requiredBoxes);
  
  console.log('[BroadcastGrid] Box count calculation:', {
    streamBoxCount,
    requiredBoxes,
    totalRequiredBoxes,
    occupiedSeatIndices,
    maxOccupiedSeatIndex,
    localUserId: localUserId?.substring(0, 8),
    streamUserId: stream.user_id?.substring(0, 8),
    seatKeys: seatKeys.map(k => ({ key: k, userId: seats[Number(k)]?.user_id?.substring(0, 8) }))
  });
  
  const baseCount = totalRequiredBoxes;

  const HARD_CAP = 6;

  // Only apply maxItems if it won't hide requiredBoxes
  const maxCap = typeof maxItems === 'number' ? Math.min(maxItems, HARD_CAP) : HARD_CAP;
  
  let effectiveBoxCount: number;
  let boxes: number[];

  if (hideEmptySeats) {
    // In hideEmptySeats mode, we only render active participants
    // Slot 0 (Host) is always included
    const activeIndices = [0];
    
    // Add ALL occupied seat indices (not just up to box_count)
    occupiedSeatIndices.forEach((index) => {
      if (!activeIndices.includes(index)) {
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
    // Standard mode: render boxes based on stream config, but NEVER hide occupied seats
    effectiveBoxCount = Math.min(baseCount, HARD_CAP);
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
      <AnimatePresence mode="popLayout">
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

          // Debug logging for ALL users (local and remote)
          if (userId) {
            console.log(`[BroadcastGrid] User ${userId.substring(0, 8)}... (isLocal=${isLocal}):`, { 
              hasParticipant: !!participant, 
              hasVideoTrack: !!videoTrack, 
              hasAudioTrack: !!audioTrack, 
              isCamOn, 
              isMicOn,
              videoEnabled: (videoTrack as any)?.enabled,
              audioEnabled: (audioTrack as any)?.enabled,
              remoteUsersCount: remoteUsers.length 
            });
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
            !hasGold && (hasRgbProfile || hasStreamRgb) && 'rgb-box'
          );

          // Get received gifts for this user
          const userGiftAmount = userId ? (userReceivedGifts[userId] || 0) : 0;

          return (
            <div
              key={seatIndex}
              ref={(el) => {
                if (userId) {
                  boxRefs.current[userId] = el;
                }
              }}
              className="contents"
            >
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
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
              {/* DEBUG: Red circle for broadcaster or TrollCityAdmin - indicates component is rendering */}
              {(isStreamHost && seatIndex === 0) || displayProfile?.username === 'TrollCityAdmin' && (
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-red-500 bg-red-500/20 z-30 pointer-events-none flex items-center justify-center"
                  title="Broadcaster Test Indicator"
                >
                  <span className="text-red-500 font-bold text-xs">{displayProfile?.username === 'TrollCityAdmin' ? 'ADMIN' : 'HOST'}</span>
                </div>
              )}

              {/* Render Video if Participant Exists and Track is active */}
              {(() => {
                console.log(`[BroadcastGrid] Box ${seatIndex} video render check:`, {
                  userId: userId?.substring(0, 8),
                  isLocal,
                  hasVideoTrack: !!videoTrack,
                  videoTrackType: videoTrack?.trackMediaType,
                  videoEnabled: (videoTrack as any)?.enabled,
                  isCamOn,
                  shouldRenderVideo: !!(videoTrack && isCamOn),
                  isLocalUser: userId === localUserId
                });
                return null;
              })()}
              {/* Always render video player for local user - it handles undefined track internally */}
              {userId === localUserId ? (
                <AgoraVideoPlayer
                  videoTrack={videoTrack}
                  isLocal={true}
                />
              ) : videoTrack && isCamOn ? (
                <AgoraVideoPlayer
                  videoTrack={videoTrack}
                  isLocal={false}
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

              {/* Received Gifts Badge */}
              {userId && userGiftAmount > 0 && (
                <div className="absolute bottom-20 left-3 z-10 pointer-events-none">
                  <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-pink-500/30 flex items-center gap-2 shadow-lg">
                    <Gift size={12} className="text-pink-400" />
                    <span className="text-xs font-bold text-white">
                      +{userGiftAmount.toLocaleString()}
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
            </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
      
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
