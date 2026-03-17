// 🎁 Gift Engine - Next-generation gifting system with AR face-tracking and high-performance animations
// This module provides the core infrastructure for the enhanced gift broadcasting system

import { create } from 'zustand';
import { generateUUID } from './uuid';

// ============================================================================
// 1. GIFT TYPE DEFINITIONS
// ============================================================================

export type GiftCategory = 'face' | 'grand' | 'standard';

export interface GiftEffect {
  id: string;
  name: string;
  // AR effect file path (for face-tracking gifts)
  effectFile?: string;
  // Animation file path (Lottie JSON or SVGA)
  animationFile?: string;
  // Preview icon
  icon: string;
  // Duration in ms
  duration: number;
}

export interface GiftEvent {
  id: string;
  gift_id: string;
  type: GiftCategory;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  combo_count: number;
  timestamp: number;
  // For face effects
  effect?: GiftEffect;
}

export interface GiftQueueItem {
  id: string;
  event: GiftEvent;
  priority: number; // Higher = more important
  startTime?: number;
  status: 'queued' | 'playing' | 'completed';
}

// ============================================================================
// 2. GIFT EVENT STREAM - WebSocket listener setup
// ============================================================================

type GiftEventCallback = (event: GiftEvent) => void;

class GiftEventStream {
  private listeners: Set<GiftEventCallback> = new Set();
  private channel: any = null;
  private supabase: any = null;
  private streamId: string | null = null;

  // Initialize with Supabase channel
  initialize(supabaseClient: any, streamId: string) {
    this.supabase = supabaseClient;
    this.streamId = streamId;
    
    // Create channel for gift events
    this.channel = this.supabase.channel(`gifts:${streamId}`);
    
    this.channel.on(
      'broadcast',
      { event: 'gift_event' },
      (payload: any) => {
        const event = payload.payload as GiftEvent;
        this.notifyListeners(event);
      }
    );
    
    this.channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[GiftEventStream] Subscribed to gift events');
      }
    });
  }

  // Subscribe to gift events
  subscribe(callback: GiftEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  private notifyListeners(event: GiftEvent) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('[GiftEventStream] Error in listener:', err);
      }
    });
  }

  // Cleanup
  disconnect() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const giftEventStream = new GiftEventStream();

// ============================================================================
// 3. GIFT PROCESSING ENGINE
// ============================================================================

// Map gift IDs to AR effects
export const giftEffectsMap: Record<string, GiftEffect> = {
  // Face-tracking effects (hats, glasses, makeup)
  'gift_hat': {
    id: 'gift_hat',
    name: 'Fancy Hat',
    effectFile: 'effects/hat.glb',
    animationFile: 'animations/hat.json',
    icon: '🎩',
    duration: 10000,
  },
  'gift_glasses': {
    id: 'gift_glasses',
    name: 'Cool Glasses',
    effectFile: 'effects/glasses.glb',
    animationFile: 'animations/glasses.json',
    icon: '🕶️',
    duration: 10000,
  },
  'gift_crown': {
    id: 'gift_crown',
    name: 'Royal Crown',
    effectFile: 'effects/crown.glb',
    animationFile: 'animations/crown.json',
    icon: '👑',
    duration: 15000,
  },
  'gift_makeup': {
    id: 'gift_makeup',
    name: 'Glam Makeup',
    effectFile: 'effects/makeup',
    animationFile: 'animations/makeup.json',
    icon: '💄',
    duration: 8000,
  },
  'gift_rainbow': {
    id: 'gift_rainbow',
    name: 'Rainbow Pride',
    effectFile: 'effects/rainbow',
    animationFile: 'animations/rainbow.json',
    icon: '🌈',
    duration: 12000,
  },
  'gift_fire': {
    id: 'gift_fire',
    name: 'Fire Aura',
    effectFile: 'effects/fire',
    animationFile: 'animations/fire.json',
    icon: '🔥',
    duration: 10000,
  },
  'gift_angel': {
    id: 'gift_angel',
    name: 'Angel Wings',
    effectFile: 'effects/angel',
    animationFile: 'animations/angel.json',
    icon: '😇',
    duration: 15000,
  },
  'gift_devil': {
    id: 'gift_devil',
    name: 'Devil Horns',
    effectFile: 'effects/devil',
    animationFile: 'animations/devil.json',
    icon: '😈',
    duration: 10000,
  },
  // Grand animations (full-screen premium)
  'gift_rocket': {
    id: 'gift_rocket',
    name: 'Rocket Launch',
    animationFile: 'animations/rocket.json',
    icon: '🚀',
    duration: 5000,
  },
  'gift_dragon': {
    id: 'gift_dragon',
    name: 'Dragon Flight',
    animationFile: 'animations/dragon.json',
    icon: '🐉',
    duration: 6000,
  },
  'gift_rain': {
    id: 'gift_rain',
    name: 'Diamond Rain',
    animationFile: 'animations/diamond_rain.json',
    icon: '💎',
    duration: 8000,
  },
  'gift_car': {
    id: 'gift_car',
    name: 'Luxury Car',
    animationFile: 'animations/car.json',
    icon: '🏎️',
    duration: 5000,
  },
  'gift_house': {
    id: 'gift_house',
    name: 'Mansion',
    animationFile: 'animations/house.json',
    icon: '🏠',
    duration: 7000,
  },
  'gift_yacht': {
    id: 'gift_yacht',
    name: 'Yacht',
    animationFile: 'animations/yacht.json',
    icon: '🛥️',
    duration: 6000,
  },
};

// Determine gift category based on gift ID
export function getGiftCategory(giftId: string): GiftCategory {
  const faceGifts = ['gift_hat', 'gift_glasses', 'gift_crown', 'gift_makeup', 'gift_rainbow', 'gift_fire', 'gift_angel', 'gift_devil'];
  const grandGifts = ['gift_rocket', 'gift_dragon', 'gift_rain', 'gift_car', 'gift_house', 'gift_yacht'];
  
  if (faceGifts.includes(giftId)) return 'face';
  if (grandGifts.includes(giftId)) return 'grand';
  return 'standard';
}

// Get effect for a gift
export function getGiftEffect(giftId: string): GiftEffect | undefined {
  return giftEffectsMap[giftId];
}

// ============================================================================
// 4. GIFT QUEUE SYSTEM - Prevents crashes and overlap
// ============================================================================

interface GiftEngineState {
  // Queue management
  giftQueue: GiftQueueItem[];
  isProcessing: boolean;
  currentGift: GiftQueueItem | null;
  
  // Combo tracking
  comboCount: number;
  comboGiftId: string | null;
  comboTimer: ReturnType<typeof setTimeout> | null;
  
  // Leaderboard data
  topGifters: Array<{ userId: string; username: string; totalGifts: number }>;
  
  // Gift history (last 50)
  giftHistory: GiftEvent[];
  
  // Actions
  enqueueGift: (event: GiftEvent) => void;
  processQueue: () => Promise<void>;
  completeGift: (id: string) => void;
  updateCombo: (giftId: string) => void;
  resetCombo: () => void;
  addGifter: (userId: string, username: string, amount: number) => void;
  getNextGift: () => GiftQueueItem | null;
}

export const useGiftEngine = create<GiftEngineState>((set, get) => ({
  giftQueue: [],
  isProcessing: false,
  currentGift: null,
  comboCount: 0,
  comboGiftId: null,
  comboTimer: null,
  topGifters: [],
  giftHistory: [],

  // Enqueue a gift for processing
  enqueueGift: (event: GiftEvent) => {
    const state = get();
    
    // Determine priority based on gift type
    let priority = 1;
    if (event.type === 'grand') priority = 3;
    else if (event.type === 'face') priority = 2;
    
    const item: GiftQueueItem = {
      id: generateUUID(),
      event,
      priority,
      status: 'queued',
    };
    
    // Add to queue (sorted by priority)
    const newQueue = [...state.giftQueue, item].sort((a, b) => b.priority - a.priority);
    
    // Keep history (last 50)
    const newHistory = [event, ...state.giftHistory].slice(0, 50);
    
    set({ 
      giftQueue: newQueue,
      giftHistory: newHistory,
    });
    
    // Update combo if same gift
    if (event.gift_id === state.comboGiftId) {
      get().updateCombo(event.gift_id);
    } else {
      get().resetCombo();
      get().updateCombo(event.gift_id);
    }
    
    // Add to leaderboard
    get().addGifter(event.sender_id, event.sender_name, event.combo_count);
    
    // Start processing if not already
    if (!state.isProcessing) {
      get().processQueue();
    }
  },

  // Get next gift from queue
  getNextGift: () => {
    const state = get();
    if (state.giftQueue.length === 0) return null;
    return state.giftQueue[0];
  },

  // Process the queue
  processQueue: async () => {
    const state = get();
    
    if (state.isProcessing || state.giftQueue.length === 0) {
      set({ isProcessing: false });
      return;
    }
    
    set({ isProcessing: true });
    
    const currentItem = state.giftQueue[0];
    const effect = getGiftEffect(currentItem.event.gift_id);
    
    // Update status to playing
    set({
      currentGift: {
        ...currentItem,
        status: 'playing',
        startTime: Date.now(),
        event: { ...currentItem.event, effect },
      },
    });
    
    // Wait for animation to complete
    const duration = effect?.duration || 4000;
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Complete the gift
    get().completeGift(currentItem.id);
  },

  // Mark gift as completed and remove from queue
  completeGift: (id: string) => {
    set(state => ({
      giftQueue: state.giftQueue.filter(item => item.id !== id),
      currentGift: null,
      isProcessing: false,
    }));
    
    // Process next in queue
    get().processQueue();
  },

  // Update combo count
  updateCombo: (giftId: string) => {
    const state = get();
    
    // Clear existing timer
    if (state.comboTimer) {
      clearTimeout(state.comboTimer);
    }
    
    // Set new combo (max 99)
    const newCombo = giftId === state.comboGiftId 
      ? Math.min(99, state.comboCount + 1) 
      : 1;
    
    // Auto-reset combo after 3 seconds of no gifts
    const timer = setTimeout(() => {
      get().resetCombo();
    }, 3000);
    
    set({
      comboCount: newCombo,
      comboGiftId: giftId,
      comboTimer: timer,
    });
  },

  // Reset combo
  resetCombo: () => {
    const state = get();
    if (state.comboTimer) {
      clearTimeout(state.comboTimer);
    }
    set({
      comboCount: 0,
      comboGiftId: null,
      comboTimer: null,
    });
  },

  // Add/update gifter in leaderboard
  addGifter: (userId: string, username: string, amount: number) => {
    set(state => {
      const existing = state.topGifters.find(g => g.userId === userId);
      if (existing) {
        return {
          topGifters: state.topGifters
            .map(g => g.userId === userId ? { ...g, totalGifts: g.totalGifts + amount } : g)
            .sort((a, b) => b.totalGifts - a.totalGifts)
            .slice(0, 10), // Keep top 10
        };
      }
      return {
        topGifters: [...state.topGifters, { userId, username, totalGifts: amount }]
          .sort((a, b) => b.totalGifts - a.totalGifts)
          .slice(0, 10),
      };
    });
  },
}));

// ============================================================================
// 5. AR FACE-TRACKING SYSTEM (Placeholder for SDK integration)
// ============================================================================

// AR Engine class - integrates with Banuba, DeepAR, or similar
export class AREngine {
  private licenseKey: string;
  private isInitialized: boolean = false;
  private currentEffect: string | null = null;

  constructor(options: { licenseKey: string; tracking?: '2D' | '6DoF' }) {
    this.licenseKey = options.licenseKey;
  }

  // Initialize the AR engine
  async initialize(): Promise<boolean> {
    try {
      // Placeholder for actual AR SDK initialization
      // In production, this would initialize Banuba or DeepAR
      console.log('[AREngine] Initializing AR engine...');
      
      // Simulate async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.isInitialized = true;
      console.log('[AREngine] AR engine initialized successfully');
      return true;
    } catch (error) {
      console.error('[AREngine] Failed to initialize:', error);
      return false;
    }
  }

  // Apply an AR effect to the video stream
  async applyEffect(effectId: string): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('[AREngine] Engine not initialized');
      return false;
    }

    try {
      console.log('[AREngine] Applying effect:', effectId);
      this.currentEffect = effectId;
      // In production: this would call the AR SDK to apply the effect
      return true;
    } catch (error) {
      console.error('[AREngine] Failed to apply effect:', error);
      return false;
    }
  }

  // Clear the current effect
  async clearEffect(): Promise<void> {
    if (!this.isInitialized) return;
    
    console.log('[AREngine] Clearing effect');
    this.currentEffect = null;
    // In production: this would call the AR SDK to remove effects
  }

  // Check if an effect is currently active
  hasActiveEffect(): boolean {
    return this.currentEffect !== null;
  }

  // Get current effect ID
  getCurrentEffect(): string | null {
    return this.currentEffect;
  }
}

// Create singleton AR engine instance
export const arEngine = new AREngine({
  licenseKey: import.meta.env.VITE_AR_LICENSE_KEY || '',
  tracking: '6DoF',
});

// ============================================================================
// 6. PERFORMANCE OPTIMIZATION UTILITIES
// ============================================================================

// GPU layer helper for hardware acceleration
export function enableGPUTlayer(element: HTMLElement): void {
  element.style.transform = 'translateZ(0)';
  element.style.willChange = 'transform, opacity';
}

// Memoized gift event handler
export function createGiftEventHandler(
  onFaceEffect: (giftId: string) => void,
  onGrandAnimation: (gift: GiftEvent) => void,
  onStandardUpdate: (gift: GiftEvent) => void
): (event: GiftEvent) => void {
  // Use a WeakMap to track processed events
  const processedEvents = new WeakSet();
  
  return (event: GiftEvent) => {
    // Skip if already processed
    if (processedEvents.has(event)) return;
    processedEvents.add(event);
    
    const category = getGiftCategory(event.gift_id);
    
    if (category === 'face') {
      const effect = getGiftEffect(event.gift_id);
      if (effect) {
        onFaceEffect(event.gift_id);
      }
    } else if (category === 'grand') {
      onGrandAnimation(event);
    } else {
      onStandardUpdate(event);
    }
  };
}

// ============================================================================
// 7. FAILSAFE HANDLING
// ============================================================================

// Fallback animation for when AR fails
export function playFallbackAnimation(giftId: string): void {
  console.log('[GiftEngine] Playing fallback animation for:', giftId);
  // Use standard gift animation as fallback
}

// Throttle queue when overloaded
export function shouldThrottle(queueLength: number): boolean {
  // Throttle if queue has more than 10 items
  return queueLength > 10;
}

// Get lightweight fallback for failed animations
export function getLightweightFallback(giftId: string): GiftEffect {
  return {
    id: giftId,
    name: 'Gift',
    icon: '🎁',
    duration: 2000, // Shorter duration
  };
}

export default {
  giftEventStream,
  useGiftEngine,
  arEngine,
  getGiftCategory,
  getGiftEffect,
  giftEffectsMap,
  createGiftEventHandler,
  playFallbackAnimation,
  shouldThrottle,
  getLightweightFallback,
  enableGPUTlayer,
};
