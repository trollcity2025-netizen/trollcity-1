// 🔥 Gift Combo Display - Shows rapid gift combo animations
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { giftEffectsMap } from '../../lib/giftEngine';

interface GiftComboDisplayProps {
  comboCount: number;
  giftId: string | null;
  className?: string;
}

export default function GiftComboDisplay({
  comboCount,
  giftId,
  className,
}: GiftComboDisplayProps) {
  // Don't show if combo is 0 or 1
  if (comboCount <= 1 || !giftId) {
    return null;
  }
  
  const effect = giftEffectsMap[giftId];
  const icon = effect?.icon || '🎁';
  const name = effect?.name || 'Gift';
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [1, 1.2, 1], opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ 
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className={cn(
          "absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none",
          className
        )}
        style={{
          // GPU acceleration
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
      >
        {/* Combo container */}
        <div className="relative flex items-center gap-2">
          {/* Fire icons */}
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 0.3,
              repeat: Infinity,
            }}
            className="text-2xl filter drop-shadow-lg"
          >
            🔥
          </motion.div>
          
          {/* Combo count */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ 
              duration: 0.3,
              repeat: Infinity,
              repeatDelay: 0.1,
            }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-xl opacity-50" />
            
            {/* Text */}
            <span 
              className="relative text-4xl font-black italic tracking-wider"
              style={{
                background: 'linear-gradient(to right, #fbbf24, #f97316, #ef4444)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(249, 115, 22, 0.8)',
                filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.8))',
              }}
            >
              x{comboCount}
            </span>
          </motion.div>
          
          {/* Fire icons */}
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 0.3,
              repeat: Infinity,
              delay: 0.1,
            }}
            className="text-2xl filter drop-shadow-lg"
          >
            🔥
          </motion.div>
          
          {/* Gift info */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full"
          >
            <span className="text-xl">{icon}</span>
            <span className="text-sm font-bold text-white">{name}</span>
          </motion.div>
        </div>
        
        {/* Particle effects */}
        <motion.div
          className="absolute -inset-4 pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ['#fbbf24', '#f97316', '#ef4444', '#fbbf24', '#f97316', '#ef4444'][i],
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [0, Math.cos(i * 60 * Math.PI / 180) * 80],
                y: [0, Math.sin(i * 60 * Math.PI / 180) * 80],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
