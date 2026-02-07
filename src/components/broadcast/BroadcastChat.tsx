import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Send, User, Trash2, Shield, Crown, Sparkles, Car, Smile } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import UserNameWithAge from '../UserNameWithAge';
import EmojiPicker, { Theme } from 'emoji-picker-react';

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
}

export default function BroadcastChat({ streamId, hostId, isModerator, isHost, isViewer = false }: BroadcastChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [streamMods, setStreamMods] = useState<string[]>([]);
  const { user, profile } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  
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

    // If Viewer (Passive Mode), use Polling instead of Realtime
    if (isViewer) {
        const interval = setInterval(fetchMessages, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }

    // Subscribe to Chat Messages
    const chatChannel = supabase
        .channel(`chat:${streamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_messages',
            filter: `stream_id=eq.${streamId}`
        }, (payload) => {
            const newRow = payload.new as any;
            
            const newMsg: Message = {
                id: newRow.id,
                user_id: newRow.user_id,
                content: newRow.content,
                created_at: newRow.created_at,
                type: 'chat',
                user_profiles: {
                    username: newRow.user_name || 'Unknown',
                    avatar_url: newRow.user_avatar || '',
                    role: newRow.user_role,
                    troll_role: newRow.user_troll_role,
                    created_at: newRow.user_created_at,
                    rgb_username_expires_at: newRow.user_rgb_expires_at,
                    glowing_username_color: newRow.user_glowing_username_color
                },
                vehicle_status: newRow.vehicle_snapshot
            };

            setMessages(prev => {
                const updated = [...prev, newMsg];
                // Keep only last 50 messages to prevent memory issues and ensure visibility
                if (updated.length > 50) return updated.slice(updated.length - 50);
                return updated;
            });
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        })
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'stream_messages'
        }, (payload) => {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .subscribe();

    // Subscribe to User Entrance (Presence)
    const viewerChannel = supabase
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
                setMessages(prev => {
                    const updated = [...prev, systemMsg];
                    if (updated.length > 50) return updated.slice(updated.length - 50);
                    return updated;
                });
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            });
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(chatChannel); 
        supabase.removeChannel(viewerChannel);
    };
  }, [streamId, fetchVehicleStatus, isViewer]);

  // Removed aggressive auto-delete loop to prevent messages from disappearing due to clock skew


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !profile) return;
    
    // Rate Limit Check
    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) {
        return; // Silent fail or show UI feedback
    }
    lastSentRef.current = now;

    const content = input.trim();
    setInput('');

    // Fetch my vehicle status ONCE
    let myVehicle = vehicleCacheRef.current[user.id];
    if (!myVehicle) {
        // We can safely await this here because it's initiated by the SENDER (1 person), not receivers (1000 people)
        myVehicle = (await fetchVehicleStatus(user.id)) || { has_vehicle: false };
    }

    await supabase.from('stream_messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content,
        // Denormalized Payload
        user_name: profile.username,
        user_avatar: profile.avatar_url,
        user_role: profile.role,
        user_troll_role: profile.troll_role,
        user_created_at: profile.created_at,
        user_rgb_expires_at: profile.rgb_username_expires_at,
        user_glowing_username_color: profile.glowing_username_color,
        vehicle_snapshot: myVehicle
    });
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
    <div className="flex flex-col h-full text-white">
        <div className="p-4 border-b border-white/10 font-bold bg-zinc-900/50 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
            Live Chat
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700">
            {messages.length === 0 && (
                <div className="text-center text-zinc-500 text-sm mt-10 italic">
                    No messages yet...
                </div>
            )}
            {messages.map(msg => {
                if (msg.type === 'system') {
                    return (
                        <div key={msg.id} className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-2 text-zinc-400 text-xs italic bg-zinc-800/30 p-1.5 rounded-lg border border-white/5">
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
                    );
                }

                return (
                <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-start gap-2 group">
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
                        <span className="text-gray-200 text-sm">{msg.content}</span>
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
            )})}
            <div ref={scrollRef} />
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-zinc-900/80 relative">
            {isGuest ? (
                <div className="flex items-center justify-between gap-2 bg-zinc-800/50 rounded-full p-2 pl-4 border border-white/5">
                    <span className="text-zinc-400 text-sm">Sign up to chat</span>
                    <button 
                        type="button"
                        onClick={() => navigate('?mode=signup')}
                        className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold hover:shadow-lg transition-all text-white"
                    >
                        Sign Up
                    </button>
                </div>
            ) : (
                <>
            {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-white/10">
                            <EmojiPicker 
                                onEmojiClick={(data) => setInput(prev => prev + data.emoji)}
                                theme={Theme.DARK}
                                width={300}
                                height={400}
                            />
                        </div>
                    )}

                <div className="relative w-full">
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Chat..."
                        className="w-full bg-zinc-800 border-none rounded-full pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-500 text-sm"
                    />
                    
                    <button 
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-400 transition-colors z-10"
                    >
                        <Smile size={18} />
                    </button>

                    <button 
                        type="submit" 
                        disabled={!input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 transition"
                    >
                        <Send size={16} />
                    </button>
                </div>
                </>
            )}
        </form>
    </div>
  );
}
