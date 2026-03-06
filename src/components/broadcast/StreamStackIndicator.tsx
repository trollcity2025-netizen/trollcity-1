/**
 * StreamStackIndicator - Visual dots showing current position in stream list
 * Similar to TikTok's indicator dots
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface StreamStackIndicatorProps {
  totalStreams: number;
  currentIndex: number;
  onDotClick: (index: number) => void;
  maxVisibleDots?: number;
}

export default function StreamStackIndicator({
  totalStreams,
  currentIndex,
  onDotClick,
  maxVisibleDots = 5
}: StreamStackIndicatorProps) {
  if (totalStreams <= 1) return null;
  
  // Calculate visible dot range
  let startIndex = Math.max(0, currentIndex - Math.floor(maxVisibleDots / 2));
  let endIndex = Math.min(totalStreams, startIndex + maxVisibleDots);
  
  // Adjust if we're near the end
  if (endIndex - startIndex < maxVisibleDots) {
    startIndex = Math.max(0, endIndex - maxVisibleDots);
  }
  
  const visibleDots = [];
  for (let i = startIndex; i < endIndex; i++) {
    visibleDots.push(i);
  }
  
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col items-center gap-2">
        {visibleDots.map((index) => {
          const isActive = index === currentIndex;
          const isPast = index < currentIndex;
          
          return (
            <button
              key={index}
              onClick={() => onDotClick(index)}
              className={cn(
                "relative transition-all duration-200",
                isActive ? "w-3 h-10" : "w-2 h-2",
                isPast && !isActive && "opacity-40"
              )}
            >
              {/* Active dot (pill shape) */}
              {isActive ? (
                <div className="w-full h-full bg-white rounded-full shadow-lg" />
              ) : (
                /* Inactive dots */
                <div className={cn(
                  "w-full h-full rounded-full transition-all",
                  isPast 
                    ? "bg-white/40" 
                    : "bg-white/60"
                )} />
              )}
              
              {/* Glow effect for active dot */}
              {isActive && (
                <div className="absolute inset-0 bg-white/50 rounded-full blur-md -z-10" />
              )}
            </button>
          );
        })}
        
        {/* Show more indicator if there are more streams */}
        {currentIndex >= maxVisibleDots - 1 && totalStreams > maxVisibleDots && (
          <div className="text-white/50 text-xs mt-1">
            +{totalStreams - maxVisibleDots + 1}
          </div>
        )}
      </div>
    </div>
  );
}
