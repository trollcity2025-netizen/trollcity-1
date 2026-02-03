import { create } from 'zustand';

interface TimeStore {
  now: Date;
  updateNow: () => void;
}

export const useTimeStore = create<TimeStore>((set) => ({
  now: new Date(),
  updateNow: () => set({ now: new Date() }),
}));

/**
 * Initialize the global time updater.
 * Should be called once in the root App component.
 * Updates the 'now' state every hour to ensure day-based calculations (like account age) stay fresh.
 */
export const initTimeUpdater = () => {
  // Update immediately
  useTimeStore.getState().updateNow();

  // Schedule updates every hour
  const interval = setInterval(() => {
    useTimeStore.getState().updateNow();
  }, 1000 * 60 * 60); // 1 hour

  return () => clearInterval(interval);
};
