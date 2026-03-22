/**
 * Troll City Coin System - Math Utilities
 * Handles coin packages, cashout tiers, and eligibility calculations
 */

// Single source of truth for coin valuation (based on store price: 300 coins = $1.99)
export const STORE_USD_PER_COIN = 1.99 / 300;

// Coin Packages (Source of Truth) - 100 coins = $1
export const COIN_PACKAGES = [
  { id: 'pkg-300', coins: 300, price: 3.00, priceDisplay: "$3.00", emoji: "🟢", name: "Starter" },
  { id: 'pkg-500', coins: 500, price: 5.00, priceDisplay: "$5.00", emoji: "🟢", name: "Small Boost" },
  { id: 'pkg-1000', coins: 1000, price: 10.00, priceDisplay: "$10.00", emoji: "🟢", name: "Casual" },
  { id: 'pkg-2500', coins: 2500, price: 25.00, priceDisplay: "$25.00", emoji: "🔵", popular: true, name: "Bronze" },
  { id: 'pkg-5000', coins: 5000, price: 50.00, priceDisplay: "$50.00", emoji: "🔵", popular: true, name: "Silver" },
  { id: 'pkg-10000', coins: 10000, price: 100.00, priceDisplay: "$100.00", emoji: "🔵", bestValue: true, name: "Gold" },
  { id: 'pkg-15000', coins: 15000, price: 150.00, priceDisplay: "$150.00", emoji: "🟣", bonus: "+5%", name: "Platinum" },
  { id: 'pkg-25000', coins: 25000, price: 250.00, priceDisplay: "$250.00", emoji: "🟣", bonus: "+10%", name: "Diamond" },
  { id: 'pkg-50000', coins: 50000, price: 500.00, priceDisplay: "$500.00", emoji: "🟣", bonus: "+15%", name: "Legendary" },
];

// Legacy export for backward compatibility (if needed) or can be removed if unused
export const coinPackages = COIN_PACKAGES;

// Cashout Tiers (6 total)
export const cashoutTiers = [
  { id: "tier1", name: "Tier 1", coins: 5000, payout: 10 },
  { id: "tier2", name: "Tier 2", coins: 15000, payout: 50 },
  { id: "tier3", name: "Tier 3", coins: 30000, payout: 150 },
  { id: "tier4", name: "Tier 4", coins: 60000, payout: 300 },
  { id: "tier5", name: "Tier 5", coins: 120000, payout: 600 },
  { id: "tier6", name: "Tier 6", coins: 200000, payout: 1000, manualReview: true }
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
