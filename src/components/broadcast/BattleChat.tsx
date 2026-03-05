import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
  avatar_url?: string;
}

interface StreamInfo {
  id: string;
  title: string;
  user_id: string;
}

interface BattleChatProps {
  battleId: string;
  challengerStream: StreamInfo;
  opponentStream: StreamInfo;
  currentUserId?: string;
  participantRole?: string | null;
}

export default function BattleChat({ 
  battleId, 
  challengerStream, 
  opponentStream, 
  currentUserId,
  participantRole 
}: BattleChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHost] = useState(participantRole === 'host');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Determine which team the current user is on
  const getUserTeam = (userId: string) => {
    if (userId === challengerStream.user_id) return 'challenger';
    if (userId === opponentStream.user_id) return 'opponent';
    return 'viewer';
  };

  // Fetch existing messages from both streams
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('stream_chat')
        .select('*')
        .in('stream_id', [challengerStream.id, opponentStream.id])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching battle chat:', error);
        return;
      }

      if (data) {
        setMessages(data.reverse());
      }
    };

    fetchMessages();
  }, [challengerStream.id, opponentStream.id]);

  // Subscribe to real-time chat messages from both streams
  useEffect(() => {
    // Create a single channel for both streams
    channelRef.current = supabase
      .channel(`battle-chat:${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat',
          filter: `stream_id=in.(${challengerStream.id},${opponentStream.id})`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev.slice(-49), newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [battleId, challengerStream.id, opponentStream.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    // Determine which stream to send to based on user's team
    const targetStreamId = getUserTeam(currentUserId) === 'opponent' 
      ? opponentStream.id 
      : challengerStream.id;

    const { error } = await supabase.from('stream_chat').insert({
      stream_id: targetStreamId,
      user_id: currentUserId,
      message: newMessage.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    setNewMessage('');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-t from-black/90 via-black/70 to-transparent">
      {/* Battle Chat Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/60 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-white">Battle Chat</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-purple-400">{challengerStream.title}</span>
          <span className="text-zinc-500">vs</span>
          <span className="text-emerald-400">{opponentStream.title}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const team = getUserTeam(msg.user_id);
            const isCurrentUser = msg.user_id === currentUserId;
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                    isCurrentUser
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-br-sm'
                      : team === 'opponent'
                      ? 'bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 text-white rounded-bl-sm'
                      : 'bg-gradient-to-r from-purple-600/80 to-purple-500/80 text-white rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold opacity-90">
                      {msg.username}
                    </span>
                    {team === 'challenger' && (
                      <span className="text-[8px] bg-purple-500/50 px-1 rounded">A</span>
                    )}
                    {team === 'opponent' && (
                      <span className="text-[8px] bg-emerald-500/50 px-1 rounded">B</span>
                    )}
                  </div>
                  <p className="text-sm leading-tight">{msg.message}</p>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-2 bg-black/60 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black transition"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
