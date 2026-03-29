import { useMemo, useState, useRef, useEffect, useCallback, memo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, Minus, MicOff, VideoOff, Gift, Gem, Crown, Swords, Shield, Palette } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';
import { supabase } from '../../lib/supabase';

import BroadcasterStatsModal from './BroadcasterStatsModal';
import { SeatSession } from '../../hooks/useStreamSeats';
import { getGlowingTextStyle } from '../../lib/perkEffects';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { useAuthStore } from '../../lib/store';
import { getAllPersistentGifts, type PersistentGift } from '../../lib/persistentGiftStore';

interface BattleState {
  active: boolean;
  battleId: string | null;
  hostId: string | null;
  challengerId: string | null;
  broadcasterScore: number;
  challengerScore: number;
  startedAt: Date | null;
  endsAt: Date | null;
  suddenDeath: boolean;
}

interface BattleSupporter {
  userId: string;
  team: 'broadcaster' | 'challenger';
}

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
  localTracks: [LocalAudioTrack | undefined, LocalVideoTrack | undefined];
  remoteUsers: RemoteParticipant[];
  localUserId: string;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  // Mapping of user IDs to LiveKit identities for remote users
  userIdToLiveKitIdentity?: Record<string, string>;
  // Callback to get user box positions for gift animations
  onGetUserPositions?: (getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => void;
  // Optional box count override (from useBoxCount hook for performance)
  boxCount?: number;
  // Battle mode props
  battleState?: BattleState;
  supporters?: Map<string, BattleSupporter>;
  onPickSide?: (team: 'broadcaster' | 'challenger') => void;
  joinWindowOpen?: boolean;
  userTeam?: 'broadcaster' | 'challenger' | null;
  remainingTime?: number;
  shouldShowSidePicker?: boolean;
  onBattleGift?: (team: 'broadcaster' | 'challenger', amount: number) => Promise<boolean>;
  enableStreamSwipe?: boolean;
  canSwipe?: boolean;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  // Side orb controls (host-only, shown inside broadcaster box)
  onAddBox?: () => void;
  onRemoveBox?: () => void;
  onToggleRgb?: () => void;
  hasRgbEffect?: boolean;
  canEditBoxes?: boolean;
}

function LiveKitVideoPlayer({
  videoTrack,
  isLocal = false,
}: {
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  isLocal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      console.log('[LiveKitVideoPlayer] Skipping - missing track or container');
      return;
    }

    // Always try to attach - even if hasPlayedRef is true, we may need to reattach
    // after cleanup. The key is to check if we already have a video element attached.
    if (hasPlayedRef.current && videoElementRef.current && containerRef.current.contains(videoElementRef.current)) {
      console.log('[LiveKitVideoPlayer] Already played this track - skipping duplicate');
      return;
    }

    // Reset the played state if we don't have a valid element
    if (!videoElementRef.current || !containerRef.current.contains(videoElementRef.current)) {
      hasPlayedRef.current = false;
    }

    if (hasPlayedRef.current) {
      console.log('[LiveKitVideoPlayer] Already played this track - skipping duplicate');
      return;
    }

    const playWithRetry = () => {
      if (!containerRef.current) return;

      try {
        console.log('[LiveKitVideoPlayer] Calling attach() - LiveKit track');
        // LiveKit uses attach() instead of play()
        const videoElement = videoTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        // Critical: Add autoPlay and playsInline for proper video display
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        // Ensure muted for local video to avoid feedback
        if (isLocal) {
          videoElement.muted = true;
        }
        
        containerRef.current.appendChild(videoElement);
        
        // Mirror local video container for natural self-view
        if (isLocal && containerRef.current) {
          containerRef.current.style.transform = 'scaleX(-1)';
        }
        videoElementRef.current = videoElement;
        hasPlayedRef.current = true;
        console.log('[LiveKitVideoPlayer] attach() called successfully');

        // Inspect video element after LiveKit has time to attach it
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          console.log('[LiveKitVideoPlayer] Inner <video> inspection:', {
            exists: !!inner,
            width: inner?.videoWidth ?? 0,
            height: inner?.videoHeight ?? 0,
            readyState: inner?.readyState ?? -1,
            paused: inner?.paused ?? false,
            muted: inner?.muted ?? false,
            srcObject: !!inner?.srcObject,
          });
          
          // If video element exists but has no srcObject, try to play it
          if (inner) {
            if (!inner.srcObject) {
              console.log('[LiveKitVideoPlayer] Video element has no srcObject, attempting play()');
              inner.play().catch(e => console.log('[LiveKitVideoPlayer] play() failed:', e));
            }
            // Always try to ensure video is playing - call play() regardless
            if (inner.paused) {
              console.log('[LiveKitVideoPlayer] Video is paused, attempting play()');
              inner.play().catch(e => console.log('[LiveKitVideoPlayer] play() failed:', e));
            }
          }
        }, 600);

        // Additional check after longer delay to ensure video is flowing
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          if (inner && (inner.videoWidth === 0 || inner.videoHeight === 0)) {
            console.log('[LiveKitVideoPlayer] Video has no dimensions, re-attaching track');
            // Force re-attach by getting new element
            try {
              videoTrack.detach();
            } catch (e) {}
            const newElement = videoTrack.attach();
            newElement.style.width = '100%';
            newElement.style.height = '100%';
            newElement.style.objectFit = 'cover';
            newElement.autoplay = true;
            newElement.playsInline = true;
            if (isLocal) {
              newElement.muted = true;
            }
            containerRef.current!.innerHTML = '';
            containerRef.current!.appendChild(newElement);
            videoElementRef.current = newElement;
            console.log('[LiveKitVideoPlayer] Re-attached track');
          }
        }, 2000);

      } catch (err) {
        console.error('[LiveKitVideoPlayer] attach() threw error:', err);
      }
    };

    // Slight delay to ensure container is painted
    const initialTimer = setTimeout(playWithRetry, 150);

    return () => {
      clearTimeout(initialTimer);
      // Only detach if the component is truly being unmounted, not just re-rendering
      // We use a more robust check here
      if (videoTrack && videoElementRef.current && containerRef.current) {
        // Check if this specific element is still in the container
        if (containerRef.current.contains(videoElementRef.current)) {
          console.log('[LiveKitVideoPlayer] Cleanup - detaching track');
          try {
            videoTrack.detach();
            videoElementRef.current = null;
            hasPlayedRef.current = false;
          } catch (e) {
            console.warn('[LiveKitVideoPlayer] detach error:', e);
          }
        }
      }
    };
  }, [videoTrack, isLocal]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-black overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}
    />
  );
}

const LiveKitAudioPlayer = memo(({ audioTrack }: { audioTrack: LocalAudioTrack | RemoteAudioTrack }) => {
  const audioRef = useRef<HTMLDivElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Defensive: ensure we have a valid track
    if (!audioTrack) {
      console.log('[LiveKitAudioPlayer] No audio track');
      return;
    }

    try {
      // LiveKit uses attach() instead of play() for audio
      const audioElement = audioTrack.attach();
      audioElementRef.current = audioElement;
      document.body.appendChild(audioElement);
      console.log('[LiveKitAudioPlayer] Audio attached');
    } catch (err) {
      console.error('[LiveKitAudioPlayer] Failed to attach audio:', err);
    }

    return () => {
      try {
        if (audioElementRef.current) {
          audioTrack.detach();
          audioElementRef.current = null;
        }
      } catch (err) {
        console.warn('[LiveKitAudioPlayer] Error stopping audio:', err);
      }
    };
  }, [audioTrack]);

  return <div ref={audioRef}></div>;
});

LiveKitAudioPlayer.displayName = 'LiveKitAudioPlayer';

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
  localTracks,
  remoteUsers,
  localUserId,
  toggleCamera,
  toggleMicrophone,
  userIdToLiveKitIdentity = {},
  onGetUserPositions,
  streamStatus,
  boxCount: boxCountProp,
  battleState,
  supporters = new Map(),
  onPickSide,
  joinWindowOpen = false,
  userTeam,
  remainingTime = 0,
  shouldShowSidePicker = false,
  onBattleGift,
  enableStreamSwipe = false,
  canSwipe = true,
  onSwipeUp,
  onSwipeDown,
  onAddBox,
  onRemoveBox,
  onToggleRgb,
  hasRgbEffect = false,
  canEditBoxes = false,
}: BroadcastGridProps) {
  const { profile } = useAuthStore();
  
  // Log when stream changes to debug updates
  const prevStreamRef = useRef(stream?.box_count);
  useEffect(() => {
    if (prevStreamRef.current !== stream?.box_count) {
      console.log('[BroadcastGrid] Stream box_count changed:', prevStreamRef.current, '->', stream?.box_count);
      prevStreamRef.current = stream?.box_count;
    }
    
    // Log broadcaster balance updates for debugging real-time gift updates
    if (broadcasterProfile) {
      console.log('[BroadcastGrid] Broadcaster Profile Data:', {
        username: broadcasterProfile.username,
        troll_coins: broadcasterProfile.troll_coins,
        trollmonds: broadcasterProfile.trollmonds,
        battle_crowns: broadcasterProfile.battle_crowns,
        current_viewers: stream?.current_viewers,
        stream_id: stream?.id
      });
    }
  }, [stream?.box_count, stream?.current_viewers, stream?.id, broadcasterProfile?.troll_coins, broadcasterProfile?.trollmonds, broadcasterProfile?.battle_crowns]);
  
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const [showHostStats, setShowHostStats] = useState(false);
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [persistentGifts, setPersistentGifts] = useState<Map<string, PersistentGift[]>>(new Map());
  const [userReceivedGifts, setUserReceivedGifts] = useState<Record<string, number>>({});
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);

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
      // Get all user IDs currently in seats (both user_id and guest_id)
      const userIdsInStream: string[] = [];
      Object.values(seats).forEach((seat) => {
        if (seat?.user_id) userIdsInStream.push(seat.user_id);
        if (seat?.guest_id) userIdsInStream.push(seat.guest_id);
      });
      
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
  // Also include guest_ids for guests
  const userIds = useMemo(() => {
    const set = new Set<string>();
    if (stream.user_id) set.add(stream.user_id); // Always include host
    Object.values(seats).forEach((seat) => {
      if (seat?.user_id) set.add(seat.user_id);
      if (seat?.guest_id) set.add(seat.guest_id); // Add guest IDs
    });
    return Array.from(set);
  }, [stream.user_id, seats]);

  const attributes = useParticipantAttributes(userIds, stream.id);

  const getParticipantAndTracks = (userId: string | undefined) => {
    if (!userId) return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };

    let participant: RemoteParticipant | undefined;
    let videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
    let audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
    let isLocal = false;

    if (userId === localUserId) {
      // Local user - use the localTracks from props
      isLocal = true;
      // Handle null localTracks
      audioTrack = localTracks?.[0];
      videoTrack = localTracks?.[1];
      console.log('[BroadcastGrid] Local user tracks for', userId?.substring(0, 8), ':', {
        hasVideoTrack: !!videoTrack,
        hasAudioTrack: !!audioTrack,
        localTracksLength: localTracks?.length ?? 0,
        localTracks0: localTracks?.[0]?.constructor?.name,
        localTracks1: localTracks?.[1]?.constructor?.name,
        videoTrackId: videoTrack?.getTrackId?.(),
        videoEnabled: (videoTrack as any)?.enabled,
      });
      // For local participant, we create a dummy participant object
      participant = {
        identity: localUserId,
        videoTrack,
        audioTrack,
      } as unknown as RemoteParticipant;
    } else {
      // Remote user - find in remoteUsers (which are RemoteParticipants)
      // Handle null/undefined remoteUsers
      if (!remoteUsers || !Array.isArray(remoteUsers)) {
        console.log('[BroadcastGrid] No remoteUsers available or not an array');
        return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };
      }
      
      // Try to find by matching identity
      participant = remoteUsers.find(u => u.identity === userId);
      
      if (!participant) {
        // Try to find by partial match (first 8 chars of UUID)
        participant = remoteUsers.find(u => {
          const identityStr = String(u.identity);
          return identityStr === userId || identityStr.substring(0, 8) === userId.replace(/-/g, '').substring(0, 8);
        });
      }

      if (participant) {
        // Get tracks from the LiveKit participant
        // LiveKit participants have trackPublications - use type assertion
        const videoPubs = (participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack; isSubscribed?: boolean }>) || new Map();
        const audioPubs = (participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack; isSubscribed?: boolean }>) || new Map();
        
        // Also check trackPublications directly on the participant
        // In LiveKit, tracks may be available even if isSubscribed isn't set yet
        const allVideoPubs = participant.trackPublications ? 
          Array.from((participant.trackPublications as any).values()) : [];
        const allAudioPubs = participant.trackPublications ? 
          Array.from((participant.trackPublications as any).values()) : [];
        
        // First try the standard way, prioritizing screen-share tracks
        let videoPub = Array.from(videoPubs?.values() || []).find(p => p.track && p.trackName === 'screen-share' && p.isSubscribed);
        if (!videoPub) {
          videoPub = Array.from(videoPubs?.values() || []).find(p => p.track && p.isSubscribed);
        }
        let audioPub = Array.from(audioPubs?.values() || []).find(p => p.track && p.isSubscribed);

        // If not found, try getting any track regardless of subscription status
        // Still prioritize screen-share
        if (!videoPub) {
          videoPub = Array.from(videoPubs?.values() || []).find(p => p.track && p.trackName === 'screen-share');
        }
        if (!videoPub) {
          videoPub = Array.from(videoPubs?.values() || []).find(p => p.track);
        }
        if (!audioPub) {
          audioPub = Array.from(audioPubs?.values() || []).find(p => p.track);
        }

        // Try from all trackPublications as fallback
        if (!videoPub) {
          videoPub = allVideoPubs.find((p: any) => p.track && p.trackName === 'screen-share' && p.kind === 'video');
        }
        if (!videoPub) {
          videoPub = allVideoPubs.find((p: any) => p.track && p.kind === 'video');
        }
        if (!audioPub) {
          audioPub = allAudioPubs.find((p: any) => p.track && p.kind === 'audio');
        }
        
        videoTrack = videoPub?.track;
        audioTrack = audioPub?.track;
        
        console.log('[BroadcastGrid] Remote user tracks:', {
          identity: participant.identity,
          hasVideoTrack: !!videoTrack,
          hasAudioTrack: !!audioTrack,
          videoTrackId: videoTrack?.getTrackId?.(),
          audioTrackId: audioTrack?.getTrackId?.(),
          videoPubsCount: videoPubs?.size || 0,
          allVideoPubsCount: allVideoPubs.length,
        });
      } else {
        console.log('[BroadcastGrid] No participant found for userId:', userId?.substring(0, 8), 'remoteUsers count:', remoteUsers.length);
      }
    }
    
    // Check if camera is on - for LiveKit, track exists means camera is on
    // For local users, check if track exists and is enabled
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
  // Also count seats with guest_id as occupied (for guest users)
  const seatKeys = Object.keys(seats);
  const occupiedSeatIndices = seatKeys
    .map(Number)
    .filter(idx => seats[idx]?.user_id || seats[idx]?.guest_id);
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

  const enforceSquareOnMobile = effectiveBoxCount > 1;
  const isSingleBoxLayout = effectiveBoxCount === 1;

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!enableStreamSwipe || !canSwipe || e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchCurrentYRef.current = e.touches[0].clientY;
    swipeLockedRef.current = false;
  }, [enableStreamSwipe, canSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!enableStreamSwipe || !canSwipe || touchStartYRef.current === null || swipeLockedRef.current) return;
    touchCurrentYRef.current = e.touches[0].clientY;
    const diffY = touchStartYRef.current - touchCurrentYRef.current;
    if (Math.abs(diffY) > 12) {
      e.preventDefault();
    }
  }, [enableStreamSwipe, canSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (!enableStreamSwipe || !canSwipe || touchStartYRef.current === null || touchCurrentYRef.current === null || swipeLockedRef.current) {
      touchStartYRef.current = null;
      touchCurrentYRef.current = null;
      return;
    }

    const diffY = touchStartYRef.current - touchCurrentYRef.current;
    const threshold = 90;

    if (Math.abs(diffY) >= threshold) {
      swipeLockedRef.current = true;
      if (diffY > 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }

    touchStartYRef.current = null;
    touchCurrentYRef.current = null;
  }, [enableStreamSwipe, canSwipe, onSwipeDown, onSwipeUp]);

  return (
    <div
      className={cn(
        'grid gap-2 w-full p-2 pb-20 min-w-0 overflow-hidden max-w-full md:h-full',
        isSingleBoxLayout ? 'h-full grid-cols-1 grid-rows-1 auto-rows-fr items-stretch content-stretch' : 'content-start auto-rows-max',
        effectiveBoxCount === 1 && 'md:grid-rows-1',
        effectiveBoxCount === 2 && 'grid-cols-2 md:grid-rows-1',
        effectiveBoxCount === 3 && 'grid-cols-2 md:grid-rows-2',
        effectiveBoxCount === 4 && 'grid-cols-2 md:grid-rows-2',
        effectiveBoxCount === 5 && 'grid-cols-3 md:grid-rows-2',
        effectiveBoxCount === 6 && 'grid-cols-3 md:grid-rows-2'
      )}
      style={enableStreamSwipe && canSwipe ? { touchAction: 'none' } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Battle Score Display with Timer */}
      {battleState?.active && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
          {/* Timer */}
          <div className={`px-4 py-1.5 rounded-full font-bold text-sm ${
            battleState.suddenDeath 
              ? 'bg-red-600 text-white animate-pulse' 
              : 'bg-black/80 text-white border border-white/20'
          }`}>
            {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
            {battleState.suddenDeath && ' - SUDDEN DEATH!'}
          </div>
          
          {/* Score - Broadcaster=RED, Challenger=BLUE */}
          <div className="flex items-center gap-6 bg-black/80 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
            <button 
              onClick={() => onBattleGift?.('broadcaster', 1)}
              className="flex items-center gap-2 hover:bg-red-500/20 px-2 py-1 rounded transition-colors"
            >
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-bold text-lg">{battleState.broadcasterScore}</span>
            </button>
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs uppercase tracking-wider">VS</span>
            </div>
            <button 
              onClick={() => onBattleGift?.('challenger', 1)}
              className="flex items-center gap-2 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
            >
              <span className="text-blue-400 font-bold text-lg">{battleState.challengerScore}</span>
              <Swords className="w-5 h-5 text-blue-400" />
            </button>
          </div>
        </div>
      )}
        {boxes.map((seatIndex) => {
          const seat = seats[seatIndex];
          // Use guest_id if user_id is null (for guest users)
          let userId = seat?.user_id || seat?.guest_id;

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
              remoteUsersCount: remoteUsers?.length ?? 0 
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

          // Battle mode team highlighting
          const userSupporter = userId ? supporters.get(userId) : null;
          const isBroadcasterSide = userSupporter?.team === 'broadcaster' || (seatIndex === 0 && isStreamHost);
          const isChallengerSide = userSupporter?.team === 'challenger';

          const boxClass = cn(
            baseBoxClass,
            hasGold && 'border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]',
            !hasGold && (hasRgbProfile || hasStreamRgb) && 'rgb-box',
            // Battle mode: Broadcaster=RED, Challenger=BLUE
            battleState?.active && isBroadcasterSide && 'border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]',
            battleState?.active && isChallengerSide && 'border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
            battleState?.suddenDeath && 'animate-pulse'
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
              className={cn(
                boxClass,
                isSingleBoxLayout && 'h-full min-h-[min(60vw,22rem)] md:min-h-0',
                enforceSquareOnMobile && 'aspect-square self-start md:aspect-auto md:self-stretch'
              )}
              onClick={() => {
                if (isStreamHost && seatIndex === 0 && isHost) {
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
                <LiveKitVideoPlayer
                  videoTrack={videoTrack}
                  isLocal={true}
                />
              ) : videoTrack && isCamOn ? (
                <LiveKitVideoPlayer
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
                      className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white/20"
                    />
                    {!isMicOn && (
                      <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                        <MicOff size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                  <span className="mt-2 text-[11px] md:text-xs text-zinc-400 flex items-center gap-1">
                    <VideoOff size={10} className="md:w-[10px] md:h-[10px]" />
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

              {audioTrack && !isLocal && <LiveKitAudioPlayer audioTrack={audioTrack} />}

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
                      {(() => {
                        // Get price for this specific seat - supports per-box pricing
                        const seatPrices = stream.seat_prices;
                        const price = seatPrices && seatPrices.length > seatIndex 
                          ? seatPrices[seatIndex] 
                          : (typeof seatPriceOverride === 'number' ? seatPriceOverride : stream.seat_price);
                        
                        if (price > 0) {
                          return (
                            <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full mt-2 border border-yellow-500/30 transition-none">
                              <Coins size={12} className="text-yellow-500" />
                              <span className="text-xs font-bold text-yellow-400">
                                {price}
                              </span>
                            </div>
                          );
                        }
                        // Show "FREE" badge when price is 0
                        return (
                          <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full mt-2 border border-green-500/30 transition-none">
                            <span className="text-[10px] font-bold text-green-400">FREE</span>
                          </div>
                        );
                      })()}
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
                <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 md:gap-2 max-w-[82%] md:max-w-[85%] z-10 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 md:gap-2 shadow-lg">
                    <div className="flex flex-col min-w-0">
                      <div className="text-white text-[11px] md:text-sm font-bold truncate flex items-center gap-1 md:gap-2">
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
                          
                          {battleState?.active && (
                            <>
                              {isBroadcasterSide && (
                                <span className="text-[8px] md:text-[9px] bg-red-600 px-1 md:px-1.5 rounded text-white font-bold uppercase tracking-wider">
                                  BROADCASTER
                                </span>
                              )}
                              {isChallengerSide && (
                                <span className="text-[8px] md:text-[9px] bg-blue-600 px-1 md:px-1.5 rounded text-white font-bold uppercase tracking-wider">
                                  CHALLENGER
                                </span>
                              )}
                            </>
                          )}
                          {isStreamHost && !battleState?.active && (
                              <span className="text-[8px] md:text-[9px] bg-red-600 px-1 rounded text-white font-bold uppercase tracking-wider">
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
                      className="bg-red-500/90 p-1 md:p-1.5 rounded-full backdrop-blur-md shadow-sm animate-in zoom-in duration-200"
                      title="Mic Muted"
                    >
                        <MicOff size={12} className="text-white md:w-[14px] md:h-[14px]" />
                    </div>
                  )}
                </div>
              )}

              {/* Coin Balance in Top Right - with Crowns */}
              {userId && (
                <div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-yellow-500/30 flex items-center gap-1 md:gap-2 shadow-lg">
                    <Crown size={10} className="text-amber-400 md:w-3 md:h-3" />
                    <span className="text-[11px] md:text-sm font-bold text-white">
                      {(displayProfile?.battle_crowns || 0).toLocaleString()}
                    </span>
                    <div className="w-px h-3 md:h-4 bg-white/20" />
                    <Gem size={10} className="text-purple-400 md:w-3 md:h-3" />
                    <span className="text-[11px] md:text-sm font-bold text-white">
                      {(displayProfile?.trollmonds || 0).toLocaleString()}
                    </span>
                    <div className="w-px h-3 md:h-4 bg-white/20" />
                    <Coins size={10} className="text-yellow-400 md:w-3 md:h-3" />
                    <span className="text-[11px] md:text-sm font-bold text-white">
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

              {/* Host-only side orbs inside broadcaster box (box 0) */}
              {seatIndex === 0 && isHost && canEditBoxes && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddBox?.(); }}
                      disabled={!onAddBox}
                      className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all bg-black/40 border-white/10 text-white/50 hover:text-white"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-[7px] text-slate-500 font-medium leading-none">+</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveBox?.(); }}
                      disabled={!onRemoveBox}
                      className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all bg-black/40 border-white/10 text-white/50 hover:text-white"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-[7px] text-slate-500 font-medium leading-none">-</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleRgb?.(); }}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all",
                        hasRgbEffect
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                          : "bg-black/40 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      <Palette size={14} />
                    </button>
                    <span className="text-[7px] text-slate-500 font-medium leading-none">RGB</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-black text-white">{boxCountProp}</span>
                  </div>
                </div>
              )}
            </motion.div>
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

      {/* Battle Side Picker Overlay - for viewers not on a team yet */}
      {(joinWindowOpen || (!userTeam && battleState.active)) && shouldShowSidePicker && onPickSide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-zinc-900 border border-white/20 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl">
            <Swords className="w-12 h-12 text-yellow-500" />
            <h3 className="text-xl font-bold text-white">Pick a Side!</h3>
            <p className="text-zinc-400 text-sm text-center">Choose who to support in this battle</p>
            <div className="flex gap-4">
              <button
                onClick={() => onPickSide('broadcaster')}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all",
                  userTeam === 'broadcaster' 
                    ? "bg-blue-600 text-white" 
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/40"
                )}
              >
                <Shield className="w-5 h-5 inline mr-2" />
                Broadcaster
              </button>
              <button
                onClick={() => onPickSide('challenger')}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all",
                  userTeam === 'challenger' 
                    ? "bg-red-600 text-white" 
                    : "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/40"
                )}
              >
                <Swords className="w-5 h-5 inline mr-2" />
                Challenger
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
