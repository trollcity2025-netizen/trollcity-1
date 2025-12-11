import { useState, useEffect, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { LIVEKIT_URL, defaultLiveKitOptions } from '../lib/LiveKitConfig';
import api from '../lib/api';

export function useLiveKitRoom(roomName, user, options = {}) {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Merge default options with provided options
  const roomOptions = { ...defaultLiveKitOptions, ...options };

  const connect = useCallback(async () => {
    if (!user || !roomName) {
      setError("Missing room name or user");
      return;
    }

    setIsConnecting(true);
    setError(null); // reset previous errors

    try {
      // Fetch token from universal endpoint
      const tokenResponse = await api.post('/livekit-token', {
        room: roomName,
        identity: user.email || user.id,
        user_id: user.id,
        role: user.role || user.troll_role || 'viewer',
        level: user.level || 1,
      });

      if (!tokenResponse.token) {
        throw new Error('Failed to get LiveKit token');
      }

      // Create and configure room
      const newRoom = new Room(roomOptions);

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log(`✅ Connected to LiveKit room: ${roomName}`);
        setIsConnecting(false);
        setRoom(newRoom);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log(`❌ Disconnected from LiveKit room: ${roomName}`);
        setRoom(null);
        setParticipants({});
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
        setParticipants(prev => ({
          ...prev,
          [participant.identity]: participant
        }));
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('Participant disconnected:', participant.identity);
        setParticipants(prev => {
          const updated = { ...prev };
          delete updated[participant.identity];
          return updated;
        });
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('Track subscribed:', track.kind, participant.identity);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        console.log('Track unsubscribed:', track.kind);
      });

      // Connect to room
      await newRoom.connect(LIVEKIT_URL, tokenResponse.token);

    } catch (err) {
      console.error('Error connecting to LiveKit room:', err);
      setError(err.message || 'Failed to connect to stream');
      setIsConnecting(false);
      setRoom(null);
    }
  }, [roomName, user, roomOptions]);

  const disconnect = useCallback(() => {
    if (room) {
      try {
        room.disconnect();
      } catch (err) {
        console.error('Error disconnecting from room:', err);
      }
      setRoom(null);
      setParticipants({});
    }
  }, [room]);

  // Auto-connect when roomName or user changes
  useEffect(() => {
    if (roomName && user && !room && !isConnecting) {
      connect();
    }

    // Cleanup on unmount or when roomName/user changes
    return () => {
      if (room) {
        disconnect();
      }
    };
  }, [roomName, user, connect, disconnect, room, isConnecting]);

  // Handle page unload to prevent disconnect bugs
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (room) {
        try {
          room.disconnect();
        } catch (err) {
          console.error('Error during page unload disconnect:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [room]);

  return {
    room,
    participants,
    isConnecting,
    error,        // 🔥 expose error to parent
    connect,
    disconnect,
  };
}