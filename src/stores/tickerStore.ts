import { create } from 'zustand';
import {
  TickerMessage,
  TickerSettings,
  TickerCategory,
  TickerMode,
  TickerPosition,
  TickerSpeed,
  TickerTheme,
  DEFAULT_TICKER_SETTINGS,
} from '../types/ticker';

interface TickerState {
  messages: TickerMessage[];
  settings: TickerSettings;
  priorityMessage: TickerMessage | null;
  isPaused: boolean;
  isControlPanelOpen: boolean;
  isSettingsOpen: boolean;

  // Actions
  addMessage: (msg: TickerMessage) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setPriorityMessage: (msg: TickerMessage | null) => void;
  setPaused: (paused: boolean) => void;
  setSettings: (settings: Partial<TickerSettings>) => void;
  toggleControlPanel: () => void;
  toggleSettings: () => void;
  setControlPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  resetSettings: (streamId: string) => void;
}

export const useTickerStore = create<TickerState>((set, get) => ({
  messages: [],
  settings: { ...DEFAULT_TICKER_SETTINGS, stream_id: '' },
  priorityMessage: null,
  isPaused: false,
  isControlPanelOpen: false,
  isSettingsOpen: false,

  addMessage: (msg) =>
    set((state) => {
      const max = state.settings.max_messages;
      const updated = [msg, ...state.messages];
      return { messages: updated.slice(0, max) };
    }),

  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  clearMessages: () => set({ messages: [] }),

  setPriorityMessage: (msg) =>
    set((state) => {
      if (msg) {
        return { priorityMessage: msg, isPaused: true };
      }
      return { priorityMessage: null, isPaused: false };
    }),

  setPaused: (paused) => set({ isPaused: paused }),

  setSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  toggleControlPanel: () =>
    set((state) => ({ isControlPanelOpen: !state.isControlPanelOpen })),

  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  setControlPanelOpen: (open) => set({ isControlPanelOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  resetSettings: (streamId) =>
    set({
      settings: { ...DEFAULT_TICKER_SETTINGS, stream_id: streamId },
    }),
}));
