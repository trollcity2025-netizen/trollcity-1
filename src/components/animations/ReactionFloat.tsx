import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationStore, type ReactionData, type ReactionType } from '../../lib/animationManager';
import { Heart, Flame, Smile, CloudRain, Hand, PartyPopper } from 'lucide-react';
import { cn } from '../../lib/utils';

// Reaction emoji/icons mapping
const reactionIcons: Record<ReactionType, { icon: React.ElementType; color: string; emoji: string }> = {
  heart: { icon: Heart, color: 'text-pink-500', emoji: '❤️' },
  fire: { icon: Flame, color: 'text-orange-500', emoji: '🔥' },
  laugh: { icon: Smile, color: 'text-yellow-500', emoji: '😂' },
  wow: { icon: PartyPopper, color: 'text-amber-500', emoji: '😮' },
  cry: { icon: CloudRain, color: 'text-blue-400', emoji: '😢' },
  clap: { icon: Hand, color: 'text-cyan-400', emoji: '👏' },
  love: { icon: Heart, color: 'text-red-500', emoji: '😍' },
};

interface ReactionFloatProps {
  reaction: ReactionData;
  index: number;
  total: number;
}

// Get random horizontal position
const getRandomX = () => {
  const positions = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  return positions[Math.floor(Math.random() * positions.length)];
};

const ReactionFloat = ({ reaction, index, total }: ReactionFloatProps) => {
  const { reducedMotion, isMobile } = useAnimationStore();
  const { type, username } = reaction;
  const reactionConfig = reactionIcons[type] || reactionIcons.heart;
  
  // Distribute reactions across the screen
  const startX = getRandomX();
  const wobble = Math.random() * 30 - 15;
  
  // Reduce animation complexity on mobile
  const duration = isMobile ? 3 : 4;

  if (reducedMotion) {
    // Simplified version for reduced motion
    return (
      <motion.div
        className={cn(
          'absolute bottom-4 z-40',
          `left-[${startX}%]`
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={cn(
          'flex items-center gap-1 px-3 py-1.5',
          'bg-black/50 backdrop-blur-sm rounded-full',
          'border border-white/10'
        )}>
          <span className="text-lg">{reactionConfig.emoji}</span>
          <span className="text-xs text-white/80">{username}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'absolute z-40 pointer-events-none',
        `left-[${startX}%]`
      )}
      initial={{ 
        opacity: 0, 
        y: 100,
        x: 0,
        scale: 0.5,
        rotate: -10
      }}
      animate={{ 
        opacity: 1,
        y: -100, // Float up
        x: wobble, // Slight horizontal wobble
        scale: [0.5, 1.2, 1, 0.8],
        rotate: [0, wobble / 2, -wobble / 2, 0],
      }}
      exit={{ 
        opacity: 0,
        y: -150,
        scale: 0.3
      }}
      transition={{ 
        duration,
        ease: 'easeOut',
        times: [0, 0.1, 0.5, 1],
      }}
      style={{
        bottom: `${10 + (index * 5) % 40}%`, // Distribute vertically
      }}
    >
      {/* Reaction bubble */}
      <motion.div
        className={cn(
          'flex items-center gap-1 px-3 py-1.5',
          'bg-black/60 backdrop-blur-md rounded-full',
          'border border-white/10 shadow-lg',
          reactionConfig.color
        )}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 0.5,
          repeat: 1,
          repeatDelay: 1
        }}
      >
        {/* Icon */}
        <motion.span
          className="text-lg"
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, 15, -15, 0]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatDelay: 1
          }}
        >
          {reactionConfig.emoji}
        </motion.span>
        
        {/* Username (optional, can be hidden for cleaner look) */}
        <span className="text-xs font-medium text-white/80 max-w-[80px] truncate">
          {username}
        </span>
      </motion.div>

      {/* Trail particles */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute -bottom-2 left-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: i === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
          }}
          initial={{ 
            opacity: 0.8,
            x: 0,
            y: 0
          }}
          animate={{ 
            opacity: 0,
            y: -20 - (i * 10),
            x: (Math.random() - 0.5) * 10,
            scale: [1, 0.5, 0]
          }}
          transition={{
            duration: duration * 0.8,
            delay: i * 0.1,
            ease: 'easeOut'
          }}
        />
      ))}
    </motion.div>
  );
};

// Container for all floating reactions
export function ReactionsFloatContainer() {
  const { reactions, isMobile } = useAnimationStore();

  // Limit reactions on mobile for performance
  const displayReactions = isMobile 
    ? reactions.slice(-10) 
    : reactions.slice(-20);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence mode="popLayout">
        {displayReactions.map((reaction, index) => (
          <ReactionFloat
            key={reaction.id}
            reaction={reaction}
            index={index}
            total={displayReactions.length}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ReactionFloat;
