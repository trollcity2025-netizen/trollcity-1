// Officer Work Credit (OWC) System Configuration

export interface OfficerLevelConfig {
  level: number
  title: string
  owcPerHour: number
  conversionRate: number // as decimal (0.005 = 0.5%)
  basePaidCoinsPerHour: number
  finalPaidCoinsPerHour: number // with 10% bonus
  badgeColor: string
  badgeEmoji: string
}

export const OFFICER_LEVELS: Record<number, OfficerLevelConfig> = {
  1: {
    level: 1,
    title: 'Junior Officer',
    owcPerHour: 1_000_000,
    conversionRate: 0.005, // 0.5%
    basePaidCoinsPerHour: 5_000,
    finalPaidCoinsPerHour: 5_500, // with 10% bonus
    badgeColor: 'blue',
    badgeEmoji: '🟦'
  },
  2: {
    level: 2,
    title: 'Senior Officer',
    owcPerHour: 1_500_000,
    conversionRate: 0.007, // 0.7%
    basePaidCoinsPerHour: 10_500,
    finalPaidCoinsPerHour: 11_550, // with 10% bonus
    badgeColor: 'orange',
    badgeEmoji: '🟧'
  },
  3: {
    level: 3,
    title: 'Commander',
    owcPerHour: 1_800_000,
    conversionRate: 0.008, // 0.8%
    basePaidCoinsPerHour: 14_400,
    finalPaidCoinsPerHour: 15_840, // with 10% bonus
    badgeColor: 'red',
    badgeEmoji: '🟥'
  },
  4: {
    level: 4,
    title: 'Elite Commander',
    owcPerHour: 2_200_000,
    conversionRate: 0.009, // 0.9%
    basePaidCoinsPerHour: 19_800,
    finalPaidCoinsPerHour: 21_780, // with 10% bonus
    badgeColor: 'purple',
    badgeEmoji: '🟪'
  },
  5: {
    level: 5,
    title: 'HQ Master Officer',
    owcPerHour: 2_600_000,
    conversionRate: 0.011, // 1.1%
    basePaidCoinsPerHour: 28_600,
    finalPaidCoinsPerHour: 31_460, // with 10% bonus
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

export function convertOWCToPaidCoins(owc: number, level: number): number {
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

