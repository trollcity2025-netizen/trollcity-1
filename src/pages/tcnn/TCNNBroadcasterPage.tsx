/**
 * TCNNBroadcasterPage - Studio Control View
 *
 * Full TCNN broadcast studio for News Casters.
 * Left sidebar with controls, center virtual studio canvas, right chat panel.
 * Uses MediaPipe Selfie Segmentation for real-time background removal.
 * Handles both fresh start (no streamId) and redirect from SetupPage (existing streamId).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Room, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { toast } from 'sonner';
import {
  Radio,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Play,
  Square,
  MessageSquare,
  Eye,
  Heart,
  Sparkles,
  Building2,
  Mountain,
  Droplets,
  Volume2,
  Monitor,
  Layout,
  ChevronDown,
  X,
  Send,
  User,
  Loader2,
} from 'lucide-react';
import TCNNVirtualStudio, { TCNNVirtualStudioHandle, BackgroundMode } from '@/components/tcnn/TCNNVirtualStudio';
import { generateUUID } from '@/lib/uuid';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system' | 'gift';
}

interface LowerThird {
  headline: string;
  subtext: string;
  visible: boolean;
}

export default function TCNNBroadcasterPage() {
  const navigate = useNavigate();
  const { streamId: paramStreamId } = useParams();
  const { user, profile } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster, hasAnyRole } = useTCNNRoles(user?.id);

  // Studio refs
  const studioRef = useRef<TCNNVirtualStudioHandle>(null);
  const roomRef = useRef<Room | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const autoConnectAttempted = useRef(false);

  // Stream state
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(paramStreamId || null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  // Controls state
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('newsroom');
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Audio levels
  const [micLevel, setMicLevel] = useState(0);
  const [desktopLevel, setDesktopLevel] = useState(0);

  // Lower third
  const [lowerThird, setLowerThird] = useState<LowerThird>({
    headline: 'BREAKING NEWS',
    subtext: 'TROLL CITY LAUNCHES \u2013 A NEW ERA OF LIVE STREAMING',
    visible: true,
  });
  const [showLowerThirdEditor, setShowLowerThirdEditor] = useState(false);
  const [editHeadline, setEditHeadline] = useState(lowerThird.headline);
  const [editSubtext, setEditSubtext] = useState(lowerThird.subtext);

  // Ticker
  const tickerText = 'TCNN LIVE \u2022 Virtual City \u2022 Real Creators \u2022 Weekly Cashouts Friday \u2022 Powered by Kain, AI, VS Code';

  // Chat
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // FPS
  const [fps, setFps] = useState(0);

  // Access check
  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth?mode=signup');
      return;
    }
    if (!isNewsCaster && !isChiefNewsCaster && !(profile.role === 'admin' || profile.is_admin)) {
      toast.error('Access denied: TCNN broadcast requires News Caster role');
      navigate('/tcnn');
    }
  }, [user, profile, isNewsCaster, isChiefNewsCaster, navigate]);

  // Audio level metering
  useEffect(() => {
    if (!isLive) return;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    let meterStream: MediaStream | null = null;

    const startMetering = async () => {
      try {
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        meterStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(meterStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, (avg / 128) * 100));
          raf = requestAnimationFrame(update);
        };
        update();
      } catch {
        // Silently fail if audio metering not available
      }
    };

    startMetering();
    return () => {
      cancelAnimationFrame(raf);
      audioCtx?.close();
      meterStream?.getTracks().forEach(t => t.stop());
    };
  }, [isLive]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Core: Connect to an EXISTING stream (from SetupPage redirect)
  const connectToExistingStream = useCallback(async (targetStreamId: string) => {
    if (!user || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    setIsAutoConnecting(true);

    try {
      // Verify the stream exists and is live
      const { data: existingStream, error: fetchError } = await supabase
        .from('streams')
        .select('id, user_id, agora_channel, is_live, status, title')
        .eq('id', targetStreamId)
        .maybeSingle();

      if (fetchError || !existingStream) {
        throw new Error('Stream not found');
      }

      // Verify this user owns the stream
      if (existingStream.user_id !== user.id) {
        throw new Error('You are not the owner of this stream');
      }

      console.log('[TCNNBroadcaster] Connecting to existing stream:', targetStreamId);
      setStreamId(targetStreamId);

      // Connect to LiveKit room
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: { room: targetStreamId, userId: user.id, role: 'publisher' },
      });

      if (tokenError || !tokenData?.token) {
        throw new Error('Failed to get LiveKit token');
      }

      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) throw new Error('LiveKit URL not configured');

      await room.connect(livekitUrl, tokenData.token, {
        name: targetStreamId,
        identity: user.id,
      });
      console.log('[TCNNBroadcaster] Connected to LiveKit room');

      // Start virtual studio
      await studioRef.current?.start();

      // Publish composite video from virtual studio
      const compositeStream = studioRef.current?.getCompositeStream();
      if (compositeStream) {
        const videoTracks = compositeStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = new LocalVideoTrack(videoTracks[0]);
          await room.localParticipant.publishTrack(videoTrack);
          console.log('[TCNNBroadcaster] Published composite video track');
        }
      }

      // Publish audio
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const audioTrack = new LocalAudioTrack(audioStream.getAudioTracks()[0]);
        localAudioTrackRef.current = audioTrack;
        await room.localParticipant.publishTrack(audioTrack);
        console.log('[TCNNBroadcaster] Published audio track');
      } catch (audioErr) {
        console.warn('[TCNNBroadcaster] Audio publish failed:', audioErr);
      }

      // Ensure stream is marked as live
      if (!existingStream.is_live) {
        await supabase.from('streams').update({
          status: 'live',
          is_live: true,
          started_at: new Date().toISOString(),
        }).eq('id', targetStreamId);
      }

      // Set up realtime channel
      setupRealtimeChannel(targetStreamId);

      setIsLive(true);
      toast.success('TCNN Studio connected!');
    } catch (err: any) {
      console.error('[TCNNBroadcaster] Auto-connect error:', err);
      toast.error(err?.message || 'Failed to connect to stream');
      autoConnectAttempted.current = false;
    } finally {
      setIsAutoConnecting(false);
    }
  }, [user]);

  // Set up realtime channel for chat/presence/likes
  const setupRealtimeChannel = useCallback((targetStreamId: string) => {
    const channel = supabase.channel(`stream:${targetStreamId}`);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let total = 0;
        for (const [, users] of Object.entries(state)) total += (users as any[]).length;
        setViewerCount(total);
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState();
        let total = 0;
        for (const [, users] of Object.entries(state)) total += (users as any[]).length;
        setViewerCount(total);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState();
        let total = 0;
        for (const [, users] of Object.entries(state)) total += (users as any[]).length;
        setViewerCount(Math.max(0, total));
      })
      .on('broadcast', { event: 'like_sent' }, (payload) => {
        if (payload.payload?.total_likes !== undefined) {
          setTotalLikes(payload.payload.total_likes);
        }
      })
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        if (msg) setMessages((prev) => [...prev.slice(-99), msg]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          if (user) {
            await channel.track({
              user_id: user.id,
              username: profile?.username || 'TCNN',
              is_host: true,
              online_at: new Date().toISOString(),
              avatar_url: profile?.avatar_url || '',
            }).catch(console.error);
          }
        }
      });
  }, [user, profile]);

  // AUTO-CONNECT: When arriving from SetupPage with an existing streamId
  useEffect(() => {
    if (paramStreamId && user && !isLive && !autoConnectAttempted.current) {
      connectToExistingStream(paramStreamId);
    }
  }, [paramStreamId, user, isLive, connectToExistingStream]);

  // Go Live (fresh start - no existing stream)
  const handleGoLive = useCallback(async () => {
    if (!user || isStarting) return;
    setIsStarting(true);

    try {
      const newStreamId = generateUUID();

      // Create stream record
      const { error: insertError } = await supabase.from('streams').insert({
        id: newStreamId,
        user_id: user.id,
        title: `${profile?.username || 'TCNN'} - Live Broadcast`,
        category: 'tcnn',
        status: 'live',
        is_live: true,
        started_at: new Date().toISOString(),
        agora_channel: newStreamId,
        box_count: 1,
        layout_mode: 'grid',
        is_protected: false,
        battle_enabled: false,
      });

      if (insertError) throw insertError;

      // Create RTC session
      await supabase.from('rtc_sessions').insert({
        user_id: user.id,
        room_name: `stream-${newStreamId}`,
        started_at: new Date().toISOString(),
        is_active: true,
        duration_seconds: 0,
      });

      setStreamId(newStreamId);

      // Connect to LiveKit
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: { room: newStreamId, userId: user.id, role: 'publisher' },
      });

      if (tokenError || !tokenData?.token) throw new Error('Failed to get LiveKit token');

      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) throw new Error('LiveKit URL not configured');

      await room.connect(livekitUrl, tokenData.token, { name: newStreamId, identity: user.id });

      // Start virtual studio
      await studioRef.current?.start();

      // Publish composite video from virtual studio
      const compositeStream = studioRef.current?.getCompositeStream();
      if (compositeStream) {
        const videoTracks = compositeStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = new LocalVideoTrack(videoTracks[0]);
          await room.localParticipant.publishTrack(videoTrack);
        }
      }

      // Publish audio
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const audioTrack = new LocalAudioTrack(audioStream.getAudioTracks()[0]);
        localAudioTrackRef.current = audioTrack;
        await room.localParticipant.publishTrack(audioTrack);
      } catch (audioErr) {
        console.warn('[TCNNBroadcaster] Audio publish failed:', audioErr);
      }

      // Set up realtime channel
      setupRealtimeChannel(newStreamId);

      setIsLive(true);
      toast.success('TCNN is now LIVE!');
    } catch (err: any) {
      console.error('[TCNNBroadcaster] Go live error:', err);
      toast.error(err?.message || 'Failed to go live');
    } finally {
      setIsStarting(false);
    }
  }, [user, profile, isStarting, setupRealtimeChannel]);

  // End broadcast
  const handleEndBroadcast = useCallback(async () => {
    try {
      if (streamId) {
        await supabase.from('streams').update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString(),
        }).eq('id', streamId);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (roomRef.current) {
        roomRef.current.disconnect().catch(console.error);
        roomRef.current = null;
      }

      studioRef.current?.stop();
      setIsLive(false);
      setViewerCount(0);
      toast.success('Broadcast ended');
    } catch (err: any) {
      toast.error('Error ending broadcast');
    }
  }, [streamId]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (localAudioTrackRef.current) {
      if (micEnabled) {
        localAudioTrackRef.current.mute();
      } else {
        localAudioTrackRef.current.unmute();
      }
    }
    setMicEnabled(!micEnabled);
  }, [micEnabled]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    setCameraEnabled(!cameraEnabled);
  }, [cameraEnabled]);

  // Send chat message
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !user || !streamId) return;
    const msg: ChatMessage = {
      id: generateUUID(),
      user_id: user.id,
      username: profile?.username || 'TCNN Anchor',
      avatar_url: profile?.avatar_url || '',
      content: chatInput.trim(),
      created_at: new Date().toISOString(),
      type: 'chat',
    };
    setMessages((prev) => [...prev.slice(-99), msg]);
    setChatInput('');

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg,
      }).catch(console.error);
    }
  }, [chatInput, user, profile, streamId]);

  // Save lower third
  const saveLowerThird = () => {
    setLowerThird({ headline: editHeadline, subtext: editSubtext, visible: true });
    setShowLowerThirdEditor(false);
  };

  // Change background
  const changeBackground = (mode: BackgroundMode) => {
    setBackgroundMode(mode);
    studioRef.current?.setBackgroundMode(mode);
    setShowBgPicker(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(console.error);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  if (!hasAnyRole && !profile?.is_admin && profile?.role !== 'admin') {
    return null;
  }

  const bgOptions: { mode: BackgroundMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'newsroom', label: 'TCNN Newsroom', icon: <Building2 className="w-4 h-4" /> },
    { mode: 'cityscape', label: 'City Skyline', icon: <Mountain className="w-4 h-4" /> },
    { mode: 'blur', label: 'Blur Background', icon: <Droplets className="w-4 h-4" /> },
  ];

  // Show loading spinner while auto-connecting from SetupPage
  if (isAutoConnecting) {
    return (
      <div className="h-screen w-full bg-[#060a14] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/60">Connecting to TCNN Studio...</p>
          <p className="text-xs text-white/30 mt-1">Initializing LiveKit &amp; Virtual Studio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#060a14] text-white flex overflow-hidden select-none">
      {/* ============ LEFT SIDEBAR ============ */}
      <aside className="w-[260px] flex-shrink-0 bg-[#0a0f1e]/95 border-r border-white/[0.06] flex flex-col backdrop-blur-xl">
        {/* Logo */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">TCNN</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Studio Control</p>
            </div>
          </div>
        </div>

        {/* On Air Status */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isLive ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-white/20'}`} />
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-red-400' : 'text-white/40'}`}>
                {isLive ? "You're On Air" : 'Offline'}
              </p>
              {isLive && (
                <p className="text-[10px] text-white/40">{viewerCount} viewers</p>
              )}
            </div>
          </div>
        </div>

        {/* Broadcast Controls */}
        <div className="p-4 border-b border-white/[0.06] space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Controls</h3>

          {!isLive ? (
            <button
              onClick={handleGoLive}
              disabled={isStarting || isAutoConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isStarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" fill="currentColor" />
              )}
              {isStarting ? 'Starting...' : 'Go Live'}
            </button>
          ) : (
            <button
              onClick={handleEndBroadcast}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.08] hover:border-red-500/30 text-white/80 hover:text-red-400 font-medium text-sm transition-all"
            >
              <Square className="w-4 h-4" />
              End Broadcast
            </button>
          )}

          {/* Mic / Camera toggles */}
          <div className="flex gap-2">
            <button
              onClick={toggleMic}
              disabled={!isLive}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                micEnabled
                  ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {micEnabled ? 'Mic' : 'Muted'}
            </button>
            <button
              onClick={toggleCamera}
              disabled={!isLive}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                cameraEnabled
                  ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              {cameraEnabled ? 'Cam' : 'Off'}
            </button>
          </div>
        </div>

        {/* Background Selector */}
        <div className="p-4 border-b border-white/[0.06]">
          <h3 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Background</h3>
          <div className="space-y-1.5">
            {bgOptions.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => changeBackground(mode)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  backgroundMode === mode
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70 border border-transparent'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Audio Levels */}
        {isLive && (
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Audio Levels</h3>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">Microphone</span>
                  <Volume2 className="w-3 h-3 text-white/30" />
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${micLevel}%`,
                      background: micLevel > 80 ? '#ef4444' : micLevel > 50 ? '#f59e0b' : '#06b6d4',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">Desktop</span>
                  <Monitor className="w-3 h-3 text-white/30" />
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-75"
                    style={{ width: `${desktopLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lower Third Editor */}
        <div className="p-4 flex-1">
          <h3 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">Lower Third</h3>
          <button
            onClick={() => setShowLowerThirdEditor(!showLowerThirdEditor)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70 text-xs font-medium transition-all border border-white/[0.06]"
          >
            <span className="flex items-center gap-2">
              <Layout className="w-3.5 h-3.5" />
              Edit Banner
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLowerThirdEditor ? 'rotate-180' : ''}`} />
          </button>

          {showLowerThirdEditor && (
            <div className="mt-2 space-y-2">
              <input
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                placeholder="Headline"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:border-cyan-500/40 focus:outline-none"
              />
              <input
                value={editSubtext}
                onChange={(e) => setEditSubtext(e.target.value)}
                placeholder="Subtext"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:border-cyan-500/40 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveLowerThird}
                  className="flex-1 px-3 py-2 rounded-lg bg-cyan-600/20 text-cyan-300 text-xs font-medium hover:bg-cyan-600/30 transition-all"
                >
                  Apply
                </button>
                <button
                  onClick={() => setLowerThird((p) => ({ ...p, visible: !p.visible }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    lowerThird.visible ? 'bg-white/[0.06] text-white/60' : 'bg-white/[0.03] text-white/30'
                  }`}
                >
                  {lowerThird.visible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Studio info footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/20 text-center">FPS: {fps} | {backgroundMode}</p>
        </div>
      </aside>

      {/* ============ CENTER - VIRTUAL STUDIO ============ */}
      <main className="flex-1 flex flex-col relative bg-black min-w-0">
        {/* Top bar - LIVE badge + stats */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            {isLive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 shadow-lg shadow-red-500/30">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider">LIVE</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
              <Eye className="w-3.5 h-3.5 text-white/60" />
              <span className="text-xs font-medium text-white/80">{viewerCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
              <Heart className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-medium text-white/80">{totalLikes}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
              <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">TCNN Studio</span>
            </div>
          </div>
        </div>

        {/* Virtual Studio Canvas */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-[1280px] max-h-[720px] aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/[0.06]">
            <TCNNVirtualStudio
              ref={studioRef}
              width={1280}
              height={720}
              backgroundMode={backgroundMode}
              onFpsUpdate={setFps}
              className="w-full h-full"
            />

            {/* Lower Third Overlay */}
            {lowerThird.visible && isLive && (
              <div className="absolute bottom-16 left-0 right-0 z-20 pointer-events-none">
                <div className="mx-8">
                  <div className="bg-gradient-to-r from-red-600/95 via-red-700/95 to-red-600/95 backdrop-blur-sm px-4 py-1.5 rounded-t-lg shadow-lg">
                    <p className="text-xs font-bold uppercase tracking-wider text-white">{lowerThird.headline}</p>
                  </div>
                  <div className="bg-gradient-to-r from-[#0a0f1e]/90 via-[#0d1528]/90 to-[#0a0f1e]/90 backdrop-blur-sm px-4 py-2 rounded-b-lg border-t border-cyan-500/20 shadow-lg">
                    <p className="text-sm font-medium text-white/90">{lowerThird.subtext}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scrolling Ticker */}
            {isLive && (
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-r from-[#0a0f1e]/95 via-[#0d1528]/95 to-[#0a0f1e]/95 backdrop-blur-sm border-t border-white/[0.06] overflow-hidden pointer-events-none">
                <div className="flex items-center h-8">
                  <div className="flex-shrink-0 px-3 bg-red-600/90 h-full flex items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider">TCNN</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="animate-marquee whitespace-nowrap">
                      <span className="text-xs text-white/70 inline-block px-4">
                        {tickerText} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {tickerText} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {tickerText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Camera off overlay */}
            {!cameraEnabled && (
              <div className="absolute inset-0 z-10 bg-[#0a0f1e]/80 flex items-center justify-center">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Camera Off</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ============ RIGHT PANEL - CHAT ============ */}
      <aside className={`w-[300px] flex-shrink-0 bg-[#0a0f1e]/95 border-l border-white/[0.06] flex flex-col backdrop-blur-xl transition-all duration-300 ${chatOpen ? '' : 'w-0 overflow-hidden border-0'}`}>
        {/* Chat header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold">Live Chat</h2>
          </div>
          <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewer stats */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium">{viewerCount}</span>
            <span className="text-[10px] text-white/40">viewers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium">{totalLikes}</span>
            <span className="text-[10px] text-white/40">likes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] text-white/40">reactions</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/30">Chat will appear here when viewers send messages</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2 group">
              {msg.avatar_url ? (
                <img src={msg.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-white/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-cyan-400 font-medium truncate">{msg.username}</p>
                <p className="text-xs text-white/80 break-words">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/[0.06]">
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
        </div>
      </aside>

      {/* Chat toggle when closed */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute right-4 top-4 z-40 p-2.5 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
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
