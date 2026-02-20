import React, { useEffect, useRef } from 'react';

interface MuxViewerProps {
  playbackId: string;
}

export default function MuxViewer({ playbackId }: MuxViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!playbackId || !videoRef.current) return;
    const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;

    // Use native HTML5 HLS where supported; otherwise rely on Hls.js if available.
    const video = videoRef.current;
    if ((video as any).canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
      return;
    }

    // dynamic import of hls.js to avoid adding it to client bundle unless needed
    let hls: any = null;
    import('hls.js')
      .then((Hls) => {
        hls = new (Hls.default || Hls)();
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      })
      .catch((err) => console.warn('Failed to load hls.js', err));

    return () => {
      if (hls) {
        try {
          hls.destroy();
        } catch (e) {
          /* ignore */
        }
      }
    };
  }, [playbackId]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-full bg-black"
      playsInline
      muted={false}
    />
  );
}
