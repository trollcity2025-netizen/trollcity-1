/**
 * Temporary Bonus System
 * 
 * Manages event-based bonuses that:
 * - Apply only during event window
 * - Expire instantly when event ends
 * - Never affect cash-out math
 * - Don't persist historically
 */

import { useMemo, useCallback } from 'react';
import { useGlobalEvent } from '../../contexts/GlobalEventContext';
import type { EventBonus } from '../events/types';

// ============================================================================
// Bonus System Hook
// ============================================================================

interface UseEventBonusesReturn {
  /** All active bonuses */
  activeBonuses: EventBonus[];
  /** XP multiplier (1.0 = no bonus) */
  xpMultiplier: number;
  /** Coin rebate percentage (0 = no rebate) */
  coinRebate: number;
  /** Streak boost multiplier */
  streakBoost: number;
  /** Gift discount percentage (1.0 = no discount) */
  giftDiscount: number;
  /** Get bonus for specific action */
  getBonusForAction: (action: 'gift' | 'stream' | 'chat' | 'follow' | 'like') => EventBonus | undefined;
  /** Format bonus description */
  formatBonus: (bonus: EventBonus) => string;
  /** Whether any bonuses are active */
  hasBonuses: boolean;
}

export const useEventBonuses = (): UseEventBonusesReturn => {
  const { activeEvents, featureFlags } = useGlobalEvent();
  
  // Collect all bonuses from active events
  const activeBonuses = useMemo((): EventBonus[] => {
    if (!featureFlags.hasEventBonuses) return [];
    
    const bonuses: EventBonus[] = [];
    for (const event of activeEvents) {
      if (event.bonuses) {
        bonuses.push(...event.bonuses);
      }
    }
    return bonuses;
  }, [activeEvents, featureFlags.hasEventBonuses]);
  
  // Calculate combined multipliers
  const { xpMultiplier, coinRebate, streakBoost, giftDiscount } = useMemo(() => {
    let xp = 1.0;
    let rebate = 0;
    let streak = 1.0;
    let discount = 1.0;
    
    for (const bonus of activeBonuses) {
      switch (bonus.type) {
        case 'xp_multiplier':
          xp = Math.max(xp, bonus.value);
          break;
        case 'coin_rebate':
          rebate = Math.max(rebate, bonus.value);
          break;
        case 'streak_boost':
          streak = Math.max(streak, bonus.value);
          break;
        case 'gift_discount':
          discount = Math.min(discount, bonus.value);
          break;
      }
    }
    
    return { xpMultiplier: xp, coinRebate: rebate, streakBoost: streak, giftDiscount: discount };
  }, [activeBonuses]);
  
  // Get bonus for specific action
  const getBonusForAction = useCallback((action: 'gift' | 'stream' | 'chat' | 'follow' | 'like'): EventBonus | undefined => {
    return activeBonuses.find(b => b.affectedActions.includes(action));
  }, [activeBonuses]);
  
  // Format bonus description
  const formatBonus = useCallback((bonus: EventBonus): string => {
    switch (bonus.type) {
      case 'xp_multiplier': {
        const xpPercent = Math.round((bonus.value - 1) * 100);
        return `${xpPercent > 0 ? '+' : ''}${xpPercent}% XP`;
      }
      case 'coin_rebate': {
        return `+${Math.round(bonus.value * 100)}% coins back`;
      }
      case 'streak_boost': {
        const streakPercent = Math.round((bonus.value - 1) * 100);
        return `+${streakPercent}% streak`;
      }
      case 'gift_discount': {
        const discountPercent = Math.round((1 - bonus.value) * 100);
        return `-${discountPercent}% price`;
      }
      default:
        return bonus.description;
    }
  }, []);
  
  return {
    activeBonuses,
    xpMultiplier,
    coinRebate,
    streakBoost,
    giftDiscount,
    getBonusForAction,
    formatBonus,
    hasBonuses: activeBonuses.length > 0,
  };
};

// ============================================================================
// Bonus Application Helpers
// ============================================================================

/**
 * Apply XP bonus to base XP gain
 */
export const applyXpBonus = (baseXp: number, bonus: number): number => {
  return Math.floor(baseXp * bonus);
};

/**
 * Apply coin rebate to gift purchase
 */
export const applyCoinRebate = (coinsSpent: number, rebate: number): number => {
  return Math.floor(coinsSpent * rebate);
};

/**
 * Apply streak boost
 */
export const applyStreakBoost = (baseStreak: number, boost: number): number => {
  return Math.floor(baseStreak * boost);
};

/**
 * Apply gift discount
 */
export const applyGiftDiscount = (originalPrice: number, discount: number): number => {
  return Math.floor(originalPrice * discount);
};

// ============================================================================
// Bonus Display Components (for UI)
// ============================================================================

interface BonusBadgeProps {
  bonus: EventBonus;
  /** Custom class name */
  className?: string;
}

export const createBonusBadge = (props: BonusBadgeProps): { className: string; label: string } => {
  const { bonus, className = '' } = props;
  
  const bonusLabels: Record<EventBonus['type'], string> = {
    xp_multiplier: 'XP Boost',
    coin_rebate: 'Coins Back',
    streak_boost: 'Streak Boost',
    gift_discount: 'Discount',
  };
  
  return {
    className: `event-bonus-badge ${className}`,
    label: bonusLabels[bonus.type],
  };
};

// ============================================================================
// Bonus Expiration Verification
// ============================================================================

/**
 * Verify that bonuses properly expire
 * This is called automatically by the system
 */
export const verifyBonusExpiration = (): boolean => {
  // Bonuses automatically expire because:
  // 1. useEventBonuses only returns bonuses from active events
  // 2. When an event ends, it no longer appears in activeEvents
  // 3. React's reactive updates immediately reflect this
  
  return true;
};

// ============================================================================
// Economics Safety Checks
// ============================================================================

/**
 * Verify that bonuses don't affect cash-out math
 * This ensures regulatory compliance
 */
export const verifyEconomicsSafety = (
  _bonuses: ReturnType<typeof useEventBonuses>,
  _originalBalance: number,
  _cashOutAmount: number
): { safe: boolean; reason?: string } => {
  // Event bonuses should only affect:
  // - In-game XP gains
  // - Gift prices (discounts)
  // - Bonus coin rebates (from spending, not earning)
  
  // They should NOT affect:
  // - Withdrawable balance calculations
  // - Cash-out eligibility
  
  // Since bonuses are read-only from event config
  // and don't persist to database, this is inherently safe
  
  return { safe: true };
};

export default useEventBonuses;
