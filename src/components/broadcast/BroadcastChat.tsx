import { useUIStore } from '../../lib/ui-store';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Trash2, Shield, Crown, Sparkles, Car } from 'lucide-react';
import GiftMessage from './GiftMessage';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import UserNameWithAge from '../UserNameWithAge';
import { toast } from 'sonner';
import { EDGE_URL } from '../../lib/config';
import { AnimatePresence } from 'framer-motion'; // Import AnimatePresence

interface VehicleStatus {
  has_vehicle: boolean;
  vehicle_name?: string;
  plate?: string;
  license_status?: string;
  is_suspended?: boolean;
  insurance_active?: boolean;
}

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type: 'chat';
  // Denormalized fields
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
  user_created_at?: string;
  user_rgb_expires_at?: string;
  user_glowing_username_color?: string;
  vehicle_snapshot?: VehicleStatus;

  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  } | null;
  vehicle_status?: VehicleStatus;
}

interface SystemMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type: 'system';
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
  } | null;
}

export interface GiftMessageData {
  username: string;
  user_id: string;
  gift_id: string;
  gift_name: string;
  gift_icon: string; // URL or emoji
  gift_value: number; // Coin value of a single gift
  gift_count: number; // Number of gifts sent in this message
  rarity: "common" | "rare" | "epic" | "legendary";
  timestamp: string;
}

export interface GiftMessageType extends GiftMessageData {
  id: string;
  type: 'gift';
  created_at: string;
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

type Message = ChatMessage | SystemMessage | GiftMessageType;

interface BroadcastChatProps {
    streamId: string;
    hostId: string;
    isModerator?: boolean;
    isHost?: boolean;
    isViewer?: boolean;
    isGuest?: boolean;
    broadcasterId?: string;
    guestUser: { id: string; username: string; } | null;
}

export default function BroadcastChat({ streamId, hostId, isModerator, isHost, isViewer = false, isGuest = false, broadcasterId, guestUser }: BroadcastChatProps) {
  const navigate = useNavigate();
  const setLastGift = useUIStore(state => state.setLastGift);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [broadofficers, setBroadofficers] = useState<string[]>([]);
  const { user, profile } = useAuthStore();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Buffering for high-frequency updates
  const messageBufferRef = useRef<Message[]>([]);
  const MAX_MESSAGES = 200;
  const FLUSH_INTERVAL = 150; // ms
  
  // Unread message tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatFocused, setIsChatFocused] = useState(true);
  
  // Rate limiting
  const lastSentRef = useRef<number>(0);
  const RATE_LIMIT_MS = 1000; // 1 message per second

  // Cache for vehicle status to avoid repeated calls
  const vehicleCacheRef = useRef<Record<string, VehicleStatus>>({});

  // Callback to remove a gift message after its animation completes
  const handleGiftAnimationComplete = useCallback((id: string) => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== id));
  }, []);

  // Fetch Broadofficers
  useEffect(() => {
      const fetchBroadofficers = async () => {
          const { data } = await supabase
            .from('broadcast_officers')
            .select('officer_id')
            .eq('broadcaster_id', hostId);
          if (data) setBroadofficers(data.map(d => d.officer_id));
      };
      if (hostId) fetchBroadofficers();
  }, [hostId]);

  const fetchVehicleStatus = useCallback(async (userId: string) => {
    if (vehicleCacheRef.current[userId]) return vehicleCacheRef.current[userId];
    
    try {
      const { data, error } = await supabase.rpc('get_broadcast_vehicle_status', { target_user_id: userId });
      if (!error && data) {
        vehicleCacheRef.current[userId] = data as VehicleStatus;
        return data as VehicleStatus;
      }
    } catch (err) {
      console.error('Error fetching vehicle status:', err);
    }
    return null;
  }, []);

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
            const processedMessages = data.reverse().map((msg: any) => {
                const baseMessage = {
                    id: msg.id,
                    user_id: msg.user_id,
                    created_at: msg.created_at,
                    user_profiles: msg.user_profiles || null, // Assumes user_profiles is joined or denormalized
                    vehicle_status: msg.vehicle_snapshot || null, // Use snapshot if available
                };

                if (msg.type === 'chat') {
                    return { ...baseMessage, type: 'chat', content: msg.content };
                } else if (msg.type === 'system') {
                    return { ...baseMessage, type: 'system', content: msg.content };
                } else if (msg.type === 'gift') {
                    return {
                        ...baseMessage,
                        type: 'gift',
                        username: msg.username || msg.user_profiles?.username || 'Unknown',
                        gift_id: msg.gift_id || '',
                        gift_name: msg.gift_name || 'Gift',
                        gift_icon: msg.gift_icon || '',
                        gift_value: msg.gift_value || 0,
                        gift_count: msg.gift_count || 1,
                        rarity: msg.rarity || 'common',
                        timestamp: msg.created_at,
                    };
                }
                return { ...baseMessage, type: 'chat', content: msg.content }; // Fallback to chat
            }) as Message[];
            
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

    // Flush buffer interval
    const flushInterval = setInterval(() => {
        if (messageBufferRef.current.length === 0) return;

        const newMsgs = [...messageBufferRef.current];
        messageBufferRef.current = [];

        setMessages(prev => {
            let modifiablePrev = [...prev];

            // Remove optimistic messages that are now in the buffer
            const incomingIds = new Set(newMsgs.map(m => m.type === 'chat' ? `${m.user_id}:${(m as ChatMessage).content}` : m.id));
            modifiablePrev = modifiablePrev.filter(m => {
                if (m.id.startsWith('temp-')) {
                    const key = `${m.user_id}:${(m as ChatMessage).content}`;
                    return !incomingIds.has(key);
                }
                return true;
            });

            let updatedMessages = [...modifiablePrev];

            for (const newMsg of newMsgs) {
                if (newMsg.type === 'gift') {
                    const lastMessage = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : undefined;
                    if (
                        lastMessage &&
                        lastMessage.type === 'gift' &&
                        lastMessage.user_id === newMsg.user_id &&
                        lastMessage.gift_id === newMsg.gift_id &&
                        (new Date(newMsg.created_at).getTime() - new Date(lastMessage.created_at).getTime()) < 3000
                    ) {
                        // It's a stackable gift. Replace the last message with an updated one.
                        const updatedGift = {
                            ...lastMessage,
                            gift_count: lastMessage.gift_count + newMsg.gift_count,
                            id: newMsg.id, // Use new ID to re-trigger animation
                            created_at: newMsg.created_at,
                        };
                        updatedMessages = [...updatedMessages.slice(0, -1), updatedGift];
                        setLastGift(updatedGift);
                    } else {
                        updatedMessages.push(newMsg);
                        setLastGift(newMsg as GiftMessageType);
                    }
                } else {
                    updatedMessages.push(newMsg);
                }
            }


            if (updatedMessages.length > MAX_MESSAGES) {
                return updatedMessages.slice(updatedMessages.length - MAX_MESSAGES);
            }
            return updatedMessages;
        });
    }, FLUSH_INTERVAL);

    // Subscribe to Chat Messages via Server-Signed Broadcast
    const chatChannel = supabase
        .channel(`stream:${streamId}`)
        .on('broadcast', { event: 'message' }, (payload) => {
            const envelope = payload.payload;
            
            // Check if this is a message for this stream and version 1
            if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

            let newMsg: Message | null = null;

            const baseMessage = {
                id: envelope.txn_id,
                user_id: envelope.s,
                created_at: new Date(envelope.ts).toISOString(),
                user_profiles: envelope.p,
                vehicle_status: envelope.v,
            };

            if (envelope.t === 'chat') {
                newMsg = {
                    ...baseMessage,
                    type: 'chat',
                    content: envelope.d.content
                };
            } else if (envelope.t === 'system') {
                newMsg = {
                    ...baseMessage,
                    type: 'system',
                    content: envelope.d.content
                };
            } else if (envelope.t === 'gift') {
                newMsg = {
                    ...baseMessage,
                    type: 'gift',
                    username: envelope.d.username,
                    gift_id: envelope.d.gift_id,
                    gift_name: envelope.d.gift_name,
                    gift_icon: envelope.d.gift_icon,
                    gift_value: envelope.d.gift_value,
                    gift_count: envelope.d.gift_count,
                    rarity: envelope.d.rarity,
                    timestamp: envelope.ts,
                };
            }

            if (newMsg) {
                messageBufferRef.current.push(newMsg);
                // Increment unread count if chat not focused and message from someone else
                if (!isChatFocused && newMsg.user_id !== user?.id) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        })
        .subscribe();

    // Subscribe to room presence to show join/leave messages in chat
    const presenceChannel = supabase
        .channel(`room:${streamId}`)
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
        .subscribe();

    return () => {
        clearInterval(flushInterval);
        supabase.removeChannel(chatChannel);
        supabase.removeChannel(presenceChannel);
    };
  }, [streamId, fetchVehicleStatus, isViewer, user, profile, isChatFocused]);

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
    
    // Cleanup aggressive auto-delete loop. It caused messages to disappear due to clock skew
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

    // Optimistic Update
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
        },
        vehicle_status: vehicleCacheRef.current[user.id] // Use cached vehicle status if available
    };

    setMessages(prev => {
        const updated = [...prev, optimisticMessage];
        if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
        return updated;
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const edgeUrl = EDGE_URL.replace(/\/$/, '');
        const response = await fetch(`${edgeUrl}/send-message`, {
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
        }

        const signedEnvelope = await response.json();
        console.log('💬 [BroadcastChat] Message signed and sent:', signedEnvelope);

    } catch (err: any) {
        console.error('💬 [BroadcastChat] Error sending message:', err);
        if (String(err.message || '').toLowerCase().includes('rate limit')) {
            toast.error('You are sending messages too fast. Please slow down.');
        } else {
            toast.error('Failed to send message: ' + err.message);
        }
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== txnId));
    }
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
      if (broadofficers.includes(userId)) {
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

  const renderVehicleBadge = (status?: VehicleStatus) => {
    if (!status || !status.has_vehicle) return null;
    
    // Check for issues
    const isSuspended = status.is_suspended || status.license_status === 'suspended';
    const noInsurance = status.insurance_active === false;
    
    let colorClass = "text-blue-400";
    if (isSuspended) colorClass = "text-red-500 animate-pulse";
    else if (noInsurance) colorClass = "text-orange-400";
    
    return (
        <span 
            className={`inline-flex items-center gap-0.5 ml-1 mr-1 ${colorClass}`} 
            title={`Vehicle: ${status.vehicle_name} | Plate: ${status.plate} | Status: ${status.license_status} | Insured: ${status.insurance_active ? 'Yes' : 'No'}`}
        >
            <Car size={12} />
            {isSuspended && <span className="text-[10px] font-bold">!</span>}
        </span>
    );
  };

  return (
    <div className="w-[350px] flex flex-col h-full bg-black/30 backdrop-blur-md border-l border-white/10 text-white shadow-2xl" ref={chatContainerRef}>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          followOutput="smooth"
          atBottomStateChange={setIsChatFocused}
          itemContent={(index, msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="text-zinc-400 text-sm italic">
                  <span className="font-bold">{msg.user_profiles?.username || 'System'}</span> {msg.content}
                </div>
              );
            } else if (msg.type === 'gift') {
              return (
                <AnimatePresence key={msg.id}>
                  <GiftMessage
                    id={msg.id}
                    username={msg.user_profiles?.username || msg.username}
                    giftName={msg.gift_name}
                    giftAmount={msg.gift_value}
                    giftCount={msg.gift_count}
                    rarity={msg.rarity}
                    giftIcon={msg.gift_icon}
                    totalCoins={msg.gift_value * msg.gift_count}
                    onAnimationComplete={handleGiftAnimationComplete}
                  />
                </AnimatePresence>
              );
            } else {
              return (
                <div key={msg.id} className="text-sm p-2 rounded-lg bg-black/20 hover:bg-black/40 transition-colors">
                  <div className="flex items-baseline">
                    {renderBadge(msg.user_id, msg.user_profiles?.role, msg.user_profiles?.troll_role)}
                    {renderVehicleBadge(msg.vehicle_status)}
                    <UserNameWithAge
                      user={{
                          username: msg.user_profiles?.username || 'Anonymous',
                          created_at: msg.user_profiles?.created_at,
                          rgb_username_expires_at: msg.user_profiles?.rgb_username_expires_at,
                          glowing_username_color: msg.user_profiles?.glowing_username_color,
                      }}
                      isBroadcaster={msg.user_id === broadcasterId}
                    />
                    <span className="ml-2 text-zinc-300 break-words">{msg.content}</span>
                  </div>
                </div>
              );
            }
          }}
        />
      </div>
      <form onSubmit={sendMessage} className="flex items-center p-3 border-t border-white/10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          className="flex-1 bg-black/30 text-white text-sm rounded-full px-4 py-2 mr-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-zinc-500 border border-transparent focus:border-purple-500/50"
          disabled={isViewer}
        />
        <button
          type="submit"
          className="bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-bold p-2.5 rounded-full transition-all duration-200 shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
          disabled={isViewer || !input.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
