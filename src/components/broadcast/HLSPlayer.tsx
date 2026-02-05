import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, RefreshCw } from 'lucide-react';

interface HLSPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}

export default function HLSPlayer({ src, className, autoPlay = true, muted = false }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCount = useRef(0);
  const maxRetries = 10;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset error state on new src
    setError(null);
    setIsRetrying(false);
    retryCount.current = 0;

    let hls: Hls | null = null;

    // 1. Validate URL extension
    if (!src.endsWith('.m3u8')) {
        console.error("Invalid HLS URL (must end in .m3u8):", src);
        setError("Invalid stream configuration");
        return;
    }

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // Aggressive recovery for live streams
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 1000,
        // Custom loader or check? hls.js doesn't easily expose pre-check without custom loader.
        // But we can check response headers in the error handler if possible, or trust the extension check + error handler.
      });

      // 5. Detailed Error Logging
      hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error("HLS ERROR", { 
            type: data.type, 
            details: data.details, 
            fatal: data.fatal, 
            url: (data as any).url || src, 
            response: (data as any).response 
          });

          // 3. Hard-fail if HTML is returned or Manifest Parsing fails
          if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
              console.warn("HLS Playback Warning: Manifest parsing failed. Likely receiving HTML (404 fallback) instead of m3u8.");
              hls?.destroy();
              setError("Stream Offline (Waiting for Broadcast)"); 
              return;
          }

          if (data.response && data.response.code === 200) {
              const contentType = data.response.headers ? (data.response.headers['content-type'] || '') : '';
              // Sometimes headers aren't available in the error object depending on the error type,
              // but if it parsed successfully as HTML and failed manifest parsing, it usually triggers PARSING_ERROR.
              // If it's a network load that returned 200 but was HTML, hls.js might try to parse it.
              if (contentType.includes('text/html') || (data as any).response.text?.includes('<!DOCTYPE html>')) {
                  console.error("CRITICAL: Received HTML instead of HLS playlist. Check hosting rewrites.");
                  hls?.destroy();
                  setError("Stream configuration error (Hosting)");
                  return;
              }
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('fatal network error encountered, try to recover');
                
                if (retryCount.current < maxRetries) {
                    setIsRetrying(true);
                    retryCount.current++;
                    hls?.startLoad();
                } else {
                    setError("Stream offline or unreachable");
                    setIsRetrying(false);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('fatal media error encountered, try to recover');
                hls?.recoverMediaError();
                break;
              default:
                hls?.destroy();
                setError("Playback error");
                break;
            }
          }
      });

      const attach = () => {
          if (!hls) return;
          hls.loadSource(src);
          hls.attachMedia(video);
      };

      attach();

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        setIsRetrying(false);
        if (autoPlay) {
          video.play().catch(e => console.error("Auto-play failed:", e));
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        if (autoPlay) {
          video.play().catch(e => console.error("Auto-play failed:", e));
        }
      });
      video.addEventListener('error', () => {
          setError("Stream offline");
      });
    }
    
    return () => {
      if (hls) {
          hls.destroy();
      }
    };
  }, [src, autoPlay]);

  const handleManualRetry = () => {
      setError(null);
      setIsRetrying(true);
      retryCount.current = 0;
      // Force re-mount or re-init logic if needed, 
      // but simpler is to let the user refresh or just wait for the effect to re-run if we changed a key.
      // Ideally we just clear error and the HLS instance might need a kick, but since we are inside the component, 
      // we might need to trigger a re-render. 
      // For now, let's just reload the page or expect the user to wait. 
      // Actually, simplest is to window.location.reload() for a hard retry or just re-trigger the src.
      window.location.reload(); 
  };

  return (
    <div className={`relative ${className}`}>
        <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted={muted}
            controls={false}
        />
        
        {/* Error / Retry Overlay */}
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
