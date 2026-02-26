
import React, { useEffect, useRef } from 'react';
import { ICameraVideoTrack } from 'agora-rtc-sdk-ng';

interface JudgeBoxProps {
  videoTrack?: ICameraVideoTrack | null;
}

const JudgeBox: React.FC<JudgeBoxProps> = ({ videoTrack }) => {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoTrack.play(videoRef.current);
    }

    return () => {
      videoTrack?.stop();
    };
  }, [videoTrack]);

  return (
    <div 
      ref={videoRef} 
      className="aspect-video bg-gray-900 border border-gold-700 rounded-md flex items-center justify-center shadow-[0_0_10px_rgba(184,134,11,0.5)]"
    >
      {!videoTrack && <p className="text-white text-sm">Judge Video</p>}
    </div>
  );
};

export default JudgeBox;
