import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
}

export default function HLSPlayer({ src, className, autoPlay }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(e => console.error('Auto-play failed', e));
        }
      });
      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        if (autoPlay) {
          video.play().catch(e => console.error('Auto-play failed', e));
        }
      });
    }
  }, [src, autoPlay]);

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      muted={autoPlay} // Auto-play often requires mute
    />
  );
}
