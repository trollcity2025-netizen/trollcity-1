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

// Add a persistent gift if it meets the threshold
export function addPersistentGift(
  receiverId: string,
  giftId: string,
  giftName: string,
  giftIcon: string,
  amount: number,
  senderName: string
): PersistentGift | null {
  // Only persist gifts >= threshold
  if (amount < PERSISTENT_THRESHOLD) {
    return null;
  }

  // Determine duration based on gift value
  let durationMs = MIN_DURATION_MS;
  if (amount >= 10000) {
    durationMs = MAX_DURATION_MS; // 15 seconds for legendary
  } else if (amount >= 5000) {
    durationMs = 12000; // 12 seconds for high value
  } else if (amount >= 2500) {
    durationMs = 10000; // 10 seconds for epic
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

  // Add to existing gifts for this receiver
  const existing = persistentGifts.get(receiverId) || [];
  existing.push(gift);
  persistentGifts.set(receiverId, existing);

  // Schedule cleanup
  setTimeout(() => {
    removeExpiredGift(receiverId, gift);
  }, durationMs);

  return gift;
}

// Get all active persistent gifts for a receiver
export function getPersistentGifts(receiverId: string): PersistentGift[] {
  const gifts = persistentGifts.get(receiverId) || [];
  const now = Date.now();
  
  // Filter out expired
  const active = gifts.filter(g => g.expiresAt > now);
  
  // Clean up empty arrays
  if (active.length === 0) {
    persistentGifts.delete(receiverId);
  } else {
    persistentGifts.set(receiverId, active);
  }
  
  return active;
}

// Get all persistent gifts across all users (for grid overlay)
export function getAllPersistentGifts(): Map<string, PersistentGift[]> {
  const now = Date.now();
  const result = new Map<string, PersistentGift[]>();
  
  for (const [receiverId, gifts] of persistentGifts.entries()) {
    const active = gifts.filter(g => g.expiresAt > now);
    if (active.length > 0) {
      result.set(receiverId, active);
    }
  }
  
  return result;
}

// Remove a specific expired gift
function removeExpiredGift(receiverId: string, gift: PersistentGift): void {
  const existing = persistentGifts.get(receiverId);
  if (existing) {
    const filtered = existing.filter(g => g !== gift);
    if (filtered.length === 0) {
      persistentGifts.delete(receiverId);
    } else {
      persistentGifts.set(receiverId, filtered);
    }
  }
}

// Clear all persistent gifts (call on stream end)
export function clearAllPersistentGifts(): void {
  persistentGifts.clear();
}

// Check if a receiver has any persistent gifts
export function hasPersistentGifts(receiverId: string): boolean {
  const gifts = getPersistentGifts(receiverId);
  return gifts.length > 0;
}
