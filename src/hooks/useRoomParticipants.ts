import { useEffect, useState } from 'react';
import { Room, Participant, RoomEvent } from 'livekit-client';

export function useRoomParticipants(room: Room | undefined | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!room) {
      setParticipants([]);
      return;
    }

    const updateParticipants = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      const local = room.localParticipant;
      // Filter out participants that haven't fully connected if needed, 
      // but usually we want all of them.
      setParticipants(local ? [local, ...remotes] : remotes);
    };

    updateParticipants();

    // Listen to room events that affect the participant list
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.Connected, updateParticipants);
    room.on(RoomEvent.Disconnected, updateParticipants);
    
    // Also listen to track subscriptions if we want to re-order or something, 
    // but for just the list, connection events are usually enough.
    // However, sometimes we might want to know if a participant started publishing.
    
    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipants);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.off(RoomEvent.Connected, updateParticipants);
      room.off(RoomEvent.Disconnected, updateParticipants);
    };
  }, [room]);

  return participants;
}
