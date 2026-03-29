/**
 * CENTRAL COIN CONFIGURATION
 * 
 * This is the single source of truth for all coin pack and cashout tier values.
 * 
 * Last Updated: 2026-03-21
 */

// Type for cashout tiers (matches payoutTiers.ts)
export interface CashoutTierConfig {
  coins: number;
  usd: number;
  manualReview: boolean;
}

// ============================================================================
// COIN PACKAGES - User purchases (Platform receives USD)
// ============================================================================

export interface CoinPackage {
  id: string;
  coins: number;
  usdPrice: number;
  label: string;
  description: string;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg-300', coins: 300, usdPrice: 3.00, label: 'Starter Pack', description: '300 Coins' },
  { id: 'pkg-500', coins: 500, usdPrice: 5.00, label: 'Small Boost', description: '500 Coins' },
  { id: 'pkg-1000', coins: 1000, usdPrice: 10.00, label: 'Casual Pack', description: '1,000 Coins' },
  { id: 'pkg-2500', coins: 2500, usdPrice: 25.00, label: 'Bronze Pack', description: '2,500 Coins' },
  { id: 'pkg-5000', coins: 5000, usdPrice: 50.00, label: 'Silver Pack', description: '5,000 Coins' },
  { id: 'pkg-10000', coins: 10000, usdPrice: 100.00, label: 'Gold Pack', description: '10,000 Coins' },
  { id: 'pkg-15000', coins: 15000, usdPrice: 150.00, label: 'Platinum Pack', description: '15,000 Coins' },
  { id: 'pkg-25000', coins: 25000, usdPrice: 250.00, label: 'Diamond Pack', description: '25,000 Coins' },
  { id: 'pkg-50000', coins: 50000, usdPrice: 500.00, label: 'Legendary Pack', description: '50,000 Coins' },
];

// Exchange rate: 100 coins per $1 (all packages)
export const COINS_PER_USD = 100;

// New user bonus: 5% extra coins on all coin package purchases
export const NEW_USER_BONUS_PERCENT = 5;

// ============================================================================
// CASHOUT TIERS (Single Source of Truth)
// ============================================================================
export const CASHOUT_TIERS = [
  { coins: 5000, usd: 10, manualReview: false },
  { coins: 15000, usd: 50, manualReview: false },
  { coins: 30000, usd: 150, manualReview: false },
  { coins: 60000, usd: 300, manualReview: false },
  { coins: 120000, usd: 600, manualReview: false },
  { coins: 200000, usd: 1000, manualReview: true },
] as const;

// Alias exports for backward compatibility with old payoutTiers imports
export const TIERS = CASHOUT_TIERS;
export const FIXED_FEE_USD = 3;

// Minimum coins required for any cashout
export const MIN_CASHOUT_COINS = 5000;

// Coins amount that requires manual admin review
export const MANUAL_REVIEW_THRESHOLD = 200000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get cashout rate (USD per coin) for a given coin amount
 */
export function getRateForCoins(coins: number): number {
  if (coins >= 200000) return 1000 / 200000;
  if (coins >= 120000) return 600 / 120000;
  if (coins >= 60000) return 300 / 60000;
  if (coins >= 30000) return 150 / 30000;
  if (coins >= 15000) return 50 / 15000;
  if (coins >= 5000) return 10 / 5000;
  return 0;
}

/**
 * Get coins per USD for a given cashout amount
 */
export function getCoinsPerUsd(coinAmount: number): number {
  const rate = getRateForCoins(coinAmount);
  return rate > 0 ? 1 / rate : 200;
}

/**
 * Calculate USD value for a given coin amount based on tiers
 */
export function calculateCashoutUsd(coinAmount: number): number {
  const tier = CASHOUT_TIERS.find(t => t.coins === coinAmount);
  return tier?.usd ?? 0;
}

/**
 * Check if a cashout requires manual review
 */
export function requiresManualReview(coinAmount: number): boolean {
  return coinAmount >= MANUAL_REVIEW_THRESHOLD;
}

/**
 * Get all available coin packages
 */
export function getCoinPackages(): CoinPackage[] {
  return COIN_PACKAGES;
}

/**
 * Calculate coins with new user bonus applied
 * @param baseCoins - The base coin amount
 * @param includeBonus - Whether to include the 5% bonus
 */
export function calculateCoinsWithBonus(baseCoins: number, includeBonus: boolean = true): number {
  if (!includeBonus) return baseCoins;
  return Math.floor(baseCoins * (1 + NEW_USER_BONUS_PERCENT / 100));
}

/**
 * Get the bonus coins amount for a purchase
 */
export function getBonusCoins(baseCoins: number): number {
  return Math.floor(baseCoins * (NEW_USER_BONUS_PERCENT / 100));
}

/**
 * Validate coin amount against available tiers
 */
export function isValidCashoutAmount(coinAmount: number): boolean {
  return CASHOUT_TIERS.some(t => t.coins === coinAmount);
}
