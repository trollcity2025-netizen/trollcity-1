// Officer Work Credit (OWC) System Configuration

export interface OfficerLevelConfig {
  level: number
  title: string
  owcPerHour: number
  conversionRate: number // as decimal (0.005 = 0.5%)
  basetroll_coinsPerHour: number
  finaltroll_coinsPerHour: number // with 10% bonus
  badgeColor: string
  badgeEmoji: string
}

export const OFFICER_LEVELS: Record<number, OfficerLevelConfig> = {
  1: {
    level: 1,
    title: 'Junior Officer',
    owcPerHour: 0,
    conversionRate: 0,
    basetroll_coinsPerHour: 0,
    finaltroll_coinsPerHour: 0,
    badgeColor: 'blue',
    badgeEmoji: '🟦'
  },
  2: {
    level: 2,
    title: 'Senior Officer',
    owcPerHour: 0,
    conversionRate: 0,
    basetroll_coinsPerHour: 0,
    finaltroll_coinsPerHour: 0,
    badgeColor: 'orange',
    badgeEmoji: '🟧'
  },
  3: {
    level: 3,
    title: 'Commander',
    owcPerHour: 0,
    conversionRate: 0,
    basetroll_coinsPerHour: 0,
    finaltroll_coinsPerHour: 0,
    badgeColor: 'red',
    badgeEmoji: '🟥'
  },
  4: {
    level: 4,
    title: 'Elite Commander',
    owcPerHour: 0,
    conversionRate: 0,
    basetroll_coinsPerHour: 0,
    finaltroll_coinsPerHour: 0,
    badgeColor: 'purple',
    badgeEmoji: '🟪'
  },
  5: {
    level: 5,
    title: 'HQ Master Officer',
    owcPerHour: 0,
    conversionRate: 0,
    basetroll_coinsPerHour: 0,
    finaltroll_coinsPerHour: 0,
    badgeColor: 'gold',
    badgeEmoji: '🟨'
  }
}

// Helper functions
export function getOWCPerHour(level: number): number {
  return OFFICER_LEVELS[level]?.owcPerHour || OFFICER_LEVELS[1].owcPerHour
}

export function getConversionRate(level: number): number {
  return OFFICER_LEVELS[level]?.conversionRate || OFFICER_LEVELS[1].conversionRate
}

export function convertOWCTotroll_coins(owc: number, level: number): number {
  const rate = getConversionRate(level)
  const basePaid = Math.floor(owc * rate)
  const bonus = Math.floor(basePaid * 0.10) // 10% bonus
  return basePaid + bonus
}

export function getLevelConfig(level: number): OfficerLevelConfig {
  return OFFICER_LEVELS[level] || OFFICER_LEVELS[1]
}

export function formatOWC(owc: number): string {
  if (owc >= 1_000_000) {
    return `${(owc / 1_000_000).toFixed(2)}M OWC`
  }
  if (owc >= 1_000) {
    return `${(owc / 1_000).toFixed(2)}K OWC`
  }
  return `${owc.toLocaleString()} OWC`
}
// Re-saved to trigger HMR
