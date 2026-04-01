/**
 * Global Event System Types
 * 
 * Centralized type definitions for all holiday and pride events.
 * Each event defines its theme, gifts, bonuses, and social features.
 */

// ============================================================================
// Core Event Types
// ============================================================================

export interface EventTheme {
  /** Primary accent color (hex) */
  primaryColor: string;
  /** Secondary accent color (hex) */
  secondaryColor: string;
  /** Background accent color */
  backgroundAccent: string;
  /** Text highlight color */
  textHighlight: string;
  /** Border accent color */
  borderAccent: string;
  /** Custom CSS class suffix for buttons */
  buttonClass?: string;
  /** Badge background class */
  badgeBackground?: string;
  /** Particle effects (GPU-safe) */
  particleEffect?: 'hearts' | 'stars' | 'snow' | 'rainbow' | 'leaves' | 'confetti' | 'none';
  /** CSS custom properties for theme */
  cssVariables?: Record<string, string>;
}

export interface EventGift {
  /** Unique gift ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Coin price */
  coinPrice: number;
  /** Emoji/visual */
  emoji: string;
  /** Animation effect */
  animation?: 'bounce' | 'spin' | 'pulse' | 'glow' | 'float';
  /** Gift category */
  category: 'exclusive' | 'limited' | 'special';
}

export interface EventBonus {
  /** Bonus type */
  type: 'xp_multiplier' | 'coin_rebate' | 'streak_boost' | 'gift_discount';
  /** Bonus value (e.g., 1.5 for 50% boost) */
  value: number;
  /** Description for UI */
  description: string;
  /** Affected actions */
  affectedActions: ('gift' | 'stream' | 'chat' | 'follow' | 'like')[];
}

export interface EventSocialHighlight {
  /** Highlight type */
  type: 'frequent_gifter' | 'supporter_badge' | 'pair_highlight' | 'vip_frame';
  /** Visual configuration */
  config: Record<string, unknown>;
  /** Whether this persists in DB (should be false) */
  persistent: false;
}

export interface PrideConfig {
  /** Enable rainbow accents */
  rainbowAccents: boolean;
  /** Pride badge frames */
  prideBadgeFrames: boolean;
  /** Gradient highlights */
  gradientHighlights: boolean;
  /** Inclusive messaging */
  inclusiveMessaging: boolean;
  /** Opt-in required for identity features */
  optInRequired: true;
}

// ============================================================================
// Main Event Configuration
// ============================================================================

export interface GlobalEventConfig {
  /** Unique event ID */
  id: string;
  /** Event display name */
  name: string;
  /** Event description */
  description: string;
  /** Start timestamp (ISO 8601) */
  startTimestamp: string;
  /** End timestamp (ISO 8601) */
  endTimestamp: string;
  /** Timezone for display (default: UTC) */
  timezone?: string;
  /** Theme configuration */
  theme: EventTheme;
  /** Gift packs available during event */
  giftPacks?: EventGift[];
  /** Bonuses active during event */
  bonuses?: EventBonus[];
  /** Social highlights during event */
  socialHighlights?: EventSocialHighlight[];
  /** Pride-specific configuration (undefined for non-pride events) */
  prideConfig?: PrideConfig;
  /** Priority (higher = takes precedence when multiple events overlap) */
  priority?: number;
  /** Event is active globally */
  isGlobal?: boolean;
}

// ============================================================================
// Event System State
// ============================================================================

export interface ActiveEventState {
  /** Currently active event ID or null */
  activeEventId: string | null;
  /** Active event configuration or null */
  eventConfig: GlobalEventConfig | null;
  /** Map of event ID to active status */
  activeEvents: Map<string, boolean>;
  /** Feature flags derived from active events */
  featureFlags: EventFeatureFlags;
  /** Server time offset in ms (for client-server sync) */
  serverTimeOffset: number;
  /** Admin override state */
  adminOverride: AdminEventOverride | null;
}

export interface AdminEventOverride {
  /** Forced event ID to enable */
  forcedEventId: string | null;
  /** Force disable specific events */
  forcedDisabledIds: string[];
  /** Preview mode */
  previewMode: boolean;
  /** Override expires at timestamp */
  expiresAt: number | null;
}

export interface EventFeatureFlags {
  /** Event theme is active */
  hasEventTheme: boolean;
  /** Event gifts are available */
  hasEventGifts: boolean;
  /** Event bonuses are active */
  hasEventBonuses: boolean;
  /** Social highlights are active */
  hasSocialHighlights: boolean;
  /** Pride mode is active */
  isPrideEvent: boolean;
  /** GPU-safe animations are enabled */
  animationsEnabled: boolean;
  /** Limited time badge should show */
  showLimitedBadge: boolean;
}

// ============================================================================
// Event Registry
// ============================================================================

export type EventId = 
  | 'april_fools'
  | 'valentines'
  | 'pride'
  | 'halloween'
  | 'christmas'
  | 'new_year'
  | 'thanksgiving'
  | 'independence_day'
  | 'easter'
  | 'spring'
  | 'summer'
  | 'fall'
  | 'winter';

export type GlobalEventRegistry = Record<EventId, GlobalEventConfig>;
