import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, RoomConnectOptions, createLocalTracks } from 'livekit-client';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

interface GoLiveProps {
  className?: string;
}

const GoLive: React.FC<GoLiveProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartStream = async () => {
    if (!user || !roomName.trim() || !streamTitle.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get LiveKit token via Supabase Edge Function
      const { data: tokenData, error: tokenError } = await api.post('/livekit-token', {
        roomName,
        identity: user.id,
        isHost: true
      });

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenError || 'Failed to get LiveKit token');
      }

      // Create local tracks
      const tracks = await createLocalTracks({
        audio: true,
        video: true
      });

      // Create room instance
      const room = new Room();
      
      const connectOptions: RoomConnectOptions = {
        autoSubscribe: true,
      };

      // Connect to LiveKit room
      await room.connect(tokenData.serverUrl, tokenData.token, connectOptions);

      // Publish local tracks
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
      }

      setIsLive(true);
      
      // Navigate to stream room with room info
      navigate('/stream-room', { 
        state: { 
          roomName, 
          streamTitle,
          tokenData,
          room 
        } 
      });

    } catch (err) {
      console.error('Failed to start stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to start stream');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${className}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Go Live</h1>
          
          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Stream Title *
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter your stream title..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Room Name *
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isConnecting}
              />
            </div>

            {error && (
              <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={isConnecting || !roomName.trim() || !streamTitle.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 px-4 rounded-md font-medium transition-colors"
            >
              {isConnecting ? 'Starting Stream...' : 'Go Live'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
