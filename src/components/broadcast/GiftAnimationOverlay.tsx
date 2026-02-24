import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { cn } from '../../lib/utils';
import { OFFICIAL_GIFTS } from '../../lib/giftConstants';

interface GiftAnimationOverlayProps {
  gifts?: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
  userPositions?: Record<string, { top: number; left: number; width: number; height: number }>;
  getUserPositions?: () => Record<string, { top: number; left: number; width: number; height: number }>;
}

// Configuration - only show one gift at a time, new gifts replace old ones
const GIFT_DISPLAY_DURATION = 3000; // 3 seconds for all gifts

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

// Combo tracking - per sender, resets on timeout
interface ComboState {
  senderId: string;
  count: number;
  lastTime: number;
}

const activeCombos: Map<string, ComboState> = new Map();
const COMBO_WINDOW = 5000;

const processCombo = (senderId: string): number => {
  const now = Date.now();
  const existing = activeCombos.get(senderId);
  
  // If no existing combo or window expired, start fresh at 1
  if (!existing || (now - existing.lastTime) > COMBO_WINDOW) {
    activeCombos.set(senderId, { senderId, count: 1, lastTime: now });
    return 1;
  }
  
  // Increment existing combo
  existing.count += 1;
  existing.lastTime = now;
  activeCombos.set(senderId, existing);
  return existing.count;
};

export default function GiftAnimationOverlay({ 
  gifts = [], 
  onAnimationComplete, 
  userPositions, 
  getUserPositions 
}: GiftAnimationOverlayProps) {
  const [visibleGifts, setVisibleGifts] = useState<BroadcastGift[]>([]);
  
  // Process new gifts when they arrive
  useEffect(() => {
    if (!gifts || gifts.length === 0) return;
    
    console.log('[GiftOverlay] Processing gifts:', gifts.length, gifts);
    
    setVisibleGifts(prev => {
      // Filter out gifts we already have
      const existingIds = new Set(prev.map(g => g.id));
      const newGifts = gifts.filter(g => !existingIds.has(g.id));
      
      if (newGifts.length === 0) return prev;
      
      // Process each new gift
      newGifts.forEach(gift => {
        const details = getGiftDetails(gift);
        const tier = getGiftTier(details.cost);
        
        // Trigger effects
        triggerVibration(details.cost);
        triggerScreenShake(details.cost);
        
        console.log('[GiftOverlay] Gift processed:', gift.gift_name, 'tier:', tier, 'cost:', details.cost, 'sender:', gift.sender_name);
      });
      
      // Keep only the latest gift (new replaces old)
      const combined = [...prev, ...newGifts];
      return combined.slice(-1);
    });
  }, [gifts]);
  
  // Auto-remove gifts after animation
  useEffect(() => {
    if (visibleGifts.length === 0) return;
    
    const timers: ReturnType<typeof setTimeout>[] = [];
    
    visibleGifts.forEach(gift => {
      const details = getGiftDetails(gift);
      const duration = GIFT_DISPLAY_DURATION;
      
      const timer = setTimeout(() => {
        setVisibleGifts(prev => {
          const remaining = prev.filter(g => g.id !== gift.id);
          if (remaining.length !== prev.length) {
            onAnimationComplete?.(gift.id);
          }
          return remaining;
        });
      }, duration);
      
      timers.push(timer);
    });
    
    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [visibleGifts.length, onAnimationComplete]);
  
  const dismissGift = useCallback((giftId: string) => {
    setVisibleGifts(prev => {
      const remaining = prev.filter(g => g.id !== giftId);
      if (remaining.length !== prev.length) {
        onAnimationComplete?.(giftId);
      }
      return remaining;
    });
  }, [onAnimationComplete]);
  
  // Debug: log visible gifts
  useEffect(() => {
    console.log('[GiftOverlay] Visible gifts:', visibleGifts.length);
  }, [visibleGifts.length]);
  
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
        {visibleGifts.map((gift, index) => {
          const details = getGiftDetails(gift);
          const tier = getGiftTier(details.cost);
          const combo = processCombo(gift.sender_id);
          
          return (
            <GiftAnimation
              key={gift.id}
              gift={gift}
              details={details}
              tier={tier}
              combo={combo}
              index={index}
              onDismiss={() => dismissGift(gift.id)}
            />
          );
        })}
      </AnimatePresence>
    </div>,
    target
  );
}

// Individual gift animation
function GiftAnimation({ 
  gift, 
  details, 
  tier,
  combo,
  index,
  onDismiss 
}: { 
  gift: BroadcastGift;
  details: { name: string; icon: string; cost: number };
  tier: 'common' | 'rare' | 'epic' | 'legendary';
  combo: number;
  index: number;
  onDismiss: () => void;
}) {
  const isEpic = tier === 'epic';
  const isLegendary = tier === 'legendary';
  const isRare = tier === 'rare';
  
  // Stagger animations for multiple gifts
  const delay = index * 0.2;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
      }}
    >
      {/* Background overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: isLegendary 
            ? 'linear-gradient(135deg, rgba(234,179,8,0.3) 0%, rgba(88,28,135,0.4) 50%, rgba(0,0,0,0.9) 100%)'
            : isEpic
            ? 'linear-gradient(135deg, rgba(88,28,135,0.3) 0%, rgba(236,72,153,0.3) 50%, rgba(0,0,0,0.8) 100%)'
            : isRare
            ? 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(6,182,212,0.2) 50%, rgba(0,0,0,0.6) 100%)'
            : 'rgba(0,0,0,0.6)',
        }}
      />
      
      {/* Combo indicator */}
      <AnimatePresence>
        {combo > 1 && (
          <motion.div
            initial={{ scale: 0, y: -50 }}
            animate={{ scale: [1, 1.2, 1], y: 0 }}
            exit={{ scale: 0, y: -50 }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className="absolute top-20 z-20"
          >
            <div className="flex items-center gap-2">
              <span className="text-4xl">🔥</span>
              <span 
                className="text-5xl font-black"
                style={{
                  background: 'linear-gradient(to right, #fbbf24, #f97316, #ef4444)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                COMBO x{combo}
              </span>
              <span className="text-4xl">🔥</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8, delay }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Sender info */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
          className="text-center"
        >
          <p className="text-white text-xl font-bold drop-shadow-lg">
            {gift.sender_name || 'Someone'}
          </p>
          <p className="text-zinc-300">sent {details.name.toLowerCase()}!</p>
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
            "relative",
            isLegendary ? "text-9xl" : isEpic ? "text-8xl" : "text-7xl"
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
            "px-8 py-3 rounded-2xl font-bold text-2xl",
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
        transition={{ duration: GIFT_DISPLAY_DURATION / 1000, ease: "linear", delay }}
        className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500"
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}
