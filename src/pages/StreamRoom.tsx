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

export default function StreamRoom() {
  const { id, streamId } = useParams<{ id?: string; streamId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [stream, setStream] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isTestingMode, setIsTestingMode] = useState(false);

  // Get stream ID from params or location state
  const actualStreamId = id || streamId || location.state?.streamId;

  // Load stream data
  useEffect(() => {
    if (!actualStreamId) {
      setError('Stream ID not found');
      setIsConnecting(false);
      return;
    }

    const loadStream = async () => {
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

        if (streamError) {
          console.error('Stream load error:', streamError);
          setError('Stream not found');
          setIsConnecting(false);
          return;
        }

        if (!data || !data.is_live) {
          setError('Stream is not live');
          setIsConnecting(false);
          navigate('/live', { replace: true });
          return;
        }

        setStream(data);
        setIsTestingMode(data.is_testing_mode || false);

        // Check if user is the host
        const isUserHost = user && profile && data.broadcaster_id === profile.id;
        setIsHost(isUserHost);

        // Get LiveKit token
        const tokenResponse = await api.post('/livekit-token', {
          room: data.room_name || actualStreamId,
          identity: user?.email || user?.id || 'anonymous',
          isHost: isUserHost,
        });

        if (tokenResponse.error || !tokenResponse.token) {
          throw new Error(tokenResponse.error || 'Failed to get LiveKit token');
        }

        const serverUrl = tokenResponse.livekitUrl || tokenResponse.serverUrl;
        if (!serverUrl) {
          throw new Error('LiveKit server URL not found');
        }

        setLivekitUrl(serverUrl);
        setToken(tokenResponse.token);
      } catch (err: any) {
        console.error('Stream initialization error:', err);
        setError(err.message || 'Failed to load stream');
        setIsConnecting(false);
        toast.error(err.message || 'Failed to load stream');
      }
    };

    loadStream();
  }, [actualStreamId, user, profile, navigate]);

  // Initialize LiveKit connection
  useEffect(() => {
    if (!livekitUrl || !token || !stream) return;

    let newRoom: Room | null = null;

    const initializeLiveKit = async () => {
      try {
        setIsConnecting(true);
        
        newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Set up event listeners
        let isConnected = false;
        let shouldPublishTracks = isHost || (isTestingMode && profile && !profile.is_broadcaster);

        newRoom.on(RoomEvent.Connected, async () => {
          console.log('✅ Connected to LiveKit room');
          isConnected = true;
          setIsConnecting(false);
          setRoom(newRoom);

          // Wait a bit for the connection to stabilize before publishing tracks
          await new Promise(resolve => setTimeout(resolve, 500));

          // If host, publish tracks after connection is established
          if (shouldPublishTracks && newRoom.state === 'connected') {
            try {
              // Check if room is still connected before publishing
              if (newRoom.state !== 'connected') {
                console.warn('Room not connected, skipping track publication');
                return;
              }

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
              if (newRoom.state === 'connected' && newRoom.localParticipant) {
                if (videoTrack) {
                  try {
                    await newRoom.localParticipant.publishTrack(videoTrack);
                    console.log('✅ Published video track');
                  } catch (err) {
                    console.error('Error publishing video track:', err);
                    videoTrack.stop();
                  }
                }

                if (audioTrack) {
                  try {
                    await newRoom.localParticipant.publishTrack(audioTrack);
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
            } catch (trackError: any) {
              console.error('Error publishing tracks:', trackError);
              // Don't show error toast if it's just a connection issue
              if (!trackError.message?.includes('closed') && !trackError.message?.includes('disconnected')) {
                toast.error('Failed to start camera/microphone');
              }
            }
          }
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('❌ Disconnected from LiveKit room');
          isConnected = false;
          navigate('/live', { replace: true });
        });

        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
        });

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
        });

        // Connect to room
        await newRoom.connect(livekitUrl, token);
        
        // Don't set room state here - wait for Connected event
        // This prevents race conditions with track publishing

        // Update viewer count
        if (stream.id) {
          try {
            const viewerResult = supabase.rpc('update_viewer_count', {
              p_stream_id: stream.id,
              p_delta: 1,
            });
            if (viewerResult && typeof viewerResult.catch === 'function') {
              await viewerResult;
            }
          } catch (viewerError: any) {
            if (viewerError.code !== 'PGRST202') {
              console.warn('Viewer count update error:', viewerError);
            }
          }
        }
      } catch (err: any) {
        console.error('LiveKit connection error:', err);
        setError(err.message || 'Failed to connect to stream');
        setIsConnecting(false);
        toast.error('Failed to connect to stream');
      }
    };

    initializeLiveKit();

    // Cleanup
    return () => {
      if (newRoom) {
        newRoom.disconnect();
      }
      // Decrement viewer count
      if (stream?.id) {
        try {
          const viewerResult = supabase.rpc('update_viewer_count', {
            p_stream_id: stream.id,
            p_delta: -1,
          });
          if (viewerResult && typeof viewerResult.catch === 'function') {
            viewerResult.catch(() => {});
          }
        } catch (err) {
          // Silently ignore cleanup errors
        }
      }
    };
  }, [livekitUrl, token, stream, isHost, isTestingMode, profile, navigate]);

  // Handle stream end
  const handleEndStream = async () => {
    if (!stream?.id || !room) return;
    
    const success = await endStream(stream.id, room);
    if (success) {
      navigate('/live', { replace: true });
    }
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Connecting to stream...</p>
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

  if (!stream || !livekitUrl || !token) {
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
          livekitUrl={livekitUrl}
          token={token}
          isHost={isHost}
          onRoomReady={(readyRoom) => setRoom(readyRoom)}
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
