import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitParticipant,
  LiveKitService,
  LiveKitServiceConfig,
} from "../lib/LiveKitService";
import { LiveKitContext, LiveKitContextValue } from "./LiveKitContext";

export const LiveKitProvider = ({ children }: { children: React.ReactNode }) => {
  const serviceRef = useRef<LiveKitService | null>(null);

  // Prevent StrictMode or re-render double connect
  const connectLockRef = useRef(false);

  // Track last init key to prevent reconnect spam
  const lastInitRef = useRef<string | null>(null);

  // Track disconnect calls to prevent double cleanup
  const disconnectingRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(
    new Map()
  );
  const [localParticipant, setLocalParticipant] =
    useState<LiveKitParticipant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncLocalParticipant = useCallback(() => {
    if (!serviceRef.current) return;
    setLocalParticipant(serviceRef.current.getLocalParticipant());
  }, []);

  /**
   * ✅ SAFE CONNECT
   * - Only connects when room + identity exist
   * - StrictMode guard
   * - allowPublish MUST be explicitly passed true for publisher
   * - fixes "insufficient permissions" caused by accidental auto publish
   */
  const connect = useCallback(
    async (
      roomName: string,
      user: any,
      options: Partial<LiveKitServiceConfig> = {}
    ) => {
      if (!roomName || !user) {
        setError("Missing room or user for LiveKit connect");
        return false;
      }

      // Require stable identity
      const identity = user.id || user.identity;
      if (!identity) return false;

      // ✅ DEFENSIVE: Validate Supabase session before attempting LiveKit connection
      try {
        const { data: sessionData, error: sessionError } = await (window as any).supabase?.auth?.getSession?.() || {};
        if (sessionError || !sessionData?.session) {
          setError("No active session. Please sign in again.");
          // Emit error to parent so it can redirect
          options.onError?.("Session expired. Please sign in again.");
          return false;
        }
      } catch (e: any) {
        console.warn("[LiveKitProvider] Session check threw:", e?.message);
        setError("Session validation failed. Please sign in again.");
        options.onError?.("Session validation failed.");
        return false;
      }

      const allowPublish = options.allowPublish === true;
      const mode = allowPublish ? "publisher" : "viewer";

      const initKey = `${roomName}:${identity}:${mode}`;

      // ✅ Prevent duplicate connect spam
      if (lastInitRef.current === initKey && serviceRef.current?.isConnected()) {
        console.log("[CONNECT SKIPPED - already connected]", initKey);
        return true;
      }

      if (connectLockRef.current) {
        console.log("[CONNECT LOCK ACTIVE] skipping connect until unlocked");
        return false;
      }

      connectLockRef.current = true;

      console.log("[CONNECT INTENT]", {
        roomName,
        identity,
        mode,
        allowPublish,
      });

      try {
        setError(null);
        setIsConnecting(true);

        // Disconnect existing service if switching mode/room
        if (serviceRef.current) {
          console.log("[DISCONNECTING EXISTING SESSION]");
          serviceRef.current.disconnect();
          serviceRef.current = null;
        }

        // Create service instance with correct allowPublish mode
        serviceRef.current = new LiveKitService({
          roomName,
          identity,
          user,
          allowPublish,
          autoPublish: allowPublish ? options.autoPublish : false,
          preflightStream: allowPublish ? options.preflightStream : undefined,

          onConnected: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
            setParticipants(new Map(serviceRef.current?.getParticipants()));
            syncLocalParticipant();
            options.onConnected?.();
          },

          onDisconnected: () => {
            setIsConnected(false);
            setIsConnecting(false);
            setParticipants(new Map());
            setLocalParticipant(null);
            options.onDisconnected?.();
          },

          onParticipantJoined: async (participant) => {
            setParticipants((prev) => {
              const next = new Map(prev);
              next.set(participant.identity, participant);
              return next;
            });

            if (!participant.isLocal && participant.identity) {
              try {
                const { triggerUserEntranceEffect } = await import(
                  "../lib/entranceEffects"
                );
                await triggerUserEntranceEffect(participant.identity);
              } catch (err) {
                console.warn("Failed to trigger entrance effect:", err);
              }
            }

            options.onParticipantJoined?.(participant);
          },

          onParticipantLeft: (participant) => {
            setParticipants((prev) => {
              const next = new Map(prev);
              next.delete(participant.identity);
              return next;
            });
            options.onParticipantLeft?.(participant);
          },

          onTrackSubscribed: (track, participant) => {
            setParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(participant.identity) || participant;
              const updated = { ...existing };
              if (track.kind === "video") updated.videoTrack = track;
              if (track.kind === "audio") updated.audioTrack = track;
              next.set(participant.identity, updated);
              return next;
            });
            options.onTrackSubscribed?.(track, participant);
          },

          onTrackUnsubscribed: (track, participant) => {
            setParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(participant.identity);
              if (existing) {
                const updated: LiveKitParticipant = { ...existing };
                if (track.kind === "video") delete (updated as any).videoTrack;
                if (track.kind === "audio") delete (updated as any).audioTrack;
                next.set(participant.identity, updated);
              }
              return next;
            });
            options.onTrackUnsubscribed?.(track, participant);
          },

          onError: (errorMsg) => {
            if (
              errorMsg.includes("Client initiated disconnect") ||
              errorMsg.includes("Abort connection attempt") ||
              errorMsg.includes("websocket closed")
            ) {
              console.log("[LiveKit non-error]", errorMsg);
              return;
            }

            console.error("[LiveKit error]", errorMsg);
            setError(errorMsg);
            setIsConnecting(false);
            options.onError?.(errorMsg);
          },
        });

        // ✅ Mark initialized only after service created
        lastInitRef.current = initKey;

        // Allow token override if provided
        const tokenOverride = (options as any).tokenOverride as string | undefined;

        const ok = await serviceRef.current.connect(tokenOverride);
        syncLocalParticipant();
        return ok;
      } catch (err: any) {
        console.error("[LiveKitProvider] connect failed", err);
        setIsConnecting(false);
        const errorMsg = err?.message || "Failed to connect to LiveKit";
        setError(errorMsg);
        options.onError?.(errorMsg);
        lastInitRef.current = null;
        // Propagate error so callers (useLiveKitSession) receive original message
        throw err;
      } finally {
        connectLockRef.current = false;
      }
    },
    [syncLocalParticipant]
  );

  const disconnect = useCallback(() => {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;

    try {
      serviceRef.current?.disconnect();
      serviceRef.current = null;
    } finally {
      setIsConnected(false);
      setIsConnecting(false);
      setParticipants(new Map());
      setLocalParticipant(null);
      lastInitRef.current = null;
      disconnectingRef.current = false;
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!serviceRef.current || !serviceRef.current.isConnected()) return false;
    try {
      const enabled = await serviceRef.current.toggleCamera();
      syncLocalParticipant();
      return enabled;
    } catch (err: any) {
      console.error("Toggle camera failed:", err);
      setError(`Camera toggle failed: ${err.message}`);
      return false;
    }
  }, [syncLocalParticipant]);

  const toggleMicrophone = useCallback(async () => {
    if (!serviceRef.current || !serviceRef.current.isConnected()) return false;
    try {
      const enabled = await serviceRef.current.toggleMicrophone();
      syncLocalParticipant();
      return enabled;
    } catch (err: any) {
      console.error("Toggle microphone failed:", err);
      setError(`Microphone toggle failed: ${err.message}`);
      return false;
    }
  }, [syncLocalParticipant]);

  const startPublishing = useCallback(async () => {
    if (!serviceRef.current) throw new Error("LiveKit service not initialized");
    if (!serviceRef.current.isConnected()) throw new Error("Room not connected");

    try {
      await serviceRef.current.startPublishing();
      syncLocalParticipant();
      setParticipants(new Map(serviceRef.current.getParticipants()));
    } catch (err: any) {
      console.error("startPublishing failed:", err);
      setError(`Failed to start publishing: ${err.message}`);
      throw err;
    }
  }, [syncLocalParticipant]);

  const getRoom = useCallback(() => {
    return serviceRef.current?.getRoom() || null;
  }, []);

  useEffect(() => {
    return () => {
      console.log("LiveKitProvider unmounted (StrictMode/dev) - no forced disconnect");
    };
  }, []);

  const value: LiveKitContextValue = {
    service: serviceRef.current as any,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    getRoom,
  };

  return <LiveKitContext.Provider value={value}>{children}</LiveKitContext.Provider>;
};
