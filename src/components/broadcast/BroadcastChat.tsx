import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Shield, Crown, Sparkles, Gift, Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { generateUUID } from '../../lib/uuid';
import { toast } from 'sonner';
import GiftBoxModal from './GiftBoxModal';

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
  isChatOpen = true
}: BroadcastChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMods, setStreamMods] = useState<string[]>([]);
  const { user, profile } = useAuthStore();

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
  
  // Track recent presence events to prevent join/leave flickering
  const recentPresenceRef = useRef<Map<string, number>>(new Map());
  const PRESENCE_DEBOUNCE_MS = 5000; // 5 seconds between showing same user's join/leave
  
  // Unread message tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatFocused, setIsChatFocused] = useState(true);
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [hostChatDisabledByOfficer, setHostChatDisabledByOfficer] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  // Rate limiting - 5 messages every 10 seconds per user
  const messageTimestampsRef = useRef<number[]>([]);
  const MAX_MESSAGES_PER_WINDOW = 5;
  const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds

  // Realtime broadcast channel ref
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
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

  // Auto-delete messages after 30 seconds (faster removal for better UX)
  useEffect(() => {
    const MESSAGE_LIFETIME_MS = 30000; // 30 seconds
    const autoDeleteInterval = setInterval(() => {
        const now = Date.now();
        setMessages(prev => {
            const filtered = prev.filter(msg => {
                const msgTime = new Date(msg.created_at).getTime();
                const age = now - msgTime;
                // Keep messages younger than 30 seconds
                return age < MESSAGE_LIFETIME_MS;
            });
            // Only update state if messages were actually removed
            if (filtered.length !== prev.length) {
                return filtered;
            }
            return prev;
        });
    }, 3000); // Check every 3 seconds for faster removal

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
                const msg = payload.payload as Message;
                
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
        // Also listen for gift_sent events to show in chat
        .on(
          'broadcast',
          { event: 'gift_sent' },
          (payload: any) => {
            const giftData = payload.payload;
            console.log('[BroadcastChat] 🎁🎁🎁 Gift received for chat (gift_sent listener):', giftData);
            
            const giftMessage: Message = {
              id: giftData.id || `gift-${Date.now()}`,
              user_id: giftData.sender_id || 'system',
              content: `GIFT_EVENT:${giftData.gift_slug || giftData.gift_name}:${giftData.quantity || 1}`,
              created_at: giftData.timestamp || new Date().toISOString(),
              type: 'gift',
              gift_type: giftData.gift_slug || giftData.gift_name?.toLowerCase().replace(/\s+/g, '-'),
              gift_amount: giftData.quantity || 1,
              sender_name: giftData.sender_name || 'Someone',
              receiver_id: giftData.receiver_id,
              receiver_name: giftData.receiver_name || 'user',
              user_profiles: {
                username: giftData.sender_name || 'Someone',
                avatar_url: null
              }
            };
            
            setMessages(prev => [...prev, giftMessage]);
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

          // Fetch user profile for the message
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color')
            .eq('id', newMessage.user_id)
            .single();

          const msg: Message = {
            ...newMessage,
            type: 'chat',
            user_profiles: profile,
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

    // Subscribe to room presence to show join/leave messages in chat
    // Use the same channel name as BroadcastPage for shared presence
    const presenceChannel = supabase
        .channel(`stream:${streamId}`)
        .on('presence', { event: 'join' }, ({ newPresences }) => {
            const now = Date.now();
            newPresences.forEach((p: any) => {
                // Skip showing join message for ourselves (we track our own presence)
                // But still show it for testing/verification
                if (p.user_id === user?.id) {
                    console.log('[BroadcastChat] Our own join detected, user_id:', p.user_id?.substring(0, 8));
                    return;
                }
                
                // Debounce: Don't show join if we recently showed leave for same user
                const lastEvent = recentPresenceRef.current.get(p.user_id);
                if (lastEvent && (now - lastEvent) < PRESENCE_DEBOUNCE_MS) {
                    return; // Skip this join - too soon after previous event
                }
                recentPresenceRef.current.set(p.user_id, now);
                
                console.log('[BroadcastChat] User joined, showing message:', p.username || p.user_id);
                const systemMsg: Message = {
                    id: `sys-join-${p.user_id}-${now}`,
                    user_id: p.user_id,
                    content: 'joined the broadcast',
                    created_at: new Date().toISOString(),
                    type: 'system',
                    user_profiles: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || '',
                        created_at: p.joined_at,
                        role: p.role,
                        troll_role: p.troll_role
                    }
                };
                setMessages(prev => {
                    const updated = [...prev, systemMsg];
                    if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                    return updated;
                });
            });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            const now = Date.now();
            leftPresences.forEach((p: any) => {
                // Track when we get a leave event - debounce future joins
                recentPresenceRef.current.set(p.user_id, now);
                
                // Skip showing leave for our own user (handled by parent)
                if (p.user_id === user?.id) {
                    console.log('[BroadcastChat] Ignoring own leave event (user is still active)');
                    return;
                }
                
                console.log('[BroadcastChat] User left, showing message:', p.username || p.user_id);
                const systemMsg: Message = {
                    id: `sys-leave-${p.user_id}-${now}`,
                    user_id: p.user_id,
                    content: 'left the broadcast',
                    created_at: new Date().toISOString(),
                    type: 'system',
                    user_profiles: {
                        username: p.username || 'Guest',
                        avatar_url: p.avatar_url || ''
                    }
                };
                setMessages(prev => {
                    const updated = [...prev, systemMsg];
                    if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
                    return updated;
                });
            });
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

    // Need to store dbChannel for cleanup - create a ref for it
    const dbChannelRef = supabase
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

          // Fetch user profile for the message
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color')
            .eq('id', newMessage.user_id)
            .single();

          const msg: Message = {
            ...newMessage,
            type: 'chat',
            user_profiles: profile,
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

    // Rate Limit Check - 5 messages per 10 seconds
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    
    // Filter to keep only timestamps within the window
    messageTimestampsRef.current = messageTimestampsRef.current.filter(ts => ts > windowStart);
    
    if (messageTimestampsRef.current.length >= MAX_MESSAGES_PER_WINDOW) {
        console.log('💬 [BroadcastChat] Rate limited - too many messages');
        toast.error('Slow down! You can only send 5 messages every 10 seconds.');
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

    // 5. Add timestamp for rate limiting (after optimistic UI update)
    // This ensures we only count successfully displayed messages
    messageTimestampsRef.current.push(Date.now());

    // 5. Broadcast over realtime channel for instant delivery to all viewers
    if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'chat-message',
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
    <div ref={chatContainerRef} className="flex flex-col h-[94%] text-white relative">
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
        
        <div className="p-4 border-b border-white/10 font-bold bg-zinc-900/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
                Live Chat
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse font-normal">
                    +{unreadCount}
                  </span>
                )}
            </div>
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
        
        <div className="flex-1 min-h-0 relative overflow-hidden">
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
            
            {/* Floating Messages - Show last 10 messages as floating bubbles */}
            <div className={`absolute left-0 right-0 flex flex-col gap-1 p-2 overflow-hidden ${challengeNotifications.length > 0 ? 'bottom-0 max-h-[120px]' : 'bottom-0 max-h-[200px]'}`}>
                {messages.slice(-10).map((msg, index) => {
                    // Calculate animation delay based on index (newer messages appear on top)
                    const isSystem = msg.type === 'system';
                    
                    // Check if this is a gift message
                    const isGift = msg.type === 'gift' || msg.content?.startsWith('GIFT_EVENT:');
                    
                    if (isSystem) {
                        return (
                            <div 
                                key={msg.id}
                                className="flex items-center gap-2 text-zinc-400 text-xs italic bg-zinc-800/60 p-1.5 rounded-lg border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-300"
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
                            className="flex items-center gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-300"
                        >
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
                                    className="font-bold text-yellow-400 text-xs truncate hover:text-yellow-300 transition-colors"
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

        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-zinc-900/80 relative">
            <div className="relative w-full">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onFocus={() => {
                        // Don't navigate away - just show signup prompt in input placeholder
                        // The input is already disabled for guests, so this is just for UX
                    }}
                    placeholder={
                      streamEnded
                        ? "Stream ended"
                        : hostChatDisabledByOfficer
                          ? "Chat disabled by officer control"
                          : isGuest
                            ? "Sign up to chat..."
                            : "Type a message..."
                    }
                    disabled={hostChatDisabledByOfficer || isGuest || streamEnded}
                    className="w-full bg-zinc-800 border-none rounded-full px-4 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-500 text-sm"
                />

                <button
                    type="submit"
                    disabled={hostChatDisabledByOfficer || isGuest || streamEnded || !input.trim()}
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
