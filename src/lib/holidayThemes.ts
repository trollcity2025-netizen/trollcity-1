// Holiday theme definitions for dynamic gift box UI
export interface HolidayTheme {
  start: string // MM-DD format
  end: string // MM-DD format
  name: string
  icon: string
  giftBox: string // Image filename
}

// Calculate Easter date for a given year using Meeus/Jones/Butcher algorithm
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
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
  const year = today.getFullYear()
  const monthDay = today.toISOString().slice(5, 10) // "MM-DD"

  // Check for Easter (Easter Sunday to Easter Monday)
  const easterDate = getEasterDate(year)
  const easterEnd = new Date(easterDate)
  easterEnd.setDate(easterDate.getDate() + 1) // Easter Monday

  if (today >= easterDate && today <= easterEnd) {
    return {
      start: easterDate.toISOString().slice(5, 10),
      end: easterEnd.toISOString().slice(5, 10),
      name: 'Easter',
      icon: '🐣',
      giftBox: 'easter_box.png'
    }
  }

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

