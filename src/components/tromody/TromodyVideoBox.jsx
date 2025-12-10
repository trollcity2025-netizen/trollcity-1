// src/components/tromody/TromodyVideoBox.jsx
import React, { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { supabase } from "../../lib/supabase";
import api from "../../lib/api";

export default function TromodyVideoBox({ 
  user, 
  side, 
  isCurrentUser = false,
  onUserJoined,
  onUserLeft 
}) {
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [token, setToken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const roomRef = useRef(null);

  // Generate room name based on side and user
  const getRoomName = () => {
    return `tromody-${side}-${user?.id || 'empty'}`;
  };

  // Get LiveKit token for the user
  const getLiveKitToken = async () => {
    try {
      const roomName = getRoomName();
      const identity = user?.username || `user-${Date.now()}`;
      
      const response = await api.post('/livekit-token', {
        room: roomName,
        identity: identity,
        name: user?.username || 'Anonymous'
      });

      if (response.error || !response.token) {
        throw new Error(response.error || 'Failed to get LiveKit token');
      }

      const serverUrl = response.livekitUrl || response.serverUrl;
      if (!serverUrl) {
        throw new Error('LiveKit server URL not found');
      }

      return { token: response.token, livekitUrl: serverUrl };
    } catch (err) {
      console.error('Error getting LiveKit token:', err);
      throw err;
    }
  };

  // Connect to LiveKit room
  const connectToRoom = async () => {
    if (!user?.id) return;

    try {
      setError(null);
      const { token: liveKitToken, livekitUrl: serverUrl } = await getLiveKitToken();
      
      setToken(liveKitToken);
      setLivekitUrl(serverUrl);

      // Create and connect room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.Connected, () => {
        console.log(`✅ Connected to ${side} LiveKit room`);
        setIsConnected(true);
        onUserJoined?.(user, side);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log(`❌ Disconnected from ${side} LiveKit room`);
        setIsConnected(false);
        onUserLeft?.(user, side);
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === 'video') {
          if (participant.isLocal && videoRef.current) {
            // Local video already attached below
          } else if (!participant.isLocal) {
            // Remote video - attach to parent container
            const element = track.attach();
            if (videoRef.current?.parentElement) {
              const container = videoRef.current.parentElement;
              // Clear existing remote videos
              const existingRemote = container.querySelector('.remote-video-container');
              if (existingRemote) {
                existingRemote.remove();
              }
              // Create container for remote video
              const remoteContainer = document.createElement('div');
              remoteContainer.className = 'remote-video-container absolute inset-0 w-full h-full';
              remoteContainer.appendChild(element);
              container.appendChild(remoteContainer);
            }
          }
        } else if (track.kind === 'audio') {
          track.attach();
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      // Connect to room
      await room.connect(serverUrl, liveKitToken);
      roomRef.current = room;

      // If this is the current user's box, publish local tracks
      if (isCurrentUser) {
        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack(),
          createLocalAudioTrack(),
        ]);

        await room.localParticipant.publishTrack(videoTrack);
        await room.localParticipant.publishTrack(audioTrack);

        // Attach video to preview
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
          videoRef.current.muted = true;
          videoRef.current.play();
        }
      }

    } catch (err) {
      console.error(`Failed to connect ${side} room:`, err);
      setError(err.message || 'Failed to connect to stream');
    }
  };

  // Disconnect from room
  const disconnectFromRoom = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setIsConnected(false);
    }
  };

  // Handle user changes
  useEffect(() => {
    if (user?.id) {
      connectToRoom();
    } else {
      disconnectFromRoom();
    }

    return () => {
      disconnectFromRoom();
    };
  }, [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromRoom();
    };
  }, []);

  if (!user?.id) {
    return (
      <div className="bg-gray-800 w-80 h-52 rounded-lg mb-4 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Waiting for user...</div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-800 w-80 h-52 rounded-lg mb-4 overflow-hidden">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
          <div className="text-red-200 text-sm text-center">
            <div>Connection Error</div>
            <div className="text-xs mt-1">{error}</div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          {isCurrentUser ? (
            // Local video preview
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            // Remote video container
            <div className="w-full h-full bg-black">
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-gray-400 text-sm">Connecting...</div>
                </div>
              )}
              {/* Remote videos will be attached here via TrackSubscribed event */}
            </div>
          )}
        </div>
      )}
      
      {/* Status indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">
          {user.username} {isCurrentUser && '(You)'}
        </span>
      </div>
      
      {/* Connection status */}
      <div className="absolute top-2 right-2">
        <div className={`text-xs px-2 py-1 rounded ${
          isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </div>
  );
}