/**
 * Global Event Registry
 * 
 * Centralized configuration for all holidays and pride events.
 * Each event auto-activates at start time and auto-reverts at end time.
 * 
 * Adding a new event = adding one config object here. No code changes needed.
 */

import { GlobalEventRegistry, GlobalEventConfig, EventFeatureFlags } from './types';

// ============================================================================
// Helper to create yearly event timestamps
// ============================================================================

const createYearlyEvent = (
  id: GlobalEventConfig['id'],
  name: GlobalEventConfig['name'],
  description: GlobalEventConfig['description'],
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
  config: Omit<GlobalEventConfig, 'id' | 'name' | 'description' | 'startTimestamp' | 'endTimestamp'>
): GlobalEventConfig => {
  const currentYear = new Date().getFullYear();
  
  // Handle year boundary crossing (e.g., New Year's Eve to New Year's Day)
  const startYear = endMonth < startMonth ? currentYear - 1 : currentYear;
  const endYear = endMonth < startMonth ? currentYear : currentYear;
  
  const startTimestamp = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0).toISOString();
  const endTimestamp = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999).toISOString();
  
  return {
    id,
    name,
    description,
    startTimestamp,
    endTimestamp,
    priority: config.priority ?? 0,
    isGlobal: config.isGlobal ?? true,
    ...config,
  } as GlobalEventConfig;
};

// ============================================================================
// Valentine's Day (February 14)
// ============================================================================

export const valentinesEvent = createYearlyEvent(
  'valentines',
  "Valentine's Day",
  'Celebrate love and friendship with special gifts and bonuses!',
  2, 14, 2, 14,
  {
    theme: {
      primaryColor: '#FF2D55',
      secondaryColor: '#FF6B9D',
      backgroundAccent: 'bg-rose-500/10',
      textHighlight: 'text-rose-400',
      borderAccent: 'border-rose-500/30',
      buttonClass: 'bg-gradient-to-r from-rose-500 to-pink-500',
      badgeBackground: 'bg-rose-500/20',
      particleEffect: 'hearts',
      cssVariables: {
        '--event-primary': '#FF2D55',
        '--event-secondary': '#FF6B9D',
      },
    },
    giftPacks: [
      {
        id: 'valentine_rose',
        name: 'Virtual Rose',
        description: 'A beautiful digital rose for someone special',
        coinPrice: 100,
        emoji: '🌹',
        animation: 'glow',
        category: 'exclusive',
      },
      {
        id: 'valentine_heart',
        name: 'Giant Heart',
        description: 'Show your love with a giant heart animation',
        coinPrice: 500,
        emoji: '💖',
        animation: 'pulse',
        category: 'exclusive',
      },
      {
        id: 'valentine_couple',
        name: 'Couple Frame',
        description: 'Limited edition couple profile frame',
        coinPrice: 1000,
        emoji: '💑',
        animation: 'float',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 1.5,
        description: 'Send Valentine gifts for 1.5x XP!',
        affectedActions: ['gift'],
      },
      {
        type: 'gift_discount',
        value: 0.9,
        description: '10% off all Valentine gifts',
        affectedActions: ['gift'],
      },
    ],
    socialHighlights: [
      {
        type: 'frequent_gifter',
        config: { minGifts: 5, frameColor: 'rose' },
        persistent: false,
      },
      {
        type: 'pair_highlight',
        config: { enableCoupleBadges: true },
        persistent: false,
      },
    ],
  }
);

// ============================================================================
// Pride Month (June) - Special handling for inclusivity
// ============================================================================

export const prideEvent = createYearlyEvent(
  'pride',
  'Pride Month',
  'Celebrate diversity, inclusion, and the LGBTQ+ community with us!',
  6, 1, 6, 30,
  {
    theme: {
      primaryColor: '#FF6B35',
      secondaryColor: '#A05CF7',
      backgroundAccent: 'bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-blue-500/10',
      textHighlight: 'text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-400 to-blue-400',
      borderAccent: 'border-gradient-to-r from-orange-500 via-pink-500 to-blue-500',
      buttonClass: 'bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500',
      badgeBackground: 'bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-blue-500/20',
      particleEffect: 'rainbow',
      cssVariables: {
        '--event-primary': '#FF6B35',
        '--event-secondary': '#A05CF7',
        '--pride-rainbow': 'linear-gradient(90deg, #FF0018, #FFA52C, #FFFF00, #008018, #0000F9, #86007D)',
      },
    },
    prideConfig: {
      rainbowAccents: true,
      prideBadgeFrames: true,
      gradientHighlights: true,
      inclusiveMessaging: true,
      optInRequired: true,
    },
    giftPacks: [
      {
        id: 'pride_flag_heart',
        name: 'Pride Heart',
        description: 'A heart in your flag colors - opt-in to show your pride!',
        coinPrice: 150,
        emoji: '🏳️‍🌈',
        animation: 'glow',
        category: 'special',
      },
      {
        id: 'pride_rainbow',
        name: 'Rainbow Burst',
        description: 'Celebrate with a rainbow explosion effect',
        coinPrice: 300,
        emoji: '🌈',
        animation: 'pulse',
        category: 'special',
      },
    ],
    socialHighlights: [
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
    ],
    priority: 5, // Higher priority for inclusive events
  }
);

// ============================================================================
// Easter (Varies - using April 16 for 2026)
// ============================================================================

export const easterEvent = createYearlyEvent(
  'easter',
  'Easter',
  'Find golden eggs and enjoy springtime bonuses!',
  4, 5, 4, 19,
  {
    theme: {
      primaryColor: '#FFD700',
      secondaryColor: '#98FB98',
      backgroundAccent: 'bg-amber-500/10',
      textHighlight: 'text-amber-400',
      borderAccent: 'border-amber-500/30',
      buttonClass: 'bg-gradient-to-r from-amber-400 to-yellow-500',
      badgeBackground: 'bg-amber-500/20',
      particleEffect: 'leaves',
      cssVariables: {
        '--event-primary': '#FFD700',
        '--event-secondary': '#98FB98',
      },
    },
    giftPacks: [
      {
        id: 'easter_egg',
        name: 'Golden Egg',
        description: 'A rare golden Easter egg!',
        coinPrice: 500,
        emoji: '🥚',
        animation: 'glow',
        category: 'exclusive',
      },
      {
        id: 'easter_bunny',
        name: 'Easter Bunny',
        description: 'Cute bunny companion animation',
        coinPrice: 200,
        emoji: '🐰',
        animation: 'bounce',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 1.25,
        description: '1.25x XP for Easter activity!',
        affectedActions: ['stream', 'chat'],
      },
    ],
  }
);

// ============================================================================
// Halloween (October 31)
// ============================================================================

export const halloweenEvent = createYearlyEvent(
  'halloween',
  'Halloween',
  'Spooky specials, haunted gifts, and terrifying treats! 👻',
  10, 28, 11, 1,
  {
    theme: {
      primaryColor: '#FF6B35',
      secondaryColor: '#9C27B0',
      backgroundAccent: 'bg-purple-900/20',
      textHighlight: 'text-orange-400',
      borderAccent: 'border-orange-500/30',
      buttonClass: 'bg-gradient-to-r from-orange-600 to-purple-600',
      badgeBackground: 'bg-orange-500/20',
      particleEffect: 'confetti',
      cssVariables: {
        '--event-primary': '#FF6B35',
        '--event-secondary': '#9C27B0',
      },
    },
    giftPacks: [
      {
        id: 'halloween_pumpkin',
        name: 'Jack-o-Lantern',
        description: 'A glowing pumpkin with spooky face',
        coinPrice: 150,
        emoji: '🎃',
        animation: 'glow',
        category: 'exclusive',
      },
      {
        id: 'halloween_ghost',
        name: 'Friendly Ghost',
        description: 'A cute ghost that floats around',
        coinPrice: 250,
        emoji: '👻',
        animation: 'float',
        category: 'exclusive',
      },
      {
        id: 'halloween_skull',
        name: 'Crystal Skull',
        description: 'Rare crystal skull with mysterious glow',
        coinPrice: 1000,
        emoji: '💀',
        animation: 'pulse',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 2.0,
        description: 'Double XP for Halloween streaming!',
        affectedActions: ['stream'],
      },
      {
        type: 'streak_boost',
        value: 1.5,
        description: '1.5x streak multiplier!',
        affectedActions: ['stream'],
      },
    ],
    socialHighlights: [
      {
        type: 'supporter_badge',
        config: { badgeStyle: 'spooky' },
        persistent: false,
      },
    ],
  }
);

// ============================================================================
// Thanksgiving (Fourth Thursday of November)
// ============================================================================

export const thanksgivingEvent = createYearlyEvent(
  'thanksgiving',
  'Thanksgiving',
  'Give thanks with family, feasts, and fall bonuses! 🦃',
  11, 26, 11, 29,
  {
    theme: {
      primaryColor: '#D2691E',
      secondaryColor: '#CD853F',
      backgroundAccent: 'bg-amber-700/10',
      textHighlight: 'text-amber-500',
      borderAccent: 'border-amber-600/30',
      buttonClass: 'bg-gradient-to-r from-amber-600 to-orange-600',
      badgeBackground: 'bg-amber-600/20',
      particleEffect: 'leaves',
      cssVariables: {
        '--event-primary': '#D2691E',
        '--event-secondary': '#CD853F',
      },
    },
    giftPacks: [
      {
        id: 'thanksgiving_turkey',
        name: 'Thankful Turkey',
        description: 'A turkey to show your gratitude',
        coinPrice: 200,
        emoji: '🦃',
        animation: 'bounce',
        category: 'exclusive',
      },
      {
        id: 'thanksgiving_feast',
        name: 'Holiday Feast',
        description: 'A bountiful feast animation',
        coinPrice: 500,
        emoji: '🍽️',
        animation: 'pulse',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'coin_rebate',
        value: 0.05,
        description: '5% coins back on gifts!',
        affectedActions: ['gift'],
      },
    ],
  }
);

// ============================================================================
// Christmas (December 25)
// ============================================================================

export const christmasEvent = createYearlyEvent(
  'christmas',
  'Christmas',
  'Magic, gifts, and holiday cheer! 🎄⭐',
  12, 20, 12, 27,
  {
    theme: {
      primaryColor: '#C41E3A',
      secondaryColor: '#228B22',
      backgroundAccent: 'bg-red-900/10',
      textHighlight: 'text-red-400',
      borderAccent: 'border-red-500/30',
      buttonClass: 'bg-gradient-to-r from-red-600 to-green-600',
      badgeBackground: 'bg-red-500/20',
      particleEffect: 'snow',
      cssVariables: {
        '--event-primary': '#C41E3A',
        '--event-secondary': '#228B22',
        '--event-snow': 'true',
      },
    },
    giftPacks: [
      {
        id: 'christmas_tree',
        name: 'Christmas Tree',
        description: 'A magical decorated tree',
        coinPrice: 300,
        emoji: '🎄',
        animation: 'glow',
        category: 'exclusive',
      },
      {
        id: 'christmas_gift',
        name: 'Wrapped Gift',
        description: 'A surprise gift box!',
        coinPrice: 150,
        emoji: '🎁',
        animation: 'bounce',
        category: 'exclusive',
      },
      {
        id: 'christmas_santa',
        name: 'Santa Claus',
        description: 'Santa delivers gifts!',
        coinPrice: 1000,
        emoji: '🎅',
        animation: 'float',
        category: 'limited',
      },
      {
        id: 'christmas_reindeer',
        name: 'Flying Reindeer',
        description: 'Reindeer flying across the screen',
        coinPrice: 750,
        emoji: '🦌',
        animation: 'float',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 2.0,
        description: '2x XP for holiday streaming!',
        affectedActions: ['stream'],
      },
      {
        type: 'streak_boost',
        value: 2.0,
        description: '2x streak bonus for holiday activity!',
        affectedActions: ['stream'],
      },
      {
        type: 'gift_discount',
        value: 0.85,
        description: '15% off all Christmas gifts!',
        affectedActions: ['gift'],
      },
    ],
    socialHighlights: [
      {
        type: 'supporter_badge',
        config: { badgeStyle: 'holiday', minGifts: 3 },
        persistent: false,
      },
      {
        type: 'frequent_gifter',
        config: { minGifts: 10, frameColor: 'holiday' },
        persistent: false,
      },
    ],
    priority: 3,
  }
);

// ============================================================================
// New Year's (December 31 - January 1)
// ============================================================================

export const newYearEvent = createYearlyEvent(
  'new_year',
  "New Year's",
  'Count down to the new year with explosive celebrations! 🎉',
  12, 31, 1, 1,
  {
    theme: {
      primaryColor: '#FFD700',
      secondaryColor: '#C0C0C0',
      backgroundAccent: 'bg-yellow-500/10',
      textHighlight: 'text-yellow-400',
      borderAccent: 'border-yellow-500/30',
      buttonClass: 'bg-gradient-to-r from-yellow-500 to-silver-500',
      badgeBackground: 'bg-yellow-500/20',
      particleEffect: 'confetti',
      cssVariables: {
        '--event-primary': '#FFD700',
        '--event-secondary': '#C0C0C0',
      },
    },
    giftPacks: [
      {
        id: 'newyear_firework',
        name: 'Fireworks',
        description: 'Explosive fireworks display!',
        coinPrice: 500,
        emoji: '🎆',
        animation: 'pulse',
        category: 'exclusive',
      },
      {
        id: 'newyear_clock',
        name: 'Countdown Clock',
        description: 'Watch the clock strike midnight!',
        coinPrice: 100,
        emoji: '🕛',
        animation: 'pulse',
        category: 'exclusive',
      },
      {
        id: 'newyear_champagne',
        name: 'Champagne Toast',
        description: 'Cheers to the new year!',
        coinPrice: 300,
        emoji: '🥂',
        animation: 'glow',
        category: 'limited',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 3.0,
        description: 'TRIPLE XP for New Year streaming!',
        affectedActions: ['stream'],
      },
      {
        type: 'streak_boost',
        value: 2.0,
        description: 'Double streak bonus!',
        affectedActions: ['stream'],
      },
    ],
    priority: 10, // Highest priority for major events
  }
);

// ============================================================================
// Independence Day (July 4)
// ============================================================================

export const independenceDayEvent = createYearlyEvent(
  'independence_day',
  'Independence Day',
  'Stars, stripes, and red, white, and blue celebrations! 🇺🇸',
  7, 4, 7, 5,
  {
    theme: {
      primaryColor: '#3C3B6E',
      secondaryColor: '#B22234',
      backgroundAccent: 'bg-blue-900/10',
      textHighlight: 'text-blue-400',
      borderAccent: 'border-red-500/30',
      buttonClass: 'bg-gradient-to-r from-blue-600 to-red-600',
      badgeBackground: 'bg-blue-500/20',
      particleEffect: 'confetti',
      cssVariables: {
        '--event-primary': '#3C3B6E',
        '--event-secondary': '#B22234',
      },
    },
    giftPacks: [
      {
        id: 'firework_usa',
        name: 'Patriotic Fireworks',
        description: 'Red, white, and blue fireworks!',
        coinPrice: 400,
        emoji: '🎆',
        animation: 'pulse',
        category: 'exclusive',
      },
      {
        id: 'flag_usa',
        name: 'American Flag',
        description: 'Wave the stars and stripes!',
        coinPrice: 200,
        emoji: '🇺🇸',
        animation: 'float',
        category: 'exclusive',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 1.5,
        description: '1.5x XP for July 4th streaming!',
        affectedActions: ['stream'],
      },
    ],
  }
);

// ============================================================================
// Spring Season (March-May)
// ============================================================================

export const springEvent = createYearlyEvent(
  'spring',
  'Spring Festival',
  'Bloom into spring with fresh flowers and new beginnings! 🌸',
  3, 1, 5, 31,
  {
    theme: {
      primaryColor: '#FF69B4',
      secondaryColor: '#98FB98',
      backgroundAccent: 'bg-pink-500/10',
      textHighlight: 'text-pink-400',
      borderAccent: 'border-pink-500/30',
      buttonClass: 'bg-gradient-to-r from-pink-400 to-green-400',
      badgeBackground: 'bg-pink-500/20',
      particleEffect: 'leaves',
      cssVariables: {
        '--event-primary': '#FF69B4',
        '--event-secondary': '#98FB98',
      },
    },
    giftPacks: [
      {
        id: 'spring_flower',
        name: 'Cherry Blossom',
        description: 'Beautiful sakura petals!',
        coinPrice: 150,
        emoji: '🌸',
        animation: 'float',
        category: 'special',
      },
      {
        id: 'spring_rainbow',
        name: 'Spring Rainbow',
        description: 'After the rain comes color!',
        coinPrice: 300,
        emoji: '🌈',
        animation: 'pulse',
        category: 'special',
      },
    ],
  }
);

// ============================================================================
// Summer Season (June-August)
// ============================================================================

export const summerEvent = createYearlyEvent(
  'summer',
  'Summer Vibes',
  'Soak up the sun with hot summer rewards! ☀️',
  6, 1, 8, 31,
  {
    theme: {
      primaryColor: '#FFD700',
      secondaryColor: '#00BFFF',
      backgroundAccent: 'bg-yellow-500/10',
      textHighlight: 'text-yellow-400',
      borderAccent: 'border-cyan-500/30',
      buttonClass: 'bg-gradient-to-r from-yellow-400 to-cyan-400',
      badgeBackground: 'bg-yellow-500/20',
      particleEffect: 'confetti',
      cssVariables: {
        '--event-primary': '#FFD700',
        '--event-secondary': '#00BFFF',
      },
    },
    giftPacks: [
      {
        id: 'summer_sun',
        name: 'Sunny Day',
        description: 'Radiant sunshine animation!',
        coinPrice: 200,
        emoji: '☀️',
        animation: 'glow',
        category: 'special',
      },
      {
        id: 'summer_beach',
        name: 'Beach Ball',
        description: 'Fun in the sun!',
        coinPrice: 150,
        emoji: '🏖️',
        animation: 'bounce',
        category: 'special',
      },
    ],
    bonuses: [
      {
        type: 'xp_multiplier',
        value: 1.25,
        description: '1.25x XP for summer streaming!',
        affectedActions: ['stream'],
      },
    ],
  }
);

// ============================================================================
// Fall/Autumn Season (September-November)
// ============================================================================

export const fallEvent = createYearlyEvent(
  'fall',
  'Autumn Harvest',
  'Fall into fun with harvest bonuses and cozy vibes! 🍂',
  9, 1, 11, 30,
  {
    theme: {
      primaryColor: '#D2691E',
      secondaryColor: '#8B4513',
      backgroundAccent: 'bg-orange-900/10',
      textHighlight: 'text-orange-400',
      borderAccent: 'border-orange-600/30',
      buttonClass: 'bg-gradient-to-r from-orange-600 to-amber-600',
      badgeBackground: 'bg-orange-600/20',
      particleEffect: 'leaves',
      cssVariables: {
        '--event-primary': '#D2691E',
        '--event-secondary': '#8B4513',
      },
    },
    giftPacks: [
      {
        id: 'fall_leaf',
        name: 'Falling Leaf',
        description: 'Beautiful autumn leaf animation!',
        coinPrice: 100,
        emoji: '🍂',
        animation: 'float',
        category: 'special',
      },
      {
        id: 'fall_pumpkin',
        name: 'Harvest Pumpkin',
        description: 'A festive pumpkin for the harvest season!',
        coinPrice: 200,
        emoji: '🎃',
        animation: 'glow',
        category: 'special',
      },
    ],
  }
);

// ============================================================================
// Winter Season (December-February)
// ============================================================================

export const winterEvent = createYearlyEvent(
  'winter',
  'Winter Wonderland',
  'Bundle up for winter magic and frosty fun! ❄️',
  12, 1, 2, 28,
  {
    theme: {
      primaryColor: '#00BFFF',
      secondaryColor: '#FFFFFF',
      backgroundAccent: 'bg-cyan-500/10',
      textHighlight: 'text-cyan-400',
      borderAccent: 'border-cyan-500/30',
      buttonClass: 'bg-gradient-to-r from-cyan-400 to-white',
      badgeBackground: 'bg-cyan-500/20',
      particleEffect: 'snow',
      cssVariables: {
        '--event-primary': '#00BFFF',
        '--event-secondary': '#FFFFFF',
      },
    },
    giftPacks: [
      {
        id: 'winter_snowflake',
        name: 'Snowflake',
        description: 'Beautiful crystal snowflake!',
        coinPrice: 150,
        emoji: '❄️',
        animation: 'float',
        category: 'special',
      },
      {
        id: 'winter_igloo',
        name: 'Cozy Igloo',
        description: 'Warm up in a snowy igloo!',
        coinPrice: 400,
        emoji: '🛖',
        animation: 'glow',
        category: 'special',
      },
    ],
    bonuses: [
      {
        type: 'streak_boost',
        value: 1.5,
        description: '1.5x streak bonus for winter streams!',
        affectedActions: ['stream'],
      },
    ],
  }
);

// ============================================================================
// April Fools Day (April 1) - Chaos Mode
// ============================================================================

export const aprilFoolsEvent = createYearlyEvent(
  'april_fools',
  'Chaos Mode',
  'April Fools! Nothing is what it seems today. Max 2 pranks per user.',
  4, 1, 4, 1,
  {
    theme: {
      primaryColor: '#8b5cf6',
      secondaryColor: '#f59e0b',
      backgroundAccent: 'bg-purple-500/10',
      textHighlight: 'text-purple-400',
      borderAccent: 'border-purple-500/30',
      buttonClass: 'bg-gradient-to-r from-purple-600 to-amber-500',
      badgeBackground: 'bg-purple-500/20',
      particleEffect: 'none',
      cssVariables: {
        '--event-primary': '#8b5cf6',
        '--event-secondary': '#f59e0b',
        '--event-accent': '#ef4444',
        '--event-bg': 'linear-gradient(135deg, #1a0533, #2d1b69)',
        '--event-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
      },
    },
    giftPacks: [],
    bonuses: [],
    socialHighlights: {
      showFrequentGifter: false,
      showTopSupporter: false,
      specialBadgeText: 'CHOS',
      specialBadgeColor: '#8b5cf6',
      enableVIPFrame: false,
      customEntranceEffect: undefined,
    },
    priority: 100, // High priority
    isGlobal: true,
  }
);

// ============================================================================
// Event Registry Export
// ============================================================================

export const GlobalEvents: GlobalEventRegistry = {
  april_fools: aprilFoolsEvent,
  valentines: valentinesEvent,
  pride: prideEvent,
  easter: easterEvent,
  halloween: halloweenEvent,
  thanksgiving: thanksgivingEvent,
  christmas: christmasEvent,
  new_year: newYearEvent,
  independence_day: independenceDayEvent,
  spring: springEvent,
  summer: summerEvent,
  fall: fallEvent,
  winter: winterEvent,
};

// ============================================================================
// Event Utility Functions
// ============================================================================

/**
 * Get current server time (accounts for client-server offset)
 */
export const getServerTime = (): Date => {
  const offset = useEventStore.getState().serverTimeOffset;
  return new Date(Date.now() + offset);
};

/**
 * Check if an event is currently active
 */
export const isEventActive = (event: GlobalEventConfig): boolean => {
  const now = getServerTime();
  const start = new Date(event.startTimestamp);
  const end = new Date(event.endTimestamp);
  return now >= start && now < end;
};

/**
 * Get all currently active events
 */
export const getActiveEvents = (): GlobalEventConfig[] => {
  return Object.values(GlobalEvents).filter(isEventActive);
};

/**
 * Get the highest priority active event
 */
export const getPrimaryActiveEvent = (): GlobalEventConfig | null => {
  const active = getActiveEvents();
  if (active.length === 0) return null;
  
  // Sort by priority (highest first), then by end time (longer events first)
  return active.sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.endTimestamp).getTime() - new Date(a.endTimestamp).getTime();
  })[0];
};

/**
 * Calculate feature flags based on active events
 */
export const calculateFeatureFlags = (
  primaryEvent: GlobalEventConfig | null,
  allActiveEvents: GlobalEventConfig[]
): EventFeatureFlags => {
  // Determine flags from primary event
  const hasEventTheme = !!primaryEvent;
  const hasEventGifts = !!primaryEvent?.giftPacks?.length;
  const hasEventBonuses = !!primaryEvent?.bonuses?.length;
  const hasSocialHighlights = !!primaryEvent?.socialHighlights?.length;
  const isPrideEvent = primaryEvent?.id === 'pride';
  
  // Show limited badge if any active event has limited gifts
  const showLimitedBadge = allActiveEvents.some(
    event => event.giftPacks?.some(gift => gift.category === 'limited')
  );
  
  // Animations enabled by default (can be toggled by user preferences)
  const animationsEnabled = true;
  
  return {
    hasEventTheme,
    hasEventGifts,
    hasEventBonuses,
    hasSocialHighlights,
    isPrideEvent,
    animationsEnabled,
    showLimitedBadge,
  };
};

// ============================================================================
// Event Store (Zustand)
// ============================================================================

import { create } from 'zustand';

interface EventStoreState {
  /** Currently active event ID or null */
  activeEventId: string | null;
  /** Server time offset in ms */
  serverTimeOffset: number;
  /** Admin override state */
  adminOverride: {
    forcedEventId: string | null;
    forcedDisabledIds: string[];
    previewMode: boolean;
    expiresAt: number | null;
  } | null;
  
  // Actions
  setActiveEvent: (eventId: string | null) => void;
  setServerTimeOffset: (offset: number) => void;
  setAdminOverride: (override: EventStoreState['adminOverride']) => void;
}

export const useEventStore = create<EventStoreState>((set) => ({
  activeEventId: null,
  serverTimeOffset: 0,
  adminOverride: null,
  
  setActiveEvent: (eventId) => set({ activeEventId: eventId }),
  setServerTimeOffset: (offset) => set({ serverTimeOffset: offset }),
  setAdminOverride: (override) => set({ adminOverride: override }),
}));
