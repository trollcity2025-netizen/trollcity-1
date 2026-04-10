import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Shield, Crown, Sparkles, Gift, Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { generateUUID } from '../../lib/uuid';
import { toast } from 'sonner';
import { useMissionProgress } from '../../hooks/useMissionProgress';
import GiftBoxModal from './GiftBoxModal';
import { shouldAutoHideMessage, canControlSlowMode, shouldShowGoldenBanner } from '../../lib/perkEffects';

interface Message {
  id: string;
  txn_id?: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system' | 'gift' | 'challenge';
  // Gift-specific fields
  gift_type?: string;
  gift_amount?: number;
  sender_name?: string;
  receiver_id?: string;
  receiver_name?: string;
  // Challenge-specific fields
  challenge_id?: string;
  challenger_id?: string;
  challenger_username?: string;
  challenger_avatar?: string;
  challenger_crowns?: number;
  challenge_status?: 'pending' | 'accepted' | 'denied' | 'on_hold' | 'expired';
  // Denormalized fields
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
  user_created_at?: string;
  user_rgb_expires_at?: string;
  user_glowing_username_color?: string;

  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  } | null;
}

// Challenge notification interface
interface ChallengeNotification {
  id: string;
  challenge_id: string;
  challenger_id: string;
  challenger_username: string;
  challenger_avatar?: string;
  challenger_crowns?: number;
  expires_at: string;
  status: 'pending' | 'accepted' | 'denied' | 'on_hold' | 'expired';
}

interface BroadcastChatProps {
    streamId: string;
    hostId: string;
    isModerator?: boolean;
    isHost?: boolean;
    isViewer?: boolean;
    isGuest?: boolean;
    onStreamEnd?: () => void;
    onChallengeBroadcaster?: () => void;
    hasPendingChallenge?: boolean;
    // Challenge management props
    pendingChallenges?: ChallengeNotification[];
    onAcceptChallenge?: (challengeId: string, challengerId: string) => void;
    onDenyChallenge?: (challengeId: string) => void;
    isBattleActive?: boolean;
    // Chat visibility - only load/render messages when chat is open
    isChatOpen?: boolean;
    // Seat users for the users-in-seats strip
    seats?: Record<number, { user_id?: string | null; guest_id?: string | null; user_profile?: { username?: string; avatar_url?: string | null } | null }>;
    broadcasterProfile?: { username?: string; avatar_url?: string | null } | null;
}

export default function BroadcastChat({ 
  streamId, 
  hostId, 
  isModerator, 
  isHost, 
  isViewer = false, 
  isGuest = false, 
  onStreamEnd, 
  onChallengeBroadcaster, 
  hasPendingChallenge = false,
  pendingChallenges = [],
  onAcceptChallenge,
  onDenyChallenge,
  isBattleActive = false,
  isChatOpen = true,
  seats = {},
  broadcasterProfile
}: BroadcastChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [disappearingMessages, setDisappearingMessages] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [streamMods, setStreamMods] = useState<string[]>([]);
  const { user, profile } = useAuthStore();
  const { trackChatMessage } = useMissionProgress(streamId);

  const buildUserProfile = (source: any) => ({
    username:
      source?.user_name ||
      source?.username ||
      source?.user_profiles?.username ||
      'Unknown',
    avatar_url:
      source?.user_avatar ||
      source?.avatar_url ||
      source?.user_profiles?.avatar_url ||
      '',
    role:
      source?.user_role ||
      source?.role ||
      source?.user_profiles?.role,
    troll_role:
      source?.user_troll_role ||
      source?.troll_role ||
      source?.user_profiles?.troll_role,
    created_at:
      source?.user_created_at ||
      source?.created_at ||
      source?.user_profiles?.created_at,
    rgb_username_expires_at:
      source?.user_rgb_expires_at ||
      source?.rgb_username_expires_at ||
      source?.user_profiles?.rgb_username_expires_at,
    glowing_username_color:
      source?.user_glowing_username_color ||
      source?.glowing_username_color ||
      source?.user_profiles?.glowing_username_color
  });

  const normalizeIncomingMessage = (incoming: any): Message | null => {
    if (!incoming) return null;

    if (incoming.v === 1 && incoming.t && incoming.d) {
      const payload = incoming.d;
      const normalizedType: Message['type'] =
        incoming.t === 'gift'
          ? 'gift'
          : incoming.t === 'sys'
            ? 'system'
            : incoming.t === 'battle'
              ? 'challenge'
              : 'chat';

      return {
        id: incoming.txn_id || `${incoming.s}-${incoming.ts}`,
        txn_id: incoming.txn_id,
        user_id: incoming.s || payload.user_id || 'system',
        content:
          payload.content ||
          payload.message ||
          (incoming.t === 'gift'
            ? `GIFT_EVENT:${payload.gift_slug || payload.gift_name || 'gift'}:${payload.quantity || 1}`
            : ''),
        created_at: incoming.ts
          ? new Date(incoming.ts).toISOString()
          : new Date().toISOString(),
        type: normalizedType,
        gift_type: payload.gift_slug || payload.gift_name?.toLowerCase().replace(/\s+/g, '-'),
        gift_amount: payload.quantity || payload.amount || 1,
        sender_name: payload.sender_name || payload.user_name,
        receiver_id: payload.receiver_id,
        receiver_name: payload.receiver_name,
        challenge_id: payload.challenge_id,
        challenger_id: payload.challenger_id,
        challenger_username: payload.challenger_username,
        challenger_avatar: payload.challenger_avatar,
        challenger_crowns: payload.challenger_crowns,
        challenge_status: payload.challenge_status,
        user_name: payload.user_name,
        user_avatar: payload.user_avatar,
        user_role: payload.user_role,
        user_troll_role: payload.user_troll_role,
        user_created_at: payload.user_created_at,
        user_rgb_expires_at: payload.user_rgb_expires_at,
        user_glowing_username_color: payload.user_glowing_username_color,
        user_profiles: buildUserProfile(payload),
      };
    }

    if (!incoming.user_id && !incoming.content && !incoming.type) {
      return null;
    }

    return {
      ...incoming,
      type: incoming.type || 'chat',
      user_profiles: buildUserProfile(incoming),
    } as Message;
  };

  const parseGiftMessage = (content: string) => {
    if (!content.startsWith('GIFT_EVENT:')) return null;
    const parts = content.split(':');
    if (parts.length < 3) return null;
    return {
      giftName: parts[1],
      quantity: parseInt(parts[2], 10) || 1,
    };
  };
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const MAX_MESSAGES = 200;
  
  // Track sent message txn_ids to prevent duplicates
  const receivedTxnIdsRef = useRef<Set<string>>(new Set());
  
  // Track processed message IDs to prevent duplicates from broadcast
  const processedMessageIds = useRef<Set<string>>(new Set());
  
  // Unread message tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatFocused, setIsChatFocused] = useState(true);
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [hostChatDisabledByOfficer, setHostChatDisabledByOfficer] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  const redirectGuestToAuth = () => {
    if (!isGuest) return;
    navigate('/auth?mode=signup');
  };

  // Realtime broadcast channel ref
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Check for disappearing chat perk on mount and periodically
  const [hasDisappearingChat, setHasDisappearingChat] = useState(false);
  
  useEffect(() => {
    const checkDisappearingChat = async () => {
      if (!user?.id) {
        setHasDisappearingChat(false);
        return;
      }
      const shouldHide = await shouldAutoHideMessage(user.id);
      setHasDisappearingChat(shouldHide);
    };
    
    checkDisappearingChat();
    // Check every 30 seconds in case perk is activated/deactivated
    const interval = setInterval(checkDisappearingChat, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
  
  // Handle message disappearing
  useEffect(() => {
    if (!hasDisappearingChat || messages.length === 0) return;
    
    const latestMsg = messages[messages.length - 1];
    if (!latestMsg || disappearingMessages.has(latestMsg.id)) return;
    
    // Mark message as disappearing
    setDisappearingMessages(prev => new Set(prev).add(latestMsg.id));
    
    // Hide after 10 seconds
    const hideTimer = setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== latestMsg.id));
      setDisappearingMessages(prev => {
        const next = new Set(prev);
        next.delete(latestMsg.id);
        return next;
      });
    }, 10000);
    
    return () => clearTimeout(hideTimer);
  }, [messages.length, hasDisappearingChat]);
  
  // Slow mode state and perk check
  const [isSlowModeEnabled, setIsSlowModeEnabled] = useState(false);
  const [canControlSlowModeLocal, setCanControlSlowModeLocal] = useState(false);
  
  useEffect(() => {
    const checkSlowModePerk = async () => {
      if (!user?.id) {
        setCanControlSlowModeLocal(false);
        return;
      }
      const canControl = await canControlSlowMode(user.id);
      setCanControlSlowModeLocal(canControl);
    };
    
    checkSlowModePerk();
    const interval = setInterval(checkSlowModePerk, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
  
  // Golden Flex Banner state
  const [showGoldenBanner, setShowGoldenBanner] = useState(false);
  
  useEffect(() => {
    const checkGoldenBanner = async () => {
      if (!user?.id) {
        setShowGoldenBanner(false);
        return;
      }
      const shouldShow = await shouldShowGoldenBanner(user.id);
      setShowGoldenBanner(shouldShow);
    };
    
    checkGoldenBanner();
    const interval = setInterval(checkGoldenBanner, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
  
  // Toggle slow mode
  const handleToggleSlowMode = async () => {
    if (!canControlSlowModeLocal) return;
    const newState = !isSlowModeEnabled;
    setIsSlowModeEnabled(newState);
    
    // Update stream settings in database
    const { error } = await supabase
      .from('stream_settings')
      .upsert({
        stream_id: streamId,
        slow_mode_enabled: newState,
        slow_mode_seconds: newState ? 10 : 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'stream_id' });
    
    if (error) {
      console.error('Failed to toggle slow mode:', error);
      toast.error('Failed to toggle slow mode');
      setIsSlowModeEnabled(!newState);
    } else {
      toast.success(newState ? 'Slow mode enabled (10s between messages)' : 'Slow mode disabled');
    }
  };
  
  // Check slow mode on send message
  
  // Challenge notifications in chat
  const [challengeNotifications, setChallengeNotifications] = useState<ChallengeNotification[]>([]);
  
  // Process pending challenges from props
  useEffect(() => {
    if (isHost && pendingChallenges.length > 0) {
      // Convert pending challenges to notifications
      const notifications: ChallengeNotification[] = pendingChallenges.map(c => ({
        id: c.challenge_id || c.id,
        challenge_id: c.challenge_id || c.id,
        challenger_id: c.challenger_id,
        challenger_username: c.challenger_username,
        challenger_avatar: c.challenger_avatar,
        challenger_crowns: c.challenger_crowns,
        expires_at: c.expires_at,
        status: isBattleActive ? 'on_hold' : 'pending'
      }));
      setChallengeNotifications(notifications);
    }
  }, [pendingChallenges, isHost, isBattleActive]);
  
  // Listen for challenge broadcasts
  useEffect(() => {
    if (!streamId) return;
    
    const challengeChannel = supabase
      .channel(`chat-challenges-${streamId}`)
      .on(
        'broadcast',
        { event: 'new_challenge' },
        (payload: any) => {
          const challengeData = payload.payload;
          console.log('[BroadcastChat] New challenge received:', challengeData);
          
          const notification: ChallengeNotification = {
            id: challengeData.challenge_id,
            challenge_id: challengeData.challenge_id,
            challenger_id: challengeData.challenger_id,
            challenger_username: challengeData.challenger_username,
            challenger_avatar: challengeData.challenger_avatar,
            challenger_crowns: challengeData.challenger_crowns,
            expires_at: challengeData.expires_at,
            status: isBattleActive ? 'on_hold' : 'pending'
          };
          
          setChallengeNotifications(prev => {
            // Don't add duplicate
            if (prev.some(c => c.challenge_id === notification.challenge_id)) {
              return prev;
            }
            return [...prev, notification];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'challenge_accepted' },
        (payload: any) => {
          const challengeData = payload.payload;
          setChallengeNotifications(prev => 
            prev.filter(c => c.challenge_id !== challengeData.challenge_id)
          );
        }
      )
      .on(
        'broadcast',
        { event: 'challenge_denied' },
        (payload: any) => {
          const challengeData = payload.payload;
          setChallengeNotifications(prev => 
            prev.filter(c => c.challenge_id !== challengeData.challenge_id)
          );
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(challengeChannel);
    };
  }, [streamId, isBattleActive]);
  
  // Handle accept challenge from chat
  const handleAcceptChallengeFromChat = async (notification: ChallengeNotification) => {
    if (!onAcceptChallenge) return;
    
    try {
      await onAcceptChallenge(notification.challenge_id, notification.challenger_id);
      // Remove from notifications
      setChallengeNotifications(prev => 
        prev.filter(c => c.challenge_id !== notification.challenge_id)
      );
    } catch (err) {
      console.error('Error accepting challenge from chat:', err);
    }
  };
  
  // Handle deny challenge from chat
  const handleDenyChallengeFromChat = async (notification: ChallengeNotification) => {
    if (!onDenyChallenge) return;
    
    try {
      await onDenyChallenge(notification.challenge_id);
      // Remove from notifications
      setChallengeNotifications(prev => 
        prev.filter(c => c.challenge_id !== notification.challenge_id)
      );
    } catch (err) {
      console.error('Error denying challenge from chat:', err);
    }
  };

  // Fetch Stream Mods
  useEffect(() => {
      const fetchMods = async () => {
          const { data } = await supabase
            .from('stream_moderators')
            .select('user_id')
            .eq('broadcaster_id', hostId);
          if (data) setStreamMods(data.map(d => d.user_id));
      };
      if (hostId) fetchMods();
  }, [hostId]);

  useEffect(() => {
    if (!hostId) return;

    let mounted = true;
    const fetchHostModerationState = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('broadcast_chat_disabled')
        .eq('id', hostId)
        .maybeSingle();

      if (mounted) {
        setHostChatDisabledByOfficer(!!data?.broadcast_chat_disabled);
      }
    };

    fetchHostModerationState();

    const moderationChannel = supabase
      .channel(`host-chat-lock:${hostId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${hostId}`
        },
        (payload: any) => {
          setHostChatDisabledByOfficer(!!payload?.new?.broadcast_chat_disabled);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(moderationChannel);
    };
  }, [hostId]);

  // Stream end listener
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream-status-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`
        },
        (payload: any) => {
          const newStatus = payload.new?.status;

          if (newStatus === 'ended') {
            console.log('📴 Stream ended — disabling chat');

            // Disable input
            setInput('');
            setStreamEnded(true);

            // Push system message
            const systemMsg: Message = {
              id: `sys-end-${Date.now()}`,
              user_id: 'system',
              content: 'Stream has ended',
              created_at: new Date().toISOString(),
              type: 'system',
              user_profiles: {
                username: 'System',
                avatar_url: ''
              }
            };

            setMessages(prev => {
              const updated = [...prev, systemMsg];
              if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
              return updated;
            });

            // Notify parent to show summary
            onStreamEnd?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, onStreamEnd]);

  // Track if messages have been fetched
  const messagesFetchedRef = useRef(false);
  
  // Fetch initial messages (last 50) only when chat is opened
  // Fetch initial messages (last 50) only when chat is opened
  useEffect(() => {
      console.log('[BroadcastChat] 🔄 Message fetch useEffect triggered, streamId:', streamId, 'isChatOpen:', isChatOpen);
      if (!streamId) return;

      // Only fetch messages when chat is OPEN
      if (!isChatOpen) {
          console.log('[BroadcastChat] Chat is closed, skipping message fetch');
          return;
      }
      
      // Skip if already fetched
      if (messagesFetchedRef.current) {
          console.log('[BroadcastChat] Messages already fetched, skipping fetch');
          return;
      }

      // Fetch historical messages - only get messages from last 2 minutes to prevent old messages from reappearing
      const fetchMessages = async () => {
          messagesFetchedRef.current = true;
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        // Thundering Herd Prevention: Jitter on initial chat load (0-400ms when lazy loading)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 400));

        const { data } = await supabase
            .from('stream_messages')
            .select('*, user_profiles(username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color)')
            .eq('stream_id', streamId)
            .gte('created_at', twoMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (data) {
            // Process messages: Use denormalized data if available, else fallback
            const processedMessages = data.reverse().map((m: any) => {
                // Construct profile from denormalized data OR fallback to joined data
                const uProfile = {
                    username: m.user_name || m.user_profiles?.username || 'Unknown',
                    avatar_url: m.user_avatar || m.user_profiles?.avatar_url || '',
                    role: m.user_role || m.user_profiles?.role,
                    troll_role: m.user_troll_role || m.user_profiles?.troll_role,
                    created_at: m.user_created_at || m.user_profiles?.created_at,
                    rgb_username_expires_at: m.user_rgb_expires_at || m.user_profiles?.rgb_username_expires_at,
                    glowing_username_color: m.user_glowing_username_color || m.user_profiles?.glowing_username_color
                };

                // Track txn_ids from historical messages
                if (m.txn_id) {
                    receivedTxnIdsRef.current.add(m.txn_id);
                }
                // Track message IDs
                if (m.id) {
                    processedMessageIds.current.add(m.id);
                }

                return {
                    ...m,
                    type: 'chat',
                    user_profiles: uProfile
                } as Message;
            });
            
            setMessages(prev => {
                // Merge with existing messages (which might be system messages or realtime messages received while fetching)
                // processedMessages are historical (older).
                // Filter out duplicates based on ID AND txn_id
                const existingIds = new Set(prev.map(p => p.id));
                const existingTxnIds = new Set(prev.map(p => p.txn_id).filter(Boolean));
                const newHistory = processedMessages.filter(m => {
                    // Skip if ID already exists
                    if (existingIds.has(m.id)) return false;
                    // Skip if txn_id already exists (for optimistically added messages)
                    if (m.txn_id && existingTxnIds.has(m.txn_id)) return false;
                    return true;
                });
                return [...newHistory, ...prev];
            });
        }
    };
    fetchMessages();
  }, [streamId, isViewer, user, profile, isChatFocused, isChatOpen]);

  // Auto-delete messages after 1 minute
  useEffect(() => {
    const MESSAGE_LIFETIME_MS = 60000; // 1 minute
    const autoDeleteInterval = setInterval(() => {
        const now = Date.now();
        setMessages(prev => {
            const filtered = prev.filter(msg => {
                const msgTime = new Date(msg.created_at).getTime();
                const age = now - msgTime;
                // Keep messages younger than 1 minute
                return age < MESSAGE_LIFETIME_MS;
            });
            // Only update state if messages were actually removed
            if (filtered.length !== prev.length) {
                return filtered;
            }
            return prev;
        });
    }, 3000); // Check every 3 seconds

    return () => {
        clearInterval(autoDeleteInterval);
    };
  }, []); // Empty deps - only run on mount/unmount for message cleanup

  // Setup Realtime Broadcast Channel - SEPARATE useEffect to ensure it always runs
  // This is critical for receiving gift messages in real-time
  useEffect(() => {
    if (!streamId) return;
    
    console.log('[BroadcastChat] 📡 Setting up realtime channel for stream:', streamId);

    // Setup Realtime Broadcast Channel for INSTANT message delivery
    // Listen on stream-chat:{streamId} for chat messages (matches send-message edge function)
    // Also listen on stream:{streamId} for backward compatibility
    console.log('[BroadcastChat] 🔌 Creating broadcast channel for stream:' + streamId);
    const broadcastChannel = supabase
        .channel(`stream-chat:${streamId}`)
        .on(
            'broadcast',
            { event: 'chat' },
            (payload: any) => {
                const msg = normalizeIncomingMessage(payload.payload);
                if (!msg) return;
                
                console.log('[BroadcastChat] 💬 Received chat-message:', msg.type, msg.content, 'from user:', msg.user_id);
                
                // Skip if this is our own chat message (already shown via optimistic update)
                // But allow gift messages through since they don't have optimistic UI
                const isGiftMessage = msg.type === 'gift' || msg.content?.startsWith('GIFT_EVENT:');
                console.log('[BroadcastChat] isGiftMessage:', isGiftMessage);
                
                if (msg.user_id === user?.id && !isGiftMessage) {
                    return;
                }

                // Deduplicate using txn_id
                if (msg.txn_id && receivedTxnIdsRef.current.has(msg.txn_id)) {
                    return;
                }
                
                // Also check by message ID
                if (msg.id && processedMessageIds.current.has(msg.id)) {
                    return;
                }

                // Track this txn_id and id
                if (msg.txn_id) {
                    receivedTxnIdsRef.current.add(msg.txn_id);
                }
                if (msg.id) {
                    processedMessageIds.current.add(msg.id);
                }

                // Only add to UI when chat is OPEN
                if (!isChatOpen) {
                    // When chat is closed, just increment unread count but don't render messages
                    console.log('[BroadcastChat] Message received while chat closed, incrementing unread');
                    setUnreadCount(prev => prev + 1);
                    return;
                }

                // Add message to UI when chat is open
                setMessages(prev => {
                    // Triple-check for duplicates by txn_id, id, and content+user+timestamp
                    if (msg.txn_id && prev.some(m => m.txn_id === msg.txn_id)) {
                        return prev;
                    }
                    if (msg.id && prev.some(m => m.id === msg.id)) {
                        return prev;
                    }
                    // Final check: same user, same content, within 5 seconds
                    const isDuplicate = prev.some(m =>
                        m.user_id === msg.user_id &&
                        m.content === msg.content &&
                        Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 5000
                    );
                    if (isDuplicate) {
                        return prev;
                    }
                    
                    const updated = [...prev, msg];
                    if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                    return updated;
                });

                // Increment unread count if chat not focused
                if (!isChatFocused) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        )
        .on(
            'broadcast',
            { event: 'message' },
            (payload: any) => {
                const msg = normalizeIncomingMessage(payload.payload);
                if (!msg) return;

                console.log('[BroadcastChat] Received message event:', msg.type, msg.content, 'from user:', msg.user_id);

                if (!isChatOpen) {
                    setUnreadCount(prev => prev + 1);
                    return;
                }

                setMessages(prev => {
                    if (msg.txn_id && prev.some(m => m.txn_id === msg.txn_id)) {
                        return prev;
                    }
                    if (msg.id && prev.some(m => m.id === msg.id)) {
                        return prev;
                    }
                    const updated = [...prev, msg];
                    if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                    return updated;
                });
            }
        )
        // Also listen for gift_sent events to show in chat
        .on(
          'broadcast',
          { event: 'gift_sent' },
          (payload: any) => {
            const giftEnvelope = payload.payload;
            const giftData = giftEnvelope?.d || giftEnvelope;
            console.log('[BroadcastChat] 🎁🎁🎁 Gift received for chat (gift_sent listener):', giftData);
            
            const giftMessage: Message = {
              id: giftEnvelope?.txn_id || giftData.id || `gift-${Date.now()}`,
              txn_id: giftEnvelope?.txn_id,
              user_id: giftEnvelope?.s || giftData.sender_id || 'system',
              content: `GIFT_EVENT:${giftData.gift_slug || giftData.gift_name}:${giftData.quantity || 1}`,
              created_at: giftEnvelope?.ts ? new Date(giftEnvelope.ts).toISOString() : (giftData.timestamp || new Date().toISOString()),
              type: 'gift',
              gift_type: giftData.gift_slug || giftData.gift_name?.toLowerCase().replace(/\s+/g, '-'),
              gift_amount: giftData.quantity || 1,
              sender_name: giftData.sender_name || giftData.user_name || 'Someone',
              receiver_id: giftData.receiver_id,
              receiver_name: giftData.receiver_name || 'user',
              user_profiles: {
                username: giftData.sender_name || giftData.user_name || 'Someone',
                avatar_url: null
              }
            };
            
            setMessages(prev => {
              if (giftMessage.txn_id && prev.some(m => m.txn_id === giftMessage.txn_id)) {
                return prev;
              }
              if (giftMessage.id && prev.some(m => m.id === giftMessage.id)) {
                return prev;
              }
              const updated = [...prev, giftMessage];
              if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
              return updated;
            });
          }
        )
        .subscribe((status) => {
          console.log('[BroadcastChat] 📡 Broadcast channel subscription status:', status);
        });

    broadcastChannelRef.current = broadcastChannel;

    // Also subscribe to postgres_changes for INSERT on stream_messages as backup
    // This ensures messages are received even if broadcast fails
    const dbChannel = supabase
      .channel(`stream-messages-db:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload: any) => {
          const newMessage = payload.new;
          
          // Skip our own messages (already shown via optimistic update)
          if (newMessage.user_id === user?.id) {
            return;
          }

          // Deduplicate using id
          if (newMessage.id && processedMessageIds.current.has(newMessage.id)) {
            return;
          }

          const isSystemMessage = newMessage.type === 'system';
          const { data: profile } = isSystemMessage
            ? { data: null }
            : await supabase
                .from('user_profiles')
                .select('username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color')
                .eq('id', newMessage.user_id)
                .single();

          const msg: Message = {
            ...newMessage,
            type: newMessage.type === 'gift'
              ? 'gift'
              : newMessage.type === 'system'
                ? 'system'
                : 'chat',
            user_profiles: profile ? buildUserProfile(profile) : buildUserProfile(newMessage),
          };

          if (newMessage.id) {
            processedMessageIds.current.add(newMessage.id);
          }

          // Only add to UI when chat is OPEN
          if (!isChatOpen) {
            setUnreadCount(prev => prev + 1);
            return;
          }

          setMessages(prev => {
            if (newMessage.id && prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            const updated = [...prev, msg];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
          });

          if (!isChatFocused) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    // Subscribe to room presence (join/leave messages are now handled by BroadcastTicker)
    // Use the same channel name as BroadcastPage for shared presence
    const presenceChannel = supabase
        .channel(`stream:${streamId}`)
        .on('presence', { event: 'join' }, ({ newPresences }) => {
            // Join messages now shown in BroadcastTicker instead of chat
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            // Leave messages now shown in BroadcastTicker instead of chat
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && user?.id && profile) {
                // Track our presence once subscribed
                await presenceChannel.track({
                    user_id: user.id,
                    username: profile.username,
                    avatar_url: profile.avatar_url,
                    role: profile.role,
                    troll_role: profile.troll_role,
                    online_at: new Date().toISOString()
                });
            }
            console.log('[BroadcastChat] Presence channel subscription status:', status);
        });

    // Cleanup: remove channels when component unmounts or streamId changes
    return () => {
        console.log('[BroadcastChat] 🧹 Cleaning up realtime channels');
        supabase.removeChannel(broadcastChannel);
        supabase.removeChannel(presenceChannel);
        supabase.removeChannel(dbChannel);
        broadcastChannelRef.current = null;
    };
  }, [streamId, isChatOpen, isChatFocused, user, profile]);

  // Track chat focus/visibility
  useEffect(() => {
    const handleFocus = () => {
      setIsChatFocused(true);
      setUnreadCount(0);
    };
    
    const handleBlur = () => {
      setIsChatFocused(false);
    };
    
    const chatElement = chatContainerRef.current;
    if (chatElement) {
      chatElement.addEventListener('mouseenter', handleFocus);
      chatElement.addEventListener('mouseleave', handleBlur);
      chatElement.addEventListener('focus', handleFocus);
      
      return () => {
        chatElement.removeEventListener('mouseenter', handleFocus);
        chatElement.removeEventListener('mouseleave', handleBlur);
        chatElement.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('💬 [BroadcastChat] sendMessage called', { 
      hasUser: !!user, 
      hasProfile: !!profile, 
      inputLength: input.length,
      streamId 
    });
    
    if (!user || !profile) {
        console.error('💬 [BroadcastChat] No user or profile');
        navigate('/auth?mode=signup');
        return;
    }
    if (!input.trim()) {
        console.log('💬 [BroadcastChat] Empty input, ignoring');
        return;
    }
    if (hostChatDisabledByOfficer) {
        toast.error('Chat is disabled for this broadcaster by officer control');
        return;
    }
    if (isSlowModeEnabled) {
        toast.error('Slow mode is active. Please wait before sending another message.');
        return;
    }

    const content = input.trim();
    console.log('💬 [BroadcastChat] Preparing to send:', { content, userId: user.id });
    setInput('');

    // INSTANT DELIVERY ARCHITECTURE
    // 1. Generate txnId for deduplication
    const txnId = generateUUID();
    
    // 2. Create message object with full profile data
    const msg: Message = {
        id: txnId,
        txn_id: txnId,
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        type: 'chat',
        user_profiles: {
            username: profile.username,
            avatar_url: profile.avatar_url,
            role: profile.role,
            troll_role: profile.troll_role,
            created_at: profile.created_at,
            rgb_username_expires_at: profile.rgb_username_expires_at,
            glowing_username_color: profile.glowing_username_color
        }
    };

    // 3. Add to UI immediately for instant display (0ms latency for sender)
    setMessages(prev => {
        const updated = [...prev, msg];
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
        return updated;
    });

    // 4. Track txn_id to prevent duplicates
    receivedTxnIdsRef.current.add(txnId);

    // 5. Broadcast over realtime channel for instant delivery to all viewers
    if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'chat',
            payload: msg
        });
    }

    // 6. Save to database asynchronously (fire and forget)
    // No UI wait - database is background only
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'chat',
                stream_id: streamId,
                txn_id: txnId,
                data: { content }
            })
        }).then(() => {
            // Track mission progress
            trackChatMessage();
        }).catch(err => {
            // Silently handle DB write failures - message already shown in UI
            console.warn('💬 [BroadcastChat] Background DB write failed:', err);
        });

    } catch (err: any) {
        console.error('💬 [BroadcastChat] Error initiating message send:', err);
        if (String(err.message || '').toLowerCase().includes('rate limit')) {
            toast.error('You are sending messages too fast. Please slow down.');
        } else {
            toast.error('Failed to send message: ' + err.message);
        }
        // Keep the optimistic message even on error - it provides better UX
        // The message will auto-delete after 30 seconds anyway
    }
  };

  const openGiftForUser = (targetUserId?: string | null) => {
    if (!targetUserId) return;
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    if (user.id === targetUserId) {
      toast.error('You cannot send gifts to yourself');
      return;
    }
    setGiftRecipientId(targetUserId);
    setIsGiftModalOpen(true);
  };

  const deleteMessage = async (msgId: string) => {
      await supabase.from('stream_messages').delete().eq('id', msgId);
  };

  const renderBadge = (userId: string, role?: string, troll_role?: string) => {
      // Host
      if (userId === hostId) {
          return <Crown size={12} className="text-yellow-500 inline mr-1" />;
      }
      
      // Stream Moderator (Broadofficer)
      if (streamMods.includes(userId)) {
           return <Shield size={12} className="text-green-500 inline mr-1" />;
      }

      const r = role || troll_role;
      if (!r) return null;
      
      if (r === 'admin' || r === 'staff') {
          return <Shield size={12} className="text-red-500 inline mr-1" />;
      }
      if (r === 'moderator' || r === 'troll_officer') {
          return <Shield size={12} className="text-blue-500 inline mr-1" />;
      }
      if (r === 'broadcaster') {
          return <Crown size={12} className="text-yellow-500/50 inline mr-1" />;
      }
      return null;
  };

   return (
     <div ref={chatContainerRef} className="flex flex-col h-full text-white relative bg-transparent">
        {/* Unread Message Notification Bubble */}
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 z-50">
            <div className="relative animate-bounce">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-70 animate-pulse"></div>
              {/* Badge */}
              <div className="relative bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white text-xs font-bold rounded-full min-w-[28px] h-7 flex items-center justify-center px-2.5 border-2 border-white shadow-2xl ring-2 ring-red-300/50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            </div>
          </div>
        )}
        
         <div className="p-4 border-b border-white/10 font-bold bg-transparent flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
                Live Chat
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse font-normal">
                    +{unreadCount}
                  </span>
                )}
            </div>
            {/* Slow Mode Toggle - Show for hosts/mods with perk */}
            {(isHost || isModerator) && canControlSlowModeLocal && (
                <button
                    type="button"
                    onClick={handleToggleSlowMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSlowModeEnabled
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                    <span className={`w-2 h-2 rounded-full ${isSlowModeEnabled ? 'bg-orange-500 animate-pulse' : 'bg-zinc-500'}`} />
                    Slow Mode
                </button>
            )}
            {/* Challenge Button - Only show for viewers, when category supports battles */}
            {onChallengeBroadcaster && !PreflightStore.getBattlesDisabled() && (
                <button
                    type="button"
                    onClick={onChallengeBroadcaster}
                    disabled={hasPendingChallenge}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        hasPendingChallenge
                            ? 'bg-yellow-500/20 text-yellow-400 cursor-wait'
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-lg hover:shadow-yellow-500/25'
                    }`}
                    title={hasPendingChallenge ? 'Challenge pending...' : 'Challenge broadcaster to a battle!'}
                >
                    <Swords size={14} className={hasPendingChallenge ? 'animate-pulse' : ''} />
                    {hasPendingChallenge ? 'Pending...' : 'Challenge'}
                </button>
            )}
        </div>
        
        {/* Users in Seats Strip */}
        {(() => {
          const seatUsers: { id: string; username: string; avatar_url: string | null; isBroadcaster: boolean }[] = [];
          
          // Add broadcaster first
          seatUsers.push({
            id: hostId,
            username: broadcasterProfile?.username || 'Host',
            avatar_url: broadcasterProfile?.avatar_url || null,
            isBroadcaster: true
          });
          
          // Add other seated users
          Object.values(seats).forEach((seat) => {
            const userId = seat?.user_id || seat?.guest_id;
            if (userId && userId !== hostId) {
              seatUsers.push({
                id: userId,
                username: seat?.user_profile?.username || 'User',
                avatar_url: seat?.user_profile?.avatar_url || null,
                isBroadcaster: false
              });
            }
          });
          
          if (seatUsers.length === 0) return null;
          
          return (
             <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-white/5 bg-transparent scrollbar-hide">
              {seatUsers.map((seatUser) => (
                <button
                  key={seatUser.id}
                  onClick={() => {
                    setGiftRecipientId(seatUser.id);
                    setIsGiftModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-0.5 min-w-[48px] group"
                  title={`Gift ${seatUser.username}`}
                >
                  <div className={`relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all group-hover:scale-110 group-hover:shadow-lg ${
                    seatUser.isBroadcaster 
                      ? 'border-yellow-500 group-hover:shadow-yellow-500/30' 
                      : 'border-white/20 group-hover:border-yellow-400/60 group-hover:shadow-yellow-400/20'
                  }`}>
                    {seatUser.avatar_url ? (
                      <img src={seatUser.avatar_url} alt={seatUser.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {seatUser.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {seatUser.isBroadcaster && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded-sm">
                        HOST
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate max-w-[48px] group-hover:text-yellow-400 transition-colors">
                    {seatUser.username}
                  </span>
                </button>
              ))}
            </div>
          );
        })()}
        
         <div className="flex-1 min-h-0 relative overflow-y-auto">
            {/* Challenge Notifications Section - Show active challenges */}
            {challengeNotifications.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-purple-900/80 to-transparent p-2 max-h-[180px] overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <Swords size={14} className="text-purple-400" />
                        <span className="text-xs font-bold text-purple-300">
                            {isBattleActive ? 'Challenges On Hold' : 'Incoming Challenges'}
                        </span>
                        <span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full">
                            {challengeNotifications.length}
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {challengeNotifications.map((notification) => (
                            <div 
                                key={notification.challenge_id}
                                className={`flex items-center gap-2 p-2 rounded-lg border animate-in slide-in-from-top-2 fade-in duration-300 ${
                                    notification.status === 'on_hold' 
                                        ? 'bg-yellow-900/30 border-yellow-500/30' 
                                        : 'bg-purple-900/40 border-purple-500/30'
                                }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-red-500 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                                    {notification.challenger_avatar ? (
                                        <img src={notification.challenger_avatar} alt={notification.challenger_username} className="w-full h-full object-cover" />
                                    ) : (
                                        notification.challenger_username?.charAt(0).toUpperCase() || '?'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-purple-300 text-xs truncate">
                                            {notification.challenger_username || 'Unknown'}
                                        </span>
                                        {notification.challenger_crowns !== undefined && (
                                            <span className="text-amber-400 text-[10px] flex items-center gap-0.5">
                                                <Crown size={10} />
                                                {notification.challenger_crowns}
                                            </span>
                                        )}
                                    </div>
                                    {notification.status === 'on_hold' && (
                                        <span className="text-[10px] text-yellow-400">On hold - battle in progress</span>
                                    )}
                                </div>
                                {isHost && notification.status !== 'on_hold' && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleAcceptChallengeFromChat(notification)}
                                            className="p-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg transition-colors"
                                            title="Accept"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDenyChallengeFromChat(notification)}
                                            className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors"
                                            title="Deny"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Floating Messages - Full scrollable chat history */}
            <div className={`absolute left-0 right-0 top-0 flex flex-col gap-1 p-2 overflow-y-auto`}>
                {messages.slice(-10).map((msg, index) => {
                    // Calculate animation delay based on index (newer messages appear on top)
                    const isSystem = msg.type === 'system';
                    
                    // Check if this is a gift message
                    const isGift = msg.type === 'gift' || msg.content?.startsWith('GIFT_EVENT:');
                    
                    if (isSystem) {
                        return (
                            <div 
                                key={msg.id}
                                className="flex items-center gap-2 text-zinc-400 text-xs italic bg-transparent p-1.5 rounded-lg border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-300"
                            >
                                <Sparkles size={12} className="text-yellow-500 flex-shrink-0" />
                                <button
                                    type="button"
                                    onClick={() => openGiftForUser(msg.user_id)}
                                    className="font-bold text-zinc-300 hover:text-yellow-300 transition-colors flex items-center gap-1 truncate"
                                    title="Send gift"
                                >
                                    {msg.user_profiles?.username || 'User'}
                                </button>
                                <span className="truncate">{msg.content}</span>
                            </div>
                        );
                    }
                    
                    // Check if this is a challenge message
                    if (msg.type === 'challenge') {
                        return (
                            <div 
                                key={msg.id}
                                className="flex items-center gap-2 bg-purple-900/40 border border-purple-500/30 p-2 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
                            >
                                <Swords size={14} className="text-purple-400 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-purple-400 text-xs">
                                            {msg.user_profiles?.username || msg.challenger_username || 'Someone'}
                                        </span>
                                        <span className="text-zinc-400 text-xs">sent a challenge!</span>
                                    </div>
                                    {isHost && msg.challenge_id && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onAcceptChallenge) {
                                                        onAcceptChallenge(msg.challenge_id!, msg.challenger_id!);
                                                    }
                                                }}
                                                className="px-2 py-0.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 text-xs rounded transition-colors"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onDenyChallenge) {
                                                        onDenyChallenge(msg.challenge_id!);
                                                    }
                                                }}
                                                className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs rounded transition-colors"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }
                    
                    if (isGift) {
                        // Parse gift info from message - check for GIFT_EVENT format or gift_type field
                        let giftType = msg.gift_type || 'gift';
                        let giftAmount = msg.gift_amount || 1;
                        // Use sender_name from message data, user_profiles, or enriched data
                        const senderName = msg.sender_name || msg.user_profiles?.username || 'Someone';
                        // Use receiver_name from message data
                        const receiverName = msg.receiver_name || 'user';
                        
                        // If not already parsed, try to parse from content
                        if (!msg.gift_type && msg.content) {
                            const parsed = parseGiftMessage(msg.content);
                            if (parsed) {
                                giftType = parsed.giftName;
                                giftAmount = parsed.quantity;
                            }
                        }
                        
                        // Format the gift name (capitalize first letter)
                        const formattedGiftName = giftType.charAt(0).toUpperCase() + giftType.slice(1).toLowerCase();
                        const giftText = giftAmount > 1 ? `sent ${formattedGiftName}s` : `sent a ${formattedGiftName}`;
                        
                        return (
                            <div 
                                key={msg.id}
                                className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 p-2 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
                            >
                                <Gift size={14} className="text-yellow-400 flex-shrink-0" />
                                <span className="text-xs">
                                    <button
                                        type="button"
                                        onClick={() => openGiftForUser(msg.user_id)}
                                        className="font-bold text-yellow-400 hover:text-yellow-300 transition-colors"
                                        title="Send gift"
                                    >
                                        {senderName}
                                    </button>
                                    <span className="text-zinc-400"> {giftText}</span>
                                    {giftAmount > 1 && (
                                        <span className="text-yellow-400 ml-1">x{giftAmount}</span>
                                    )}
                                    {msg.receiver_name && (
                                        <span className="text-blue-400">
                                            {' '}to <button
                                                type="button"
                                                onClick={() => openGiftForUser(msg.receiver_id)}
                                                className="font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                                title="Send gift"
                                            >
                                                {receiverName}
                                            </button>
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div 
                            key={msg.id}
                            className={`flex items-center gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-300 ${disappearingMessages.has(msg.id) ? 'opacity-50 transition-opacity' : ''}`}
                        >
                            {/* Golden Flex Banner indicator */}
                            {showGoldenBanner && msg.user_id === user?.id && (
                                <span className="text-yellow-400 text-xs">👑</span>
                            )}
                            <div className="w-5 h-5 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                                {msg.user_profiles?.avatar_url ? (
                                    <img src={msg.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={10} className="m-0.5 text-zinc-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => openGiftForUser(msg.user_id)}
                                    className={`font-bold text-xs truncate hover:text-yellow-300 transition-colors ${showGoldenBanner && msg.user_id === user?.id ? 'text-yellow-400' : 'text-yellow-400'}`}
                                    title="Send gift"
                                >
                                    {msg.user_profiles?.username || 'User'}:
                                </button>
                                <span className="text-white text-xs truncate">{msg.content}</span>
                            </div>
                        </div>
                    );
                })}
                {messages.length === 0 && (
                    <div className="text-center text-zinc-500 text-xs italic">
                        Send a message...
                    </div>
                )}
            </div>
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-transparent relative">
            <div className="relative w-full">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onFocus={redirectGuestToAuth}
                    onClick={redirectGuestToAuth}
                    placeholder={
                      streamEnded
                        ? "Stream ended"
                        : hostChatDisabledByOfficer
                          ? "Chat disabled by officer control"
                          : isGuest
                            ? "Sign up to chat..."
                            : "Type a message..."
                    }
                    readOnly={isGuest || streamEnded || hostChatDisabledByOfficer}
                    disabled={hostChatDisabledByOfficer || streamEnded}
                    className="w-full bg-white/10 border-none rounded-full px-4 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-400 text-sm"
                />

                <button
                    type="submit"
                    onClick={isGuest ? redirectGuestToAuth : undefined}
                    disabled={hostChatDisabledByOfficer || streamEnded || (!isGuest && !input.trim())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 transition"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>

        <GiftBoxModal
          isOpen={isGiftModalOpen}
          onClose={() => {
            setIsGiftModalOpen(false);
            setGiftRecipientId(null);
          }}
          recipientId={giftRecipientId || hostId}
          streamId={streamId}
          sharedChannel={broadcastChannelRef.current}
        />
    </div>
  );
}
