import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Coins, Shield } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import ClickableUsername from "../ClickableUsername";

interface ChatBoxProps {
  streamId: string;
  onProfileClick?: (profile: any) => void;
  onCoinSend?: (user: string, amount: number) => void;
  room?: any; // LiveKit Room
  isBroadcaster?: boolean;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_profile?: {
    username: string;
    perks: string[];
    hasInsurance?: boolean;
    rgbExpiresAt?: string;
  };
}

export default function ChatBox({ streamId, onProfileClick, onCoinSend, room, isBroadcaster }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const suppressAutoScrollRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Cache for user profiles to avoid repeated fetches
  const userCacheRef = useRef<Record<string, { username: string; perks: string[]; hasInsurance?: boolean; rgbExpiresAt?: string; avatar_url?: string }>>({});
  
  const [showCoinInput, setShowCoinInput] = useState<string | null>(null);
  const [coinAmount, setCoinAmount] = useState(10);

  // Handle User Joined Events
  useEffect(() => {
    if (!room) return;
    
    const onParticipantConnected = (participant: any) => {
       const newMsg: Message = {
           id: `join-${Date.now()}-${participant.identity}`,
           user_id: 'system',
           content: 'joined the stream',
           message_type: 'system-join',
           created_at: new Date().toISOString(),
           sender_profile: { username: participant.name || participant.identity || 'User', perks: [] }
       };
       setMessages(prev => [...prev, newMsg]);
    };
    
    room.on('participantConnected', onParticipantConnected);
    return () => {
        room.off('participantConnected', onParticipantConnected);
    };
  }, [room]);

  // Auto-vanish messages after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
        const now = new Date();
        setMessages(prev => prev.filter(msg => {
            const msgTime = new Date(msg.created_at);
            const ageSeconds = (now.getTime() - msgTime.getTime()) / 1000;
            return ageSeconds < 30;
        }));
    }, 1000); // Check every second
    return () => clearInterval(interval);
  }, []);

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (userCacheRef.current[userId]) return userCacheRef.current[userId];

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, rgb_username_expires_at, avatar_url')
        .eq('id', userId)
        .single();
        
      const { data: perks } = await supabase
        .from('user_perks')
        .select('perk_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      const { data: insurance } = await supabase
        .from('user_insurances')
        .select('insurance_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      const userData = {
        id: userId,
        username: profile?.username || 'Unknown Troll',
        perks: perks?.map(p => p.perk_id) || [],
        hasInsurance: insurance && insurance.length > 0,
        rgbExpiresAt: profile?.rgb_username_expires_at,
        avatar_url: profile?.avatar_url
      };

      userCacheRef.current[userId] = userData;
      return userData;
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      return { username: 'Unknown', perks: [], hasInsurance: false };
    }
  }, []);

  useEffect(() => {
    if (!streamId) return;

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const reversed = data.reverse();
        // Fetch profiles for all senders
        const uniqueUsers = [...new Set(reversed.map(m => m.user_id || m.sender_id))]; // Handle both column names if needed
        
        const cacheUpdates: Record<string, any> = {};
        await Promise.all(uniqueUsers.map(async (uid) => {
           if (uid) cacheUpdates[uid] = await fetchUserProfile(uid);
        }));

        setMessages(reversed.map(m => ({
          ...m,
          sender_profile: cacheUpdates[m.user_id || m.sender_id]
        })));
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Fetch sender profile if not in cache
          let profile = userCacheRef.current[newMsg.user_id];
          if (!profile) {
            profile = await fetchUserProfile(newMsg.user_id);
          }

          setMessages(prev => [...prev, { ...newMsg, sender_profile: profile }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchUserProfile]);

  // Check stream-level mute status for current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: session } = await supabase.auth.getUser();
        const uid = session.user?.id;
        if (!uid || !streamId) return;
        const { data: sp } = await supabase
          .from('streams_participants')
          .select('can_chat, chat_mute_until')
          .eq('stream_id', streamId)
          .eq('user_id', uid)
          .maybeSingle();
        if (!mounted) return;
        const now = Date.now();
        const mutedUntil = sp?.chat_mute_until ? new Date(sp.chat_mute_until).getTime() : 0;
        const muted = sp?.can_chat === false || mutedUntil > now;
        setIsMuted(Boolean(muted));
      } catch {}
    })();

    // Listen for changes
    const channel = supabase
      .channel(`sp_mute_${streamId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'streams_participants', filter: `stream_id=eq.${streamId}` },
        async () => {
          try {
            const { data: session } = await supabase.auth.getUser();
            const uid = session.user?.id;
            if (!uid || !streamId) return;
            const { data: sp } = await supabase
              .from('streams_participants')
              .select('can_chat, chat_mute_until')
              .eq('stream_id', streamId)
              .eq('user_id', uid)
              .maybeSingle();
            const now = Date.now();
            const mutedUntil = sp?.chat_mute_until ? new Date(sp.chat_mute_until).getTime() : 0;
            const muted = sp?.can_chat === false || mutedUntil > now;
            setIsMuted(Boolean(muted));
          } catch {}
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    const shouldScroll = el.scrollHeight - (el.scrollTop + el.clientHeight) < 200;
    if (suppressAutoScrollRef.current) return;
    if (shouldScroll) {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    if (isMuted) {
        toast.error("You are muted in this stream.");
        return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to chat');
        return;
      }

      const { error } = await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content: inputValue,
        message_type: 'chat'
      });

      if (error) throw error;

      setInputValue("");
      suppressAutoScrollRef.current = true;
      setTimeout(() => {
        suppressAutoScrollRef.current = false;
        scrollToBottom();
      }, 300);
    } catch (e) {
      console.error('Failed to send message', e);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getUsernameStyle = (perks: string[] = [], rgbExpiresAt?: string) => {
    let classes = "font-bold transition-colors ";
    // Prioritize RGB Username
    if (rgbExpiresAt && new Date(rgbExpiresAt) > new Date()) {
      classes += "rgb-username ";
    } else if (perks.includes('perk_rgb_username')) { // Legacy check
      classes += "rgb-username ";
    } else if (perks.includes('perk_global_highlight')) {
      classes += "text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)] ";
    } else {
      classes += "text-purple-300 hover:text-purple-200 ";
    }
    return classes;
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 purple-neon">
      <h3 className="text-sm font-bold mb-3">LIVE CHAT</h3>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0 pr-2">
        {messages.map((msg) => {
          // Handle entrance messages
          if (msg.message_type === 'entrance') {
            let content;
            try {
              content = JSON.parse(msg.content);
            } catch {
              content = { username: 'Unknown', role: 'viewer' };
            }
            
            const hasRgb = msg.sender_profile?.rgbExpiresAt && new Date(msg.sender_profile.rgbExpiresAt) > new Date();
            
            return (
              <div key={msg.id} className="text-xs text-center my-2 animate-fadeIn bg-white/5 rounded p-1 border border-white/10">
                 <span className={`font-bold ${hasRgb ? 'rgb-username' : 'text-yellow-400'}`}>
                   {content.username || msg.sender_profile?.username}
                 </span>
                 <span className="text-gray-300 ml-1">has entered the chat!</span>
              </div>
            );
          }
          
          if (msg.message_type === 'system-join') {
             return (
               <div key={msg.id} className="text-xs text-center text-gray-400 my-1 animate-fadeIn">
                 <span className="font-bold text-gray-300">{msg.sender_profile?.username}</span> joined!
               </div>
             );
          }

          if (msg.message_type === 'system' && msg.content === 'ACTION:LIKE') {
             return (
               <div key={msg.id} className="text-xs text-center text-pink-400 italic animate-pulse">
                 {msg.sender_profile?.username} sent a like! ❤️
               </div>
             );
          }

          return (
            <div
              key={msg.id}
              className="text-xs animate-fadeIn rgb-neon rounded p-2 bg-gray-800/50 group hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {msg.sender_profile?.hasInsurance && (
                    <Shield size={12} className="text-blue-400" fill="currentColor" />
                  )}
                  {msg.sender_profile?.perks?.includes('perk_flex_banner') && '👑 '}
                  <ClickableUsername
                    username={msg.sender_profile?.username || 'Unknown'}
                    profile={msg.sender_profile as any}
                    isBroadcaster={isBroadcaster}
                    streamId={streamId}
                    className={getUsernameStyle(msg.sender_profile?.perks, msg.sender_profile?.rgbExpiresAt)}
                    onClick={() => onProfileClick?.(msg.sender_profile || { id: msg.user_id, name: 'Unknown', username: 'Unknown' })}
                  />
                  <UserBadge profile={msg.sender_profile} />
                </div>
                <button
                  onClick={() =>
                    setShowCoinInput(showCoinInput === msg.id ? null : msg.id)
                  }
                  className="text-yellow-400 hover:text-yellow-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Coins size={14} />
                </button>
              </div>
              <span className="text-gray-300 break-words">{msg.content}</span>

              {showCoinInput === msg.id && (
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="number"
                    value={coinAmount}
                    onChange={(e) =>
                      setCoinAmount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-xs"
                    placeholder="Amount"
                  />
                  <button
                    onClick={() => {
                      onCoinSend?.(msg.sender_profile?.username || 'User', coinAmount);
                      setShowCoinInput(null);
                      setCoinAmount(10);
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded text-xs font-bold"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded px-3 py-2 text-sm focus:outline-none purple-neon transition-all"
        />
        <button
          onClick={handleSendMessage}
          className="bg-purple-600 hover:bg-purple-700 p-2 rounded purple-neon transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

    </div>
  );
}
