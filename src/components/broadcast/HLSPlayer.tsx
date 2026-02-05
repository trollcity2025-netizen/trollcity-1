import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, RefreshCw } from "lucide-react";

interface HLSPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}

function normalizeHlsSrc(src: string): string {
  let finalSrc = src?.trim() ?? "";

  // /streams/<uuid>.m3u8 -> /streams/<uuid>/master.m3u8
  const legacyPattern = /\/streams\/([a-f0-9-]+)\.m3u8$/i;
  const match = finalSrc.match(legacyPattern);
  if (match) {
    const id = match[1];
    finalSrc = `/streams/${id}/master.m3u8`;
    return finalSrc;
  }

  // Force relative proxy instead of direct CDN URL
  if (finalSrc.includes("cdn.maitrollcity.com/streams/")) {
    finalSrc = finalSrc
      .replace("https://cdn.maitrollcity.com/streams/", "/streams/")
      .replace("http://cdn.maitrollcity.com/streams/", "/streams/");
  }

  return finalSrc;
}

export default function HLSPlayer({
  src,
  className,
  autoPlay = true,
  muted = false,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const retryCountRef = useRef(0);
  const maxRetries = 10;

  const finalSrc = useMemo(() => normalizeHlsSrc(src), [src]);

  const clearRetryTimer = () => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleReinit = (delayMs: number) => {
    clearRetryTimer();
    setIsRetrying(true);

    retryTimerRef.current = window.setTimeout(() => {
      setRetryTick((t) => t + 1);
    }, delayMs);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetryTimer();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset state when src changes
  useEffect(() => {
    setError(null);
    setIsRetrying(false);
    retryCountRef.current = 0;
    clearRetryTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    clearRetryTimer();

    // Guard: require m3u8
    if (!finalSrc || !finalSrc.endsWith(".m3u8")) {
      setError("Invalid stream configuration");
      setIsRetrying(false);
      return;
    }

    // Always destroy previous HLS instance before re-init
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Detach any previous native src
    video.pause();
    video.removeAttribute("src");
    video.load();

    const startPlayback = async () => {
      if (!autoPlay) return;
      try {
        await video.play();
      } catch (e) {
        // autoplay may be blocked; not fatal
        console.error("Auto-play failed:", e);
      }
    };

    const pollOffline = () => {
      // Poll slowly when offline
      if (retryCountRef.current >= maxRetries) {
        setIsRetrying(false);
        return;
      }
      retryCountRef.current += 1;
      scheduleReinit(5000);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // reliability-first
        backBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
      });

      hlsRef.current = hls;

      const onError = (_event: any, data: any) => {
        // Offline cases
        const code = data?.response?.code;

        // 404/400 on manifest => offline
        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR && (code === 404 || code === 400)) {
          console.warn("[HLSPlayer] Offline manifest (404/400):", finalSrc);
          setError("Stream Offline (Waiting for Broadcast)");
          pollOffline();
          return;
        }

        // Manifest parsing error often means HTML fallback -> treat as offline + poll
        if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
          console.warn("[HLSPlayer] Manifest parsing error (likely HTML fallback).", {
            url: data?.url || finalSrc,
            response: data?.response,
          });
          setError("Stream Offline (Waiting for Broadcast)");
          pollOffline();
          return;
        }

        console.error("[HLSPlayer] HLS ERROR", {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          url: data?.url || finalSrc,
          response: data?.response,
        });

        // Fatal handling
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (retryCountRef.current >= maxRetries) {
            setError("Stream offline or unreachable");
            setIsRetrying(false);
            return;
          }

          // Exponential backoff: 500ms, 1s, 2s, 4s... capped at 10s
          const attempt = retryCountRef.current;
          const delay = Math.min(500 * Math.pow(2, attempt), 10000);

          retryCountRef.current += 1;
          setError(null);
          scheduleReinit(delay);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
          } catch {
            // If recover fails, re-init
            scheduleReinit(1000);
          }
          return;
        }

        // Everything else: re-init
        scheduleReinit(1000);
      };

      hls.on(Hls.Events.ERROR, onError);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        setIsRetrying(false);
        retryCountRef.current = 0;
        startPlayback();
      });

      hls.loadSource(finalSrc);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = finalSrc;

      const onLoaded = () => {
        setError(null);
        setIsRetrying(false);
        retryCountRef.current = 0;
        startPlayback();
      };

      const onNativeError = () => {
        // Native HLS gives poor error detail; poll offline
        setError("Stream Offline (Waiting for Broadcast)");
        pollOffline();
      };

      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onNativeError);

      return () => {
        video.removeEventListener("error", onNativeError);
      };
    } else {
      setError("HLS not supported in this browser");
      setIsRetrying(false);
    }

    return () => {
      // Cleanup this effect run
      clearRetryTimer();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // retryTick forces re-init without changing src
  }, [finalSrc, autoPlay, retryTick]);

  const handleManualRetry = () => {
    setError(null);
    setIsRetrying(true);
    retryCountRef.current = 0;
    clearRetryTimer();
    setRetryTick((t) => t + 1);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={muted}
        controls={false}
      />

      {(error || isRetrying) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white">
          {isRetrying ? (
            <div className="flex flex-col items-center animate-pulse">
              <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-2" />
              <span className="text-sm font-medium">Connecting to stream...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p className="text-red-400 font-bold mb-4">{error}</p>
              <button
                onClick={handleManualRetry}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
