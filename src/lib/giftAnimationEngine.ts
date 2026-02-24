// Gift Animation Engine - Central orchestrator for gift animations

import { BroadcastGift } from '../hooks/useBroadcastRealtime';
import { getGiftTier, playGiftSound, type GiftTier } from './giftSoundEngine';
import { processGiftCombo, type ComboState } from './giftComboEngine';
import { addPersistentGift, getAllPersistentGifts, type PersistentGift } from './persistentGiftStore';
import { triggerScreenShake } from './giftScreenShake';
import { OFFICIAL_GIFTS } from './giftConstants';

// Configuration
export const MAX_CONCURRENT_GIFTS = 5;
export const ANIMATION_DURATION = 5000; // 5 seconds
export const LOW_VALUE_DURATION = 3000; // 3 seconds

export interface AnimatedGift {
  id: string;
  gift: BroadcastGift;
  tier: GiftTier;
  combo: ComboState | null;
  startTime: number;
  duration: number;
  hasFlown: boolean;
}

export function getGiftDetails(gift: BroadcastGift): { name: string; icon: string; cost: number } {
  // First try to find by gift_id
  const officialGift = OFFICIAL_GIFTS.find(g => g.id === gift.gift_id);
  if (officialGift) {
    return { name: officialGift.name, icon: officialGift.icon, cost: officialGift.coinCost };
  }
  // Fallback
  return { 
    name: gift.gift_name || 'Gift', 
    icon: gift.gift_icon || '🎁',
    cost: gift.amount 
  };
}

// Process a new gift - called when gift is received
export function processGift(
  gift: BroadcastGift,
  senderPosition?: { top: number; left: number },
  receiverPosition?: { top: number; left: number }
): AnimatedGift {
  const details = getGiftDetails(gift);
  const tier = getGiftTier(details.cost);
  
  // Process combo
  const comboResult = processGiftCombo(
    gift.sender_id,
    gift.sender_name,
    gift.gift_id,
    details.name,
    details.icon
  );
  
  // Play sound
  playGiftSound(tier);
  
  // Trigger screen shake for high value
  triggerScreenShake(details.cost);
  
  // Add persistent gift
  addPersistentGift(
    gift.receiver_id,
    gift.gift_id,
    details.name,
    details.icon,
    details.cost,
    gift.sender_name
  );
  
  const duration = details.cost >= 500 ? ANIMATION_DURATION : LOW_VALUE_DURATION;
  
  return {
    id: gift.id,
    gift,
    tier,
    combo: comboResult?.comboState || null,
    startTime: Date.now(),
    duration,
    hasFlown: !!(senderPosition && receiverPosition),
  };
}

// Check if animation is complete
export function isAnimationComplete(animatedGift: AnimatedGift): boolean {
  return Date.now() - animatedGift.startTime >= animatedGift.duration;
}

// Get all persistent gifts for display
export { getAllPersistentGifts };

// Particle config for different tiers
export const PARTICLE_CONFIG: Record<GiftTier, { count: number; colors: string[]; emoji: string[] }> = {
  common: { count: 0, colors: [], emoji: [] },
  rare: { count: 10, colors: ['#3b82f6', '#06b6d4'], emoji: ['💎', '💠'] },
  epic: { count: 20, colors: ['#8b5cf6', '#ec4899', '#f472b6'], emoji: ['✨', '🌟', '💫'] },
  legendary: { 
    count: 40, 
    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#fcd34d'], 
    emoji: ['✨', '⭐', '🌟', '💫', '🔥', '👑'] 
  },
};
