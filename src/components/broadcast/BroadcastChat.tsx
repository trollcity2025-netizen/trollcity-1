import React, { useEffect, useState, useRef } from 'react';
import { Send, User, Trash2, Shield, Crown, Star, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system';
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
  } | null;
}

interface BroadcastChatProps {
    streamId: string;
    hostId: string;
    isModerator?: boolean;
    isHost?: boolean;
}

import UserNameWithAge from '../UserNameWithAge';

export default function BroadcastChat({ streamId, hostId, isModerator, isHost }: BroadcastChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMods, setStreamMods] = useState<string[]>([]);
  const user = useAuthStore(s => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Fetch initial messages (only last 25s)
  useEffect(() => {
    const fetchMessages = async () => {
        const cutoff = new Date(Date.now() - 25000).toISOString();
        const { data } = await supabase
            .from('stream_messages')
            .select('*, user_profiles(username, avatar_url, role, troll_role, created_at)')
            .eq('stream_id', streamId)
            .gt('created_at', cutoff)
            .order('created_at', { ascending: true });
        
        if (data) {
            // @ts-ignore
            setMessages(data.map(m => ({ ...m, type: 'chat' })));
        }
    };
    fetchMessages();

    // Subscribe to Chat Messages
    const chatChannel = supabase
        .channel(`chat:${streamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_messages',
            filter: `stream_id=eq.${streamId}`
        }, async (payload) => {
            // We need to fetch the user profile for the new message
            const { data: userData } = await supabase
                .from('user_profiles')
                .select('username, avatar_url, role, troll_role, created_at')
                .eq('id', payload.new.user_id)
                .single();
            
            const newMsg = {
                ...payload.new,
                type: 'chat',
                user_profiles: userData
            } as Message;

            setMessages(prev => [...prev, newMsg]);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        })
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'stream_messages',
            filter: `stream_id=eq.${streamId}`
        }, (payload) => {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .subscribe();

    // Subscribe to User Entrance (stream_viewers)
    const viewerChannel = supabase
        .channel(`viewers:${streamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_viewers',
            filter: `stream_id=eq.${streamId}`
        }, async (payload) => {
            // Fetch user info
            const { data: userData } = await supabase
                .from('user_profiles')
                .select('username, created_at, role, troll_role')
                .eq('id', payload.new.user_id)
                .single();

            if (userData) {
                const systemMsg: Message = {
                    id: `sys-${Date.now()}-${Math.random()}`,
                    user_id: payload.new.user_id,
                    content: 'joined the broadcast',
                    created_at: new Date().toISOString(),
                    type: 'system',
                    user_profiles: {
                        username: userData.username,
                        avatar_url: '', // Not needed for system msg
                        created_at: userData.created_at,
                        role: userData.role,
                        troll_role: userData.troll_role
                    }
                };
                setMessages(prev => [...prev, systemMsg]);
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(chatChannel); 
        supabase.removeChannel(viewerChannel);
    };
  }, [streamId]);

  // Auto-delete loop
  useEffect(() => {
    const interval = setInterval(() => {
        const cutoff = new Date(Date.now() - 25000).getTime();
        setMessages(prev => prev.filter(m => new Date(m.created_at).getTime() > cutoff));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const content = input.trim();
    setInput('');

    await supabase.from('stream_messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content
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

  return (
    <div className="flex flex-col h-full text-white">
        <div className="p-4 border-b border-white/10 font-bold bg-zinc-900/50 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
            Live Chat
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700">
            {messages.length === 0 && (
                <div className="text-center text-zinc-500 text-sm mt-10 italic">
                    Messages disappear after 25 seconds...
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
                                        id: msg.user_id
                                    }}
                                    className="text-zinc-300"
                                    showBadges={false} // System messages already have badge via renderBadge? Or should we enable? 
                                    // User asked: "when a role enters it needs to have they badge next to they username"
                                    // renderBadge handles it. UserNameWithAge might duplicate.
                                    // Let's keep showBadges={false} and rely on renderBadge.
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
                            <UserNameWithAge 
                                user={{
                                    username: msg.user_profiles?.username || 'User',
                                    created_at: msg.user_profiles?.created_at,
                                    role: msg.user_profiles?.role as any,
                                    troll_role: msg.user_profiles?.troll_role,
                                    id: msg.user_id
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

        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-zinc-900/80">
            <div className="relative">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Chat..."
                    className="w-full bg-zinc-800 border-none rounded-full pl-4 pr-10 py-2.5 focus:ring-2 focus:ring-yellow-500 text-white placeholder:text-zinc-500 text-sm"
                />
                <button 
                    type="submit" 
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 transition"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>
    </div>
  );
}
