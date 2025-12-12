import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LuckyWinOverlayProps {
  multiplier: number;
  trollmondsAwarded: number;
  isVisible: boolean;
  onComplete: () => void;
}

const LuckyWinOverlay: React.FC<LuckyWinOverlayProps> = ({
  multiplier,
  trollmondsAwarded,
  isVisible,
  onComplete
}) => {
  const [showBurst, setShowBurst] = useState(false);
  const [showMultiplier, setShowMultiplier] = useState(false);
  const [showTrollmonds, setShowTrollmonds] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Play lucky sound
      const audio = new Audio('/sounds/lucky-win.mp3');
      audio.volume = 0.7;
      audio.play().catch(() => {
        // Fallback: create beep sound
        const beep = new AudioContext();
        const oscillator = beep.createOscillator();
        const gainNode = beep.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(beep.destination);

        oscillator.frequency.setValueAtTime(800, beep.currentTime);
        oscillator.frequency.setValueAtTime(1200, beep.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, beep.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, beep.currentTime + 0.3);

        oscillator.start(beep.currentTime);
        oscillator.stop(beep.currentTime + 0.3);
      });

      // Screen flash effect
      document.body.style.backgroundColor = '#FFD700';
      setTimeout(() => {
        document.body.style.backgroundColor = '';
      }, 200);

      // Animation sequence
      setTimeout(() => setShowBurst(true), 100);
      setTimeout(() => setShowMultiplier(true), 300);
      setTimeout(() => setShowTrollmonds(true), 800);
      setTimeout(() => {
        onComplete();
      }, 3000);
    }
  }, [isVisible, onComplete]);

  const getMultiplierColor = (mult: number) => {
    switch (mult) {
      case 100: return '#FFD700'; // Gold
      case 200: return '#FF6B35'; // Orange
      case 500: return '#FF1493'; // Hot Pink
      case 1000: return '#00FFFF'; // Cyan
      case 10000: return '#FF0000'; // Red
      default: return '#FFD700';
    }
  };

  const getMultiplierGlow = (mult: number) => {
    switch (mult) {
      case 100: return '0 0 20px #FFD700, 0 0 40px #FFD700';
      case 200: return '0 0 25px #FF6B35, 0 0 50px #FF6B35';
      case 500: return '0 0 30px #FF1493, 0 0 60px #FF1493';
      case 1000: return '0 0 35px #00FFFF, 0 0 70px #00FFFF';
      case 10000: return '0 0 40px #FF0000, 0 0 80px #FF0000';
      default: return '0 0 20px #FFD700, 0 0 40px #FFD700';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 50%, transparent 70%)'
          }}
        >
          {/* Burst particles */}
          <AnimatePresence>
            {showBurst && (
              <div className="absolute inset-0">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: '50vw',
                      y: '50vh',
                      scale: 0,
                      rotate: 0
                    }}
                    animate={{
                      x: `${50 + (Math.random() - 0.5) * 100}vw`,
                      y: `${50 + (Math.random() - 0.5) * 100}vh`,
                      scale: [0, 1, 0],
                      rotate: Math.random() * 360
                    }}
                    transition={{
                      duration: 2,
                      ease: "easeOut"
                    }}
                    className="absolute w-4 h-4 rounded-full"
                    style={{
                      background: getMultiplierColor(multiplier),
                      boxShadow: `0 0 10px ${getMultiplierColor(multiplier)}`
                    }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Main multiplier display */}
          <AnimatePresence>
            {showMultiplier && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{
                  scale: [0, 1.5, 1],
                  rotate: [0, 360, 0]
                }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut"
                }}
                className="text-center"
              >
                <motion.h1
                  animate={{
                    textShadow: [
                      getMultiplierGlow(multiplier),
                      '0 0 0px #FFD700',
                      getMultiplierGlow(multiplier)
                    ]
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="text-8xl font-black mb-4"
                  style={{
                    color: getMultiplierColor(multiplier),
                    fontFamily: 'Impact, sans-serif',
                    textShadow: getMultiplierGlow(multiplier)
                  }}
                >
                  LUCKY
                </motion.h1>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-6xl font-bold"
                  style={{
                    color: getMultiplierColor(multiplier),
                    textShadow: getMultiplierGlow(multiplier)
                  }}
                >
                  x{multiplier.toLocaleString()}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trollmonds awarded */}
          <AnimatePresence>
            {showTrollmonds && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-center"
              >
                <div className="text-2xl font-bold text-white mb-2">
                  +{trollmondsAwarded.toLocaleString()} Trollmonds!
                </div>
                <div className="text-lg text-yellow-300">
                  💎 Spark Energy Gained
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LuckyWinOverlay;