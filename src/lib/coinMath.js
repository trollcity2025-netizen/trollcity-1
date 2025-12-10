/**
 * Troll City Coin System - Math Utilities
 * Handles coin packages, cashout tiers, and eligibility calculations
 */

// Coin Packages (6 total)
export const coinPackages = [
  { id: "pack1", name: "Baby Pack", coins: 1000, price: 4.49 },
  { id: "pack2", name: "Troller Pack", coins: 5000, price: 20.99 },
  { id: "pack3", name: "Mischief Pack", coins: 12000, price: 49.99 },
  { id: "pack4", name: "Troll Master", coins: 25000, price: 99.99 },
  { id: "pack5", name: "Chaos Pack", coins: 60000, price: 239.99 },
  { id: "pack6", name: "Ultimate Troll Pack", coins: 120000, price: 459.99 }
];

// Cashout Tiers (5 total)
export const cashoutTiers = [
  { id: "basic", name: "Basic", coins: 12000, payout: 25 },
  { id: "pro", name: "Pro", coins: 30000, payout: 70 },
  { id: "elite", name: "Elite", coins: 60000, payout: 150 },
  { id: "diamond", name: "Diamond", coins: 120000, payout: 325 },
  { id: "royal", name: "Royal", coins: 250000, payout: 700 }
];

/**
 * Get the highest eligible cashout tier based on total coins
 * @param {number} totalCoins - Combined paid_coins + free_coins
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
 * @param {number} paidCoins - Paid coin balance
 * @param {number} freeCoins - Free coin balance
 * @returns {number} - Total coins
 */
export function calculateTotalCoins(paidCoins, freeCoins) {
  return (paidCoins || 0) + (freeCoins || 0);
}