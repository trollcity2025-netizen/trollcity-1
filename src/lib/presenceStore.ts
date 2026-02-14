import { create } from 'zustand';

interface PresenceState {
  onlineCount: number;
  // Store room viewer counts as a map to avoid large array replacements
  roomViewerCounts: Record<string, number>;
  
  setOnlineCount: (count: number) => void;
  setRoomViewerCount: (roomId: string, count: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineCount: 0,
  roomViewerCounts: {},
  
  setOnlineCount: (count) => set({ onlineCount: count }),
  
  setRoomViewerCount: (roomId, count) => set((state) => {
    // Only update if the count actually changed to avoid unnecessary re-renders
    if (state.roomViewerCounts[roomId] === count) return state;
    
    return {
      roomViewerCounts: {
        ...state.roomViewerCounts,
        [roomId]: count
      }
    };
  }),
}));
