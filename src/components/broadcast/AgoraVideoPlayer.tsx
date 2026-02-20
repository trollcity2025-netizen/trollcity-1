import React, { useEffect, useRef } from 'react';
import { ILocalVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

interface AgoraVideoPlayerProps {
  videoTrack: ILocalVideoTrack | IRemoteVideoTrack | undefined | null;
  className?: string;
}

const AgoraVideoPlayer: React.FC<AgoraVideoPlayerProps> = ({ videoTrack, className }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const playerRef = ref.current;
    if (playerRef && videoTrack) {
        if (!playerRef.hasChildNodes()) { // Prevent duplicate players
            videoTrack.play(playerRef, { fit: 'cover' });
        }
    }

    return () => {
      if (videoTrack) {
        try {
            videoTrack.stop();
        } catch (e) {
            console.warn('Error stopping video track:', e);
        }
      }
    };
  }, [videoTrack]);

  // Use a key to force re-mount when track changes, which helps cleanup
  return <div key={videoTrack?.getTrackId()} ref={ref} className={className}></div>;
};

export default AgoraVideoPlayer;
