import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X } from 'lucide-react';
import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { cn } from '../../lib/utils';
import { OFFICIAL_GIFTS, GiftItem } from '../../lib/giftConstants';

interface GiftAnimationOverlayProps {
  gifts: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  // Map of user IDs to their DOM element positions for gift overlay
  userPositions?: Record<string, { top: number; left: number; width: number; height: number }>;
  // Function to get latest positions (preferred - provides fresh positions)
  getUserPositions?: () => Record<string, { top: number; left: number; width: number; height: number }>;
}

// Helper function to get proper gift name and icon from gift_id
const getGiftDetails = (gift: BroadcastGift): { name: string; icon: string; cost: number } => {
  // First try to find by gift_id (which is the slug/id like 'cash_toss')
  const officialGift = OFFICIAL_GIFTS.find(g => g.id === gift.gift_id);
  if (officialGift) {
    return { name: officialGift.name, icon: officialGift.icon, cost: officialGift.cost };
  }
  // Fallback to gift_name if it exists (might already be a proper name)
  return { 
    name: gift.gift_name || 'Gift', 
    icon: gift.gift_icon || '🎁',
    cost: gift.amount 
  };
};

// Helper function to trigger vibration based on gift price
const triggerVibration = (cost: number) => {
  if (!navigator.vibrate) return;
  
  // Different vibration patterns based on gift cost
  if (cost >= 10000) {
    // Legendary - strong long vibration
    navigator.vibrate([200, 100, 200, 100, 300]);
  } else if (cost >= 2500) {
    // Epic - medium vibration
    navigator.vibrate([150, 75, 150]);
  } else if (cost >= 500) {
    // Rare - short vibration
    navigator.vibrate(100);
  }
  // Common gifts (< 500) don't vibrate to avoid annoyance
};

const HIGH_VALUE_THRESHOLD = 500; // Gifts >= 500 coins get enhanced animation
const ANIMATION_DURATION = 5000; // 5 seconds
const LOW_VALUE_DURATION = 3000; // 3 seconds for low-value gifts

export default function GiftAnimationOverlay({ gifts, onAnimationComplete, userPositions, getUserPositions }: GiftAnimationOverlayProps) {
  const [visibleGifts, setVisibleGifts] = useState<BroadcastGift[]>([]);

  useEffect(() => {
    if (gifts.length > 0) {
      // Show ALL gifts with animations (not just high-value)
      // Filter for gifts that aren't already showing
      setVisibleGifts(prev => {
        const existingIds = new Set(prev.map(g => g.id));
        const newGifts = gifts.filter(g => {
          if (existingIds.has(g.id)) return false;
          
          // Get gift details to check cost
          const details = getGiftDetails(g);
          
          // Trigger vibration for all gifts (vibration function handles threshold internally)
          triggerVibration(details.cost);
          
          return true;
        });
        
        if (newGifts.length > 0) {
          return [...prev, ...newGifts];
        }
        return prev;
      });
    }
  }, [gifts]);

  // Auto-remove gifts after animation completes
  useEffect(() => {
    if (visibleGifts.length > 0) {
      const timer = setTimeout(() => {
        setVisibleGifts(prev => {
          const [first, ...rest] = prev;
          if (first) {
            onAnimationComplete?.(first.id);
          }
          return rest;
        });
      }, ANIMATION_DURATION);

      return () => clearTimeout(timer);
    }
  }, [visibleGifts, onAnimationComplete]);

  const dismissGift = (giftId: string) => {
    setVisibleGifts(prev => prev.filter(g => g.id !== giftId));
    onAnimationComplete?.(giftId);
  };

  // Helper to get position for a user
  const getPosition = useCallback((receiverId?: string) => {
    if (!receiverId) return undefined;
    // Use getUserPositions callback if available for latest positions
    if (getUserPositions) {
      const positions = getUserPositions();
      return positions[receiverId];
    }
    // Fallback to static positions
    return userPositions?.[receiverId];
  }, [getUserPositions, userPositions]);

  return (
    <AnimatePresence>
      {visibleGifts.map((gift) => {
        // Get position for the receiver if available
        const receiverPosition = getPosition(gift.receiver_id);
        return (
          <GiftAnimation
            key={gift.id}
            gift={gift}
            onDismiss={() => dismissGift(gift.id)}
            position={receiverPosition}
          />
        );
      })}
    </AnimatePresence>
  );
}

// Individual gift animation component
function GiftAnimation({ gift, onDismiss, position }: { gift: BroadcastGift; onDismiss: () => void; position?: { top: number; left: number; width: number; height: number } }) {
  // Get proper gift details from official gifts list
  const giftDetails = getGiftDetails(gift);
  const isEpic = giftDetails.cost >= 2500;
  const isLegendary = giftDetails.cost >= 10000;
  const isRare = giftDetails.cost >= 500;

  // Calculate position style - if position is provided, overlay on user box
  const isPositioned = !!position;
  const positionStyle: React.CSSProperties = isPositioned ? {
    position: 'absolute',
    top: position.top,
    left: position.left,
    width: position.width,
    height: position.height,
  } : {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isPositioned ? 1 : 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "z-[9999] pointer-events-none flex items-center justify-center",
        isPositioned ? "absolute" : "fixed inset-0"
      )}
      style={positionStyle}
    >
      {/* Background overlay - only show for full screen */}
      {!isPositioned && (
        <div className={cn(
          "absolute inset-0",
          isLegendary ? "bg-gradient-to-br from-yellow-900/80 via-purple-900/60 to-black/90" :
          isEpic ? "bg-gradient-to-br from-purple-900/70 via-pink-900/50 to-black/80" :
          "bg-black/60"
        )} />
      )}

      {/* Particle effects for legendary/epic - only for full screen */}
      {!isPositioned && isLegendary && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: window.innerHeight + 50,
                scale: 0 
              }}
              animate={{ 
                y: -50,
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
              className="absolute text-2xl"
            >
              {['✨', '⭐', '💫', '🌟'][Math.floor(Math.random() * 4)]}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main gift animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Sender info */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-white text-xl font-bold drop-shadow-lg">
            {gift.sender_name || 'Someone'}
          </p>
          <p className="text-zinc-300">sent {giftDetails.name.toLowerCase()}!</p>
        </motion.div>

        {/* Gift icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            delay: 0.5 
          }}
          className={cn(
            "relative",
            isLegendary ? "text-9xl" : isEpic ? "text-8xl" : "text-7xl"
          )}
        >
          {/* Glow effect */}
          <div className={cn(
            "absolute inset-0 blur-3xl rounded-full",
            isLegendary ? "bg-yellow-500/50" : 
            isEpic ? "bg-purple-500/50" : 
            "bg-pink-500/30"
          )} />
          
          {/* Gift icon */}
          <motion.span
            className="relative z-10"
            animate={{ 
              y: [0, -20, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {giftDetails.icon}
          </motion.span>
        </motion.div>

        {/* Gift name */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6 }}
          className={cn(
            "px-8 py-3 rounded-2xl font-bold text-2xl",
            isLegendary && "bg-gradient-to-r from-yellow-500 to-orange-500 text-black",
            isEpic && "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
            isRare && !isEpic && !isLegendary && "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
            !isRare && !isEpic && !isLegendary && "bg-gradient-to-r from-pink-500 to-red-500 text-white"
          )}
        >
          {giftDetails.name}
        </motion.div>

        {/* Amount */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-2 text-yellow-400 text-3xl font-bold"
        >
          <span>{gift.amount.toLocaleString()}</span>
          <span>🪙</span>
        </motion.div>
      </motion.div>

      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors pointer-events-auto"
      >
        <X className="text-white" size={24} />
      </button>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: ANIMATION_DURATION / 1000, ease: "linear" }}
        className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500"
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}

// Chat gift message component (for low-value gifts)
export function GiftChatMessage({ gift }: { gift: BroadcastGift }) {
  // Get proper gift details
  const giftDetails = getGiftDetails(gift);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
    >
      <Gift className="text-yellow-400" size={16} />
      <span className="text-sm">
        <span className="font-bold text-yellow-400">{gift.sender_name}</span>
        <span className="text-zinc-400"> sent </span>
        <span className="font-bold text-white">{giftDetails.icon} {giftDetails.name}</span>
        {gift.amount > 0 && (
          <span className="text-yellow-400 ml-1">x{gift.amount}</span>
        )}
      </span>
    </motion.div>
  );
}
