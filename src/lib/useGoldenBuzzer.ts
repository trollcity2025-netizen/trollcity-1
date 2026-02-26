import { create } from 'zustand';

interface GoldenBuzzerState {
  active: boolean;
  trigger: () => void;
}

export const useGoldenBuzzer = create<GoldenBuzzerState>((set) => ({
  active: false,
  trigger: () => {
    set({ active: true });
    setTimeout(() => {
      set({ active: false });
    }, 3500);
  },
}));
