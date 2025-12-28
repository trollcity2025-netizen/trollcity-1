import { create } from 'zustand'

interface LiveContextState {
  activeStreamId: string | null
  setActiveStreamId: (id: string | null) => void
}

export const useLiveContextStore = create<LiveContextState>((set) => ({
  activeStreamId: null,
  setActiveStreamId: (id) => set({ activeStreamId: id }),
}))