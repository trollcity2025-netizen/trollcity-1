import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useTrollEngine, TrollEvent } from './useTrollEngine';
import { subscribeEvents, TrollEventType } from '../lib/events';
import TrollOverlay from './TrollOverlay';

interface TrollContextType {
  triggerTroll: (context?: string, options?: { safe?: boolean }) => void;
}

const TrollContext = createContext<TrollContextType | undefined>(undefined);

interface TrollProviderProps {
  children: ReactNode;
}

// Event types that can trigger trolls with their contexts
const EVENT_TROLL_CONTEXTS: Record<TrollEventType, string> = {
  'chat_message_sent': 'chat',
  'reaction_added': 'reaction',
  'district_entered': 'district',
  'stream_watch_time': 'stream',
  'coin_spent': 'coin_spend',
  'court_event': 'court',
  'war_match_end': 'battle',
  'ai_decision_event': 'ai_decision',
  'economy_loss': 'economy',
  'economy_gain': 'economy',
  'pod_started': 'pod',
  'pod_listened': 'pod',
};

// Track action counts per user in memory
const userActionCounts: Record<string, number> = {};
const userActionThresholds: Record<string, number> = {};

// Get random threshold between 15-25 actions
const getRandomThreshold = () => Math.floor(Math.random() * 11) + 15; // 15-25

export const TrollProvider = ({ children }: TrollProviderProps) => {
  const { triggerTroll: engineTriggerTroll, completeTroll } = useTrollEngine();
  const [activeTroll, setActiveTroll] = useState<TrollEvent | null>(null);

  // Handle triggering a troll
  const triggerTroll = useCallback((context?: string, options?: { safe?: boolean }) => {
    const event = engineTriggerTroll(context, options);

    if (event) {
      setActiveTroll(event);

      // Auto-complete the troll after duration
      setTimeout(() => {
        setActiveTroll(null);
        completeTroll();
      }, event.duration);
    }
  }, [engineTriggerTroll, completeTroll]);

  // Subscribe to events and trigger trolls based on action count
  useEffect(() => {
    const unsubscribe = subscribeEvents((event) => {
      const context = EVENT_TROLL_CONTEXTS[event.type];
      if (!context) return;

      const userId = event.userId;
      if (!userId) return;

      // Initialize user's action count and threshold
      if (userActionCounts[userId] === undefined) {
        userActionCounts[userId] = 0;
        userActionThresholds[userId] = getRandomThreshold();
      }

      // Increment action count
      userActionCounts[userId]++;
      const currentCount = userActionCounts[userId];
      const threshold = userActionThresholds[userId];

      console.log(`[TrollProvider] User ${userId} action count: ${currentCount}/${threshold}`);

      // Check if we've reached the threshold
      if (currentCount >= threshold) {
        console.log(`[TrollProvider] Threshold reached! Triggering troll for ${userId}`);

        // Reset counter and set new random threshold
        userActionCounts[userId] = 0;
        userActionThresholds[userId] = getRandomThreshold();

        // Trigger the troll with a small delay
        setTimeout(() => {
          triggerTroll(context);
        }, 500);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [triggerTroll]);

  return (
    <TrollContext.Provider value={{ triggerTroll }}>
      {children}
      {activeTroll && <TrollOverlay event={activeTroll} onComplete={() => setActiveTroll(null)} />}
    </TrollContext.Provider>
  );
};

export const useTrollContext = () => {
  const context = useContext(TrollContext);
  if (!context) {
    throw new Error('useTrollContext must be used within a TrollProvider');
  }
  return context;
};

export default TrollProvider;
