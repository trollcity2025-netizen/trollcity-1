
import React, { useState, useEffect, useRef } from 'react';
import './stage-curtains.css';

// --- PROPS INTERFACE ---
interface StageCurtainsProps {
  isOpen: boolean;
  onOpen?: () => void;
}

import { triggerVibration } from '@/lib/utils/vibration';
import { audioManager } from '@/lib/audioManager';

// --- REACT COMPONENT ---

export const StageCurtains: React.FC<StageCurtainsProps> = ({ isOpen, onOpen }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFullyOpen, setIsFullyOpen] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (isOpen && !hasTriggered.current) {
      hasTriggered.current = true;
      setIsAnimating(true);

      // STAGE 1: BUTTON PRESS
            // audioManager.playSound('/sounds/curtain-open.mp3');
      triggerVibration(50);

      // STAGE 2 & 3: CURTAIN MOTION & REVEAL
      // The animation is mostly handled by CSS transitions and keyframes.
      // We just need to set a timeout to know when it's complete.

      // STAGE 4: COMPLETION
      const animationDuration = 2500; // Corresponds to CSS transition + delay
      setTimeout(() => {
        setIsFullyOpen(true);
        setIsAnimating(false);
        if (onOpen) {
          onOpen();
        }
      }, animationDuration);
    }
  }, [isOpen, onOpen]);

  // If the curtains are fully open and not animating, we can render nothing
  if (isFullyOpen) {
    return null;
  }

  return (
    <div className={`curtain-overlay ${isAnimating || !isOpen ? 'active' : ''}`}>
      <div className={`curtain-container ${isOpen ? 'is-open' : ''}`}>
        {/* The Curtains */}
        <div className="curtain curtain-left"></div>
        <div className="curtain curtain-right"></div>

        {/* The Reveal Effects */}
        {isAnimating && (
          <div className="reveal-effects">
            <div className="center-glow"></div>
            <div className="light-sweep-container">
              <div className="light-sweep"></div>
            </div>
            <div className="spotlight-flash"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- EXAMPLE USAGE SNIPPET ---
/*

import { StageCurtains } from './StageCurtains'; // Adjust path
import { Button } from '@/components/ui/button'; // Your button component

const MaiTalentPage = () => {
  const [curtainsOpen, setCurtainsOpen] = useState(false);

  const handleOpenCurtains = () => {
    setCurtainsOpen(true);
  };

  return (
    <div className="relative w-full h-screen bg-black">
      
      // Your stage content goes here
      <div className="absolute inset-0 flex items-center justify-center">
        <h1 className="text-white text-4xl">The Stage is Revealed!</h1>
      </div>

      // The button to open the curtains
      {!curtainsOpen && (
        <div className="absolute inset-0 z-[9991] flex items-center justify-center">
          <Button 
            onClick={handleOpenCurtains}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-2xl px-8 py-6 rounded-full shadow-lg shadow-yellow-500/30 transition-all hover:shadow-yellow-500/50 hover:scale-105"
          >
            Open Curtains
          </Button>
        </div>
      )}

      // The StageCurtains component itself
      <StageCurtains isOpen={curtainsOpen} />

    </div>
  );
}

*/
