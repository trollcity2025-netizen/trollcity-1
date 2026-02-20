import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";

function useConnectionState(): "connected" | "disconnected" | "reconnecting" {
  return "connected";
}
import { getUserEntranceEffect } from "../lib/entranceEffects";

// ✅ Survives component remounts within the same tab session
const playedInMemory = new Set<string>();

export function useListenerEntranceEffect({
  streamId,
  userId,      // still used to fetch their effect, but NOT for dedupe key
  isHost,
  isGuest,
  canPublish,
  _username,
}: {
  streamId: string | null | undefined;
  userId: string | null | undefined;
  isHost: boolean;
  isGuest: boolean;
  canPublish: boolean;
  username?: string;
}) {
  const connectionState = useConnectionState();
  const isConnected = connectionState === "connected";
  const location = useLocation();

  const isBroadcastPage =
    location.pathname.includes("/broadcast/") ||
    location.pathname.includes("/watch/") ||
    location.pathname.includes("/stream/");

  const getKey = (sid: string) => `entrancePlayed:${sid}`;

  // Prevent duplicate calls within a single mount
  const firedThisMountRef = useRef(false);

  const trigger = useCallback(async () => {
    if (!isBroadcastPage) return;
    if (!isConnected) return;
    if (!streamId) return;
    if (!userId) return;

    // If you truly want it only for listeners, keep this.
    // If you want it for everyone, delete this block.
    if (isHost || isGuest || canPublish) return;

    const key = getKey(streamId);

    // ✅ Hard dedupe: memory + sessionStorage
    if (firedThisMountRef.current) return;
    if (playedInMemory.has(key)) return;
    if (sessionStorage.getItem(key)) {
      playedInMemory.add(key);
      firedThisMountRef.current = true;
      return;
    }

    // Mark immediately to prevent races
    playedInMemory.add(key);
    sessionStorage.setItem(key, "1");
    firedThisMountRef.current = true;

    try {
      const { effectKey } = await getUserEntranceEffect(userId);
      if (!effectKey) return;

      const { playEntranceAnimation } = await import("../lib/entranceAnimations");
      await playEntranceAnimation(userId, effectKey);
    } catch (e) {
      console.error("Entrance effect error:", e);
      // keep it marked; requirement is “once and done”
    }
  }, [isBroadcastPage, isConnected, streamId, userId, isHost, isGuest, canPublish]);

  useEffect(() => {
    if (!isBroadcastPage) return;
    if (!streamId) return;

    // IMPORTANT: do NOT reset to false on streamId null flaps.
    // Reset only when entering a DIFFERENT stream.
    firedThisMountRef.current = false;

    // If we already played for this stream in this tab, lock it immediately.
    const key = getKey(streamId);
    if (sessionStorage.getItem(key)) {
      playedInMemory.add(key);
      firedThisMountRef.current = true;
      return;
    }

    if (isConnected) trigger();
  }, [isBroadcastPage, streamId, isConnected, trigger]);

  return { connectionState, isConnected };
}
