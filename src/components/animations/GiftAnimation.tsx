import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationStore, type GiftAnimationData, type GiftType } from '../../lib/animationManager';
import { cn } from '../../lib/utils';

// Gift type configurations
const giftConfigs: Record<GiftType, { 
  emoji: string; 
  name: string; 
  color: string; 
  particleColor: string;
  scale: number;
  isLarge: boolean;
}> = {
  rose: { 
    emoji: '🌹', 
    name: 'Rose', 
    color: 'from-red-400 to-pink-500',
    particleColor: '#ec4899',
    scale: 1,
    isLarge: false
  },
  heart: { 
    emoji: '💕', 
    name: 'Heart', 
    color: 'from-pink-400 to-red-500',
    particleColor: '#f43f5e',
    scale: 1.2,
    isLarge: false
  },
  diamond: { 
    emoji: '💎', 
    name: 'Diamond', 
    color: 'from-cyan-400 to-blue-500',
    particleColor: '#06b6d4',
    scale: 1.5,
    isLarge: true
  },
  crown: { 
    emoji: '👑', 
    name: 'Crown', 
    color: 'from-yellow-400 to-amber-500',
    particleColor: '#fbbf24',
    scale: 1.8,
    isLarge: true
  },
  star: {
    emoji: '⭐',
    name: 'Star',
    color: 'from-yellow-300 to-orange-400',
    particleColor: '#f59e0b',
    scale: 1.4,
    isLarge: true
  },
  trophy: {
    emoji: '🏆',
    name: 'Trophy',
    color: 'from-amber-500 to-orange-600',
    particleColor: '#fb923c',
    scale: 1.7,
    isLarge: true
  },
  coffee: {
    emoji: '☕',
    name: 'Coffee',
    color: 'from-amber-500 to-amber-700',
    particleColor: '#d97706',
    scale: 1.1,
    isLarge: false
  },
  pizza: {
    emoji: '🍕',
    name: 'Pizza',
    color: 'from-orange-500 to-red-500',
    particleColor: '#f87171',
    scale: 1.2,
    isLarge: false
  },
  car: { 
    emoji: '🚗', 
    name: 'Car', 
    color: 'from-purple-400 to-indigo-500',
    particleColor: '#8b5cf6',
    scale: 2,
    isLarge: true
  },
  house: { 
    emoji: '🏠', 
    name: 'House', 
    color: 'from-green-400 to-emerald-500',
    particleColor: '#10b981',
    scale: 2.2,
    isLarge: true
  },
  rocket: { 
    emoji: '🚀', 
    name: 'Rocket', 
    color: 'from-orange-400 to-red-500',
    particleColor: '#f97316',
    scale: 2.5,
    isLarge: true
  },
  dragon: { 
    emoji: '🐉', 
    name: 'Dragon', 
    color: 'from-emerald-400 to-green-600',
    particleColor: '#34d399',
    scale: 3,
    isLarge: true
  },
};

interface GiftAnimationProps {
  gift: GiftAnimationData;
}

// Gift animation component
const GiftAnimation = ({ gift }: GiftAnimationProps) => {
  const { reducedMotion, isMobile } = useAnimationStore();
  const [pixelRatio, setPixelRatio] = useState(1);
  const config = giftConfigs[gift.type] || giftConfigs.heart;
  const displayIcon = gift.giftIcon || config.emoji;
  const displayName = gift.giftName || config.name;

  useEffect(() => {
    setPixelRatio(window.devicePixelRatio || 1);
    const onChange = () => setPixelRatio(window.devicePixelRatio || 1);
    window.matchMedia('(resolution: 2dppx)').addEventListener('change', onChange);
    return () => window.matchMedia('(resolution: 2dppx)').removeEventListener('change', onChange);
  }, []);

  // Reduce animation complexity on mobile
  const isSmall = isMobile || !config.isLarge;

  if (reducedMotion) {
    // Simplified version for reduced motion (transparent background)
    return (
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={cn(
          'flex flex-col items-center gap-4',
          'bg-transparent px-0 py-0',
          'border-none shadow-none'
        )}>
          <div className="text-6xl">{displayIcon}</div>
          <div className="text-center">
            <p className="text-white font-bold">
              <span className="text-cyan-400">{gift.senderName}</span> sent {gift.amount}x {displayName}
            </p>
            <p className="text-zinc-400 text-sm">to {gift.receiverName}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const highRes = pixelRatio >= 2;
  const particleCount = highRes ? 32 : 16;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      style={{
        perspective: highRes ? 2200 : 1000,
        transformStyle: 'preserve-3d',
        imageRendering: 'auto',
        filter: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Main gift container */}
      <motion.div
        className={cn(
          'relative flex flex-col items-center gap-4',
          'bg-transparent px-0 py-0',
          'border-none shadow-none'
        )}
        initial={{ scale: 0.5, y: 100 }}
        animate={{ 
          scale: 1, 
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 300,
            damping: 20
          }
        }}
        exit={{ 
          scale: 0.8, 
          y: -50,
          opacity: 0,
          transition: { duration: 0.3 }
        }}
      >
        {/* Glow background (soft particle aura, no framed box) */}
        <motion.div
          className={cn(
            'absolute inset-0 opacity-0',
            'pointer-events-none'
          )}
          animate={{
            opacity: [0, 0.1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{
            background: `radial-gradient(circle at center, ${config.particleColor}30, transparent 45%)`,
            filter: 'blur(16px)'
          }}
        />

        {/* Gift emoji with scale animation */}
        <motion.div
          className="relative z-10"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <motion.span
            className="text-8xl"
            style={{ 
              scale: config.scale,
              filter: `drop-shadow(0 0 20px ${config.particleColor})`
            }}
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            {displayIcon}
          </motion.span>
          
          {/* Particle burst */}
          {[...Array(particleCount)].map((_, i) => {
            const angle = (i * 360 / particleCount) * Math.PI / 180;
            return (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{ 
                  width: highRes ? 3 : 2,
                  height: highRes ? 3 : 2,
                  backgroundColor: config.particleColor,
                  left: '50%',
                  top: '50%',
                  boxShadow: `0 0 ${highRes ? 18 : 8}px ${config.particleColor}`,
                }}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 1,
                  opacity: 1
                }}
                animate={{
                  x: Math.cos(angle) * (100 + (highRes ? 80 : 0)),
                  y: Math.sin(angle) * (100 + (highRes ? 80 : 0)),
                  opacity: [1, 0],
                  scale: [1, 0.2]
                }}
                transition={{
                  duration: 1.1,
                  ease: 'easeOut'
                }}
              />
            )
          })}
        </motion.div>

        {/* Gift info */}
        <div className="relative z-10 text-center">
          {/* Sender */}
          <motion.p
            className="text-xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className={cn(
              'bg-gradient-to-r bg-clip-text text-transparent',
              config.color
            )}>
              {gift.senderName}
            </span>
            {' '}sent
          </motion.p>

          {/* Gift amount and name */}
          <motion.p
            className="text-2xl font-bold text-white mt-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {gift.amount}x {displayName}
          </motion.p>

          {/* Receiver */}
          <motion.p
            className="text-zinc-400 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            to <span className="text-white font-semibold">{gift.receiverName}</span>
          </motion.p>
        </div>

        {/* Amount display */}
        {gift.amount > 1 && (
          <motion.div
            className={cn(
              'absolute -top-4 -right-4',
              'bg-transparent',
              'px-0 py-0 font-bold text-white',
              'shadow-none'
            )}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 500,
              damping: 15,
              delay: 0.5
            }}
          >
            x{gift.amount}
          </motion.div>
        )}
      </motion.div>

      {/* Full screen particle effect for large gifts */}
      {config.isLarge && !isSmall && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(Math.max(18, Math.round(particleCount / 2)))].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{ 
                width: highRes ? 5 : 3,
                height: highRes ? 5 : 3,
                backgroundColor: config.particleColor,
                left: `${Math.random() * 100}%`,
                top: '100%'
              }}
              animate={{
                y: -1600,
                x: (Math.random() - 0.5) * 300,
                opacity: [1, 1, 0],
                scale: [0.6, 1.3, 0.1]
              }}
              transition={{
                duration: 2.6 + Math.random() * 0.8,
                repeat: 1,
                ease: 'easeOut'
              }}
            />
          ))}

          {highRes && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25), transparent 50%)',
              mixBlendMode: 'screen',
            }} />
          )}
        </div>
      )}
    </motion.div>
  );
};

// Container for all gift animations
export function GiftAnimationsContainer() {
  const { giftAnimations } = useAnimationStore();

  // Show ALL gift animations using AnimatePresence for proper stacking
  return (
    <AnimatePresence>
      {giftAnimations.map((gift) => (
        <GiftAnimation key={gift.id} gift={gift} />
      ))}
    </AnimatePresence>
  );
}

export default GiftAnimation;
