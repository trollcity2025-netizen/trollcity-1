/**
 * Badge Evaluation Service
 * Checks user progress and awards appropriate badges
 */

import { supabase } from '../lib/supabase'

interface BadgeCheckResult {
  awarded: boolean
  badgeSlug?: string
  message?: string
}

// ===========================
// LEVEL BADGES
// ===========================

/**
 * Check and award level badges based on current level
 */
export async function checkLevelBadges(userId: string, currentLevel: number): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  const levelThresholds = [10, 50, 100, 250, 500, 750, 1000, 1500, 2000]
  
  for (const threshold of levelThresholds) {
    if (currentLevel >= threshold) {
      const badgeSlug = `level-${threshold}`
      const awarded = await awardBadgeIfNotExists(userId, badgeSlug)
      
      if (awarded) {
        results.push({ 
          awarded: true, 
          badgeSlug, 
          message: `Level ${threshold} badge awarded!` 
        })
      }
    }
  }
  
  return results
}

// ===========================
// ECONOMY BADGES
// ===========================

/**
 * Check economy-related badges
 */
export async function checkEconomyBadges(userId: string): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  
  // Get user's economy stats
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('total_spent_coins, total_gifts_sent, total_cashouts')
    .eq('id', userId)
    .maybeSingle()
  
  if (!profile) return results
  
  // First Spend (any paid coin)
  if (profile.total_spent_coins > 0) {
    if (await awardBadgeIfNotExists(userId, 'first-spend')) {
      results.push({ awarded: true, badgeSlug: 'first-spend' })
    }
  }
  
  // Whale (100,000 paid coins)
  if (profile.total_spent_coins >= 100000) {
    if (await awardBadgeIfNotExists(userId, 'whale')) {
      results.push({ awarded: true, badgeSlug: 'whale' })
    }
  }
  
  // Tycoon (5 cashouts)
  if (profile.total_cashouts >= 5) {
    if (await awardBadgeIfNotExists(userId, 'tycoon')) {
      results.push({ awarded: true, badgeSlug: 'tycoon' })
    }
  }
  
  // First Gift Sender
  if (profile.total_gifts_sent >= 1) {
    if (await awardBadgeIfNotExists(userId, 'first-gift-sender')) {
      results.push({ awarded: true, badgeSlug: 'first-gift-sender' })
    }
  }
  
  // Gift Master (1,000 gifts)
  if (profile.total_gifts_sent >= 1000) {
    if (await awardBadgeIfNotExists(userId, 'gift-master')) {
      results.push({ awarded: true, badgeSlug: 'gift-master' })
    }
  }
  
  return results
}

// ===========================
// STREAMING BADGES
// ===========================

/**
 * Check streaming-related badges
 */
export async function checkStreamingBadges(userId: string): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  
  // Get user's streaming stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_streams, total_viewers, max_concurrent_viewers, max_stream_coins_received')
    .eq('id', userId)
    .maybeSingle()
  
  if (!profile) return results
  
  // Broadcaster (10 streams)
  if (profile.total_streams >= 10) {
    if (await awardBadgeIfNotExists(userId, 'broadcaster')) {
      results.push({ awarded: true, badgeSlug: 'broadcaster' })
    }
  }
  
  // Star (1,000 total viewers)
  if (profile.total_viewers >= 1000) {
    if (await awardBadgeIfNotExists(userId, 'star')) {
      results.push({ awarded: true, badgeSlug: 'star' })
    }
  }
  
  // Cult Following (50 concurrent viewers)
  if (profile.max_concurrent_viewers >= 50) {
    if (await awardBadgeIfNotExists(userId, 'cult')) {
      results.push({ awarded: true, badgeSlug: 'cult' })
    }
  }
  
  // Gift Magnet (10,000 coins in one stream)
  if (profile.max_stream_coins_received >= 10000) {
    if (await awardBadgeIfNotExists(userId, 'gift-magnet')) {
      results.push({ awarded: true, badgeSlug: 'gift-magnet' })
    }
  }
  
  return results
}

// ===========================
// COMMUNITY BADGES
// ===========================

/**
 * Check community-related badges (Troll Court, chat)
 */
export async function checkCommunityBadges(userId: string): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  
  // Get user's community stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_jury_duty, total_rulings_accepted, total_helpful_reports, total_chat_messages')
    .eq('id', userId)
    .maybeSingle()
  
  if (!profile) return results
  
  // Juror (10 jury duties)
  if (profile.total_jury_duty >= 10) {
    if (await awardBadgeIfNotExists(userId, 'juror')) {
      results.push({ awarded: true, badgeSlug: 'juror' })
    }
  }
  
  // Judge (5 rulings accepted)
  if (profile.total_rulings_accepted >= 5) {
    if (await awardBadgeIfNotExists(userId, 'judge')) {
      results.push({ awarded: true, badgeSlug: 'judge' })
    }
  }
  
  // Enforcer (10 helpful reports)
  if (profile.total_helpful_reports >= 10) {
    if (await awardBadgeIfNotExists(userId, 'enforcer')) {
      results.push({ awarded: true, badgeSlug: 'enforcer' })
    }
  }
  
  // Chatty (500 chat messages)
  if (profile.total_chat_messages >= 500) {
    if (await awardBadgeIfNotExists(userId, 'chatty')) {
      results.push({ awarded: true, badgeSlug: 'chatty' })
    }
  }
  
  return results
}

// ===========================
// SOCIAL/FLEX BADGES
// ===========================

/**
 * Check social/flex badges
 */
export async function checkSocialBadges(userId: string): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  
  // Get user's social stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('login_streak, created_at, total_badges_earned, total_violations, last_violation_at')
    .eq('id', userId)
    .maybeSingle()
  
  if (!profile) return results
  
  // Addict (30-day login streak)
  if (profile.login_streak >= 30) {
    if (await awardBadgeIfNotExists(userId, 'addict')) {
      results.push({ awarded: true, badgeSlug: 'addict' })
    }
  }
  
  // OG (account older than 1 year)
  const accountAge = Date.now() - new Date(profile.created_at).getTime()
  const oneYear = 365 * 24 * 60 * 60 * 1000
  if (accountAge >= oneYear) {
    if (await awardBadgeIfNotExists(userId, 'og')) {
      results.push({ awarded: true, badgeSlug: 'og' })
    }
  }
  
  // Evolved (500 total badges)
  if (profile.total_badges_earned >= 500) {
    if (await awardBadgeIfNotExists(userId, 'evolved')) {
      results.push({ awarded: true, badgeSlug: 'evolved' })
    }
  }
  
  // Untouchable (6 months with zero violations)
  if (profile.total_violations === 0 || !profile.last_violation_at) {
    const sixMonths = 180 * 24 * 60 * 60 * 1000
    const timeSinceViolation = profile.last_violation_at 
      ? Date.now() - new Date(profile.last_violation_at).getTime()
      : accountAge
    
    if (timeSinceViolation >= sixMonths) {
      if (await awardBadgeIfNotExists(userId, 'untouchable')) {
        results.push({ awarded: true, badgeSlug: 'untouchable' })
      }
    }
  }
  
  return results
}

// ===========================
// HIDDEN BADGES
// ===========================

/**
 * Check for hidden/secret badges
 */
export async function checkHiddenBadges(userId: string, context: any = {}): Promise<BadgeCheckResult[]> {
  const results: BadgeCheckResult[] = []
  
  // Snake Eyes (exactly $666 in one gift)
  if (context.giftAmount === 666) {
    if (await awardBadgeIfNotExists(userId, 'snake-eyes')) {
      results.push({ awarded: true, badgeSlug: 'snake-eyes' })
    }
  }
  
  // Ghost (no profile picture for 6 months)
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle()
  
  if (profile && !profile.avatar_url) {
    const accountAge = Date.now() - new Date(profile.created_at).getTime()
    const sixMonths = 180 * 24 * 60 * 60 * 1000
    if (accountAge >= sixMonths) {
      if (await awardBadgeIfNotExists(userId, 'ghost')) {
        results.push({ awarded: true, badgeSlug: 'ghost' })
      }
    }
  }
  
  // Add more hidden badge checks as needed...
  
  return results
}

// ===========================
// LEVEL PERK UNLOCKS
// ===========================

/**
 * Check and unlock level-based perks
 */
export async function checkAndUnlockPerks(userId: string, currentLevel: number): Promise<string[]> {
  const unlockedPerks: string[] = []
  
  const perkThresholds = {
    25: 'custom_emoji',
    75: 'chat_glow',
    150: 'chat_color',
    300: 'chat_animation',
    500: 'entrance_effect',
    750: 'custom_badge_slot',
    1000: 'crown',
    1500: 'animated_avatar',
    2000: 'city_statue',
  }
  
  for (const [level, perk] of Object.entries(perkThresholds)) {
    if (currentLevel >= parseInt(level)) {
      const unlocked = await unlockPerkIfNotExists(userId, perk, parseInt(level))
      if (unlocked) {
        unlockedPerks.push(perk)
      }
    }
  }
  
  return unlockedPerks
}

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Award a badge if user doesn't already have it
 */
async function awardBadgeIfNotExists(userId: string, badgeSlug: string): Promise<boolean> {
  try {
    // Check if badge exists in catalog
    const { data: catalog } = await supabase
      .from('badge_catalog')
      .select('id')
      .eq('slug', badgeSlug)
      .maybeSingle()
    
    if (!catalog) {
      console.warn(`Badge ${badgeSlug} not found in catalog`)
      return false
    }
    
    // Check if user already has badge
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', catalog.id)
      .maybeSingle()
    
    if (existing) {
      return false // Already has badge
    }
    
    // Award badge
    const { error } = await supabase
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_id: catalog.id,
        earned_at: new Date().toISOString()
      })
    
    if (error) {
      console.error(`Error awarding badge ${badgeSlug}:`, error)
      return false
    }
    
    return true
  } catch (err) {
    console.error(`Exception awarding badge ${badgeSlug}:`, err)
    return false
  }
}

/**
 * Unlock a perk if not already unlocked
 */
async function unlockPerkIfNotExists(userId: string, perkType: string, level: number): Promise<boolean> {
  try {
    // Check if user already has perk
    const { data: existing } = await supabase
      .from('user_level_perks')
      .select('id')
      .eq('user_id', userId)
      .eq('perk_type', perkType)
      .maybeSingle()
    
    if (existing) {
      return false // Already unlocked
    }
    
    // Unlock perk
    const { error } = await supabase
      .from('user_level_perks')
      .insert({
        user_id: userId,
        level: level,
        perk_type: perkType,
        unlocked_at: new Date().toISOString()
      })
    
    if (error) {
      console.error(`Error unlocking perk ${perkType}:`, error)
      return false
    }
    
    return true
  } catch (err) {
    console.error(`Exception unlocking perk ${perkType}:`, err)
    return false
  }
}

/**
 * Comprehensive badge evaluation after XP event
 * Call this after any XP-awarding action
 */
export async function evaluateBadgesForUser(userId: string, context: any = {}): Promise<void> {
  try {
    // Get current level
    const { data: profile } = await supabase
      .from('profiles')
      .select('level')
      .eq('id', userId)
      .maybeSingle()
    
    if (!profile) return
    
    const currentLevel = profile.level || 1
    
    // Check all badge categories
    await Promise.all([
      checkLevelBadges(userId, currentLevel),
      checkEconomyBadges(userId),
      checkStreamingBadges(userId),
      checkCommunityBadges(userId),
      checkSocialBadges(userId),
      checkHiddenBadges(userId, context),
      checkAndUnlockPerks(userId, currentLevel)
    ])
  } catch (err) {
    console.error('Error evaluating badges:', err)
  }
}
