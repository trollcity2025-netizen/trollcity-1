import { create } from 'zustand';

interface PresenceState {
  onlineCount: number;
  onlineUserIds: string[];
  // Store room viewer counts as a map to avoid large array replacements
  roomViewerCounts: Record<string, number>;
  
  setOnlineCount: (count: number) => void;
  setOnlineUserIds: (userIds: string[]) => void;
  setRoomViewerCount: (roomId: string, count: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineCount: 0,
  onlineUserIds: [],
  roomViewerCounts: {},
  
  setOnlineCount: (count) => set({ onlineCount: count }),
  
  setOnlineUserIds: (userIds) => set({ onlineUserIds: userIds }),
  
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
