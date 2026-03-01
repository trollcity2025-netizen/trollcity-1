import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { generateUUID } from '@/lib/uuid'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { PreflightStore } from '../../lib/preflightStore'

import { Stream } from '../../types/broadcast'
import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import BattleView from '../../components/broadcast/BattleView'
import BattleControls from '../../components/broadcast/BattleControls'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'
import GiftAnimationOverlay from '../../components/broadcast/GiftAnimationOverlay'
import PinnedProductOverlay from '../../components/broadcast/PinnedProductOverlay'
import PinProductModal from '../../components/broadcast/PinProductModal'
import { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { useBroadcastPinnedProducts } from '../../hooks/useBroadcastPinnedProducts'
import {
  getCategoryConfig,
  supportsBattles,
  getMatchingTerminology,
} from '../../config/broadcastCategories'

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStreamSeats } from '../../hooks/useStreamSeats'

import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser
} from 'agora-rtc-sdk-ng'

function BroadcastPage() {
  /** ROUTER PARAM FIX */
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [localTracks, setLocalTracks] =
    useState<[IMicrophoneAudioTrack, ICameraVideoTrack, ICameraVideoTrack?, ICameraVideoTrack?] | null>(null)

  // Camera overlay state for screen share PiP
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const [remoteUsers, setRemoteUsers] =
    useState<IAgoraRTCRemoteUser[]>([])
  
  // Ref for remoteUsers to access in cleanup without triggering re-runs
  const remoteUsersRef = useRef<IAgoraRTCRemoteUser[]>([])
  useEffect(() => {
    remoteUsersRef.current = remoteUsers
  }, [remoteUsers])

  // Track mapping from user IDs to Agora UIDs
  const [userIdToAgoraUid, setUserIdToAgoraUid] = useState<Record<string, number>>({})


  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isBattleMode, setIsBattleMode] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)

  // Generate a unique viewer ID for anonymous users
  const viewerIdRef = useRef<string>(`viewer-${generateUUID()}`)
  const effectiveUserId = user?.id || viewerIdRef.current

  // Ref to store handleStreamEnd to avoid temporal dead zone
  const handleStreamEndRef = useRef<() => Promise<void>>()

  // UI State for mic/camera - forces UI update even if Agora fails
  const [isMicOn, setIsMicOn] = useState(false)
  const [isCamOn, setIsCamOn] = useState(false)
  const [isOnStage, setIsOnStage] = useState(false)
  const [showStreamSummary, setShowStreamSummary] = useState(false)
  const [streamStats, setStreamStats] = useState<any>(null)
  
  // Box count state - moved to parent for instant sync across all components
  const [boxCount, setBoxCount] = useState(stream?.box_count || 1)
  
  // Sync boxCount when stream data updates
  useEffect(() => {
    if (stream?.box_count !== undefined) {
      setBoxCount(stream.box_count);
    }
  }, [stream?.box_count]);
  
  // Mux WHIP streaming ref
  const muxWhipPcRef = useRef<RTCPeerConnection | null>(null)
  const isStreamingToMuxRef = useRef(false)
  const hasJoinedRef = useRef(false)
  
  // Gift system state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
  const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
  const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))

  // Pin product modal state
  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)

  // Callback to get user positions from BroadcastGrid
  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  // Stop local camera and mic tracks and leave Agora channel (async)
  const stopLocalTracks = useCallback(async () => {
    console.log('[BroadcastPage] stopLocalTracks called, localTracks:', localTracks ? 'exists' : 'null');

    // Stop ALL browser media tracks (comprehensive cleanup)
    try {
      console.log('[BroadcastPage] Stopping ALL browser media tracks');
      // Get all media devices and stop them
      const streams = await navigator.mediaDevices?.enumerateDevices?.() || [];
      
      // Also try to get and stop any active tracks from existing streams
      if (window.stream) {
        window.stream.getTracks().forEach(track => {
          console.log('[BroadcastPage] Stopping window.stream track:', track.kind);
          track.stop();
        });
      }
    } catch (e) {
      console.warn('[BroadcastPage] Error stopping browser tracks:', e);
    }

    // Attempt to unpublish before stopping/closing tracks
    const client = agoraClientRef.current;
    if (client && localTracks && localTracks.length > 0) {
      try {
        console.log('[BroadcastPage] Unpublishing local tracks before stop');
        // Unpublish accepts array of tracks
        // @ts-expect-error - sdk typings may vary
        await client.unpublish(localTracks).catch((e: any) => {
          console.warn('[BroadcastPage] unpublish error:', e);
        });
      } catch (e) {
        console.warn('[BroadcastPage] Error during unpublish:', e);
      }
    }

    // Stop Agora tracks
    if (localTracks) {
      console.log('[BroadcastPage] Stopping local tracks, count:', localTracks.length);
      for (let i = 0; i < localTracks.length; i++) {
        const track = localTracks[i];
        if (track) {
          try {
            console.log('[BroadcastPage] Stopping track', i, 'type:', track.trackMediaType);
            // Disable first (stops sending)
            if (typeof track.setEnabled === 'function') {
              await track.setEnabled(false);
            }
            // Then stop (releases device)
            track.stop();
            // Then close (cleanup)
            if (typeof track.close === 'function') {
              track.close();
            }
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping track:', e);
          }
        }
      }
      setLocalTracks(null);
    }

    // Also check for any tracks in the media elements
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('[BroadcastPage] Stopping video element track:', track.kind);
          track.stop();
        });
        video.srcObject = null;
      }
    });

    // Leave the Agora channel
    if (client) {
      try {
        console.log('[BroadcastPage] Leaving Agora channel');
        await client.leave();
        agoraClientRef.current = null;
        hasJoinedRef.current = false;
      } catch (leaveErr) {
        console.warn('[BroadcastPage] Error leaving Agora channel:', leaveErr);
      }
    }

    // FORCE UI STATE RESET - Even if Agora fails, UI must reflect disconnected state
    setIsMicOn(false);
    setIsCamOn(false);
    setIsOnStage(false);
    console.log('[BroadcastPage] UI state reset: mic/cam/stage off');
  }, [localTracks]);

  // Manual refresh function to force reload stream data
  const refreshStream = useCallback(async () => {
    if (!streamId) return;
    console.log('[BroadcastPage] Manual refresh - fetching stream data');
    const { data, error } = await supabase
      .from('streams')
      .select('*')
      .eq('id', streamId)
      .single();
    
    if (error) {
      console.error('[BroadcastPage] Refresh error:', error);
      return;
    }
    
    console.log('[BroadcastPage] Refreshed stream data, box_count:', data.box_count);
    setStream(data);
  }, [streamId]);

  // Async variant to ensure we unpublish and leave Agora before proceeding
  // Using ref to avoid dependency issues
  const stopLocalTracksAsync = useCallback(async () => {
    const client = agoraClientRef.current;
    try {
      if (client && localTracks && localTracks.length > 0) {
        try {
          // @ts-expect-error - sdk typings may vary
          await client.unpublish(localTracks).catch((e: any) => console.warn('[stopLocalTracksAsync] unpublish error', e));
        } catch (e) {
          console.warn('[stopLocalTracksAsync] unpublish thrown', e);
        }
      }

      if (localTracks) {
        localTracks.forEach(track => {
          try {
            track.stop();
            if (typeof track.close === 'function') track.close();
          } catch (e) {
            console.warn('[stopLocalTracksAsync] track stop error', e);
          }
        });
        setLocalTracks(null);
      }

      if (client) {
        try {
          await client.leave();
        } catch (e) {
          console.warn('[stopLocalTracksAsync] leave error', e);
        }
      }

      // FORCE UI STATE RESET - Even if Agora fails
      setIsMicOn(false);
      setIsCamOn(false);
      setIsOnStage(false);
    } catch (err) {
      console.warn('[stopLocalTracksAsync] unexpected error', err);
    }
  }, [localTracks]); // Include localTracks dependency

  // Determine host status early (needed for pinned products hook)
  const isHost = stream?.user_id === user?.id

  // Pinned products hook
  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)
  const channelRefInitializedRef = useRef(false)
  
  // Refs for subscription retry logic to prevent memory leaks and concurrent attempts
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryDelayRef = useRef<number>(5000)
  const isRetryingRef = useRef<boolean>(false)

  // Update streamRef when stream changes - using useEffect to avoid updating during render
  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  /** STREAM SEATS */
  const { seats, mySession: userSeat, joinSeat, leaveSeat } =
    useStreamSeats(stream?.id, user?.id, broadcasterProfile, stream)

  const canPublish = isHost || !!userSeat
  const mode = userSeat ? 'stage' : 'viewer'

  // Track if user just joined a seat (for triggering Agora init)
  const justJoinedSeatRef = useRef(false);
  const previousUserSeatRef = useRef(userSeat);

  // Track stage status for UI state
  useEffect(() => {
    const onStage = !!userSeat || isHost;
    setIsOnStage(onStage);
    console.log('[BroadcastPage] Stage status updated:', onStage);
  }, [userSeat, isHost]);

  // Cleanup function for media session - runs when stream ends or component unmounts
  const cleanupMediaSession = useCallback(async () => {
    console.log('[BroadcastPage] cleanupMediaSession called');

    try {
      // Stop ALL browser media tracks FIRST
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const streams = await navigator.mediaDevices.enumerateDevices();
          console.log('[BroadcastPage] Enumerated devices for cleanup');
        } catch (e) {
          console.warn('[BroadcastPage] Error enumerating devices:', e);
        }
      }

      // Stop any tracks in window.stream
      if ((window as any).stream) {
        try {
          (window as any).stream.getTracks().forEach((track: MediaStreamTrack) => {
            console.log('[BroadcastPage] Stopping window.stream track:', track.kind);
            track.stop();
          });
          (window as any).stream = null;
        } catch (e) {
          console.warn('[BroadcastPage] Error stopping window.stream:', e);
        }
      }

      // Stop all video element tracks
      try {
        document.querySelectorAll('video').forEach(video => {
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              console.log('[BroadcastPage] Stopping video element track:', track.kind);
              track.stop();
            });
            video.srcObject = null;
          }
        });
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping video elements:', e);
      }
    } catch (e) {
      console.warn('[BroadcastPage] Error in browser media cleanup:', e);
    }

    // Leave Agora channel
    const client = agoraClientRef.current;
    if (client) {
      try {
        console.log('[BroadcastPage] Leaving Agora channel');
        await client.leave();
        agoraClientRef.current = null;
        hasJoinedRef.current = false;
      } catch (e) {
        console.warn('[BroadcastPage] Error leaving Agora:', e);
      }
    }

    // Stop and close local tracks
    if (localTracks) {
      console.log('[BroadcastPage] Stopping local tracks');
      for (const track of localTracks) {
        if (track) {
          try {
            await track.setEnabled(false);
            track.stop();
            track.close();
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping track:', e);
          }
        }
      }
      setLocalTracks(null);
    }

    // Reset UI state
    setIsMicOn(false);
    setIsCamOn(false);
    setIsOnStage(false);

    // Clear PreflightStore
    try {
      PreflightStore.clear();
    } catch (e) {
      console.warn('[BroadcastPage] Error clearing PreflightStore:', e);
    }

    console.log('[BroadcastPage] cleanupMediaSession complete');
  }, [localTracks]);

  // Wrap leaveSeat to also cleanup media tracks when leaving
  const handleLeaveSeat = useCallback(async () => {
    console.log('[BroadcastPage] handleLeaveSeat called - cleaning up media and leaving seat');
    // Stop media tracks first
    await cleanupMediaSession();
    // Then leave the seat in the database
    await leaveSeat();
  }, [leaveSeat, cleanupMediaSession]);

  // Effect to handle Agora initialization when guest joins a seat
  // AND cleanup when user loses seat (kicked or stream ended)
  useEffect(() => {
    const hadSeat = !!previousUserSeatRef.current;
    const hasSeatNow = !!userSeat;

    // User just joined a seat - trigger Agora init
    if (!hadSeat && hasSeatNow && justJoinedSeatRef.current) {
      console.log('[BroadcastPage] Guest joined seat - allowing Agora init');
      justJoinedSeatRef.current = false;
    }
    
    // User lost their seat (kicked or stream ended) - cleanup media
    // Only if not host (hosts have different cleanup path via handleStreamEnd)
    if (hadSeat && !hasSeatNow && !isHost) {
      console.log('[BroadcastPage] User lost seat - cleaning up media tracks');
      cleanupMediaSession();
    }

    // Update the ref for next comparison
    previousUserSeatRef.current = userSeat;
  }, [userSeat, isHost, cleanupMediaSession]);

  // Handle guest joining - prevent page refresh and redirect to signup
  const handleGuestJoinAttempt = useCallback(() => {
    // If no user, redirect to signup (this prevents page refresh)
    if (!user) {
      // Use replace to avoid adding to history stack and prevent refresh behavior
      navigate('/auth?mode=signup&redirect=' + encodeURIComponent(window.location.pathname), { replace: true });
      return;
    }
    // If user exists but tries to join as guest, show message
    toast.info('Please sign up or log in to join the stage');
  }, [user, navigate]);

  // Wrap joinSeat to track when user joins and handle guests properly
  const handleJoinSeat = useCallback(async (index: number, price: number) => {
    console.log('[BroadcastPage] handleJoinSeat called for seat', index, 'price:', price);
    
    // Check if user is logged in
    if (!user) {
      handleGuestJoinAttempt();
      return;
    }
    
    justJoinedSeatRef.current = true;
    return joinSeat(index, price);
  }, [joinSeat, user, handleGuestJoinAttempt]);

  /** FETCH STREAM */
  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setIsLoading(false)
      return
    }

    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle()

      if (error || !data) {
        setError('Stream not found.')
        toast.error('Stream not found.')
        navigate('/')
        return
      }

      console.log('[BroadcastPage] Fetched stream, initial box_count:', data.box_count);
      setStream(data)

      // Fetch broadcaster profile
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

      if (data.status === 'ended') {
        console.log('[BroadcastPage] Stream already ended, showing summary');
        // Set stream data first so we can show proper summary
        setStream(data);
        // Show summary instead of navigating away
        setStreamStats({
          title: data.title || 'Stream Ended',
          viewers: data.current_viewers || data.viewer_count || 0,
          likes: data.total_likes || 0,
          gifts: data.gifts_value || 0,
          duration: 0,
          participants: 0
        });
        setShowStreamSummary(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(false)
    }

    fetchStream()
  }, [streamId, navigate, user?.id, stopLocalTracks])

  // Cleanup effect: ensure clean disconnect when component unmounts or navigating away
  useEffect(() => {
    return () => {
      // ALWAYS cleanup when component unmounts - don't wait for stream to end
      console.log('[BroadcastPage] Component unmounting - cleaning up all media');
      
      // Stop all local tracks
      if (localTracks) {
        localTracks.forEach((track) => {
          if (track) {
            try {
              track.stop();
              if (typeof track.close === 'function') {
                track.close();
              }
            } catch (e) {
              console.warn('[BroadcastPage] Cleanup track error:', e);
            }
          }
        });
      }
      
      // Stop all remote audio tracks that might be playing
      remoteUsersRef.current.forEach(remoteUser => {
        if (remoteUser.audioTrack) {
          try {
            remoteUser.audioTrack.stop();
          } catch (e) {
            console.warn('[BroadcastPage] Cleanup remote audio error:', e);
          }
        }
        if (remoteUser.videoTrack) {
          try {
            remoteUser.videoTrack.stop();
          } catch (e) {
            console.warn('[BroadcastPage] Cleanup remote video error:', e);
          }
        }
      });
      
      // Leave Agora channel
      const client = agoraClientRef.current;
      if (client) {
        try {
          client.leave();
          agoraClientRef.current = null;
          hasJoinedRef.current = false;
        } catch (e) {
          console.warn('[BroadcastPage] Cleanup leave error:', e);
        }
      }
      
      // Remove Supabase channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.warn('[BroadcastPage] Cleanup channel error:', e);
        }
      }
      
      // Clear PreflightStore to stop any lingering streams
      PreflightStore.clear();
    };
  }, [localTracks]);

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
              await localTracks[0].setEnabled(false);
              toast.error('Host microphone was muted by officer control');
            } catch (err) {
              console.error('[BroadcastPage] Failed to enforce host mic mute:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(moderationChannel);
    };
  }, [isHost, stream?.user_id, localTracks]);



  /** REALTIME STREAM UPDATES */
  // Use a persistent ref so channel is created only once - prevents reconnection loops
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  useEffect(() => {
    if (!streamId) return;
    
    // Prevent recreating channel on rerenders
    if (realtimeChannelRef.current) {
      console.log('[Realtime] Channel already exists, skipping creation');
      return;
    }

    console.log('[Realtime] Setting up channel for stream:', streamId);
    const channel = supabase.channel(`stream:${streamId}`);
    realtimeChannelRef.current = channel;

    // Track presence to keep channel alive and detect when broadcaster goes live
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('[Realtime] Presence sync:', state);
        
        // Count all users in presence (includes viewers)
        let totalUsers = 0;
        for (const [key, users] of Object.entries(state)) {
          totalUsers += (users as any[]).length;
        }
        setViewerCount(totalUsers);
        
        // Check if broadcaster is now live
        for (const [key, users] of Object.entries(state)) {
          for (const user of users as any[]) {
            if (user.is_host) {
              console.log('[Realtime] Broadcaster is live!');
              // Trigger a re-fetch of stream to ensure we have latest status
              break;
            }
          }
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        for (const p of newPresences as any[]) {
          if (p.is_host) {
            console.log('[Realtime] Broadcaster joined - stream is live!');
          }
        }
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

          // Always update stream state when we receive a change
          // This ensures all clients (host, guests, viewers) stay in sync
          console.log('[Realtime] Stream update received:', {
            box_count: payload.new.box_count,
            status: payload.new.status,
            has_rgb_effect: payload.new.has_rgb_effect
          });
          
          try {
            setStream((prev: any) => {
              if (!prev) return prev;
              // Merge all new properties to ensure sync across all clients
              return {
                ...prev,
                ...payload.new,
                // Ensure critical fields are updated
                box_count: payload.new.box_count ?? prev.box_count,
                status: payload.new.status ?? prev.status,
                has_rgb_effect: payload.new.has_rgb_effect ?? prev.has_rgb_effect,
                are_seats_locked: payload.new.are_seats_locked ?? prev.are_seats_locked,
                total_likes: payload.new.total_likes ?? prev.total_likes,
                gifts_value: payload.new.gifts_value ?? prev.gifts_value
              };
            });
            // Stream ended - trigger summary for ALL users (host, guests, viewers)
            if (payload.new.status === 'ended') {
              console.log('[BroadcastPage] Stream ended detected via realtime, showing summary for all users');
              // Show summary immediately - no delay
              handleStreamEndRef.current?.();
            }
          } catch (err) {
            console.error('[Realtime] Error processing stream update:', err);
          }
        }
      )
      // Listen for custom box_count_changed events (more reliable than postgres_changes)
      .on(
        'broadcast',
        { event: 'box_count_changed' },
        (payload) => {
          try {
            const boxData = payload.payload;
            console.log('[Realtime] VIEWER: Received box_count_changed event:', boxData);
            console.log('[Realtime] VIEWER: Current stream box_count:', streamRef.current?.box_count);
            
            if (boxData && boxData.box_count !== undefined) {
              setStream((prev: any) => {
                if (!prev) return prev;
                return { ...prev, box_count: boxData.box_count };
              });
              console.log('[Realtime] VIEWER: Box count updated successfully');
            }
          } catch (err) {
            console.error('[Realtime] VIEWER: Error processing box_count_changed:', err);
          }
        }
      )
      // Listen for gift events - this works for ALL users including broadcaster
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          try {
            const giftData = payload.payload;
            console.log('[BroadcastPage] Gift received:', giftData);
            console.log('[BroadcastPage] Current user is host:', isHost);
            console.log('[BroadcastPage] Receiver ID:', giftData.receiver_id);
            console.log('[BroadcastPage] Current user ID:', user?.id);
            
            // Always show gift animations - for viewers when they send gifts,
            // and for broadcaster when they receive gifts
            const newGift: BroadcastGift = {
              id: giftData.id || `gift-${Date.now()}`,
              gift_id: giftData.gift_id,
              gift_name: giftData.gift_name,
              gift_icon: giftData.gift_icon || '🎁',
              amount: giftData.amount,
              sender_id: giftData.sender_id,
              sender_name: giftData.sender_name || 'Someone',
              receiver_id: giftData.receiver_id,
              created_at: giftData.timestamp || new Date().toISOString(),
            };
            
            console.log('[BroadcastPage] Adding gift to recentGifts:', newGift);
            setRecentGifts(prev => [...prev, newGift]);
          } catch (err) {
            console.error('[BroadcastPage] Error processing gift:', err);
          }
        }
      )
      // Listen for like events
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          try {
            console.log('[BroadcastPage] Like received:', payload.payload);
            // Trigger a UI update for likes - the stream subscription will handle the actual count
            setStream((prev: any) => prev ? { ...prev, total_likes: (prev.total_likes || 0) + 1 } : null);
          } catch (err) {
            console.error('[BroadcastPage] Error processing like:', err);
          }
        }
      )
      // Listen for stream ended broadcast (faster than postgres_changes)
    .on(
      'broadcast',
      { event: 'stream_ended' },
      (payload) => {
        try {
          console.log('[BroadcastPage] Stream ended broadcast received:', payload.payload);
          // Immediately show summary - this is faster than waiting for postgres_changes
          handleStreamEndRef.current?.();
        } catch (err) {
          console.error('[BroadcastPage] Error processing stream_ended broadcast:', err);
        }
      }
    )
      .subscribe((status) => {
        console.log('[Realtime] Full subscription status:', status, 'for channel:', `stream:${streamId}`);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Subscription SUCCESSFUL - channel is ready for broadcast events');
          
          // Store channel reference for use in handleBoxCountChange
          channelRef.current = channel;
          channelRefInitializedRef.current = true;
          
          // Track presence to keep channel alive
          channel.track({
            user_id: effectiveUserId,
            username: profile?.username || user?.email || 'Viewer',
            is_host: isHost,
            online_at: new Date().toISOString(),
            avatar_url: profile?.avatar_url || ''
          }).catch(console.error);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ Subscription FAILED - viewers will NOT receive updates!');
          // Clear any existing retry timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          // Exponential backoff for reconnection attempts
          const maxDelay = 10000;
          const baseDelay = 1000;
          retryDelayRef.current = baseDelay;
          
          const attemptRetry = () => {
            if (isRetryingRef.current) return;
            isRetryingRef.current = true;
            
            console.log('[BroadcastPage] Attempting to resubscribe (delay: ' + retryDelayRef.current + 'ms)...');
            channel.subscribe();
            // Re-track presence after reconnect
            channel.track({
              user_id: effectiveUserId,
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, maxDelay);
            isRetryingRef.current = false;
          };
          retryTimeoutRef.current = setTimeout(attemptRetry, retryDelayRef.current);
        } else if (status === 'CLOSED') {
          console.warn('[Realtime] ⚠️ Subscription CLOSED - attempting to resubscribe');
          // Clear any existing retry timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          // Longer delay to avoid rapid reconnection attempts
          const maxDelay = 30000;
          const baseDelay = 5000;
          retryDelayRef.current = baseDelay;
          
          const attemptRetry = async () => {
            if (isRetryingRef.current) return;
            isRetryingRef.current = true;
            
            console.log('[BroadcastPage] Attempting to reconnect after close (delay: ' + retryDelayRef.current + 'ms)...');
            try {
              await channel.subscribe();
            } catch (subErr) {
              console.warn('[BroadcastPage] Resubscribe error:', subErr);
            }
            // Re-track presence after reconnect
            channel.track({
              user_id: effectiveUserId,
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry (exponential backoff)
            retryDelayRef.current = Math.min(retryDelayRef.current * 1.5, maxDelay);
            isRetryingRef.current = false;
          };
          retryTimeoutRef.current = setTimeout(attemptRetry, retryDelayRef.current);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] ⚠️ Subscription TIMED_OUT - attempting to resubscribe');
          // Clear any existing retry timeout to prevent concurrent attempts
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          // Don't retry if already retrying
          if (isRetryingRef.current) {
            console.log('[BroadcastPage] Already retrying, skipping duplicate attempt');
            return;
          }
          
          // Longer delay for timeout
          const maxDelay = 30000;
          const baseDelay = 5000;
          retryDelayRef.current = baseDelay;
          
          const attemptRetry = () => {
            console.log('[BroadcastPage] Attempting to reconnect after timeout (delay: ' + retryDelayRef.current + 'ms)...');
            channel.subscribe();
            // Re-track presence after reconnect
            channel.track({
              user_id: effectiveUserId,
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry (exponential backoff)
            retryDelayRef.current = Math.min(retryDelayRef.current * 1.5, maxDelay);
            isRetryingRef.current = false;
          };
          isRetryingRef.current = true;
          retryTimeoutRef.current = setTimeout(attemptRetry, retryDelayRef.current);
        }
      });

    return () => {
        // Clear any pending retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        isRetryingRef.current = false;
        // Only unsubscribe, don't removeChannel repeatedly
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.unsubscribe();
          realtimeChannelRef.current = null;
        }
      };
    }, [streamId]);

  /** AGORA INIT */
  useEffect(() => {
    if (!stream || !user) {
      return;
    }

    let mounted = true;
    let client = agoraClientRef.current;

    const initAndManageAgora = async () => {
      if (!client) {
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClientRef.current = client;

        // Setup listeners only once when the client is created
        client.on('user-published', async (remoteUser, mediaType) => {
          if (!mounted) return;
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play();
          }
          setRemoteUsers(prev => [...prev.filter(u => u.uid !== remoteUser.uid), remoteUser]);
        });

        client.on('user-unpublished', remoteUser => {
          if (!mounted) return;
          setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid));
        });
      }

      // Join the channel if not already joined
      if (!hasJoinedRef.current) {
        // Agora v4 only supports "host" and "audience" roles
        const role = canPublish ? 'host' : 'audience';
        console.log(`[BroadcastPage] Joining Agora with initial role: ${role}`);
        
        const stringToUid = (str: string): number => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        };
        const numericUid = stringToUid(user.id);

        try {
          const { data, error } = await supabase.functions.invoke('agora-token', {
            body: { channel: stream.id, uid: numericUid, role },
          });

          if (error || !data?.token) throw new Error('Failed to get Agora token');

          const appId = import.meta.env.VITE_AGORA_APP_ID;
          if (!appId) throw new Error('Agora App ID not configured');

          await client.join(appId, stream.id, data.token, numericUid);
          if (!mounted) return;
          hasJoinedRef.current = true;
          console.log(`[BroadcastPage] Agora client joined as ${role}`);
        } catch (err) {
          console.error('[BroadcastPage] Agora join error:', err);
          return; // Stop execution if join fails
        }
      }

      // Manage role and tracks based on canPublish state
      if (canPublish) {
        // Agora v4 uses "host" role for publishers
        if (client.clientRole !== 'host') {
          await client.setClientRole('host');
        }
        if (!localTracks) { // Only create and publish if tracks don't exist
          try {
            console.log('[BroadcastPage] Creating and publishing tracks...');
            const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
            if (!mounted) { tracks.forEach(t => t.close()); return; }
            await tracks[0].setEnabled(true); // Mic
            await tracks[1].setEnabled(true); // Cam
            setLocalTracks(tracks);
            await client.publish(tracks);
            console.log('[BroadcastPage] Tracks published successfully.');
          } catch (err) {
            console.error('[BroadcastPage] Error creating/publishing tracks:', err);
          }
        }
      } else { // Not a publisher, should be audience
        // Agora v4 uses "audience" role for subscribers
        if (client.clientRole !== 'audience') {
          await client.setClientRole('audience');
        }
        if (localTracks) { // Unpublish and clean up tracks if they exist
          console.log('[BroadcastPage] Unpublishing and stopping local tracks.');
          await client.unpublish(localTracks);
          localTracks.forEach(track => {
            track.stop();
            track.close();
          });
          setLocalTracks(null);
        }
      }
    };

    initAndManageAgora();

    return () => {
      mounted = false;
      // Don't cleanup on normal re-renders, only when stream truly ends
      // The cleanup should happen via stopLocalTracks when stream ends
    };
  }, [stream?.id, user?.id, canPublish]);

  /** CAMERA / MIC */
  const toggleCamera = async () => {
    if (!localTracks) return
    const newState = !localTracks[1].enabled
    await localTracks[1].setEnabled(newState)
    setIsCamOn(newState) // Track UI state
    console.log('[BroadcastPage] Camera toggled:', newState)
  }

  const toggleMicrophone = async () => {
    if (!localTracks) return
    const shouldEnable = !localTracks[0].enabled
    if (isHost && hostMicMutedByOfficer && shouldEnable) {
      toast.error('Host microphone is muted by officer control')
      return
    }
    await localTracks[0].setEnabled(shouldEnable)
    setIsMicOn(shouldEnable) // Track UI state
    console.log('[BroadcastPage] Microphone toggled:', shouldEnable)
  }

  useEffect(() => {
    if (!isHost || !hostMicMutedByOfficer || !localTracks?.[0]?.enabled) return;
    localTracks[0].setEnabled(false).catch((err) => {
      console.error('[BroadcastPage] Failed to force-disable host mic:', err);
    });
  }, [isHost, hostMicMutedByOfficer, localTracks]);

  const onGift = (userId: string) => {
    setGiftRecipientId(userId);
    setIsGiftModalOpen(true);
  }

  const onGiftAll = (ids: string[]) => {
    toast.info(`Gift sent to ${ids.length} users`)
  }

  const handleBoxCountChange = useCallback(async (newCount: number) => {
    try {
      // Use streamRef to get the current stream
      const currentStream = streamRef.current;
      if (!currentStream) {
        console.log('[BoxCount] ERROR: No current stream');
        return;
      }

      // Don't update if the value hasn't changed
      if (currentStream.box_count === newCount) {
        console.log('[BoxCount] No change needed - same value');
        return;
      }

      console.log('[BoxCount] === BROADCASTER: Button clicked - updating from', currentStream.box_count, 'to', newCount);

      // Immediately update local state for instant UI feedback
      setStream((prev: any) => {
        if (!prev) return null;
        const updated = { ...prev, box_count: newCount };
        console.log('[BoxCount] BROADCASTER: Local state updated:', updated.box_count);
        return updated;
      });

      // Use the channel from the ref - this is the SAME channel used for receiving
      // This channel should already be subscribed with all the listeners
      const broadcastChannel = channelRef.current;
      
      console.log('[BoxCount] BROADCASTER: Current channel state:', { 
        hasChannel: !!broadcastChannel, 
        isInitialized: channelRefInitializedRef.current 
      });

      // If channel exists and is initialized, use it
      if (broadcastChannel && channelRefInitializedRef.current) {
        try {
          // Send the broadcast - this goes to ALL clients on the same channel
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'box_count_changed',
            payload: { box_count: newCount, stream_id: currentStream.id }
          });
          console.log('[BoxCount] BROADCASTER: Broadcast sent via existing channel');
        } catch (sendErr) {
          console.error('[BoxCount] BROADCASTER: Error sending broadcast:', sendErr);
        }
      } else {
        console.warn('[BoxCount] BROADCASTER: Channel not ready, skipping broadcast');
      }

      // Also update database - viewers should get this via postgres_changes
      try {
        console.log('[BoxCount] BROADCASTER: Updating database with box_count:', newCount);
        const { error } = await supabase
          .from('streams')
          .update({ box_count: newCount })
          .eq('id', currentStream.id);

        if (error) {
          console.error('[BoxCount] BROADCASTER: Database error:', error);
          return;
        }
        
        console.log('[BoxCount] BROADCASTER: Database updated successfully');
      } catch (dbErr) {
        console.error('[BoxCount] BROADCASTER: Database exception:', dbErr);
      }
    } catch (err) {
      console.error('[BoxCount] BROADCASTER: Top-level exception:', err);
    }
  }, []);

  const handleLike = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    if (isHost) {
        toast.error("Broadcasters cannot like their own broadcast");
        return;
    }

    try {
        // Try to insert into stream_likes if table exists
        const { error } = await supabase.from('stream_likes').insert({
            stream_id: stream.id,
            user_id: user.id
        });

        if (error) {
            // If duplicate like (unique constraint), maybe just ignore or toggle?
            // Assuming we just want to count likes, we might ignore unique constraint errors
            if (error.code !== '23505') { // 23505 is unique violation
                console.error("Like error:", error);
            }
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleStreamEnd = useCallback(async () => {
    console.log('[BroadcastPage] handleStreamEnd called for user:', user?.id, 'isHost:', isHost);
    
    // Prevent multiple executions
    if (showStreamSummary) {
      console.log('[BroadcastPage] Stream summary already showing, skipping duplicate');
      return;
    }

    // Collect stats before cleanup
    const stats = {
      title: stream?.title || 'Stream Ended',
      viewers: viewerCount || remoteUsers.length || 0,
      likes: (stream as any)?.total_likes || 0,
      gifts: (stream as any)?.gifts_value || 0,
      duration: stream?.started_at ? Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000) : 0,
      participants: Object.keys(seats).length + 1 // +1 for host
    };
    setStreamStats(stats);

    // Run comprehensive cleanup
    await cleanupMediaSession();

    // If host, update stream status to ended AND broadcast to all viewers immediately
    if (stream?.id && isHost) {
      try {
        // Send broadcast FIRST (faster than DB update) to notify all viewers immediately
        if (channelRef.current && channelRefInitializedRef.current) {
          console.log('[BroadcastPage] Host broadcasting stream_ended event');
          await channelRef.current.send({
            type: 'broadcast',
            event: 'stream_ended',
            payload: { stream_id: stream.id, ended_at: new Date().toISOString() }
          });
        }
        
        // Then update database
        await supabase.from('streams').update({ is_live: false, status: 'ended' }).eq('id', stream.id);
        console.log('[BroadcastPage] Stream status updated to ended');
      } catch (err) {
        console.error('[BroadcastPage] Error updating stream status:', err);
      }
    }

    // Show stream summary for ALL users (host, guests, viewers) - THIS MUST RUN FOR EVERYONE
    console.log('[BroadcastPage] Showing stream summary for user:', user?.id);
    setShowStreamSummary(true);
    console.log('[BroadcastPage] Stream summary shown');
  }, [stream, viewerCount, remoteUsers.length, seats, isHost, user?.id, cleanupMediaSession, showStreamSummary]);

  // Store handleStreamEnd in ref so realtime subscription can access it
  useEffect(() => {
    handleStreamEndRef.current = handleStreamEnd;
  }, [handleStreamEnd]);

  /** LOADING */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Joining stream...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Go Home
        </button>
      </div>
    )
  }

  if (!stream) return null

  // Get category-specific configuration
  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const categorySupportsBattles = supportsBattles(stream.category || 'general');
  const categoryMatchingTerm = getMatchingTerminology(stream.category || 'general');

  // If battle mode, show battle view
  if (stream.is_battle) {
    return (
      <BattleView
        battleId={stream.battle_id}
        currentStreamId={stream.id}
        localTracks={localTracks}
      />
    )
  }

  if (isJoining) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  // Determine stream mode for layout
  const streamMode = isHost ? 'host' : 'viewer';

  return (
    <ErrorBoundary>
      <StreamLayout
        mode={streamMode}
        isChatOpen={isChatOpen}
        
        // Header with stream info
        header={
          <BroadcastHeader
            stream={stream}
            isHost={isHost}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteUsers.length}
            handleLike={handleLike}
            onStartBattle={isHost && categorySupportsBattles ? () => setIsBattleMode(true) : undefined}
            categoryBattleTerm={categorySupportsBattles ? categoryMatchingTerm : undefined}
            onBack={() => {
              // If host, stop stream before leaving
              if (isHost) {
                handleStreamEnd();
              } else {
                navigate('/');
              }
            }}
          />
        }
        
        // Main video grid
        videoGrid={
          <BroadcastGrid
            stream={stream}
            seats={seats}
            onJoinSeat={(index) =>
              handleJoinSeat(index, stream.seat_price)
            }
            isHost={isHost}
            localTracks={
              localTracks
                ? [localTracks[1], localTracks[0]]
                : [undefined, undefined]
            }
            remoteUsers={remoteUsers}
            localUserId={user?.id}
            userIdToAgoraUid={userIdToAgoraUid}
            onGift={onGift}
            onGiftAll={onGiftAll}
            toggleCamera={toggleCamera}
            toggleMicrophone={toggleMicrophone}
            onGetUserPositions={handleGetUserPositions}
            broadcasterProfile={broadcasterProfile}
            streamStatus={stream.status}
          />
        }
        
        // Battle controls (if active)
        battleControls={isBattleMode ? <BattleControls currentStream={stream} /> : null}
        
        // Bottom controls
        controls={
          <BroadcastControls
            stream={stream}
            isHost={isHost}
            isOnStage={isOnStage}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteUsers.length}
            chatOpen={isChatOpen}
            toggleChat={() => setIsChatOpen(!isChatOpen)}
            onGiftHost={() => onGift(stream.user_id)}
            onLeave={handleLeaveSeat}
            onBoxCountUpdate={handleBoxCountChange}
            onStreamEnd={handleStreamEnd}
            handleLike={handleLike}
            toggleBattleMode={() => setIsBattleMode(!isBattleMode)}
            localTracks={localTracks}
            toggleCamera={toggleCamera}
            toggleMicrophone={toggleMicrophone}
            onPinProduct={() => setIsPinProductModalOpen(true)}
            isMicOn={isMicOn}
            isCamOn={isCamOn}
            boxCount={boxCount}
            setBoxCount={setBoxCount}
          />
        }
        
        // Chat sidebar
        chat={
          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={isHost}
            isViewer={!userSeat && !isHost}
            isGuest={!user}
          />
        }
        
        // Overlays (gift animations, pinned products)
        overlays={
          <>
            {/* Gift Animation Overlay - always rendered to receive gift events */}
            <GiftAnimationOverlay
              gifts={recentGifts}
              userPositions={giftUserPositions}
              getUserPositions={getGiftUserPositionsRef.current}
              onAnimationComplete={(giftId) => {
                // Update positions when animation completes
                setGiftUserPositions(getGiftUserPositionsRef.current());
                setRecentGifts(prev => prev.filter(g => g.id !== giftId));
              }}
            />
            
            {/* Pinned Product Overlay (for viewers) */}
            {!isHost && pinnedProducts.length > 0 && (
              <PinnedProductOverlay
                pinnedProducts={pinnedProducts}
              />
            )}
          </>
        }
        
        // Modals
        modals={
          <>
            {/* Gift Modal */}
            <GiftBoxModal
              isOpen={isGiftModalOpen}
              onClose={() => {
                setIsGiftModalOpen(false);
                setGiftRecipientId(null);
              }}
              recipientId={giftRecipientId || stream?.user_id || ''}
              streamId={streamId || ''}
              onGiftSent={(giftData) => {
                console.log('Gift sent:', giftData);
                // Also show animation locally for the sender
                const newGift: BroadcastGift = {
                  id: `local-${Date.now()}`,
                  gift_id: giftData.id,
                  gift_name: giftData.name,
                  gift_icon: giftData.icon || '🎁',
                  amount: giftData.coinCost,
                  sender_id: user?.id || '',
                  sender_name: profile?.username || 'You',
                  receiver_id: giftRecipientId || stream?.user_id || '',
                  created_at: new Date().toISOString(),
                };
                setRecentGifts(prev => [...prev, newGift]);
              }}
            />
            
            {/* Pin Product Modal (for host) */}
            <PinProductModal
              isOpen={isPinProductModalOpen}
              onClose={() => setIsPinProductModalOpen(false)}
              onProductPinned={async (productId) => {
                const result = await pinProduct(productId);
                if (result.success) {
                  // Product pinned successfully
                } else {
                  // Handle error
                }
              }}
            />
          </>
        }
      />

      {/* STREAM SUMMARY MODAL - Shown for ALL users when stream ends */}
      {showStreamSummary && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-yellow-500/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </div>

            <h1 className="text-3xl font-bold mb-2">Broadcast Ended</h1>
            <p className="text-zinc-400 mb-8">{streamStats?.title || "Great stream! Here's how it went:"}</p>

            <div className="grid grid-cols-3 gap-4 w-full mb-8">
              <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 mb-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className="text-2xl font-bold">{streamStats?.viewers || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Viewers</span>
              </div>
              <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500 mb-2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span className="text-2xl font-bold">{streamStats?.likes || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Likes</span>
              </div>
              <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 mb-2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                <span className="text-2xl font-bold">{streamStats?.gifts || 0}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Gifts</span>
              </div>
            </div>

            {/* Duration and Participants Row */}
            <div className="flex gap-4 w-full mb-8">
              <div className="flex-1 bg-black/40 rounded-xl p-3 flex items-center justify-center gap-2 border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-sm text-zinc-300">
                  {streamStats?.duration ? `${Math.floor(streamStats.duration / 60)}m ${streamStats.duration % 60}s` : '0m 0s'}
                </span>
              </div>
              <div className="flex-1 bg-black/40 rounded-xl p-3 flex items-center justify-center gap-2 border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className="text-sm text-zinc-300">{streamStats?.participants || 0} Participants</span>
              </div>
            </div>

            <button
              onClick={() => {
                navigate('/');
              }}
              className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}

export default BroadcastPage
