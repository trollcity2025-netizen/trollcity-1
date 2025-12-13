import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Mic, MicOff, Settings } from 'lucide-react';
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid';
import { toast } from 'sonner';

const isTransientLiveKitMsg = (msg?: string) => {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('client initiated disconnect') ||
    m.includes('websocket closed') ||
    m.includes('abort connection') ||
    m.includes('connection was interrupted') ||
    m.includes('code: 1006')
  );
};

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // 🔒 Stable IDs for the entire component lifetime (StrictMode-safe)
  const streamUuidRef = useRef<string>(crypto.randomUUID()); // DB UUID
  const roomNameRef = useRef<string>(`stream-${streamUuidRef.current}`); // LiveKit room

  const streamUuid = streamUuidRef.current;
  const roomName = roomNameRef.current;

  // UI state
  const [streamTitle, setStreamTitle] = useState('');
  const [isLiveRequested, setIsLiveRequested] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // basic UI toggles (visual only unless you wire to wrapper controls)
  const [uiMicEnabled, setUiMicEnabled] = useState(true);
  const [uiCamEnabled, setUiCamEnabled] = useState(true);

  // connection UX
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // Guards
  const hasCreatedStreamRef = useRef(false);
  const navigateOnceRef = useRef(false);

  // Default title
  useEffect(() => {
    setStreamTitle((prev) =>
      prev.trim() ? prev : `Live with ${profile?.username || 'broadcaster'}`
    );
  }, [profile?.username]);

  const handleStartStream = () => {
    if (!user?.id || !profile?.id) {
      toast.error('Not ready to stream');
      return;
    }
    if (!streamTitle.trim()) {
      toast.error('Enter a stream title');
      return;
    }

    setHasAttempted(true);
    setConnectionError(null);
    setIsLiveRequested(true);
  };

  const handleBackToTitle = () => {
    setConnectionError(null);
    setIsLiveRequested(false);
    setHasAttempted(false);
    // Allow DB retry if they come back in
    hasCreatedStreamRef.current = false;
    navigateOnceRef.current = false;
  };

  const handleRetry = () => {
    setConnectionError(null);
    setHasAttempted(true);
    setIsLiveRequested(true);
  };

  // Create DB stream once after going live is requested.
  // We do NOT wait on LiveKit events here (Wrapper owns that) — we just create the stream record.
  useEffect(() => {
    if (!isLiveRequested) return;
    if (!profile?.id) return;
    if (hasCreatedStreamRef.current) return;

    hasCreatedStreamRef.current = true;
    setIsCreating(true);

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
        setConnectionError('Failed to create stream record');
        toast.error('Failed to create stream');
        return;
      }

      // Navigate once to the stream page (viewer/broadcaster room)
      if (!navigateOnceRef.current) {
        navigateOnceRef.current = true;
        setTimeout(() => {
          navigate(`/stream/${streamUuid}`, { replace: true });
        }, 300);
      }
    })().finally(() => setIsCreating(false));
  }, [isLiveRequested, profile?.id, streamTitle, roomName, streamUuid, navigate]);

  // Decide what to render
  const showTitleScreen = !isLiveRequested;

  // "Fatal" error screen should only show if it's not transient AND user tried
  const showErrorScreen =
    !!connectionError && hasAttempted && !isTransientLiveKitMsg(connectionError);

  // -------------------- UI --------------------

  let content: React.ReactNode;

  if (showTitleScreen) {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <Video className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold">Ready to Go Live</h1>
            <p className="text-gray-400 mt-2">Enter a title, then start streaming</p>
          </div>

          <input
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            className="w-full bg-[#1C1C24] border border-purple-500/40 rounded px-4 py-3"
            placeholder="Stream title"
            autoFocus
          />

          <button
            onClick={handleStartStream}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded text-white font-semibold"
          >
            Start Streaming
          </button>
        </div>
      </div>
    );
  } else if (showErrorScreen) {
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Video className="w-14 h-14 text-red-400 mx-auto" />
          <h2 className="text-2xl font-bold">Connection issue</h2>
          <p className="text-gray-300 text-sm">{connectionError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
            >
              Retry
            </button>
            <button
              onClick={handleBackToTitle}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    // Live view
    content = (
      <div className="min-h-screen bg-[#0A0814] text-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <h1 className="text-2xl font-bold">LIVE: {streamTitle}</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* These are UI toggles.
                  If your LiveKitRoomWrapper exposes real toggles, wire them here. */}
              <button
                onClick={() => setUiCamEnabled((v) => !v)}
                className={`p-2 rounded-lg ${
                  uiCamEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } transition-colors`}
                title={uiCamEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                <Video className="w-5 h-5" />
              </button>

              <button
                onClick={() => setUiMicEnabled((v) => !v)}
                className={`p-2 rounded-lg ${
                  uiMicEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } transition-colors`}
                title={uiMicEnabled ? 'Turn off mic' : 'Turn on mic'}
              >
                {uiMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="w-full h-[70vh] bg-black rounded-lg overflow-hidden">
            {/* ✅ SINGLE CONNECTION OWNER (no useLiveKitSession here) */}
            <LiveKitRoomWrapper
              roomName={roomName}
              user={user}
              role="broadcaster"
              showLocalVideo
              maxParticipants={6}
              autoConnect={true}
              autoPublish={true}
              className="w-full h-full"
              // If your wrapper supports these props, uncomment:
              // initialMicEnabled={uiMicEnabled}
              // initialCamEnabled={uiCamEnabled}
            />
          </div>

          <div className="mt-4 text-sm text-gray-400 flex items-center justify-between">
            <span>Room: {roomName}</span>
            <span>Stream ID: {streamUuid}</span>
          </div>

          {isCreating && (
            <div className="mt-4 text-sm text-gray-400">
              Finalizing stream…
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-[#0A0814]">{content}</div>;
};

export default GoLive;
