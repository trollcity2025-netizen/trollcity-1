import React, { useState, useEffect, useRef } from 'react';
import { Send, Lock } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
  isSystem?: boolean;
  role?: string;
  messageType?: string;
}

interface CourtChatProps {
  courtId: string;
  isLocked: boolean;
  className?: string;
}

export default function CourtChat({ courtId, isLocked, className = '' }: CourtChatProps) {
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Record<string, string>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages & Subscribe
  useEffect(() => {
    if (!courtId) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('court_ai_messages')
        .select(`
          id,
          content,
          created_at,
          agent_role,
          user_id,
          message_type,
          user_profiles:user_id (username)
        `)
        .eq('case_id', courtId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error loading chat:', error);
        return;
      }

      const formatted = data.map((m: any) => ({
        id: m.id,
        user: m.agent_role === 'User' ? (m.user_profiles?.username || 'Unknown') : m.agent_role,
        text: m.content,
        timestamp: new Date(m.created_at),
        isSystem: m.agent_role === 'System',
        role: m.agent_role,
        messageType: m.message_type,
      }));
      setMessages(formatted);
    };

    loadMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`court_chat_${courtId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_ai_messages',
          filter: `case_id=eq.${courtId}`
        },
        async (payload) => {
          const m = payload.new as any;
          
          // If it's a user message, we might need to fetch the username if not present
          let username = m.agent_role;
          if (m.agent_role === 'User' && m.user_id) {
             if (m.user_id === user?.id) {
                username = profile?.username || 'Me';
                profileCache.current[m.user_id] = username;
             } else if (profileCache.current[m.user_id]) {
                username = profileCache.current[m.user_id];
             } else {
                const { data } = await supabase.from('user_profiles').select('username').eq('id', m.user_id).maybeSingle();
                username = data?.username || 'User';
                if (data?.username) {
                  profileCache.current[m.user_id] = username;
                }
             }
          }

          setMessages(prev => [...prev, {
            id: m.id,
            user: username,
            text: m.content,
            timestamp: new Date(m.created_at),
            isSystem: m.agent_role === 'System',
            role: m.agent_role,
            messageType: m.message_type,
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId, user?.id, profile?.username]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLocked || !user) return;

    const text = inputValue.trim();
    setInputValue(''); // optimistic clear

    try {
      // Determine role (Judge vs User)
      // Check if user is the judge of this case? 
      // For simplicity, admins/officers are "Judge" if they want, but let's stick to 'User' unless system explicitly sets it.
      // Actually, let's check profile role.
      
      const isJudge = profile?.role === 'admin' || profile?.is_lead_officer || profile?.is_admin; // Simplified
      
      const { error } = await supabase.from('court_ai_messages').insert({
        case_id: courtId,
        user_id: user.id,
        agent_role: isJudge ? 'Judge' : 'User', // Or just 'User' and let the UI decide display? 
                                                // The prompt logic uses 'Judge' to know authority.
        message_type: 'chat',
        content: text
      });

      if (error) throw error;
      
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
      setInputValue(text); // revert on error
    }
  };

  const getRoleColor = (role?: string) => {
    switch(role) {
      case 'Prosecutor': return 'text-red-400';
      case 'Defense': return 'text-blue-400';
      case 'Judge': return 'text-yellow-400';
      case 'System': return 'text-purple-400';
      default: return 'text-gray-500';
    }
  };

  const latestProsecutorStatement = [...messages]
    .filter((m) => m.role === 'Prosecutor' && m.messageType === 'statement')
    .slice(-1)[0];

  const latestDefenseStatement = [...messages]
    .filter((m) => m.role === 'Defense' && m.messageType === 'statement')
    .slice(-1)[0];

  const recentInterjections = [...messages]
    .filter(
      (m) =>
        (m.role === 'Prosecutor' || m.role === 'Defense') &&
        m.messageType &&
        m.messageType !== 'statement'
    )
    .slice(-3);

  return (
    <div className={`flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 h-[400px] ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 rounded-t-lg">
        <h3 className="font-semibold text-sm text-gray-200">Court Chat</h3>
        {isLocked && (
          <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
            <Lock size={12} />
            <span>LOCKED</span>
          </div>
        )}
      </div>

      {(!latestProsecutorStatement && !latestDefenseStatement && recentInterjections.length === 0) ? null : (
        <div className="px-3 pt-2 pb-1 border-b border-zinc-800 bg-zinc-950/40 text-[11px] text-gray-300 space-y-1">
          {latestProsecutorStatement && (
            <div className="flex gap-1">
              <span className="font-semibold text-red-400">Prosecutor:</span>
              <span className="truncate">{latestProsecutorStatement.text}</span>
            </div>
          )}
          {latestDefenseStatement && (
            <div className="flex gap-1">
              <span className="font-semibold text-blue-400">Defense:</span>
              <span className="truncate">{latestDefenseStatement.text}</span>
            </div>
          )}
          {recentInterjections.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recentInterjections.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-[10px]"
                >
                  {m.role}: {m.messageType}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isSystem ? 'items-center' : 'items-start'}`}>
            {msg.isSystem ? (
              <span className="text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded-full border border-purple-500/20">
                {msg.text}
              </span>
            ) : (
              <div className="max-w-[85%]">
                <span className={`text-xs mb-0.5 block ml-1 font-bold ${getRoleColor(msg.role)}`}>
                  {msg.role && msg.role !== 'User' ? `[${msg.role}] ` : ''}{msg.user}
                </span>
                <div className={`px-3 py-2 rounded-2xl rounded-tl-none text-sm text-gray-200 border ${msg.role === 'Prosecutor' ? 'bg-red-950/30 border-red-900/50' : msg.role === 'Defense' ? 'bg-blue-950/30 border-blue-900/50' : 'bg-zinc-800 border-zinc-700/50'}`}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-950/30 rounded-b-lg">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isLocked ? "Chat is locked..." : "Type a message..."}
            disabled={isLocked}
            className="w-full bg-zinc-800 border border-zinc-700 text-gray-200 text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-600 transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLocked}
            className="absolute right-1.5 top-1.5 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-500 disabled:opacity-50 disabled:bg-zinc-700 disabled:text-gray-500 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
