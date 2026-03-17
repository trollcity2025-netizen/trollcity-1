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
  const config = giftConfigs[gift.type] || giftConfigs.heart;

  // Reduce animation complexity on mobile
  const isSmall = isMobile || !config.isLarge;

  if (reducedMotion) {
    // Simplified version for reduced motion
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
          'bg-black/70 backdrop-blur-xl px-8 py-6 rounded-3xl',
          'border border-white/20 shadow-2xl'
        )}>
          <div className="text-6xl">{config.emoji}</div>
          <div className="text-center">
            <p className="text-white font-bold">
              <span className="text-cyan-400">{gift.senderName}</span> sent {gift.amount}x {config.name}
            </p>
            <p className="text-zinc-400 text-sm">to {gift.receiverName}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Main gift container */}
      <motion.div
        className={cn(
          'relative flex flex-col items-center gap-4',
          'bg-black/80 backdrop-blur-2xl px-10 py-8 rounded-3xl',
          'border border-white/20 shadow-[0_0_60px_rgba(255,255,255,0.1)]'
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
        {/* Glow background */}
        <motion.div
          className={cn(
            'absolute inset-0 rounded-3xl opacity-30',
            `bg-gradient-to-br ${config.color}`
          )}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
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
            {config.emoji}
          </motion.span>
          
          {/* Particle burst */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{ 
                backgroundColor: config.particleColor,
                left: '50%',
                top: '50%'
              }}
              initial={{ 
                x: 0, 
                y: 0, 
                scale: 1,
                opacity: 1
              }}
              animate={{
                x: Math.cos((i * 30) * Math.PI / 180) * 80,
                y: Math.sin((i * 30) * Math.PI / 180) * 80,
                opacity: [1, 0],
                scale: [1, 0]
              }}
              transition={{
                duration: 0.8,
                ease: 'easeOut'
              }}
            />
          ))}
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
            {gift.amount}x {config.name}
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
              'bg-gradient-to-r from-yellow-400 to-orange-500',
              'px-4 py-2 rounded-full font-bold text-black',
              'shadow-lg'
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
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-3 h-3 rounded-full"
              style={{ 
                backgroundColor: config.particleColor,
                left: `${Math.random() * 100}%`,
                top: '100%'
              }}
              animate={{
                y: -1000,
                x: (Math.random() - 0.5) * 200,
                opacity: [1, 1, 0],
                scale: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 2 + Math.random(),
                repeat: 1,
                ease: 'easeOut'
              }}
            />
          ))}
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
