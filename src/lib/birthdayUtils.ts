/**
 * Birthday utility functions
 * Checks if a user's birthday is today
 */

export function isBirthdayToday(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return false
  
  try {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    
    // Compare month and day only (ignore year)
    return birthDate.getMonth() === today.getMonth() && 
           birthDate.getDate() === today.getDate()
  } catch (error) {
    console.error('Error parsing birthday:', error)
    return false
  }
}

export function getBirthdayBannerText(username: string): string {
  return `🎉 ${username}'s Birthday! 🎂`
}

