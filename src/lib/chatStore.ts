import { create } from 'zustand'

interface ChatBubbleState {
  isOpen: boolean
  isMinimized: boolean
  activeUserId: string | null
  activeUsername: string | null
  activeUserAvatar: string | null
  openChatBubble: (userId: string, username: string, avatarUrl: string | null) => void
  closeChatBubble: () => void
  toggleChatBubble: () => void
  minimizeChatBubble: () => void
  restoreChatBubble: () => void
  toggleMinimize: () => void
}

export const useChatStore = create<ChatBubbleState>((set) => ({
  isOpen: false,
  isMinimized: false,
  activeUserId: null,
  activeUsername: null,
  activeUserAvatar: null,
  openChatBubble: (userId, username, avatarUrl) => set({
    isOpen: true,
    isMinimized: false,
    activeUserId: userId,
    activeUsername: username,
    activeUserAvatar: avatarUrl
  }),
  closeChatBubble: () => set({ isOpen: false, isMinimized: false }),
  toggleChatBubble: () => set((state) => ({ isOpen: !state.isOpen })),
  minimizeChatBubble: () => set({ isMinimized: true }),
  restoreChatBubble: () => set({ isMinimized: false }),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized }))
}))
