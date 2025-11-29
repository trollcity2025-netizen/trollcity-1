// XP-based tier system for Troll City

export interface TierInfo {
  level: number
  minXP: number
  maxXP: number
  title: string
  perks: string[]
}

export const TIER_LEVELS: TierInfo[] = [
  { level: 1, minXP: 0, maxXP: 4999, title: "Dusty Baby Troll", perks: ["Basic chat access", "default badge"] },
  { level: 5, minXP: 5000, maxXP: 9999, title: "Meme Spark Starter", perks: ["Free coin spins", "emoji reactions"] },
  { level: 10, minXP: 10000, maxXP: 19999, title: "Chaos Hatchling", perks: ["Animated profile frame", "small entrance effects"] },
  { level: 20, minXP: 20000, maxXP: 29999, title: "Glitched Gremlin", perks: ["Gift sending", "basic streamer eligibility"] },
  { level: 30, minXP: 30000, maxXP: 39999, title: "Digital Menace", perks: ["Profile themes", "custom titles", "streamer boosting"] },
  { level: 40, minXP: 40000, maxXP: 49999, title: "Neon Mayhem Freak", perks: ["VIP applause animation", "advanced entrance effects"] },
  { level: 50, minXP: 50000, maxXP: 59999, title: "Coin-Devouring Goblin", perks: ["Live streaming upgrades", "coin multiplier", "small revenue share"] },
  { level: 60, minXP: 60000, maxXP: 69999, title: "Carnival Hexcaster", perks: ["Special animated entrance", "priority support", "creator tools"] },
  { level: 70, minXP: 70000, maxXP: 79999, title: "Royal Crowned Mischief", perks: ["Diamond profile frame", "premium gifts", "priority in stream lists"] },
  { level: 80, minXP: 80000, maxXP: 89999, title: "Neon God of Trollers", perks: ["Troll-themed blast effects", "leaderboard eligibility"] },
  { level: 90, minXP: 90000, maxXP: 99999, title: "Immortal Viral Phantom", perks: ["Neon animated avatar ring", "super gifts", "streamer enhancements"] },
  { level: 100, minXP: 100000, maxXP: 100999, title: "Eternal Original (OG) Troll Overlord 👑", perks: ["OG Crown", "OG Badge", "animated wings", "platform influencer", "staff eligibility"] },
  { level: 101, minXP: 101000, maxXP: Infinity, title: "Admin Overlord 👑", perks: ["All perks", "Admin powers", "Infinite coins", "Platform control"] },
]

export function getTierFromXP(xp: number): TierInfo {
  for (let i = TIER_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= TIER_LEVELS[i].minXP) {
      return TIER_LEVELS[i]
    }
  }
  return TIER_LEVELS[0]
}

export function getLevelFromXP(xp: number, isAdmin: boolean = false): number {
  // Special case for admins - they can reach level 101
  if (isAdmin && xp >= 101000) {
    return 101
  }

  const tier = getTierFromXP(xp)

  // Calculate exact level within the tier range
  const tierIndex = TIER_LEVELS.indexOf(tier)
  if (tierIndex === -1) return 1

  const nextTier = TIER_LEVELS[tierIndex + 1]
  if (!nextTier) return isAdmin ? 101 : 100 // Max level

  const tierRange = nextTier.minXP - tier.minXP
  const xpInTier = xp - tier.minXP
  const levelsInTier = nextTier.level - tier.level
  const levelProgress = Math.floor((xpInTier / tierRange) * levelsInTier)

  return tier.level + levelProgress
}

export function getXPForNextLevel(currentXp: number, isAdmin: boolean = false): { current: number; needed: number; percentage: number } {
  const currentLevel = getLevelFromXP(currentXp, isAdmin)
  if (currentLevel >= (isAdmin ? 101 : 100)) {
    return { current: currentXp, needed: 0, percentage: 100 }
  }
  
  // Find next level threshold
  let nextLevelXp = (currentLevel + 1) * 1000
  
  // For tier boundaries, use exact tier XP
  const nextTier = TIER_LEVELS.find(t => t.level > currentLevel)
  if (nextTier && nextTier.minXP < nextLevelXp) {
    nextLevelXp = nextTier.minXP
  }
  
  const xpNeeded = nextLevelXp - currentXp
  const xpProgress = currentXp % 1000
  const percentage = (xpProgress / 1000) * 100
  
  return {
    current: currentXp,
    needed: xpNeeded,
    percentage: Math.min(percentage, 100)
  }
}

export function getProgressToNextLevel(currentXP: number): number {
  const { percentage } = getXPForNextLevel(currentXP)
  return percentage
}
