export const OFFICER_BASE_HOURLY_COINS = 0

export function calculateOfficerBaseCoins(hoursWorked: number): number {
  if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) {
    return 0
  }
  return Math.round(hoursWorked * OFFICER_BASE_HOURLY_COINS)
}

export function calculateTotalOfficerEarnings(
  hoursWorked: number,
  liveEarnings: number,
  courtBonuses: number,
  otherBonuses: number
): number {
  const base = calculateOfficerBaseCoins(hoursWorked)
  const live = Number.isFinite(liveEarnings) ? liveEarnings : 0
  const court = Number.isFinite(courtBonuses) ? courtBonuses : 0
  const other = Number.isFinite(otherBonuses) ? otherBonuses : 0
  return base + live + court + other
}


