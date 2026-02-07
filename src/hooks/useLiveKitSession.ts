import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveKit } from "./useLiveKit";
import { toast } from "sonner";
import { createLocalTracks } from "livekit-client";
import { useNavigate } from "react-router-dom";

interface SessionOptions {
  roomName: string;
  user: any;
  role?: string;
  allowPublish?: boolean;
  autoPublish?: boolean;
  maxParticipants?: number;
  audio?: boolean;
  video?: boolean;

  // New connection gating props
  token?: string;
  serverUrl?: string;
  connect?: boolean;
  identity?: string;
}

export function useLiveKitSession(options: SessionOptions) {
  const {
    connect,
    disconnect,
    startPublishing,
    toggleCamera,
    toggleMicrophone,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    service,
    getRoom,
  } = useLiveKit();

  const navigate = useNavigate();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const joinStartedRef = useRef(false);
  const publishInProgressRef = useRef(false);

  const maxParticipants = options.maxParticipants ?? 6;

  /**
   * ✅ Clears "session-related" errors (expected on load before login)
   */
  useEffect(() => {
    if (!error) return;

    const err = error.toLowerCase();
    const isSessionError =
      err.includes("session") ||
      err.includes("sign in") ||
      err.includes("no active session") ||
      err.includes("no valid user session") ||
      err.includes("please sign in again");

    if (isSessionError) {
      console.log(
        "[useLiveKitSession] Detected session error in context (expected) — ignoring"
      );
    }
  }, [error]);

  /**
   * ✅ Stable join/publish helper
   */
  const joinAndPublish = useCallback(
    async (mediaStream?: MediaStream, tokenOverride?: string) => {
      if (joinStartedRef.current) {
        console.warn("🚫 joinAndPublish ignored: already in progress");
        return false;
      }

      // ✅ Hard guard: never run without roomName
      if (!options.roomName || options.roomName.trim() === "") {
        return false;
      }

      // ✅ Prevent attempts if context holds session error
      if (error) {
        const errLower = error.toLowerCase();
        const isSessionError =
          errLower.includes("session") ||
          errLower.includes("sign in") ||
          errLower.includes("no active session") ||
          errLower.includes("no valid user session") ||
          errLower.includes("please sign in again");

        if (isSessionError) {
          console.log(
            "[useLiveKitSession] Session error in context — skipping connect"
          );
          return false;
        }
      }

      // ✅ Verify session quickly
      let hasValidSession = !!options.user?.id;
      if (!hasValidSession) {
        const { supabase } = await import("../lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        hasValidSession = !!sessionData.session;
      }

      if (!hasValidSession) {
        console.log("[useLiveKitSession] No active session — skipping connect");
        return false;
      }

      const roomName = options.roomName;
      const identity = options.identity || options.user?.identity;
      const token = tokenOverride || options.token;
      const serverUrl = options.serverUrl;
      const allowPublish = options.allowPublish !== false;
      const autoPublish = options.autoPublish !== false;

      if (!roomName || !identity || !token || !serverUrl) {
        console.log("[useLiveKitSession] Missing requirements — skipping connect", {
          roomName,
          identity,
          hasToken: !!token,
          serverUrl,
        });
        return false;
      }

      console.log("[useLiveKitSession] joinAndPublish triggered", {
        roomName,
        identity,
        allowPublish,
        autoPublish,
        hasToken: !!token,
        serverUrl,
      });

      joinStartedRef.current = true;
      setSessionError(null);

      try {
        // ✅ Connect
        console.log("[useLiveKitSession] Connecting to LiveKit...");

        const connectedService = (await connect(roomName, options.user, {
          allowPublish,
          preflightStream: mediaStream,
          autoPublish: false,
          tokenOverride: token,
          serverUrl, // ✅ CRITICAL: Use correct LiveKit server
        } as any)) as any;

        if (!connectedService) {
          // attempt to collect error details
          const serviceError =
            connectedService?.getLastConnectionError?.() ||
            service?.getLastConnectionError?.() ||
            error ||
            "";

          // ✅ Handle Server Full (LiveKit Limit)
          if (String(serviceError).includes("Server is full")) {
            console.warn("[useLiveKitSession] Server is full, redirecting home");
            toast.error("Server is full (max 100 users). Redirecting to homepage...", { duration: 4000 });
            navigate("/");
            joinStartedRef.current = false;
            return false;
          }

          const errLower = String(serviceError).toLowerCase();

          // session-related? skip toast
          const isSessionError =
            !errLower ||
            errLower.includes("session") ||
            errLower.includes("sign in") ||
            errLower.includes("no active session") ||
            errLower.includes("no valid user session");

          if (isSessionError) {
            console.log("[useLiveKitSession] connect skipped (session not ready)");
            joinStartedRef.current = false;
            return false;
          }

          console.error("[useLiveKitSession] ❌ connect failed", serviceError);
          toast.error(`LiveKit connection failed: ${serviceError}`, {
            duration: 6000,
          });

          setSessionError(String(serviceError));
          joinStartedRef.current = false;
          return false;
        }

        console.log("[useLiveKitSession] ✅ LiveKit connected");

        // ✅ Ensure room exists
        const activeRoom =
          connectedService?.getRoom?.() ||
          (typeof getRoom === "function" ? getRoom() : null);

        if (!activeRoom) throw new Error("LiveKit room missing after connect");

        // ✅ Enforce max participants
        if (participants.size > maxParticipants) {
          disconnect();
          throw new Error("Room is full");
        }

        try {
          const activeRoomParticipant = activeRoom.localParticipant;
          const userIdForCar = options.user?.id;
          if (activeRoomParticipant && userIdForCar && typeof window !== "undefined") {
            let baseMetadata: any = {};
            if (activeRoomParticipant.metadata) {
              try {
                baseMetadata = JSON.parse(activeRoomParticipant.metadata);
              } catch {
                baseMetadata = {};
              }
            }

            let carPayload: any = null;
            try {
              const storageKey = `trollcity_car_${userIdForCar}`;
              const raw = window.localStorage.getItem(storageKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                  carPayload = parsed;
                }
              }
            } catch {
              carPayload = null;
            }

            if (carPayload) {
              const merged = { ...baseMetadata, car: carPayload };
              await activeRoomParticipant.setMetadata(JSON.stringify(merged));
            }
          }
        } catch (metaError) {
          console.warn("[useLiveKitSession] metadata update failed", metaError);
        }

        /**
         * ✅ Publishing (host only)
         */
        if (allowPublish && autoPublish) {
          if (publishInProgressRef.current) return true;

          publishInProgressRef.current = true;
          if (connectedService) connectedService.publishingInProgress = true;

          try {
            console.log("[useLiveKitSession] Publishing local tracks...");

            const tracks = await createLocalTracks({
              audio: options.audio ?? true,
              video: options.video ?? true,
            });

            const videoTrack = tracks.find((t) => t.kind === "video");
            const audioTrack = tracks.find((t) => t.kind === "audio");

            if (videoTrack && connectedService?.publishVideoTrack) {
              await connectedService.publishVideoTrack(videoTrack.mediaStreamTrack);
            }

            // small delay makes some browsers happier
            await new Promise((r) => setTimeout(r, 150));

            if (audioTrack && connectedService?.publishAudioTrack) {
              await connectedService.publishAudioTrack(audioTrack.mediaStreamTrack);
            }

            console.log("[useLiveKitSession] ✅ Tracks published");
          } catch (spErr: any) {
            console.error("[useLiveKitSession] Publishing failed", spErr);
            throw new Error(
              `Failed to publish tracks: ${spErr?.message || "Unknown error"}`
            );
          } finally {
            publishInProgressRef.current = false;
            if (connectedService) connectedService.publishingInProgress = false;
          }
        } else if (allowPublish && !autoPublish) {
          console.log(
            "[useLiveKitSession] Publishing allowed but autoPublish disabled"
          );
        } else {
          console.log("[useLiveKitSession] Viewer joined without publishing");
        }

        return true;
      } catch (err: any) {
        console.error("[useLiveKitSession] joinAndPublish failed", err);
        setSessionError(err?.message || "Failed to join stream");
        joinStartedRef.current = false;
        throw err;
      }
    },
    [
      connect,
      disconnect,
      options.roomName,
      options.user,
      options.token,
      options.serverUrl,
      options.allowPublish,
      options.autoPublish,
      options.audio,
      options.video,
      options.identity,
      maxParticipants,
      participants.size,
      error,
      service,
      getRoom,
      navigate,
    ]
  );

  /**
   * ✅ Connect automatically when `options.connect === true`
   * Only runs when requirements are met.
   */
  useEffect(() => {
    if (!options.connect) return;

    if (isConnected || isConnecting || joinStartedRef.current) return;

    if (!options.roomName?.trim()) return;
    if (!options.token || !options.serverUrl) return;

    console.log("[useLiveKitSession] connect prop true, triggering joinAndPublish");
    joinAndPublish(undefined, options.token);
  }, [
    options.connect,
    options.roomName,
    options.token,
    options.serverUrl,
    isConnected,
    isConnecting,
    joinAndPublish,
  ]);

  /**
   * ✅ Viewer-only join helper
   */
  const joinOnly = useCallback(async () => {
    if (joinStartedRef.current) {
      console.warn("🚫 joinOnly ignored: already in progress");
      return false;
    }

    if (!options.roomName || !options.user?.identity) {
      const msg = "Missing room or user for LiveKit";
      setSessionError(msg);
      throw new Error(msg);
    }

    joinStartedRef.current = true;
    setSessionError(null);

    try {
      const connected = await connect(options.roomName, options.user, {
        allowPublish: false,
        preflightStream: undefined,
        autoPublish: false,
        serverUrl: options.serverUrl,
        tokenOverride: options.token,
      } as any);

      if (!connected) {
        const serviceError = service?.getLastConnectionError?.() || error || "";
        
        if (String(serviceError).includes("Server is full")) {
          toast.error("Server is full (max 100 users). Redirecting to homepage...", { duration: 4000 });
          navigate("/");
          joinStartedRef.current = false;
          return false;
        }
        
        throw new Error("LiveKit connection failed");
      }

      console.log("[useLiveKitSession] ✅ joinOnly connected");
      return true;
    } catch (err: any) {
      console.error("[useLiveKitSession] joinOnly failed", err);
      setSessionError(err?.message || "Failed to join stream");
      joinStartedRef.current = false;
      return false;
    }
  }, [connect, options.roomName, options.user, options.token, options.serverUrl, service, error, navigate]);

  const resetJoinGuard = () => {
    joinStartedRef.current = false;
  };

  const guardedDisconnect = () => {
    if (publishInProgressRef.current) {
      console.warn("🚫 Prevented disconnect during publish (guardedDisconnect)");
      return;
    }
    disconnect();
  };

  useEffect(() => {
    return () => {
      joinStartedRef.current = false;
    };
  }, []);

  return {
    joinAndPublish,
    joinOnly,
    resetJoinGuard,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: sessionError || error,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    disconnect: guardedDisconnect,
  };
}
