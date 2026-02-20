import { create } from 'zustand';
import { GiftMessageType } from '../components/broadcast/BroadcastChat';

interface UIState {
  lastGift: GiftMessageType | null;
  setLastGift: (gift: GiftMessageType | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  lastGift: null,
  setLastGift: (gift) => set({ lastGift: gift }),
}));
