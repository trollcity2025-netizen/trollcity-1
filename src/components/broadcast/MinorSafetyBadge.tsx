import React from 'react';
import { cn } from '../../lib/utils';

interface MinorSafetyBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

/**
 * Minor Safety Badge Component
 * Displays when a streamer has indicated minors may appear on their broadcast
 * Follows Troll City theme: gold border, purple background, neon green icon
 */
export const MinorSafetyBadge: React.FC<MinorSafetyBadgeProps> = ({
  className,
  size = 'md',
  showIcon = true,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-3 py-1 text-xs gap-1.5',
    lg: 'px-4 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      className={cn(
        // Base styles
        'inline-flex items-center font-bold rounded-full',
        // Troll City theme colors
        'bg-purple-600/90 border-2 border-yellow-400',
        'shadow-[0_0_10px_rgba(168,85,247,0.5),0_0_20px_rgba(250,204,21,0.3)]',
        'backdrop-blur-sm',
        // Text color - neon green/yellow for high visibility
        'text-green-300',
        // Size variants
        sizeClasses[size],
        // Animation
        'animate-pulse',
        className
      )}
      title="Minors are present and supervised by the adult account holder"
    >
      {showIcon && (
        <span className={cn('leading-none', iconSizes[size])}>👨‍👩‍👧</span>
      )}
      <span className="uppercase tracking-wider">Kids Present</span>
    </div>
  );
};

/**
 * Alternative badge style - more compact for smaller spaces
 */
export const MinorSafetyBadgeCompact: React.FC<MinorSafetyBadgeProps> = ({
  className,
  size = 'sm',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'bg-purple-600 border-2 border-yellow-400',
        'shadow-[0_0_8px_rgba(168,85,247,0.5)]',
        'animate-pulse',
        sizeClasses[size],
        className
      )}
      title="Minors supervised on stream"
    >
      <span className="leading-none">🧸</span>
    </div>
  );
};

/**
 * Badge for stream preview cards and lists
 */
export const MinorSafetyBadgePreview: React.FC<MinorSafetyBadgeProps> = ({
  className,
}) => {
  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-10',
        'flex items-center gap-1 px-2 py-1 rounded-full',
        'bg-purple-600/90 border border-yellow-400',
        'text-[10px] font-bold text-green-300 uppercase',
        'shadow-lg backdrop-blur-sm',
        className
      )}
    >
      <span>👨‍👩‍👧</span>
      <span>Supervised</span>
    </div>
  );
};

export default MinorSafetyBadge;