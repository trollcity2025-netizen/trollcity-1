import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { PreflightStore } from '../../lib/preflightStore'
import { useStreamStore } from '../../lib/streamStore'

import { Stream } from '../../types/broadcast'
import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import BattleView from '../../components/broadcast/BattleView'
import BattleControls from '../../components/broadcast/BattleControls'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal, { GiftTarget, GiftItem } from '../../components/broadcast/GiftBoxModal'
import GiftAnimationOverlay from '../../components/broadcast/GiftAnimationOverlay'
import PinnedProductOverlay from '../../components/broadcast/PinnedProductOverlay'
import PinProductModal from '../../components/broadcast/PinProductModal'
import { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { useBroadcastPinnedProducts } from '../../hooks/useBroadcastPinnedProducts'
import { useBoxCount } from '../../hooks/useBoxCount'
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
  const { clearTracks } = useStreamStore()

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

  // Stop local camera and mic tracks
  const stopLocalTracks = useCallback(() => {
    console.log('[BroadcastPage] stopLocalTracks called, localTracks:', localTracks ? 'exists' : 'null');

    // Stop any tracks that might be stored elsewhere
    if (localTracks) {
      console.log('[BroadcastPage] Stopping local tracks, count:', localTracks.length);
      localTracks.forEach((track, index) => {
        if (track) {
          try {
            console.log('[BroadcastPage] Stopping track', index);
            track.stop();
            track.close();
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping track:', e);
          }
        }
      });
      setLocalTracks(null);
    }

    // Also leave the Agora channel
    const client = agoraClientRef.current;
    if (client) {
      console.log('[BroadcastPage] Leaving Agora channel');
      client.leave().catch(console.error);
    }

    // Clear PreflightStore to stop any tracks stored there
    console.log('[BroadcastPage] Clearing PreflightStore');
    PreflightStore.clear();

    // Clear streamStore to stop any screen share or camera tracks
    console.log('[BroadcastPage] Clearing streamStore');
    clearTracks();
  }, [localTracks, clearTracks]);

  // Manual refresh function to force reload stream data
  const refreshStream = useCallback(async () => {
    if (!streamId) return;
    console.log('[BroadcastPage] Manual refresh - fetching stream data');
    const { data, error } = await supabase
      .from('streams')
      .select('*, total_likes')
      .eq('id', streamId)
      .single();
    
    if (error) {
      console.error('[BroadcastPage] Refresh error:', error);
      return;
    }
    
    console.log('[BroadcastPage] Refreshed stream data, box_count:', data.box_count, 'total_likes:', data.total_likes);
    setStream(data);
  }, [streamId, supabase]);

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

  // Use isolated box count hook to prevent camera re-initialization when boxes change
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

  /** STREAM SEATS */
  const { seats, mySession: userSeat, joinSeat, leaveSeat } =
    useStreamSeats(stream?.id, user?.id, broadcasterProfile, stream)

  const canPublish = isHost || !!userSeat
  const mode = userSeat ? 'stage' : 'viewer'

  // Track if user just joined a seat (for triggering Agora init)
  const justJoinedSeatRef = useRef(false);

  // Effect to handle Agora initialization when guest joins a seat
  useEffect(() => {
    // If user has a seat and just joined (wasn't there before), trigger Agora init
    if (userSeat && justJoinedSeatRef.current) {
      console.log('[BroadcastPage] Guest joined seat - resetting hasJoinedRef to allow Agora init');
      justJoinedSeatRef.current = false;
      hasJoinedRef.current = false;
      
      // Force re-render to trigger Agora init effect
      setStream((prev: any) => prev ? { ...prev } : prev);
    }
  }, [userSeat]);

  // Wrap joinSeat to track when user joins
  const handleJoinSeat = useCallback(async (index: number, price: number) => {
    console.log('[BroadcastPage] handleJoinSeat called for seat', index, 'price:', price);
    justJoinedSeatRef.current = true;
    return joinSeat(index, price);
  }, [joinSeat]);

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
        .select('*, total_likes')
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
  }, [streamId, navigate])

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
        // Always poll for box_count, has_rgb_effect, total_likes, seat_price, and battle status updates
        const { data, error } = await supabase
          .from('streams')
          .select('mux_playback_id, status, box_count, is_battle, battle_id, has_rgb_effect, are_seats_locked, total_likes, seat_price')
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
        
        // Check for total_likes changes
        if (data?.total_likes !== undefined && data.total_likes !== streamRef.current?.total_likes) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: data.total_likes };
          });
        }
        
        // Check for seat_price changes
        if (data?.seat_price !== undefined && data.seat_price !== streamRef.current?.seat_price) {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, seat_price: data.seat_price };
          });
        }
        
        // Stop polling and navigate away if stream has ended
        if (data?.status === 'ended' || data?.is_live === false) {
          console.log('[BroadcastPage] Stream ended detected in poll, navigating to summary');
          clearInterval(pollInterval);
          stopLocalTracks();
          navigate(`/broadcast/summary/${streamId}`);
          return;
        }
      } catch (err) {
        console.warn('[BroadcastPage] Poll exception:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      console.log('[BroadcastPage] Stopping poll');
      clearInterval(pollInterval);
    };
  }, [streamId, stream, isHost, muxPlaybackId, supabase]);

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
              streamRef.current.are_seats_locked === payload.new.are_seats_locked &&
              streamRef.current.total_likes === payload.new.total_likes &&
              streamRef.current.seat_price === payload.new.seat_price) {
            return;
          }
          
          try {
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
                is_live: payload.new.is_live
              };
            });
            // Navigate to summary when stream ends - for ALL clients (including broadcaster)
            if (payload.new.status === 'ended' || payload.new.is_live === false) {
              console.log('[BroadcastPage] Stream ended (status: ended or is_live: false), navigating to summary');
              // Stop local camera and mic for broadcaster/guest
              stopLocalTracks();
              // Small delay to ensure cleanup happens before navigation
              setTimeout(() => {
                navigate(`/broadcast/summary/${streamId}`);
              }, 100);
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
      // Listen for gift events
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          try {
            const giftData = payload.payload;
            console.log('[BroadcastPage] Gift received:', giftData);
            console.log('[BroadcastPage] Current user is host:', isHost);
            
            const newGift: BroadcastGift = {
              id: giftData.id || `gift-${Date.now()}`,
              gift_id: giftData.gift_id,
              gift_name: giftData.gift_name,
              gift_icon: giftData.gift_icon || '🎁',
              amount: giftData.amount,
              quantity: giftData.quantity || 1,
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
            const likeData = payload.payload;
            console.log('[BroadcastPage] Like received:', likeData);
            
            // Use the total_likes from the server if available, otherwise increment
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 1;
              return { ...prev, total_likes: newTotal };
            });
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

    // Heartbeat to keep connection alive - prevents Supabase from dropping connection after inactivity
    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now(), user_id: user?.id }
        }).catch(() => {
          // Ignore errors, just trying to keep connection alive
        });
      }
    }, 30000); // Send heartbeat every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate, stopLocalTracks, user?.id]);

  /** AGORA INIT - Only runs once when stream and user are available */
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

    // For hosts, always initialize. For guests, only initialize if they have a seat
    // Use a ref to capture the value at mount time to avoid re-runs
    const shouldPublish = isHost || !!userSeat;
    
    console.log('[BroadcastPage] Agora init effect running, shouldPublish:', shouldPublish, 'isHost:', isHost, 'hasUserSeat:', !!userSeat);

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
      console.log('[BroadcastPage] initAgora called, shouldPublish:', shouldPublish, 'isHost:', isHost, 'hasUserSeat:', !!userSeat);
      
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
      if (shouldPublish) {
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
              .update({ is_live: true, status: 'live' })
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
  // IMPORTANT: We intentionally don't include canPublish/userSeat in dependencies
  // to prevent re-initialization when guests join/leave. The hasJoinedRef check
  // ensures we only initialize once.
  }, [stream?.id, user?.id, isHost, hostMicMutedByOfficer])

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

  // Box count is now managed by useBoxCount hook to prevent camera re-initialization

  // Click rate tracking for autoclicker detection
  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);
  const CLICK_WINDOW_MS = 2000; // 2 second window
  const MAX_CLICKS_IN_WINDOW = 5; // Max 5 clicks in 2 seconds
  const BLOCK_DURATION_MS = 30000; // Block for 30 seconds if autoclicking detected

  const checkClickRate = () => {
    const now = Date.now();
    // Remove clicks older than the window
    clickHistoryRef.current = clickHistoryRef.current.filter(
      timestamp => now - timestamp < CLICK_WINDOW_MS
    );
    // Add current click
    clickHistoryRef.current.push(now);
    // Check if too many clicks in window
    if (clickHistoryRef.current.length > MAX_CLICKS_IN_WINDOW) {
      return false; // Too many clicks - autoclicker detected
    }
    return true; // Click allowed
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

    // Check for autoclicker
    if (isClickBlocked) {
        toast.error('Clicking too fast! Please wait a moment.');
        return;
    }

    if (!checkClickRate()) {
        // Autoclicker detected
        setIsClickBlocked(true);
        toast.error('🛑 Autoclicker detected! You are blocked from liking for 30 seconds.');
        console.warn('[BroadcastPage] Autoclicker detected for user:', user.id);
        
        // Unblock after duration
        setTimeout(() => {
            setIsClickBlocked(false);
            clickHistoryRef.current = []; // Clear history
            toast.info('You can now like again.');
        }, BLOCK_DURATION_MS);
        return;
    }

    try {
        // Get session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.error('Please sign in to like');
            return;
        }

        // Check if stream exists
        if (!stream?.id) {
            toast.error('Stream not found');
            return;
        }

        // Call the edge function to process like and award coins
        const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
        console.log('[BroadcastPage] Sending like to:', edgeUrl);
        
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

        // Handle 404 error specifically
        if (response.status === 404) {
            console.error('[BroadcastPage] Like endpoint not found (404). Edge function may not be deployed.');
            toast.error('Like feature temporarily unavailable. Please try again later.');
            return;
        }

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('[BroadcastPage] Failed to parse like response:', parseError);
            toast.error('Failed to process like. Please try again.');
            return;
        }

        if (!response.ok) {
            console.error('Like error:', result);
            toast.error(result?.error || 'Failed to send like');
            return;
        }

        // Broadcast like event to all viewers in real-time
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
            console.log('[BroadcastPage] Like broadcast sent');
        }

        // Update local state with actual count from server
        setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: result.total_likes };
        });

        // Show coin reward notification if coins were awarded
        if (result.coins_awarded > 0) {
            toast.success(
                `🎉 You earned ${result.coins_awarded} Troll Coin${result.coins_awarded !== 1 ? 's' : ''}! ` +
                `(${result.user_like_count.toLocaleString()} likes)`,
                { duration: 5000 }
            );
        }

        console.log('[BroadcastPage] Like processed:', {
            total_likes: result.total_likes,
            user_likes: result.user_like_count,
            coins_awarded: result.coins_awarded
        });

    } catch (e) {
        console.error('Like error:', e);
        toast.error('Failed to send like');
    }
  };

  const handleStreamEnd = async () => {
    // CRITICAL: Log the exact stream being ended
    console.log('[STREAM_LIFECYCLE] Ending stream:', {
      streamId: stream?.id,
      userId: user?.id,
      isHost,
      currentStatus: stream?.status,
      currentIsLive: stream?.is_live,
      timestamp: new Date().toISOString()
    });
    
    // Stop camera and mic before leaving
    stopLocalTracks();
    
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
          
          console.log('[STREAM_LIFECYCLE] Leaving battle on stream end:', {
            battleId: battleData.id,
            streamId: stream.id,
            opponentStreamId
          });
          
          // Call leave_battle to properly credit winner and end battle
          const { error: leaveError } = await supabase.rpc('leave_battle', {
            p_battle_id: battleData.id,
            p_user_id: user.id
          });
          
          if (leaveError) {
            console.warn('[STREAM_LIFECYCLE] Failed to leave battle:', leaveError);
          } else {
            console.log('[STREAM_LIFECYCLE] Left battle, opponent credited as winner');
          }
        }
      } catch (battleErr) {
        console.warn('[STREAM_LIFECYCLE] Error handling battle on stream end:', battleErr);
      }
    }
    
    // Mark stream as ended in database - CRITICAL SECTION
    try {
      console.log('[STREAM_LIFECYCLE] Updating stream in DB:', { streamId: stream?.id });
      
      const { data: updateResult, error: updateError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', stream.id)
        .select('id, is_live, status, ended_at');
      
      if (updateError) {
        console.error('[STREAM_LIFECYCLE] FAILED to mark stream as ended:', {
          streamId: stream?.id,
          error: updateError.message,
          code: updateError.code
        });
        toast.error('Failed to end stream properly. Please try again.');
        return;
      }
      
      console.log('[STREAM_LIFECYCLE] Stream successfully marked as ended:', {
        streamId: stream?.id,
        updateResult
      });
    } catch (endErr) {
      console.error('[STREAM_LIFECYCLE] EXCEPTION marking stream as ended:', {
        streamId: stream?.id,
        error: endErr.message
      });
    }
    
    // Immediately update local state for instant navigation
    setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);
    // Navigate to summary page
    navigate(`/broadcast/summary/${stream?.id}`);
  };

  // Compute active user IDs and profiles for gift recipient selection (MUST be before early returns)
  const activeUserIds = useMemo(() => {
    if (!stream) return [];
    const ids: string[] = [];
    Object.values(seats).forEach((seat: any) => {
      if (seat?.user_id && seat.user_id !== stream.user_id) {
        ids.push(seat.user_id);
      }
    });
    return ids;
  }, [seats, stream?.user_id]);

  const userProfiles = useMemo(() => {
    if (!stream) return {};
    const profiles: Record<string, { username: string; avatar_url?: string }> = {};
    
    // Add broadcaster
    if (broadcasterProfile) {
      profiles[stream.user_id] = {
        username: broadcasterProfile.username || 'Broadcaster',
        avatar_url: broadcasterProfile.avatar_url,
      };
    }
    
    // Add seat users
    Object.values(seats).forEach((seat: any) => {
      if (seat?.user_id && seat.user_profile) {
        profiles[seat.user_id] = {
          username: seat.user_profile.username || 'User',
          avatar_url: seat.user_profile.avatar_url,
        };
      }
    });
    
    return profiles;
  }, [seats, broadcasterProfile, stream?.user_id]);

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
      <StreamLayout
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        
        header={
          <BroadcastHeader
            stream={stream}
            isHost={isHost}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteUsers.length}
            handleLike={handleLike}
            onStartBattle={isHost && categorySupportsBattles ? () => setIsBattleMode(true) : undefined}
            categoryBattleTerm={categorySupportsBattles ? categoryMatchingTerm : undefined}
            onBack={() => {
              if (isHost) {
                handleStreamEnd();
              } else {
                navigate('/');
              }
            }}
          />
        }
        
        video={
          <BroadcastGrid
            stream={stream}
            seats={seats}
            onJoinSeat={(index) => handleJoinSeat(index, stream.seat_price)}
            isHost={isHost}
            localTracks={
              localTracks
                ? [localTracks[0], localTracks[1]]
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
            boxCount={boxCount}
          />
        }
        
        controls={
          <BroadcastControls
            stream={stream}
            isHost={isHost}
            isOnStage={!!userSeat}
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteUsers.length}
            chatOpen={isChatOpen}
            toggleChat={() => setIsChatOpen(!isChatOpen)}
            onGiftHost={() => onGift(stream.user_id)}
            onLeave={leaveSeat}
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
          />
        }
        
        chat={
          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={isHost}
            isViewer={!userSeat && !isHost}
            isGuest={!user}
          />
        }
        
        overlays={
          <>
            <GiftAnimationOverlay
              gifts={recentGifts}
              userPositions={giftUserPositions}
              getUserPositions={getGiftUserPositionsRef.current}
              onAnimationComplete={(giftId) => {
                setGiftUserPositions(getGiftUserPositionsRef.current());
                setRecentGifts(prev => prev.filter(g => g.id !== giftId));
              }}
            />
            
            {!isHost && pinnedProducts.length > 0 && (
              <PinnedProductOverlay pinnedProducts={pinnedProducts} />
            )}
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
              recipientId={giftRecipientId || stream?.user_id || ''}
              streamId={streamId || ''}
              broadcasterId={stream.user_id}
              activeUserIds={activeUserIds}
              userProfiles={userProfiles}
              sharedChannel={channelRef.current}
              onGiftSent={(giftData: GiftItem, target: GiftTarget) => {
                const quantity = target.quantity || 1;
                console.log('[BroadcastPage] onGiftSent called:', { giftData, target, userId: user?.id });
                
                // Handle gift target for animation positioning
                if (target.type === 'all') {
                  // Send to all users - create multiple gift animations
                  const allRecipients = [stream.user_id, ...activeUserIds];
                  console.log('[BroadcastPage] Creating gift animations for all recipients:', allRecipients);
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
                      console.log('[BroadcastPage] Adding gift to recentGifts (all):', newGift);
                      setRecentGifts(prev => {
                        const updated = [...prev, newGift];
                        console.log('[BroadcastPage] Updated recentGifts count:', updated.length);
                        return updated;
                      });
                    }, index * 200); // Stagger animations
                  });
                } else {
                  // Single recipient
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
                  console.log('[BroadcastPage] Adding gift to recentGifts (single):', newGift);
                  setRecentGifts(prev => {
                    const updated = [...prev, newGift];
                    console.log('[BroadcastPage] Updated recentGifts count:', updated.length);
                    return updated;
                  });
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
          </>
        }
      />
    </ErrorBoundary>
  )
}

export default BroadcastPage