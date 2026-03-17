// 🏆 Gift Leaderboard - Real-time top gifters display
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Gem, Medal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GifterEntry {
  userId: string;
  username: string;
  totalGifts: number;
}

interface GiftLeaderboardProps {
  gifters: GifterEntry[];
  maxDisplay?: number;
  className?: string;
  highlightUserId?: string;
}

const TOP_ICONS = ['🥇', '🥈', '🥉'];
const TOP_COLORS = [
  'from-yellow-400 to-orange-500',
  'from-gray-300 to-gray-400', 
  'from-amber-600 to-amber-700',
];

export default function GiftLeaderboard({
  gifters = [],
  maxDisplay = 5,
  className,
  highlightUserId,
}: GiftLeaderboardProps) {
  const prevGifterRef = useRef<GifterEntry[]>([]);
  
  // Track changes for animations
  const hasChanged = gifters.length !== prevGifterRef.current.length ||
    gifters.some((g, i) => g.userId !== prevGifterRef.current[i]?.userId);
  
  useEffect(() => {
    if (hasChanged) {
      prevGifterRef.current = gifters;
    }
  }, [gifters, hasChanged]);
  
  const displayGifters = gifters.slice(0, maxDisplay);
  
  // Get rank change
  const getRankChange = (userId: string): 'up' | 'down' | 'same' | null => {
    const prevIndex = prevGifterRef.current.findIndex(g => g.userId === userId);
    const currentIndex = displayGifters.findIndex(g => g.userId === userId);
    
    if (prevIndex === -1 || currentIndex === -1) return null;
    if (prevIndex > currentIndex) return 'up';
    if (prevIndex < currentIndex) return 'down';
    return 'same';
  };
  
  if (gifters.length === 0) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "bg-black/70 backdrop-blur-sm rounded-lg p-3 overflow-hidden",
        className
      )}
      style={{
        // GPU acceleration for smooth animations
        transform: 'translateZ(0)',
        willChange: 'transform, opacity',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
        <Crown className="w-5 h-5 text-yellow-400" />
        <span className="text-sm font-bold text-white">Top Gifters</span>
      </div>
      
      {/* Leaderboard items */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayGifters.map((gifter, index) => {
            const rankChange = getRankChange(gifter.userId);
            const isHighlighted = gifter.userId === highlightUserId;
            const isTop3 = index < 3;
            
            return (
              <motion.div
                key={gifter.userId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all",
                  isHighlighted && "bg-yellow-500/20 border border-yellow-500/50",
                  !isHighlighted && "hover:bg-white/5"
                )}
              >
                {/* Rank */}
                <div className="w-8 flex items-center justify-center">
                  {isTop3 ? (
                    <span className="text-lg">{TOP_ICONS[index]}</span>
                  ) : (
                    <span className="text-sm text-gray-400 font-bold">
                      #{index + 1}
                    </span>
                  )}
                </div>
                
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold truncate",
                      isTop3 ? "text-white" : "text-gray-300",
                      isHighlighted && "text-yellow-400"
                    )}>
                      {gifter.username}
                    </span>
                    
                    {/* Rank change indicator */}
                    {rankChange && rankChange !== 'same' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "text-xs",
                          rankChange === 'up' ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {rankChange === 'up' ? '↑' : '↓'}
                      </motion.span>
                    )}
                  </div>
                </div>
                
                {/* Gift amount */}
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  isTop3 && `bg-gradient-to-r ${TOP_COLORS[index]}`
                )}>
                  <Gem className={cn(
                    "w-3 h-3",
                    isTop3 ? "text-white" : "text-cyan-400"
                  )} />
                  <span className={cn(
                    "text-sm font-bold",
                    isTop3 ? "text-white" : "text-cyan-400"
                  )}>
                    {gifter.totalGifts.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {/* Show more indicator */}
      {gifters.length > maxDisplay && (
        <div className="mt-2 pt-2 border-t border-white/10 text-center">
          <span className="text-xs text-gray-400">
            +{gifters.length - maxDisplay} more
          </span>
        </div>
      )}
    </div>
  );
}
