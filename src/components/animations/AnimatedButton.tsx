import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'neon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  glowColor?: string;
  children: React.ReactNode;
}

// Variant styles
const variantStyles = {
  primary: `
    bg-gradient-to-r from-purple-600 to-pink-600 
    hover:from-purple-500 hover:to-pink-500
    border-transparent
  `,
  secondary: `
    bg-zinc-800/80 
    hover:bg-zinc-700/80
    border-white/10
  `,
  ghost: `
    bg-transparent 
    hover:bg-white/5
    border-transparent
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-orange-600 
    hover:from-red-500 hover:to-orange-500
    border-transparent
  `,
  neon: `
    bg-transparent
    border-2 border-cyan-400
    shadow-[0_0_15px_rgba(34,211,238,0.3),inset_0_0_15px_rgba(34,211,238,0.1)]
    hover:shadow-[0_0_25px_rgba(34,211,238,0.5),inset_0_0_20px_rgba(34,211,238,0.2)]
    hover:border-cyan-300
  `,
};

// Size styles
const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-8 py-3.5 text-lg',
};

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    glowColor = 'cyan',
    children,
    disabled,
    ...props 
  }, ref) => {
    
    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base styles
          'relative overflow-hidden rounded-xl font-semibold',
          'border backdrop-blur-sm',
          'transition-all duration-300',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Glow effect for neon variant
          variant === 'neon' && glowColor === 'cyan' && 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
          variant === 'neon' && glowColor === 'pink' && 'shadow-[0_0_15px_rgba(236,72,153,0.3)]',
          variant === 'neon' && glowColor === 'purple' && 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
          variant === 'neon' && glowColor === 'gold' && 'shadow-[0_0_15px_rgba(251,191,36,0.3)]',
          className
        )}
        whileHover={{ 
          scale: disabled || isLoading ? 1 : 1.02,
          y: disabled || isLoading ? 0 : -2,
        }}
        whileTap={{ 
          scale: disabled || isLoading ? 1 : 0.98,
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 17 
        }}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {/* Animated background gradient */}
        <motion.div
          className={cn(
            'absolute inset-0 opacity-0 transition-opacity duration-300',
            !disabled && !isLoading && 'hover:opacity-100'
          )}
          initial={{ opacity: 0 }}
          animate={isLoading ? { opacity: 0.5 } : { opacity: 0 }}
        >
          <div className={cn(
            'absolute inset-0',
            variant === 'primary' && 'bg-gradient-to-r from-purple-500 to-pink-500',
            variant === 'danger' && 'bg-gradient-to-r from-red-500 to-orange-500',
            variant === 'neon' && 'bg-gradient-to-r from-cyan-500/20 to-pink-500/20'
          )} />
        </motion.div>

        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 overflow-hidden rounded-xl"
          initial={false}
        >
          <motion.div
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
            animate={!disabled && !isLoading ? { 
              x: ['100%', '-100%'],
            } : {}}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              repeatDelay: 3,
              ease: 'easeInOut'
            }}
          />
        </motion.div>

        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isLoading ? (
            <motion.span
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            children
          )}
        </span>
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;
