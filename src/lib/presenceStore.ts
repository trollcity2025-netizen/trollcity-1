import { create } from 'zustand';

export interface PresenceUser {
  user_id: string;
  username: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'offline';
  last_active: string;
}

interface PresenceState {
  onlineCount: number;
  presenceUsers: PresenceUser[];
  roomViewerCounts: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  setOnlineCount: (count: number) => void;
  setPresenceUsers: (users: PresenceUser[]) => void;
  setRoomViewerCount: (roomId: string, count: number) => void;
  addPresenceUser: (user: PresenceUser) => void;
  removePresenceUser: (userId: string) => void;
  updatePresenceUser: (userId: string, user: Partial<PresenceUser>) => void;
  refreshPresence: () => Promise<void>;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineCount: 0,
  presenceUsers: [],
  roomViewerCounts: {},
  isLoading: false,
  error: null,

  setOnlineCount: (count: number) => set({ onlineCount: count }),

  setPresenceUsers: (users: PresenceUser[]) => set({ presenceUsers: users }),

  setRoomViewerCount: (roomId: string, count: number) => 
    set({ roomViewerCounts: { ...get().roomViewerCounts, [roomId]: count } }),

  addPresenceUser: (user: PresenceUser) => {
    const { presenceUsers } = get();
    const exists = presenceUsers.some(u => u.user_id === user.user_id);
    if (!exists) {
      set({ presenceUsers: [...presenceUsers, user] });
    }
  },

  removePresenceUser: (userId: string) => {
    const { presenceUsers } = get();
    set({ presenceUsers: presenceUsers.filter(u => u.user_id !== userId) });
  },

  updatePresenceUser: (userId: string, userUpdates: Partial<PresenceUser>) => {
    const { presenceUsers } = get();
    set({
      presenceUsers: presenceUsers.map(u =>
        u.user_id === userId ? { ...u, ...userUpdates } : u
      ),
    });
  },

  refreshPresence: async () => {
    set({ isLoading: true, error: null });
    try {
      // You can implement actual presence tracking here
      // For now, just set a baseline
      set({ onlineCount: get().presenceUsers.length });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to refresh presence');
      set({ error: err });
      console.error('presenceRefresh', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
