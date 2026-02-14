import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Trash2, Shield, Crown, Sparkles, Car } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import UserNameWithAge from '../UserNameWithAge';
import { toast } from 'sonner';

interface VehicleStatus {
  has_vehicle: boolean;
  vehicle_name?: string;
  plate?: string;
  license_status?: string;
  is_suspended?: boolean;
  insurance_active?: boolean;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system';
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
            // Process messages: Use denormalized data if available, else fallback
            const processedMessages = await Promise.all(data.reverse().map(async (m: any) => {
                let vStatus = m.vehicle_snapshot as VehicleStatus | undefined;
                
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

                // Fallback for old messages without snapshot
                if (!vStatus && !m.vehicle_snapshot) {
                     // Check cache or fetch (Legacy support only)
                     if (vehicleCacheRef.current[m.user_id]) {
                         vStatus = vehicleCacheRef.current[m.user_id];
                     } else {
                         // We intentionally allow this fetch for OLD messages on load, 
                         // but new messages will skip it.
                         vStatus = await fetchVehicleStatus(m.user_id) || undefined;
                     }
                }

                return {
                    ...m,
                    type: 'chat',
                    user_profiles: uProfile,
                    vehicle_status: vStatus
                } as Message;
            }));
            
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
            // Remove optimistic messages that are now in the buffer
            const incomingIds = new Set(newMsgs.map(m => `${m.user_id}:${m.content}`));
            const filtered = prev.filter(m => {
                if (m.id.startsWith('temp-')) {
                    const key = `${m.user_id}:${m.content}`;
                    return !incomingIds.has(key);
                }
                return true;
            });

            const updated = [...filtered, ...newMsgs];
            if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
            return updated;
        });
    }, FLUSH_INTERVAL);

    // Subscribe to Chat Messages via Server-Signed Broadcast
    const chatChannel = supabase
        .channel(`stream:${streamId}`)
        .on('broadcast', { event: 'message' }, (payload) => {
            const envelope = payload.payload;
            
            // Check if this is a message for this stream and version 1
            if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

            const newMsg: Message = {
                id: envelope.txn_id,
                user_id: envelope.s,
                content: envelope.d.content,
                created_at: new Date(envelope.ts).toISOString(),
                type: 'chat',
                user_profiles: {
                    username: envelope.d.user_name || 'Unknown',
                    avatar_url: envelope.d.user_avatar || '',
                    role: envelope.d.user_role,
                    troll_role: envelope.d.user_troll_role,
                    created_at: envelope.d.user_created_at,
                    rgb_username_expires_at: envelope.d.user_rgb_expires_at,
                    glowing_username_color: envelope.d.user_glowing_username_color
                },
                vehicle_status: envelope.d.vehicle_snapshot
            };

            messageBufferRef.current.push(newMsg);
            
            // Increment unread count if chat not focused and message from someone else
            if (!isChatFocused && newMsg.user_id !== user?.id) {
                setUnreadCount(prev => prev + 1);
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
        
        <div className="flex-1 min-h-0 relative">
            {messages.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm mt-10 italic">
                    No messages
                </div>
            ) : (
                <Virtuoso
                    ref={virtuosoRef}
                    data={messages}
                    followOutput="smooth"
                    initialTopMostItemIndex={messages.length - 1}
                    className="scrollbar-thin scrollbar-thumb-zinc-700"
                    itemContent={(index, msg) => {
                        if (msg.type === 'system') {
                            return (
                                <div className="p-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex items-center gap-2 text-zinc-400 text-xs italic bg-zinc-800/30 p-1.5 rounded-lg border border-white/5">
                                        <Sparkles size={12} className="text-yellow-500" />
                                        <span className="font-bold text-zinc-300 flex items-center gap-1">
                                            {renderBadge(msg.user_id, msg.user_profiles?.role, msg.user_profiles?.troll_role)}
                                            <UserNameWithAge 
                                                user={{
                                                    username: msg.user_profiles?.username || 'User',
                                                    created_at: msg.user_profiles?.created_at,
                                                    role: msg.user_profiles?.role as any,
                                                    troll_role: msg.user_profiles?.troll_role,
                                                    id: msg.user_id,
                                                    rgb_username_expires_at: msg.user_profiles?.rgb_username_expires_at,
                                                    glowing_username_color: msg.user_profiles?.glowing_username_color
                                                }}
                                                className="text-zinc-300"
                                                showBadges={false}
                                                isBroadcaster={isHost}
                                                isModerator={isModerator}
                                                streamId={streamId}
                                            />
                                        </span>
                                        <span>{msg.content}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div className="p-2 animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-start gap-2 group">
                                <div className="w-6 h-6 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                                    {msg.user_profiles?.avatar_url ? (
                                        <img src={msg.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={14} className="m-1 text-zinc-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 break-words">
                                    <div className="font-bold text-yellow-500 text-sm mr-2 flex items-center inline-flex flex-wrap">
                                        {renderBadge(msg.user_id, msg.user_profiles?.role, msg.user_profiles?.troll_role)}
                                        {renderVehicleBadge(msg.vehicle_status)}
                                        <UserNameWithAge 
                                            user={{
                                                username: msg.user_profiles?.username || 'User',
                                                created_at: msg.user_profiles?.created_at,
                                                role: msg.user_profiles?.role as any,
                                                troll_role: msg.user_profiles?.troll_role,
                                                id: msg.user_id,
                                                rgb_username_expires_at: msg.user_profiles?.rgb_username_expires_at,
                                                glowing_username_color: msg.user_profiles?.glowing_username_color
                                            }}
                                            className="text-yellow-500"
                                            showBadges={true}
                                            isBroadcaster={isHost}
                                            isModerator={isModerator}
                                            streamId={streamId}
                                        />
                                        <span>:</span>
                                    </div>
                                    <span className="text-gray-200 text-sm ml-1">{msg.content}</span>
                                </div>
                                {(isHost || isModerator) && (
                                    <button 
                                        onClick={() => deleteMessage(msg.id)}
                                        className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    }}
                />
            )}
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-zinc-900/80 relative">
            <div className="relative w-full">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onFocus={() => {
                        if (isGuest) {
                            navigate('/auth?mode=signup');
                        }
                    }}
                    placeholder={isGuest ? "Sign up to chat..." : "Type a message..."}
                    className="w-full bg-zinc-800 border-none rounded-full px-4 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-500 text-sm"
                />

                <button 
                    type="submit"  
                    disabled={!isGuest && !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 transition"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>
    </div>
  );
}
