import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

import { Stream } from '../../types/broadcast'
import StreamLayout from '../../components/broadcast/StreamLayout'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal, { GiftTarget, GiftItem } from '../../components/broadcast/GiftBoxModal'
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
import { 
  Room, 
  RoomEvent, 
  RemoteParticipant,
  VideoPresets
} from 'livekit-client'

function ViewerPage() {
  /** ROUTER PARAM FIX */
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // LiveKit state for viewers
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([])
  const roomRef = useRef<Room | null>(null)
  
  // Track mapping from user IDs to LiveKit identities
  const [userIdToParticipant, setUserIdToParticipant] = useState<Record<string, RemoteParticipant>>({})

  const [isChatOpen, setIsChatOpen] = useState(true)
  const [viewerCount, setViewerCount] = useState(0)
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)
  const hasJoinedRef = useRef(false)

  // Update streamRef when stream changes
  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  // Determine host status
  const isHost = stream?.user_id === user?.id

  // Pinned products hook
  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost: false, // Viewers are never hosts
  })

  // Gift system state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
  const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
  const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))

  // Callback to get user positions
  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  // Pin product modal state
  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)

  // Get LiveKit credentials
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;

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

      console.log('[ViewerPage] Fetched stream');
      setStream(data)

      // Fetch broadcaster profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user_id)
        .single()
      
      if (profileData) {
        setBroadcasterProfile(profileData)
      }

      if (data.status === 'ended') {
        navigate(`/broadcast/summary/${streamId}`)
      }

      setIsLoading(false)
    }

    fetchStream()
  }, [streamId, navigate])

  /** LIVEKIT INIT FOR VIEWERS */
  useEffect(() => {
    if (!streamId || !stream || !user || hasJoinedRef.current) return;

    hasJoinedRef.current = true;
    console.log('[ViewerPage] Initializing LiveKit for viewer...');

    const initLiveKit = async () => {
      try {
        // Create LiveKit room for viewer (audience)
        const room = new Room({
          adaptiveStream: true,
          dynacast: true
        });

        roomRef.current = room;

        // Set up event handlers
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('[ViewerPage] Participant connected:', participant.identity);
          setRemoteParticipants(prev => {
            const exists = prev.find(p => p.identity === participant.identity);
            if (exists) return prev;
            return [...prev, participant];
          });
          
          // Map user ID if we can determine it
          if (stream?.user_id) {
            setUserIdToParticipant(prev => ({ ...prev, [stream.user_id]: participant }));
          }
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('[ViewerPage] Participant disconnected:', participant.identity);
          setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
          setUserIdToParticipant(prev => {
            const updated = { ...prev };
            // Remove any entries that point to this participant
            Object.keys(updated).forEach(key => {
              if (updated[key].identity === participant.identity) {
                delete updated[key];
              }
            });
            return updated;
          });
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('[ViewerPage] Track subscribed:', track.kind, 'from', participant.identity);
          // Force re-render
          setRemoteParticipants(prev => [...prev]);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log('[ViewerPage] Track unsubscribed:', track.kind, 'from', participant.identity);
          setRemoteParticipants(prev => [...prev]);
        });

        // Generate a unique viewer identity
        const viewerIdentity = `viewer-${user.id}-${Date.now()}`;
        console.log('[ViewerPage] Viewer identity:', viewerIdentity);
        
        // Request LiveKit token for viewer role
        console.log('[ViewerPage] Requesting LiveKit token for viewer');
        const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
          body: {
            room: streamId,
            userId: viewerIdentity,
            role: 'viewer'
          }
        });

        console.log('[ViewerPage] Token response:', data);
        console.log('[ViewerPage] Token error:', tokenError);

        if (tokenError) {
          console.error('[ViewerPage] Token fetch error:', tokenError);
          return;
        }

        const token = data?.token;
        const url = getLiveKitUrl();
        const apiKey = getLiveKitApiKey();
        
        console.log('[ViewerPage] LiveKit URL:', url);
        console.log('[ViewerPage] LiveKit API Key:', apiKey);

        if (!token || !url || !apiKey) {
          console.error('[ViewerPage] CRITICAL: Missing LiveKit configuration!');
          return;
        }

        // Connect as viewer
        console.log('[ViewerPage] Connecting to LiveKit room...');
        await room.connect(url, token, {
          name: streamId,
          identity: viewerIdentity
        });
        
        console.log('[ViewerPage] ✅ Viewer connected to LiveKit room successfully');
        
        // Get existing participants
        const existingParticipants = Array.from(room.participants.values());
        setRemoteParticipants(existingParticipants);
        
        if (stream?.user_id && existingParticipants.length > 0) {
          setUserIdToParticipant(prev => ({ ...prev, [stream.user_id]: existingParticipants[0] }));
        }
        
      } catch (err) {
        console.error('[ViewerPage] LiveKit init error:', err);
      }
    };

    initLiveKit();

    // Cleanup
    return () => {
      console.log('[ViewerPage] Cleaning up LiveKit room');
      if (roomRef.current) {
        roomRef.current.disconnect().catch(console.error);
        roomRef.current = null;
      }
      hasJoinedRef.current = false;
    };
  }, [streamId, stream?.user_id, user?.id]);

  /** REALTIME STREAM UPDATES */
  useEffect(() => {
    if (!streamId) return;

    console.log('[ViewerPage] Setting up realtime channel for stream:', streamId);
    const channel = supabase.channel(`stream-viewer:${streamId}`);

    // Track presence for viewer count
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
        
        for (const p of newPresences as any[]) {
          if (p.is_host) {
            console.log('[ViewerPage] Broadcaster joined - stream is live!');
          }
        }
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
            
            // Navigate to summary when stream ends
            if (payload.new.status === 'ended' || payload.new.is_live === false) {
              console.log('[ViewerPage] Stream ended, navigating to summary');
              setTimeout(() => {
                navigate(`/broadcast/summary/${streamId}`);
              }, 100);
            }
          } catch (err) {
            console.error('[ViewerPage] Error processing stream update:', err);
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
            console.log('[ViewerPage] Gift received:', giftData);
            
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
          } catch (err) {
            console.error('[ViewerPage] Error processing gift:', err);
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
            console.log('[ViewerPage] Like received:', likeData);
            
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 1;
              return { ...prev, total_likes: newTotal };
            });
          } catch (err) {
            console.error('[ViewerPage] Error processing like:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('[ViewerPage] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[ViewerPage] ✅ Subscription SUCCESSFUL');
          
          channelRef.current = channel;
          
          // Track presence as viewer
          channel.track({
            user_id: user?.id || 'viewer',
            username: profile?.username || user?.email || 'Viewer',
            is_host: false,
            is_viewer: true,
            online_at: new Date().toISOString(),
            avatar_url: profile?.avatar_url || ''
          }).catch(console.error);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[ViewerPage] ❌ Subscription FAILED');
        }
      });

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now(), user_id: user?.id }
        }).catch(() => {
          // Ignore errors
        });
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate, user?.id]);

  // Click rate tracking for autoclicker detection
  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);
  const CLICK_WINDOW_MS = 2000;
  const MAX_CLICKS_IN_WINDOW = 5;
  const BLOCK_DURATION_MS = 30000;

  const checkClickRate = () => {
    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter(
      timestamp => now - timestamp < CLICK_WINDOW_MS
    );
    clickHistoryRef.current.push(now);
    if (clickHistoryRef.current.length > MAX_CLICKS_IN_WINDOW) {
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
        console.warn('[ViewerPage] Autoclicker detected for user:', user.id);
        
        setTimeout(() => {
            setIsClickBlocked(false);
            clickHistoryRef.current = [];
            toast.info('You can now like again.');
        }, BLOCK_DURATION_MS);
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
        console.log('[ViewerPage] Sending like to:', edgeUrl);
        
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
            console.error('[ViewerPage] Like endpoint not found (404).');
            toast.error('Like feature temporarily unavailable. Please try again later.');
            return;
        }

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('[ViewerPage] Failed to parse like response:', parseError);
            toast.error('Failed to process like. Please try again.');
            return;
        }

        if (!response.ok) {
            console.error('Like error:', result);
            toast.error(result?.error || 'Failed to send like');
            return;
        }

        // Broadcast like event
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
            console.log('[ViewerPage] Like broadcast sent');
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

  const onGift = (userId: string) => {
    setGiftRecipientId(userId);
    setIsGiftModalOpen(true);
  }

  /** LOADING */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Loading stream...</p>
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

  // Get video track from participant
  const getParticipantVideoTrack = (participant: RemoteParticipant) => {
    const videoPub = Array.from(participant.videoTrackPublications.values()).find(p => p.isSubscribed && p.track);
    return videoPub?.track;
  };

  const getParticipantAudioTrack = (participant: RemoteParticipant) => {
    const audioPub = Array.from(participant.audioTrackPublications.values()).find(p => p.isSubscribed && p.track);
    return audioPub?.track;
  };

  // Render video using LiveKit remote participants
  return (
    <ErrorBoundary>
      <StreamLayout
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        
        header={
          <BroadcastHeader
            stream={stream}
            isHost={false}
            liveViewerCount={viewerCount}
            handleLike={handleLike}
            onStartBattle={undefined}
            categoryBattleTerm={undefined}
          />
        }
        
        video={
          // Viewers use LiveKit - subscribe to remote tracks
          <div className="relative w-full h-full bg-black">
            {remoteParticipants.length > 0 ? (
              remoteParticipants.map((participant) => {
                const videoTrack = getParticipantVideoTrack(participant);
                return (
                  <div key={participant.identity} className="absolute inset-0">
                    {videoTrack ? (
                      <div
                        ref={(el) => {
                          if (el && videoTrack) {
                            const mediaElement = (videoTrack as any).attach?.();
                            if (mediaElement && el.firstChild === null) {
                              el.appendChild(mediaElement);
                            }
                          }
                        }}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-white/50">
                        <p>Broadcaster camera is off</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center w-full h-full text-white/50">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                  <p>Connecting to stream...</p>
                </div>
              </div>
            )}
          </div>
        }
        
        controls={
          <div className="flex items-center justify-between p-4 bg-gray-900">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`px-4 py-2 rounded-lg ${
                  isChatOpen ? 'bg-purple-600' : 'bg-gray-700'
                } text-white hover:bg-purple-700 transition-colors`}
              >
                {isChatOpen ? 'Hide Chat' : 'Show Chat'}
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLike}
                disabled={isClickBlocked}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
              >
                ❤️ Like {stream.total_likes ? `(${stream.total_likes})` : ''}
              </button>
              
              <button
                onClick={() => onGift(stream.user_id)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                🎁 Gift
              </button>
            </div>
          </div>
        }
        
        chat={
          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={false}
            isViewer={true}
            isGuest={false}
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
            
            {pinnedProducts.length > 0 && (
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
              activeUserIds={[]}
              userProfiles={{}}
              sharedChannel={channelRef.current}
              onGiftSent={(giftData: GiftItem, target: GiftTarget) => {
                // Gift animations disabled per user request - do not add to recentGifts
                // The gift is still sent successfully via the GiftBoxModal
                console.log('[ViewerPage] Gift sent (animations disabled):', giftData.name);
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

export default ViewerPage
