import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Mic, MicOff, Settings } from 'lucide-react';
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid';
import { useLiveKitSession } from '../hooks/useLiveKitSession';
import { toast } from 'sonner';

// Generate room name ONCE at module load
const STREAM_ROOM_ID = crypto.randomUUID();
const STREAM_ROOM_NAME = `stream-${STREAM_ROOM_ID}`;

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // ---- IDs (DO NOT CHANGE DURING SESSION)
  const streamUuid = STREAM_ROOM_ID;
  const roomName = STREAM_ROOM_NAME;

  // Freeze LiveKit config inputs to prevent re-renders
  const livekitUser = useMemo(() => {
    if (!user) return null;
    return {
      identity: user.id,
      name: profile?.username || user.email,
      role: 'broadcaster',
    };
  }, [user?.id, profile?.username]);

  // ---- LiveKit session (event-driven) - only when user is available
  const liveKitSession = user ? useLiveKitSession({
    roomName,
    user: livekitUser,
    autoPublish: true,
    maxParticipants: 6,
  }) : {
    joinAndPublish: () => Promise.resolve(false),
    resetJoinGuard: () => {},
    isConnected: false,
    isConnecting: false,
    toggleCamera: () => {},
    toggleMicrophone: () => {},
    localParticipant: null,
    error: null,
  };

  const {
    joinAndPublish,
    resetJoinGuard,
    isConnected,
    isConnecting,
    toggleCamera,
    toggleMicrophone,
    localParticipant,
    error: livekitError,
  } = liveKitSession;

  // ---- UI / Flow State
  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // ---- One-time guards
  const hasCreatedStreamRef = useRef(false);

  // ---- Reset join guard ONCE on mount (StrictMode-safe)
  useEffect(() => {
    resetJoinGuard();
  }, [resetJoinGuard]);

  // ---- Surface REAL LiveKit errors only
  useEffect(() => {
    if (livekitError) {
      const msg = livekitError;
      // Filter transient LiveKit events BEFORE setting state
      if (
        msg.includes('Client initiated disconnect') ||
        msg.includes('websocket closed') ||
        msg.includes('Abort connection')
      ) {
        // transient LiveKit event — NOT an error
        return;
      }
      setConnectionError(msg);
    }
  }, [livekitError]);

  // ---- Default title (safe + idempotent)
  useEffect(() => {
    setStreamTitle(prev =>
      prev.trim()
        ? prev
        : `Live with ${profile?.username || 'broadcaster'}`
    );
  }, [profile?.username]);

  // ---- Start stream (NO throwing on async states)
  const handleStartStream = async () => {
    if (!user?.id || !profile?.id) {
      toast.error('Not ready to stream');
      return;
    }

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title');
      return;
    }

    setHasAttempted(true);
    setIsPublishing(true);
    setConnectionError(null);

    try {
      await joinAndPublish(); // event-driven, do NOT interpret return value
    } catch (err: any) {
      console.error('GoLive: joinAndPublish error:', err);
      const msg = err?.message || '';
      // Filter transient LiveKit events BEFORE setting state
      if (
        msg.includes('Client initiated disconnect') ||
        msg.includes('websocket closed') ||
        msg.includes('Abort connection')
      ) {
        // transient LiveKit event — NOT an error
        return;
      }
      setConnectionError(msg || '🔄 Reconnecting to stream…');
      resetJoinGuard();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReconnect = () => {
    if (!user || !profile) return;
    setConnectionError(null);
    setHasAttempted(true);
    resetJoinGuard();
    handleStartStream();
  };

  // ---- Create DB stream record ONCE after connection succeeds
  useEffect(() => {
    if (!isConnected || !profile?.id) return;
    if (hasCreatedStreamRef.current) return;

    hasCreatedStreamRef.current = true;

    (async () => {
      const { error } = await supabase.from('streams').insert({
        id: streamUuid,
        broadcaster_id: profile.id,
        title: streamTitle,
        room_name: roomName,
        is_live: true,
        status: 'live',
        start_time: new Date().toISOString(),
        viewer_count: 0,
        current_viewers: 0,
        total_gifts_coins: 0,
        popularity: 0,
      });

      if (error) {
        console.error('GoLive: stream insert failed', error);
        hasCreatedStreamRef.current = false;
        toast.error('Failed to create stream');
        return;
      }

      setIsStreaming(true);

      setTimeout(() => {
        navigate(`/stream/${streamUuid}`, { replace: true });
      }, 300);
    })();
  }, [isConnected, profile?.id, streamTitle, roomName, streamUuid, navigate]);

  // ---- Render state resolution
  const isFatalConnectionError =
    connectionError &&
    hasAttempted &&
    !isConnecting &&
    !isConnected;

  const showConnecting =
    isConnecting && !isConnected;

  const showTitleScreen =
    !isConnected && !showConnecting && !isFatalConnectionError && !isStreaming;

  const showLive =
    isConnected || isStreaming;

  let content: React.ReactNode;

  if (showConnecting) {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-lg">Connecting you to LiveKit…</p>
        </div>
      </div>
    );
  } else if (isFatalConnectionError) {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Video className="w-14 h-14 text-red-400 mx-auto" />
          <p className="text-red-400">{connectionError}</p>
          <button
            onClick={handleReconnect}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Retry Go Live
          </button>
        </div>
      </div>
    );
  } else if (showTitleScreen) {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center">Ready to Go Live</h1>
          <input
            value={streamTitle}
            onChange={e => setStreamTitle(e.target.value)}
            className="w-full bg-[#1C1C24] border border-purple-500/40 rounded px-4 py-3"
          />
          <button
            onClick={handleStartStream}
            disabled={isPublishing}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded"
          >
            {isPublishing ? 'Publishing…' : 'Start Streaming'}
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">LIVE: {streamTitle}</h1>
            <div className="flex gap-3">
              <button onClick={toggleCamera}>
                <Video />
              </button>
              <button onClick={toggleMicrophone}>
                {localParticipant?.isMicrophoneEnabled ? <Mic /> : <MicOff />}
              </button>
              <Settings />
            </div>
          </div>
          <div className="w-full h-[70vh] bg-black rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0A0814]">
      {content}

      {/* STABLE LIVEKIT CONTAINER — NEVER UNMOUNT */}
      <div
        className={`absolute inset-0 ${
          showLive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } transition-opacity`}
      >
        <div className="max-w-6xl mx-auto p-6">
          <div className="w-full h-[70vh] bg-black rounded-lg overflow-hidden">
            <LiveKitRoomWrapper
              roomName={roomName}
              user={user}
              className="w-full h-full"
              showLocalVideo
              maxParticipants={6}
              autoPublish={false}
              autoConnect={false}
              role="broadcaster"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
