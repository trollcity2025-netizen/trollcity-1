import React, { useEffect } from 'react';
import { audioManager } from '@/lib/audioManager';

interface GoldenBuzzerEffectProps {
  isExploding: boolean;
}

const GoldenBuzzerEffect: React.FC<GoldenBuzzerEffectProps> = ({ isExploding }) => {
  useEffect(() => {
    if (isExploding) {
      document.body.classList.add('screen-shake');
      audioManager.playSound('/sounds/golden-buzzer.mp3');
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      const timer = setTimeout(() => {
        document.body.classList.remove('screen-shake');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isExploding]);

  if (!isExploding) {
    return null;
  }

  return (
    <div className={`golden-buzzer-overlay active`}>
      <div className="gb-flash"></div>
      <div className="gb-explosion">
        <div className="gb-shockwave"></div>
        <div className="gb-rays"></div>
        <div className="gb-center-glow"></div>
      </div>
    </div>
  );
};

export default GoldenBuzzerEffect;
