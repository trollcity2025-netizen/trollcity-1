// 🎬 Enhanced Gift Animation Overlay - Full-screen premium animations with GPU acceleration
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { GiftCategory, getGiftCategory, giftEffectsMap, GiftEffect, useGiftEngine } from '../../lib/giftEngine';
import { cn } from '../../lib/utils';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GIFT_DISPLAY_DURATION = 4000;
const MAX_VISIBLE_GIFTS = 5;

// GPU-accelerated animation styles
const GPU_STYLES: React.CSSProperties = {
  transform: 'translateZ(0)',
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden',
  perspective: '1000px',
};

// ============================================================================
// TIER & EFFECT HELPERS
// ============================================================================

const getGiftTier = (cost: number): 'common' | 'rare' | 'epic' | 'legendary' => {
  if (cost >= 10000) return 'legendary';
  if (cost >= 2500) return 'epic';
  if (cost >= 500) return 'rare';
  return 'common';
};

const getTierGradient = (tier: string): string => {
  switch (tier) {
    case 'legendary':
      return 'linear-gradient(135deg, rgba(234,179,8,0.4) 0%, rgba(88,28,135,0.5) 50%, rgba(0,0,0,0.9) 100%)';
    case 'epic':
      return 'linear-gradient(135deg, rgba(88,28,135,0.4) 0%, rgba(236,72,153,0.4) 50%, rgba(0,0,0,0.8) 100%)';
    case 'rare':
      return 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(6,182,212,0.3) 50%, rgba(0,0,0,0.6) 100%)';
    default:
      return 'rgba(0,0,0,0.6)';
  }
};

const getTierColors = (tier: string) => {
  switch (tier) {
    case 'legendary':
      return { bg: 'from-yellow-500 to-orange-500', text: 'text-yellow-400', glow: 'rgba(234,179,8,0.5)' };
    case 'epic':
      return { bg: 'from-purple-500 to-pink-500', text: 'text-purple-400', glow: 'rgba(168,85,247,0.5)' };
    case 'rare':
      return { bg: 'from-blue-500 to-cyan-500', text: 'text-blue-400', glow: 'rgba(59,130,246,0.5)' };
    default:
      return { bg: 'from-pink-500 to-red-500', text: 'text-pink-400', glow: 'rgba(236,72,153,0.3)' };
  }
};

// ============================================================================
// FULL-SCREEN GRAND ANIMATION
// ============================================================================

interface GrandAnimationProps {
  gift: BroadcastGift;
  effect?: GiftEffect;
}

function GrandAnimation({ gift, effect }: GrandAnimationProps) {
  const tier = getGiftTier(gift.amount || 0);
  const colors = getTierColors(tier);
  
  // Determine animation type based on gift
  const isDiamondRain = gift.gift_id?.includes('rain') || gift.gift_id?.includes('diamond');
  const isCar = gift.gift_id?.includes('car');
  const isRocket = gift.gift_id?.includes('rocket');
  const isDragon = gift.gift_id?.includes('dragon');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[99998] pointer-events-none"
      style={GPU_STYLES}
    >
      {/* Full-screen gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: getTierGradient(tier),
        }}
      />
      
      {/* Particle effects based on animation type */}
      {isDiamondRain && <DiamondRainParticles />}
      {isRocket && <RocketAnimation gift={gift} effect={effect} />}
      {isDragon && <DragonAnimation gift={gift} effect={effect} />}
      {isCar && <CarAnimation gift={gift} effect={effect} />}
      
      {/* Gift info overlay */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute bottom-20 left-0 right-0 flex flex-col items-center"
      >
        <div className="text-6xl mb-4">{gift.gift_icon || '🎁'}</div>
        <div className={cn("text-4xl font-black bg-gradient-to-r", colors.bg, "bg-clip-text text-transparent")}>
          {gift.gift_name}
        </div>
        <div className="text-xl text-white/80 mt-2">
          from {gift.sender_name}
        </div>
        {gift.quantity > 1 && (
          <div className="text-2xl font-bold text-yellow-400 mt-2">
            x{gift.quantity}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// PARTICLE ANIMATIONS
// ============================================================================

function DiamondRainParticles() {
  const particles = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 10 + Math.random() * 20,
    }))
  , []);
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -50, x: `${p.x}%`, opacity: 1 }}
          animate={{ 
            y: '110vh', 
            opacity: [1, 1, 0],
          }}
          transition={{ 
            duration: p.duration, 
            delay: p.delay,
            repeat: Infinity,
          }}
          className="absolute"
          style={{ 
            willChange: 'transform, opacity',
          }}
        >
          <span className="text-2xl">💎</span>
        </motion.div>
      ))}
    </div>
  );
}

function RocketAnimation({ gift, effect }: GrandAnimationProps) {
  return (
    <motion.div
      initial={{ x: '-100%', y: '80%' }}
      animate={{ x: '100vw', y: '-20%' }}
      transition={{ duration: 3, ease: 'easeOut' }}
      className="absolute text-8xl"
      style={{ willChange: 'transform' }}
    >
      🚀
      {gift.sender_name && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-white font-bold">
          {gift.sender_name}
        </div>
      )}
    </motion.div>
  );
}

function DragonAnimation({ gift, effect }: GrandAnimationProps) {
  return (
    <motion.div
      initial={{ x: '-20%', y: '50%' }}
      animate={{ x: '120%', y: '30%' }}
      transition={{ duration: 5, ease: 'easeInOut' }}
      className="absolute text-9xl"
      style={{ willChange: 'transform' }}
    >
      🐉
    </motion.div>
  );
}

function CarAnimation({ gift, effect }: GrandAnimationProps) {
  return (
    <motion.div
      initial={{ x: '-30%', y: '70%' }}
      animate={{ x: '130%', y: '70%' }}
      transition={{ duration: 4, ease: 'linear' }}
      className="absolute text-7xl"
      style={{ willChange: 'transform' }}
    >
      🏎️
    </motion.div>
  );
}

// ============================================================================
// FACE EFFECT DISPLAY
// ============================================================================

interface FaceEffectDisplayProps {
  gift: BroadcastGift;
  effect?: GiftEffect;
}

function FaceEffectDisplay({ gift, effect }: FaceEffectDisplayProps) {
  const icon = effect?.icon || '🎭';
  const name = effect?.name || 'Effect';
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[99997] pointer-events-none"
      style={GPU_STYLES}
    >
      {/* Face effect container */}
      <div className="relative">
        {/* Glow effect */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
          }}
          className="absolute inset-0 blur-3xl rounded-full bg-purple-500/50"
        />
        
        {/* Icon */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
          }}
          className="relative text-8xl"
        >
          {icon}
        </motion.div>
        
        {/* Effect name */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white font-bold">{name}</span>
            <span className="text-gray-400 text-sm ml-2">on {gift.sender_name}</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STANDARD GIFT ANIMATION (BOX)
// ============================================================================

interface StandardGiftAnimationProps {
  gift: BroadcastGift;
  index: number;
}

function StandardGiftAnimation({ gift, index }: StandardGiftAnimationProps) {
  const tier = getGiftTier(gift.amount || 0);
  const colors = getTierColors(tier);
  const effect = giftEffectsMap[gift.gift_id || ''];
  
  // Calculate position based on index
  const positionStyles: React.CSSProperties[] = [
    { top: '20%', left: '10%' },
    { top: '20%', right: '10%' },
    { bottom: '20%', left: '10%' },
    { bottom: '20%', right: '10%' },
    { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  ];
  
  const position = positionStyles[index % positionStyles.length];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, ...position }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="absolute pointer-events-none"
      style={{ ...GPU_STYLES, ...position }}
    >
      {/* Gift box */}
      <div 
        className="relative p-4 rounded-xl overflow-hidden"
        style={{
          background: getTierGradient(tier),
          minWidth: '150px',
        }}
      >
        {/* Glow */}
        <div 
          className="absolute inset-0 blur-xl"
          style={{ background: colors.glow }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          {/* Sender */}
          <p className="text-white text-sm font-bold truncate max-w-[120px]">
            {gift.sender_name}
          </p>
          
          {/* Gift icon */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              y: [0, -5, 0],
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              delay: index * 0.2,
            }}
            className="text-4xl"
          >
            {gift.gift_icon || '🎁'}
          </motion.div>
          
          {/* Gift name */}
          <div className={cn("px-2 py-1 rounded font-bold text-xs", `bg-gradient-to-r ${colors.bg}`)}>
            {gift.gift_name}
          </div>
          
          {/* Amount */}
          {gift.quantity > 1 && (
            <div className="flex items-center gap-1 text-yellow-400 font-bold">
              <span>x{gift.quantity}</span>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: GIFT_DISPLAY_DURATION / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500"
          style={{ transformOrigin: 'left' }}
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface EnhancedGiftAnimationProps {
  gifts: BroadcastGift[];
  onAnimationComplete?: (giftId: string) => void;
}

export default function EnhancedGiftAnimation({ 
  gifts = [],
  onAnimationComplete,
}: EnhancedGiftAnimationProps) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { comboCount, comboGiftId, currentGift } = useGiftEngine();
  
  // Separate gifts by category
  const { grandGifts, faceGifts, standardGifts } = useMemo(() => {
    const grand: BroadcastGift[] = [];
    const face: BroadcastGift[] = [];
    const standard: BroadcastGift[] = [];
    
    gifts.forEach(gift => {
      const category = getGiftCategory(gift.gift_id || '');
      if (category === 'grand') grand.push(gift);
      else if (category === 'face') face.push(gift);
      else standard.push(gift);
    });
    
    return { grandGifts: grand, faceGifts: face, standardGifts: standard };
  }, [gifts]);
  
  // Get the top grand gift for full-screen display
  const topGrandGift = grandGifts[0];
  const topFaceGift = faceGifts[0];
  
  // Setup auto-remove timers
  useEffect(() => {
    gifts.forEach(gift => {
      if (!timersRef.current.has(gift.id)) {
        const timer = setTimeout(() => {
          timersRef.current.delete(gift.id);
          onAnimationComplete?.(gift.id);
        }, GIFT_DISPLAY_DURATION);
        timersRef.current.set(gift.id, timer);
      }
    });
    
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, [gifts, onAnimationComplete]);
  
  // Use portal to render at top level
  if (gifts.length === 0) return null;
  
  return createPortal(
    <AnimatePresence mode="sync">
      {/* Full-screen grand animation */}
      {topGrandGift && (
        <GrandAnimation 
          key={`grand-${topGrandGift.id}`}
          gift={topGrandGift}
          effect={giftEffectsMap[topGrandGift.gift_id || '']}
        />
      )}
      
      {/* Face effect display */}
      {topFaceGift && !topGrandGift && (
        <FaceEffectDisplay
          key={`face-${topFaceGift.id}`}
          gift={topFaceGift}
          effect={giftEffectsMap[topFaceGift.gift_id || '']}
        />
      )}
      
      {/* Standard gift animations (boxes) */}
      {standardGifts.slice(0, MAX_VISIBLE_GIFTS).map((gift, index) => (
        <StandardGiftAnimation
          key={`standard-${gift.id}`}
          gift={gift}
          index={index}
        />
      ))}
      
      {/* Combo display */}
      {comboCount > 1 && comboGiftId && (
        <motion.div
          key={`combo-${comboGiftId}`}
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.2, 1] }}
          exit={{ scale: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none"
          style={GPU_STYLES}
        >
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-2xl">🔥</span>
            <span className="text-3xl font-black text-yellow-400">x{comboCount}</span>
            <span className="text-xl">
              {giftEffectsMap[comboGiftId]?.icon || '🎁'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
