
import React, { useEffect, useRef } from 'react';
import { ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import VotingPanel from './VotingPanel';

interface PerformerBoxProps {
  videoTrack?: ICameraVideoTrack | null;
  isJudge?: boolean;
  auditionId?: string;
  onGoldenBuzzer: () => void;
}

const PerformerBox: React.FC<PerformerBoxProps> = ({ videoTrack, isJudge = false, auditionId = 'test-audition-id', onGoldenBuzzer }) => {
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
      className="relative aspect-video bg-gray-800 border-2 border-gold-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.5)]"
    >
      {!videoTrack && <p className="text-white">Performer Video</p>}
      <VotingPanel 
        performerName="Performer Name" 
        initialCoinBalance={0}
        isJudge={isJudge}
        auditionId={auditionId}
        onGoldenBuzzer={onGoldenBuzzer}
      />
    </div>
  );
};

export default PerformerBox;
