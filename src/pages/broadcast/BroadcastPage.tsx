import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Room, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, LocalParticipant } from 'livekit-client'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useStreamStore } from '../../lib/streamStore'
import { PreflightStore } from '../../lib/preflightStore'
import { emitEvent } from '../../lib/events'

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
import {
  getCategoryConfig,
  supportsBattles,
  getMatchingTerminology,
} from '../../config/broadcastCategories'
import ChallengeManager from '../../components/broadcast/ChallengeManager'
import BattleGridOverlay from '../../components/broadcast/BattleGridOverlay'

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStreamSeats } from '../../hooks/useStreamSeats'

function BroadcastPage() {
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { clearTracks } = useStreamStore()

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
  const [viewerCount, setViewerCount] = useState(0)
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  const [battleData, setBattleData] = useState<any>(null)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  
  const hasJoinedRef = useRef(false)
  const roomRef = useRef<Room | null>(null)
  
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
  const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
  const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))

  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

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

  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  const {
    boxCount,
    setBoxCount: updateBoxCount,
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

  const { seats, mySession: userSeat, joinSeat, leaveSeat } =
    useStreamSeats(stream?.id, user?.id, broadcasterProfile, stream)

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
      setIsLoading(false)
      return
    }

    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*, total_likes, hls_url, is_battle, battle_id')
        .eq('id', streamId)
        .maybeSingle()

      if (error || !data) {
        setError('Stream not found.')
        toast.error('Stream not found.')
        navigate('/')
        return
      }

      setStream(data)
      
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
        stopLocalTracks()
        navigate(`/broadcast/summary/${streamId}`)
      }

      setIsLoading(false)
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
  }, [streamId, stream, isHost, supabase]);

  useEffect(() => {
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
            setRecentGifts(prev => [...prev, newGift]);
            
            // If this gift is for the broadcaster (host), refresh their profile to show updated balance
            if (giftData.receiver_id === stream?.user_id) {
              console.log('[BroadcastPage] Gift received by broadcaster, refreshing profile for balance update');
              // Use the auth store's refreshProfile method
              const { refreshProfile } = useAuthStore.getState();
              refreshProfile().catch(err => {
                console.warn('[BroadcastPage] Failed to refresh broadcaster profile after gift:', err);
              });
            }
            
            // If the receiver is a guest user in a seat, refresh their profile too
            // Check if receiver is in any of the current seats
            const receiverSeat = Object.values(seats).find(
              (seat: any) => seat.user_id === giftData.receiver_id || seat.guest_id === giftData.receiver_id
            );
            if (receiverSeat) {
              console.log('[BroadcastPage] Gift received by guest user in seat, refreshing profile for balance update');
              const { refreshProfile } = useAuthStore.getState();
              refreshProfile().catch(err => {
                console.warn('[BroadcastPage] Failed to refresh guest profile after gift:', err);
              });
            }
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
  }, [streamId, navigate, stopLocalTracks, user?.id]);

  useEffect(() => {
    // Allow guests with seats to initialize LiveKit
    // Guests may not have user.id but can have userSeat from joinSeat
    const hasUserIdentity = !!user?.id || !!userSeat;
    
    if (!stream || !stream.id || !hasUserIdentity) {
      return;
    }

    if (hasJoinedRef.current) {
      return;
    }

    const shouldPublish = isHost || !!userSeat;
    
    // Determine the user identity for LiveKit
    // Use user.id for logged-in users, or guest_id from userSeat for guests
    const userIdentity = user?.id || userSeat?.guest_id || `guest-${Date.now()}`;
    
    let mounted = true

    const initLiveKit = async () => {
      if (!shouldPublish) {
        setIsJoining(true)
        try {
          const viewerIdentity = `viewer-${userIdentity.substring(0, 8)}-${Date.now()}`
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: {
              room: stream.id,
              identity: viewerIdentity,
              name: profile?.username || user?.email || userSeat?.user_profile?.username || 'Viewer',
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
        } finally {
          setIsJoining(false)
        }
        return
      }

      setIsJoining(true)

      try {
        const hostIdentity = userIdentity
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
          
          // Wait for tracks to be published - give more time for device initialization
          await new Promise(resolve => setTimeout(resolve, 1500))
          
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

        await supabase
          .from('streams')
          .update({ is_live: true, status: 'live' })
          .eq('id', stream.id)

        hasJoinedRef.current = true

      } catch (err) {
        console.error('LiveKit init error:', err)
      } finally {
        setIsJoining(false)
      }
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
    } catch (endErr) {
      console.error('Exception marking stream as ended:', endErr);
    }
    
    setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);
    navigate(`/broadcast/summary/${stream?.id}`);
  };

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

  const categoryConfig = getCategoryConfig(stream.category || 'general')
  const categorySupportsBattles = supportsBattles(stream.category || 'general')
  const categoryMatchingTerm = getMatchingTerminology(stream.category || 'general');

  // Show loading while fetching battle data (only for non-broadcasters who would see BattleView)
  if (stream.is_battle && isBattleLoading && !isHost) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Loading battle...</p>
      </div>
    );
  }

  // Handle battle mode: show overlay for anyone in a battle (broadcaster or participant)
  const shouldShowBattleOverlay = stream.is_battle && battleData;

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
            liveViewerCount={viewerCount > 0 ? viewerCount : remoteParticipants.size}
            handleLike={handleLike}
            onStartBattle={isHost && categorySupportsBattles ? () => setIsBattleMode(true) : undefined}
            categoryBattleTerm={categorySupportsBattles ? categoryMatchingTerm : undefined}
            onChallengeBroadcaster={!isHost && categorySupportsBattles ? handleDirectChallenge : undefined}
            hasPendingChallenge={hasPendingChallenge}
          />
        }
        
        video={
          <div className="flex flex-col h-full">
            {/* When in battle mode, show battle grid instead of regular broadcast */}
            {shouldShowBattleOverlay && battleData ? (
              <BattleGridOverlay
                battleId={stream.battle_id}
                streamId={stream.id}
                isHost={isHost}
                localTracks={localTracks}
                remoteParticipants={Array.from(remoteParticipants.values())}
                userId={user?.id || ''}
                userProfile={broadcasterProfile}
                onEndBattle={async () => {
                  // End the battle and return to normal broadcast
                  try {
                    await supabase
                      .from('battles')
                      .update({ status: 'ended' })
                      .eq('id', stream.battle_id);
                    
                    await supabase
                      .from('streams')
                      .update({ is_battle: false, battle_id: null })
                      .eq('id', stream.id);
                    
                    setBattleData(null);
                    setStream((prev: any) => prev ? { ...prev, is_battle: false, battle_id: null } : prev);
                    toast.success('Battle ended');
                  } catch (err) {
                    console.error('Error ending battle:', err);
                    toast.error('Failed to end battle');
                  }
                }}
              />
            ) : (
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
                  localUserId={user?.id}
                  onGift={onGift}
                  onGiftAll={onGiftAll}
                  toggleCamera={toggleCamera}
                  toggleMicrophone={toggleMicrophone}
                  onGetUserPositions={handleGetUserPositions}
                  broadcasterProfile={broadcasterProfile}
                  streamStatus={stream.status}
                  boxCount={boxCount}
                />
              </>
            )}
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
