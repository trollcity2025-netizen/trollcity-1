import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video, Mic, MicOff, Settings } from 'lucide-react';
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid';
import { useLiveKit } from '../contexts/LiveKitContext';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { isConnected, isConnecting, toggleCamera, toggleMicrophone, localParticipant, connect } = useLiveKit();

  const [streamTitle, setStreamTitle] = useState('');
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // IMMEDIATE UI RENDER: Set up room name immediately, connect asynchronously
  useEffect(() => {
    if (!user || !profile || streamId) return;

    const roomName = `stream-${crypto.randomUUID()}`;
    setStreamId(roomName);

    console.log('🎥 GoLive: Setting up room:', roomName);

    // Connect asynchronously - DO NOT block UI render
    connect(roomName, { ...user, role: 'broadcaster' }, { autoPublish: false }).catch(error => {
      console.error('❌ GoLive: Connection failed, but UI continues:', error);
      // Connection failure should not prevent UI from rendering
    });
  }, [user, profile, connect]);

  // Start stream when connected
  useEffect(() => {
    if (isConnected && streamId && !isStreaming && streamTitle.trim()) {
      handleStartStream();
    }
  }, [isConnected, streamId, isStreaming, streamTitle]);

  const handleStartStream = async () => {
    if (!user || !profile || !streamId) {
      toast.error('Not ready to stream');
      return;
    }

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title');
      return;
    }

    try {
      console.log('🎥 GoLive: Starting stream...');

      // Insert into streams table
      const { error: insertError } = await supabase.from('streams').insert({
        id: streamId,
        broadcaster_id: profile.id,
        title: streamTitle,
        room_name: streamId,
        is_live: true,
        status: 'live',
        start_time: new Date().toISOString(),
        thumbnail_url: null,
        is_testing_mode: false,
        viewer_count: 0,
        current_viewers: 0,
        total_gifts_coins: 0,
        popularity: 0,
      });

      if (insertError) {
        console.error('❌ GoLive: Failed to create stream record:', insertError);
        toast.error('Failed to start stream');
        return;
      }

      console.log('✅ GoLive: Stream record created');
      setIsStreaming(true);

      // Navigate to stream room after a brief delay
      setTimeout(() => {
        navigate(`/stream/${streamId}`, { replace: true });
      }, 1000);

    } catch (error) {
      console.error('❌ GoLive: Error starting stream:', error);
      toast.error('Error starting stream');
    }
  };

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (streamTitle.trim()) {
      handleStartStream();
    }
  };

  // UI renders immediately - no blocking on media access
  // Show title input form as soon as we have a streamId
  if (!streamId) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Setting up your stream...</p>
        </div>
      </div>
    );
  }

  // Show title input form immediately once we have streamId
  if (!streamTitle.trim()) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Video className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Ready to Go Live</h1>
            <p className="text-gray-400">Enter your stream title to start broadcasting</p>
          </div>

          <form onSubmit={handleTitleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stream Title *
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="What's your stream about?"
                className="w-full bg-[#1C1C24] border border-purple-500/40 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!streamTitle.trim()}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Streaming
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If streaming, show the live interface
  if (isStreaming) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white">
        <div className="max-w-6xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <h1 className="text-2xl font-bold">LIVE: {streamTitle}</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Camera Toggle */}
              <button
                onClick={toggleCamera}
                className={`p-2 rounded-lg ${localParticipant?.isCameraEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} transition-colors`}
                title={localParticipant?.isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                <Video className="w-5 h-5" />
              </button>

              {/* Mic Toggle */}
              <button
                onClick={toggleMicrophone}
                className={`p-2 rounded-lg ${localParticipant?.isMicrophoneEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} transition-colors`}
                title={localParticipant?.isMicrophoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
              >
                {localParticipant?.isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* Settings */}
              <button className="p-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video Grid */}
          <LiveKitRoomWrapper
            roomName={streamId}
            user={user}
            className="w-full h-[70vh] bg-black rounded-xl overflow-hidden"
            showLocalVideo={true}
            maxParticipants={6}
            autoPublish={true}
            role="broadcaster"
          />

          {/* Stream Info */}
          <div className="mt-6 bg-[#1C1C24] rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Stream ID: {streamId}</span>
              <span>Status: LIVE</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
      <div className="text-center">
        <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-lg">Preparing your stream...</p>
      </div>
    </div>
  );
};

export default GoLive;
