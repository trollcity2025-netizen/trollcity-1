export const PAYOUT_WINDOW_LABEL =
  "Payouts available Fridays starting at 1:00 AM UTC.";

export function isPayoutWindowOpen(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  return (day === 1 || day === 5) && hour >= 1;
}
