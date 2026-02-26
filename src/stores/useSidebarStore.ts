import { create } from 'zustand';

type SidebarState = {
  expandedGroups: string[];
  toggleGroup: (group: string) => void;
  expandGroup: (group: string) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedGroups: [],
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
}));
