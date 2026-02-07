import { create } from 'zustand';

interface PresenceState {
  onlineCount: number;
  setOnlineCount: (count: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineCount: 0,
  setOnlineCount: (count) => set({ onlineCount: count }),
}));
