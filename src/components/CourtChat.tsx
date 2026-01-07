import React, { useState, useEffect, useRef } from 'react';
import { Send, Lock } from 'lucide-react';
import { useAuthStore } from '../lib/store';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface CourtChatProps {
  courtId: string;
  isLocked: boolean;
  className?: string;
}

export default function CourtChat({ courtId, isLocked, className = '' }: CourtChatProps) {
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      user: 'System',
      text: 'Welcome to Troll Court. All rise.',
      timestamp: new Date(),
      isSystem: true
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isLocked) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        user: 'System',
        text: 'Chat has been locked by the Judge.',
        timestamp: new Date(),
        isSystem: true
      }]);
    }
  }, [isLocked]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLocked) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      user: profile?.username || 'User',
      text: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
  };

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
                <span className="text-xs text-gray-500 mb-0.5 block ml-1">{msg.user}</span>
                <div className="bg-zinc-800 px-3 py-2 rounded-2xl rounded-tl-none text-sm text-gray-200 border border-zinc-700/50">
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
