export type TickerCategory =
  | 'hype'
  | 'recognition'
  | 'mission'
  | 'announcement'
  | 'monetization'
  | 'system';

export type TickerMode = 'manual' | 'hybrid' | 'auto';

export type TickerPosition = 'top' | 'bottom' | 'floating';

export type TickerSpeed = 'slow' | 'medium' | 'fast';

export type TickerTheme = 'neon' | 'minimal' | 'luxury' | 'glitch';

export interface TickerMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  category: TickerCategory;
  is_priority: boolean;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

export interface TickerSettings {
  stream_id: string;
  is_enabled: boolean;
  mode: TickerMode;
  position: TickerPosition;
  speed: TickerSpeed;
  theme: TickerTheme;
  color_scheme: string;
  opacity: number;
  max_messages: number;
  auto_interval_ms: number;
  priority_duration_ms: number;
}

export interface TickerTemplate {
  id: string;
  label: string;
  content: string;
  category: TickerCategory;
  icon: string;
}

export const DEFAULT_TICKER_SETTINGS: Omit<TickerSettings, 'stream_id'> = {
  is_enabled: true,
  mode: 'manual',
  position: 'top',
  speed: 'medium',
  theme: 'neon',
  color_scheme: 'cyan',
  opacity: 0.85,
  max_messages: 50,
  auto_interval_ms: 8000,
  priority_duration_ms: 5000,
};

export const TICKER_TEMPLATES: TickerTemplate[] = [
  { id: 'new-goal', label: 'NEW GOAL', content: 'NEW GOAL SET — LET\'S GO! 🎯', category: 'hype', icon: '🎯' },
  { id: 'final-push', label: 'FINAL PUSH', content: 'FINAL PUSH — WE\'RE SO CLOSE! 🔥', category: 'hype', icon: '🔥' },
  { id: 'top-fan', label: 'TOP FAN', content: 'SHOUTOUT TO OUR TOP FAN 👑', category: 'recognition', icon: '👑' },
  { id: 'mission-update', label: 'MISSION', content: 'MISSION UPDATE — KEEP IT UP! 📢', category: 'mission', icon: '📢' },
  { id: 'big-announcement', label: 'BIG NEWS', content: 'BIG ANNOUNCEMENT INCOMING 🚨', category: 'announcement', icon: '🚨' },
  { id: 'gift-goal', label: 'GIFT GOAL', content: 'GIFT GOAL UNLOCKED — THANK YOU! 💎', category: 'monetization', icon: '💎' },
  { id: 'welcome', label: 'WELCOME', content: 'WELCOME TO THE STREAM! ❤️', category: 'recognition', icon: '❤️' },
  { id: 'hype-train', label: 'HYPE TRAIN', content: 'HYPE TRAIN IS LEAVING THE STATION 🚂', category: 'hype', icon: '🚂' },
  { id: 'milestone', label: 'MILESTONE', content: 'MILESTONE REACHED — YOU\'RE AMAZING! 🏆', category: 'system', icon: '🏆' },
  { id: 'follow-raid', label: 'FOLLOW', content: 'SMASH THAT FOLLOW BUTTON! ➡️', category: 'announcement', icon: '➡️' },
];

export const CATEGORY_COLORS: Record<TickerCategory, string> = {
  hype: '#ff6b35',
  recognition: '#ffd700',
  mission: '#00d4ff',
  announcement: '#ff3366',
  monetization: '#a855f7',
  system: '#22c55e',
};

export const SPEED_MAP: Record<TickerSpeed, number> = {
  slow: 40,
  medium: 25,
  fast: 12,
};
