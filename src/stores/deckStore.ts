import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export type DeckConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type DeckSessionStatus = 'active' | 'expired' | 'none';
export type StreamQuality = '720p' | '1080p';

export interface DeckStreamConfig {
  title: string;
  category: string;
  tags: string[];
  quality: StreamQuality;
  themeId: string | null;
  addons: DeckAddon[];
  isLive: boolean;
  streamId: string | null;
}

export interface DeckAddon {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  settings: Record<string, unknown>;
  visible: boolean;
  order: number;
}

export interface DeckStreamStats {
  viewerCount: number;
  peakViewers: number;
  duration: number;
  chatMessages: number;
  giftsReceived: number;
  coinsEarned: number;
  streamHealth: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  fps: number;
  droppedFrames: number;
}

export interface DeckAlert {
  id: string;
  type: 'gift' | 'follow' | 'raid' | 'host' | 'subscription' | 'donation' | 'system';
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface DeckChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  isModerator: boolean;
  isSystem: boolean;
}

export interface DeckTheme {
  id: string;
  name: string;
  previewUrl: string;
  owned: boolean;
  active: boolean;
}

export interface DeckSession {
  userId: string;
  startedAt: number;
  expiresAt: number;
  isValid: boolean;
}

export interface DeckPhoneLink {
  status: DeckConnectionStatus;
  phoneReady: boolean;
  lastSeen: number | null;
  streamId: string | null;
}

interface DeckState {
  // Session
  session: DeckSession | null;
  sessionStatus: DeckSessionStatus;

  // Phone link
  phoneLink: DeckPhoneLink;

  // Stream config (synced with phone)
  streamConfig: DeckStreamConfig;

  // Live stats
  streamStats: DeckStreamStats;

  // Chat
  chatMessages: DeckChatMessage[];
  chatInput: string;

  // Alerts
  alerts: DeckAlert[];
  unreadAlertCount: number;

  // Themes
  themes: DeckTheme[];

  // Quality upgrade
  hasQualityUpgrade: boolean;

  // UI state
  activePanel: 'setup' | 'chat' | 'analytics' | 'moderation' | 'alerts' | 'addons';
  isSidePanelOpen: boolean;

  // Installation tracking
  deckInstalled: boolean;
  installDismissedAt: number | null;

  // Actions
  setSession: (session: DeckSession | null) => void;
  validateSession: () => boolean;
  clearSession: () => void;

  setPhoneLink: (link: Partial<DeckPhoneLink>) => void;
  updateStreamConfig: (config: Partial<DeckStreamConfig>) => void;
  setStreamStats: (stats: Partial<DeckStreamStats>) => void;

  addChatMessage: (msg: DeckChatMessage) => void;
  clearChat: () => void;
  setChatInput: (input: string) => void;

  addAlert: (alert: DeckAlert) => void;
  markAlertRead: (id: string) => void;
  clearAlerts: () => void;

  setThemes: (themes: DeckTheme[]) => void;
  activateTheme: (themeId: string) => void;

  purchaseQualityUpgrade: (userId: string) => Promise<{ success: boolean; error?: string }>;
  setHasQualityUpgrade: (has: boolean) => void;

  setActivePanel: (panel: DeckState['activePanel']) => void;
  setSidePanelOpen: (open: boolean) => void;

  updateAddon: (addon: DeckAddon) => void;
  removeAddon: (id: string) => void;
  addAddon: (addon: DeckAddon) => void;
  reorderAddons: (addons: DeckAddon[]) => void;

  setDeckInstalled: (installed: boolean) => void;
  dismissInstallPrompt: () => void;
  shouldShowInstallPrompt: () => boolean;

  // Sync with phone broadcast page
  syncToPhone: () => void;
  syncFromPhone: (config: Partial<DeckStreamConfig>) => void;

  // Start/end broadcast from Deck
  triggerBroadcastStart: () => Promise<{ success: boolean; error?: string }>;
  triggerBroadcastEnd: () => Promise<{ success: boolean; error?: string }>;

  // Reset
  reset: () => void;
}

const DEFAULT_STREAM_CONFIG: DeckStreamConfig = {
  title: '',
  category: 'general',
  tags: [],
  quality: '720p',
  themeId: null,
  addons: [],
  isLive: false,
  streamId: null,
};

const DEFAULT_STREAM_STATS: DeckStreamStats = {
  viewerCount: 0,
  peakViewers: 0,
  duration: 0,
  chatMessages: 0,
  giftsReceived: 0,
  coinsEarned: 0,
  streamHealth: 'good',
  bitrate: 0,
  fps: 0,
  droppedFrames: 0,
};

const DECK_SYNC_CHANNEL = 'trollcity-deck-sync';

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      session: null,
      sessionStatus: 'none',
      phoneLink: {
        status: 'disconnected',
        phoneReady: false,
        lastSeen: null,
        streamId: null,
      },
      streamConfig: { ...DEFAULT_STREAM_CONFIG },
      streamStats: { ...DEFAULT_STREAM_STATS },
      chatMessages: [],
      chatInput: '',
      alerts: [],
      unreadAlertCount: 0,
      themes: [],
      hasQualityUpgrade: false,
      activePanel: 'setup',
      isSidePanelOpen: true,
      deckInstalled: false,
      installDismissedAt: null,

      setSession: (session) => {
        set({
          session,
          sessionStatus: session?.isValid ? 'active' : session ? 'expired' : 'none',
        });
      },

      validateSession: () => {
        const { session } = get();
        if (!session) return false;
        const now = Date.now();
        if (now > session.expiresAt) {
          set({ session: { ...session, isValid: false }, sessionStatus: 'expired' });
          return false;
        }
        return true;
      },

      clearSession: () => {
        set({ session: null, sessionStatus: 'none' });
      },

      setPhoneLink: (link) => {
        set((state) => ({
          phoneLink: { ...state.phoneLink, ...link },
        }));
      },

      updateStreamConfig: (config) => {
        set((state) => {
          const newConfig = { ...state.streamConfig, ...config };
          return { streamConfig: newConfig };
        });
      },

      setStreamStats: (stats) => {
        set((state) => ({
          streamStats: { ...state.streamStats, ...stats },
        }));
      },

      addChatMessage: (msg) => {
        set((state) => ({
          chatMessages: [...state.chatMessages.slice(-199), msg],
        }));
      },

      clearChat: () => set({ chatMessages: [] }),

      setChatInput: (input) => set({ chatInput: input }),

      addAlert: (alert) => {
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, 50),
          unreadAlertCount: state.unreadAlertCount + 1,
        }));
      },

      markAlertRead: (id) => {
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
          unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
        }));
      },

      clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

      setThemes: (themes) => set({ themes }),

      activateTheme: (themeId) => {
        set((state) => ({
          themes: state.themes.map((t) => ({
            ...t,
            active: t.id === themeId && t.owned,
          })),
          streamConfig: {
            ...state.streamConfig,
            themeId: state.themes.find((t) => t.id === themeId && t.owned) ? themeId : null,
          },
        }));
      },

      purchaseQualityUpgrade: async (userId) => {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('troll_coins')
            .eq('id', userId)
            .single();

          if (profileError || !profile) {
            return { success: false, error: 'Could not load your profile' };
          }

          if (profile.troll_coins < 200) {
            return {
              success: false,
              error: `Insufficient Troll Coins. You need 200 but have ${profile.troll_coins}.`,
            };
          }

          const { error: deductError } = await supabase.rpc('deduct_troll_coins', {
            p_user_id: userId,
            p_amount: 200,
          });

          if (deductError) {
            return { success: false, error: 'Failed to process purchase. Please try again.' };
          }

          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ deck_quality_upgrade: true })
            .eq('id', userId);

          if (updateError) {
            console.error('[Deck] Failed to save quality upgrade:', updateError);
          }

          set({
            hasQualityUpgrade: true,
            streamConfig: { ...get().streamConfig, quality: '1080p' },
          });

          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message || 'Purchase failed' };
        }
      },

      setHasQualityUpgrade: (has) => {
        set({ hasQualityUpgrade: has });
        if (!has) {
          set((state) => ({
            streamConfig: { ...state.streamConfig, quality: '720p' },
          }));
        }
      },

      setActivePanel: (panel) => set({ activePanel: panel }),
      setSidePanelOpen: (open) => set({ isSidePanelOpen: open }),

      updateAddon: (addon) => {
        set((state) => ({
          streamConfig: {
            ...state.streamConfig,
            addons: state.streamConfig.addons.map((a) => (a.id === addon.id ? addon : a)),
          },
        }));
      },

      removeAddon: (id) => {
        set((state) => ({
          streamConfig: {
            ...state.streamConfig,
            addons: state.streamConfig.addons.filter((a) => a.id !== id),
          },
        }));
      },

      addAddon: (addon) => {
        set((state) => ({
          streamConfig: {
            ...state.streamConfig,
            addons: [...state.streamConfig.addons, addon],
          },
        }));
      },

      reorderAddons: (addons) => {
        set((state) => ({
          streamConfig: { ...state.streamConfig, addons },
        }));
      },

      setDeckInstalled: (installed) => {
        set({ deckInstalled: installed });
        if (installed) {
          set({ installDismissedAt: null });
        }
      },

      dismissInstallPrompt: () => {
        set({ installDismissedAt: Date.now() });
      },

      shouldShowInstallPrompt: () => {
        const { deckInstalled, installDismissedAt } = get();
        if (deckInstalled) return false;
        if (!installDismissedAt) return true;
        const daysSinceDismissed = (Date.now() - installDismissedAt) / (1000 * 60 * 60 * 24);
        return daysSinceDismissed > 7;
      },

      syncToPhone: () => {
        const { streamConfig } = get();
        try {
          const channel = new BroadcastChannel(DECK_SYNC_CHANNEL);
          channel.postMessage({
            type: 'deck-sync',
            payload: streamConfig,
            timestamp: Date.now(),
          });
          channel.close();
        } catch {
          // BroadcastChannel not supported
        }

        try {
          localStorage.setItem('tc_deck_sync', JSON.stringify({
            config: streamConfig,
            timestamp: Date.now(),
          }));
        } catch {
          // localStorage unavailable
        }
      },

      syncFromPhone: (config) => {
        set((state) => ({
          streamConfig: { ...state.streamConfig, ...config },
        }));
      },

      triggerBroadcastStart: async () => {
        const { phoneLink, streamConfig } = get();
        if (!phoneLink.phoneReady) {
          return { success: false, error: 'Phone is not connected. Open the broadcast page on your phone first.' };
        }
        if (!streamConfig.title.trim()) {
          return { success: false, error: 'Please set a stream title before starting.' };
        }

        try {
          const channel = new BroadcastChannel(DECK_SYNC_CHANNEL);
          channel.postMessage({
            type: 'deck-start-broadcast',
            payload: streamConfig,
            timestamp: Date.now(),
          });
          channel.close();
          return { success: true };
        } catch {
          return { success: false, error: 'Failed to communicate with phone. Please try again.' };
        }
      },

      triggerBroadcastEnd: async () => {
        try {
          const channel = new BroadcastChannel(DECK_SYNC_CHANNEL);
          channel.postMessage({
            type: 'deck-end-broadcast',
            timestamp: Date.now(),
          });
          channel.close();

          set((state) => ({
            streamConfig: { ...state.streamConfig, isLive: false, streamId: null },
            phoneLink: { ...state.phoneLink, status: 'connected', streamId: null },
          }));

          return { success: true };
        } catch {
          return { success: false, error: 'Failed to end broadcast.' };
        }
      },

      reset: () => {
        set({
          session: null,
          sessionStatus: 'none',
          phoneLink: {
            status: 'disconnected',
            phoneReady: false,
            lastSeen: null,
            streamId: null,
          },
          streamConfig: { ...DEFAULT_STREAM_CONFIG },
          streamStats: { ...DEFAULT_STREAM_STATS },
          chatMessages: [],
          chatInput: '',
          alerts: [],
          unreadAlertCount: 0,
          activePanel: 'setup',
        });
      },
    }),
    {
      name: 'trollcity-deck-store',
      partialize: (state) => ({
        session: state.session,
        sessionStatus: state.sessionStatus,
        hasQualityUpgrade: state.hasQualityUpgrade,
        deckInstalled: state.deckInstalled,
        installDismissedAt: state.installDismissedAt,
        streamConfig: {
          quality: state.streamConfig.quality,
          themeId: state.streamConfig.themeId,
        },
      }),
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<DeckState>) };
        if (persistedState && typeof persistedState === 'object' && 'streamConfig' in persistedState) {
          const persistedConfig = (persistedState as any).streamConfig ?? {};
          merged.streamConfig = {
            ...DEFAULT_STREAM_CONFIG,
            ...persistedConfig,
            tags: Array.isArray(persistedConfig.tags) ? persistedConfig.tags : DEFAULT_STREAM_CONFIG.tags,
            addons: Array.isArray(persistedConfig.addons) ? persistedConfig.addons : DEFAULT_STREAM_CONFIG.addons,
          };
        }
        return merged;
      },
    }
  )
);
