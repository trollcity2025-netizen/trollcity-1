import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { PreflightStore } from '../../lib/preflightStore'

import { Stream } from '../../types/broadcast'
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
  BroadcastCategoryId
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

  // Track mapping from user IDs to Agora UIDs
  const [userIdToAgoraUid, setUserIdToAgoraUid] = useState<Record<string, number>>({})

  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isBattleMode, setIsBattleMode] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  
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

  // Callback to get user positions from BroadcastGrid
  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  // Stop local camera and mic tracks and leave Agora channel (async)
  const stopLocalTracks = useCallback(async () => {
    console.log('[BroadcastPage] stopLocalTracks called, localTracks:', localTracks ? 'exists' : 'null');

    // Attempt to unpublish before stopping/closing tracks
    const client = agoraClientRef.current;
    if (client && localTracks && localTracks.length > 0) {
      try {
        console.log('[BroadcastPage] Unpublishing local tracks before stop');
        // Unpublish accepts array of tracks
        // @ts-ignore - sdk typings may vary
        await client.unpublish(localTracks).catch((e: any) => {
          console.warn('[BroadcastPage] unpublish error:', e);
        });
      } catch (e) {
        console.warn('[BroadcastPage] Error during unpublish:', e);
      }
    }

    // Stop any tracks that might be stored elsewhere
    if (localTracks) {
      console.log('[BroadcastPage] Stopping local tracks, count:', localTracks.length);
      localTracks.forEach((track, index) => {
        if (track) {
          try {
            console.log('[BroadcastPage] Stopping track', index);
            track.stop();
            if (typeof track.close === 'function') track.close();
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping track:', e);
          }
        }
      });
      setLocalTracks(null);
    }

    // Also leave the Agora channel
    if (client) {
      try {
        console.log('[BroadcastPage] Leaving Agora channel');
        await client.leave();
      } catch (leaveErr) {
        console.warn('[BroadcastPage] Error leaving Agora channel:', leaveErr);
      }
    }
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
  }, [streamId, supabase]);

  // Async variant to ensure we unpublish and leave Agora before proceeding
  // Using ref to avoid dependency issues
  const stopLocalTracksAsync = useCallback(async () => {
    const client = agoraClientRef.current;
    try {
      if (client && localTracks && localTracks.length > 0) {
        try {
          // @ts-ignore
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
    } catch (err) {
      console.warn('[stopLocalTracksAsync] unexpected error', err);
    }
  }, []); // No dependencies - use ref for tracks

  // Pin product modal state
  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)

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

  // Effect to handle Agora initialization when guest joins a seat
  // Only trigger when userSeat goes from null to a value (new seat join)
  useEffect(() => {
    const hadNoSeat = !previousUserSeatRef.current;
    const hasSeatNow = !!userSeat;
    
    // Only trigger Agora init when user first gets a seat (not on initial load or seat changes)
    if (hadNoSeat && hasSeatNow && justJoinedSeatRef.current) {
      console.log('[BroadcastPage] Guest joined seat - allowing Agora init');
      justJoinedSeatRef.current = false;
      // Don't reset hasJoinedRef here - let the Agora init effect handle it naturally
      // by using a separate trigger mechanism
    }
    
    previousUserSeatRef.current = userSeat;
  }, [userSeat]);

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

      // Set initial mux playback id if available
      if (data.mux_playback_id) {
        setMuxPlaybackId(data.mux_playback_id)
      }

      if (data.status === 'ended') {
        stopLocalTracks();
        navigate(`/broadcast/summary/${streamId}`)
      }

      setIsLoading(false)
    }

    fetchStream()
  }, [streamId, navigate, user?.id, stopLocalTracks])

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

  /** POLL FOR MUX PLAYBACK ID & BOX COUNT - for all users as realtime fallback */
  useEffect(() => {
    if (!streamId || !stream) return;
    
    // Don't need to poll for mux if we already have a valid playback ID
    const needsMuxPoll = muxPlaybackId && !muxPlaybackId.startsWith('placeholder_');
    
    // Don't need to poll for mux if this is the host (they'll get it after publishing)
    if (needsMuxPoll || isHost) {
      // Still poll for box_count changes even for host
    } else {
      console.log('[BroadcastPage] Starting poll for mux_playback_id');
    }
    
    const pollInterval = setInterval(async () => {
      try {
        // Always poll for box_count, has_rgb_effect, and battle status updates
        const { data, error } = await supabase
          .from('streams')
          .select('mux_playback_id, status, box_count, is_battle, battle_id, has_rgb_effect, are_seats_locked')
          .eq('id', streamId)
          .single();
        
        if (error) {
          console.warn('[BroadcastPage] Poll error:', error);
          return;
        }
        
        // Check for mux_playback_id update if needed
        if (!needsMuxPoll && !isHost && data?.mux_playback_id && !data.mux_playback_id.startsWith('placeholder_')) {
          console.log('[BroadcastPage] Found mux_playback_id:', data.mux_playback_id);
          setMuxPlaybackId(data.mux_playback_id);
        }
        
        // Check if battle ended - if is_battle changed from true to false, reload
        if (stream.is_battle === true && data.is_battle === false) {
          console.log('[BroadcastPage] Battle ended, reloading page...');
          window.location.reload();
          return;
        }
        
        // Always check for box_count and has_rgb_effect updates
        if (data?.box_count !== undefined && data.box_count !== streamRef.current?.box_count) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, box_count: data.box_count };
          });
        }
        
        // Check for has_rgb_effect changes
        if (data?.has_rgb_effect !== undefined && data.has_rgb_effect !== streamRef.current?.has_rgb_effect) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, has_rgb_effect: data.has_rgb_effect };
          });
        }
        
        // Check for are_seats_locked changes
        if (data?.are_seats_locked !== undefined && data.are_seats_locked !== streamRef.current?.are_seats_locked) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, are_seats_locked: data.are_seats_locked };
          });
        }
        
        // Stop polling and navigate to summary if stream has ended
        if (data?.status === 'ended') {
          console.log('[BroadcastPage] Stream ended, stopping poll and navigating to summary');
          clearInterval(pollInterval);
          navigate(`/broadcast/summary/${streamId}`);
        }
      } catch (err) {
        console.warn('[BroadcastPage] Poll exception:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      console.log('[BroadcastPage] Stopping poll');
      clearInterval(pollInterval);
    };
  }, [streamId, stream, isHost, muxPlaybackId, supabase, navigate]);

  /** REALTIME STREAM UPDATES */
  useEffect(() => {
    if (!streamId) return;

    console.log('[Realtime] Setting up channel for stream:', streamId);
    const channel = supabase.channel(`stream:${streamId}`);

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
          
          // Skip update if nothing actually changed
          if (streamRef.current && 
              streamRef.current.box_count === payload.new.box_count &&
              streamRef.current.has_rgb_effect === payload.new.has_rgb_effect &&
              streamRef.current.are_seats_locked === payload.new.are_seats_locked) {
            return;
          }
          
          try {
          setStream((prev: any) => {
              if (!prev) return prev;
              return { 
                ...prev, 
                box_count: payload.new.box_count,
                has_rgb_effect: payload.new.has_rgb_effect,
                are_seats_locked: payload.new.are_seats_locked
              };
            });
            // Navigate to summary when stream ends - for ALL clients
            if (payload.new.status === 'ended') {
              console.log('[BroadcastPage] Stream ended, navigating to summary');
              // Stop local camera and mic for broadcaster/guest - wrap in async IIFE
              (async () => {
                await stopLocalTracks();
                navigate(`/broadcast/summary/${streamId}`);
              })();
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
      .subscribe((status) => {
        console.log('[Realtime] Full subscription status:', status, 'for channel:', `stream:${streamId}`);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Subscription SUCCESSFUL - channel is ready for broadcast events');
          
          // Store channel reference for use in handleBoxCountChange
          channelRef.current = channel;
          channelRefInitializedRef.current = true;
          
          // Track presence to keep channel alive
          channel.track({
            user_id: user?.id || 'viewer',
            username: profile?.username || user?.email || 'Viewer',
            is_host: isHost,
            online_at: new Date().toISOString(),
            avatar_url: profile?.avatar_url || ''
          }).catch(console.error);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ Subscription FAILED - viewers will NOT receive updates!');
          // Exponential backoff for reconnection attempts
          const maxDelay = 10000;
          const baseDelay = 1000;
          let currentDelay = baseDelay;
          
          const retry = () => {
            console.log('[BroadcastPage] Attempting to resubscribe (delay: ' + currentDelay + 'ms)...');
            channel.subscribe();
            // Re-track presence after reconnect
            channel.track({
              user_id: user?.id || 'viewer',
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry
            currentDelay = Math.min(currentDelay * 2, maxDelay);
          };
          setTimeout(retry, currentDelay);
        } else if (status === 'CLOSED') {
          console.warn('[Realtime] ⚠️ Subscription CLOSED - attempting to resubscribe');
          // Longer delay to avoid rapid reconnection attempts
          const maxDelay = 30000;
          const baseDelay = 5000;
          let currentDelay = baseDelay;
          
          const retry = async () => {
            console.log('[BroadcastPage] Attempting to reconnect after close (delay: ' + currentDelay + 'ms)...');
            try {
              await channel.subscribe();
            } catch (subErr) {
              console.warn('[BroadcastPage] Resubscribe error:', subErr);
            }
            // Re-track presence after reconnect
            channel.track({
              user_id: user?.id || 'viewer',
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry (exponential backoff)
            currentDelay = Math.min(currentDelay * 1.5, maxDelay);
          };
          setTimeout(retry, currentDelay);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] ⚠️ Subscription TIMED_OUT - attempting to resubscribe');
          // Longer delay for timeout
          const maxDelay = 30000;
          const baseDelay = 5000;
          let currentDelay = baseDelay;
          
          const retry = () => {
            console.log('[BroadcastPage] Attempting to reconnect after timeout (delay: ' + currentDelay + 'ms)...');
            channel.subscribe();
            // Re-track presence after reconnect
            channel.track({
              user_id: user?.id || 'viewer',
              username: profile?.username || user?.email || 'Viewer',
              is_host: isHost,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || ''
            }).catch(console.error);
            
            // Increase delay for next potential retry (exponential backoff)
            currentDelay = Math.min(currentDelay * 1.5, maxDelay);
          };
          setTimeout(retry, currentDelay);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate, stopLocalTracks]);

  /** AGORA INIT */
  useEffect(() => {
    if (!stream || !user) {
      console.log('[BroadcastPage] Agora init skipped: no stream or user');
      return;
    }

    // Prevent re-initialization if user has already joined
    if (hasJoinedRef.current) {
      console.log('[BroadcastPage] Already joined - skipping re-initialization');
      return;
    }

    console.log('[BroadcastPage] Agora init effect running, canPublish:', canPublish);

    // Check for pre-existing Agora client from SetupPage
    const preflightClient = PreflightStore.getAgoraClient();
    const preflightTracks = PreflightStore.getLocalTracks();
    
    console.log('[BroadcastPage] Preflight check:', {
      hasClient: !!preflightClient,
      hasTracks: !!preflightTracks,
      trackCount: preflightTracks?.length || 0
    });

    if (preflightClient && preflightTracks) {
      console.log('[BroadcastPage] Using pre-existing Agora client from SetupPage');
      console.log('[BroadcastPage] Preflight tracks:', {
        audio: preflightTracks[0]?.getType?.() || 'none',
        video: preflightTracks[1]?.getType?.() || 'none',
        cameraAudio: preflightTracks[2]?.getType?.() || 'none',
        cameraVideo: preflightTracks[3]?.getType?.() || 'none'
      });
      
      // Check if this is screen sharing with camera overlay
      const hasScreenShare = preflightTracks[1]?.getType?.() === 'video' && 
                            preflightTracks[1]?.getMediaStreamTrack?.()?.label?.includes('screen');
      const hasCameraOverlay = !!preflightTracks[3];
      
      // Set screen sharing state for UI
      if (hasCameraOverlay) {
        setIsScreenSharing(true);
      }
      
      console.log('[BroadcastPage] Screen share mode:', { hasScreenShare, hasCameraOverlay });
      
      // Use existing client and tracks
      agoraClientRef.current = preflightClient;
      setLocalTracks(preflightTracks);
      setIsJoining(false);
      hasJoinedRef.current = true;
      
      // Set up event listeners for the existing client
      preflightClient.on('user-published', async (remoteUser, mediaType) => {
        console.log('[BroadcastPage] Preflight user-published:', remoteUser.uid, 'mediaType:', mediaType);
        
        // Subscribe to both video and audio (not just the reported mediaType)
        if (remoteUser.hasVideo && !remoteUser.videoTrack) {
          await preflightClient.subscribe(remoteUser, 'video');
          console.log('[BroadcastPage] Preflight subscribed to video');
        }
        if (remoteUser.hasAudio && !remoteUser.audioTrack) {
          await preflightClient.subscribe(remoteUser, 'audio');
          console.log('[BroadcastPage] Preflight subscribed to audio');
          remoteUser.audioTrack?.play();
        }
        
        setRemoteUsers(prev => {
          const filtered = prev.filter(u => u.uid !== remoteUser.uid);
          return [...filtered, remoteUser];
        });
      });
      
      preflightClient.on('user-unpublished', remoteUser => {
        setRemoteUsers(prev =>
          prev.filter(u => u.uid !== remoteUser.uid)
        );
      });

      // Clear the preflight store to prevent reuse
      PreflightStore.setAgoraClient(null, null);
      
      console.log('[BroadcastPage] Successfully using pre-existing Agora connection');
      return;
    }

    let mounted = true

    const initAgora = async () => {
      // Check if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('[BroadcastPage] Device type:', isMobile ? 'mobile' : 'desktop');
      console.log('[BroadcastPage] initAgora called, canPublish:', canPublish, 'isHost:', isHost, 'hasUserSeat:', !!userSeat);
      
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      })

      agoraClientRef.current = client

      client.on('user-published', async (remoteUser, mediaType) => {
        console.log('[BroadcastPage] User published:', remoteUser.uid, 'mediaType:', mediaType, 'hasVideo:', remoteUser.hasVideo, 'hasAudio:', remoteUser.hasAudio);
        
        // Subscribe to both video and audio - not just the reported mediaType
        // This ensures we get both tracks even if events fire separately
        if (remoteUser.hasVideo && !remoteUser.videoTrack) {
          console.log('[BroadcastPage] Subscribing to video for user:', remoteUser.uid);
          await client.subscribe(remoteUser, 'video');
        }
        if (remoteUser.hasAudio && !remoteUser.audioTrack) {
          console.log('[BroadcastPage] Subscribing to audio for user:', remoteUser.uid);
          await client.subscribe(remoteUser, 'audio');
          // Play audio track
          remoteUser.audioTrack?.play();
        }

        console.log('[BroadcastPage] After subscribe - videoTrack:', !!remoteUser.videoTrack, 'audioTrack:', !!remoteUser.audioTrack);

        if (!mounted) return

        setRemoteUsers(prev => {
          const filtered = prev.filter(u => u.uid !== remoteUser.uid)
          return [...filtered, remoteUser]
        })

        // Log video track info for debugging
        if (remoteUser.videoTrack) {
          console.log('[BroadcastPage] Video track ready for user:', remoteUser.uid);
        }
      })

      // Handle late joiners - users already in the channel when we join
      client.on('user-joined', async (remoteUser) => {
        console.log('[BroadcastPage] User joined channel:', remoteUser.uid)
        // The user-published event will fire after this, so we don't need to do anything here
      })

      client.on('user-unpublished', remoteUser => {
        setRemoteUsers(prev =>
          prev.filter(u => u.uid !== remoteUser.uid)
        )
      })

      /** HOST OR GUEST → AGORA */
      if (canPublish) {
        setIsJoining(true)

        // Convert UUID string to numeric UID for Agora token compatibility
        const stringToUid = (str: string): number => {
          let hash = 0
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i)
            hash |= 0
          }
          return Math.abs(hash)
        }
        const numericUid = stringToUid(user.id)
        
        try {
          const { data, error } =
            await supabase.functions.invoke('agora-token', {
              body: {
                channel: stream.id,
                uid: numericUid,
                role: 'publisher'
              }
            })

          if (error) throw error

          const appId = import.meta.env.VITE_AGORA_APP_ID
          if (!appId) {
            console.warn('VITE_AGORA_APP_ID not configured - running in viewer mode only')
            setIsJoining(false)
            // Continue to viewer mode instead of throwing error
            if (stream.mux_playback_id) {
              setMuxPlaybackId(stream.mux_playback_id)
            }
            return
          }
          if (!data?.token) {
            console.warn('Missing Agora token - falling back to viewer mode')
            if (stream.mux_playback_id) {
              setMuxPlaybackId(stream.mux_playback_id)
            }
            setIsJoining(false)
            return
          }

          await client.join(
            appId,
            stream.id,
            data.token,
            numericUid
          )

          console.log("Agora joined")

          // Request browser permissions FIRST with explicit user interaction handling
          // This is critical for mobile browsers which require user gesture
          try {
            console.log('[BroadcastPage] Requesting camera/mic permissions...');
            toast.info('Requesting camera & microphone access...');
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: true, 
              audio: true 
            });
            console.log('[BroadcastPage] Browser permissions granted', mediaStream.getTracks().map(t => t.kind));
            toast.success('Camera & mic access granted!');
            // Stop the test stream - Agora will create its own
            mediaStream.getTracks().forEach(track => track.stop());
          } catch (permErr: any) {
            console.error('[BroadcastPage] Browser permission request failed:', permErr.message);
            // Show error to user - they need to grant permissions
            toast.error('Camera/mic permission required. Please allow access and try again.');
            // Continue anyway - Agora will try to create tracks
          }

          // Create tracks with AEC enabled for echo cancellation
          // Use lower resolution for mobile to improve compatibility
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const videoConfig = isMobile ? {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
            facingMode: 'user'  // Use front camera on mobile
          } : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          };
          
          const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
            {
              AEC: true,  // Acoustic Echo Cancellation
              AGC: true,  // Automatic Gain Control
              ANS: true,  // Automatic Noise Suppression
            },
            {
              video: videoConfig
            }
          )

          console.log("Tracks created")

          if (!mounted) {
            // Cleanup tracks if component unmounted
            tracks[0].close()
            tracks[1].close()
            return
          }

          // FORCE ENABLE CAMERA + MIC
          await tracks[0].setEnabled(true)
          await tracks[1].setEnabled(true)

          if (isHost && hostMicMutedByOfficer) {
            await tracks[0].setEnabled(false)
            toast.error('Your host microphone is muted by officer control')
          }

          console.log("Camera enabled:", tracks[1].enabled)
          console.log("Mic enabled:", tracks[0].enabled)

          // Improve video quality - use lower bitrate for mobile
          try {
            const mobileBitrate = isMobile ? 800 : 1500;
            tracks[1].setEncoderConfiguration({
              width: isMobile ? 640 : 1280,
              height: isMobile ? 480 : 720,
              frameRate: isMobile ? 24 : 30,
              bitrateMin: 400,
              bitrateMax: mobileBitrate
            })
          } catch (encErr) {
            console.warn("Encoder configuration failed:", encErr)
          }

          setLocalTracks(tracks)

          // PUBLISH
          await client.publish(tracks)

          console.log("Tracks published successfully")

          // Mark stream as live in database when tracks are published
          try {
            await supabase
              .from('streams')
              .update({ is_live: true })
              .eq('id', stream.id);
            console.log('[BroadcastPage] Stream marked as live');
          } catch (liveErr) {
            console.warn('[BroadcastPage] Failed to mark stream as live:', liveErr);
          }

          // Mark as joined to prevent re-initialization when user returns to page
          hasJoinedRef.current = true;

          // Wait 2 seconds for Agora to establish media flow before starting WHIP
          console.log('[BroadcastPage] Waiting 2 seconds for Agora media flow to establish...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('[BroadcastPage] Agora publishing established');

          // Using Agora for both broadcaster and viewers - no Mux needed
          console.log('[BroadcastPage] Broadcast is live via Agora');

        } catch (err) {
          console.error('Agora init error:', err)
          // Don't throw - just log and continue in viewer mode
          // This prevents ErrorBoundary from catching and reloading
          if (stream.mux_playback_id) {
            setMuxPlaybackId(stream.mux_playback_id)
          }
        } finally {
          setIsJoining(false)
        }
      }
      /** VIEWER → AGORA */
      else {
        // Viewers use Agora to subscribe to the broadcast
        setIsJoining(true);
        
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
          // Get viewer token
          const { data, error } = await supabase.functions.invoke('agora-token', {
            body: {
              channel: stream.id,
              uid: numericUid,
              role: 'subscriber'
            }
          });

          if (error || !data?.token) {
            console.error('Viewer token error', error);
            setIsJoining(false);
            return;
          }

          const appId = import.meta.env.VITE_AGORA_APP_ID;
          
          if (!appId) {
            console.warn('VITE_AGORA_APP_ID not configured');
            setIsJoining(false);
            return;
          }

          await client.join(
            appId,
            stream.id,
            data.token,
            numericUid
          );
          
          console.log('[BroadcastPage] Viewer joined Agora successfully');

          // Handle late joiners - users already in the channel when we join
          const existingUsers = client.remoteUsers;
          if (existingUsers.length > 0) {
            console.log('[BroadcastPage] Found', existingUsers.length, 'existing users');
            
            // First subscribe to all tracks for all existing users
            for (const remoteUser of existingUsers) {
              console.log('[BroadcastPage] Late joiner user:', remoteUser.uid, 'hasVideo:', remoteUser.hasVideo, 'hasAudio:', remoteUser.hasAudio);
              
              if (remoteUser.hasVideo) {
                await client.subscribe(remoteUser, 'video');
                console.log('[BroadcastPage] Subscribed to video for:', remoteUser.uid);
              }
              if (remoteUser.hasAudio) {
                await client.subscribe(remoteUser, 'audio');
                console.log('[BroadcastPage] Subscribed to audio for:', remoteUser.uid);
                // Play audio immediately
                remoteUser.audioTrack?.play();
              }
            }
            
            // Update remoteUsers state AFTER subscriptions complete
            setRemoteUsers([...existingUsers]);
            console.log('[BroadcastPage] Updated remoteUsers state with', existingUsers.length, 'users');
          }

          hasJoinedRef.current = true;
          setIsJoining(false);
          
        } catch (viewerErr) {
          console.error('[BroadcastPage] Viewer join error:', viewerErr);
          setIsJoining(false);
        }
      }
    }

    initAgora()

    return () => {
      mounted = false
      hasJoinedRef.current = false

      const client = agoraClientRef.current

      if (client) {
        client.leave()
      }

      if (localTracks) {
        localTracks.forEach(track => {
          track.stop()
          track.close()
        })
      }

      agoraClientRef.current = null
      setRemoteUsers([])
      setLocalTracks(null)
      setMuxPlaybackId(null)
    }
  }, [stream, user, canPublish, hostMicMutedByOfficer])

  /** CAMERA / MIC */
  const toggleCamera = async () => {
    if (!localTracks) return
    await localTracks[1].setEnabled(!localTracks[1].enabled)
  }

  const toggleMicrophone = async () => {
    if (!localTracks) return
    const shouldEnable = !localTracks[0].enabled
    if (isHost && hostMicMutedByOfficer && shouldEnable) {
      toast.error('Host microphone is muted by officer control')
      return
    }
    await localTracks[0].setEnabled(shouldEnable)
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
      let broadcastChannel = channelRef.current;
      
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
  }, [supabase]);

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

  const handleStreamEnd = async () => {
    // Stop camera and mic before leaving - await for instant disconnect
    await stopLocalTracks();
    
    // Check if there's an active battle - if so, forfeit and credit opponent as winner
    if (stream?.battle_id && isHost) {
      try {
        const { data: battleData } = await supabase
          .from('battles')
          .select('id, status, challenger_stream_id, opponent_stream_id')
          .eq('id', stream.battle_id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (battleData) {
          // Determine opponent stream
          const opponentStreamId = battleData.challenger_stream_id === stream.id 
            ? battleData.opponent_stream_id 
            : battleData.challenger_stream_id;
          
          // Call leave_battle to properly credit winner and end battle
          const { error: leaveError } = await supabase.rpc('leave_battle', {
            p_battle_id: battleData.id,
            p_user_id: user.id
          });
          
          if (leaveError) {
            console.warn('[BroadcastPage] Failed to leave battle:', leaveError);
          } else {
            console.log('[BroadcastPage] Left battle, opponent credited as winner');
          }
        }
      } catch (battleErr) {
        console.warn('[BroadcastPage] Error handling battle on stream end:', battleErr);
      }
    }
    
    // Mark stream as ended in database
    try {
      await supabase
        .from('streams')
        .update({ is_live: false, status: 'ended' })
        .eq('id', stream.id);
      console.log('[BroadcastPage] Stream marked as ended');
    } catch (endErr) {
      console.warn('[BroadcastPage] Failed to mark stream as ended:', endErr);
    }
    
    // Immediately update local state for instant navigation
    setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);
    // Navigate to summary page
    navigate(`/broadcast/summary/${stream?.id}`);
  };

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
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  if (!stream) return null

  // Get category-specific configuration
  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const categorySupportsBattles = supportsBattles(stream.category || 'general');
  const categoryMatchingTerm = getMatchingTerminology(stream.category || 'general');

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

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-black flex flex-col text-white">

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

        <div className="flex flex-1 overflow-hidden h-full">

          {/* Main content area with proper constraints - grid takes available space but respects chat width */}
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">

            {/* VIEWER LOGIC - Use Agora to watch the broadcast */}
            {(!isHost && !userSeat) ? (
              <div className="flex-1 min-w-0 overflow-hidden">
                <BroadcastGrid
                  stream={stream}
                  seats={seats}
                  isHost={false}
                  onJoinSeat={categoryConfig.allowGuestBoxes ? (index) => handleJoinSeat(index, stream.seat_price) : undefined}
                  localTracks={[undefined, undefined]}
                  remoteUsers={remoteUsers}
                  localUserId={user?.id || ''}
                  userIdToAgoraUid={userIdToAgoraUid}
                  onGift={onGift}
                  onGiftAll={onGiftAll}
                  toggleCamera={() => {}}
                  toggleMicrophone={() => {}}
                  onGetUserPositions={handleGetUserPositions}
                  broadcasterProfile={broadcasterProfile}
                />
              </div>
            ) : (
              /* Host or stage participant - show BroadcastGrid with Agora */
              <div className="flex-1 flex flex-col h-full">
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
                />
              </div>
            )}

          {isBattleMode && <BattleControls currentStream={stream} />}

            <BroadcastControls
              stream={stream}
              isHost={isHost}
              isOnStage={!!userSeat}
              liveViewerCount={viewerCount > 0 ? viewerCount : remoteUsers.length}
              chatOpen={isChatOpen}
              toggleChat={() => setIsChatOpen(!isChatOpen)}
              onGiftHost={() => onGift(stream.user_id)}
              onLeave={leaveSeat}
              onBoxCountUpdate={handleBoxCountChange}
              onStreamEnd={handleStreamEnd}
              handleLike={handleLike}
              toggleBattleMode={() => setIsBattleMode(!isBattleMode)}
              localTracks={localTracks}
              toggleCamera={toggleCamera}
              toggleMicrophone={toggleMicrophone}
              onPinProduct={() => setIsPinProductModalOpen(true)}
            />
          </div>

          {isChatOpen && (
            <div className="w-80 flex-shrink-0 h-full overflow-hidden border-l border-white/10">
              <BroadcastChat
                streamId={streamId!}
                hostId={stream.user_id}
                isHost={isHost}
                isViewer={!userSeat && !isHost}
                isGuest={!user}
              />
            </div>
          )}

        </div>
      </div>

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
    </ErrorBoundary>
  )
}

export default BroadcastPage