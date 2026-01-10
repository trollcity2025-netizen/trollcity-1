import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitParticipant,
  LiveKitService,
  LiveKitServiceConfig,
} from "../lib/LiveKitService";
import { LiveKitContext, LiveKitContextValue } from "./LiveKitContext";

// Helper function to send admin notifications
const sendAdminNotification = async (message: string) => {
  try {
    const { supabase } = await import('../lib/supabase');
    // Send to admin announcements or notifications
    await supabase.functions.invoke('send-announcement', {
      body: {
        title: 'Live Stream Error Alert',
        message: message,
        type: 'error',
        targetRoles: ['admin']
      }
    });
  } catch (err) {
    console.error('Failed to send admin notification:', err);
  }
};

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
      // ✅ Early return for missing requirements - don't set error, just skip
      if (!roomName || !user) {
        console.log("[LiveKitProvider] Skipping connect — missing room or user", { roomName: !!roomName, user: !!user });
        return null;
      }

      // Require stable identity
      const identity = user.id || user.identity;
      if (!identity) {
        console.log("[LiveKitProvider] Skipping connect — missing identity");
        return null;
      }

      // ✅ DEFENSIVE: Validate Supabase session before attempting LiveKit connection
      // Do NOT set error for expected "no session" condition on app load
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          // This is expected on app load - don't treat as error, clear any existing error
          console.log("[LiveKitProvider] No active session yet — skipping connect");
          setError(null); // Clear error state for expected condition
          return null;
        }
        console.log("[LiveKitProvider] ✅ Session validated before connection");
        setError(null); // Clear any previous errors
      } catch (e: any) {
        // Only log as info, don't set error for expected conditions
        console.log("[LiveKitProvider] Session check: will retry after login", e?.message);
        setError(null); // Clear error state
        return null;
      }

      const allowPublish = options.allowPublish === true;
      const mode = allowPublish ? "publisher" : "viewer";

      const initKey = `${roomName}:${identity}:${mode}`;

      // ✅ Prevent duplicate connect spam
      if (lastInitRef.current === initKey && serviceRef.current?.isConnected()) {
        console.log("[CONNECT SKIPPED - already connected]", initKey);
        return serviceRef.current;
      }

      if (connectLockRef.current) {
        console.log("[CONNECT LOCK ACTIVE] skipping connect until unlocked");
        return null;
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

        // Fix B: Stop auto-disconnecting "existing session"
        if (serviceRef.current) {
           const isSameRoom = serviceRef.current.roomName === roomName; 
           const isSameUser = serviceRef.current.identity === identity;
           
           // Check if permissions have changed (e.g. viewer -> broadcaster)
           const currentAllowPublish = (serviceRef.current as any).config.allowPublish;
           const newAllowPublish = allowPublish;
           const isSameMode = currentAllowPublish === newAllowPublish;
           
           if (isSameRoom && isSameUser && isSameMode && serviceRef.current.isConnected()) {
               console.log("[LiveKitProvider] Re-using existing service (same room/user/mode)");
               return serviceRef.current;
           }

           if (serviceRef.current.publishingInProgress) {
               console.warn("[LiveKitProvider] 🚫 Prevented disconnect during publish");
               return serviceRef.current;
           }

           console.log("[DISCONNECTING EXISTING SESSION] - Room/User mismatch or forced reconnect");
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
          url: options.url,

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

          onError: async (errorMsg) => {
            // Ignore expected/non-critical errors
            if (
              errorMsg.includes("Client initiated disconnect") ||
              errorMsg.includes("Abort connection attempt") ||
              errorMsg.includes("websocket closed")
            ) {
              console.log("[LiveKit non-error]", errorMsg);
              return;
            }

            // ✅ Don't set error for session-related messages (expected on load)
            const errorLower = errorMsg.toLowerCase();
            const isSessionError = errorLower.includes('session') ||
                                 errorLower.includes('sign in') ||
                                 errorLower.includes('no active session') ||
                                 errorLower.includes('please sign in again');

            if (isSessionError) {
              console.log("[LiveKitProvider] Session error (expected) — not setting error state", errorMsg);
              setIsConnecting(false);
              return; // Don't set error or call onError for session issues
            }

            // For live streams (broadcasters), don't disconnect on errors - keep stream running
            const isBroadcaster = options.allowPublish === true;
            if (isBroadcaster && isConnected) {
              console.warn("[LiveKit error during live stream]", errorMsg);
              // Send notification to admins instead of disconnecting
              try {
                await sendAdminNotification(`Live stream error for ${user?.email || user?.id}: ${errorMsg}`);
              } catch (notifyErr) {
                console.error("Failed to send admin notification:", notifyErr);
              }
              // Don't set error state or disconnect - keep stream running
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
        return ok ? serviceRef.current : null;
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

  // ✅ Clear stale session errors on mount/refresh
  useEffect(() => {
    if (error) {
      const errorLower = error?.toLowerCase() || '';
      const isSessionError = errorLower.includes('session') || 
                           errorLower.includes('sign in') || 
                           errorLower.includes('no active session') ||
                           errorLower.includes('please sign in again');
      if (isSessionError) {
        console.log("[LiveKitProvider] Clearing stale session error on mount");
        setError(null);
      }
    }
  }, [error]); // Check error state on mount/change

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
