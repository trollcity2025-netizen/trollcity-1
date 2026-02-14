import { useEffect, useCallback, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { playEntranceAnimation } from '../lib/entranceAnimations';
import type { EntranceEventPayload } from './usePublishEntranceOnJoin';

/**
 * Hook to listen for entrance events from other users in the broadcast.
 * 
 * Requirements:
 * - Subscribe to LiveKit data messages with topic "entrance"
 * - Verify msg.type === "entrance"
 * - Verify msg.streamId === currentStreamId
 * - Deduplicate by eventId using a Set
 * - Play entrance animation + sound for valid events
 * - Only active inside broadcast room UI (LiveKitRoom)
 * - Never trigger on Home or other pages
 */
export function useListenForEntrances({
  streamId,
  localUserId,
}: {
  streamId: string | null | undefined;
  localUserId: string | null | undefined;
}) {
  const room = useRoomContext();
  
  // Deduplication Set for eventIds - persists for session lifetime
  const processedEventsRef = useRef<Set<string>>(new Set());
  
  // Track if we're in a valid broadcast context
  const isInBroadcastContextRef = useRef(false);
  
  // Handler reference for cleanup
  const handlerRef = useRef<((payload: Uint8Array, topic?: string) => void) | null>(null);

  // Set broadcast context on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isBroadcast = window.location.pathname.includes('/broadcast/') ||
                          window.location.pathname.includes('/watch/') ||
                          window.location.pathname.includes('/stream/');
      isInBroadcastContextRef.current = isBroadcast;
      
      if (!isBroadcast) {
        console.log('[useListenForEntrances] Not in broadcast context, skipping initialization');
        return;
      }
    }
  }, []);

  // Create the data message handler
  const handleDataMessage = useCallback((payload: Uint8Array, topic?: string) => {
    // Only process "entrance" topic
    if (topic !== 'entrance') {
      return;
    }

    // Parse payload
    let entrancePayload: EntranceEventPayload;
    try {
      entrancePayload = JSON.parse(new TextDecoder().decode(payload));
    } catch (error) {
      console.error('[useListenForEntrances] Failed to parse entrance event:', error);
      return;
    }

    // Verify message type
    if (entrancePayload.type !== 'entrance') {
      console.log('[useListenForEntrances] Ignoring non-entrance message');
      return;
    }

    // Verify streamId matches
    if (entrancePayload.streamId !== streamId) {
      console.log(`[useListenForEntrances] Ignoring event for different stream: ${entrancePayload.streamId} !== ${streamId}`);
      return;
    }

    // Skip own events (we already handled our own entrance locally)
    if (entrancePayload.userId === localUserId) {
      console.log('[useListenForEntrances] Skipping own entrance event');
      return;
    }

    // Deduplicate by eventId
    if (processedEventsRef.current.has(entrancePayload.eventId)) {
      console.log(`[useListenForEntrances] Duplicate event detected: ${entrancePayload.eventId}`);
      return;
    }

    // Mark event as processed
    processedEventsRef.current.add(entrancePayload.eventId);
    console.log(`[useListenForEntrances] Processing entrance event: ${entrancePayload.eventId} for user ${entrancePayload.userId}`);

    // Play entrance animation with effectKey
    void playEntranceAnimation(entrancePayload.userId, entrancePayload.effectKey);
  }, [streamId, localUserId]);

  // Subscribe to data messages when room is available
  useEffect(() => {
    if (!room || !isInBroadcastContextRef.current) {
      return;
    }

    // Store handler reference for cleanup
    handlerRef.current = handleDataMessage;

    // Subscribe to data received events
    // LiveKit fires DataReceived with (payload, kind, topic?) 
    // We need to use the correct event signature
    const handleDataReceived = (payload: Uint8Array, participant: any, kind: any, topic?: string) => {
      handleDataMessage(payload, topic);
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      handlerRef.current = null;
    };
  }, [room, handleDataMessage]);

  // Cleanup on unmount
  useEffect(() => {
    const currentProcessedEvents = processedEventsRef.current;
    return () => {
      currentProcessedEvents.clear();
    };
  }, []);

  return {
    processedEventCount: processedEventsRef.current.size,
    clearProcessedEvents: () => {
      processedEventsRef.current.clear();
    },
  };
}

/**
 * Component wrapper for useListenForEntrances hook.
 * Must be rendered inside <LiveKitRoom> to access LiveKit context.
 */
export function ListenForEntrances({
  streamId,
  localUserId,
}: {
  streamId: string | null | undefined;
  localUserId: string | null | undefined;
}) {
  useListenForEntrances({ streamId, localUserId });
  return null;
}

/**
 * Reset deduplication state - useful for testing or reconnection scenarios
 */
export function resetEntranceDedupe() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('entrance_events_processed');
  }
}
