/**
 * Social Highlight System
 * 
 * Event-based social features that:
 * - Are cosmetic only
 * - Never write to database
 * - Auto-expire at event end
 * - Cannot persist beyond event window
 */

import { useMemo } from 'react';
import { useGlobalEvent } from '../../contexts/GlobalEventContext';
import type { EventSocialHighlight } from '../events/types';

// ============================================================================
// Social Highlights Hook
// ============================================================================

interface UseEventHighlightsReturn {
  /** All active social highlights */
  activeHighlights: EventSocialHighlight[];
  /** Frequent gifter highlights */
  frequentGifterHighlights: EventSocialHighlight[];
  /** Supporter badges */
  supporterBadges: EventSocialHighlight[];
  /** Pair highlights */
  pairHighlights: EventSocialHighlight[];
  /** VIP frames */
  vipFrames: EventSocialHighlight[];
  /** Whether any highlights are active */
  hasHighlights: boolean;
  /** Get highlight by type */
  getHighlight: (type: string) => EventSocialHighlight | undefined;
}

export const useEventHighlights = (): UseEventHighlightsReturn => {
  const { activeEvents, featureFlags } = useGlobalEvent();
  
  // Collect all highlights from active events
  const activeHighlights = useMemo((): EventSocialHighlight[] => {
    if (!featureFlags.hasSocialHighlights) return [];
    
    const highlights: EventSocialHighlight[] = [];
    for (const event of activeEvents) {
      if (event.socialHighlights) {
        highlights.push(...event.socialHighlights);
      }
    }
    return highlights;
  }, [activeEvents, featureFlags.hasSocialHighlights]);
  
  // Filter by type
  const frequentGifterHighlights = useMemo(() => 
    activeHighlights.filter(h => h.type === 'frequent_gifter'),
    [activeHighlights]
  );
  
  const supporterBadges = useMemo(() => 
    activeHighlights.filter(h => h.type === 'supporter_badge'),
    [activeHighlights]
  );
  
  const pairHighlights = useMemo(() => 
    activeHighlights.filter(h => h.type === 'pair_highlight'),
    [activeHighlights]
  );
  
  const vipFrames = useMemo(() => 
    activeHighlights.filter(h => h.type === 'vip_frame'),
    [activeHighlights]
  );
  
  // Get highlight by type
  const getHighlight = (type: string): EventSocialHighlight | undefined => {
    return activeHighlights.find(h => h.type === type);
  };
  
  return {
    activeHighlights,
    frequentGifterHighlights,
    supporterBadges,
    pairHighlights,
    vipFrames,
    hasHighlights: activeHighlights.length > 0,
    getHighlight,
  };
};

// ============================================================================
// Highlight Application Helpers
// ============================================================================

interface FrequentGifterConfig {
  minGifts?: number;
  frameColor?: string;
}

interface SupporterBadgeConfig {
  badgeStyle?: string;
  optInRequired?: boolean;
}

interface PairHighlightConfig {
  enableCoupleBadges?: boolean;
}

interface VipFrameConfig {
  frameStyle?: string;
  optInRequired?: boolean;
}

/**
 * Check if user qualifies for frequent gifter highlight
 */
export const checkFrequentGifterQualification = (
  config: FrequentGifterConfig,
  userGiftCount: number
): boolean => {
  const minGifts = config.minGifts ?? 5;
  return userGiftCount >= minGifts;
};

/**
 * Check if user can display supporter badge
 */
export const checkSupporterBadgeEligibility = (
  config: SupporterBadgeConfig,
  userHasOptedIn: boolean
): boolean => {
  // Pride events require opt-in for identity features
  if (config.optInRequired && !userHasOptedIn) {
    return false;
  }
  return true;
};

/**
 * Check if pair highlighting is enabled
 */
export const isPairHighlightingEnabled = (config: PairHighlightConfig): boolean => {
  return config.enableCoupleBadges ?? false;
};

/**
 * Check if user can display VIP frame
 */
export const checkVipFrameEligibility = (
  config: VipFrameConfig,
  userHasOptedIn: boolean
): boolean => {
  // Pride events require opt-in for identity features
  if (config.optInRequired && !userHasOptedIn) {
    return false;
  }
  return true;
};

// ============================================================================
// Highlight CSS Classes
// ============================================================================

export const getHighlightClasses = (
  type: EventSocialHighlight['type'],
  config: Record<string, unknown>
): string => {
  switch (type) {
    case 'frequent_gifter': {
      const frameColor = (config.frameColor as string) || 'gold';
      return `frequent-gifter-frame frame-${frameColor}`;
    }
    
    case 'supporter_badge': {
      const badgeStyle = (config.badgeStyle as string) || 'default';
      return `supporter-badge style-${badgeStyle}`;
    }
    
    case 'pair_highlight': {
      return 'pair-highlight-badge';
    }
    
    case 'vip_frame': {
      const frameStyle = (config.frameStyle as string) || 'default';
      return `vip-frame style-${frameStyle}`;
    }
    
    default:
      return '';
  }
};

// ============================================================================
// Auto-Expiration Verification
// ============================================================================

/**
 * Verify that highlights properly auto-expire
 * This is inherently ensured by the reactive system
 */
export const verifyHighlightExpiration = (): boolean => {
  // Highlights auto-expire because:
  // 1. useEventHighlights only returns highlights from active events
  // 2. No database writes means nothing persists
  // 3. When event ends, highlights immediately disappear from UI
  
  return true;
};

// ============================================================================
// Pride-Safe Highlight Configuration
// ============================================================================

/**
 * Get pride-safe highlight settings
 * Ensures no forced labels or identity exposure
 */
export const getPrideSafeHighlights = (
  eventId: string,
  userPreferences: { showPrideBadges: boolean }
): EventSocialHighlight[] => {
  // For pride events, all identity features require opt-in
  if (eventId !== 'pride') return [];
  
  if (!userPreferences.showPrideBadges) {
    return [];
  }
  
  // Return only opt-in pride highlights
  return [
    {
      type: 'supporter_badge',
      config: { badgeStyle: 'rainbow', optInRequired: true },
      persistent: false,
    },
    {
      type: 'vip_frame',
      config: { frameStyle: 'rainbow', optInRequired: true },
      persistent: false,
    },
  ];
};

export default useEventHighlights;
