// 🎁 Gift Ticker - Horizontal scrolling gift history display
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GiftEvent, giftEffectsMap } from '../../lib/giftEngine';
import { cn } from '../../lib/utils';

interface GiftTickerProps {
  events: GiftEvent[];
  maxVisible?: number;
  className?: string;
}

export default function GiftTicker({ 
  events = [], 
  maxVisible = 10,
  className 
}: GiftTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll through gift history
  useEffect(() => {
    if (events.length <= maxVisible) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        // Only advance if there are new events
        if (prev >= events.length - maxVisible) {
          return 0;
        }
        return prev + 1;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [events.length, maxVisible]);
  
  // Get visible events (circular window)
  const visibleEvents = events.slice(currentIndex, currentIndex + maxVisible);
  
  // Get gift details
  const getGiftDetails = (event: GiftEvent) => {
    const effect = giftEffectsMap[event.gift_id];
    return {
      name: effect?.name || 'Gift',
      icon: effect?.icon || '🎁',
    };
  };
  
  if (events.length === 0) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2",
        className
      )}
      style={{ 
        // GPU acceleration
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {/* Gradient masks for fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling content */}
      <div 
        ref={scrollRef}
        className="flex items-center gap-3 overflow-hidden"
      >
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, idx) => {
            const details = getGiftDetails(event);
            return (
              <motion.div
                key={`${event.id}-${idx}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-lg">{details.icon}</span>
                <span className="text-sm text-white font-medium">
                  {event.sender_name}
                </span>
                <span className="text-xs text-gray-400">
                  sent
                </span>
                <span className="text-sm font-bold text-yellow-400">
                  x{event.combo_count}
                </span>
                <span className="text-lg">{details.icon}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {/* Progress indicator */}
      {events.length > maxVisible && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
          {Array.from({ length: Math.ceil(events.length / maxVisible) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1 h-1 rounded-full transition-colors",
                i === currentIndex ? "bg-yellow-400" : "bg-gray-600"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
