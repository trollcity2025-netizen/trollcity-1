import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Room, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, LocalParticipant } from 'livekit-client'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useStreamStore } from '../../lib/streamStore'
import { PreflightStore } from '../../lib/preflightStore'
import { emitEvent } from '../../lib/events'
// import { useAnimationStore, type GiftType } from '../../lib/animationManager'

import { Stream } from '../../types/broadcast'
import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'


import ErrorBoundary from '../../components/ErrorBoundary'
import GiftersBubbleStrip from '../../components/broadcast/GiftersBubbleStrip'
import GiftBoxModal, { GiftTarget, GiftItem } from '../../components/broadcast/GiftBoxModal'
import GiftAnimationOverlay from '../../components/broadcast/GiftAnimationOverlay'
import PinnedProductOverlay from '../../components/broadcast/PinnedProductOverlay'
import PinProductModal from '../../components/broadcast/PinProductModal'
import { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { useBroadcastPinnedProducts } from '../../hooks/useBroadcastPinnedProducts'
import { useBoxCount } from '../../hooks/useBoxCount'
import { useBattleState } from '../../hooks/useBattleState'
import {
  getCategoryConfig,
  supportsBattles,
  getMatchingTerminology,
} from '../../config/broadcastCategories'
import ChallengeManager from '../../components/broadcast/ChallengeManager'

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStreamSeats } from '../../hooks/useStreamSeats'

function BroadcastPage() {
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { clearTracks, screenTrack } = useStreamStore()

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
  // INSTANT JOIN: Set isLoading to false initially to show content immediately
  // Stream data will load in background while user sees the page
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // INSTANT JOIN: Track if initial stream fetch is complete but don't block UI
  const [streamLoaded, setStreamLoaded] = useState(false)
  
  const [localTracks, setLocalTracks] = useState<[LocalAudioTrack, LocalVideoTrack] | null>(null)
  const localTracksRef = useRef<[LocalAudioTrack, LocalVideoTrack] | null>(null)

  useEffect(() => {
    localTracksRef.current = localTracks
  }, [localTracks])

  // Cleanup handler for page unload - ensures camera is turned off immediately when user closes browser
  useEffect(() => {
    const handleBeforeUnload = () => {
      const room = roomRef.current
      
      // Only disconnect if we're actually ending the stream/unloading
      // Don't stop tracks here as that could interfere with normal operation
      if (room) {
        try {
          room.disconnect().catch(() => {})
        } catch (e) {
          // Ignore
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isBattleMode, setIsBattleMode] = useState(false)
  const [canSwipe, setCanSwipe] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  const [battleData, setBattleData] = useState<any>(null)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  
  const hasJoinedRef = useRef(false)
  const roomRef = useRef<Room | null>(null)
  const anonymousViewerIdRef = useRef(`anon-viewer-${Math.random().toString(36).slice(2, 10)}`)
  const stageTouchStartYRef = useRef<number | null>(null)
  const stageTouchCurrentYRef = useRef<number | null>(null)
  
  // Debug: Log when remoteParticipants changes
  useEffect(() => {
    console.log('[BroadcastPage] remoteParticipants changed:', {
      count: remoteParticipants.size,
      participants: Array.from(remoteParticipants.keys())
    })
  }, [remoteParticipants])
  
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
  const [giftNameMap, setGiftNameMap] = useState<Record<string, string>>({})
  const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
  const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))
  const giftNameMapRef = useRef<Record<string, string>>({})
  // const playGiftAnimation = useAnimationStore((state) => state.playGiftAnimation)

  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  useEffect(() => {
    giftNameMapRef.current = giftNameMap;
  }, [giftNameMap]);

  const processGiftEvent = useCallback((giftData: any) => {
    console.log('[BroadcastPage] processGiftEvent hit', {giftData});
    if (!giftData) {
      console.log('[BroadcastPage] ⚠️ processGiftEvent: giftData is null/undefined');
      return;
    }

    const giftId = giftData.id || `gift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const incomingStreamId = giftData.streamId || giftData.stream_id;
    console.log('[BroadcastPage] ✅ Processing gift', { giftId, incomingStreamId, currentStreamId: streamId });
    
    if (incomingStreamId && incomingStreamId !== streamId) {
      console.log('[BroadcastPage] ⚠️ Stream ID mismatch, skipping gift:', { incomingStreamId, currentStreamId: streamId });
      return;
    }

    const newGift: BroadcastGift = {
      id: giftId,
      gift_id: giftData.gift_id,
      gift_name: giftData.gift_name,
      gift_icon: giftData.gift_icon || '🎁',
      animation_type: giftData.animation_type,
      amount: giftData.amount,
      quantity: giftData.quantity || 1,
      sender_id: giftData.sender_id,
      sender_name: giftData.sender_name || 'Someone',
      receiver_id: giftData.receiver_id,
      created_at: giftData.timestamp || new Date().toISOString(),
    };

    setRecentGifts((prev) => {
      if (prev.some((g) => g.id === giftId)) {
        console.log('[BroadcastPage] 📌 Gift already in queue (dedupe), skipping:', giftId);
        return prev;
      }
      const updated = [...prev, newGift].slice(-20);
      console.log('[BroadcastPage] ✅ Added gift to queue, now:', updated.length, 'gifts');
      return updated;
    });

    const missingIds = [giftData.sender_id, giftData.receiver_id].filter(
      (id): id is string => !!id && !giftNameMapRef.current[id]
    );

    if (missingIds.length > 0) {
      supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', Array.from(new Set(missingIds)))
        .then(({ data }) => {
          if (!data || data.length === 0) return;

          const resolved = Object.fromEntries(
            data
              .filter((row: any) => row?.id && row?.username)
              .map((row: any) => [row.id, row.username])
          );

          if (Object.keys(resolved).length === 0) return;

          setGiftNameMap((prev) => ({ ...prev, ...resolved }));
          setRecentGifts((prev) =>
            prev.map((gift) =>
              gift.id === giftId
                ? {
                    ...gift,
                    sender_name: gift.sender_name === 'Someone' ? (resolved[gift.sender_id] || gift.sender_name) : gift.sender_name,
                    receiver_name: !gift.receiver_name ? resolved[gift.receiver_id] : gift.receiver_name,
                  }
                : gift
            )
          );
        })
        .catch((err) => {
          console.warn('[BroadcastPage] Failed to resolve gift usernames:', err);
        });
    }

    // Start animation via centralized store; all participants should see this.
    try {
      // Temporarily comment out to debug hook error
      // const broadcastGiftType: GiftType = (giftData.gift_name || '').toLowerCase().includes('rose') ? 'rose' :
      //   (giftData.gift_name || '').toLowerCase().includes('heart') ? 'heart' :
      //   (giftData.gift_name || '').toLowerCase().includes('diamond') ? 'diamond' :
      //   (giftData.gift_name || '').toLowerCase().includes('crown') ? 'crown' :
      //   (giftData.gift_name || '').toLowerCase().includes('car') ? 'car' :
      //   (giftData.gift_name || '').toLowerCase().includes('house') ? 'house' :
      //   (giftData.gift_name || '').toLowerCase().includes('rocket') ? 'rocket' :
      //   (giftData.gift_name || '').toLowerCase().includes('dragon') ? 'dragon' :
      //   (giftData.gift_name || '').toLowerCase().includes('star') ? 'star' :
      //   (giftData.gift_name || '').toLowerCase().includes('trophy') ? 'trophy' :
      //   (giftData.gift_name || '').toLowerCase().includes('coffee') ? 'coffee' :
      //   (giftData.gift_name || '').toLowerCase().includes('pizza') ? 'pizza' : 'heart';

      // playGiftAnimation({
      //   type: broadcastGiftType,
      //   senderName: giftData.sender_name || 'Someone',
      //   senderAvatar: undefined,
      //   receiverName: giftData.receiver_name || 'Broadcast',
      //   amount: giftData.quantity || 1,
      // });
    } catch (err) {
      console.error('[BroadcastPage] playGiftAnimation failed:', err);
    }

    if (giftData.receiver_id === streamRef.current?.user_id && broadcasterProfileRef.current) {
      const giftAmount = Math.floor((giftData.amount || 0) * 0.95);
      const newBalance = (broadcasterProfileRef.current.troll_coins || 0) + giftAmount;
      setBroadcasterProfile({ ...broadcasterProfileRef.current, troll_coins: newBalance });
    }

    window.dispatchEvent(new CustomEvent('broadcast-balance-update', {
      detail: {
        senderId: giftData.sender_id,
        receiverId: giftData.receiver_id,
        amount: giftData.amount,
        timestamp: Date.now(),
      }
    }));
  }, [streamId]);

  const stopLocalTracks = useCallback(() => {
    if (localTracks) {
      localTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('Error stopping track:', e)
          }
        }
      })
      setLocalTracks(null)
    }

    const room = roomRef.current
    if (room) {
      room.disconnect().catch(console.error)
    }

    clearTracks()
  }, [localTracks, clearTracks])

  const refreshStream = useCallback(async () => {
    if (!streamId) return
    const { data, error } = await supabase
      .from('streams')
      .select('*, total_likes')
      .eq('id', streamId)
      .single()
    
    if (error) {
      console.error('Refresh error:', error)
      return
    }
    
    setStream(data)
  }, [streamId, supabase])

  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)
  const [hasPendingChallenge, setHasPendingChallenge] = useState(false)

  // Direct send challenge - no popup
  const handleDirectChallenge = async () => {
    if (!user || !streamId || isHost) return;
    
    try {
      // Get user profile for username
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, battle_crowns')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!profileData?.username) {
        toast.error('Please set a username in your profile first');
        return;
      }
      
      // Check if there's already a pending challenge
      const { data: existingChallenge } = await supabase
        .from('broadcast_challenges')
        .select('id, status')
        .eq('stream_id', streamId)
        .eq('challenger_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingChallenge) {
        toast.error('You already have a pending challenge');
        return;
      }

      // Check if broadcaster is in battle
      const { data: activeBattle } = await supabase
        .from('battles')
        .select('id, status')
        .eq('opponent_id', stream?.user_id)
        .eq('status', 'active')
        .maybeSingle();

      if (activeBattle) {
        toast.error('Broadcaster is currently in a battle');
        return;
      }

      // Create challenge
      const { data, error } = await supabase
        .from('broadcast_challenges')
        .insert({
          stream_id: streamId,
          challenger_id: user.id,
          challenger_username: profileData.username,
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Notify via realtime
      const streamChannel = supabase.channel(`chat-challenges-${streamId}`);
      await streamChannel.subscribe();
      await streamChannel.send({
        type: 'broadcast',
        event: 'new_challenge',
        payload: {
          challenge_id: data.id,
          challenger_id: user.id,
          challenger_username: profileData.username,
          challenger_avatar: profileData.avatar_url,
          challenger_crowns: profileData.battle_crowns || 0,
          stream_id: streamId,
          expires_at: data.expires_at,
          timestamp: new Date().toISOString()
        }
      });

      toast.success('Challenge sent!');
      setHasPendingChallenge(true);
      setTimeout(() => setHasPendingChallenge(false), 5 * 60 * 1000);
    } catch (err) {
      console.error('Direct challenge error:', err);
      toast.error('Failed to send challenge');
    }
  };
  
  // State for incoming challenges (broadcaster view)
  const [incomingChallenges, setIncomingChallenges] = useState<any[]>([])
  
  // State for tracking outgoing challenge (for viewers who sent challenge)
  const [outgoingChallengeId, setOutgoingChallengeId] = useState<string | null>(null);
  const [pendingBattleId, setPendingBattleId] = useState<string | null>(null);

  // Handler for accepting a challenge
  const handleAcceptChallenge = useCallback(async (challengeId: string, challengerId: string) => {
    console.log('[BroadcastPage] Challenge accepted:', challengeId, challengerId);
    // Clear incoming challenges immediately
    setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== challengeId));
    
    // Show feedback that battle is starting
    toast.success('Challenge accepted! Battle starting...');
    
    // The battle mode will be activated via the database update
    // The existing useEffect for stream changes will detect is_battle=true and show BattleGridOverlay
  }, []);

  // Handler for denying a challenge
  const handleDenyChallenge = useCallback(async (challengeId: string) => {
    console.log('[BroadcastPage] Challenge denied:', challengeId);
    setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== challengeId));
  }, []);

  const isHost = stream?.user_id === user?.id

  // Set broadcast mode to disable TrollEngine when broadcasting
  useEffect(() => {
    if (isHost) {
      PreflightStore.setInBroadcast(true);
      console.log('[BroadcastPage] Broadcast mode enabled - TrollEngine disabled');
    }
    
    return () => {
      PreflightStore.setInBroadcast(false);
      console.log('[BroadcastPage] Broadcast mode disabled - TrollEngine enabled');
    };
  }, [isHost]);

  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)
  const broadcasterProfileRef = useRef(broadcasterProfile)

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  useEffect(() => {
    broadcasterProfileRef.current = broadcasterProfile
  }, [broadcasterProfile])

  const {
    boxCount,
    setBoxCount: updateBoxCount,
    incrementBoxCount,
    decrementBoxCount,
  } = useBoxCount({
    streamId: streamId || '',
    initialBoxCount: stream?.box_count || 1,
    isHost,
  });

  // Fetch incoming challenges for broadcaster
  useEffect(() => {
    if (!isHost || !streamId) return;

    const fetchChallenges = async () => {
      const { data } = await supabase
        .from('broadcast_challenges')
        .select('*')
        .eq('stream_id', streamId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        // Transform to ChallengeManager format
        const challenges = data.map(c => ({
          challenge_id: c.id,
          challenger_id: c.challenger_id,
          challenger_username: c.challenger_username,
          challenger_avatar: c.challenger_avatar,
          challenger_crowns: c.challenger_crowns || 0,
          stream_id: c.stream_id,
          expires_at: c.expires_at
        }));
        setIncomingChallenges(challenges);
      }
    };

    fetchChallenges();

    // Subscribe to new challenges
    const challengesChannel = supabase
      .channel(`broadcast-challenges:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_challenges',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new && payload.new.status === 'pending') {
            const newChallenge = {
              challenge_id: payload.new.id,
              challenger_id: payload.new.challenger_id,
              challenger_username: payload.new.challenger_username,
              challenger_avatar: payload.new.challenger_avatar,
              challenger_crowns: payload.new.challenger_crowns || 0,
              stream_id: payload.new.stream_id,
              expires_at: payload.new.expires_at
            };
            setIncomingChallenges(prev => [newChallenge, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcast_challenges',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          // Remove challenges that are no longer pending
          if (payload.new && payload.new.status !== 'pending') {
            setIncomingChallenges(prev => prev.filter(c => c.challenge_id !== payload.new.id));
          }
        }
      )
      .subscribe();

    // Poll for new challenges every 10 seconds
    const pollInterval = setInterval(fetchChallenges, 10000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(challengesChannel);
    };
  }, [isHost, streamId, supabase]);

  // For viewers: check if they have sent a challenge and listen for acceptance - AUTO JOIN
  // Uses joinSeat directly from the hook - will auto-trigger when challenge is accepted
  useEffect(() => {
    if (isHost || !user?.id || !streamId) return;

    // Check if user has an outgoing pending challenge
    const checkOutgoingChallenge = async () => {
      const { data } = await supabase
        .from('broadcast_challenges')
        .select('id, status, seat_index')
        .eq('challenger_id', user.id)
        .eq('stream_id', streamId)
        .eq('status', 'pending')
        .maybeSingle();

      if (data) {
        setOutgoingChallengeId(data.id);
      }
    };

    checkOutgoingChallenge();

    // Listen for challenge_accepted broadcast events - AUTO JOIN
    const challengeChannel = supabase.channel(`challenge-viewer-${streamId}`)
      .on(
        'broadcast',
        { event: 'challenge_accepted' },
        async (payload) => {
          const data = payload.payload;
          console.log('[BroadcastPage] Challenge accepted, auto-joining:', data);
          
          if (data.challenger_id === user.id && data.seat_index !== undefined) {
            // AUTO JOIN - no prompt!
            toast.message('Challenge accepted! Joining stage...');
            
            // Trigger a custom event that will be handled after components are mounted
            // This avoids the issue of using joinSeat before it's defined
            window.dispatchEvent(new CustomEvent('challenge-accepted', { 
              detail: { seatIndex: data.seat_index } 
            }));
          }
        }
      )
      .subscribe();

    // Also poll for challenge status if user has outgoing challenge - AUTO JOIN
    const pollChallengeStatus = async () => {
      if (!outgoingChallengeId) return;
      
      const { data: challenge } = await supabase
        .from('broadcast_challenges')
        .select('status, seat_index')
        .eq('id', outgoingChallengeId)
        .maybeSingle();

      if (challenge?.status === 'accepted' && challenge?.seat_index !== undefined) {
        console.log('[BroadcastPage] Challenge accepted via poll, auto-joining seat:', challenge.seat_index);
        toast.message('Challenge accepted! Joining stage...');
        
        // AUTO JOIN - no prompt!
        window.dispatchEvent(new CustomEvent('challenge-accepted', { 
          detail: { seatIndex: challenge.seat_index } 
        }));
      }
    };

    const pollInterval = setInterval(pollChallengeStatus, 3000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(challengeChannel);
    };
  }, [isHost, user?.id, streamId, supabase]);

  const { seats, mySession: userSeat, joinSeat, leaveSeat, handleParticipantDisconnected } =
    useStreamSeats(stream?.id, user?.id, broadcasterProfile, stream)

  // Battle state hook - integrates with existing BroadcastGrid
  const { 
    battleState, 
    supporters, 
    userTeam, 
    joinWindowOpen,
    remainingTime,
    startBattle, 
    pickSide, 
    endBattle,
    canGift: battleCanGift,
    sendBattleGift,
    shouldShowSidePicker 
  } = useBattleState({
    streamId: stream?.id || '',
    localUserId: user?.id || userSeat?.guest_id || '',
    isHost,
    hostId: stream?.user_id,
  });

  const canPublish = isHost || !!userSeat

  const justJoinedSeatRef = useRef(false);

  useEffect(() => {
    if (userSeat && justJoinedSeatRef.current) {
      justJoinedSeatRef.current = false
      hasJoinedRef.current = false
      setStream((prev: any) => prev ? { ...prev } : prev)
    }
  }, [userSeat])

  // Handle leaving seat with instant track cleanup
  const handleLeaveSeat = useCallback(async () => {
    const room = roomRef.current
    
    // Check if battle is active and user is on a team
    const isUserOnBroadcasterTeam = userSeat && (
      userSeat.user_id === stream.user_id || 
      supporters.get(userSeat.user_id || userSeat.guest_id || '')?.team === 'broadcaster'
    );
    const isUserOnChallengerTeam = userSeat && (
      userSeat.user_id === battleState.challengerId || 
      supporters.get(userSeat.user_id || userSeat.guest_id || '')?.team === 'challenger'
    );
    
    // If user leaves during battle, their team loses and other team gets 2 crowns each
    if (battleState.active && battleState.battleId && (isUserOnBroadcasterTeam || isUserOnChallengerTeam)) {
      const leavingTeam = isUserOnBroadcasterTeam ? 'broadcaster' : 'challenger';
      console.log(`[BattleState] User leaving during battle from ${leavingTeam} team - awarding win to other team`);
      
      // Call end battle with the other team as winner
      try {
        await supabase.rpc('end_battle_early', {
          p_battle_id: battleState.battleId,
          p_leaving_team: leavingTeam,
        });
      } catch (err) {
        console.error('[BattleState] Error ending battle early:', err);
      }
    }
    
    // Instantly stop publishing tracks before clearing seat
    if (room && room.localParticipant) {
      try {
        // Unpublish all tracks instantly - this removes them from other participants immediately
        for (const pub of room.localParticipant.videoTrackPublications.values()) {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
          }
        }
        for (const pub of room.localParticipant.audioTrackPublications.values()) {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
          }
        }
        console.log('[BroadcastPage] Unpublished all tracks for leaving seat')
      } catch (e) {
        console.warn('Error unpublishing tracks on leave:', e)
      }
    }
    
    // Stop local tracks immediately
    if (localTracks) {
      localTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('Error stopping track on leave:', e)
          }
        }
      })
      setLocalTracks(null)
    }
    
    // Call the seat leave function
    await leaveSeat()
    console.log('[BroadcastPage] Left seat with instant track cleanup')
  }, [leaveSeat, localTracks, battleState, userSeat, stream, supporters])

  const handleJoinSeat = useCallback(async (index: number, price: number) => {
    justJoinedSeatRef.current = true
    return joinSeat(index, price)
  }, [joinSeat])

  // Listen for challenge-accepted event to auto-join seat
  useEffect(() => {
    const handleChallengeAccepted = (e: Event) => {
      const customEvent = e as CustomEvent<{ seatIndex: number }>;
      const seatIndex = customEvent.detail?.seatIndex;
      if (seatIndex !== undefined) {
        console.log('[BroadcastPage] Handling challenge-accepted event, seat:', seatIndex);
        toast.message('Joining stage...');
        handleJoinSeat(seatIndex, 0).then(success => {
          if (success) {
            toast.success('You are now live on stage!');
          }
        });
      }
    };

    window.addEventListener('challenge-accepted', handleChallengeAccepted);
    return () => window.removeEventListener('challenge-accepted', handleChallengeAccepted);
  }, [handleJoinSeat]);

  const getSeatPrice = useCallback((seatIndex: number): number => {
    if (stream?.seat_prices && stream.seat_prices.length > seatIndex) {
      return stream.seat_prices[seatIndex]
    }
    return stream?.seat_price || 0
  }, [stream?.seat_prices, stream?.seat_price])

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setStreamLoaded(true)
      return
    }

    const fetchStream = async () => {
      // INSTANT JOIN: Set streamLoaded to false temporarily to show loading in header only
      setStreamLoaded(false)
      
      // OPTIMIZED: Fetch stream and profile in PARALLEL for faster loading
      const [streamResult, profileResult] = await Promise.all([
        supabase
          .from('streams')
          .select('*, total_likes, hls_url, is_battle, battle_id')
          .eq('id', streamId)
          .maybeSingle(),
        // We'll get profile after we know the stream's user_id
        Promise.resolve(null)
      ])

      const { data, error } = streamResult

      if (error || !data) {
        setError('Stream not found.')
        toast.error('Stream not found.')
        navigate('/')
        return
      }

      setStream(data)
      
      // Fetch profile in parallel with other operations
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user_id)
        .single()
      
      if (profileData) {
        setBroadcasterProfile(profileData)
        if (data.user_id === user?.id) {
          setHostMicMutedByOfficer(!!profileData.broadcast_mic_muted)
        }
      }

      setStreamLoaded(true)

      if (data.status === 'ended') {
        stopLocalTracks()
        navigate(`/broadcast/summary/${streamId}`)
      }

      // INSTANT JOIN: Don't set isLoading - let page render immediately
      // Only use isLoading for critical errors, not for data fetching
    }

    fetchStream()
  }, [streamId, navigate, user?.id])

  // Fetch battle data when stream enters battle mode
  useEffect(() => {
    // Only fetch if we don't have battle data yet and we have the necessary info
    if (!stream?.is_battle || !stream.battle_id) {
      return;
    }
    
    // Skip if we already have data for this battle
    if (battleData && battleData.id === stream.battle_id) {
      return;
    }

    setIsBattleLoading(true);
    const fetchBattleData = async () => {
      try {
        const { data, error } = await supabase
          .from('battles')
          .select('*')
          .eq('id', stream.battle_id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching battle data:', error);
          return;
        }
        
        if (data) {
          // Also fetch the stream user IDs for both challengers
          const [challengerStream, opponentStream] = await Promise.all([
            supabase.from('streams').select('user_id').eq('id', data.challenger_stream_id).maybeSingle(),
            supabase.from('streams').select('user_id').eq('id', data.opponent_stream_id).maybeSingle(),
          ]);
          
          // Add user IDs to battle data
          setBattleData({
            ...data,
            challenger_user_id: challengerStream?.data?.user_id,
            opponent_user_id: opponentStream?.data?.user_id,
          });
        }
      } catch (err) {
        console.error('Error in battle data fetch:', err);
      } finally {
        setIsBattleLoading(false);
      }
    };

    fetchBattleData();
  }, [stream?.is_battle, stream?.battle_id]);

  // Emit stream_watch_time events for troll system
  useEffect(() => {
    if (!streamId || !user?.id) return;

    // Emit initial watch event
    emitEvent('stream_watch_time', user.id, { streamId, watchTime: 0 });

    // Track watch time and emit events periodically
    let watchTime = 0;
    const watchInterval = setInterval(() => {
      watchTime += 30; // Increment by 30 seconds
      emitEvent('stream_watch_time', user.id, { streamId, watchTime });
    }, 30000); // Every 30 seconds

    return () => clearInterval(watchInterval);
  }, [streamId, user?.id]);

  useEffect(() => {
    if (!isHost || !stream?.user_id) return;

    const moderationChannel = supabase
      .channel(`host-moderation:${stream.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${stream.user_id}`
        },
        async (payload: any) => {
          const muted = !!payload?.new?.broadcast_mic_muted;
          setHostMicMutedByOfficer(muted);

          if (muted && localTracks?.[0]?.enabled) {
            try {
              // LiveKit: use getMediaStreamTrack() and set enabled property
              const mediaTrack = localTracks[0].getMediaStreamTrack();
              if (mediaTrack) {
                mediaTrack.enabled = false;
              }
              toast.error('Host microphone was muted by officer control');
            } catch (err) {
              console.error('Failed to enforce host mic mute:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(moderationChannel);
    };
  }, [isHost, stream?.user_id, localTracks]);

  useEffect(() => {
    if (!streamId || !stream) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('hls_url, status, box_count, is_battle, battle_id, has_rgb_effect, are_seats_locked, total_likes, seat_price, current_viewers, total_gifts_coins')
          .eq('id', streamId)
          .single();
        
        if (error) {
          return;
        }

        // Handle battle mode transitions
        if (stream.is_battle === true && data.is_battle === false) {
          // Battle ended
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, is_battle: false, battle_id: null };
          });
          // Clear battle data when battle ends
          setBattleData(null);
          return;
        }
        
        if (stream.is_battle !== data.is_battle || stream.battle_id !== data.battle_id) {
          // Battle mode changed - update state
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, is_battle: data.is_battle, battle_id: data.battle_id };
          });
          
          // Clear battle data if no longer in battle mode
          if (!data.is_battle) {
            setBattleData(null);
          }
        }
        
        if (data?.box_count !== undefined && data.box_count !== streamRef.current?.box_count) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, box_count: data.box_count };
          });
        }
        
        if (data?.has_rgb_effect !== undefined && data.has_rgb_effect !== streamRef.current?.has_rgb_effect) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, has_rgb_effect: data.has_rgb_effect };
          });
        }
        
        if (data?.are_seats_locked !== undefined && data.are_seats_locked !== streamRef.current?.are_seats_locked) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, are_seats_locked: data.are_seats_locked };
          });
        }
        
        if (data?.total_likes !== undefined && data.total_likes !== streamRef.current?.total_likes) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: data.total_likes };
          });
        }
        
        if (data?.seat_price !== undefined && data.seat_price !== streamRef.current?.seat_price) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, seat_price: data.seat_price };
          });
        }
        
        if (data?.current_viewers !== undefined && data.current_viewers !== streamRef.current?.current_viewers) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, current_viewers: data.current_viewers };
          });
        }
        
        if (data?.total_gifts_coins !== undefined && data.total_gifts_coins !== streamRef.current?.total_gifts_coins) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_gifts_coins: data.total_gifts_coins };
          });
        }
        
        // Handle stream ended - redirect ALL users (host, guests, viewers) to summary
        if (data?.status === 'ended') {
          console.log('[BroadcastPage] Poll detected stream ended, redirecting to summary');
          clearInterval(pollInterval);
          stopLocalTracks();
          navigate(`/broadcast/summary/${streamId}`);
          return;
        }
      } catch (err) {
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [streamId, stream, isHost, supabase, navigate, stopLocalTracks]);

  useEffect(() => {
    console.log('[BroadcastPage] gift effect deps changed', {
      streamId,
      isHost,
      hasProfile: !!broadcasterProfile,
      remoteParticipantsCount: remoteParticipants.size,
      localTracksLength: localTracks?.length || 0,
    });

    if (!streamId) return;

    const channel = supabase.channel(`stream:${streamId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let totalUsers = 0;
        for (const [key, users] of Object.entries(state)) {
          totalUsers += (users as any[]).length;
        }
        setViewerCount(totalUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const state = channel.presenceState();
        let totalUsers = 0;
        for (const [key, users] of Object.entries(state)) {
          totalUsers += (users as any[]).length;
        }
        setViewerCount(totalUsers);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const state = channel.presenceState();
        let totalUsers = 0;
        for (const [key, users] of Object.entries(state)) {
          totalUsers += (users as any[]).length;
        }
        setViewerCount(totalUsers);
      });

    const streamSubscription = channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (!payload.new) return;
          
          if (streamRef.current &&
              streamRef.current.box_count === payload.new.box_count &&
              streamRef.current.has_rgb_effect === payload.new.has_rgb_effect) {
            return;
          }
          
          try {
            // Check if battle mode is changing
            const wasInBattleMode = streamRef.current?.is_battle;
            const isNowInBattleMode = payload.new.is_battle;
            const battleIdChanged = streamRef.current?.battle_id !== payload.new.battle_id;
            
            setStream((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                box_count: payload.new.box_count,
                has_rgb_effect: payload.new.has_rgb_effect,
                are_seats_locked: payload.new.are_seats_locked,
                total_likes: payload.new.total_likes,
                seat_price: payload.new.seat_price,
                status: payload.new.status,
                is_live: payload.new.is_live,
                current_viewers: payload.new.current_viewers,
                total_gifts_coins: payload.new.total_gifts_coins,
                is_battle: payload.new.is_battle,
                battle_id: payload.new.battle_id
              };
            });
            
            // Log battle mode change for debugging
            if ((!wasInBattleMode && isNowInBattleMode) || (battleIdChanged && isNowInBattleMode)) {
              console.log('[BroadcastPage] Battle mode activated via realtime:', {
                is_battle: payload.new.is_battle,
                battle_id: payload.new.battle_id
              });
            }
            
            // Handle stream ended - redirect ALL users (host, guests, viewers) to summary
            if (payload.new.status === 'ended') {
              console.log('[BroadcastPage] Realtime subscription detected stream ended, redirecting to summary');
              stopLocalTracks();
              setTimeout(() => {
                navigate(`/broadcast/summary/${streamId}`);
              }, 100);
            }
          } catch (err) {
            console.error('Error processing stream update:', err);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'box_count_changed' },
        (payload) => {
          try {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              setStream((prev: any) => {
                if (!prev) return prev;
                return { ...prev, box_count: boxData.box_count };
              });
            }
          } catch (err) {
            console.error('Error processing box_count_changed:', err);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          try {
            const giftData = payload.payload;
            console.log('[BroadcastPage] 🎁 GIFT RECEIVED via realtime:', giftData);
            processGiftEvent(giftData);
          } catch (err) {
            console.error('Error processing gift:', err);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          try {
            const likeData = payload.payload;
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 1;
              return { ...prev, total_likes: newTotal };
            });
          } catch (err) {
            console.error('Error processing like:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          
          channel.track({
            user_id: user?.id || 'viewer',
            username: profile?.username || user?.email || 'Viewer',
            is_host: isHost,
            online_at: new Date().toISOString(),
            avatar_url: profile?.avatar_url || ''
          }).catch(console.error);
        }
      });

    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now(), user_id: user?.id }
        }).catch(() => {});
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate, stopLocalTracks, user?.id, supabase, profile, processGiftEvent]);

  // Stable gift channel subscription - depends only on streamId
  useEffect(() => {
    if (!streamId) return;

    const channelName = `stream-gifts:${streamId}`;
    console.log('[BroadcastPage] 🎁 Creating new gift channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'gift_sent' }, ({ payload }) => {
        console.log('[BroadcastPage] 🎁 Gift event received:', payload);
        processGiftEvent(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[BroadcastPage] 🎁 Unified gift channel SUBSCRIBED:', channelName);
        } else {
          console.log('[BroadcastPage] ⚠️ Unified gift channel status:', channelName, status);
        }
      });

    return () => {
      console.log('[BroadcastPage] 🔄 Unsubscribing old gift channel:', channel.topic);
      supabase.removeChannel(channel);
    };
  }, [streamId, processGiftEvent]);

  useEffect(() => {
    if (!streamId) return;

    const channelName = `stream-gifts-db:${streamId}`;
    console.log('[BroadcastPage] Setting up DB gift fallback channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload: any) => {
          const giftRow = payload.new || {};
          console.log('[BroadcastPage] DB gift fallback received:', giftRow);

          processGiftEvent({
            id: giftRow.id,
            gift_id: giftRow.gift_id,
            gift_name: giftRow.metadata?.gift_name || giftRow.gift_name || 'Gift',
            gift_icon: giftRow.metadata?.gift_icon || '🎁',
            animation_type: giftRow.metadata?.animation_type || giftRow.animation_type,
            amount: giftRow.amount || giftRow.coins_spent || giftRow.metadata?.amount || 0,
            quantity: giftRow.quantity || giftRow.metadata?.quantity || 1,
            sender_id: giftRow.sender_id,
            sender_name: giftRow.metadata?.sender_name || 'Someone',
            receiver_id: giftRow.receiver_id || giftRow.recipient_id,
            receiver_name: giftRow.metadata?.receiver_name,
            stream_id: giftRow.stream_id,
            timestamp: giftRow.created_at,
          });
        }
      )
      .subscribe((status) => {
        console.log('[BroadcastPage] DB gift fallback status:', channelName, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, processGiftEvent]);

  useEffect(() => {
    if (recentGifts.length > 0) {
      console.log('[BroadcastPage] recentGifts state:', recentGifts.map((g) => ({ id: g.id, gift_name: g.gift_name, sender_id: g.sender_id, receiver_id: g.receiver_id })));
    }
    // Allow anonymous viewers to watch without authentication.
    // Only publishers still require a real user or guest seat identity.
    const hasUserIdentity = !isHost || !!user?.id || !!userSeat;
    
    if (!stream || !stream.id || !hasUserIdentity) {
      return;
    }

    if (hasJoinedRef.current) {
      return;
    }

    const shouldPublish = isHost || !!userSeat;
    
    // Determine the user identity for LiveKit
    // Use user.id for logged-in users, or guest_id from userSeat for guests
    const userIdentity = user?.id || userSeat?.guest_id || anonymousViewerIdRef.current;
    
    let mounted = true

    const initLiveKit = async () => {
      if (!shouldPublish) {
        // OPTIMIZED: Don't block UI - connect in background without isJoining state
        try {
          const viewerIdentity = `viewer-${userIdentity.substring(0, 12)}`
          // OPTIMIZED: Use parallel fetch for faster token get
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: {
              room: stream.id,
              identity: viewerIdentity,
              name: profile?.username || user?.email || userSeat?.user_profile?.username || 'Guest Viewer',
              role: 'audience',
              isHost: false
            }
          })

          if (error) throw error

          const room = new Room()
          roomRef.current = room

          // Set up event listeners
          room.on('participantConnected', (participant: RemoteParticipant) => {
            console.log('[BroadcastPage] Viewer: Participant connected:', participant.identity)
            setRemoteParticipants(prev => new Map(prev).set(participant.identity, participant))
          })

          room.on('participantDisconnected', (participant: RemoteParticipant) => {
            console.log('[BroadcastPage] Viewer: Participant disconnected:', participant.identity)
            setRemoteParticipants(prev => {
              const next = new Map(prev)
              next.delete(participant.identity)
              return next
            })
            // Instantly remove the seat for this participant
            handleParticipantDisconnected(participant.identity)
          })

          // Listen for track subscription to display remote video
          room.on('trackSubscribed', (track, publication, participant) => {
            console.log('[BroadcastPage] Viewer: Track subscribed:', track.kind, 'from', participant.identity)
            // Update state to show the participant with their tracks
            setRemoteParticipants(prev => {
              const next = new Map(prev)
              // Store by full identity
              if (!next.has(participant.identity)) {
                console.log('[BroadcastPage] Viewer: Adding new participant to remoteParticipants:', participant.identity)
                next.set(participant.identity, participant)
              } else {
                // Update existing participant to include the new track
                next.set(participant.identity, participant)
              }
              return next
            })
          })

          // Also listen for trackUnsubscribed to clean up
          room.on('trackUnsubscribed', (track, publication, participant) => {
            console.log('[BroadcastPage] Viewer: Track unsubscribed:', track.kind, 'from', participant.identity)
            // Check if participant has any remaining tracks
            const remainingVideo = Array.from((participant.videoTrackPublications as any)?.values() || []).some((p: any) => p.track)
            const remainingAudio = Array.from((participant.audioTrackPublications as any)?.values() || []).some((p: any) => p.track)
            
            // Only remove participant if they have no remaining tracks
            if (!remainingVideo && !remainingAudio) {
              setRemoteParticipants(prev => {
                const next = new Map(prev)
                next.delete(participant.identity)
                return next
              })
            }
          })

          await room.connect(
            import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
            data.token
          )

          // Get existing participants who were already in the room
          if (room.participants) {
            const existingParticipants = Array.from(room.participants.values()) as RemoteParticipant[]
            console.log('[BroadcastPage] Viewer: Found existing participants:', existingParticipants.length, existingParticipants.map((p: RemoteParticipant) => p.identity))
            // Build a new Map with all existing participants
            const newParticipantsMap = new Map<string, RemoteParticipant>()
            existingParticipants.forEach((participant: RemoteParticipant) => {
              newParticipantsMap.set(participant.identity, participant)
              console.log('[BroadcastPage] Viewer: Adding existing participant:', participant.identity)
            })
            // Set the Map in one go to avoid batching issues
            setRemoteParticipants(newParticipantsMap)
          } else {
            console.log('[BroadcastPage] Viewer: No existing participants (room.participants is undefined)')
          }

          hasJoinedRef.current = true
        } catch (err) {
          console.error('Viewer join error:', err)
        }
        // OPTIMIZED: Removed isJoining state update - no blocking UI
        return
      }

      // OPTIMIZED: Don't block UI - connect in background
      try {
        const hostIdentity = userIdentity
        // OPTIMIZED: Fetch token without waiting for UI
        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: {
            room: stream.id,
            identity: hostIdentity,
            name: profile?.username || user?.email || userSeat?.user_profile?.username || 'Host',
            role: 'publisher',
            isHost: true
          }
        })

        if (error) throw error

        const room = new Room()
        roomRef.current = room

        // Listen for local track events to update state
        room.on('trackSubscribed', (track, publication, participant) => {
          console.log('[BroadcastPage] Track subscribed:', {
            trackKind: track.kind,
            trackId: track.name,
            participantIdentity: participant.identity,
            isLocal: participant.identity === user.id
          })
          
          // Update local tracks when our own tracks are subscribed
          if (participant.identity === user.id) {
            if (track.kind === 'video') {
              setLocalTracks(prev => prev ? [prev[0], track as LocalVideoTrack] : [null, track as LocalVideoTrack])
            } else if (track.kind === 'audio') {
              setLocalTracks(prev => prev ? [track as LocalAudioTrack, prev[1]] : [track as LocalAudioTrack, null])
            }
          }
        })

        room.on('trackUnsubscribed', (track, publication, participant) => {
          console.log('[BroadcastPage] Track unsubscribed:', {
            trackKind: track.kind,
            participantIdentity: participant.identity
          })
          
          if (participant.identity === user.id) {
            if (track.kind === 'video') {
              setLocalTracks(prev => prev ? [prev[0], null] : [null, null])
            } else if (track.kind === 'audio') {
              setLocalTracks(prev => prev ? [null, prev[1]] : [null, null])
            }
          }
        })

        room.on('participantConnected', (participant: RemoteParticipant) => {
          setRemoteParticipants(prev => new Map(prev).set(participant.identity, participant))
        })

        room.on('participantDisconnected', (participant: RemoteParticipant) => {
          setRemoteParticipants(prev => {
            const next = new Map(prev)
            next.delete(participant.identity)
            return next
          })
          // Instantly remove the seat for this participant
          handleParticipantDisconnected(participant.identity)
        })

        await room.connect(
          import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
          data.token
        )

        // Check if we already have a LiveKit room from SetupPage via PreflightStore
        const existingRoom = PreflightStore.getLivekitRoom()
        const preflightTracks = PreflightStore.getLivekitTracks()
        
        if (existingRoom) {
          // Reuse the room from SetupPage - already connected with published tracks
          roomRef.current = existingRoom
          console.log('[BroadcastPage] Reusing LiveKit room from SetupPage')
          
          // Get track enabled states from PreflightStore to ensure tracks stay enabled
          const preflightEnabledStates = PreflightStore.getTrackEnabledStates()
          console.log('[BroadcastPage] Preflight enabled states:', preflightEnabledStates)
          
          // Get tracks from the existing room's local participant
          let videoTrack: LocalVideoTrack | undefined
          let audioTrack: LocalAudioTrack | undefined
          
          // First, try to get tracks from PreflightStore (stored by SetupPage)
          if (preflightTracks) {
            console.log('[BroadcastPage] Getting tracks from PreflightStore:', {
              hasAudio: !!preflightTracks[0],
              hasVideo: !!preflightTracks[1]
            })
            
            // Validate tracks are proper LiveKit track objects
            const validateTrack = (track: any, type: 'audio' | 'video'): { valid: boolean; track: any } => {
              if (!track) return { valid: false, track: null }
              
              // Check for required LiveKit track properties
              const hasGetTrackId = typeof track.getTrackId === 'function'
              const hasGetMediaStreamTrack = typeof track.getMediaStreamTrack === 'function'
              
              if (hasGetTrackId && hasGetMediaStreamTrack) {
                return { valid: true, track }
              }
              
              console.warn(`[BroadcastPage] ${type} track from PreflightStore is not valid`)
              return { valid: false, track: null }
            }
            
            const validatedAudio = validateTrack(preflightTracks[0], 'audio')
            const validatedVideo = validateTrack(preflightTracks[1], 'video')
            
            audioTrack = validatedAudio.valid ? validatedAudio.track : undefined
            videoTrack = validatedVideo.valid ? validatedVideo.track : undefined
          }
          
          // Also try from room's localParticipant as fallback
          if (!audioTrack || !videoTrack) {
            console.log('[BroadcastPage] Trying to get tracks from existing room localParticipant')
            for (const pub of existingRoom.localParticipant.videoTrackPublications.values()) {
              if (pub.track && pub.track.kind === 'video') {
                // Verify it's a proper LiveKit track
                if (pub.track && typeof (pub.track as any).getTrackId === 'function') {
                  videoTrack = pub.track as LocalVideoTrack
                  break
                }
              }
            }
            for (const pub of existingRoom.localParticipant.audioTrackPublications.values()) {
              if (pub.track && pub.track.kind === 'audio') {
                // Verify it's a proper LiveKit track
                if (pub.track && typeof (pub.track as any).getTrackId === 'function') {
                  audioTrack = pub.track as LocalAudioTrack
                  break
                }
              }
            }
          }
          
          console.log('[BroadcastPage] Tracks from existing room:', {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack,
            audioIsValid: audioTrack && typeof audioTrack.getTrackId === 'function',
            videoIsValid: videoTrack && typeof videoTrack.getTrackId === 'function'
          })
          
          // Ensure tracks are enabled based on PreflightStore state
          // This is critical - we must enable tracks that were enabled in SetupPage
          if (videoTrack && preflightEnabledStates.isVideoEnabled) {
            console.log('[BroadcastPage] Ensuring video track is enabled from existing room')
            try {
              const videoMediaTrack = videoTrack.getMediaStreamTrack()
              if (videoMediaTrack) {
                videoMediaTrack.enabled = true
              }
              if (typeof videoTrack.enable === 'function') {
                videoTrack.enable()
              }
            } catch (e) {
              console.warn('[BroadcastPage] Error enabling video track:', e)
            }
          }
          
          if (audioTrack && preflightEnabledStates.isAudioEnabled) {
            console.log('[BroadcastPage] Ensuring audio track is enabled from existing room')
            try {
              const audioMediaTrack = audioTrack.getMediaStreamTrack()
              if (audioMediaTrack) {
                audioMediaTrack.enabled = true
              }
              if (typeof audioTrack.enable === 'function') {
                audioTrack.enable()
              }
            } catch (e) {
              console.warn('[BroadcastPage] Error enabling audio track:', e)
            }
          }
          
          // Set local tracks state
          if (audioTrack || videoTrack) {
            setLocalTracks([audioTrack || null, videoTrack || null])
          }
          
          // Screen share mode: publish screen track from useStreamStore
          const isScreenShareExisting = PreflightStore.getScreenShareMode()
          const screenTrackExisting = PreflightStore.getScreenTrack() || screenTrack
          if (isScreenShareExisting && screenTrackExisting) {
            console.log('[BroadcastPage] Screen share mode (existing room) - publishing screen track')
            try {
              await existingRoom.localParticipant.publishTrack(screenTrackExisting)
              console.log('[BroadcastPage] Screen track published successfully (existing room)')
              setIsScreenSharing(true)
            } catch (err) {
              console.error('[BroadcastPage] Failed to publish screen track (existing room):', err)
            }
          }
          
          hasJoinedRef.current = true
          setIsJoining(false)
          
          // Update stream status
          await supabase
            .from('streams')
            .update({ is_live: true, status: 'live' })
            .eq('id', stream.id)
          
          return
        }
        
        // No existing room - create new one (for viewers or fallback)
        // Check for preflight tracks
        const preflightEnabledStates = PreflightStore.getTrackEnabledStates()
        let videoTrack: LocalVideoTrack | undefined
        let audioTrack: LocalAudioTrack | undefined
        
        console.log('[BroadcastPage] Preflight check:', {
          preflightTracksExists: !!preflightTracks,
          audioTrackExists: !!(preflightTracks && preflightTracks[0]),
          videoTrackExists: !!(preflightTracks && preflightTracks[1]),
          streamId: stream?.id,
          streamUserId: stream?.user_id,
          currentUserId: user?.id,
          isHost: isHost
        })
        
        // Handle partial tracks - if we have at least one track from PreflightStore, use it
        let shouldCreateNewTracks = false
        
        if (preflightTracks && (preflightTracks[0] || preflightTracks[1])) {
          // Use tracks from PreflightStore (created in SetupPage)
          // Do NOT call enableCameraAndMicrophone() - reuse existing tracks
          
          // Validate tracks are proper LiveKit track objects before using
          const validateTrack = (track: any, type: 'audio' | 'video'): { valid: boolean; track: any } => {
            if (!track) return { valid: false, track: null }
            // Check for required LiveKit track properties/methods
            const hasGetTrackId = typeof track.getTrackId === 'function'
            const hasGetMediaStreamTrack = typeof track.getMediaStreamTrack === 'function'
            const hasIsEnabled = 'isEnabled' in track
            const hasKind = 'kind' in track
            
            console.log(`[BroadcastPage] Validating ${type} track:`, { hasGetTrackId, hasGetMediaStreamTrack, hasIsEnabled, hasKind, trackType: track.constructor?.name })
            
            if (hasGetTrackId && hasGetMediaStreamTrack) {
              return { valid: true, track }
            }
            
            // If not a valid LiveKit track, return invalid
            console.warn(`[BroadcastPage] ${type} track is not a valid LiveKit track object`)
            return { valid: false, track: null }
          }
          
          const validatedAudio = validateTrack(preflightTracks[0], 'audio')
          const validatedVideo = validateTrack(preflightTracks[1], 'video')
          
          audioTrack = validatedAudio.valid ? validatedAudio.track : undefined
          videoTrack = validatedVideo.valid ? validatedVideo.track : undefined
          
          // If EITHER track is invalid (was present but failed validation), we need to create new tracks for consistency
          const audioWasPresent = !!preflightTracks[0]
          const videoWasPresent = !!preflightTracks[1]
          const audioInvalid = audioWasPresent && !validatedAudio.valid
          const videoInvalid = videoWasPresent && !validatedVideo.valid
          
          if (audioInvalid || videoInvalid) {
            console.warn(`[BroadcastPage] Track validation failed - audioInvalid: ${audioInvalid}, videoInvalid: ${videoInvalid} - will create new tracks`)
            shouldCreateNewTracks = true
            audioTrack = undefined
            videoTrack = undefined
          }
          
          console.log('[BroadcastPage] Using tracks from PreflightStore (SetupPage)', {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack,
            videoEnabled: videoTrack && 'isEnabled' in videoTrack ? videoTrack.isEnabled : undefined,
            audioEnabled: audioTrack && 'isEnabled' in audioTrack ? audioTrack.isEnabled : undefined,
            shouldCreateNewTracks
          })
          
          // Only publish if we have valid tracks and shouldn't create new ones
          if (!shouldCreateNewTracks) {
            // Ensure tracks are enabled based on SetupPage state BEFORE publishing
            // This is critical - we must enable tracks that were enabled in SetupPage
            // isEnabled being undefined means track is enabled (default state)
            const videoShouldBeEnabled = preflightEnabledStates.isVideoEnabled && videoTrack && (videoTrack.isEnabled === undefined || videoTrack.isEnabled === true)
            const audioShouldBeEnabled = preflightEnabledStates.isAudioEnabled && audioTrack && (audioTrack.isEnabled === undefined || audioTrack.isEnabled === true)
            
            if (videoShouldBeEnabled) {
              console.log('[BroadcastPage] Ensuring video track is enabled from PreflightStore state')
              // Check if it's a proper LiveKit track with getMediaStreamTrack method
              // OR has stop method (which indicates valid LiveKit track)
              if (videoTrack && (typeof videoTrack.getMediaStreamTrack === 'function' || typeof videoTrack.stop === 'function')) {
                // Try getMediaStreamTrack first, fall back to direct enable
                if (typeof videoTrack.getMediaStreamTrack === 'function') {
                  const videoMediaTrack = videoTrack.getMediaStreamTrack()
                  if (videoMediaTrack) {
                    videoMediaTrack.enabled = true
                  }
                } else if (typeof videoTrack.enable === 'function') {
                  // Fallback: use LiveKit's enable method
                  videoTrack.enable()
                }
              } else {
                console.warn('[BroadcastPage] videoTrack does not have getMediaStreamTrack method or is not a valid LiveKit track')
              }
            }
            if (audioShouldBeEnabled) {
              console.log('[BroadcastPage] Ensuring audio track is enabled from PreflightStore state')
              // Check if it's a proper LiveKit track with getMediaStreamTrack method
              // OR has stop method (which indicates valid LiveKit track)
              if (audioTrack && (typeof audioTrack.getMediaStreamTrack === 'function' || typeof audioTrack.stop === 'function')) {
                // Try getMediaStreamTrack first, fall back to direct enable
                if (typeof audioTrack.getMediaStreamTrack === 'function') {
                  const audioMediaTrack = audioTrack.getMediaStreamTrack()
                  if (audioMediaTrack) {
                    audioMediaTrack.enabled = true
                  }
                } else if (typeof audioTrack.enable === 'function') {
                  // Fallback: use LiveKit's enable method
                  audioTrack.enable()
                }
              } else {
                console.warn('[BroadcastPage] audioTrack does not have getMediaStreamTrack method or is not a valid LiveKit track')
              }
            }
            
            // Publish the existing tracks to the room
            // Note: Don't call setCameraEnabled/setMicrophoneEnabled as they may create new tracks
            if (audioTrack) {
              await room.localParticipant.publishTrack(audioTrack)
            }
            if (videoTrack) {
              await room.localParticipant.publishTrack(videoTrack)
            }
          }
        } else {
          // No tracks from PreflightStore - create new ones
          shouldCreateNewTracks = true
        }
        
        // Create new tracks if needed (either no PreflightStore tracks or invalid tracks)
        if (shouldCreateNewTracks) {
          console.log('[BroadcastPage] Creating new tracks (shouldCreateNewTracks=true)')
          // No tracks from PreflightStore - create new ones
          console.log('[BroadcastPage] No valid tracks available, enabling camera/mic')
          
          let tracksCreated = false
          
          try {
            // Enable camera and microphone with explicit options
            // Note: This creates AND publishes tracks automatically
            const devices = await navigator.mediaDevices.enumerateDevices()
            const hasCamera = devices.some(d => d.kind === 'videoinput')
            const hasMic = devices.some(d => d.kind === 'audioinput')
            
            console.log('[BroadcastPage] Device check:', { hasCamera, hasMic })
            
            if (!hasCamera && !hasMic) {
              console.warn('[BroadcastPage] No camera or microphone found')
              toast.error('No camera or microphone found')
            } else {
              await room.localParticipant.enableCameraAndMicrophone()
              console.log('[BroadcastPage] enableCameraAndMicrophone completed successfully')
              tracksCreated = true
            }
          } catch (err) {
            console.error('[BroadcastPage] Error enabling camera/mic:', err)
            toast.error('Failed to enable camera/microphone')
          }
          
          if (!tracksCreated) {
            // If enableCameraAndMicrophone failed, try manual creation
            console.log('[BroadcastPage] Trying manual track creation as fallback')
            try {
              const { createLocalTracks } = await import('livekit-client')
              const localTracks = await createLocalTracks({ audio: true, video: true })
              for (const track of localTracks) {
                await room.localParticipant.publishTrack(track)
              }
              console.log('[BroadcastPage] Manual track creation completed')
              tracksCreated = true
            } catch (manualErr) {
              console.error('[BroadcastPage] Manual track creation also failed:', manualErr)
            }
          }
          
          // OPTIMIZED: No delay - camera should appear immediately after track creation
          
          // Get tracks from room's local participant - check BOTH video AND audio publications
          // Note: Tracks are already published by enableCameraAndMicrophone()
          // NOTE: Remove 'let' to use outer scope variables, not shadow them
          videoTrack = undefined
          audioTrack = undefined
          
          console.log('[BroadcastPage] Video publications:', Array.from(room.localParticipant.videoTrackPublications.values()).map((p: any) => p.trackId))
          console.log('[BroadcastPage] Audio publications:', Array.from(room.localParticipant.audioTrackPublications.values()).map((p: any) => p.trackId))
          
          // Get video track
          for (const pub of room.localParticipant.videoTrackPublications.values()) {
            if (pub.track && pub.track.kind === 'video') {
              videoTrack = pub.track as LocalVideoTrack
              if (typeof videoTrack.getTrackId === 'function') {
                console.log('[BroadcastPage] Found video track:', videoTrack.getTrackId())
              } else {
                console.log('[BroadcastPage] Found video track but getTrackId not available')
              }
              break
            }
          }
          
          // Get audio track - must check audioTrackPublications!
          for (const pub of room.localParticipant.audioTrackPublications.values()) {
            if (pub.track && pub.track.kind === 'audio') {
              audioTrack = pub.track as LocalAudioTrack
              if (typeof audioTrack.getTrackId === 'function') {
                console.log('[BroadcastPage] Found audio track:', audioTrack.getTrackId())
              } else {
                console.log('[BroadcastPage] Found audio track but getTrackId not available')
              }
              break
            }
          }
          
          // If still no tracks, try to create them manually
          if (!videoTrack || !audioTrack) {
            console.warn('[BroadcastPage] No tracks found after enableCameraAndMicrophone(), trying manual creation')
            
            try {
              // Import createLocalTracks from livekit-client
              const { createLocalTracks } = await import('livekit-client')
              
              const devices = await navigator.mediaDevices.enumerateDevices()
              const hasCamera = devices.some(d => d.kind === 'videoinput')
              const hasMic = devices.some(d => d.kind === 'audioinput')
              
              console.log('[BroadcastPage] Available devices:', { hasCamera, hasMic })
              
              if (hasCamera || hasMic) {
                const localTracks = await createLocalTracks({
                  audio: hasMic,
                  video: hasCamera
                })
                
                for (const track of localTracks) {
                  await room.localParticipant.publishTrack(track)
                  if (track.kind === 'video') {
                    videoTrack = track as LocalVideoTrack
                  } else if (track.kind === 'audio') {
                    audioTrack = track as LocalAudioTrack
                  }
                }
                console.log('[BroadcastPage] Manually created tracks:', { hasAudio: !!audioTrack, hasVideo: !!videoTrack })
              }
            } catch (createErr) {
              console.error('[BroadcastPage] Error creating tracks manually:', createErr)
            }
          }
          
          console.log('[BroadcastPage] Final tracks from LiveKit room:', {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack,
            videoTrackId: (videoTrack && typeof videoTrack.getTrackId === 'function') ? videoTrack.getTrackId() : 'unknown',
            audioTrackId: (audioTrack && typeof audioTrack.getTrackId === 'function') ? audioTrack.getTrackId() : 'unknown',
            shouldCreateNewTracks
          })
        } else {
          console.log('[BroadcastPage] Not creating new tracks - using PreflightStore tracks')
        }

        // Update localTracks state - handle partial tracks (either audio OR video)
        // Don't require both tracks to be present
        if (audioTrack || videoTrack) {
          // Verify tracks are valid LiveKit track objects before calling methods
          const videoTrackId = (videoTrack && typeof videoTrack.getTrackId === 'function') ? videoTrack.getTrackId() : 'unknown'
          const audioTrackId = (audioTrack && typeof audioTrack.getTrackId === 'function') ? audioTrack.getTrackId() : 'unknown'
          
          console.log('[BroadcastPage] Setting localTracks state:', {
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack,
            videoTrackId,
            audioTrackId,
            videoEnabled: videoTrack?.isEnabled,
            audioEnabled: audioTrack?.isEnabled,
            roomRefCurrent: !!roomRef.current,
            roomIdentity: roomRef.current?.localParticipant?.identity
          })
          setLocalTracks([audioTrack || null, videoTrack || null])
        } else {
          console.warn('[BroadcastPage] No tracks created after enableCameraAndMicrophone()!')
        }

        // Only disable mic if hostMicMutedByOfficer is explicitly set (from database)
        // Don't auto-mute on initial join - let the user control their mic
        if (isHost && hostMicMutedByOfficer) {
          console.log('[BroadcastPage] hostMicMutedByOfficer is true - disabling mic')
          await room.localParticipant.setMicrophoneEnabled(false)
        } else {
          console.log('[BroadcastPage] hostMicMutedByOfficer is false or not host - enabling mic if not already')
          // Ensure mic is enabled if not muted
          if (!room.localParticipant.isMicrophoneEnabled) {
            await room.localParticipant.setMicrophoneEnabled(true)
          }
        }

        // CRITICAL: Ensure camera is enabled on initial join (similar to mic logic)
        // This is needed because track may exist but be disabled
        console.log('[BroadcastPage] Camera state on join:', {
          isCameraEnabled: room.localParticipant.isCameraEnabled,
          hasVideoTrack: !!videoTrack,
          preflightVideoEnabled: preflightEnabledStates?.isVideoEnabled
        })
        
        // If camera is not enabled but we have a video track, enable it
        // This ensures camera is on when joining broadcast
        if (!room.localParticipant.isCameraEnabled && (videoTrack || shouldCreateNewTracks)) {
          console.log('[BroadcastPage] Camera was off - enabling camera on join')
          try {
            await room.localParticipant.setCameraEnabled(true)
            console.log('[BroadcastPage] Camera enabled successfully')
          } catch (err) {
            console.error('[BroadcastPage] Failed to enable camera:', err)
          }
        } else if (room.localParticipant.isCameraEnabled) {
          console.log('[BroadcastPage] Camera is already enabled - good!')
        }

        // Gaming screen share: publish the screen track in addition to camera/mic
        if (PreflightStore.getScreenShareMode()) {
          const screenTrackToPublish = PreflightStore.getScreenTrack() || screenTrack
          if (screenTrackToPublish) {
            console.log('[BroadcastPage] Gaming screen share - publishing screen track')
            try {
              await room.localParticipant.publishTrack(screenTrackToPublish)
              setIsScreenSharing(true)
              console.log('[BroadcastPage] Screen track published successfully')
            } catch (err) {
              console.error('[BroadcastPage] Failed to publish screen track:', err)
            }
          }
        }

        await supabase
          .from('streams')
          .update({ is_live: true, status: 'live' })
          .eq('id', stream.id)

        hasJoinedRef.current = true

      } catch (err) {
        console.error('LiveKit init error:', err)
      }
      // OPTIMIZED: Removed finally block - no UI blocking
    }

    initLiveKit()

    return () => {
      mounted = false
    }
  }, [stream?.id, user?.id, isHost, !!userSeat, hostMicMutedByOfficer])

  const toggleCamera = async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) return
    
    const isEnabled = roomRef.current.localParticipant.isCameraEnabled
    if (isEnabled) {
      await roomRef.current.localParticipant.setCameraEnabled(false)
    } else {
      await roomRef.current.localParticipant.setCameraEnabled(true)
    }
    
    const tracks = roomRef.current.localParticipant.videoTrackPublications.values()
    for (const pub of tracks) {
      if (pub.track && pub.track.kind === 'video') {
        setLocalTracks(prev => prev ? [prev[0], pub.track as LocalVideoTrack] : null)
        break
      }
    }
  }

  const toggleMicrophone = async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) return
    
    const isEnabled = roomRef.current.localParticipant.isMicrophoneEnabled
    if (isEnabled) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(false)
    } else {
      await roomRef.current.localParticipant.setMicrophoneEnabled(true)
    }
  }

  useEffect(() => {
    if (!isHost || !hostMicMutedByOfficer || !roomRef.current?.localParticipant) return;
    
    console.log('[BroadcastPage] useEffect: hostMicMutedByOfficer is true - forcing mic disabled')
    roomRef.current.localParticipant.setMicrophoneEnabled(false).catch((err) => {
      console.error('Failed to force-disable host mic:', err);
    });
  }, [isHost, hostMicMutedByOfficer]);

  // Listen for balance update events from gift system
  // This ensures all participants see updated balances in real-time without full page reloads
  useEffect(() => {
    const handleBalanceUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        senderId: string;
        receiverId: string;
        amount: number;
        timestamp: number;
      }>;
      
      const { senderId, receiverId } = customEvent.detail || {};
      console.log('[BroadcastPage] 💰 Balance update received:', { senderId, receiverId });
      
      // Only update broadcaster profile if broadcaster is involved - no refreshProfile calls
      // to avoid unnecessary state updates that could cause page refresh appearance
      const isBroadcasterInvolved = receiverId === stream?.user_id || senderId === stream?.user_id;
      
      if (isBroadcasterInvolved && stream?.user_id) {
        console.log('[BroadcastPage] 🔄 Broadcaster involved - updating profile');
        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', stream.user_id)
          .single();
        
        if (updatedProfile) {
          setBroadcasterProfile(updatedProfile);
        }
      }
    };
    
    window.addEventListener('broadcast-balance-update', handleBalanceUpdate);
    return () => window.removeEventListener('broadcast-balance-update', handleBalanceUpdate);
  }, [user?.id, stream?.user_id, supabase]);

  // Listen for seat balance refresh events
  useEffect(() => {
    const handleSeatRefresh = () => {
      console.log('[BroadcastPage] 🔄 Received seat balance refresh request');
      // This will trigger the useStreamSeats hook to refresh seat data
      // The hook already polls every 10 seconds, but this provides instant refresh
    };
    
    window.addEventListener('refresh-seat-balances', handleSeatRefresh);
    return () => window.removeEventListener('refresh-seat-balances', handleSeatRefresh);
  }, []);

  // Subscribe to profile changes for broadcaster only (to avoid full reloads)
  // This ensures real-time balance updates for the broadcaster without causing page reloads
  useEffect(() => {
    if (!streamId || !stream?.user_id) return;
    
    // Only subscribe to broadcaster's profile - not all participants
    // This prevents full page reloads while still updating broadcaster balance
    const broadcasterChannel = supabase.channel(`broadcast-broadcaster-${streamId}`);
    
    broadcasterChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${stream.user_id}`
      },
      (payload) => {
        console.log('[BroadcastPage] 👤 Broadcaster profile updated:', payload.new);
        
        // Update local broadcaster profile without causing full reload
        if (payload.new) {
          setBroadcasterProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      }
    ).subscribe();
    
    return () => {
      supabase.removeChannel(broadcasterChannel);
    };
  }, [streamId, stream?.user_id, supabase]);

  const onGift = (userId: string) => {
    setGiftRecipientId(userId);
    setIsGiftModalOpen(true);
  }

  const onGiftAll = (ids: string[]) => {
    toast.info(`Gift sent to ${ids.length} users`)
  }

  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);

  const checkClickRate = () => {
    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter(
      timestamp => now - timestamp < 2000
    );
    clickHistoryRef.current.push(now);
    if (clickHistoryRef.current.length > 5) {
      return false;
    }
    return true;
  };

  const handleLike = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    if (isHost) {
        toast.error("Broadcasters cannot like their own broadcast");
        return;
    }

    if (isClickBlocked) {
        toast.error('Clicking too fast! Please wait a moment.');
        return;
    }

    if (!checkClickRate()) {
        setIsClickBlocked(true);
        toast.error('🛑 Autoclicker detected! You are blocked from liking for 30 seconds.');
        
        setTimeout(() => {
            setIsClickBlocked(false);
            clickHistoryRef.current = [];
            toast.info('You can now like again.');
        }, 30000);
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.error('Please sign in to like');
            return;
        }

        if (!stream?.id) {
            toast.error('Stream not found');
            return;
        }

        const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
        
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stream_id: stream.id
            })
        });

        if (response.status === 404) {
            toast.error('Like feature temporarily unavailable.');
            return;
        }

        let result;
        try {
            result = await response.json();
        } catch {
            toast.error('Failed to process like.');
            return;
        }

        if (!response.ok) {
            toast.error(result?.error || 'Failed to send like');
            return;
        }

        const channel = channelRef.current;
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'like_sent',
                payload: {
                    user_id: user.id,
                    stream_id: stream.id,
                    total_likes: result.total_likes,
                    timestamp: Date.now()
                }
            });
        }

        setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: result.total_likes };
        });

        if (result.coins_awarded > 0) {
            toast.success(
                `🎉 You earned ${result.coins_awarded} Troll Coin${result.coins_awarded !== 1 ? 's' : ''}! ` +
                `(${result.user_like_count.toLocaleString()} likes)`,
                { duration: 5000 }
            );
        }

    } catch (e) {
        console.error('Like error:', e);
        toast.error('Failed to send like');
    }
  };

  const toggleStreamRgb = async () => {
    if (!isHost || !stream) return;
    const enabling = !stream.has_rgb_effect;
    try {
      const { data, error } = await supabase.rpc('purchase_rgb_broadcast', {
        p_stream_id: stream.id,
        p_enable: enabling
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
      if (result.message === 'Purchased and Enabled') {
        toast.success("RGB Unlocked! (-10 Coins)");
      } else {
        toast.success(enabling ? "RGB Effect Enabled" : "RGB Effect Disabled");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to update RGB setting");
    }
  };

  const handleStreamEnd = async () => {
    // Stop local tracks first
    if (localTracks) {
      localTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('Error stopping track:', e)
          }
        }
      })
      setLocalTracks(null)
    }
    
    // Clear remote participants immediately
    setRemoteParticipants(new Map())
    
    // Disconnect from room
    const room = roomRef.current
    if (room) {
      room.disconnect().catch(console.error)
      roomRef.current = null
    }
    
    // Handle battle if needed
    if (stream?.battle_id && isHost) {
      try {
        const { data: battleData } = await supabase
          .from('battles')
          .select('id, status, challenger_stream_id, opponent_stream_id')
          .eq('id', stream.battle_id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (battleData) {
          const opponentStreamId = battleData.challenger_stream_id === stream.id
            ? battleData.opponent_stream_id
            : battleData.challenger_stream_id;
          
          const { error: leaveError } = await supabase.rpc('leave_battle', {
            p_battle_id: battleData.id,
            p_user_id: user.id
          });
          
          if (leaveError) {
            console.warn('Failed to leave battle:', leaveError);
          }
        }
      } catch (battleErr) {
        console.warn('Error handling battle on stream end:', battleErr);
      }
    }
    
    // Update database
    try {
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', stream.id);
      
      if (updateError) {
        console.error('Failed to mark stream as ended:', updateError.message);
        toast.error('Failed to end stream properly.');
        return;
      }

      // End RTC session
      const endTime = new Date().toISOString();
      const { data: session } = await supabase
        .from('rtc_sessions')
        .select('id, started_at')
        .eq('room_name', `stream-${stream.id}`)
        .eq('is_active', true)
        .single();

      if (session) {
        const startTime = new Date(session.started_at);
        const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);
        
        await supabase
          .from('rtc_sessions')
          .update({
            is_active: false,
            ended_at: endTime,
            duration_seconds: durationSeconds
          })
          .eq('id', session.id);
        console.log('[BroadcastPage] RTC session ended, duration:', durationSeconds, 'seconds');
      }
    } catch (endErr) {
      console.error('Exception marking stream as ended:', endErr);
    }
    
    setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);
    navigate(`/broadcast/summary/${stream?.id}`);
  };

  const swipeNavigateLockRef = useRef(false);

  // Check if there are adjacent streams to swipe to
  useEffect(() => {
    if (!stream?.id || isHost) {
      setCanSwipe(false);
      return;
    }

    const checkAdjacentStreams = async () => {
      try {
        const currentCategory = stream.category || 'general';
        const { data } = await supabase
          .from('streams')
          .select('id')
          .eq('is_live', true)
          .eq('status', 'live')
          .eq('category', currentCategory)
          .limit(2);

        const liveStreams = (data || []).filter((item) => item?.id);
        setCanSwipe(liveStreams.length > 1);
      } catch {
        setCanSwipe(false);
      }
    };

    checkAdjacentStreams();

    const channel = supabase.channel(`swipe-check-${stream.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: `category=eq.${stream.category || 'general'}`
      }, () => {
        checkAdjacentStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stream?.id, stream?.category, isHost]);

  const navigateToAdjacentStream = useCallback(async (direction: 'up' | 'down') => {
    if (!stream?.id || swipeNavigateLockRef.current) return;

    swipeNavigateLockRef.current = true;

    try {
      const currentCategory = stream.category || 'general';
      const { data, error } = await supabase
        .from('streams')
        .select('id, category, current_viewers, created_at')
        .eq('is_live', true)
        .eq('status', 'live')
        .eq('category', currentCategory)
        .order('current_viewers', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[BroadcastPage] Failed to fetch swipe stream list:', error);
        return;
      }

      const liveStreams = (data || []).filter((item) => item?.id);
      if (liveStreams.length <= 1) return;

      const currentIndex = liveStreams.findIndex((item) => item.id === stream.id);
      if (currentIndex === -1) return;

      const nextIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
      const targetStream = liveStreams[nextIndex];

      if (!targetStream?.id) return;

      navigate(`/watch/${targetStream.id}`);
    } catch (err) {
      console.error('[BroadcastPage] Swipe navigation failed:', err);
    } finally {
      window.setTimeout(() => {
        swipeNavigateLockRef.current = false;
      }, 400);
    }
  }, [navigate, stream?.category, stream?.id]);

  const handleStageTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isHost || e.touches.length !== 1) return;
    stageTouchStartYRef.current = e.touches[0].clientY;
    stageTouchCurrentYRef.current = e.touches[0].clientY;
  }, [isHost]);

  const handleStageTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isHost || stageTouchStartYRef.current === null) return;
    stageTouchCurrentYRef.current = e.touches[0].clientY;
    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    if (Math.abs(diffY) > 12) {
      e.preventDefault();
    }
  }, [isHost]);

  const handleStageTouchEnd = useCallback(() => {
    if (isHost || stageTouchStartYRef.current === null || stageTouchCurrentYRef.current === null) {
      stageTouchStartYRef.current = null;
      stageTouchCurrentYRef.current = null;
      return;
    }

    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    const threshold = 90;

    if (Math.abs(diffY) >= threshold) {
      navigateToAdjacentStream(diffY > 0 ? 'up' : 'down');
    }

    stageTouchStartYRef.current = null;
    stageTouchCurrentYRef.current = null;
  }, [isHost, navigateToAdjacentStream]);

  const activeUserIds = useMemo(() => {
    if (!stream) return [];
    const ids: string[] = [];
    // Include both user_id and guest_id for active participants
    Object.values(seats).forEach((seat: any) => {
      if (seat?.user_id && seat.user_id !== stream.user_id) {
        ids.push(seat.user_id);
      }
      if (seat?.guest_id && seat.guest_id !== stream.user_id) {
        ids.push(seat.guest_id);
      }
    });
    return ids;
  }, [seats, stream?.user_id]);

  const userProfiles = useMemo(() => {
    if (!stream) return {};
    const profiles: Record<string, { username: string; avatar_url?: string }> = {};
    
    if (broadcasterProfile) {
      profiles[stream.user_id] = {
        username: broadcasterProfile.username || 'Broadcaster',
        avatar_url: broadcasterProfile.avatar_url,
      };
    }
    
    // Handle both user_id and guest_id profiles
    Object.values(seats).forEach((seat: any) => {
      // For registered users with profiles
      if (seat?.user_id && seat.user_profile) {
        profiles[seat.user_id] = {
          username: seat.user_profile.username || 'User',
          avatar_url: seat.user_profile.avatar_url,
        };
      }
      // For guest users - use guest_id directly (guests have username in the seat data)
      if (seat?.guest_id && seat.user_profile) {
        profiles[seat.guest_id] = {
          username: seat.user_profile.username || 'Guest',
          avatar_url: seat.user_profile.avatar_url,
        };
      }
    });
    
    return profiles;
  }, [seats, broadcasterProfile, stream?.user_id]);

  // INSTANT JOIN: Show minimal loading state inline instead of blocking entire page
  // This allows users to see the page immediately while data loads in background
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-black text-white">
        <p className="text-red-500">{error}</p>
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  // INSTANT JOIN: Show instant content while stream loads in background
  // Use skeleton/placeholder instead of blocking with spinner
  if (!stream) {
    return (
      <div className="flex items-center justify-center h-dvh bg-black">
        <div className="text-white text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-48 mb-4"></div>
            <div className="h-3 bg-gray-600 rounded w-32"></div>
          </div>
        </div>
      </div>
    )
  }

  const categoryConfig = getCategoryConfig(stream.category || 'general')
  const categorySupportsBattles = supportsBattles(stream.category || 'general')
  const categoryMatchingTerm = getMatchingTerminology(stream.category || 'general');

  // INSTANT JOIN: Show battle content immediately, load battle data in background
  // Don't show loading screen - content will appear when data arrives via realtime

  // Handle battle mode: show overlay for anyone in a battle (broadcaster or participant)
  const shouldShowBattleOverlay = stream.is_battle && battleData;

  // INSTANT JOIN: Don't block UI while joining LiveKit
  // Show the page immediately and let LiveKit connect in background
  // User can see video/audio appear when ready without waiting for spinner

  return (
    <ErrorBoundary>
      <StreamLayout
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        
          header={
          <BroadcastHeader
            stream={stream}
            isHost={isHost}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteParticipants.size}
            handleLike={handleLike}
            onStartBattle={isHost && categorySupportsBattles ? () => setIsBattleMode(true) : undefined}
            categoryBattleTerm={categorySupportsBattles ? categoryMatchingTerm : undefined}
            onChallengeBroadcaster={!isHost && categorySupportsBattles ? handleDirectChallenge : undefined}
            hasPendingChallenge={hasPendingChallenge}
          />
        }
        
        video={
          <div
            className="flex flex-col h-full"
            style={!isHost ? { touchAction: 'none' } : undefined}
            onTouchStart={handleStageTouchStart}
            onTouchMove={handleStageTouchMove}
            onTouchEnd={handleStageTouchEnd}
          >
            {/* Always show BroadcastGrid - battle mode is integrated into the grid */}
            <>
              <GiftersBubbleStrip 
                streamId={streamId || ''} 
                hostId={stream.user_id}
              />
              <BroadcastGrid
                stream={stream}
                seats={seats}
                onJoinSeat={(index) => handleJoinSeat(index, getSeatPrice(index))}
                isHost={isHost}
                localTracks={localTracks}
                room={roomRef.current}
                remoteUsers={Array.from(remoteParticipants.values())}
                localUserId={user?.id || userSeat?.guest_id || ''}
                onGift={onGift}
                onGiftAll={onGiftAll}
                toggleCamera={toggleCamera}
                toggleMicrophone={toggleMicrophone}
                onGetUserPositions={handleGetUserPositions}
                broadcasterProfile={broadcasterProfile}
                streamStatus={stream.status}
                boxCount={boxCount}
                battleState={battleState}
                supporters={supporters}
                onPickSide={pickSide}
                joinWindowOpen={joinWindowOpen}
                userTeam={userTeam}
                remainingTime={remainingTime}
                shouldShowSidePicker={shouldShowSidePicker}
                onBattleGift={sendBattleGift}
                enableStreamSwipe={!isHost}
                canSwipe={canSwipe}
                onSwipeUp={() => navigateToAdjacentStream('up')}
                onSwipeDown={() => navigateToAdjacentStream('down')}
                onAddBox={isHost && categoryConfig.allowAddBox && boxCount < 6 ? incrementBoxCount : undefined}
                onRemoveBox={isHost && categoryConfig.allowDeductBox && boxCount > 1 ? decrementBoxCount : undefined}
                onToggleRgb={isHost ? toggleStreamRgb : undefined}
                hasRgbEffect={stream.has_rgb_effect}
                canEditBoxes={isHost}
              />
            </>
          </div>
        }

        controls={
          <BroadcastControls
            stream={stream}
            isHost={isHost}
            isOnStage={!!userSeat}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteParticipants.size}
            chatOpen={isChatOpen}
            toggleChat={() => setIsChatOpen(!isChatOpen)}
            onGiftHost={() => onGift(stream.user_id)}
            onLeave={handleLeaveSeat}
            onBoxCountUpdate={updateBoxCount}
            onStreamEnd={handleStreamEnd}
            handleLike={handleLike}
            toggleBattleMode={() => setIsBattleMode(!isBattleMode)}
            localTracks={localTracks}
            toggleCamera={toggleCamera}
            toggleMicrophone={toggleMicrophone}
            onPinProduct={() => setIsPinProductModalOpen(true)}
            boxCount={boxCount}
            setBoxCount={updateBoxCount}
            onRefreshStream={refreshStream}
            onChallengeBroadcaster={!isHost && categorySupportsBattles ? handleDirectChallenge : undefined}
            hasPendingChallenge={hasPendingChallenge}
            onStartBattle={userSeat && (stream.battle_enabled === true) && !battleState.active && stream.category === 'general' ? startBattle : undefined}
            battleActive={battleState.active}
            battleEnabled={stream.battle_enabled === true && stream.category === 'general'}
          />
        }
        
        chat={
          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={isHost}
            isViewer={!userSeat && !isHost}
            isGuest={!user}
            onChallengeBroadcaster={!isHost && categorySupportsBattles ? handleDirectChallenge : undefined}
            hasPendingChallenge={hasPendingChallenge}
            pendingChallenges={incomingChallenges}
            onAcceptChallenge={handleAcceptChallenge}
            onDenyChallenge={handleDenyChallenge}
            isBattleActive={stream.is_battle}
            isChatOpen={isChatOpen}
            seats={seats}
            broadcasterProfile={broadcasterProfile}
          />
        }
        
        overlays={
          <>
            {!isHost && pinnedProducts.length > 0 && (
              <PinnedProductOverlay pinnedProducts={pinnedProducts} />
            )}
            <GiftAnimationOverlay 
              gifts={recentGifts}
              participantNames={Object.fromEntries(
                [
                  ...Object.entries(userProfiles).map(([id, profile]) => [id, profile.username || 'User'] as const),
                  ...Object.entries(giftNameMap),
                ]
              )}
              onAnimationComplete={(giftId) => {
                // Remove the gift from recentGifts after animation
                setRecentGifts(prev => prev.filter(g => g.id !== giftId));
              }}
            />
          </>
        }
        
        modals={
          <>
            <GiftBoxModal
              isOpen={isGiftModalOpen}
              onClose={() => {
                setIsGiftModalOpen(false);
                setGiftRecipientId(null);
              }}
              recipientId={giftRecipientId || ''}
              streamId={streamId || ''}
              broadcasterId={stream.user_id}
              activeUserIds={activeUserIds}
              userProfiles={userProfiles}
              sharedChannel={channelRef.current}
              onGiftSent={async (giftData: GiftItem, target: GiftTarget) => {
                const quantity = target.quantity || 1;
                const totalAmount = giftData.coinCost * quantity;
                
                // Record battle gift if battle is active
                if (battleState.active && battleState.battleId) {
                  const giftAmount = giftData.coinCost * quantity;
                  
                  // Determine which team to credit based on recipient
                  const creditTeam = (recipientId: string) => {
                    if (recipientId === stream.user_id) return 'broadcaster';
                    if (recipientId === battleState.challengerId) return 'challenger';
                    // Default to broadcaster for untracked recipients
                    return 'broadcaster';
                  };
                  
                  if (target.type === 'all') {
                    const allRecipients = [stream.user_id, ...activeUserIds];
                    // Credit the broadcaster team for gifts to all
                    await sendBattleGift?.('broadcaster', giftAmount);
                  } else {
                    const recipientId = target.userId || giftRecipientId || stream?.user_id || '';
                    const team = creditTeam(recipientId);
                    await sendBattleGift?.(team, giftAmount);
                  }
                }
                
                if (target.type === 'all') {
                  const allRecipients = [stream.user_id, ...activeUserIds];
                  allRecipients.forEach((recipientId, index) => {
                    setTimeout(() => {
                      const newGift: BroadcastGift = {
                        id: `local-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                        gift_id: giftData.id,
                        gift_name: giftData.name,
                        gift_icon: giftData.icon || '🎁',
                        amount: giftData.coinCost * quantity,
                        quantity,
                        sender_id: user?.id || '',
                        sender_name: profile?.username || 'You',
                        receiver_id: recipientId,
                        created_at: new Date().toISOString(),
                      };
                      setRecentGifts(prev => [...prev, newGift]);
                      
                      // Dispatch balance update event for each recipient
                      window.dispatchEvent(new CustomEvent('broadcast-balance-update', {
                        detail: {
                          senderId: user?.id || '',
                          receiverId: recipientId,
                          amount: giftData.coinCost * quantity,
                          timestamp: Date.now()
                        }
                      }));
                    }, index * 200);
                  });
                } else {
                  const recipientId = target.userId || giftRecipientId || stream?.user_id || '';
                  const newGift: BroadcastGift = {
                    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    gift_id: giftData.id,
                    gift_name: giftData.name,
                    gift_icon: giftData.icon || '🎁',
                    amount: giftData.coinCost * quantity,
                    quantity,
                    sender_id: user?.id || '',
                    sender_name: profile?.username || 'You',
                    receiver_id: recipientId,
                    created_at: new Date().toISOString(),
                  };
                  setRecentGifts(prev => [...prev, newGift]);
                  
                  // Dispatch balance update event for the recipient
                  window.dispatchEvent(new CustomEvent('broadcast-balance-update', {
                    detail: {
                      senderId: user?.id || '',
                      receiverId: recipientId,
                      amount: giftData.coinCost * quantity,
                      timestamp: Date.now()
                    }
                  }));
                }
              }}
            />
            
            <PinProductModal
              isOpen={isPinProductModalOpen}
              onClose={() => setIsPinProductModalOpen(false)}
              onProductPinned={async (productId) => {
                const result = await pinProduct(productId);
                if (!result.success) {
                  toast.error('Failed to pin product');
                }
              }}
            />
            

            
            {/* Challenge Manager - Show for broadcaster when there are incoming challenges */}
            {isHost && incomingChallenges.length > 0 && (
              <div className="fixed bottom-24 left-4 z-50 w-80">
                <ChallengeManager
                  challenges={incomingChallenges}
                  onAccept={handleAcceptChallenge}
                  onDeny={handleDenyChallenge}
                />
              </div>
            )}
          </>
        }
      />
    </ErrorBoundary>
  )
}

export default BroadcastPage
