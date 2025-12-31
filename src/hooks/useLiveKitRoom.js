import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { LIVEKIT_URL, defaultLiveKitOptions } from '../lib/LiveKitConfig';
import api, { API_ENDPOINTS } from '../lib/api';

export function useLiveKitRoom(roomName, user, options = {}) {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);

  const {
    allowPublish = false,
    onToken,
    shouldConnect = true,
    ...roomOptionOverrides
  } = options;
  const roomOptions = { ...defaultLiveKitOptions, ...roomOptionOverrides };

  const connect = useCallback(async () => {
    if (!shouldConnect) {
      return;
    }
    if (!user || !roomName) {
      setError('Missing room name or user');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const tokenParams = {
        room: roomName,
        identity: user.email || user.id,
        user_id: user.id,
        role: user.role || user.troll_role || 'viewer',
        level: user.level || 1,
      };

      const isPublishing = allowPublish === true;
      let tokenResponse;

      if (isPublishing) {
        tokenResponse = await api.post('/livekit-token', {
          room: roomName,
          identity: user.email || user.id,
          user_id: user.id,
          role: user.role || 'broadcaster',
          level: user.level || 1,
          allowPublish: true,
        });
      } else {
        try {
          const response = await api.get(API_ENDPOINTS.livekit.token, tokenParams);
          if (!response.success || !response.token) {
            throw new Error(response.error || 'Failed to get token');
          }
          tokenResponse = response;
        } catch (fetchErr) {
          console.warn('GET token failed, falling back to POST:', fetchErr);
          tokenResponse = await api.post(API_ENDPOINTS.livekit.token, {
            ...tokenParams,
            role: 'viewer',
            allowPublish: false,
          });
        }
      }

      if (!tokenResponse.token) {
        throw new Error('Failed to get LiveKit token');
      }

      onToken?.(tokenResponse.token);

      const newRoom = new Room(roomOptions);

      newRoom.on(RoomEvent.Connected, () => {
        console.log(`Connected to LiveKit room: ${roomName}`);
        roomRef.current = newRoom;
        setIsConnecting(false);
        setRoom(newRoom);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log(`Disconnected from LiveKit room: ${roomName}`);
        roomRef.current = null;
        setRoom(null);
        setParticipants({});
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
        setParticipants(prev => ({
          ...prev,
          [participant.identity]: participant,
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

      await newRoom.connect(LIVEKIT_URL, tokenResponse.token);
    } catch (err) {
      console.error('Error connecting to LiveKit room:', err);
      setError(err.message || 'Failed to connect to stream');
      setIsConnecting(false);
      setRoom(null);
      roomRef.current = null;
    }
  }, [roomName, user, roomOptions, allowPublish, onToken, shouldConnect]);

  const disconnect = useCallback(() => {
    const currentRoom = roomRef.current;
    if (currentRoom) {
      try {
        currentRoom.disconnect();
      } catch (err) {
        console.error('Error disconnecting from room:', err);
      }
      roomRef.current = null;
      setRoom(null);
      setParticipants({});
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!roomName || !user) {
      return;
    }

    if (!shouldConnect) {
      if (roomRef.current) {
        disconnect();
      }
      return;
    }

    if (!roomRef.current && !isConnecting) {
      connect();
    }
  }, [roomName, user, shouldConnect, isConnecting, connect, disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentRoom = roomRef.current;
      if (currentRoom) {
        try {
          currentRoom.disconnect();
        } catch (err) {
          console.error('Error during page unload disconnect:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    room,
    participants,
    isConnecting,
    error,        // expose error to parent
    connect,
    disconnect,
  };
}
