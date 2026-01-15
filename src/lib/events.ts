export type TrollEventType =
  | 'chat_message_sent'
  | 'reaction_added'
  | 'district_entered'
  | 'stream_watch_time'
  | 'coin_spent'
  | 'court_event'
  | 'war_match_end'
  | 'ai_decision_event'
  | 'economy_loss'
  | 'economy_gain';

export type TrollEvent = {
  type: TrollEventType;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: number;
};

type EventListener = (event: TrollEvent) => void;

const listeners = new Set<EventListener>();

let recentEvents: TrollEvent[] = [];

const MAX_RECENT_EVENTS = 500;
const DUP_WINDOW_MS = 2000;

export function emitEvent(type: TrollEventType, userId: string, metadata?: Record<string, any>) {
  if (!userId) return;

  const now = Date.now();
  const event: TrollEvent = {
    type,
    userId,
    metadata: metadata || {},
    createdAt: now
  };

  recentEvents = recentEvents.filter(e => now - e.createdAt < DUP_WINDOW_MS);

  const duplicate = recentEvents.some(e => {
    if (e.type !== event.type) return false;
    if (e.userId !== event.userId) return false;
    const a = JSON.stringify(e.metadata || {});
    const b = JSON.stringify(event.metadata || {});
    return a === b;
  });

  if (duplicate) return;

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
  }

  listeners.forEach(listener => {
    try {
      listener(event);
    } catch (err) {
      console.error('Troll event listener error', err);
    }
  });
}

export function subscribeEvents(listener: EventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

