import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import TopBar from '../components/stream/TopBar';
import ChatOverlay from '../components/stream/ChatOverlay';
import ControlBar from '../components/stream/ControlBar';
import VideoFeed from '../components/stream/VideoFeed';
import { endStream } from '../lib/endStream';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';

export default function StreamRoom() {
  const { id, streamId } = useParams<{ id?: string; streamId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [stream, setStream] = useState<any>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isTestingMode, setIsTestingMode] = useState(false);

  // Get stream ID from params or location state
  const actualStreamId = id || streamId || location.state?.streamId;

  // Use unified LiveKit hook once we have stream data
  const { room, participants, isConnecting, connect, disconnect } = useLiveKitRoom(
    stream?.room_name || actualStreamId,
    user ? { ...user, role: (profile as any)?.troll_role || 'viewer', level: 1 } : null
  );

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

  // Handle track publishing for hosts when room connects
  useEffect(() => {
    if (!room || !isHost || !stream) return;

    const publishTracks = async () => {
      try {
        const shouldPublishTracks = isHost || (isTestingMode && profile && !profile.is_broadcaster);

        if (shouldPublishTracks && room.state === 'connected') {
          const [videoTrack, audioTrack] = await Promise.all([
            createLocalVideoTrack({
              facingMode: 'user',
            }).catch(err => {
              console.error('Error creating video track:', err);
              return null;
            }),
            createLocalAudioTrack().catch(err => {
              console.error('Error creating audio track:', err);
              return null;
            }),
          ]);

          // Only publish if tracks were created and room is still connected
          if (room.state === 'connected' && room.localParticipant) {
            if (videoTrack) {
              try {
                await room.localParticipant.publishTrack(videoTrack);
                console.log('✅ Published video track');
              } catch (err) {
                console.error('Error publishing video track:', err);
                videoTrack.stop();
              }
            }

            if (audioTrack) {
              try {
                await room.localParticipant.publishTrack(audioTrack);
                console.log('✅ Published audio track');
              } catch (err) {
                console.error('Error publishing audio track:', err);
                audioTrack.stop();
              }
            }
          } else {
            // Clean up tracks if room disconnected
            if (videoTrack) videoTrack.stop();
            if (audioTrack) audioTrack.stop();
          }
        }
      } catch (trackError: any) {
        console.error('Error publishing tracks:', trackError);
        // Don't show error toast if it's just a connection issue
        if (!trackError.message?.includes('closed') && !trackError.message?.includes('disconnected')) {
          toast.error('Failed to start camera/microphone');
        }
      }
    };

    publishTracks();

    // Update viewer count
    if (stream.id) {
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
      if (stream?.id) {
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
  }, [room, isHost, isTestingMode, profile, stream]);

  // Handle stream end
  const handleEndStream = async () => {
    if (!stream?.id) return;

    const success = await endStream(stream.id, room);
    if (success) {
      disconnect(); // Disconnect from LiveKit room
      navigate('/live', { replace: true });
    }
  };

  if (isLoadingStream || (stream && !room && !error)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">{isLoadingStream ? 'Loading stream...' : 'Connecting to stream...'}</p>
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

  if (!stream || !room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Loading stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
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
      </div>

      {/* Chat Overlay */}
      <ChatOverlay streamId={stream.id} />

      {/* Control Bar */}
      {isHost && room && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          <ControlBar
            room={room}
            isCameraEnabled={room?.localParticipant?.isCameraEnabled ?? true}
            isMicrophoneEnabled={room?.localParticipant?.isMicrophoneEnabled ?? true}
            onToggleCamera={async () => {
              if (room?.localParticipant) {
                await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);
              }
            }}
            onToggleMicrophone={async () => {
              if (room?.localParticipant) {
                await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
              }
            }}
            streamId={stream.id}
            isHost={isHost}
          />
        </div>
      )}
    </div>
  );
}
