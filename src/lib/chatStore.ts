import { create } from 'zustand';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface ChatBubble {
  user_id: string;
  username: string;
  avatar_url: string | null;
  messages: ChatMessage[];
  isOpen: boolean;
}

interface ChatState {
  bubbles: Map<string, ChatBubble>;
  unreadCount: Record<string, number>;
  activeConversation: string | null;
  
  openChatBubble: (userId: string, username: string, avatarUrl: string | null) => void;
  closeChatBubble: (userId: string) => void;
  setActiveConversation: (userId: string | null) => void;
  addMessage: (userId: string, message: ChatMessage) => void;
  setMessages: (userId: string, messages: ChatMessage[]) => void;
  markAsRead: (userId: string) => void;
  setUnreadCount: (userId: string, count: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  bubbles: new Map(),
  unreadCount: {},
  activeConversation: null,

  openChatBubble: (userId: string, username: string, avatarUrl: string | null) => {
    set((state) => {
      const bubbles = new Map(state.bubbles);
      bubbles.set(userId, {
        user_id: userId,
        username,
        avatar_url: avatarUrl,
        messages: bubbles.get(userId)?.messages || [],
        isOpen: true,
      });
      return { bubbles };
    });
  },

  closeChatBubble: (userId: string) => {
    set((state) => {
      const bubbles = new Map(state.bubbles);
      const bubble = bubbles.get(userId);
      if (bubble) {
        bubble.isOpen = false;
      }
      return { bubbles };
    });
  },

  setActiveConversation: (userId: string | null) => {
    set({ activeConversation: userId });
  },

  addMessage: (userId: string, message: ChatMessage) => {
    set((state) => {
      const bubbles = new Map(state.bubbles);
      const bubble = bubbles.get(userId);
      if (bubble) {
        bubble.messages = [...bubble.messages, message];
      }
      return { bubbles };
    });
  },

  setMessages: (userId: string, messages: ChatMessage[]) => {
    set((state) => {
      const bubbles = new Map(state.bubbles);
      const bubble = bubbles.get(userId);
      if (bubble) {
        bubble.messages = messages;
      }
      return { bubbles };
    });
  },

  markAsRead: (userId: string) => {
    set((state) => {
      const bubbles = new Map(state.bubbles);
      const bubble = bubbles.get(userId);
      if (bubble) {
        bubble.messages = bubble.messages.map(msg => ({ ...msg, read: true }));
      }
      return {
        bubbles,
        unreadCount: { ...state.unreadCount, [userId]: 0 },
      };
    });
  },

  setUnreadCount: (userId: string, count: number) => {
    set((state) => ({
      unreadCount: { ...state.unreadCount, [userId]: count },
    }));
  },
}));
