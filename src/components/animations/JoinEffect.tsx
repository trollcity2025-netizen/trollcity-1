import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationStore, type JoinEffectData } from '../../lib/animationManager';
import { Crown, Shield, Star } from 'lucide-react';
import { cn } from '../../lib/utils';

interface JoinEffectProps {
  effect: JoinEffectData;
}

// Animation variants
const containerVariants = {
  hidden: { 
    opacity: 0, 
    x: -100,
    scale: 0.8 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    x: 100,
    scale: 0.8,
    transition: {
      duration: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 }
};

const badgeVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: { 
    scale: 1, 
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15
    }
  }
};

const JoinEffect = ({ effect }: JoinEffectProps) => {
  const { reducedMotion } = useAnimationStore();

  return (
    <motion.div
      className="absolute left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
      variants={reducedMotion ? {} : containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Glow effect behind */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 blur-xl rounded-full" />

      <div className={cn(
        'flex items-center gap-3 px-4 py-2',
        'bg-black/70 backdrop-blur-xl rounded-full',
        'border border-white/10 shadow-xl',
        'min-w-[200px]'
      )}>
        {/* Avatar with glow */}
        <motion.div 
          className="relative"
          variants={reducedMotion ? {} : itemVariants}
        >
          <div className={cn(
            'w-10 h-10 rounded-full overflow-hidden border-2',
            effect.isGold ? 'border-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' :
            effect.isVip ? 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]' :
            'border-white/20'
          )}>
            <img
              src={effect.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(effect.username)}&background=random`}
              alt={effect.username}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Role badges */}
          <motion.div 
            className="absolute -bottom-1 -right-1"
            variants={reducedMotion ? {} : badgeVariants}
          >
            {effect.isModerator && (
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-black">
                <Shield size={10} className="text-white" />
              </div>
            )}
            {effect.isVip && !effect.isModerator && (
              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black">
                <Star size={10} className="text-white" />
              </div>
            )}
            {effect.isGold && !effect.isModerator && !effect.isVip && (
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black">
                <Crown size={10} className="text-white" />
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Username and label */}
        <motion.div 
          className="flex flex-col"
          variants={reducedMotion ? {} : itemVariants}
        >
          <span className={cn(
            'font-bold text-sm',
            effect.isGold ? 'gold-username' :
            effect.isVip ? 'rgb-username' :
            'text-white'
          )}>
            {effect.username}
          </span>
          <span className="text-xs text-zinc-400">
            joined the stream
          </span>
        </motion.div>
      </div>

      {/* Sparkle effects */}
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute -right-2 top-1/2 w-2 h-2 bg-cyan-400 rounded-full"
            animate={{ 
              scale: [0, 1, 0],
              opacity: [0, 1, 0]
            }}
            transition={{ duration: 0.5, repeat: 2 }}
          />
          <motion.div
            className="absolute -right-4 top-1/3 w-1 h-1 bg-purple-400 rounded-full"
            animate={{ 
              scale: [0, 1, 0],
              opacity: [0, 1, 0]
            }}
            transition={{ duration: 0.4, repeat: 3, delay: 0.2 }}
          />
        </>
      )}
    </motion.div>
  );
};

// Container component that renders all join effects
export function JoinEffectsContainer() {
  const { joinEffects } = useAnimationStore();

  return (
    <AnimatePresence mode="popLayout">
      {joinEffects.map((effect) => (
        <JoinEffect key={effect.id} effect={effect} />
      ))}
    </AnimatePresence>
  );
}

export default JoinEffect;
