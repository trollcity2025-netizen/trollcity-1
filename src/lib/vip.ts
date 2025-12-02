// VIP Tier System
// Calculates user VIP tier based on total earned coins

export type VipTier = {
  name: string
  minCoins: number
  color: string
}

const TIERS: VipTier[] = [
  { name: 'Bronze Troll', minCoins: 0, color: '#cd7f32' },
  { name: 'Silver Troll', minCoins: 50_000, color: '#c0c0c0' },
  { name: 'Gold Troll', minCoins: 150_000, color: '#ffd700' },
  { name: 'Royal Troll', minCoins: 400_000, color: '#b19cd9' },
  { name: 'Troll Emperor', minCoins: 1_000_000, color: '#ff4dd2' },
]

/**
 * Get VIP tier based on total earned coins
 * @param totalEarnedCoins - Total coins the user has earned
 * @returns The highest tier the user qualifies for
 */
export function getVipTier(totalEarnedCoins: number): VipTier {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (totalEarnedCoins >= tier.minCoins) {
      current = tier
    }
  }
  return current
}

/**
 * Check if user is OG (created before 2026-01-01)
 * @param createdAt - User creation date
 * @returns True if user is OG
 */
export function isOG(createdAt: string | Date): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  return created < new Date('2026-01-01')
}

/**
 * Get all tiers (for display purposes)
 */
export function getAllTiers(): VipTier[] {
  return TIERS
}

