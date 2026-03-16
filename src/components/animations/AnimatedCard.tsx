import { HTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface AnimatedCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'neon' | 'cyber';
  glowColor?: 'cyan' | 'pink' | 'purple' | 'gold' | 'green';
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'none';
  children: React.ReactNode;
}

// Glassmorphism card variant
const glassStyles = `
  bg-white/5 
  backdrop-blur-xl 
  border border-white/10
  shadow-[0_8px_32px_rgba(0,0,0,0.3)]
`;

// Neon card variant
const neonStyles = (color: string) => `
  bg-zinc-900/90
  border-2 border-${color}-400/50
  shadow-[0_0_20px_rgba(0,0,0,0.3),0_0_30px_rgba(255,255,255,0.05)]
  hover:shadow-[0_0_40px_rgba(0,0,0,0.4),0_0_60px_rgba(255,255,255,0.1)]
`;

// Cyber card variant
const cyberStyles = `
  bg-zinc-950/90
  border border-cyan-500/30
  relative overflow-hidden
  before:absolute before:inset-0 before:bg-gradient-to-br before:from-cyan-500/5 before:to-transparent
  after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-cyan-500/50 after:to-transparent
`;

// Glow colors for neon variant
const glowColors = {
  cyan: {
    border: 'border-cyan-400/50 hover:border-cyan-300',
    shadow: 'shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]',
  },
  pink: {
    border: 'border-pink-400/50 hover:border-pink-300',
    shadow: 'shadow-[0_0_20px_rgba(236,72,153,0.2)] hover:shadow-[0_0_40px_rgba(236,72,153,0.4)]',
  },
  purple: {
    border: 'border-purple-400/50 hover:border-purple-300',
    shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]',
  },
  gold: {
    border: 'border-yellow-400/50 hover:border-yellow-300',
    shadow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]',
  },
  green: {
    border: 'border-green-400/50 hover:border-green-300',
    shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_40px_rgba(34,197,94,0.4)]',
  },
};

const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ 
    className, 
    variant = 'default', 
    glowColor = 'cyan',
    hoverEffect = 'lift',
    children,
    ...props 
  }, ref) => {
    
    // Base animation variants
    const whileHover = {
      y: hoverEffect === 'lift' ? -8 : hoverEffect === 'scale' ? 1.02 : 0,
      scale: hoverEffect === 'scale' ? 1.02 : 1,
      transition: { type: 'spring', stiffness: 400, damping: 25 }
    };
    
    const whileTap = {
      scale: hoverEffect === 'scale' ? 0.98 : 1,
      y: hoverEffect === 'lift' ? -4 : 0,
      transition: { type: 'spring', stiffness: 400, damping: 25 }
    };

    // Build the card className based on variant
    const getCardClass = () => {
      const baseClass = 'rounded-2xl transition-all duration-300';
      
      switch (variant) {
        case 'glass':
          return cn(baseClass, glassStyles, className);
        case 'neon':
          return cn(
            baseClass,
            'bg-zinc-900/90',
            glowColors[glowColor].border,
            glowColors[glowColor].shadow,
            className
          );
        case 'cyber':
          return cn(baseClass, cyberStyles, className);
        default:
          return cn(
            baseClass,
            'bg-zinc-800/50 border border-white/5',
            'hover:bg-zinc-800/80 hover:border-white/10',
            'shadow-lg hover:shadow-xl',
            className
          );
      }
    };

    return (
      <motion.div
        ref={ref}
        className={getCardClass()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverEffect !== 'none' ? whileHover : undefined}
        whileTap={hoverEffect !== 'none' ? whileTap : undefined}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 30 
        }}
        {...(props as HTMLMotionProps<'div'>)}
      >
        {/* Decorative corner accents for cyber variant */}
        {variant === 'cyber' && (
          <>
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/50 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/50 rounded-br-lg" />
          </>
        )}
        
        {/* Content with proper z-index */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

export default AnimatedCard;
