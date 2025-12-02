// Holiday theme definitions for dynamic gift box UI
export interface HolidayTheme {
  start: string // MM-DD format
  end: string // MM-DD format
  name: string
  icon: string
  giftBox: string // Image filename
}

export const holidayThemes: HolidayTheme[] = [
  { start: '12-20', end: '12-28', name: 'Christmas', icon: '🎄', giftBox: 'christmas_box.png' },
  { start: '12-29', end: '01-03', name: 'New Year', icon: '🎆', giftBox: 'newyear_box.png' },
  { start: '02-10', end: '02-15', name: "Valentine's", icon: '💘', giftBox: 'valentine_box.png' },
  { start: '10-25', end: '10-31', name: 'Halloween', icon: '🎃', giftBox: 'halloween_box.png' },
]

/**
 * Get the active holiday theme based on today's date
 * @returns HolidayTheme or null if no active holiday
 */
export function getActiveHolidayTheme(): HolidayTheme | null {
  const today = new Date()
  const monthDay = today.toISOString().slice(5, 10) // "MM-DD"

  return holidayThemes.find(theme => {
    // Handle year wrap-around (e.g., Dec 29 - Jan 3)
    if (theme.start > theme.end) {
      // Holiday spans across year boundary
      return monthDay >= theme.start || monthDay <= theme.end
    } else {
      // Normal date range
      return monthDay >= theme.start && monthDay <= theme.end
    }
  }) || null
}

/**
 * Get the gift box icon/image path for the current holiday or default
 * @returns Path to gift box image
 */
export function getGiftBoxIcon(): string {
  const activeHoliday = getActiveHolidayTheme()
  if (activeHoliday) {
    return `/giftboxes/${activeHoliday.giftBox}`
  }
  return '/giftboxes/default_box.png'
}

