import { create } from 'zustand';

// Animation Types
export type GiftType = 'rose' | 'heart' | 'diamond' | 'crown' | 'car' | 'house' | 'rocket' | 'dragon';
export type ReactionType = 'heart' | 'fire' | 'laugh' | 'wow' | 'cry' | 'clap' | 'love' | 'fire';

export interface GiftAnimationData {
  id: string;
  type: GiftType;
  senderName: string;
  senderAvatar?: string;
  receiverName: string;
  amount: number;
  timestamp: number;
}

export interface JoinEffectData {
  id: string;
  username: string;
  avatar?: string;
  isModerator?: boolean;
  isVip?: boolean;
  isGold?: boolean;
  timestamp: number;
}

export interface ReactionData {
  id: string;
  type: ReactionType;
  username: string;
  timestamp: number;
}

export interface CoinExplosionData {
  id: string;
  amount: number;
  position?: { x: number; y: number };
  timestamp: number;
}

export interface DiamondRainData {
  id: string;
  amount: number;
  timestamp: number;
}

// Animation Manager Store
interface AnimationState {
  // Active animations queue
  giftAnimations: GiftAnimationData[];
  joinEffects: JoinEffectData[];
  reactions: ReactionData[];
  coinExplosions: CoinExplosionData[];
  diamondRains: DiamondRainData[];
  
  // Performance settings
  isMobile: boolean;
  reducedMotion: boolean;
  particleDensity: 'low' | 'medium' | 'high';
  isStreamActive: boolean;
  
  // Actions
  playGiftAnimation: (gift: Omit<GiftAnimationData, 'id' | 'timestamp'>) => void;
  playJoinEffect: (effect: Omit<JoinEffectData, 'id' | 'timestamp'>) => void;
  playReaction: (reaction: Omit<ReactionData, 'id' | 'timestamp'>) => void;
  playCoinExplosion: (explosion: Omit<CoinExplosionData, 'id' | 'timestamp'>) => void;
  playDiamondRain: (rain: Omit<DiamondRainData, 'id' | 'timestamp'>) => void;
  
  removeGiftAnimation: (id: string) => void;
  removeJoinEffect: (id: string) => void;
  removeReaction: (id: string) => void;
  removeCoinExplosion: (id: string) => void;
  removeDiamondRain: (id: string) => void;
  
  setIsMobile: (isMobile: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setParticleDensity: (density: 'low' | 'medium' | 'high') => void;
  setIsStreamActive: (active: boolean) => void;
  
  clearAllAnimations: () => void;
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Animation duration constants (in ms)
export const ANIMATION_DURATION = {
  GIFT: 5000,
  JOIN: 4000,
  REACTION: 3000,
  COIN_EXPLOSION: 4000,
  DIAMOND_RAIN: 6000,
} as const;

export const useAnimationStore = create<AnimationState>((set, get) => ({
  // Initial state
  giftAnimations: [],
  joinEffects: [],
  reactions: [],
  coinExplosions: [],
  diamondRains: [],
  
  isMobile: false,
  reducedMotion: false,
  particleDensity: 'medium',
  isStreamActive: false,
  
  // Gift animation - triggers a gift animation with auto-cleanup
  playGiftAnimation: (gift) => {
    const id = generateId();
    const timestamp = Date.now();
    
    set((state) => ({
      giftAnimations: [...state.giftAnimations, { ...gift, id, timestamp }]
    }));
    
    // Auto-remove after animation duration
    setTimeout(() => {
      get().removeGiftAnimation(id);
    }, ANIMATION_DURATION.GIFT);
  },
  
  // Join effect - shows user joining the stream
  playJoinEffect: (effect) => {
    const id = generateId();
    const timestamp = Date.now();
    
    set((state) => ({
      joinEffects: [...state.joinEffects, { ...effect, id, timestamp }]
    }));
    
    // Auto-remove after animation duration
    setTimeout(() => {
      get().removeJoinEffect(id);
    }, ANIMATION_DURATION.JOIN);
  },
  
  // Reaction - floating reaction across screen
  playReaction: (reaction) => {
    const id = generateId();
    const timestamp = Date.now();
    
    set((state) => ({
      reactions: [...state.reactions, { ...reaction, id, timestamp }]
    }));
    
    // Auto-remove after animation duration
    setTimeout(() => {
      get().removeReaction(id);
    }, ANIMATION_DURATION.REACTION);
  },
  
  // Coin explosion - particle effect with coins
  playCoinExplosion: (explosion) => {
    const id = generateId();
    const timestamp = Date.now();
    
    set((state) => ({
      coinExplosions: [...state.coinExplosions, { ...explosion, id, timestamp }]
    }));
    
    // Auto-remove after animation duration
    setTimeout(() => {
      get().removeCoinExplosion(id);
    }, ANIMATION_DURATION.COIN_EXPLOSION);
  },
  
  // Diamond rain - particle effect with diamonds
  playDiamondRain: (rain) => {
    const id = generateId();
    const timestamp = Date.now();
    
    set((state) => ({
      diamondRains: [...state.diamondRains, { ...rain, id, timestamp }]
    }));
    
    // Auto-remove after animation duration
    setTimeout(() => {
      get().removeDiamondRain(id);
    }, ANIMATION_DURATION.DIAMOND_RAIN);
  },
  
  // Remove individual animations
  removeGiftAnimation: (id) => set((state) => ({
    giftAnimations: state.giftAnimations.filter(g => g.id !== id)
  })),
  
  removeJoinEffect: (id) => set((state) => ({
    joinEffects: state.joinEffects.filter(j => j.id !== id)
  })),
  
  removeReaction: (id) => set((state) => ({
    reactions: state.reactions.filter(r => r.id !== id)
  })),
  
  removeCoinExplosion: (id) => set((state) => ({
    coinExplosions: state.coinExplosions.filter(c => c.id !== id)
  })),
  
  removeDiamondRain: (id) => set((state) => ({
    diamondRains: state.diamondRains.filter(d => d.id !== id)
  })),
  
  // Settings
  setIsMobile: (isMobile) => set({ 
    isMobile,
    particleDensity: isMobile ? 'low' : 'medium'
  }),
  
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  
  setParticleDensity: (particleDensity) => set({ particleDensity }),
  
  setIsStreamActive: (isStreamActive) => set({ isStreamActive }),
  
  clearAllAnimations: () => set({
    giftAnimations: [],
    joinEffects: [],
    reactions: [],
    coinExplosions: [],
    diamondRains: []
  })
}));

// Helper hook to detect mobile and reduced motion preferences
export const useAnimationSettings = () => {
  const { 
    isMobile, 
    reducedMotion, 
    particleDensity, 
    isStreamActive,
    setIsMobile,
    setReducedMotion,
    setParticleDensity,
    setIsStreamActive
  } = useAnimationStore();
  
  // Initialize on mount
  if (typeof window !== 'undefined') {
    // Check for mobile
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (mobile !== isMobile) {
      setIsMobile(mobile);
    }
    
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches !== reducedMotion) {
      setReducedMotion(motionQuery.matches);
    }
    
    // Listen for changes
    motionQuery.addEventListener('change', (e) => {
      setReducedMotion(e.matches);
    });
  }
  
  return {
    isMobile,
    reducedMotion,
    particleDensity,
    isStreamActive,
    setIsMobile,
    setReducedMotion,
    setParticleDensity,
    setIsStreamActive
  };
};

export default useAnimationStore;
