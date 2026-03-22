import { create } from 'zustand';

type SidebarState = {
  expandedGroups: string[];
  isCollapsed: boolean;
  toggleGroup: (group: string) => void;
  expandGroup: (group: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedGroups: [],
  isCollapsed: false,
  toggleGroup: (group) =>
    set((state) => ({
      expandedGroups: state.expandedGroups.includes(group)
        ? state.expandedGroups.filter((g) => g !== group)
        : [...state.expandedGroups, group],
    })),
  expandGroup: (group) =>
    set((state) => {
      if (state.expandedGroups.includes(group)) {
        return state;
      }
      return { expandedGroups: [...state.expandedGroups, group] };
    }),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
