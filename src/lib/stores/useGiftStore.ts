import { create } from 'zustand';
import { GiftInstance, GiftCatalogItem, AnimationType, GiftRarity } from '@/types/gifts';

interface GiftState {
  // Active gift animations currently playing
  activeGifts: GiftInstance[];
  
  // Gift catalog cache
  giftCatalog: GiftCatalogItem[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  triggerGift: (giftData: Omit<GiftInstance, 'id' | 'startTime'>) => void;
  removeGift: (giftId: string) => void;
  clearExpiredGifts: () => void;
  setGiftCatalog: (catalog: GiftCatalogItem[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// Generate unique ID for gift instances
const generateGiftId = () => `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Maximum simultaneous gifts to prevent performance issues
const MAX_SIMULTANEOUS_GIFTS = 5;

export const useGiftStore = create<GiftState>((set, get) => ({
  // Initial state
  activeGifts: [],
  giftCatalog: [],
  isLoading: false,
  error: null,
  
  // Trigger a new gift animation
  triggerGift: (giftData) => {
    const { activeGifts } = get();
    
    // Limit simultaneous gifts for performance
    if (activeGifts.length >= MAX_SIMULTANEOUS_GIFTS) {
      console.warn('Maximum simultaneous gifts reached, removing oldest');
      // Remove oldest gift
      set((state) => ({
        activeGifts: state.activeGifts.slice(1),
      }));
    }
    
    const newGift: GiftInstance = {
      ...giftData,
      id: generateGiftId(),
      startTime: Date.now(),
    };
    
    set((state) => ({
      activeGifts: [...state.activeGifts, newGift],
    }));
    
    // Auto-remove after duration
    setTimeout(() => {
      get().removeGift(newGift.id);
    }, giftData.duration + 500); // Add buffer for animation completion
    
    console.log('Gift triggered:', newGift.name);
  },
  
  // Remove a specific gift
  removeGift: (giftId: string) => {
    set((state) => ({
      activeGifts: state.activeGifts.filter((gift) => gift.id !== giftId),
    }));
  },
  
  // Clear all expired gifts (those past their duration)
  clearExpiredGifts: () => {
    const now = Date.now();
    set((state) => ({
      activeGifts: state.activeGifts.filter((gift) => {
        const age = now - gift.startTime;
        return age < gift.duration + 500; // Keep with buffer
      }),
    }));
  },
  
  // Set gift catalog
  setGiftCatalog: (catalog: GiftCatalogItem[]) => {
    set({ giftCatalog: catalog });
  },
  
  // Set error
  setError: (error: string | null) => {
    set({ error });
  },
  
  // Set loading
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));

// Helper hook to get gift by ID
export const useGiftById = (giftId: string): GiftCatalogItem | undefined => {
  const catalog = useGiftStore((state) => state.giftCatalog);
  return catalog.find((gift) => gift.id === giftId);
};

// Helper hook to get gifts by rarity
export const useGiftsByRarity = (rarity: GiftRarity): GiftCatalogItem[] => {
  const catalog = useGiftStore((state) => state.giftCatalog);
  return catalog.filter((gift) => gift.rarity === rarity);
};
