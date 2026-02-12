import { useEffect, useCallback, useRef } from 'react';
import { useConnectionState, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { getUserEntranceEffect } from '../lib/entranceEffects';
import { ConnectionState } from 'livekit-client';

/**
 * Entrance event payload structure for LiveKit data messages
 */
export interface EntranceEventPayload {
  type: 'entrance';
  eventId: string;
  streamId: string;
  userId: string;
  username: string;
  effectKey: string;
  timestamp: number;
}

/**
 * Hook to publish entrance events when a user joins the broadcast.
 * 
 * Requirements:
 * - Only trigger after LiveKit connection is confirmed (Connected state)
 * - Publish reliable data message with topic "entrance"
 * - Include userId, username, streamId, and effectKey
 * - Generate unique eventId for deduplication
 * - Only mounted inside broadcast room UI (LiveKitRoom)
 * 
 * Listener/Role Logic:
 * - ENTRANCE_PUBLISH_PREDICATE: Always publish for all users (listeners + guests + host)
 *   The entrance effect plays for ALL users joining the broadcast, regardless of role.
 *   This creates an inclusive experience where everyone sees everyone's entrance.
 */
export function usePublishEntranceOnJoin({
  streamId,
  userId,
  username,
}: {
  streamId: string | null | undefined;
  userId: string | null | undefined;
  username?: string;
}) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const hasPublishedRef = useRef(false);
  const publishedEventIdsRef = useRef<Set<string>>(new Set());
  const publishedKey = streamId && userId ? `entrance_published_${streamId}_${userId}` : null;
  const roomEntryKey = streamId ? `entrance_room_connected_${streamId}` : null;

  // Generate unique event ID
  const generateEventId = useCallback((uid: string) => {
    return `${uid}:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  // Publish entrance event
  const publishEntranceEvent = useCallback(async () => {
    if (!localParticipant || !room || !streamId || !userId) {
      console.log('[usePublishEntranceOnJoin] Missing required data to publish');
      return;
    }

    if (publishedKey && sessionStorage.getItem(publishedKey)) {
      console.log('[usePublishEntranceOnJoin] Entrance already published for this stream, skipping');
      return;
    }

    // Check if already published this event
    const eventId = generateEventId(userId);
    if (publishedEventIdsRef.current.has(eventId)) {
      console.log('[usePublishEntranceOnJoin] Already published this event');
      return;
    }

    try {
      // Get user's entrance effect
      const { effectKey } = await getUserEntranceEffect(userId);
      
      if (!effectKey) {
        console.log('[usePublishEntranceOnJoin] No entrance effect for user, skipping publish');
        return;
      }

      const payload: EntranceEventPayload = {
        type: 'entrance',
        eventId,
        streamId,
        userId,
        username: username || userId,
        effectKey,
        timestamp: Date.now(),
      };

      const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

      // Publish reliable data message with topic "entrance"
      await localParticipant.publishData(encodedPayload, {
        topic: 'entrance',
        reliable: true,
      });

      publishedEventIdsRef.current.add(eventId);
      if (publishedKey) {
        sessionStorage.setItem(publishedKey, '1');
      }
      console.log(`[usePublishEntranceOnJoin] Published entrance event: ${eventId} for user ${userId} with effect ${effectKey}`);
    } catch (error) {
      console.error('[usePublishEntranceOnJoin] Failed to publish entrance event:', error);
    }
  }, [localParticipant, room, streamId, userId, username, generateEventId, publishedKey]);

  // Effect: Publish entrance event when connected
  useEffect(() => {
    // Only trigger on Connected state (not reconnecting, etc.)
    const shouldPublish = connectionState === ConnectionState.Connected;

    if (shouldPublish && streamId && userId && !hasPublishedRef.current) {
      if (roomEntryKey && sessionStorage.getItem(roomEntryKey)) {
        hasPublishedRef.current = true;
        console.log('[usePublishEntranceOnJoin] Room already connected this session, skipping publish');
        return;
      }

      if (publishedKey && sessionStorage.getItem(publishedKey)) {
        hasPublishedRef.current = true;
        console.log('[usePublishEntranceOnJoin] Entrance already published for this stream (session), skipping');
        return;
      }

      if (roomEntryKey) {
        sessionStorage.setItem(roomEntryKey, '1');
      }
      hasPublishedRef.current = true;
      console.log(`[usePublishEntranceOnJoin] Connection established, publishing entrance for stream ${streamId}`);
      
      // Small delay to ensure room is fully ready
      const timer = setTimeout(() => {
        void publishEntranceEvent();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [connectionState, streamId, userId, publishEntranceEvent, publishedKey, roomEntryKey]);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
  };
}

/**
 * Component wrapper for usePublishEntranceOnJoin hook.
 * Must be rendered inside <LiveKitRoom> to access LiveKit context.
 */
export function PublishEntranceOnJoin({
  streamId,
  userId,
  username,
}: {
  streamId: string | null | undefined;
  userId: string | null | undefined;
  username?: string;
}) {
  usePublishEntranceOnJoin({ streamId, userId, username });
  return null;
}
