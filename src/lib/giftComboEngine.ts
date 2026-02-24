// Gift Combo Engine - Handles combo streak tracking and display

export interface ComboState {
  senderId: string;
  senderName: string;
  count: number;
  lastTimestamp: number;
  giftId: string;
  giftName: string;
  giftIcon: string;
}

const COMBO_WINDOW_MS = 5000; // 5 seconds

// Map to track active combos per sender
const activeCombos: Map<string, ComboState> = new Map();

export function processGiftCombo(
  senderId: string,
  senderName: string,
  giftId: string,
  giftName: string,
  giftIcon: string
): { isCombo: boolean; comboState: ComboState } | null {
  const now = Date.now();
  const existing = activeCombos.get(senderId);

  if (existing) {
    const timeSinceLastGift = now - existing.lastTimestamp;
    
    // Check if within combo window and same gift type
    if (timeSinceLastGift <= COMBO_WINDOW_MS && existing.giftId === giftId) {
      // Increment combo
      existing.count += 1;
      existing.lastTimestamp = now;
      activeCombos.set(senderId, existing);
      return { isCombo: true, comboState: { ...existing } };
    } else {
      // Combo broken - start new
      const newCombo: ComboState = {
        senderId,
        senderName,
        count: 1,
        lastTimestamp: now,
        giftId,
        giftName,
        giftIcon,
      };
      activeCombos.set(senderId, newCombo);
      return { isCombo: false, comboState: newCombo };
    }
  } else {
    // First gift from this sender
    const newCombo: ComboState = {
      senderId,
      senderName,
      count: 1,
      lastTimestamp: now,
      giftId,
      giftName,
      giftIcon,
    };
    activeCombos.set(senderId, newCombo);
    return { isCombo: false, comboState: newCombo };
  }
}

// Clean up expired combos (call periodically or on animation end)
export function cleanupExpiredCombos(): void {
  const now = Date.now();
  for (const [senderId, combo] of activeCombos.entries()) {
    if (now - combo.lastTimestamp > COMBO_WINDOW_MS) {
      activeCombos.delete(senderId);
    }
  }
}

// Get active combo for a specific sender
export function getActiveCombo(senderId: string): ComboState | undefined {
  const combo = activeCombos.get(senderId);
  if (combo && Date.now() - combo.lastTimestamp <= COMBO_WINDOW_MS) {
    return combo;
  }
  // Expired
  activeCombos.delete(senderId);
  return undefined;
}

// Reset combo for a sender (call when animation completes)
export function resetCombo(senderId: string): void {
  activeCombos.delete(senderId);
}
