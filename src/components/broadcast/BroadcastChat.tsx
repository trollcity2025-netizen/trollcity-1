import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Shield, Crown, Sparkles, Gift } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import UserNameWithAge from '../UserNameWithAge';
import { toast } from 'sonner';
import GiftBoxModal from './GiftBoxModal';

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system' | 'gift';
  // Gift-specific fields
  gift_type?: string;
  gift_amount?: number;
  sender_name?: string;
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

interface BroadcastChatProps {
    streamId: string;
    hostId: string;
    isModerator?: boolean;
    isHost?: boolean;
    isViewer?: boolean;
    isGuest?: boolean;
}

export default function BroadcastChat({ streamId, hostId, isModerator, isHost, isViewer = false, isGuest = false }: BroadcastChatProps) {
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
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Buffering for high-frequency updates
  const messageBufferRef = useRef<Message[]>([]);
  const MAX_MESSAGES = 200;
  const FLUSH_INTERVAL = 50; // Faster flush interval for near-instant delivery (50ms)
  
  // Track sent message IDs to prevent duplicates
  const sentMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Unread message tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatFocused, setIsChatFocused] = useState(true);
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [hostChatDisabledByOfficer, setHostChatDisabledByOfficer] = useState(false);
  
  // Rate limiting
  const lastSentRef = useRef<number>(0);
  const RATE_LIMIT_MS = 1000; // 1 message per second

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

  // Fetch initial messages (last 50)
  useEffect(() => {
    const fetchMessages = async () => {
        // Thundering Herd Prevention: Jitter on initial chat load (0-800ms)
        // High-traffic broadcast entry points are the most likely to cause a DB spike
        await new Promise(resolve => setTimeout(resolve, Math.random() * 800));

        const { data } = await supabase
            .from('stream_messages')
            .select('*, user_profiles(username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color)')
            .eq('stream_id', streamId)
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

                return {
                    ...m,
                    type: 'chat',
                    user_profiles: uProfile
                } as Message;
            });
            
            setMessages(prev => {
                // Merge with existing messages (which might be system messages or realtime messages received while fetching)
                // processedMessages are historical (older).
                // Filter out duplicates based on ID
                const existingIds = new Set(prev.map(p => p.id));
                const newHistory = processedMessages.filter(m => !existingIds.has(m.id));
                return [...newHistory, ...prev];
            });
        }
    };
    fetchMessages();

    // Flush buffer interval - use faster interval for near-instant delivery
    const flushInterval = setInterval(() => {
        if (messageBufferRef.current.length === 0) return;

        const newMsgs = [...messageBufferRef.current];
        messageBufferRef.current = [];

        setMessages(prev => {
            // Filter out duplicates based on message ID or content+user combination
            const existingIds = new Set(prev.map(p => p.id));
            const incomingIds = new Set(newMsgs.map(m => m.id));
            
            // Remove optimistic messages that are now confirmed by real messages
            const filtered = prev.filter(m => {
                // Keep if not a temp message OR if there's a matching real message
                if (!m.id.startsWith('temp-')) return true;
                // For temp messages, check if we have a matching real message
                const key = `${m.user_id}:${m.content}`;
                return !newMsgs.some(nm => `${nm.user_id}:${nm.content}` === key);
            });

            // Only add messages that aren't already in state
            const uniqueNewMsgs = newMsgs.filter(m => 
                !existingIds.has(m.id) && 
                !filtered.some(f => f.id === m.id)
            );

            const updated = [...filtered, ...uniqueNewMsgs];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
        });
    }, FLUSH_INTERVAL);

    const chatChannel = supabase
        .channel(`stream-chat-${streamId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'stream_messages',
                filter: `stream_id=eq.${streamId}`
            },
            async (payload: any) => {
                const newMessage = payload.new;

                // Fetch user profile for the new message
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('username, avatar_url, role, troll_role, created_at, rgb_username_expires_at, glowing_username_color')
                    .eq('id', newMessage.user_id)
                    .single();

                const newMsg: Message = {
                    ...newMessage,
                    type: 'chat',
                    user_profiles: profile
                };

                messageBufferRef.current.push(newMsg);

                // Increment unread count if chat not focused and message from someone else
                if (!isChatFocused && newMsg.user_id !== user?.id) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        )
        .subscribe();

    // Subscribe to room presence to show join/leave messages in chat
    const presenceChannel = supabase
        .channel(`stream:${streamId}`)
        .on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach((p: any) => {
                const systemMsg: Message = {
                    id: `sys-${Date.now()}-${Math.random()}`,
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
                messageBufferRef.current.push(systemMsg);
            });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach((p: any) => {
                const systemMsg: Message = {
                    id: `sys-${Date.now()}-${Math.random()}`,
                    user_id: p.user_id,
                    content: 'left the broadcast',
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
                messageBufferRef.current.push(systemMsg);
            });
        })
        .subscribe();

    // Auto-delete messages after 30 seconds
    const autoDeleteInterval = setInterval(() => {
        const now = Date.now();
        const thirtySecondsAgo = new Date(now - 30000).toISOString();
        setMessages(prev => prev.filter(msg => {
            // Keep system messages (join/leave) for 60 seconds
            if (msg.type === 'system') {
                return msg.created_at > thirtySecondsAgo;
            }
            // Keep chat messages for 30 seconds
            return msg.created_at > thirtySecondsAgo;
        }));
    }, 5000); // Check every 5 seconds

    return () => {
        clearInterval(flushInterval);
        clearInterval(autoDeleteInterval);
        supabase.removeChannel(chatChannel);
        supabase.removeChannel(presenceChannel);
    };
  }, [streamId, isViewer, user, profile, isChatFocused]);

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

  // Removed aggressive auto-delete loop to prevent messages from disappearing due to clock skew


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

    // Rate Limit Check
    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) {
        console.log('💬 [BroadcastChat] Rate limited');
        return; // Silent fail or show UI feedback
    }
    lastSentRef.current = now;

    const content = input.trim();
    console.log('💬 [BroadcastChat] Preparing to send:', { content, userId: user.id });
    setInput('');

    // INSTANT DISPLAY: Add message to UI immediately before waiting for server
    const txnId = crypto.randomUUID();
    const optimisticMessage: Message = {
        id: txnId,
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

    // Add to messages immediately for instant display
    setMessages(prev => {
        const updated = [...prev, optimisticMessage];
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
        return updated;
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`, {
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
        });

        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const hasJsonBody = contentType.toLowerCase().includes('application/json') && rawText.trim().length > 0
        const parsedBody = hasJsonBody ? JSON.parse(rawText) : undefined

        if (!response.ok) {
            const msg = (parsedBody as any)?.error || (parsedBody as any)?.message || rawText || response.statusText
            throw new Error(`Failed to send message (${response.status}): ${msg}`)
        }

        const signedEnvelope = parsedBody ?? (rawText ? rawText : null)
        console.log('💬 [BroadcastChat] Message signed and sent:', signedEnvelope);

        // Message already displayed instantly - no need to do anything on success
        // The server response just confirms it was saved

    } catch (err: any) {
        console.error('💬 [BroadcastChat] Error sending message:', err);
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
        
        <div className="p-4 border-b border-white/10 font-bold bg-zinc-900/50 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
            Live Chat
            {unreadCount > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse font-normal">
                +{unreadCount}
              </span>
            )}
        </div>
        
        <div className="flex-1 min-h-0 relative overflow-hidden">
            {/* Floating Messages - Show last 10 messages as floating bubbles */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-2 max-h-[200px] overflow-hidden">
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
                    
                    if (isGift) {
                        // Parse gift info from message - check for GIFT_EVENT format or gift_type field
                        let giftType = msg.gift_type || 'gift';
                        let giftAmount = msg.gift_amount || 1;
                        // Use sender_name from message data, user_profiles, or enriched data
                        let senderName = msg.sender_name || msg.user_profiles?.username || 'Someone';
                        
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
                      hostChatDisabledByOfficer
                        ? "Chat disabled by officer control"
                        : isGuest
                          ? "Sign up to chat..."
                          : "Type a message..."
                    }
                    disabled={hostChatDisabledByOfficer}
                    className="w-full bg-zinc-800 border-none rounded-full px-4 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-500 text-sm"
                />

                <button 
                    type="submit"  
                    disabled={hostChatDisabledByOfficer || isGuest || !input.trim()}
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
        />
    </div>
  );
}

