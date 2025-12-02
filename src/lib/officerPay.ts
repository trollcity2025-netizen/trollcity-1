/**
 * Officer pay rates by level (coins per hour)
 */
export const OFFICER_HOURLY_COINS: Record<number, number> = {
  1: 500,   // Junior
  2: 800,   // Senior
  3: 1200   // Commander
};

/**
 * Calculate coins earned based on hours worked and officer level
 */
export function calculateOfficerCoins(hoursWorked: number, officerLevel: number): number {
  const hourlyRate = OFFICER_HOURLY_COINS[officerLevel] || OFFICER_HOURLY_COINS[1];
  return Math.round(hoursWorked * hourlyRate);
}

