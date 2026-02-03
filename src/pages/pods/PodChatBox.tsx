import { useState, useEffect, useRef } from "react";
import { Send, Trash2, UserX } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/store";

import UserNameWithAge from "../../components/UserNameWithAge";

interface PodChatBoxProps {
  roomId: string;
  isHost: boolean;
  currentUserId: string;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
    created_at?: string;
  };
}

export default function PodChatBox({ roomId, isHost, currentUserId }: PodChatBoxProps) {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      // Step 1: Fetch messages
      const { data: msgs } = await supabase
        .from('pod_chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (msgs) {
        // Step 2: Fetch user profiles for these messages
        const userIds = [...new Set(msgs.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, created_at')
          .in('id', userIds);

        const msgsWithUsers = msgs.map(m => ({
          ...m,
          user: profiles?.find(p => p.id === m.user_id)
        }));

        setMessages(msgsWithUsers.reverse());
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to broadcast messages
    const channel = supabase
      .channel(`pod_chat:${roomId}`)
      .on(
        'broadcast',
        { event: 'chat_message' },
        (payload) => {
          setMessages(prev => [...prev, payload.payload as Message]);
          scrollToBottom();
        }
      )
      .on(
        'broadcast',
        { event: 'delete_message' },
        (payload) => {
           setMessages(prev => prev.filter(m => m.id !== payload.payload.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const content = inputValue.trim();
    setInputValue("");
    
    // Create optimistic message
    const newMessage: Message = {
        id: crypto.randomUUID(),
        user_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        user: profile ? {
            username: profile.username,
            avatar_url: profile.avatar_url || '',
            created_at: profile.created_at
        } : undefined
    };

    // 1. Broadcast immediately
    await supabase.channel(`pod_chat:${roomId}`).send({
        type: 'broadcast',
        event: 'chat_message',
        payload: newMessage
    });

    // 2. Persist to DB (background)
    const { error } = await supabase
      .from('pod_chat_messages')
      .insert({
        id: newMessage.id,
        room_id: roomId,
        user_id: currentUserId,
        content
      });

    if (error) {
      console.error("Failed to save message", error);
      // We don't show error to user as broadcast succeeded
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isHost) return;
    
    // 1. Broadcast delete
    await supabase.channel(`pod_chat:${roomId}`).send({
        type: 'broadcast',
        event: 'delete_message',
        payload: { id: messageId }
    });

    // 2. Delete from DB
    const { error } = await supabase
      .from('pod_chat_messages')
      .delete()
      .eq('id', messageId);
    
    if (error) toast.error("Failed to delete message");
  };

  const handleKickUser = async (userId: string, username: string) => {
    if (!isHost || userId === currentUserId) return;
    if (!confirm(`Are you sure you want to kick ${username}?`)) return;

    // Remove from participants
    await supabase
      .from('pod_room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
      
    // Add to bans to prevent rejoin
    await supabase
      .from('pod_bans')
      .insert({
        room_id: roomId,
        user_id: userId
      });

    toast.success(`${username} kicked and banned`);
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-white/70">Pod Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {loading && <div className="text-center text-white/40 text-xs">Loading chat...</div>}
        
        {messages.map((msg) => (
          <div key={msg.id} className="group flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 overflow-hidden">
               <img 
                 src={msg.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user?.username}`} 
                 alt={msg.user?.username}
                 className="w-full h-full object-cover"
               />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {msg.user ? (
                  <UserNameWithAge 
                    user={{
                      username: msg.user.username,
                      id: msg.user_id,
                      created_at: msg.user.created_at
                    }}
                    className="text-sm font-bold text-purple-300 truncate"
                  />
                ) : (
                  <span className="text-sm font-bold text-purple-300 truncate">Unknown</span>
                )}
                <span className="text-[10px] text-white/30">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {isHost && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 text-red-400 hover:text-red-300 rounded"
                            title="Delete Message"
                        >
                            <Trash2 size={12} />
                        </button>
                        {msg.user_id !== currentUserId && (
                             <button 
                                onClick={() => handleKickUser(msg.user_id, msg.user?.username || '')}
                                className="p-1 text-red-400 hover:text-red-300 rounded"
                                title="Kick & Ban User"
                            >
                                <UserX size={12} />
                            </button>
                        )}
                    </div>
                )}
              </div>
              <p className="text-sm text-white/90 break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-white/5">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Say something..."
            className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 pr-10 text-sm text-white focus:outline-none focus:border-purple-500/50"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="absolute right-1 top-1 p-1.5 bg-purple-600 rounded-full text-white disabled:opacity-50 hover:bg-purple-500 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
