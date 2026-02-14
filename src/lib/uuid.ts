// Polyfill for crypto.randomUUID() which might be missing in some mobile/older browsers
export function generateUUID(): string {
  // Use native if available and we are in a secure context
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if it fails
    }
  }

  // Fallback implementation (RFC4122 version 4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
