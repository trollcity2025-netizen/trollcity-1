import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useJailMode } from '../hooks/useJailMode';
import { supabase } from '../lib/supabase';
import { formatDuration } from '../utils/time';
import { toast } from 'sonner';
import { Lock, Clock, MessageSquare, Send, Radio, Play, X, DollarSign, ChevronRight } from 'lucide-react';

interface InmateMessage {
  id: string;
  sender_id: string;
  sender_username?: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface TCNNLive {
  id: string;
  title: string;
  is_live: boolean;
  hls_url?: string;
}

const MESSAGE_COST = 10;

export default function JailPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { isJailed, jailTimeRemaining, releaseTime } = useJailMode(user?.id);
  
  const [messages, setMessages] = useState<InmateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [tcnnLive, setTcnnLive] = useState<TCNNLive | null>(null);
  const [isTcnnPlaying, setIsTcnnPlaying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user && isJailed) {
      fetchInmateMessages();
      checkTcnnLive();
    }
  }, [user, isJailed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isTcnnPlaying && videoRef.current && tcnnLive?.hls_url) {
      videoRef.current.src = tcnnLive.hls_url;
      videoRef.current.play().catch(console.error);
    } else if (!isTcnnPlaying && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isTcnnPlaying, tcnnLive]);

  const fetchInmateMessages = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('inmate_messages')
        .select(`
          *,
          sender:user_profiles!inmate_messages_sender_id_fkey(username)
        `)
        .or(`inmate_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformed = (data || []).map((msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_username: msg.sender?.username || 'Unknown',
        message: msg.message,
        created_at: msg.created_at,
        is_read: msg.is_read
      }));

      setMessages(transformed);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const checkTcnnLive = async () => {
    try {
      const { data } = await supabase
        .from('streams')
        .select('id, title, is_live, hls_url')
        .eq('category', 'tcnn')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setTcnnLive(data[0]);
        setIsTcnnPlaying(true);
      } else {
        setTcnnLive(null);
        setIsTcnnPlaying(false);
      }
    } catch (err) {
      console.error('Error checking TCNN:', err);
      setTcnnLive(null);
      setIsTcnnPlaying(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return;
    
    // Get user's jail record to check message minutes
    const { data: jailData } = await supabase
      .from('jail')
      .select('message_minutes, message_minutes_used, free_message_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const remainingMinutes = (jailData?.message_minutes || 1) - (jailData?.message_minutes_used || 0);
    const isFreeMessage = !jailData?.free_message_used;

    if (remainingMinutes <= 0 && !isFreeMessage) {
      toast.error('No message minutes remaining. Ask family/friends to purchase more.');
      return;
    }

    try {
      setSendingMessage(true);

      const { error } = await supabase
        .from('inmate_messages')
        .insert({
          inmate_id: user.id,
          sender_id: user.id,
          recipient_id: user.id, // For self, but actual recipients handled differently
          message: newMessage,
          cost: MESSAGE_COST,
          is_free_message: isFreeMessage
        });

      if (error) throw error;

      // Mark free message as used
      if (isFreeMessage) {
        await supabase
          .from('jail')
          .update({ free_message_used: true })
          .eq('user_id', user.id);
      } else {
        // Deduct minute
        await supabase
          .from('jail')
          .update({ message_minutes_used: (jailData?.message_minutes_used || 0) + 1 })
          .eq('user_id', user.id);
      }

      setNewMessage('');
      fetchInmateMessages();
      toast.success(isFreeMessage ? 'Free message sent!' : 'Message sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const canContact = (targetRole: string) => {
    return targetRole === 'admin' || targetRole === 'lead_troll_officer' || targetRole === 'attorney';
  };

  useEffect(() => {
    if (user && !isJailed) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isJailed, navigate, user]);

  if (!isJailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 text-center border-t-4 border-green-600">
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-green-900/20 p-6 rounded-lg border border-green-900/50">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full animate-ping opacity-20" />
                <div className="absolute w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-xl font-bold text-green-400 mb-2">Sentence Completed!</p>
              <p className="text-gray-300">You have been processed for release.</p>
            </div>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20"
            >
              Return to Society
            </button>
            <p className="text-xs text-gray-500">Redirecting in 3 seconds...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex">
      {/* Main Content - Hidden Sidebar Style */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-red-900/30 border-b border-red-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center border border-red-500/30">
                <Lock className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-red-400 uppercase tracking-widest">Incarcerated</h1>
                <p className="text-gray-400 text-sm">Access to city services suspended</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase">Time Remaining</p>
              <p className="text-2xl font-mono text-red-400">
                {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : 'Calculating...'}
              </p>
            </div>
          </div>
        </div>

        {/* TCNN Live Banner */}
        {tcnnLive && isTcnnPlaying && (
          <div className="bg-purple-900/30 border-b border-purple-500/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <Radio className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-semibold">TCNN Live</span>
                <span className="text-gray-300">{tcnnLive.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTcnnPlaying(!isTcnnPlaying)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isTcnnPlaying ? <X className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => navigate('/tcnn/dashboard')}
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                >
                  View <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Video Player */}
            {tcnnLive.hls_url && (
              <div className="w-full h-48 bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  controls={false}
                  autoPlay
                  muted
                  playsInline
                  src={tcnnLive.hls_url}
                  onError={(e) => {
                    console.error('Video load error:', e);
                    // Fallback to just showing the banner without video
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Jail Info Panel */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4 text-red-400">Sentence Details</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase mb-1">Release Date</p>
                <p className="text-lg font-semibold">
                  {releaseTime ? new Date(releaseTime).toLocaleString() : 'Processing...'}
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase mb-1">Time Remaining</p>
                <p className="text-2xl font-mono text-red-400">
                  {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : 'Calculating...'}
                </p>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-semibold mb-2">Restrictions Apply</p>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Sidebar hidden during incarceration</li>
                  <li>• Only admin, lead officer, attorney contact allowed</li>
                  <li>• Messages cost 10 Troll Coins</li>
                  <li>• Cannot receive images</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2 bg-gray-800/30 border border-gray-700 rounded-xl flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                Inmate Communication
              </h2>
              <span className="text-xs text-gray-500">10 TC per message</span>
            </div>
            
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[400px]">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-xs">Use message minutes to communicate</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.sender_id === user?.id
                        ? 'bg-blue-900/30 border border-blue-500/30 ml-8'
                        : 'bg-gray-700/50 mr-8'
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-1">{msg.sender_username}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Note: Messages can only be sent to admin, lead troll officers, and attorneys who have contacted you first.
                One free message included.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
