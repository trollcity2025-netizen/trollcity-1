/**
 * Global Event System - Main Export
 * 
 * A permanent, reusable event system for Troll City that supports:
 * - All holidays (Valentine's, Easter, Halloween, Christmas, etc.)
 * - Pride Month (June) with inclusive, opt-in features
 * - Automatic activation and reversion
 * - Temporary gifts, bonuses, and social highlights
 * 
 * Usage:
 * import { useGlobalEvent, useEventGifts, useEventBonuses, useEventHighlights } from '../lib/events';
 */

export * from './types';
export * from './eventRegistry';

// Context & Hooks
export { GlobalEventProvider, useGlobalEvent, useEventAdmin } from '../../contexts/GlobalEventContext';

// Theme
export { 
  GlobalEventThemeLayer, 
  useEventTheme, 
  injectEventThemeCSS 
} from '../../components/GlobalEventThemeLayer';

// Feature Hooks
export { useEventGifts } from '../hooks/useEventGifts';
export { useEventBonuses } from '../hooks/useEventBonuses';
export { useEventHighlights } from '../hooks/useEventHighlights';

// Utility Exports
export { 
  getGiftAnimationClass, 
  validateGiftPurchase,
  verifyGiftCleanup 
} from '../hooks/useEventGifts';

export {
  applyXpBonus,
  applyCoinRebate,
  applyStreakBoost,
  applyGiftDiscount,
  verifyBonusExpiration,
  verifyEconomicsSafety
} from '../hooks/useEventBonuses';

export {
  checkFrequentGifterQualification,
  checkSupporterBadgeEligibility,
  checkVipFrameEligibility,
  getHighlightClasses,
  verifyHighlightExpiration,
  getPrideSafeHighlights
} from '../hooks/useEventHighlights';

// Type Guards
import type { GlobalEventConfig, EventGift, EventBonus, EventSocialHighlight, PrideConfig } from './types';

export type {
  GlobalEventConfig,
  EventGift,
  EventBonus,
  EventSocialHighlight,
  PrideConfig,
};

// April Fools utilities
export {
  isAprilFoolsActive,
  canTriggerPrank,
  UI_RENAMES,
  FAKE_ITEMS,
  FAKE_CHARGES,
} from './aprilFools';

// ============================================================================
// Quick Start Guide
// ============================================================================

/**
 * Example: Using the event system in a component
 * 
 * ```tsx
 * import { useGlobalEvent, useEventGifts, useEventBonuses, useEventTheme } from '../lib/events';
 * 
 * const GiftShop: React.FC = () => {
 *   const { activeEvent } = useGlobalEvent();
 *   const { activeGifts, badgeLabel } = useEventGifts();
 *   const { xpMultiplier, formatBonus } = useEventBonuses();
 *   const { isActive, buttonClass } = useEventTheme();
 * 
 *   return (
 *     <div>
 *       {activeEvent && (
 *         <Banner>
 *           🎉 {activeEvent.name} is happening now!
 *         </Banner>
 *       )}
 * 
 *       <GiftGrid>
 *         {activeGifts.map(gift => (
 *           <GiftCard 
 *             key={gift.id}
 *             gift={gift}
 *             className={isActive ? buttonClass : ''}
 *           />
 *         ))}
 *       </GiftGrid>
 * 
 *       {badgeLabel && (
 *         <Badge className="limited-event-badge">
 *           {badgeLabel}
 *         </Badge>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */

/**
 * Example: Adding a new holiday event
 * 
 * Simply add a new config to eventRegistry.ts using createYearlyEvent helper:
 * 
 * ```ts
 * export const myHolidayEvent = createYearlyEvent(
 *   'my_holiday',
 *   'My Holiday',
 *   'Description of the holiday',
 *   10, 31,  // Start: October 31
 *   11, 1,   // End: November 1
 *   {
 *     theme: {
 *       primaryColor: '#FF6B35',
 *       secondaryColor: '#9C27B0',
 *       backgroundAccent: 'bg-purple-900/20',
 *       // ... other theme properties
 *     },
 *     giftPacks: [
 *       {
 *         id: 'my_holiday_gift',
 *         name: 'Special Gift',
 *         description: 'Holiday exclusive!',
 *         coinPrice: 500,
 *         emoji: '🎁',
 *         animation: 'glow',
 *         category: 'exclusive',
 *       },
 *     ],
 *   }
 * );
 * 
 * // Then add to GlobalEvents registry:
 * export const GlobalEvents = {
 *   // ... existing events
 *   my_holiday: myHolidayEvent,
 * };
 * ```
 */

// ============================================================================
// System Overview
// ============================================================================

/**
 * Architecture:
 * 
 * 1. GlobalEventProvider (contexts/GlobalEventContext.tsx)
 *    - Single source of truth for event state
 *    - Auto-updates based on server time
 *    - Handles admin overrides
 * 
 * 2. Event Registry (lib/events/eventRegistry.ts)
 *    - Centralized config for all events
 *    - Auto-generates timestamps for recurring events
 *    - No code changes needed for new events
 * 
 * 3. Feature Hooks
 *    - useEventGifts(): Limited-time gift management
 *    - useEventBonuses(): XP, streak, discount bonuses
 *    - useEventHighlights(): Social feature toggles
 *    - useEventTheme(): Theme class helpers
 * 
 * 4. Theme Layer (components/GlobalEventThemeLayer.tsx)
 *    - Applies CSS variables to :root
 *    - GPU-safe particle effects
 *    - Auto-cleanup on event end
 * 
 * Performance:
 * - Single timer for all events
 * - Pauses on background tabs
 * - No polling, only reactive updates
 * - Optimized update intervals
 */
