/**
 * TCNNViewerPage - Cinematic Viewer Experience
 *
 * Full-screen immersive view of a TCNN live broadcast.
 * NOT a dashboard — clean, cinematic, broadcast-style UI.
 * Floating chat, minimal overlays, broadcast feel.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';
import { toast } from 'sonner';
import {
  Radio,
  Eye,
  Heart,
  MessageSquare,
  X,
  Send,
  User,
  ArrowLeft,
  ThumbsUp,
  Sparkles,
  Volume2,
  Maximize,
} from 'lucide-react';
import { generateUUID } from '@/lib/uuid';

interface TCNNStream {
  id: string;
  title: string;
  user_id: string;
  is_live: boolean;
  viewer_count: number;
  total_likes: number;
  agora_channel: string;
  broadcaster?: { username: string; avatar_url: string | null };
}

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system';
}

interface LowerThirdData {
  headline: string;
  subtext: string;
}

export default function TCNNViewerPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // Stream state
  const [stream, setStream] = useState<TCNNStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  // LiveKit
  const roomRef = useRef<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const hasJoinedRef = useRef(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Lower third
  const [lowerThird, setLowerThird] = useState<LowerThirdData>({
    headline: 'BREAKING NEWS',
    subtext: 'TROLL CITY LAUNCHES \u2013 A NEW ERA OF LIVE STREAMING',
  });

  // Ticker
  const tickerText = 'TCNN LIVE \u2022 Virtual City \u2022 Real Creators \u2022 Weekly Cashouts Friday \u2022 Powered by Kain, AI, VS Code';

  // UI state
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Like tracking
  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);

  // Fetch stream
  useEffect(() => {
    if (!streamId) {
      navigate('/tcnn');
      return;
    }

    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id, title, user_id, is_live, viewer_count, total_likes, agora_channel,
          broadcaster:user_profiles!user_id(username, avatar_url)
        `)
        .eq('id', streamId)
        .maybeSingle();

      if (error || !data) {
        toast.error('Stream not found');
        navigate('/tcnn');
        return;
      }

      const broadcaster = Array.isArray(data.broadcaster) ? data.broadcaster[0] : data.broadcaster;
      setStream({
        ...data,
        broadcaster: broadcaster ? { username: broadcaster.username, avatar_url: broadcaster.avatar_url } : undefined,
      });
      setViewerCount(data.current_viewers || data.viewer_count || 0);
      setTotalLikes(data.total_likes || 0);
      setIsLoading(false);

      if (!data.is_live) {
        toast.info('This broadcast has ended');
      }
    };

    fetchStream();
    const interval = setInterval(fetchStream, 15000);
    return () => clearInterval(interval);
  }, [streamId, navigate]);

  // LiveKit connection
  useEffect(() => {
    if (!streamId || !stream || !user || hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    const initLiveKit = async () => {
      try {
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          setRemoteParticipants((prev) => {
            if (prev.find((p) => p.identity === participant.identity)) return prev;
            return [...prev, participant];
          });
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          setRemoteParticipants((prev) => prev.filter((p) => p.identity !== participant.identity));
        });

        room.on(RoomEvent.TrackSubscribed, () => setRemoteParticipants((prev) => [...prev]));
        room.on(RoomEvent.TrackUnsubscribed, () => setRemoteParticipants((prev) => [...prev]));

        const viewerIdentity = `viewer-${user.id}-${Date.now()}`;
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
          body: { room: streamId, userId: viewerIdentity, role: 'viewer' },
        });

        if (tokenError || !tokenData?.token) {
          console.error('[TCNNViewer] Token error:', tokenError);
          return;
        }

        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        if (!livekitUrl) return;

        await room.connect(livekitUrl, tokenData.token, { name: streamId, identity: viewerIdentity });
        const existing = Array.from(room.remoteParticipants.values());
        setRemoteParticipants(existing);
      } catch (err) {
        console.error('[TCNNViewer] LiveKit error:', err);
      }
    };

    initLiveKit();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(console.error);
        roomRef.current = null;
      }
      hasJoinedRef.current = false;
    };
  }, [streamId, stream?.user_id, user?.id]);

  // Realtime channel for chat, likes, presence
  useEffect(() => {
    if (!streamId || !user) return;

    const channel = supabase.channel(`stream:${streamId}`);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let total = 0;
        for (const [, users] of Object.entries(state)) total += (users as any[]).length;
        setViewerCount(total);
      })
      .on('broadcast', { event: 'like_sent' }, (payload) => {
        if (payload.payload?.total_likes !== undefined) {
          setTotalLikes(payload.payload.total_likes);
        }
      })
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        if (msg) setMessages((prev) => [...prev.slice(-199), msg]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          channel.track({
            user_id: user.id,
            username: profile?.username || 'Viewer',
            is_host: false,
            is_viewer: true,
            online_at: new Date().toISOString(),
            avatar_url: profile?.avatar_url || '',
          }).catch(console.error);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, user?.id, profile]);

  // Auto-hide controls
  useEffect(() => {
    const showControls = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
    };

    window.addEventListener('mousemove', showControls);
    showControls();

    return () => {
      window.removeEventListener('mousemove', showControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Like handler
  const handleLike = useCallback(async () => {
    if (!user || !stream) return;

    if (isClickBlocked) {
      toast.error('Clicking too fast! Please wait.');
      return;
    }

    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter((t) => now - t < 2000);
    clickHistoryRef.current.push(now);

    if (clickHistoryRef.current.length > 5) {
      setIsClickBlocked(true);
      toast.error('Too many clicks! Blocked for 30 seconds.');
      setTimeout(() => {
        setIsClickBlocked(false);
        clickHistoryRef.current = [];
      }, 30000);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: stream.id }),
      });

      const result = await response.json();
      if (response.ok) {
        setTotalLikes(result.total_likes);
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'like_sent',
            payload: { user_id: user.id, stream_id: stream.id, total_likes: result.total_likes },
          }).catch(console.error);
        }
      }
    } catch {
      toast.error('Failed to like');
    }
  }, [user, stream, isClickBlocked]);

  // Send chat
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !user || !streamId) return;
    const msg: ChatMessage = {
      id: generateUUID(),
      user_id: user.id,
      username: profile?.username || 'Viewer',
      avatar_url: profile?.avatar_url || '',
      content: chatInput.trim(),
      created_at: new Date().toISOString(),
      type: 'chat',
    };
    setChatInput('');

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg,
      }).catch(console.error);
    }
  }, [chatInput, user, profile, streamId]);

  // Get video track
  const getVideoTrack = (participant: RemoteParticipant) => {
    const videoPub = Array.from(participant.videoTrackPublications.values()).find((p) => p.isSubscribed && p.track);
    return videoPub?.track;
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#060a14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/50">Loading TCNN Broadcast...</p>
        </div>
      </div>
    );
  }

  if (!stream) return null;

  return (
    <div className="h-screen w-full bg-[#060a14] text-white overflow-hidden relative">
      {/* ============ FULL SCREEN VIDEO ============ */}
      <div className="absolute inset-0 z-0">
        {remoteParticipants.length > 0 ? (
          remoteParticipants.map((participant) => {
            const videoTrack = getVideoTrack(participant);
            return (
              <div key={participant.identity} className="absolute inset-0">
                {videoTrack ? (
                  <div
                    ref={(el) => {
                      if (el && videoTrack) {
                        const mediaElement = (videoTrack as any).attach?.();
                        if (mediaElement && el.firstChild === null) {
                          mediaElement.style.width = '100%';
                          mediaElement.style.height = '100%';
                          mediaElement.style.objectFit = 'cover';
                          el.appendChild(mediaElement);
                        }
                      }
                    }}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0a0e1a] via-[#0d1528] to-[#080c16] flex items-center justify-center">
                    <div className="text-center">
                      <Radio className="w-16 h-16 text-red-500/30 mx-auto mb-4" />
                      <p className="text-white/40">Waiting for broadcast...</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0a0e1a] via-[#0d1528] to-[#080c16] flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">Connecting to TCNN broadcast...</p>
            </div>
          </div>
        )}
      </div>

      {/* ============ TOP BAR ============ */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-all duration-500 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
        }`}
      >
        <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/tcnn')}
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition-all backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Radio className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold tracking-wide">TCNN</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">Live</p>
                </div>
              </div>
            </div>

            {/* Center: LIVE badge + viewer count */}
            <div className="flex items-center gap-3">
              {stream.is_live && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 shadow-lg shadow-red-500/30">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">LIVE</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
                <Eye className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-medium">{viewerCount.toLocaleString()}</span>
              </div>
            </div>

            {/* Right: Chat toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`p-2 rounded-xl transition-all backdrop-blur-sm ${
                  chatOpen ? 'bg-cyan-600/20 text-cyan-300' : 'bg-white/[0.06] text-white/60 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const el = document.documentElement;
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    el.requestFullscreen?.();
                  }
                }}
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition-all backdrop-blur-sm"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ LOWER THIRD ============ */}
      <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 z-20 pointer-events-none" style={{ right: chatOpen ? '320px' : '0' }}>
        <div className="mx-4 sm:mx-8 max-w-2xl">
          <div className="bg-gradient-to-r from-red-600/95 via-red-700/90 to-red-600/80 backdrop-blur-sm px-4 py-1.5 rounded-t-lg">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white">{lowerThird.headline}</p>
          </div>
          <div className="bg-gradient-to-r from-black/80 via-[#0d1528]/80 to-black/70 backdrop-blur-sm px-4 py-2.5 rounded-b-lg border-t border-cyan-500/20">
            <p className="text-sm sm:text-base font-medium text-white/90">{lowerThird.subtext}</p>
          </div>
        </div>
      </div>

      {/* ============ SCROLLING TICKER ============ */}
      <div className="absolute bottom-14 sm:bottom-16 left-0 right-0 z-20 pointer-events-none" style={{ right: chatOpen ? '320px' : '0' }}>
        <div className="bg-gradient-to-r from-black/90 via-[#0a0f1e]/90 to-black/80 backdrop-blur-sm border-t border-white/[0.06] overflow-hidden">
          <div className="flex items-center h-7">
            <div className="flex-shrink-0 px-3 bg-red-600/90 h-full flex items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider">TCNN</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee whitespace-nowrap">
                <span className="text-[11px] text-white/60 inline-block px-4">
                  {tickerText} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {tickerText} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {tickerText}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM CONTROLS ============ */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-500 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
        }`}
        style={{ right: chatOpen ? '320px' : '0' }}
      >
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-4xl">
            {/* Stream info */}
            <div className="flex items-center gap-3 min-w-0">
              {stream.broadcaster?.avatar_url ? (
                <img src={stream.broadcaster.avatar_url} alt="" className="w-10 h-10 rounded-full border-2 border-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-white/40" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{stream.broadcaster?.username || 'TCNN Anchor'}</p>
                <p className="text-[11px] text-white/50 truncate">{stream.title || 'TCNN Live Broadcast'}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                disabled={isClickBlocked}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-pink-500/20 backdrop-blur-sm border border-white/[0.08] hover:border-pink-500/30 text-white/80 hover:text-pink-300 transition-all disabled:opacity-40"
              >
                <Heart className="w-4 h-4" />
                <span className="text-xs font-medium">{totalLikes > 0 ? totalLikes.toLocaleString() : 'Like'}</span>
              </button>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-cyan-500/20 backdrop-blur-sm border border-white/[0.08] hover:border-cyan-500/30 text-white/80 hover:text-cyan-300 transition-all sm:hidden"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ FLOATING CHAT ============ */}
      {chatOpen && (
        <div className="absolute top-0 right-0 bottom-0 w-[320px] z-40 flex flex-col bg-gradient-to-b from-[#0a0f1e]/95 via-[#0a0f1e]/90 to-[#060a14]/95 backdrop-blur-xl border-l border-white/[0.06]">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold">Live Chat</h3>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats bar */}
          <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px] font-medium">{viewerCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-3 h-3 text-red-400" />
              <span className="text-[11px] font-medium">{totalLikes}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">Chat messages appear here</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2">
                {msg.avatar_url ? (
                  <img src={msg.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-cyan-400 font-medium">{msg.username} </span>
                  <span className="text-xs text-white/80 break-words">{msg.content}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Send a message..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:border-cyan-500/40 focus:outline-none"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 disabled:opacity-30 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="w-full py-2 rounded-lg bg-cyan-600/20 text-cyan-300 text-xs font-medium hover:bg-cyan-600/30 transition-all"
              >
                Sign in to chat
              </button>
            )}
          </div>
        </div>
      )}

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
