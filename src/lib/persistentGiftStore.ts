// Persistent Gift Store - Manages high-value gifts that stay on user boxes

export interface PersistentGift {
  receiverId: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  amount: number;
  senderName: string;
  expiresAt: number; // timestamp
}

const PERSISTENT_THRESHOLD = 1000; // Gifts >= 1000 coins persist
const MIN_DURATION_MS = 8000; // 8 seconds
const MAX_DURATION_MS = 15000; // 15 seconds

// Map of receiverId to array of persistent gifts
const persistentGifts: Map<string, PersistentGift[]> = new Map();
let listeners: (() => void)[] = [];

export const persistentGiftStore = {
  addPersistentGift(
    receiverId: string,
    giftId: string,
    giftName: string,
    giftIcon: string,
    amount: number,
    senderName: string
  ): PersistentGift | null {
    if (amount < PERSISTENT_THRESHOLD) {
      return null;
    }

    let durationMs = MIN_DURATION_MS;
    if (amount >= 10000) {
      durationMs = MAX_DURATION_MS;
    } else if (amount >= 5000) {
      durationMs = 12000;
    } else if (amount >= 2500) {
      durationMs = 10000;
    }

    const expiresAt = Date.now() + durationMs;

    const gift: PersistentGift = {
      receiverId,
      giftId,
      giftName,
      giftIcon,
      amount,
      senderName,
      expiresAt,
    };

    const existing = persistentGifts.get(receiverId) || [];
    existing.push(gift);
    persistentGifts.set(receiverId, existing);
    emitChange();

    setTimeout(() => {
      this.removeExpiredGift(receiverId, gift);
    }, durationMs);

    return gift;
  },

  removeExpiredGift(receiverId: string, gift: PersistentGift): void {
    const existing = persistentGifts.get(receiverId);
    if (existing) {
      const filtered = existing.filter(g => g !== gift);
      if (filtered.length === 0) {
        persistentGifts.delete(receiverId);
      } else {
        persistentGifts.set(receiverId, filtered);
      }
      emitChange();
    }
  },

  getSnapshot(): Map<string, PersistentGift[]> {
    const now = Date.now();
    const result = new Map<string, PersistentGift[]>();
    for (const [receiverId, gifts] of persistentGifts.entries()) {
      const active = gifts.filter(g => g.expiresAt > now);
      if (active.length > 0) {
        result.set(receiverId, active);
      }
    }
    return result;
  },

  subscribe(listener: () => void): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  clearAll(): void {
    persistentGifts.clear();
    emitChange();
  }
};

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}
export function addPersistentGift(
  receiverId: string,
  giftId: string,
  giftName: string,
  giftIcon: string,
  amount: number,
  senderName: string
): PersistentGift | null {
  return persistentGiftStore.addPersistentGift(receiverId, giftId, giftName, giftIcon, amount, senderName);
}



// Get all persistent gifts across all users (for grid overlay)
export function getAllPersistentGifts(): Map<string, PersistentGift[]> {
  return persistentGiftStore.getSnapshot();
}



// Clear all persistent gifts (call on stream end)
export function clearAllPersistentGifts(): void {
  persistentGiftStore.clearAll();
}


