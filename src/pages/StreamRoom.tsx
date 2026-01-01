import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Room, RoomEvent, ConnectionState, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useLiveContextStore } from '../lib/liveContextStore';
import { toast } from 'sonner';
import { Users, Shield, MessageSquare, Gift, Settings, X, Ban, VolumeX } from 'lucide-react';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';
import { deductCoins } from '../lib/coinTransactions';
import { useGlobalApp } from '../contexts/GlobalAppContext';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { coinPackages, formatUSD } from '../lib/coinMath';
import { createPayPalOrder, capturePayPalOrder, getPayPalConfig } from '../lib/paypalUtils';
import JoinRequestsPanel from '../components/stream/JoinRequestsPanel';
import OfficerInviteModal from '../components/stream/OfficerInviteModal';
import TrollDrop from '../components/stream/TrollDrop';
import { createTrollDrop, canDropTroll } from '../lib/trollDropUtils';
import { TrollDrop as TrollDropType } from '../types/trollDrop';
import GiftTray from '../components/GiftTray';
import { getUserInventory, sendGiftFromInventory } from '../lib/giftEngine';
import StreamDiagnostics from '../components/StreamDiagnostics';

interface GiftItem {
  id: string;
  name: string;
  cost: number;
  icon: string;
}

// Stable, UTF-8-safe paid gift list for the stream gift box UI.
const PAID_GIFT_ITEMS: GiftItem[] = [
  { id: 'heart', name: 'Heart', cost: 10, icon: '❤️' },
  { id: 'troll', name: 'Troll Face', cost: 25, icon: '🧌' },
  { id: 'coin', name: 'Gold Coin', cost: 50, icon: '🪙' },
  { id: 'crown', name: 'Crown', cost: 100, icon: '👑' },
  { id: 'diamond', name: 'Diamond', cost: 250, icon: '💎' },
  { id: 'rocket', name: 'Rocket', cost: 500, icon: '🚀' },
];

const participantHasVideo = (participant: any) => {
  try {
    const pubs = participant?.videoTrackPublications;
    if (!pubs) return false;
    const values = typeof pubs.values === 'function' ? Array.from(pubs.values()) : [];
    return values.some((pub: any) => pub?.track?.kind === 'video');
  } catch {
    return false;
  }
};

interface StreamMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
  role?: string;
  level?: number;
}

interface TrollbagItem {
  item_id: string;
  quantity: number;
  inventory_items: {
    id: string;
    name: string;
    icon: string;
    trollmond_value: number;
  };
}

export default function StreamRoom() {
  const { id, streamId } = useParams<{ id?: string; streamId?: string }>();
  const streamIdValue = id || streamId;
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuthStore();
  const { setError, setRetryAction, setStreamEnded, clearError } = useGlobalApp();
  const setActiveStreamId = useLiveContextStore((s) => s.setActiveStreamId);

  useEffect(() => {
    if (!streamIdValue) return;
    setActiveStreamId(streamIdValue);
    return () => setActiveStreamId(null);
  }, [streamIdValue, setActiveStreamId]);

  const [stream, setStream] = useState<any>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Stream stats

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showGiftBox, setShowGiftBox] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [giftTarget, setGiftTarget] = useState<'host' | 'guest' | 'viewer'>('host');
  const [selectedGuest, setSelectedGuest] = useState<string>('');
  const [giftCurrency, setGiftCurrency] = useState<'troll_coins' | 'trollmonds'>('troll_coins');
  const [showHostControls, setShowHostControls] = useState(false);
  const [showQuickStore, setShowQuickStore] = useState(false);
  const [processingPackage, setProcessingPackage] = useState<string | null>(null);
  const [isJoinApproved, setIsJoinApproved] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const paypalConfig = useMemo(() => {
    try {
      return getPayPalConfig();
    } catch {
      return null;
    }
  }, []);

  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [giftInventory, setGiftInventory] = useState<any[]>([]);
  const [isLoadingGiftInventory, setIsLoadingGiftInventory] = useState(false);
  const [giftFlash, setGiftFlash] = useState<null | { gift: any; quantity: number; senderName: string }>(null);
  const giftFlashTimeout = useRef<NodeJS.Timeout | null>(null);

  // Moderation
  const [isOfficer, setIsOfficer] = useState(false);
  const [isStreamAdmin, setIsStreamAdmin] = useState(false);

  // Multi-box controls
  const [guestSlots, setGuestSlots] = useState(0);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [trollbagInventory, setTrollbagInventory] = useState<TrollbagItem[]>([]);
  const [isLoadingTrollbag, setIsLoadingTrollbag] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Troll drops
  const [activeTrollDrop, setActiveTrollDrop] = useState<TrollDropType | null>(null);
  const streamStartTimeRef = useRef<number>(0);
  const trollDropIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const viewerCountedRef = useRef(false);
  const publishedTracksRef = useRef(false);

  // Backwards-compatible engagement tables (some deployments may not have newer tables yet).
  const [engagementTables, setEngagementTables] = useState<{
    messages: 'stream_messages' | 'messages';
    gifts: 'stream_gifts' | 'gifts';
    likes: 'stream_likes' | 'stream_reactions' | null;
  }>({
    messages: 'stream_messages',
    gifts: 'stream_gifts',
    likes: 'stream_likes',
  });

  // LiveKit
  const liveKitUser = useMemo(
    () =>
      user
        ? { ...user, role: (profile as any)?.troll_role || 'viewer', level: profile?.level || 1 }
        : null,
    [user, profile?.level, (profile as any)?.troll_role]
  );
  const liveKitOptions = useMemo(
    () => ({ isHost, allowPublish: isHost || isJoinApproved, enabled: true, autoReconnect: !isReconnecting }),
    [isHost, isJoinApproved, isReconnecting]
  );
  const {
    room,
    participants: participantsMap,
    connectionStatus,
    disconnect,
  } = useLiveKitRoom({
    roomName: stream?.id || streamIdValue,
    user: liveKitUser,
    ...liveKitOptions
  });

  const loadGiftInventory = async () => {
    if (!user?.id) return
    setIsLoadingGiftInventory(true)
    try {
      const data = await getUserInventory(user.id)
      setGiftInventory(data)
    } catch (error) {
      console.warn('Failed to load gift inventory', error)
    } finally {
      setIsLoadingGiftInventory(false)
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setGiftInventory([])
      setIsGiftTrayOpen(false)
      return
    }
    loadGiftInventory()
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (giftFlashTimeout.current) {
        clearTimeout(giftFlashTimeout.current)
      }
    }
  }, [])
  
  const handleOpenGiftTray = async () => {
    if (!user?.id) {
      toast.error('Sign in to open the Gift Tray.')
      return
    }
    setIsGiftTrayOpen(true)
    await loadGiftInventory()
  }

  const triggerGiftFlash = (gift, quantity, senderName) => {
    if (giftFlashTimeout.current) {
      clearTimeout(giftFlashTimeout.current)
    }
    setGiftFlash({ gift, quantity, senderName })
    giftFlashTimeout.current = setTimeout(() => setGiftFlash(null), 3200)
  }

  const handleTraySendGift = async (giftSlug, quantity) => {
    if (!user?.id || !profile) {
      toast.error('Log in to send gifts.')
      return
    }
    if (!stream?.broadcaster_id) {
      toast.error('Broadcast not ready yet.')
      return
    }

    try {
      const result = await sendGiftFromInventory({
        senderId: user.id,
        giftSlug,
        quantity,
        receiverId: stream.broadcaster_id,
        streamId: stream.id,
        context: 'gift_tray',
      })

      if (!result.success) {
        throw new Error(result.error || 'Gift delivery failed')
      }

      const senderName = profile.username || 'You'
      toast.success(`${senderName} sent ${result.gift.name} x${quantity}`)
      triggerGiftFlash(result.gift, quantity, senderName)
      await loadGiftInventory()
      setIsGiftTrayOpen(false)
    } catch (error) {
      console.error('Gift tray send error:', error)
      toast.error(error.message || 'Failed to send gift')
    }
  }

  // `useLiveKitRoom` returns a participant map keyed by identity; normalize to an array for UI code.
  const participants = useMemo<any[]>(() => Object.values(participantsMap || {}), [participantsMap]);
  

  // Load stream data
  useEffect(() => {
    if (!streamIdValue) {
      setError('Stream ID not found');
      setIsLoadingStream(false);
      return;
    }

    const loadStream = async () => {
      try {
        const { data, error: streamError } = await supabase
          .from('streams')
          .select(`
            *,
            user_profiles!broadcaster_id (
              id,
              username,
              avatar_url,
              level
            )
          `)
          .eq('id', streamIdValue)
          .single();

        if (streamError || !data) {
          setLocalError('Stream not found');
          setIsLoadingStream(false);
          return;
        }

        if (!data.is_live) {
          setLocalError('Stream is not live');
          setIsLoadingStream(false);
          return;
        }

        const isHostUser = data.broadcaster_id === profile?.id;

        // Check audience restrictions
        if (data.audience_type === 'followers' && user && profile) {
          // Check if user follows the streamer
          const { data: followData } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', profile.id)
            .eq('following_id', data.broadcaster_id)
            .single();

          if (!followData) {
            setError('This stream is for followers only');
            setIsLoadingStream(false);
            return;
          }
        }

        if (data.audience_type === 'family' && user && profile) {
          // Check if user is in the same family
          const { data: memberData } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', profile.id)
            .single();

          const { data: streamerFamilyData } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', data.broadcaster_id)
            .single();

          if (!memberData || !streamerFamilyData || memberData.family_id !== streamerFamilyData.family_id) {
            setError('This stream is for family members only');
            setIsLoadingStream(false);
            return;
          }
        }

        // Check paid entry
        if (data.is_paid && data.entry_price_coins > 0 && user && profile && !isHostUser) {
          if (profile.troll_coins < data.entry_price_coins) {
            setError(`This stream requires ${data.entry_price_coins} Troll Coins to join`);
            setIsLoadingStream(false);
            return;
          }

          // Deduct entry fee
          const result = await deductCoins({
            userId: profile.id,
            amount: data.entry_price_coins,
            type: 'purchase',
            description: `Entry fee for stream: ${data.title}`,
            metadata: { stream_id: data.id }
          });

          if (!result.success) {
            setError('Failed to pay entry fee');
            setIsLoadingStream(false);
            return;
          }

        }

        setStream(data);
        setIsHost(isHostUser);

        // Check if user is officer
        const userRole = profile?.role;
        setIsOfficer(['admin', 'lead_troll_officer', 'troll_officer'].includes(userRole));
        
        // Check if user can end stream (admin, lead_troll_officer, troll_officer, broadcaster)
        setIsStreamAdmin(['admin', 'lead_troll_officer', 'troll_officer', 'broadcaster'].includes(userRole));

        setIsLoadingStream(false);
      } catch (err: any) {
        console.error('Stream initialization error:', err);
        setError(err.message || 'Failed to load stream');
        setIsLoadingStream(false);
      }
    };

    loadStream();
  }, [streamIdValue, user, profile]);

  // Update guest slots when stream loads
  useEffect(() => {
    // Total tiles are capped to 6 (host + up to 5 guests).
    setGuestSlots(Math.min(5, Math.max(0, stream?.max_guest_slots ?? 0)));
  }, [stream?.max_guest_slots]);

  // Initialize and spawn troll drops
  useEffect(() => {
    if (!stream?.id) return;
    
    if (streamStartTimeRef.current === 0) {
      streamStartTimeRef.current = new Date(stream.start_time).getTime();
    }

    const spawnTrollDrop = async () => {
      try {
        const now = Date.now();
        const broadcastDuration = now - streamStartTimeRef.current;
        
        const canDrop = await canDropTroll(stream.id, broadcastDuration);
        if (!canDrop) return;

        const color = Math.random() > 0.5 ? 'green' : 'red';
        const drop = await createTrollDrop(stream.id, color, user?.id);
        
        if (drop) {
          setActiveTrollDrop(drop);
        }
      } catch (err) {
        console.error('Error spawning troll drop:', err);
      }
    };

    const randomDelay = Math.random() * 30000 + 15000;
    trollDropIntervalRef.current = setInterval(() => {
      spawnTrollDrop();
    }, 45000);

    setTimeout(spawnTrollDrop, randomDelay);

    return () => {
      if (trollDropIntervalRef.current) {
        clearInterval(trollDropIntervalRef.current);
      }
    };
  }, [stream?.id, stream?.start_time]);

  // Load stream stats and messages
  useEffect(() => {
    if (!stream?.id) return;

    // Load initial stats
    const loadStats = async () => {
      try {
        // Likes (prefer stream_reactions so users can spam-like; fall back to unique stream_likes)
        let likesTable: 'stream_likes' | 'stream_reactions' | null = 'stream_reactions';
        const { error: reactionsError } = await supabase
          .from('stream_reactions')
          .select('id')
          .eq('reaction_type', 'like')
          .eq('stream_id', stream.id);

        if (reactionsError) {
          const { error: likesError } = await supabase
            .from('stream_likes')
            .select('id')
            .eq('stream_id', stream.id);

          if (!likesError) {
            likesTable = 'stream_likes';
          } else {
            likesTable = null;
          }
        }

        // Gifts (prefer stream_gifts; fall back to gifts)
        let giftsTable: 'stream_gifts' | 'gifts' = 'stream_gifts';

        const { error: giftsError } = await supabase
          .from('stream_gifts')
          .select('coins_amount')
          .eq('stream_id', stream.id);

        if (giftsError) {
          const { error: legacyError } = await supabase
            .from('gifts')
            .select('coins_spent')
            .eq('stream_id', stream.id);

          if (!legacyError) {
            giftsTable = 'gifts';
          }
        }

        setEngagementTables((prev) => {
          if (prev.gifts === giftsTable && prev.likes === likesTable) return prev;
          return { ...prev, gifts: giftsTable, likes: likesTable };
        });

      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };

    // Load messages
    const loadMessages = async () => {
      try {
        let table: 'stream_messages' | 'messages' = 'stream_messages';

        const { data: messagesData, error: messagesError } = await supabase
          .from('stream_messages')
          .select(
            `
            id,
            user_id,
            content,
            message_type,
            created_at,
            user_profiles!stream_messages_user_id_fkey (
              username,
              role,
              level
            )
          `
          )
          .eq('stream_id', stream.id)
          .order('created_at', { ascending: false })
          .limit(50);

        let rows: any[] = messagesData || [];
        if (messagesError) {
          const { data: legacyMessages, error: legacyError } = await supabase
            .from('messages')
            .select(
              `
              id,
              user_id,
              content,
              message_type,
              created_at,
              user_profiles!messages_user_id_fkey (
                username,
                role,
                level
              )
            `
            )
            .eq('stream_id', stream.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!legacyError) {
            table = 'messages';
            rows = legacyMessages || [];
          }
        }

        setEngagementTables((prev) => {
          if (prev.messages === table) return prev;
          return { ...prev, messages: table };
        });

        const formattedMessages = (rows || []).map((msg: any) => ({
          id: msg.id,
          user_id: msg.user_id,
          username: msg.user_profiles?.username || 'Unknown',
          message: msg.content ?? msg.message ?? '',
          created_at: msg.created_at,
          role: msg.user_profiles?.role,
          level: msg.user_profiles?.level
        })).reverse();

        setMessages(formattedMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadStats();
    loadMessages();

    // Subscribe to real-time updates with improved error handling
    const likesChannel = engagementTables.likes
      ? supabase
          .channel(`stream_likes_${stream.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: engagementTables.likes,
              filter: `stream_id=eq.${stream.id}`,
            },
            (payload) => {
              console.log('🎆 Like received:', payload.new);
              if (engagementTables.likes === 'stream_reactions') {
                if ((payload as any).new?.reaction_type !== 'like') return;
              }
              // Trigger like animation or effect here
              showGiftAnimation('👍');
            }
          )
          .subscribe((status) => {
            console.log('📡 Likes subscription status:', status);
          })
      : null;

    const giftsChannel = supabase
      .channel(`stream_gifts_${stream.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: engagementTables.gifts,
            filter: `stream_id=eq.${stream.id}`,
          },
          async (payload) => {
            console.log('🎁 Gift received:', payload.new);
            const isStreamGifts = engagementTables.gifts === 'stream_gifts';
            const giftId = isStreamGifts ? String((payload as any).new?.gift_id || '') : '';
            const delta = isStreamGifts
              ? Number((payload as any).new?.coins_amount || 0)
              : Number((payload as any).new?.coins_spent || 0);

            const receiverId = isStreamGifts
              ? (payload as any).new?.to_user_id
              : (payload as any).new?.receiver_id;

            // Get sender info for gift display
            let senderName = 'Someone';
            try {
              const { data: senderProfile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('id', (payload as any).new?.from_user_id || (payload as any).new?.sender_id)
                .single();
              senderName = senderProfile?.username || senderName;
            } catch (e) {
              console.warn('Failed to get sender name:', e);
            }

            // Update profile balance if receiver is current user
            if (receiverId && receiverId === profile?.id) {
              const currentProfile = useAuthStore.getState().profile;
              if (currentProfile) {
                const isTrollmond = giftId.startsWith('trollmond:');
                const balanceKey = isTrollmond ? 'troll_coins' : 'troll_coins';
                const newBalance = (currentProfile[balanceKey] || 0) + delta;
                useAuthStore.getState().setProfile({
                  ...currentProfile,
                  [balanceKey]: newBalance,
                });
              }
            }

            // Show gift animation with sender info
            const giftName = (payload as any).new?.message || giftId || 'Gift';
            showGiftAnimation(giftName, senderName);
            
            // Add to messages for chat display
            setMessages((prev) => [
              ...prev.slice(-49),
              {
                id: `gift-${Date.now()}`,
                user_id: (payload as any).new?.from_user_id || (payload as any).new?.sender_id || 'system',
                username: senderName,
                message: `sent ${giftName}`,
                created_at: new Date().toISOString(),
                role: 'system',
                level: 1
              }
            ]);
          }
        )
        .subscribe((status) => {
          console.log('📡 Gifts subscription status:', status);
        });

    const messagesChannel = supabase
      .channel(`stream_messages_${stream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: engagementTables.messages,
          filter: `stream_id=eq.${stream.id}`,
        },
        async (payload) => {
          console.log('💬 New message received:', payload.new);
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('username, role, level')
            .eq('id', payload.new.user_id)
            .single();

          const incomingText = payload.new.content ?? payload.new.message ?? '';
          const newMessage: StreamMessage = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            username: userData?.username || 'Unknown',
            message: incomingText,
            created_at: payload.new.created_at,
            role: userData?.role,
            level: userData?.level
          };

          setMessages((prev) => {
            // De-dupe optimistic echoes (same sender + same message within ~2s).
            const incomingTs = new Date(newMessage.created_at).getTime();
            const hasRecentLocalEcho = prev.some((m) => {
              if (!m.id.startsWith('local-')) return false;
              if (m.user_id !== newMessage.user_id) return false;
              if ((m.message || '').trim() !== (newMessage.message || '').trim()) return false;
              const mTs = new Date(m.created_at).getTime();
              return Math.abs(mTs - incomingTs) < 2000;
            });

            const filtered = hasRecentLocalEcho ? prev.filter((m) => !m.id.startsWith('local-')) : prev;
            const finalMessages = [...filtered.slice(-49), newMessage];
            
            console.log('💬 Messages updated:', finalMessages.length);
            return finalMessages;
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Messages subscription status:', status);
      });

    // Join requests subscription (for hosts)
    let joinRequestsChannel: any = null;
    if (isHost) {
      joinRequestsChannel = supabase
        .channel('stream_join_requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_join_requests',
          filter: `stream_id=eq.${stream.id}`
        }, async (payload) => {
          if (payload.new.status === 'pending') {
            const { data: userData } = await supabase
              .from('user_profiles')
              .select('username')
              .eq('id', payload.new.user_id)
              .single();

            const newRequest = {
              id: payload.new.id,
              user_id: payload.new.user_id,
              username: userData?.username || 'Unknown',
              created_at: payload.new.created_at
            };

            setJoinRequests(prev => [...prev, newRequest]);
          }
        })
        .subscribe();
    }

    return () => {
      if (likesChannel) supabase.removeChannel(likesChannel);
      supabase.removeChannel(giftsChannel);
      supabase.removeChannel(messagesChannel);
      if (joinRequestsChannel) {
        supabase.removeChannel(joinRequestsChannel);
      }
    };
  }, [stream?.id, engagementTables.gifts, engagementTables.likes, engagementTables.messages, isHost]);

  // Monitor stream status for when it ends
  useEffect(() => {
    if (!stream?.id) return;

    const streamStatusChannel = supabase
      .channel('stream_status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${stream.id}`
        }, (payload) => {
          const updatedStream = payload.new;
          if (updatedStream?.max_guest_slots !== undefined) {
            setGuestSlots(Math.min(5, Math.max(0, updatedStream.max_guest_slots ?? 0)));
          }
          if (!updatedStream.is_live && stream.is_live) {
            // Stream has ended
            setStream(updatedStream);
            setStreamEnded(true);
            setError('Stream ended by host');
            setRetryAction(() => () => {
              clearError();
              navigate('/live');
            });

            // Disconnect from LiveKit
            if (room) {
              disconnect();
            }
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamStatusChannel);
    };
  }, [stream?.id, stream?.is_live]);

  // Join/leave viewer count (server authoritative).
  useEffect(() => {
    if (!stream?.id || !user || isHost) return;
    if (viewerCountedRef.current) return;
    viewerCountedRef.current = true;
    supabase.rpc('update_viewer_count', { p_stream_id: stream.id, p_delta: 1 });
    return () => {
      if (!viewerCountedRef.current) return;
      viewerCountedRef.current = false;
      supabase.rpc('update_viewer_count', { p_stream_id: stream.id, p_delta: -1 });
    };
  }, [stream?.id, user?.id, isHost]);

  // Handle LiveKit connection - publish broadcaster's tracks
  useEffect(() => {
    if (!room || !isHost || !stream) return;
    if (publishedTracksRef.current) return;

    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const publishTracks = async () => {
      try {
        // Wait for room to be connected with better state checking
        if (room.state !== 'connected') {
          console.log('⏳ Room not connected yet, state:', room.state);
          
          // Set up persistent listener for connection
          const handleConnected = async () => {
            if (!mounted) return;
            console.log('🎯 Room connected, starting track publishing...');
            await publishLocalTracks();
          };
          
          room.on(RoomEvent.Connected, handleConnected);
          
          return;
        }

        await publishLocalTracks();
      } catch (err) {
        console.error('❌ Error in publishTracks:', err);
        if (mounted && retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Retrying track publishing (${retryCount}/${maxRetries})...`);
          setTimeout(publishTracks, 2000 * retryCount); // Exponential backoff
        } else if (mounted) {
          publishedTracksRef.current = false;
          toast.error('Failed to publish camera/microphone after multiple attempts');
        }
      }
    };

    const publishLocalTracks = async () => {
      if (!mounted || !room?.localParticipant) return;

      try {
        // Check if tracks are already published
        const videoPubs = room.localParticipant.videoTrackPublications;
        const audioPubs = room.localParticipant.audioTrackPublications;
        const hasVideo = videoPubs && videoPubs.size > 0;
        const hasAudio = audioPubs && audioPubs.size > 0;
        
        console.log('📊 Track status:', { 
          hasVideo, 
          hasAudio, 
          videoPubs: videoPubs?.size || 0, 
          audioPubs: audioPubs?.size || 0,
          roomState: room.state 
        });
        
        if (hasVideo && hasAudio) {
          console.log('✅ Tracks already published');
          publishedTracksRef.current = true;
          return;
        }

        // Publish video track with enhanced error handling
        if (!hasVideo) {
          try {
            console.log('📹 Creating video track...');
            
            // Get user media permissions first
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              } 
            });
            
            const videoTrack = await createLocalVideoTrack({
              facingMode: 'user',
              resolution: { width: 1280, height: 720 }
            });
            
            await room.localParticipant.publishTrack(videoTrack, {
              simulcast: false,
              name: 'camera'
            });
            
            console.log('✅ Video track published successfully');
            toast.success('Camera connected');
          } catch (videoErr) {
            console.error('❌ Video track error:', videoErr);
            let errorMsg = 'Failed to access camera';
            if ((videoErr as any).name === 'NotAllowedError') {
              errorMsg = 'Camera permission denied. Please allow camera access.';
            } else if ((videoErr as any).name === 'NotFoundError') {
              errorMsg = 'No camera found. Please connect a camera.';
            } else if ((videoErr as any).name === 'NotReadableError') {
              errorMsg = 'Camera is being used by another application.';
            }
            toast.error(errorMsg);
          }
        }

        // Publish audio track with enhanced error handling
        if (!hasAudio) {
          try {
            console.log('🎤 Creating audio track...');
            
            // Get user media permissions first
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            
            const audioTrack = await createLocalAudioTrack({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            });
            
            await room.localParticipant.publishTrack(audioTrack, {
              name: 'microphone'
            });
            
            console.log('✅ Audio track published successfully');
            toast.success('Microphone connected');
          } catch (audioErr) {
            console.error('❌ Audio track error:', audioErr);
            let errorMsg = 'Failed to access microphone';
            if ((audioErr as any).name === 'NotAllowedError') {
              errorMsg = 'Microphone permission denied. Please allow microphone access.';
            } else if ((audioErr as any).name === 'NotFoundError') {
              errorMsg = 'No microphone found. Please connect a microphone.';
            } else if ((audioErr as any).name === 'NotReadableError') {
              errorMsg = 'Microphone is being used by another application.';
            }
            toast.error(errorMsg);
          }
        }

        // Verify tracks were published
        setTimeout(() => {
          if (mounted) {
            const finalVideoPubs = room.localParticipant.videoTrackPublications;
            const finalAudioPubs = room.localParticipant.audioTrackPublications;
            const finalHasVideo = finalVideoPubs && finalVideoPubs.size > 0;
            const finalHasAudio = finalAudioPubs && finalAudioPubs.size > 0;
            
            console.log('🔍 Final track verification:', { 
              finalHasVideo, 
              finalHasAudio, 
              finalVideoPubs: finalVideoPubs?.size || 0, 
              finalAudioPubs: finalAudioPubs?.size || 0 
            });
            
            if (finalHasVideo && finalHasAudio) {
              publishedTracksRef.current = true;
              console.log('✅ All tracks successfully published and verified');
            } else {
              console.warn('⚠️ Some tracks failed to publish:', { finalHasVideo, finalHasAudio });
            }
          }
        }, 1000);
        
      } catch (err) {
        console.error('❌ Error in publishLocalTracks:', err);
        publishedTracksRef.current = false;
      }
    };

    // Start publishing
    publishTracks();

    return () => {
      mounted = false;
    };
  }, [room, isHost, stream]);

  // Reset tracks when room changes
  useEffect(() => {
    publishedTracksRef.current = false;
  }, [room?.name]);


  // End stream functionality
  const handleEndStream = async () => {
    if (!stream?.id || !room) return;
    
    try {
      const { endStream } = await import('../lib/endStream');
      const success = await endStream(stream.id, room);
      
      if (success) {
        // Navigate all users to the stream summary page
        navigate(`/stream/${stream.id}/summary`);
      } else {
        toast.error('Failed to end stream properly');
      }
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream. Please try again.');
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !stream?.id) return;

    try {
      const trimmed = newMessage.trim();
      const primary = engagementTables.messages;

      // Optimistic UI so chat feels instant even if realtime is delayed.
      const optimistic: StreamMessage = {
        id: `local-${Date.now()}`,
        user_id: user.id,
        username: (profile as any)?.username || 'You',
        message: trimmed,
        created_at: new Date().toISOString(),
        role: (profile as any)?.role,
        level: (profile as any)?.level,
      };
      setMessages((prev) => [...prev.slice(-49), optimistic]);

      const { error } = await supabase.from(primary).insert({
        stream_id: stream.id,
        user_id: user.id,
        content: trimmed,
        message_type: 'chat',
      });

      if (error) {
        // Fall back to legacy messages table if stream_messages isn't deployed yet.
        if (primary === 'stream_messages') {
          const { error: legacyError } = await supabase.from('messages').insert({
            stream_id: stream.id,
            user_id: user.id,
            content: trimmed,
            message_type: 'chat',
          });
          if (legacyError) throw legacyError;
          setEngagementTables((prev) => ({ ...prev, messages: 'messages' }));
        } else {
          throw error;
        }
      }

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const resolveGiftTargetId = (explicitViewerTargetId?: string) => {
    if (!stream?.broadcaster_id) return null;
    if (giftTarget === 'guest' && selectedGuest) return selectedGuest;
    if (giftTarget === 'viewer' && explicitViewerTargetId) return explicitViewerTargetId;
    return stream.broadcaster_id;
  };

  const loadTrollbagInventory = async () => {
    if (!user) return;
    setIsLoadingTrollbag(true);
    try {
      const { data, error } = await supabase
        .from('user_inventory')
        .select(
          `
          item_id,
          quantity,
          inventory_items!inner (
            id,
            name,
            icon,
            trollmond_value,
            category
          )
        `
        )
        .eq('user_id', user.id)
        .gt('quantity', 0);

      if (error) throw error;

      const normalized = (data || []).map((d: any) => ({
        item_id: d.item_id,
        quantity: d.quantity,
        inventory_items: Array.isArray(d.inventory_items) ? d.inventory_items[0] : d.inventory_items,
      })) as TrollbagItem[];

      setTrollbagInventory(normalized);
    } catch (err) {
      console.error('Error loading Trollbag inventory:', err);
      setTrollbagInventory([]);
    } finally {
      setIsLoadingTrollbag(false);
    }
  };

  useEffect(() => {
    if (!showGiftBox) return;
    if (!user) return;
    loadTrollbagInventory();
  }, [showGiftBox, user?.id, stream?.id]);

  // Send gift
  const sendGift = async (gift: GiftItem, targetUserId?: string) => {
    if (!user || !profile || !stream?.id) return;

    const useTrollmonds = giftCurrency === 'trollmonds';
    const availableBalance = useTrollmonds ? profile.troll_coins : profile.troll_coins;

    if ((availableBalance || 0) < gift.cost) {
      toast.error(useTrollmonds ? 'Not enough Trollmonds!' : 'Not enough Troll Coins!');
      return;
    }

    try {
      const targetId = resolveGiftTargetId(targetUserId);
      if (!targetId) throw new Error('Gift target not available');

      // Server-authoritative transfer (troll coins or trollmonds)
      const spendRpc = useTrollmonds ? 'spend_trollmonds' : 'spend_troll_coins';
      const { data: spendResult, error: spendError } = await supabase.rpc(spendRpc, {
        p_receiver_id: targetId,
        p_amount: gift.cost,
        p_source: useTrollmonds ? 'premium_gift' : 'gift',
        p_item: gift.name,
      });

      if (spendError) throw spendError;
      if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !spendResult.success) {
        throw new Error(spendResult.error || 'Failed to send gift');
      }

      // Record gift
      const primaryGifts = engagementTables.gifts;
      const giftId = useTrollmonds ? `trollmond:${gift.id}` : gift.id;
      const { error } = await supabase.from(primaryGifts).insert(
        primaryGifts === 'stream_gifts'
          ? {
              stream_id: stream.id,
              from_user_id: user.id,
              to_user_id: targetId,
              gift_id: giftId,
              coins_amount: gift.cost,
            }
          : {
              stream_id: stream.id,
              sender_id: user.id,
              receiver_id: targetId,
              coins_spent: gift.cost,
              gift_type: 'paid',
              message: gift.name,
            }
      );

      if (error) {
        // Fall back to legacy gifts table if stream_gifts isn't deployed yet.
        if (primaryGifts === 'stream_gifts') {
          const { error: legacyError } = await supabase.from('gifts').insert({
            stream_id: stream.id,
            sender_id: user.id,
            receiver_id: targetId,
            coins_spent: gift.cost,
            gift_type: 'paid',
            message: gift.name,
          });
          if (legacyError) throw legacyError;
          setEngagementTables((prev) => ({ ...prev, gifts: 'gifts' }));
        } else {
          throw error;
        }
      }

      // Refresh sender profile for accurate balances
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any);
      }

      // Show gift animation
      showGiftAnimation(gift.icon);
      setMessages((prev) => [
        ...prev.slice(-49),
        {
          id: `local-gift-${Date.now()}`,
          user_id: user.id,
          username: (profile as any)?.username || 'You',
          message: `sent ${gift.name}`,
          created_at: new Date().toISOString(),
          role: (profile as any)?.role,
          level: (profile as any)?.level,
        },
      ]);

      toast.success(`Sent ${gift.name}!`);
      setShowGiftBox(false);
    } catch (err) {
      console.error('Error sending gift:', err);
      toast.error('Failed to send gift');
    }
  };

  const sendTrollmondGift = async (item: TrollbagItem) => {
    if (!user || !stream?.id) return;

    const targetId = resolveGiftTargetId();
    if (!targetId) return;

    try {
      const { data, error } = await supabase.rpc('send_inventory_gift', {
        p_sender_id: user.id,
        p_item_id: item.item_id,
        p_target_id: targetId,
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && !(data as any).success) {
        throw new Error((data as any).error || 'Failed to send Trollmond gift');
      }

      const trollmondValue = Number(item.inventory_items.trollmond_value) || 0;
      const primaryGifts = engagementTables.gifts;
      const { error: giftError } = await supabase.from(primaryGifts).insert(
        primaryGifts === 'stream_gifts'
          ? {
              stream_id: stream.id,
              from_user_id: user.id,
              to_user_id: targetId,
              gift_id: `trollmond:${item.item_id}`,
              coins_amount: trollmondValue,
            }
          : {
              stream_id: stream.id,
              sender_id: user.id,
              receiver_id: targetId,
              coins_spent: trollmondValue,
              gift_type: 'trollmond',
              message: item.inventory_items.name,
            }
      );

      if (giftError) {
        if (primaryGifts === 'stream_gifts') {
          const { error: legacyError } = await supabase.from('gifts').insert({
            stream_id: stream.id,
            sender_id: user.id,
            receiver_id: targetId,
            coins_spent: trollmondValue,
            gift_type: 'trollmond',
            message: item.inventory_items.name,
          });
          if (legacyError) throw legacyError;
          setEngagementTables((prev) => ({ ...prev, gifts: 'gifts' }));
        } else {
          throw giftError;
        }
      }

      showGiftAnimation(item.inventory_items.icon || '🧌');
      setMessages((prev) => [
        ...prev.slice(-49),
        {
          id: `local-trollmond-${Date.now()}`,
          user_id: user.id,
          username: (profile as any)?.username || 'You',
          message: `sent ${item.inventory_items.name}`,
          created_at: new Date().toISOString(),
          role: (profile as any)?.role,
          level: (profile as any)?.level,
        },
      ]);
      toast.success(`Sent ${item.inventory_items.name}!`);

      await loadTrollbagInventory();
    } catch (err) {
      console.error('Error sending Trollmond gift:', err);
      toast.error('Failed to send Trollmond gift');
    }
  };

  const showGiftAnimation = (icon: string, senderName?: string) => {
    // Enhanced gift animation with sender info
    const message = senderName ? `${senderName} sent ${icon}!` : `${icon} Gift sent!`;
    toast.success(message, {
      duration: 3000,
      style: {
        background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
        color: 'white',
        border: 'none',
      },
    });
    
    // Trigger entrance effect for gift (placeholder for now)
    console.log(`🎆 Gift animation: ${message}`);
  };

  const handleCoinPurchaseSuccess = async () => {
    await refreshProfile();
    setShowQuickStore(false);
  };


  // Multi-box controls
  const updateGuestSlots = async (newSlots: number) => {
    if (!isHost || !stream?.id) return;

    try {
      const { error } = await supabase
        .from('streams')
        .update({ max_guest_slots: Math.max(0, Math.min(5, newSlots)) })
        .eq('id', stream.id);

      if (error) throw error;

      setGuestSlots(Math.max(0, Math.min(5, newSlots)));
      toast.success(`Guest slots updated to ${Math.max(0, Math.min(5, newSlots))}`);
    } catch (err) {
      console.error('Error updating guest slots:', err);
      toast.error('Failed to update guest slots');
    }
  };

  const approveJoinRequest = async (requestId: string) => {
    if (!isHost || !stream?.id) return;

    try {
      // Update request status to approved
      const { error } = await supabase
        .from('stream_join_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)
        .eq('stream_id', stream.id);

      if (error) throw error;

      // Remove from pending requests
      setJoinRequests(prev => prev.filter(req => req.id !== requestId));

      // Notify the user (could send a notification or message)
      toast.success('Join request approved');

      // Here you would typically grant the user access to join the LiveKit room
      // This would require additional backend logic to handle the approval flow
    } catch (err) {
      console.error('Error approving join request:', err);
      toast.error('Failed to approve join request');
    }
  };

  const requestToJoin = async () => {
    if (!user || !profile || !stream?.id) return;

    try {
      // Send join request to host
      const { error } = await supabase
        .from('stream_join_requests')
        .insert({
          stream_id: stream.id,
          user_id: user.id,
          status: 'pending'
        });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        throw error;
      }

      toast.success('Join request sent to host!');
    } catch (err) {
      console.error('Error requesting to join:', err);
      toast.error('Failed to send join request');
    }
  };

  const handleJoinRequestApproved = async (approvedUserId: string) => {
    if (approvedUserId !== user?.id) return;

    setIsJoinApproved(true);
    setIsReconnecting(true);

    setTimeout(() => {
      disconnect();
      setTimeout(() => {
        setIsReconnecting(false);
      }, 500);
    }, 500);
  };

  // Moderation functions
  const kickUser = async (targetUserId: string) => {
    if (!isOfficer && !isHost) return;

    try {
      // Implement kick logic - disconnect from LiveKit room
      if (room) {
        const participant = participants.find(p => p.identity === targetUserId);
        if (participant) {
          // LiveKit kick implementation would go here
          toast.success('User kicked from stream');
        }
      }
    } catch {
      toast.error('Failed to kick user');
    }
  };

  const banUser = async () => {
    if (!isOfficer && !isHost) return;

    try {
      // Implement ban logic
      toast.success('User banned from stream');
    } catch {
      toast.error('Failed to ban user');
    }
  };

  const muteUser = async () => {
    if (!isOfficer && !isHost) return;

    try {
      // Implement mute logic - disable participant's audio
      toast.success('User muted');
    } catch {
      toast.error('Failed to mute user');
    }
  };

  // Loading and error states
  if (isLoadingStream || connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (localError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4 text-xl">⚠️ {localError}</div>
          <button
            onClick={() => navigate('/live')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Back to Live Streams
          </button>
        </div>
      </div>
    );
  }

  if (!stream || !room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Connecting...</p>
        </div>
      </div>
    );
  }

  // StreamPanels component to separate chat and gifts from video re-renders
  const StreamPanels = React.memo(function StreamPanels({
    showChat,
    setShowChat,
    showGiftBox,
    setShowGiftBox,
    isPanelOpen,
    setIsPanelOpen,
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    giftTarget,
    setGiftTarget,
    selectedGuest,
    setSelectedGuest,
    giftCurrency,
    setGiftCurrency,
    trollbagInventory,
    sendGift,
    sendTrollmondGift,
    participants,
    room,
    isLoadingTrollbag,
    requestToJoin,
    isJoinApproved,
  }: {
    showChat: boolean;
    setShowChat: (b: boolean) => void;
    showGiftBox: boolean;
    setShowGiftBox: (b: boolean) => void;
    isPanelOpen: boolean;
    setIsPanelOpen: (b: boolean) => void;
    messages: StreamMessage[];
    newMessage: string;
    setNewMessage: (s: string) => void;
    sendMessage: () => void;
    giftTarget: 'host' | 'guest' | 'viewer';
    setGiftTarget: (s: 'host' | 'guest' | 'viewer') => void;
    selectedGuest: string;
    setSelectedGuest: (s: string) => void;
    giftCurrency: 'troll_coins' | 'trollmonds';
    setGiftCurrency: (s: 'troll_coins' | 'trollmonds') => void;
    trollbagInventory: TrollbagItem[];
    sendGift: (gift: GiftItem, targetUserId?: string) => void;
    sendTrollmondGift: (item: TrollbagItem) => void;
    participants: any[];
    room: any;
    isLoadingTrollbag: boolean;
    requestToJoin: () => Promise<void>;
    isJoinApproved: boolean;
  }) {
    return isPanelOpen ? (
      <div className="absolute bottom-0 right-0 w-80 h-96 bg-zinc-900/95 border-l border-zinc-700 flex flex-col">
        {/* Panel Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setIsPanelOpen(false)}
            className="px-3 text-gray-400 hover:text-white"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowChat(true); setShowGiftBox(false); }}
            className={`flex-1 py-2 px-4 text-sm font-semibold ${showChat ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4 inline mr-1" />
            Chat
          </button>
          <button
            onClick={() => { setShowChat(false); setShowGiftBox(true); }}
            className={`flex-1 py-2 px-4 text-sm font-semibold ${showGiftBox ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Gift className="w-4 h-4 inline mr-1" />
            Gifts
          </button>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-purple-300 font-semibold">
                    {msg.username}
                    {msg.level && <span className="text-xs bg-purple-600 ml-1 px-1 rounded">Lv.{msg.level}</span>}
                  </span>
                  <span className="text-gray-300">: {msg.message}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-zinc-700">
              {!isHost && !isJoinApproved && (
                <div className="mb-3 p-3 bg-yellow-950/30 border border-yellow-500/30 rounded-lg">
                  <div className="text-sm text-yellow-300 mb-2">Request to Join Stream</div>
                  <button
                    onClick={requestToJoin}
                    className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-semibold transition-colors"
                  >
                    Request to Join
                  </button>
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDownCapture={(e) => e.stopPropagation()}
                  onKeyUpCapture={(e) => e.stopPropagation()}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Gift Panel */}
        {showGiftBox && (
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-zinc-700">
              <div className="text-sm font-semibold mb-2">Send Gift To:</div>
              <select
                value={giftTarget}
                onChange={(e) => setGiftTarget(e.target.value as any)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="host">Host</option>
                <option value="guest">Guest Broadcaster</option>
                <option value="viewer">Specific Viewer</option>
              </select>
              {giftTarget === 'guest' && (
                <select
                  value={selectedGuest}
                  onChange={(e) => setSelectedGuest(e.target.value)}
                  className="w-full mt-2 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select Guest</option>
                  {participants.filter(p => p.identity !== room?.localParticipant?.identity).map((p) => (
                    <option key={p.identity} value={p.identity}>{p.name || p.identity}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="px-3 pb-3">
              <div className="text-xs text-gray-400 mb-2">Spend with</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setGiftCurrency('troll_coins')}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                    giftCurrency === 'troll_coins'
                      ? 'bg-yellow-500 text-black'
                      : 'bg-zinc-800 text-gray-300 hover:text-white'
                  }`}
                >
                  Troll Coins
                </button>
                <button
                  onClick={() => setGiftCurrency('trollmonds')}
                  className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                    giftCurrency === 'trollmonds'
                      ? 'bg-green-500 text-black'
                      : 'bg-zinc-800 text-gray-300 hover:text-white'
                  }`}
                >
                  Trollmonds
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-3 rounded-lg border border-green-500/30 bg-green-950/20 p-3">
                <div className="text-sm font-semibold text-green-300 mb-2">Trollbag Gifts (Trollmonds)</div>
                {isLoadingTrollbag ? (
                  <div className="text-xs text-gray-400">Loading your Trollbag...</div>
                ) : trollbagInventory.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    No Trollbag gifts yet. Buy some in the Trollmonds Store.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trollbagInventory.map((item) => (
                      <div
                        key={item.item_id}
                        className="flex items-center justify-between bg-zinc-900/60 border border-green-500/20 rounded-lg p-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl">{item.inventory_items.icon || '🧌'}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{item.inventory_items.name}</div>
                            <div className="text-[11px] text-gray-400">
                              +{Number(item.inventory_items.trollmond_value) || 0} Trollmonds • x{item.quantity}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => sendTrollmondGift(item)}
                          className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-xs font-semibold transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAID_GIFT_ITEMS.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => sendGift(gift)}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-center transition-colors"
                  >
                    <div className="text-2xl mb-1">{gift.icon}</div>
                    <div className="text-sm font-semibold">{gift.name}</div>
                    <div className="text-xs text-yellow-400">{gift.cost} coins</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => { setShowChat(true); setShowGiftBox(false); setIsPanelOpen(true); }}
          className="bg-purple-600/90 hover:bg-purple-600 px-3 py-2 rounded-full text-sm font-semibold shadow-lg"
        >
          Chat
        </button>
        <button
          onClick={() => { setShowChat(false); setShowGiftBox(true); setIsPanelOpen(true); }}
          className="bg-green-600/90 hover:bg-green-600 px-3 py-2 rounded-full text-sm font-semibold shadow-lg"
        >
          Gifts
        </button>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Main Video Area */}
      <div className="w-full h-screen bg-black">
        <LiveVideoRoom
          room={room}
          participants={participants}
          isHost={isHost}
          guestSlots={guestSlots}
          hostIdentity={stream?.broadcaster_id}
        />
        
        {activeTrollDrop && (
          <TrollDrop
            drop={activeTrollDrop}
            onExpire={(_dropId) => {
              setActiveTrollDrop(null);
            }}
            onClaimSuccess={(_dropId, _amount) => {
              setActiveTrollDrop(null);
            }}
          />
        )}
      </div>

      <StreamPanels
        showChat={showChat}
        setShowChat={setShowChat}
        showGiftBox={showGiftBox}
        setShowGiftBox={setShowGiftBox}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        messages={messages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        sendMessage={sendMessage}
        giftTarget={giftTarget}
        setGiftTarget={setGiftTarget}
        selectedGuest={selectedGuest}
        setSelectedGuest={setSelectedGuest}
        giftCurrency={giftCurrency}
        setGiftCurrency={setGiftCurrency}
        trollbagInventory={trollbagInventory}
        sendGift={sendGift}
        sendTrollmondGift={sendTrollmondGift}
        participants={participants}
        room={room}
        isLoadingTrollbag={isLoadingTrollbag}
        requestToJoin={requestToJoin}
        isJoinApproved={isJoinApproved}
      />

      <button
        onClick={handleOpenGiftTray}
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-3xl shadow-[0_0_25px_rgba(255,201,60,0.7)] transition hover:scale-105"
        title="Open Gift Tray"
      >
        🎁
      </button>

      {/* End Stream Button - Visible to admins, lead troll officers, troll officers, and broadcasters */}
      {isStreamAdmin && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
          <button
            onClick={handleEndStream}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-colors flex items-center gap-2"
            title="End Stream (Admin/Officer/Broadcaster only)"
          >
            <X className="w-5 h-5" />
            End Stream
          </button>
        </div>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="absolute top-20 left-4 z-30">
          <button
            onClick={() => setShowHostControls(!showHostControls)}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {showHostControls && (
            <div className="absolute top-14 left-0 bg-zinc-900/95 border border-zinc-700 rounded-lg p-4 min-w-64 shadow-xl">
              <div className="text-sm font-semibold mb-3 text-purple-400">Host Controls</div>

              {/* Guest Slots Control */}
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2">Guest Slots: {guestSlots}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateGuestSlots(guestSlots - 1)}
                    disabled={guestSlots <= 0}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm font-semibold transition-colors"
                  >
                    -
                  </button>
                  <span className="text-sm min-w-8 text-center">{guestSlots}</span>
                  <button
                    onClick={() => updateGuestSlots(guestSlots + 1)}
                    disabled={guestSlots >= 5}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-semibold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Admin/Officer Invite Button */}
              {isOfficer && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold transition-colors text-white"
                  >
                    Invite User to Box
                  </button>
                </div>
              )}

              {/* Join Requests */}
              {joinRequests.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">Join Requests</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {joinRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between bg-zinc-800 rounded p-2">
                        <span className="text-xs">{request.username}</span>
                        <button
                          onClick={() => approveJoinRequest(request.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participant Management */}
              {participants.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">Participants</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {participants.map((participant) => (
                      <div key={participant.identity} className="flex items-center justify-between bg-zinc-800 rounded p-2">
                        <span className="text-xs truncate">{participant.name || participant.identity}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => muteUser()}
                            className="p-1 hover:bg-red-900/50 rounded"
                            title="Mute"
                          >
                            <VolumeX className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => kickUser(participant.identity)}
                            className="p-1 hover:bg-red-900/50 rounded"
                            title="Kick"
                          >
                            <Ban className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Moderation Controls (Officers Only) */}
      {isOfficer && !isHost && (
        <div className="absolute top-20 right-4 z-30">
          <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg p-3">
            <div className="text-sm font-semibold mb-2 text-red-400">Moderation</div>
            <div className="space-y-1">
              <button
                onClick={() => kickUser('target')}
                className="w-full text-left text-sm py-1 px-2 hover:bg-red-900/50 rounded flex items-center gap-2"
              >
                <Ban className="w-3 h-3" />
                Kick User
              </button>
              <button
                onClick={() => banUser()}
                className="w-full text-left text-sm py-1 px-2 hover:bg-red-900/50 rounded flex items-center gap-2"
              >
                <Shield className="w-3 h-3" />
                Ban User
              </button>
              <button
                onClick={() => muteUser()}
                className="w-full text-left text-sm py-1 px-2 hover:bg-red-900/50 rounded flex items-center gap-2"
              >
                <VolumeX className="w-3 h-3" />
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickStore && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-yellow-500/30 bg-zinc-950 overflow-hidden">
            <div className="p-4 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="text-white font-semibold">Quick Coin Store</div>
              <button
                type="button"
                onClick={() => setShowQuickStore(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {paypalConfig ? (
              <PayPalScriptProvider
                options={{
                  clientId: paypalConfig.clientId,
                  currency: 'USD',
                  intent: 'capture',
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coinPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="bg-black/60 border border-yellow-600/30 rounded-xl p-4 flex flex-col gap-3"
                    >
                      <div>
                        <div className="text-lg font-bold text-white">{pkg.name}</div>
                        <div className="text-sm text-gray-400">{pkg.coins.toLocaleString()} coins</div>
                        <div className="text-xl font-semibold text-yellow-400">{formatUSD(pkg.price)}</div>
                      </div>
                      <div className="mt-auto">
                        <PayPalButtons
                          key={`quick-paypal-${pkg.id}`}
                          style={{ layout: 'vertical', color: 'gold', shape: 'rect' }}
                          disabled={processingPackage !== null}
                          createOrder={async () => {
                            if (!user?.id) {
                              toast.error('Please log in to purchase coins.');
                              return '';
                            }
                            setProcessingPackage(pkg.id);
                            const result = await createPayPalOrder(user.id, pkg.price, pkg.coins, {
                              source: 'stream_quick_store',
                              stream_id: stream?.id || null,
                              package_id: pkg.id,
                            });
                            if (!result.success || !result.order?.id) {
                              setProcessingPackage(null);
                              toast.error(result.error || 'Unable to create PayPal order.');
                              return '';
                            }
                            return result.order.id;
                          }}
                          onApprove={async (data) => {
                            if (!user?.id || !data?.orderID) return;
                            const result = await capturePayPalOrder(user.id, data.orderID);
                            setProcessingPackage(null);
                            if (!result.success) {
                              toast.error(result.error || 'PayPal capture failed.');
                              return;
                            }
                            toast.success(`Added ${result.coinsAdded || pkg.coins} coins!`);
                            await handleCoinPurchaseSuccess();
                          }}
                          onCancel={() => setProcessingPackage(null)}
                          onError={() => {
                            setProcessingPackage(null);
                            toast.error('PayPal checkout error');
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </PayPalScriptProvider>
              ) : (
                <div className="p-6 text-center text-red-400">
                  PayPal is not configured. Please contact support.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {giftFlash && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center px-4 py-12">
          <div className="w-full max-w-3xl rounded-3xl border border-yellow-500/30 bg-black/60 p-5 text-center shadow-[0_0_50px_rgba(255,201,60,0.6)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.4em] text-yellow-200 mb-2">{giftFlash.senderName} just lit the court</p>
            <p className="text-3xl font-semibold">{giftFlash.gift.name} ×{giftFlash.quantity}</p>
            <p className="mt-1 text-sm text-gray-200">Sent via Gift Tray</p>
            <span
              className={`mt-4 inline-flex items-center justify-center text-6xl ${giftFlash.gift.animationType ? `gift-animation-${giftFlash.gift.animationType}` : 'animate-pulse'}`}
            >
              {giftFlash.gift.icon || '🎁'}
            </span>
          </div>
        </div>
      )}


      <GiftTray
        isOpen={isGiftTrayOpen}
        onClose={() => setIsGiftTrayOpen(false)}
        inventory={giftInventory}
        onSendGift={handleTraySendGift}
        isLoading={isLoadingGiftInventory}
      />

      <JoinRequestsPanel
        streamId={stream?.id || streamIdValue || ''}
        isHost={isHost}
        onRequestApproved={handleJoinRequestApproved}
      />

      <OfficerInviteModal
        streamId={stream?.id || streamIdValue || ''}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onUserInvited={handleJoinRequestApproved}
      />

      {/* Stream Diagnostics Component */}
      <StreamDiagnostics 
        streamId={stream?.id || streamIdValue || ''} 
        isHost={isHost} 
      />
    </div>
  );
}

// Live Video Room Component (Memoized)
const LiveVideoRoom = React.memo(function LiveVideoRoom({
  room,
  participants,
  isHost,
  guestSlots,
  hostIdentity,
}: {
  room: Room;
  participants: any[];
  isHost: boolean;
  guestSlots: number;
  hostIdentity?: string;
}) {
  return (
    <VideoGrid
      room={room}
      participants={participants}
      isHost={isHost}
      maxGuests={guestSlots}
      hostIdentity={hostIdentity}
    />
  );
});

// Video Grid Component
const VideoGrid = React.memo<{
  room: Room;
  participants: any[];
  isHost: boolean;
  maxGuests: number;
  hostIdentity?: string;
}>(({ room, participants, isHost, maxGuests, hostIdentity }) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const stageRef = useRef<HTMLDivElement>(null);

  const guestParticipants = useMemo(() => {
    if (!hostIdentity) return participants.filter((p) => participantHasVideo(p));
    return participants.filter((p) => p?.identity !== hostIdentity && participantHasVideo(p));
  }, [participants, hostIdentity]);

  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (track: any, _publication: any, participant: any) => {
      if (track?.kind !== 'video') return;
      const identity = participant?.identity;
      if (!identity) return;
      const el = videoRefs.current[identity];
      if (!el) return;
      try {
        track.attach(el);
      } catch {
        // ignore
      }
    };

    const handleTrackUnsubscribed = (track: any) => {
      if (track?.kind !== 'video') return;
      try {
        track.detach();
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed as any);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed as any);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed as any);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed as any);
    };
  }, [room]);

  // Attach already-subscribed tracks (covers cases where refs are set after subscription).
  useEffect(() => {
    participants.forEach((participant) => {
      const identity = participant?.identity;
      const el = identity ? videoRefs.current[identity] : null;
      if (!identity || !el) return;

      try {
        participant.videoTrackPublications?.forEach((pub: any) => {
          if (pub?.track?.kind === 'video') {
            try {
              pub.track.attach(el);
            } catch {
              // ignore
            }
          }
        });
      } catch {
        // ignore
      }
    });
  }, [participants]);

  // Host local preview: attach local participant video using actual identity
  useEffect(() => {
    if (!room?.localParticipant) return;

    // Use the actual local participant identity instead of hardcoded 'host'
    const localIdentity = room.localParticipant.identity;
    if (!localIdentity) return;

    const el = videoRefs.current[localIdentity];
    if (!el) return;

    try {
      room.localParticipant.videoTrackPublications?.forEach((pub: any) => {
        if (pub?.track?.kind === 'video') {
          try {
            pub.track.attach(el);
          } catch {
            // ignore
          }
        }
      });
    } catch {
      // ignore
    }
  }, [room?.localParticipant, room?.localParticipant?.identity, participants.length]);

  const visibleGuests = guestParticipants.slice(0, Math.max(0, maxGuests));

  useEffect(() => {
    if (stageRef.current) {
      console.log("stage size", stageRef.current.getBoundingClientRect());
    }
  }, []);

  return (
    <div ref={stageRef} className="relative w-full h-full overflow-hidden">
      {/* Main Video - Host's video, local for host, remote for viewers */}
      <div className="absolute inset-0">
        {isHost ? (
          <video
            ref={(el) => {
              if (el && room?.localParticipant?.identity) {
                videoRefs.current[room.localParticipant.identity] = el;
              }
            }}
            autoPlay
            playsInline
            muted
            // Mirror local preview (viewers still see un-mirrored).
            style={{ transform: 'scaleX(-1)' }}
            className="w-full h-full object-cover"
          />
        ) : (
          // For viewers, find the host participant
          (() => {
            const hostParticipant = participants.find(p => p.identity === hostIdentity);
            return hostParticipant ? (
              <video
                ref={(el) => {
                  if (el) videoRefs.current[hostParticipant.identity] = el;
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black text-white">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm">Waiting for broadcaster...</div>
                  <div className="text-xs mt-1">Broadcaster is connecting to LiveKit</div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Guest Videos as overlays */}
      {visibleGuests.map((participant, index) => (
        <div
          key={participant.identity}
          className="absolute bottom-4 w-32 h-24 bg-black border border-white/20 rounded overflow-hidden"
          style={{ zIndex: 10, right: `${4 + index * 40}px` }}
        >
          <video
            ref={(el) => {
              if (el) videoRefs.current[participant.identity] = el;
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
});
