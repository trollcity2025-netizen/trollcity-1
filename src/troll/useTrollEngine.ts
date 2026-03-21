import { useState, useEffect, useCallback } from 'react';
import { PreflightStore } from '../lib/preflightStore';

// Define rarity tiers
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

// Define troll event types
export type TrollEventType = 'TROLL_JUMPSCARE' | 'FAKE_BAN_SCREEN' | 'FAKE_VIRUS_SCAN' | 'FAKE_COIN_LOSS' | 'TROLL_COURT_SUMMONS';

// Define troll event interface
export interface TrollEvent {
  id: string;
  type: TrollEventType;
  rarity: Rarity;
  duration: number; // in milliseconds
}

// Define context interface
export interface TriggerTrollContext {
  context?: string;
  options?: {
    safe?: boolean;
  };
}

// Rarity probabilities
const RARITY_PROBABILITIES = {
  COMMON: 0.70,
  RARE: 0.20,
  EPIC: 0.09,
  LEGENDARY: 0.01,
};

// Event type probabilities by rarity
const EVENT_TYPE_PROBABILITIES: Record<Rarity, Array<{ type: TrollEventType; probability: number }>> = {
  COMMON: [
    { type: 'TROLL_JUMPSCARE', probability: 0.2 },
    { type: 'FAKE_BAN_SCREEN', probability: 0.2 },
    { type: 'TROLL_COURT_SUMMONS', probability: 0.2 },
  ],
  RARE: [
    { type: 'FAKE_VIRUS_SCAN', probability: 0.6 },
    { type: 'FAKE_COIN_LOSS', probability: 0.4 },
  ],
  EPIC: [
    { type: 'TROLL_COURT_SUMMONS', probability: 0.2 },
    { type: 'FAKE_BAN_SCREEN', probability: 0.2 },
    { type: 'TROLL_JUMPSCARE', probability: 0.2 },
  ],
  LEGENDARY: [
    { type: 'TROLL_COURT_SUMMONS', probability: 0.2 },
    { type: 'FAKE_COIN_LOSS', probability: 0.2 },
  ],
};

// Cooldown duration (30 seconds for testing, change to 2 * 600 * 1000 for production)
const COOLDOWN_DURATION = 300 * 1000;

// Safe contexts where trolls should not trigger
const SAFE_CONTEXTS = [
  'payment',
  'withdrawal',
  'wallet',
  'authentication',
  'moderation',
  'account_settings',
  'court',
  'church',
  'news',
  'tcnn',
  'broadcast', // Disable trolls when broadcasting or watching
];

// Hook for triggering troll events
export const useTrollEngine = (onBackgroundTrigger?: (event: TrollEvent) => void) => {
  const [lastTrollTime, setLastTrollTime] = useState<number>(0);
  const [isTrollActive, setIsTrollActive] = useState<boolean>(false);

  // Determine if a troll should be triggered based on probability and cooldown
  const shouldTriggerTroll = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTroll = now - lastTrollTime;

    // Check cooldown
    if (timeSinceLastTroll < COOLDOWN_DURATION) {
      return false;
    }

    // Always allow when called (probability handled by action count in TrollProvider)
    return true;
  }, [lastTrollTime]);

  // Select a random rarity based on probabilities
  const selectRarity = useCallback((): Rarity => {
    const roll = Math.random();
    let cumulative = 0;

    if (roll <= RARITY_PROBABILITIES.COMMON) return 'COMMON';
    cumulative += RARITY_PROBABILITIES.COMMON;
    if (roll <= cumulative + RARITY_PROBABILITIES.RARE) return 'RARE';
    cumulative += RARITY_PROBABILITIES.RARE;
    if (roll <= cumulative + RARITY_PROBABILITIES.EPIC) return 'EPIC';
    cumulative += RARITY_PROBABILITIES.EPIC;
    return 'LEGENDARY';
  }, []);

  // Select an event type based on rarity
  const selectEventType = useCallback((rarity: Rarity): TrollEventType => {
    const roll = Math.random();
    const events = EVENT_TYPE_PROBABILITIES[rarity];
    let cumulative = 0;

    for (const event of events) {
      cumulative += event.probability;
      if (roll <= cumulative) {
        return event.type;
      }
    }

    return events[0].type; // Fallback to first event
  }, []);

  // Create a new troll event
  const createTrollEvent = useCallback((): TrollEvent => {
    const rarity = selectRarity();
    const type = selectEventType(rarity);
    let duration = 3000; // Default duration

    // Adjust duration based on rarity and type
    if (rarity === 'LEGENDARY') {
      duration = 5000;
    } else if (rarity === 'EPIC') {
      duration = 4000;
    }

    if (type === 'FAKE_VIRUS_SCAN') {
      duration = rarity === 'LEGENDARY' ? 8000 : 5000;
    }

    return {
      id: `troll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      rarity,
      duration,
    };
  }, [selectRarity, selectEventType]);

  // Trigger a troll event
  const triggerTroll = useCallback((context?: string, options?: { safe?: boolean }) => {
    console.log('[TrollEngine] Trigger attempt. Context:', context, 'Safe:', options?.safe);

    // Check if user is in battle or broadcast mode (should disable trolls)
    const isInBattle = PreflightStore.getInBattle();
    const isInBroadcast = PreflightStore.getInBroadcast();
    if (isInBattle || isInBroadcast) {
      console.log('[TrollEngine] Blocked - user is in battle or broadcast mode');
      return null;
    }

    // Check if safe mode or safe context
    if (options?.safe || (context && SAFE_CONTEXTS.some(safeContext =>
      context.toLowerCase().includes(safeContext.toLowerCase())
    ))) {
      console.log('[TrollEngine] Blocked - safe context');
      return null;
    }

    // Check if a troll is already active
    if (isTrollActive) {
      console.log('[TrollEngine] Blocked - troll already active');
      return null;
    }

    // Determine if we should trigger a troll
    if (!shouldTriggerTroll()) {
      console.log('[TrollEngine] Blocked - probability check failed or cooldown');
      return null;
    }

    // Create and return the troll event
    const event = createTrollEvent();
    setLastTrollTime(Date.now());
    setIsTrollActive(true);
    console.log('[TrollEngine] Troll triggered:', event.type, 'Rarity:', event.rarity);

    return event;
  }, [isTrollActive, shouldTriggerTroll, createTrollEvent]);

  // Set isTrollActive to false when event completes
  const completeTroll = useCallback(() => {
    setIsTrollActive(false);
  }, []);

  // Background troll trigger - simplified and more reliable
  useEffect(() => {
    // Trigger a background troll check every 1-3 minutes
    const checkInterval = setInterval(() => {
      // Check if user is in battle or broadcast mode (should disable background trolls)
      const isInBattle = PreflightStore.getInBattle();
      const isInBroadcast = PreflightStore.getInBroadcast();
      
      if (isInBattle || isInBroadcast) {
        // Skip background troll when in battle or broadcast mode
        return;
      }
      
      if (!isTrollActive) {
        const roll = Math.random();
        // 20% chance every 1-3 minutes for background trolls
        if (roll < 0.2) {
          const event = createTrollEvent();
          setLastTrollTime(Date.now());
          setIsTrollActive(true);
          console.log('[TrollEngine] Background troll triggered:', event.type);

          // Call the callback if provided (for TrollProvider to display the overlay)
          if (onBackgroundTrigger) {
            onBackgroundTrigger(event);
          }

          // Auto-complete the troll after duration
          setTimeout(() => {
            setIsTrollActive(false);
          }, event.duration);
        }
      }
    }, (1 + Math.random() * 2) * 60 * 1000); // 1-3 minutes

    return () => {
      clearInterval(checkInterval);
    };
  }, [isTrollActive, createTrollEvent, onBackgroundTrigger]);

  return {
    triggerTroll,
    completeTroll,
    isTrollActive,
  };
};
