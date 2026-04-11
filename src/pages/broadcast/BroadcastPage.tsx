import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, LocalParticipant, VideoPresets, AudioPresets } from 'livekit-client'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { getCategoryConfig } from '../../config/broadcastCategories'
import { useStreamStore } from '../../lib/streamStore'
import { PreflightStore } from '../../lib/preflightStore'
import { emitEvent } from '../../lib/events'
import { useIsMobile } from '../../hooks/useIsMobile'
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
import DraggableWrapper from '../../components/broadcast/DraggableWrapper'
import { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { useBroadcastPinnedProducts } from '../../hooks/useBroadcastPinnedProducts'
import { useBoxCount } from '../../hooks/useBoxCount'
import { useBattleState } from '../../hooks/useBattleState'
import CoinStoreModal from '../../components/broadcast/CoinStoreModal'

import { Loader2, Shield, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useStreamSeats } from '../../hooks/useStreamSeats'
import { useBroadcastAbilities } from '../../hooks/useBroadcastAbilities'
import AbilityBox from '../../components/broadcast/AbilityBox'
import BroadcastAbilityEffects from '../../components/broadcast/BroadcastAbilityEffects'
import BroadcastTicker from '../../components/broadcast/BroadcastTicker'
import ShareModal from '../../components/broadcast/ShareModal'
import TickerControlPanel from '../../components/broadcast/TickerControlPanel'
import { useBroadcastTicker } from '../../hooks/useBroadcastTicker'
import { useTickerStore } from '../../stores/tickerStore'
import { useTrollToe } from '../../hooks/useTrollToe'
import TrollToeController from '../../components/broadcast/TrollToeController'
import TrollToeViewerUI from '../../components/broadcast/TrollToeViewerUI'
import GamePicker from '../../components/broadcast/GamePicker'
import TrollUsGameController from '../../components/broadcast/TrollUsGameController'
import { useTrollopoly } from '../../hooks/useTrollopoly'
import TrollopolyLobby from '../../components/broadcast/TrollopolyLobby'
import TrollopolyBoard from '../../components/broadcast/TrollopolyBoard'
import TrollopolyController from '../../components/broadcast/TrollopolyController'
import TrollopolyViewerUI from '../../components/broadcast/TrollopolyViewerUI'
import { CityHeatBar } from '../../components/CityHeatBar'
import { GlassCrackEffect } from '../../components/GlassCrackEffect'
import TCPSMessageBubble from '../../components/broadcast/TCPSMessageBubble'
import { useBroadcastEffects } from '../../contexts/BroadcastEffectsContext'

function BroadcastPage() {
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { clearTracks, screenTrack } = useStreamStore()
  const { isMobileWidth } = useIsMobile()

  // Determine if user is admin for video quality (1080p admin, 720p regular)
  const isStreamAdmin = !!(profile && (
    profile.role === 'admin' || profile.is_admin ||
    profile.role === 'superadmin' || profile.is_superadmin ||
    profile.role === 'owner'
  ))
  
  // Check if user is an officer role
  const isOfficer = !!(profile && (
    profile.role === 'admin' || profile.is_admin ||
    profile.role === 'lead_troll_officer' || profile.is_lead_officer ||
    profile.role === 'troll_officer' || profile.is_troll_officer ||
    profile.role === 'secretary' ||
    profile.role === 'prosecutor' ||
    profile.role === 'attorney'
  ))
  
  const videoPreset = isStreamAdmin ? VideoPresets.h1080 : VideoPresets.h720

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

  // Broadcast Effects Engine
  const { triggerGiftEffect, boostCityHeat } = useBroadcastEffects()

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
  const [cameraOverlayEnabled, setCameraOverlayEnabled] = useState(false)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  // Helper to safely get array from RemoteParticipants Map
  const getRemoteParticipantsArray = () => {
    if (!remoteParticipants || typeof remoteParticipants.values !== 'function') return []
    return Array.from(remoteParticipants.values()) as RemoteParticipant[]
  }
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [canSwipe, setCanSwipe] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
  const [giftNameMap, setGiftNameMap] = useState<Record<string, string>>({})
  const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
  const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))
  const giftNameMapRef = useRef<Record<string, string>>({})
  // const playGiftAnimation = useAnimationStore((state) => state.playGiftAnimation)

  // Broadcast Abilities
  const {
    abilities: userAbilities,
    activeEffects: abilityActiveEffects,
    loading: abilityLoading,
    useAbility: activateAbility,
    isEffectActive,
    getCooldownRemaining,
    getEffectRemaining,
  } = useBroadcastAbilities(streamId)
  const [isAbilityBoxOpen, setIsAbilityBoxOpen] = useState(false)

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

const isHost = stream?.user_id === user?.id

  // Broadcast Global Ticker
  const {
    sendMessage: tickerSendMessage,
    sendPriority: tickerSendPriority,
    clearPriority: tickerClearPriority,
    deleteMessage: tickerDeleteMessage,
    broadcastSettings: tickerBroadcastSettings,
    generateSystemMessage: tickerGenerateSystemMessage,
  } = useBroadcastTicker({
    streamId: streamId || '',
    userId: user?.id || '',
    isHost,
    enabled: !!streamId && !!user,
  })
  const [isTickerPanelOpen, setIsTickerPanelOpen] = useState(false)
  const tickerSettings = useTickerStore((s) => s.settings)

  // Troll Toe (Live Tic-Tac-Toe) game
  const trollToe = useTrollToe({
    streamId: streamId || '',
    isHost,
    enabled: !!streamId && !!(user || anonymousViewerIdRef.current),
  })

  // Trollopoly game
  const trollopoly = useTrollopoly({
    streamId: streamId || '',
    isHost,
    enabled: !!streamId && !!(user || anonymousViewerIdRef.current),
  })

  // Game picker state
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const [trollUsGameOpen, setTrollUsGameOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<'troll_toe' | 'troll_us' | 'trollopoly' | null>(null)
  
  // Quick Coin Store
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false)

  // getTrackForUser - maps userId to LiveKit video/audio tracks for Troll Toe board
  const getTrackForUser = useCallback((userId: string) => {
    const isLocal = userId === user?.id;
    if (isLocal) {
      return {
        videoTrack: localTracks?.[1] || undefined,
        audioTrack: localTracks?.[0] || undefined,
        isLocal: true,
        hasVideo: !!localTracks?.[1],
        hasAudio: !!localTracks?.[0],
      };
    }
    // Find remote participant by identity
    const participant = getRemoteParticipantsArray().find(
      (p) => p.identity === userId || p.identity.substring(0, 8) === userId.replace(/-/g, '').substring(0, 8)
    );
    if (!participant) {
      return { videoTrack: undefined, audioTrack: undefined, isLocal: false, hasVideo: false, hasAudio: false };
    }
    const videoPubs = Array.from((participant.videoTrackPublications as any)?.values() || []);
    const audioPubs = Array.from((participant.audioTrackPublications as any)?.values() || []);
    const videoPub = videoPubs.find((p: any) => p.track && p.isSubscribed) || videoPubs.find((p: any) => p.track);
    const audioPub = audioPubs.find((p: any) => p.track && p.isSubscribed) || audioPubs.find((p: any) => p.track);
    return {
      videoTrack: videoPub?.track,
      audioTrack: audioPub?.track,
      isLocal: false,
      hasVideo: !!videoPub?.track,
      hasAudio: !!audioPub?.track,
    };
  }, [user?.id, localTracks, remoteParticipants])

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

  const { seats, mySession: userSeat, joinSeat, leaveSeat } = useStreamSeats(streamId, user?.id, broadcasterProfile, stream);

  // Battle State - placed after userSeat is defined
  const { 
    battleState: rawBattleState,
    pickSide,
    supporters,
    userTeam,
    joinWindowOpen,
    remainingTime,
    shouldShowSidePicker,
    sendBattleGift,
  } = useBattleState({
    streamId: streamId || '',
    localUserId: user?.id || userSeat?.guest_id || anonymousViewerIdRef.current || '',
    isHost,
    hostId: stream?.user_id,
  })

  // Transform battleState to match BroadcastGrid's expected interface
  const battleState = useMemo(() => ({
    active: rawBattleState.active,
    battleId: rawBattleState.battleId,
    hostId: rawBattleState.teamACaptain,
    challengerId: rawBattleState.teamBCaptain,
    broadcasterScore: rawBattleState.teamAScore,
    challengerScore: rawBattleState.teamBScore,
    startedAt: rawBattleState.startedAt,
    endsAt: rawBattleState.endsAt,
    suddenDeath: rawBattleState.suddenDeath,
  }), [rawBattleState])

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
  }, [leaveSeat, localTracks])

  const handleJoinSeat = useCallback(async (index: number, price: number) => {
    justJoinedSeatRef.current = true
    return joinSeat(index, price)
  }, [joinSeat])

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
            return { ...prev, status: data.status };
          });
          return;
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
        const broadcasterId = stream?.user_id;
        for (const [key, users] of Object.entries(state)) {
          // Exclude broadcaster from viewer count
          if (key !== broadcasterId) {
            totalUsers += (users as any[]).length;
          }
        }
        setViewerCount(totalUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const state = channel.presenceState();
        let totalUsers = 0;
        const broadcasterId = stream?.user_id;
        for (const [key, users] of Object.entries(state)) {
          // Exclude broadcaster from viewer count
          if (key !== broadcasterId) {
            totalUsers += (users as any[]).length;
          }
        }
        setViewerCount(totalUsers);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const state = channel.presenceState();
        let totalUsers = 0;
        const broadcasterId = stream?.user_id;
        for (const [key, users] of Object.entries(state)) {
          // Exclude broadcaster from viewer count
          if (key !== broadcasterId) {
            totalUsers += (users as any[]).length;
          }
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
            // Ignore likes from self (sender already updated optimistically)
            if (likeData.user_id === user?.id) {
              return;
            }
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 10;
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
          
          supabase
            .from('user_profiles')
            .select('active_entrance_effect')
            .eq('id', user?.id)
            .maybeSingle()
            .then(({ data: effectData }) => {
              channel.track({
                user_id: user?.id || 'viewer',
                username: profile?.username || user?.email || 'Viewer',
                is_host: isHost,
                online_at: new Date().toISOString(),
                avatar_url: profile?.avatar_url || '',
                entrance_effect: effectData?.active_entrance_effect || null
              }).catch(console.error);
            });
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

    // Only connect to LiveKit if the stream is actually live
    // This prevents RTC session minutes from accumulating when there's no broadcast
    const isStreamActuallyLive = stream.status === 'live' || stream.is_live === true;
    if (!isStreamActuallyLive) {
      console.log('[BroadcastPage] Stream is not live, skipping LiveKit connection');
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
const remainingVideo = Array.from((participant.videoTrackPublications as any)?.values?.() || []).some((p: any) => p.track)
    const remainingAudio = Array.from((participant.audioTrackPublications as any)?.values?.() || []).some((p: any) => p.track)
            
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
            import.meta.env.VITE_LIVEKIT_URL,
            data.token
          )

          // Get existing participants who were already in the room (LiveKit v2.x uses remoteParticipants)
          const existingParticipants = room.remoteParticipants
            ? Array.from(room.remoteParticipants?.values?.() || []) as RemoteParticipant[]
            : []
          if (existingParticipants.length > 0) {
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
            console.log('[BroadcastPage] Viewer: No existing participants in room')
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

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            ...videoPreset,
            facingMode: 'user'
          },
          audioCaptureDefaults: {
            ...AudioPresets.audio,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
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
                import.meta.env.VITE_LIVEKIT_URL,
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
          
          // Screen share mode: unpublish camera, publish screen track, update local preview
          const isScreenShareExisting = PreflightStore.getScreenShareMode()
          const screenTrackExisting = PreflightStore.getScreenTrack() || screenTrack
          if (isScreenShareExisting && screenTrackExisting) {
            console.log('[BroadcastPage] Screen share mode (existing room) - replacing camera with screen track')
            try {
              // Unpublish camera track so viewers only see screen share
              for (const pub of existingRoom.localParticipant.videoTrackPublications.values()) {
                if (pub.track && pub.track.kind === 'video') {
                  await existingRoom.localParticipant.unpublishTrack(pub.track)
                  console.log('[BroadcastPage] Camera track unpublished (existing room)')
                  break
                }
              }
              await existingRoom.localParticipant.publishTrack(screenTrackExisting)
              // Update local preview to show screen share instead of camera
              setLocalTracks([audioTrack || null, screenTrackExisting])
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
          const isScreenShareInit = PreflightStore.getScreenShareMode()
          console.log('[BroadcastPage] Screen share mode:', isScreenShareInit)

          let tracksCreated = false

          try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const hasCamera = devices.some(d => d.kind === 'videoinput')
            const hasMic = devices.some(d => d.kind === 'audioinput')

            console.log('[BroadcastPage] Device check:', { hasCamera, hasMic })

            if (!hasCamera && !hasMic) {
              console.warn('[BroadcastPage] No camera or microphone found')
              toast.error('No camera or microphone found')
            } else if (isScreenShareInit) {
              // Screen share mode: only enable mic, camera is replaced by screen track
              console.log('[BroadcastPage] Screen share mode - enabling mic only')
              await room.localParticipant.setMicrophoneEnabled(true)
              tracksCreated = true
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
            // If enable failed, try manual creation
            console.log('[BroadcastPage] Trying manual track creation as fallback')
            try {
              const { createLocalTracks } = await import('livekit-client')
              const isScreenShareFallback = PreflightStore.getScreenShareMode()
              const localTracks = await createLocalTracks({
                audio: true,
                video: !isScreenShareFallback ? videoPreset : false
              })
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
          
          // Get tracks from room's local participant
          // In screen share mode, only get audio (screen track handled separately)
          const isScreenShareTracks = PreflightStore.getScreenShareMode()
          videoTrack = undefined
          audioTrack = undefined

          console.log('[BroadcastPage] Video publications:', Array.from(room.localParticipant.videoTrackPublications.values()).map((p: any) => p.trackId))
          console.log('[BroadcastPage] Audio publications:', Array.from(room.localParticipant.audioTrackPublications.values()).map((p: any) => p.trackId))

          // Get video track (skip in screen share mode - camera not published)
          if (!isScreenShareTracks) {
for (const pub of room.localParticipant?.videoTrackPublications?.values?.() || []) {
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
          } else {
            console.log('[BroadcastPage] Screen share mode - skipping camera track lookup')
          }

          // Get audio track - must check audioTrackPublications!
for (const pub of room.localParticipant?.audioTrackPublications?.values?.() || []) {
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
          // In screen share mode, only create audio
          const needVideo = !isScreenShareTracks && !videoTrack
          const needAudio = !audioTrack
          if (needVideo || needAudio) {
            console.warn('[BroadcastPage] Missing tracks, trying manual creation', { needVideo, needAudio })

            try {
              const { createLocalTracks } = await import('livekit-client')

              const devices = await navigator.mediaDevices.enumerateDevices()
              const hasCamera = devices.some(d => d.kind === 'videoinput')
              const hasMic = devices.some(d => d.kind === 'audioinput')

              console.log('[BroadcastPage] Available devices:', { hasCamera, hasMic })

              if (hasCamera || hasMic) {
                const localTracks = await createLocalTracks({
                  audio: hasMic && needAudio,
                  video: hasCamera && needVideo ? videoPreset : false
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
        // In screen share mode, use screen track as the video track for local preview
        const isScreenShareLocal = PreflightStore.getScreenShareMode()
        const screenTrackLocal = PreflightStore.getScreenTrack() || screenTrack
        if (audioTrack || videoTrack || (isScreenShareLocal && screenTrackLocal)) {
          const displayVideoTrack = isScreenShareLocal && screenTrackLocal ? screenTrackLocal : videoTrack
          const videoTrackId = (displayVideoTrack && typeof displayVideoTrack.getTrackId === 'function') ? displayVideoTrack.getTrackId() : 'unknown'
          const audioTrackId = (audioTrack && typeof audioTrack.getTrackId === 'function') ? audioTrack.getTrackId() : 'unknown'

          console.log('[BroadcastPage] Setting localTracks state:', {
            hasAudio: !!audioTrack,
            hasVideo: !!displayVideoTrack,
            isScreenShare: isScreenShareLocal,
            videoTrackId,
            audioTrackId,
          })
          setLocalTracks([audioTrack || null, displayVideoTrack || null])
        } else {
          console.warn('[BroadcastPage] No tracks created!')
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
        // Skip camera enable when in screen share mode - screen track replaces camera
        const isScreenShareMode = PreflightStore.getScreenShareMode()
        console.log('[BroadcastPage] Camera state on join:', {
          isCameraEnabled: room.localParticipant.isCameraEnabled,
          hasVideoTrack: !!videoTrack,
          preflightVideoEnabled: preflightEnabledStates?.isVideoEnabled,
          isScreenShareMode
        })

        // If camera is not enabled but we have a video track, enable it
        // This ensures camera is on when joining broadcast
        // Skip if screen share mode - camera will be unpublished
        if (!isScreenShareMode && !room.localParticipant.isCameraEnabled && (videoTrack || shouldCreateNewTracks)) {
          console.log('[BroadcastPage] Camera was off - enabling camera on join')
          try {
            await room.localParticipant.setCameraEnabled(true)
            console.log('[BroadcastPage] Camera enabled successfully')
          } catch (err) {
            console.error('[BroadcastPage] Failed to enable camera:', err)
          }
        } else if (!isScreenShareMode && room.localParticipant.isCameraEnabled) {
          console.log('[BroadcastPage] Camera is already enabled - good!')
        } else if (isScreenShareMode) {
          console.log('[BroadcastPage] Screen share mode - skipping camera enable')
        }

        // Gaming screen share: publish the screen track to viewers
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
      timestamp => now - timestamp < 1000
    );
    clickHistoryRef.current.push(now);
    // Allow 10 clicks per second for rapid spam clicking
    if (clickHistoryRef.current.length > 10) {
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
        return; // Silent fail for rapid clicking
    }

    if (!checkClickRate()) {
        return; // Silent fail for rapid clicking
    }

    // Track this click for optimistic reconciliation
    const clickTimestamp = Date.now();
    const expectedLikes = 10;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return;
        }

        if (!stream?.id) {
            return;
        }

        const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
        
        // Send 10 likes in batch
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stream_id: stream.id,
                count: 10
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
            // If server fails, don't update UI (the 10 optimistic was never sent)
            toast.error(result?.error || 'Failed to send like');
            return;
        }

        // Only update UI with server response (source of truth)
        const serverTotal = result.total_likes;
        setStream((prev: any) => {
            if (!prev) return prev;
            // Use server total as source of truth
            return { ...prev, total_likes: serverTotal };
        });

        // Broadcast to other users
        const channel = channelRef.current;
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'like_sent',
                payload: {
                    user_id: user.id,
                    stream_id: stream.id,
                    total_likes: serverTotal,
                    timestamp: Date.now()
                }
            });
        }

        if (result.coins_awarded > 0) {
            toast.success(
                `🎉 You earned ${result.coins_awarded} Troll Coin${result.coins_awarded !== 1 ? 's' : ''}! ` +
                `(${result.user_like_count.toLocaleString()} likes)`,
                { duration: 5000 }
            );
        }

    } catch (e) {
        console.error('Like error:', e);
        // Don't show error toast for network issues - could be temporary
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

  const isStaff = profile?.is_troll_officer || profile?.troll_role === 'admin' || profile?.troll_role === 'mod'

  const handleStreamEnd = async () => {
    // For staff, skip confirmation and skip summary page
    if (isStaff || stream?.status === 'ended') {
      // Allow immediate end without confirmation
    } else {
      // For regular hosts, show confirmation
      const confirmed = window.confirm('Are you sure you want to end this stream? This cannot be undone.');
      if (!confirmed) return;
    }
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
    
    // For staff, don't show summary page - go to government streams instead
    if (isStaff) {
      navigate('/government/streams');
    } else {
      navigate(`/broadcast/summary/${stream?.id}`);
    }
  };

  const swipeNavigateLockRef = useRef(false);

  // Check if there are adjacent streams to swipe to
  useEffect(() => {
    if (!stream?.id) {
      setCanSwipe(false);
      return;
    }

    // Enable swipe only for mobile viewers (not host, not on seat)
    const shouldEnableSwipe = !isHost && !userSeat && isMobileWidth;
    
    if (!shouldEnableSwipe) {
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

    const channel = supabase.channel(`swipe-check-${stream?.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: `category=eq.${stream?.category || 'general'}`
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

      const currentIndex = liveStreams.findIndex((item) => item.id === stream?.id);
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

  // INSTANT JOIN: Show broadcast content immediately

  const isMobileViewer = isMobileWidth && !isHost && !userSeat;

  // Check if game is active that should hide add/remove box buttons
  const isGameActive = activeGame === 'trollopoly' && trollopoly.match && trollopoly.match.phase !== 'finished';

  return (
    <ErrorBoundary>
      <StreamLayout
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onLike={handleLike}
        hideHeader={false}
        forceViewMode={isMobileViewer ? 'vertical' : 'fullscreen'}
        
          header={
          <BroadcastHeader
            stream={stream}
            isHost={isHost}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteParticipants.size}
            handleLike={handleLike}
            boxCount={boxCount}
            onAddBox={isHost && categoryConfig.allowAddBox && boxCount < 6 && !isGameActive ? incrementBoxCount : undefined}
            onRemoveBox={isHost && categoryConfig.allowDeductBox && boxCount > 1 && !isGameActive ? decrementBoxCount : undefined}
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
                showTicker={tickerSettings.is_enabled}
                onJoinSeat={(index) => handleJoinSeat(index, getSeatPrice(index))}
                isHost={isHost}
                isOfficer={isOfficer}
                localTracks={localTracks}
                cameraOverlayTrack={cameraOverlayEnabled ? (localTracks?.[1] ?? null) : null}
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
                broadcastMode={stream.broadcast_mode as 'normal' | 'game' | 'battle' | undefined}
                battleState={battleState}
                supporters={supporters}
                onPickSide={pickSide}
                joinWindowOpen={joinWindowOpen}
                userTeam={userTeam}
                remainingTime={remainingTime}
                shouldShowSidePicker={shouldShowSidePicker}
                onBattleGift={sendBattleGift}
                enableStreamSwipe={isMobileViewer}
                canSwipe={canSwipe}
                onSwipeUp={() => navigateToAdjacentStream('up')}
                onSwipeDown={() => navigateToAdjacentStream('down')}
                onAddBox={isHost && categoryConfig.allowAddBox && boxCount < 6 && !isGameActive ? incrementBoxCount : undefined}
                onRemoveBox={isHost && categoryConfig.allowDeductBox && boxCount > 1 && !isGameActive ? decrementBoxCount : undefined}
                onToggleRgb={isHost ? toggleStreamRgb : undefined}
                hasRgbEffect={stream.has_rgb_effect}
                canEditBoxes={isHost}
                trollToeMatch={trollToe.match}
                onTrollToeFog={!isHost && trollToe.match?.fogEnabled && trollToe.match?.phase === 'live' ? trollToe.useFog : undefined}
                battleFormat={stream.battle_format as '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | undefined}
                isUniversalBattle={(stream as any).battle_mode === 'universal'}
              />
            </>
            
            {/* Troll Toe game lives on the broadcast grid tiles - no separate overlay needed */}
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
            onShare={() => setIsShareModalOpen(true)}
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
            fiveVFiveBattleActive={false}
            isLive={stream.status === 'live'}
            onTrollToeController={isHost && stream.status === 'live' ? () => setGamePickerOpen(!gamePickerOpen) : undefined}
            trollToeActive={gamePickerOpen || trollToe.isControllerOpen}
            onGameSelect={(game) => {
              console.log('[BroadcastPage] Game selected:', game)
              setActiveGame(game)
              setGamePickerOpen(false)
              if (game === 'troll_toe') {
                trollToe.setControllerOpen(true)
              }
              if (game === 'troll_us') {
                console.log('[BroadcastPage] Opening Troll Us controller')
                setTrollUsGameOpen(true)
              }
              if (game === 'trollopoly') {
                console.log('[BroadcastPage] Creating Trollopoly game')
                trollopoly.createGame()
              }
            }}
            activeGame={activeGame}
          />
        }
        
        chat={
          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={isHost}
            isViewer={!userSeat && !isHost}
            isGuest={!user}
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

            {/* Troll Toe Controller Panel (host only) */}
            <AnimatePresence>
              {isHost && trollToe.isControllerOpen && activeGame === 'troll_toe' && (
                <div className="absolute top-16 right-3 z-[60] pointer-events-auto">
                  <TrollToeController
                    match={trollToe.match}
                    config={trollToe.config}
                    onCreateGame={trollToe.createGame}
                    onStartGame={trollToe.startGame}
                    onPauseGame={trollToe.pauseGame}
                    onResumeGame={trollToe.resumeGame}
                    onEndGame={trollToe.endGame}
                    onResetBoard={trollToe.resetGame}
                    onOpenSideSelection={trollToe.openSideSelection}
                    onCloseSideSelection={trollToe.closeSideSelection}
                    onToggleFog={trollToe.toggleFog}
                    onSetFogCost={trollToe.setFogCost}
                    onSetRewardAmount={trollToe.setRewardAmount}
                    onAssignPlayers={trollToe.assignQueuedPlayers}
                    onClose={() => { trollToe.setControllerOpen(false); setActiveGame(null); }}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Troll Us Game Controller (host only) */}
            <AnimatePresence>
              {isHost && trollUsGameOpen && (
                <div className="absolute top-16 right-3 z-[70] pointer-events-auto">
                  <TrollUsGameController
                    streamId={streamId!}
                    onClose={() => { setTrollUsGameOpen(false); setActiveGame(null); }}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Game Picker Dropdown */}
            <AnimatePresence>
              {isHost && gamePickerOpen && (
                <div className="absolute top-16 right-3 z-[65] pointer-events-auto">
                  <GamePicker
                    activeGame={activeGame}
                    category={stream?.category}
                    onSelectGame={(game) => {
                      setActiveGame(game)
                      setGamePickerOpen(false)
                      if (game === 'troll_toe') {
                        trollToe.setControllerOpen(true)
                      }
                      if (game === 'trollopoly') {
                        trollopoly.createGame()
                      }
                    }}
                    onClose={() => setGamePickerOpen(false)}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Troll Toe Viewer UI */}
            <AnimatePresence>
              {!isHost && trollToe.match && trollToe.match.phase !== 'waiting' && (
                <TrollToeViewerUI
                  match={trollToe.match}
                  viewerStatus={trollToe.viewerStatus}
                  viewerTeam={trollToe.viewerTeam}
                  currentUserId={user?.id || anonymousViewerIdRef.current}
                  trollCoins={profile?.troll_coins || 0}
                  onJoinSide={trollToe.joinSide}
                  onUseFog={trollToe.useFog}
                  canUseFog={trollToe.canUseFog(user?.id || anonymousViewerIdRef.current)}
                />
              )}
            </AnimatePresence>

            {/* Trollopoly Lobby Overlay */}
            <AnimatePresence>
              {trollopoly.match && (trollopoly.match.phase === 'lobby' || trollopoly.match.phase === 'piece_selection') && (
                <TrollopolyLobby
                  match={trollopoly.match}
                  isHost={isHost}
                  currentUserId={user?.id}
                  availablePieces={trollopoly.availablePieces}
                  onJoin={trollopoly.joinGame}
                  onLeave={trollopoly.leaveGame}
                  onSelectPiece={trollopoly.selectPiece}
                  onStartGame={trollopoly.startGame}
                  onClose={() => { trollopoly.resetGame(); setActiveGame(null); }}
                />
              )}
            </AnimatePresence>

            {/* Trollopoly Board (Game View) */}
            <AnimatePresence>
              {trollopoly.match && trollopoly.match.phase === 'playing' && (
                <div className="fixed inset-0 z-40 bg-black">
                  {/* Board takes center space - video feeds overlay on top */}
                  <TrollopolyBoard
                    match={trollopoly.match}
                    currentUserId={user?.id}
                    isMyTurn={trollopoly.isMyTurn}
                    onRollDice={trollopoly.rollDice}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Trollopoly Controller (Host Only) */}
            <AnimatePresence>
              {isHost && trollopoly.match && trollopoly.match.status !== 'finished' && (
                <div className="absolute top-16 right-3 z-[60] pointer-events-auto">
                  <TrollopolyController
                    match={trollopoly.match}
                    onStartGame={trollopoly.startGame}
                    onEndGame={trollopoly.endGame}
                    onResetGame={trollopoly.resetGame}
                    onClose={() => { trollopoly.resetGame(); setActiveGame(null); }}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Trollopoly Viewer UI */}
            <AnimatePresence>
              {!isHost && trollopoly.match && (trollopoly.match.phase === 'playing' || trollopoly.match.status === 'finished') && (
                <TrollopolyViewerUI
                  match={trollopoly.match}
                  currentUserId={user?.id}
                  userBalance={profile?.troll_coins}
                />
              )}
            </AnimatePresence>

            {/* Gift Animation Overlay */}
            <GiftAnimationOverlay
              gifts={recentGifts}
              participantNames={Object.fromEntries(
                [
                  ...Object.entries(userProfiles).map(([id, profile]) => [id, profile.username || 'User'] as const),
                  ...Object.entries(giftNameMap),
                ]
              )}
              onAnimationComplete={(giftId) => {
                setRecentGifts(prev => prev.filter(g => g.id !== giftId));
              }}
            />

            {/* Glass Crack Full Page Effect */}
            <GlassCrackEffect />

            {/* TCPS Private Message Bubble */}
            {stream && <TCPSMessageBubble broadcasterId={stream.user_id} />}

            {/* Broadcast Ability Effects Overlay */}
            <BroadcastAbilityEffects activeEffects={abilityActiveEffects} />
            
            {/* Ability Box Floating Button */}
            {userAbilities.length > 0 && (
              <div className="absolute bottom-20 right-3 z-[50] pointer-events-auto">
                <button
                  onClick={() => setIsAbilityBoxOpen(true)}
                  className="relative bg-purple-600/90 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg shadow-purple-500/30 transition-all hover:scale-110"
                  title="Open Ability Box - Use abilities during broadcast"
                >
                  <Shield className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {userAbilities.reduce((sum, a) => sum + a.quantity, 0)}
                  </span>
                </button>
              </div>
            )}

            {/* Ticker Control Button + Panel (host only) - hide during active game */}
            {isHost && !isGameActive && (
              <>
                <DraggableWrapper
                  initialPos={{ x: 20, y: window.innerHeight - 180 }}
                >
                  <button
                    onClick={() => setIsTickerPanelOpen(!isTickerPanelOpen)}
                    className="relative bg-cyan-600/90 hover:bg-cyan-500 text-white p-3 rounded-full shadow-lg shadow-cyan-500/30 transition-all hover:scale-110"
                    title="Open Ticker Control - Send scrolling announcements"
                  >
                    <Zap className="w-5 h-5" />
                    {tickerSettings.is_enabled && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </button>
                </DraggableWrapper>

                <AnimatePresence>
                  {isTickerPanelOpen && (
                      <DraggableWrapper
                      initialPos={{ x: 12, y: Math.min(window.innerHeight - 420, window.innerHeight * 0.3) }}
                    >
                      <TickerControlPanel
                        onSendMessage={(content, category, isPriority, tags) => {
                          if (isPriority) {
                            tickerSendPriority(content, category, tags);
                          } else {
                            tickerSendMessage(content, category, false, tags);
                          }
                        }}
                        onBroadcastSettings={tickerBroadcastSettings}
                        onDeleteMessage={tickerDeleteMessage}
                        onClose={() => setIsTickerPanelOpen(false)}
                      />
                    </DraggableWrapper>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        }
        
        modals={
          <>
            <CoinStoreModal
              isOpen={isCoinStoreOpen}
              onClose={() => setIsCoinStoreOpen(false)}
            />
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
                
                // Record gift to recipient
                if (target.type === 'all') {
                  const allRecipients = [stream.user_id, ...activeUserIds];
                  for (const rid of allRecipients) {
                    if (rid !== user?.id) {
                      await supabase.from('stream_gifts').insert({
                        stream_id: streamId,
                        sender_id: user?.id,
                        recipient_id: rid,
                        gift_id: giftData.id,
                        amount: giftData.coinCost,
                        coins_spent: giftData.coinCost,
                        metadata: { gift_name: giftData.name, gift_icon: giftData.icon }
                      });
                    }
                  }
                } else {
                  const recipientId = target.userId || giftRecipientId || stream?.user_id || '';
                  if (recipientId !== user?.id) {
                    await supabase.from('stream_gifts').insert({
                      stream_id: streamId,
                      sender_id: user?.id,
                      recipient_id: recipientId,
                      gift_id: giftData.id,
                      amount: giftData.coinCost,
                      coins_spent: giftData.coinCost,
                      metadata: { gift_name: giftData.name, gift_icon: giftData.icon }
                    });
                  }
                }

                // Deduct coins
                await supabase.rpc('deduct_coins', { amount: totalAmount });

                // Trigger broadcast effects based on gift
                const giftId = giftData.id?.toLowerCase() || giftData.name?.toLowerCase() || '';
                if (giftId.includes('glass') || giftId.includes('breaker')) {
                  triggerGiftEffect('glass_breaker');
                } else if (giftId.includes('flame') || giftId.includes('fire')) {
                  triggerGiftEffect('troll_flame');
                } else if (giftId.includes('surge') || giftId.includes('city')) {
                  triggerGiftEffect('city_surge');
                } else if (giftId.includes('glitch')) {
                  triggerGiftEffect('glitch_king');
                } else {
                  // Default: boost heat bar for any gift
                  boostCityHeat(Math.ceil(totalAmount / 100));
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
            

            {/* Ability Box Modal */}
            <AbilityBox
              isOpen={isAbilityBoxOpen}
              onClose={() => setIsAbilityBoxOpen(false)}
              abilities={userAbilities}
              activeEffects={abilityActiveEffects}
              onActivate={async (abilityId, targetUserId, targetUsername) => {
                const success = await activateAbility(abilityId, targetUserId, targetUsername);
                if (success) setIsAbilityBoxOpen(false);
                return success;
              }}
              getCooldownRemaining={getCooldownRemaining}
              isEffectActive={isEffectActive}
              getEffectRemaining={getEffectRemaining}
              isInBroadcast={true}
              loading={abilityLoading}
            />
          </>
        }
      />

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          streamTitle={stream?.title}
          streamUrl={`${window.location.origin}/watch/${stream?.id}`}
          broadcasterName={broadcasterProfile?.username}
        />
    </ErrorBoundary>
  )
}

export default BroadcastPage
