/**
 * Troll City Coin System - Math Utilities
 * Handles coin packages, cashout tiers, and eligibility calculations
 */

// Single source of truth for coin valuation (based on store price: 300 coins = $1.99)
export const STORE_USD_PER_COIN = 1.99 / 300;

// Coin Packages (Source of Truth)
export const COIN_PACKAGES = [
  { id: 'pkg-300', coins: 300, price: 1.99, priceDisplay: "$1.99", emoji: "🟢", name: "Starter" },
  { id: 'pkg-500', coins: 500, price: 3.49, priceDisplay: "$3.49", emoji: "🟢", name: "Small Boost" },
  { id: 'pkg-1000', coins: 1000, price: 6.99, priceDisplay: "$6.99", emoji: "🟢", name: "Casual" },
  { id: 'pkg-2500', coins: 2500, price: 16.99, priceDisplay: "$16.99", emoji: "🔵", popular: true, name: "Bronze" },
  { id: 'pkg-5000', coins: 5000, price: 33.99, priceDisplay: "$33.99", emoji: "🔵", popular: true, name: "Silver" },
  { id: 'pkg-10000', coins: 10000, price: 64.99, priceDisplay: "$64.99", emoji: "🔵", bestValue: true, name: "Gold" },
  { id: 'pkg-15000', coins: 15000, price: 89.99, priceDisplay: "$89.99", emoji: "🟣", bonus: "+5%", name: "Platinum" },
  { id: 'pkg-25000', coins: 25000, price: 149.99, priceDisplay: "$149.99", emoji: "🟣", bonus: "+10%", name: "Diamond" },
  { id: 'pkg-50000', coins: 50000, price: 279.99, priceDisplay: "$279.99", emoji: "🟣", bonus: "+15%", name: "Legendary" },
];

// Legacy export for backward compatibility (if needed) or can be removed if unused
export const coinPackages = COIN_PACKAGES;

// Cashout Tiers (4 total)
export const cashoutTiers = [
  { id: "basic", name: "Basic", coins: 12000, payout: 25 },
  { id: "pro", name: "Pro", coins: 26375, payout: 70 },
  { id: "elite", name: "Elite", coins: 60000, payout: 150 },
  { id: "diamond", name: "Diamond", coins: 120000, payout: 355 }
];

/**
 * Get the highest eligible cashout tier based on total coins
 * @param {number} totalCoins - Combined troll_coins + free_coins
 * @returns {object|null} - The eligible tier object or null if no tier is eligible
 */
export function getEligibleTier(totalCoins) {
  // Sort tiers by coins required (ascending)
  const sortedTiers = [...cashoutTiers].sort((a, b) => a.coins - b.coins);

  // Find the highest tier where totalCoins >= tier.coins
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    if (totalCoins >= sortedTiers[i].coins) {
      return sortedTiers[i];
    }
  }

  return null; // No tier eligible
}

/**
 * Format coin amount with commas
 * @param {number} amount - Coin amount
 * @returns {string} - Formatted string
 */
export function formatCoins(amount) {
  if (amount === null || amount === undefined) {
    return '0';
  }
  return Number(amount).toLocaleString();
}

/**
 * Format USD amount
 * @param {number} amount - USD amount
 * @returns {string} - Formatted string
 */
export function formatUSD(amount) {
  if (amount === null || amount === undefined) {
    return '$0.00';
  }
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * Calculate total coins by summing paid and free coins
 * @param {number} troll_coins - Paid coin balance
 * @param {number} freeCoins - Free coin balance
 * @returns {number} - Total coins
 */
export function calculateTotalCoins(troll_coins, freeCoins) {
  return (troll_coins || 0) + (freeCoins || 0);
}
