import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import TopBar from '../components/stream/TopBar';
import ChatOverlay from '../components/stream/ChatOverlay';
import ControlBar from '../components/stream/ControlBar';
import VideoFeed from '../components/stream/VideoFeed';
import AuthorityPanel from '../components/AuthorityPanel';
import RoyalCrownOverlay from '../components/RoyalCrownOverlay';
import { endStream } from '../lib/endStream';
import { useUnifiedLiveKit } from '../hooks/useUnifiedLiveKit';

export default function StreamRoom() {
  const { id, streamId } = useParams<{ id?: string; streamId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // Debug mount/unmount
  useEffect(() => {
    console.log('[StreamRoom mount]')
    return () => console.log('[StreamRoom unmount]')
  }, [])

  // Single source of truth for room name
  const getRoomName = (roomId: string) => `stream-${roomId}`

  const [stream, setStream] = useState<any>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isTestingMode, setIsTestingMode] = useState(false);

  // Get stream ID from params or location state
  const actualStreamId = id || streamId || location.state?.streamId;

  // Consistent room name from the start
  const roomName = actualStreamId ? getRoomName(actualStreamId) : null;

  // Determine mode once we have stream data
  const mode = stream ? (isHost ? 'publisher' : 'viewer') : 'viewer';

  // MODE RESOLVED logging
  useEffect(() => {
    if (stream && user) {
      console.log('[MODE RESOLVED ONCE]', { mode, roomName, identity: user.id })
    }
  }, [stream, user, mode, roomName])

  // Use unified LiveKit hook once we have stream data
  const {
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: liveKitError,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    getRoom,
  } = useUnifiedLiveKit({
    roomName: roomName || '',
    user: user && stream ? {
      ...user,
      role: isHost ? 'broadcaster' : ((profile as any)?.troll_role || 'viewer'),
      level: 1
    } : null,
    autoPublish: mode === 'publisher'
  });

  const room = getRoom();

  // Load stream data
  useEffect(() => {
    if (!actualStreamId) {
      setError('Stream ID not found');
      setIsLoadingStream(false);
      return;
    }

    const loadStream = async (retryCount = 0) => {
      try {
        const { data, error: streamError } = await supabase
          .from('streams')
          .select(`
            *,
            user_profiles!broadcaster_id (
              id,
              username,
              avatar_url,
              is_broadcaster
            )
          `)
          .eq('id', actualStreamId)
          .single();

        // If stream not found and we haven't retried too many times, wait and retry
        if ((streamError || !data) && retryCount < 3) {
          console.log(`Stream not found (attempt ${retryCount + 1}/3), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1))); // Exponential backoff
          return loadStream(retryCount + 1);
        }

        if (streamError || !data) {
          console.error('Stream load error after retries:', streamError);
          setError('Stream not found');
          setIsLoadingStream(false);
          // Don't redirect immediately - let user see the error
          toast.error('Stream not found. Please try starting the stream again.');
          return;
        }

        if (!data.is_live) {
          setError('Stream is not live');
          setIsLoadingStream(false);
          toast.error('Stream is not live. Please start the stream again.');
          // Don't redirect immediately - let user see the error
          return;
        }

        setStream(data);
        setIsTestingMode(data.is_testing_mode || false);

        // Check if user is the host
        const isUserHost = !!(user && profile && data.broadcaster_id === profile.id);
        setIsHost(isUserHost);

        setIsLoadingStream(false);
      } catch (err: any) {
        console.error('Stream initialization error:', err);
        setError(err.message || 'Failed to load stream');
        setIsLoadingStream(false);
        toast.error(err.message || 'Failed to load stream');
      }
    };

    loadStream();
  }, [actualStreamId, user, profile, navigate]);

  // Handle LiveKit connection errors
  useEffect(() => {
    if (liveKitError && !error) {
      setError(`Failed to connect to stream: ${liveKitError}`);
      setIsLoadingStream(false);
    }
  }, [liveKitError, error]);

  // Optional: Add timeout to prevent permanent loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoadingStream || (stream && !room && !error && !liveKitError)) {
        setError("Stream is taking too long to load. Please try again.");
        setIsLoadingStream(false);
      }
    }, 15000); // 15s timeout

    return () => clearTimeout(timer);
  }, [isLoadingStream, stream, room, error, liveKitError]);

  // Update viewer count when connected
  useEffect(() => {
    if (isConnected && stream?.id) {
      try {
        supabase.rpc('update_viewer_count', {
          p_stream_id: stream.id,
          p_delta: 1,
        });
      } catch (viewerError: any) {
        if (viewerError.code !== 'PGRST202') {
          console.warn('Viewer count update error:', viewerError);
        }
      }
    }

    // Cleanup function
    return () => {
      // Decrement viewer count
      if (stream?.id && isConnected) {
        void (async () => {
          try {
            await supabase.rpc('update_viewer_count', {
              p_stream_id: stream.id,
              p_delta: -1,
            });
          } catch {}
        })();
      }
    };
  }, [isConnected, stream?.id]);

  // Navigate viewers to home when stream ends
  useEffect(() => {
    if (!isConnected && !isHost && stream) {
      navigate('/', { replace: true });
    }
  }, [isConnected, isHost, stream, navigate]);

  // Handle stream end
  const handleEndStream = async () => {
    if (!stream?.id) return;

    const success = await endStream(stream.id, room);
    if (success) {
      disconnect(); // Disconnect from LiveKit room
      navigate(`/stream-summary/${stream.id}`, { replace: true });
    }
  };

  // Fix loading condition to prevent infinite loading
  const identity = user?.id;
  const stillLoading = !identity || isLoadingStream || (stream && !isConnected && !error && !liveKitError);

  if (stillLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">
            {!identity ? 'Loading user…' :
             isLoadingStream ? 'Loading stream...' :
             'Connecting to stream...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/live')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Go to Live Streams
          </button>
        </div>
      </div>
    );
  }

  if (!stream || !isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Loading stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative flex pt-16 lg:pt-0">
      <div className="flex-1 relative">
        {/* Top Bar */}
        <TopBar
          room={room}
          streamerId={stream.broadcaster_id}
          streamId={stream.id}
          popularity={stream.popularity || 0}
        />

        {/* Video Feed */}
        <div className="relative w-full h-screen">
          <VideoFeed
            room={room}
            isHost={isHost}
          />

          {/* Royal Crown Overlay - Only for Admin streams */}
          {stream?.user_profiles?.role === 'admin' && (
            <RoyalCrownOverlay
              streamId={stream.id}
              isAdminStream={true}
              participants={Array.from(participants.values())}
            />
          )}
        </div>

        {/* Chat Overlay */}
        <ChatOverlay streamId={stream.id} />

        {/* Control Bar */}
        {isHost && isConnected && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
            <ControlBar
              room={room}
              isCameraEnabled={localParticipant?.isCameraEnabled ?? true}
              isMicrophoneEnabled={localParticipant?.isMicrophoneEnabled ?? true}
              onToggleCamera={toggleCamera}
              onToggleMicrophone={toggleMicrophone}
              streamId={stream.id}
              isHost={isHost}
            />
          </div>
        )}
      </div>

      {/* Authority Panel - Right Side Rail */}
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <AuthorityPanel />
        </div>
      </div>
    </div>
  );
}
