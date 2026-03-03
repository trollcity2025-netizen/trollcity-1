import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { cn } from '../../lib/utils';
import { OFFICIAL_GIFTS } from '../../lib/giftConstants';

interface GiftAnimationOverlayProps {
  gifts?: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  userPositions?: Record<string, { top: number; left: number; width: number; height: number }>;
  getUserPositions?: () => Record<string, { top: number; left: number; width: number; height: number }>;
}

// Configuration - show multiple gifts simultaneously
const GIFT_DISPLAY_DURATION = 4000; // 4 seconds for all gifts
const MAX_VISIBLE_GIFTS = 5; // Maximum gifts shown at once

// Helper function to get proper gift name and icon
const getGiftDetails = (gift: BroadcastGift): { name: string; icon: string; cost: number } => {
  const officialGift = OFFICIAL_GIFTS.find(g => g.id === gift.gift_id);
  if (officialGift) {
    return { name: officialGift.name, icon: officialGift.icon, cost: officialGift.coinCost };
  }
  return { 
    name: gift.gift_name || 'Gift', 
    icon: gift.gift_icon || '🎁',
    cost: gift.amount 
  };
};

// Get tier based on cost
const getGiftTier = (cost: number): 'common' | 'rare' | 'epic' | 'legendary' => {
  if (cost >= 10000) return 'legendary';
  if (cost >= 2500) return 'epic';
  if (cost >= 500) return 'rare';
  return 'common';
};

// Vibration helper
const triggerVibration = (cost: number) => {
  if (!navigator.vibrate) return;
  if (cost >= 10000) navigator.vibrate([200, 100, 200, 100, 300]);
  else if (cost >= 2500) navigator.vibrate([150, 75, 150]);
  else if (cost >= 500) navigator.vibrate(100);
};

// Simple screen shake for high value gifts
const triggerScreenShake = (cost: number) => {
  if (cost < 2500) return;
  
  const body = document.body;
  const intensity = 8;
  const duration = 500;
  
  body.style.animation = `none`;
  body.offsetHeight; // Trigger reflow
  body.style.animation = `shake ${duration}ms ease-in-out`;
  
  // Add keyframes if not exists
  if (!document.getElementById('gift-shake-style')) {
    const style = document.createElement('style');
    style.id = 'gift-shake-style';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translate(0, 0); }
        10%, 30%, 50%, 70%, 90% { transform: translate(-${intensity}px, ${intensity}px); }
        20%, 40%, 60%, 80% { transform: translate(${intensity}px, -${intensity}px); }
      }
    `;
    document.head.appendChild(style);
  }
};

// Get combo count from gift quantity - only show combo when quantity > 1
const getComboCount = (gift: BroadcastGift): number => {
  // Use the quantity field if available, otherwise default to 1
  const qty = gift.quantity || 1;
  // Ensure quantity is a number and at least 1
  return Math.max(1, Number(qty) || 1);
};

export default function GiftAnimationOverlay({ 
  gifts = [], 
  onAnimationComplete, 
  userPositions, 
  getUserPositions 
}: GiftAnimationOverlayProps) {
  const [visibleGifts, setVisibleGifts] = useState<BroadcastGift[]>([]);
  // Track which gifts already have timers to avoid resetting them
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
   
  // Process new gifts when they arrive
  useEffect(() => {
    if (!gifts || gifts.length === 0) return;
    
    console.log('[GiftOverlay] Processing gifts:', gifts.length, gifts);
    
    setVisibleGifts(prev => {
      // Filter out gifts we already have
      const existingIds = new Set(prev.map(g => g.id));
      const newGifts = gifts.filter(g => !existingIds.has(g.id));
      
      if (newGifts.length === 0) return prev;
      
      // Process each new gift - but only trigger effects once per batch
      const processedBatches = new Set<string>();
      newGifts.forEach(gift => {
        const details = getGiftDetails(gift);
        const tier = getGiftTier(details.cost);
        
        // Extract batch ID from giftId
        const batchId = gift.id?.split('-')[1] || gift.id;
        
        // Only trigger effects once per batch
        if (!processedBatches.has(batchId)) {
          processedBatches.add(batchId);
          triggerVibration(details.cost);
          triggerScreenShake(details.cost);
        }
        
        console.log('[GiftOverlay] Gift processed:', gift.gift_name, 'tier:', tier, 'cost:', details.cost, 'sender:', gift.sender_name, 'batch:', batchId);
      });
      
      // Keep all new gifts, limit to MAX_VISIBLE_GIFTS
      const combined = [...prev, ...newGifts];
      return combined.slice(-MAX_VISIBLE_GIFTS);
    });
  }, [gifts]);
  
  // Auto-remove gifts after animation - only set up timers for NEW gifts
  useEffect(() => {
    if (visibleGifts.length === 0) {
      // Clear all timers when no gifts visible
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
      return;
    }
    
    // Only create timers for gifts that don't already have one
    visibleGifts.forEach(gift => {
      if (timersRef.current.has(gift.id)) {
        // This gift already has a timer, don't reset it
        return;
      }
      
      const timer = setTimeout(() => {
        // Remove timer from ref
        timersRef.current.delete(gift.id);
        // Remove gift from visible gifts
        setVisibleGifts(prev => {
          const remaining = prev.filter(g => g.id !== gift.id);
          if (remaining.length !== prev.length) {
            onAnimationComplete?.(gift.id);
          }
          return remaining;
        });
      }, GIFT_DISPLAY_DURATION);
      
      // Store timer in ref
      timersRef.current.set(gift.id, timer);
    });
    
    // Cleanup function - only clear timers for gifts that are no longer visible
    return () => {
      const currentIds = new Set(visibleGifts.map(g => g.id));
      timersRef.current.forEach((timer, giftId) => {
        if (!currentIds.has(giftId)) {
          clearTimeout(timer);
          timersRef.current.delete(giftId);
        }
      });
    };
  }, [visibleGifts, onAnimationComplete]); // Track visibleGifts array, not just length

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []); // Empty deps - only run on unmount
  
  // Debug: log visible gifts
  useEffect(() => {
    console.log('[GiftOverlay] Visible gifts:', visibleGifts.length);
  }, [visibleGifts.length]); // Only log when length changes, not every render
  
  const dismissGift = useCallback((giftId: string) => {
    // Clear timer for this gift
    const timer = timersRef.current.get(giftId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(giftId);
    }
    setVisibleGifts(prev => {
      const remaining = prev.filter(g => g.id !== giftId);
      if (remaining.length !== prev.length) {
        onAnimationComplete?.(giftId);
      }
      return remaining;
    });
  }, [onAnimationComplete]); // Empty deps - dismissGift never changes
  
  // Render using portal
  if (visibleGifts.length === 0) return null;
  
  // Always use document.body for portal
  const target = document.body;
  
  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none z-[99999]"
      style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
    >
      <AnimatePresence>
        {visibleGifts.map((gift, index) => (
          <GiftAnimationItem
            key={gift.id}
            gift={gift}
            index={index}
            getUserPositions={getUserPositions}
            userPositions={userPositions}
            onDismiss={() => dismissGift(gift.id)}
          />
        ))}
      </AnimatePresence>
    </div>,
    target
  );
}

// Individual gift animation item that gets fresh positions on each render
function GiftAnimationItem({
  gift,
  index,
  getUserPositions,
  userPositions,
  onDismiss
}: {
  gift: BroadcastGift;
  index: number;
  getUserPositions?: () => Record<string, { top: number; left: number; width: number; height: number }>;
  userPositions?: Record<string, { top: number; left: number; width: number; height: number }>;
  onDismiss: () => void;
}) {
  const details = getGiftDetails(gift);
  const tier = getGiftTier(details.cost);
  const combo = getComboCount(gift);
  
  // Get fresh positions on each render
  const freshPositions = getUserPositions ? getUserPositions() : {};
  const mergedPositions = { ...userPositions, ...freshPositions };
  
  // Get user position for this gift - use receiver_id to position on recipient's box
  const receiverPosition = mergedPositions[gift.receiver_id];
  
  // Debug logging to help diagnose positioning issues
  console.log('[GiftAnimationItem] Gift positioning:', {
    giftId: gift.id,
    receiverId: gift.receiver_id?.substring(0, 8),
    hasPosition: !!receiverPosition,
    positionKeys: Object.keys(mergedPositions).map(k => k.substring(0, 8)),
    position: receiverPosition
  });
  
  // Calculate position - position inside the user's box (not centered), or center of screen if not found
  const positionStyle: React.CSSProperties = receiverPosition
    ? {
        position: 'absolute',
        top: `${receiverPosition.top}px`,
        left: `${receiverPosition.left}px`,
        width: `${receiverPosition.width}px`,
        height: `${receiverPosition.height}px`,
        maxWidth: 'none',
        maxHeight: 'none',
        pointerEvents: 'none'
      }
    : {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        maxWidth: '400px',
        pointerEvents: 'none'
      };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      style={positionStyle}
      className="pointer-events-auto"
    >
      <GiftAnimation
        gift={gift}
        details={details}
        tier={tier}
        combo={combo}
        index={index}
        onDismiss={onDismiss}
        hasPosition={!!receiverPosition}
      />
    </motion.div>
  );
}

// Individual gift animation
function GiftAnimation({
  gift,
  details,
  tier,
  combo,
  index,
  onDismiss,
  hasPosition = false
}: {
  gift: BroadcastGift;
  details: { name: string; icon: string; cost: number };
  tier: 'common' | 'rare' | 'epic' | 'legendary';
  combo: number;
  index: number;
  onDismiss: () => void;
  hasPosition?: boolean;
}) {
  const isEpic = tier === 'epic';
  const isLegendary = tier === 'legendary';
  const isRare = tier === 'rare';
  
  // Stagger animations for multiple gifts
  const delay = index * 0.1;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3, delay }}
      className="relative flex flex-col items-center justify-center w-full h-full"
      style={{
        padding: '10px'
      }}
    >
      {/* Background overlay - no border */}
      <div 
        className="absolute inset-0 rounded-lg overflow-hidden"
        style={{
          background: isLegendary 
            ? 'linear-gradient(135deg, rgba(234,179,8,0.3) 0%, rgba(88,28,135,0.4) 50%, rgba(0,0,0,0.9) 100%)'
            : isEpic
            ? 'linear-gradient(135deg, rgba(88,28,135,0.3) 0%, rgba(236,72,153,0.3) 50%, rgba(0,0,0,0.8) 100%)'
            : isRare
            ? 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(6,182,212,0.2) 50%, rgba(0,0,0,0.6) 100%)'
            : 'rgba(0,0,0,0.6)',
          border: 'none',
          boxShadow: 'none'
        }}
      />
      
      {/* Combo indicator */}
      <AnimatePresence>
        {combo > 1 && (
          <motion.div
            initial={{ scale: 0, y: -20 }}
            animate={{ scale: [1, 1.1, 1], y: 0 }}
            exit={{ scale: 0, y: -20 }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className="absolute top-2 z-20"
          >
            <div className="flex items-center gap-1">
              <span className="text-sm">🔥</span>
              <span 
                className="text-sm font-bold"
                style={{
                  background: 'linear-gradient(to right, #fbbf24, #f97316, #ef4444)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                x{combo}
              </span>
              <span className="text-sm">🔥</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8, delay }}
        className="relative z-10 flex flex-col items-center justify-center gap-2 w-full h-full overflow-hidden"
      >
          {/* Sender info */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
          className="text-center"
        >
          <p className="text-white text-sm font-bold drop-shadow-lg truncate max-w-full">
            {gift.sender_name || 'Someone'}
          </p>
          <p className="text-zinc-300 text-xs truncate max-w-full">sent {details.name.toLowerCase()}!</p>
        </motion.div>
        
        {/* Gift icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            delay: delay + 0.5 
          }}
          className={cn(
            "relative flex items-center justify-center",
            isLegendary ? "text-4xl sm:text-5xl" : isEpic ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
          )}
        >
          {/* Glow effect */}
          <div 
            className="absolute inset-0 blur-3xl rounded-full"
            style={{
              background: isLegendary 
                ? 'rgba(234,179,8,0.5)' 
                : isEpic 
                ? 'rgba(168,85,247,0.5)' 
                : 'rgba(236,72,153,0.3)',
            }}
          />
          
          {/* Gift icon */}
          <motion.span
            className="relative z-10"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 }}
          >
            {details.icon}
          </motion.span>
        </motion.div>
        
        {/* Gift name */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.6 }}
          className={cn(
            "px-2 py-1 rounded-lg font-bold text-xs truncate max-w-full",
            isLegendary && "bg-gradient-to-r from-yellow-500 to-orange-500 text-black",
            isEpic && "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
            isRare && "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
            !isRare && !isEpic && !isLegendary && "bg-gradient-to-r from-pink-500 to-red-500 text-white"
          )}
        >
          {details.name}
        </motion.div>
        
        {/* Amount */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.8 }}
          className="flex items-center gap-1 text-yellow-400 text-sm font-bold"
        >
          <span>{gift.amount.toLocaleString()}</span>
          <span>🪙</span>
        </motion.div>
      </motion.div>
      
      {/* Progress bar - thinner for box */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: GIFT_DISPLAY_DURATION / 1000, ease: "linear", delay }}
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500"
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}
