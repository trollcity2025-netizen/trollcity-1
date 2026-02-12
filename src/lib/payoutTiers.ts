export const TIERS = [
  { coins: 15000, usd: 50, manualReview: false },
  { coins: 30000, usd: 150, manualReview: false },
  { coins: 60000, usd: 300, manualReview: false },
  { coins: 120000, usd: 600, manualReview: false },
  { coins: 200000, usd: 1000, manualReview: true },
] as const;

export const FIXED_FEE_USD = 3;

export function getRateForCoins(coins: number) {
  if (coins >= 200000) return 1000 / 200000;
  if (coins >= 120000) return 600 / 120000;
  if (coins >= 60000) return 300 / 60000;
  if (coins >= 30000) return 150 / 30000;
  if (coins >= 15000) return 50 / 15000;
  return 0;
}
