import { create } from 'zustand';

interface PodStatusState {
  lastPodUpdate: number;
  triggerPodUpdate: () => void;
}

export const usePodStatusStore = create<PodStatusState>((set) => ({
  lastPodUpdate: Date.now(),
  triggerPodUpdate: () => set({ lastPodUpdate: Date.now() }),
}));