// src/lib/familySeasons.ts
// Family seasons management utilities

import { supabase } from './supabase'

/**
 * Get the current active season
 */
export async function getCurrentSeason() {
  try {
    const { data: season } = await supabase
      .from('family_seasons')
      .select('*')
      .eq('is_active', true)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return season
  } catch (error) {
    console.error('getCurrentSeason error:', error)
    return null
  }
}

/**
 * Check if seasonal stats need to be reset
 */
export async function checkSeasonReset() {
  try {
    const currentSeason = await getCurrentSeason()
    if (!currentSeason) return

    const now = new Date()
    const seasonEnd = new Date(currentSeason.ends_at)

    // If season has ended, reset seasonal stats
    if (now >= seasonEnd) {
      await resetSeasonalStats(currentSeason.id)
      await activateNextSeason()
    }
  } catch (error) {
    console.error('checkSeasonReset error:', error)
  }
}

/**
 * Reset seasonal stats for all families
 */
export async function resetSeasonalStats(seasonId: string) {
  try {
    // Reset seasonal coins for all families
    const { error } = await supabase
      .from('family_stats')
      .update({
        season_coins: 0,
        updated_at: new Date().toISOString()
      })
      .gt('season_coins', 0) // Only update families with seasonal coins

    if (error) {
      console.error('Failed to reset seasonal stats:', error)
      return { success: false, error }
    }

    // Log season reset
    await supabase
      .from('family_activity_log')
      .insert({
        family_id: null, // System-wide event
        event_type: 'season_reset',
        event_message: `Season ${seasonId} ended. Seasonal stats have been reset.`
      })

    return { success: true }
  } catch (error) {
    console.error('resetSeasonalStats error:', error)
    return { success: false, error }
  }
}

/**
 * Activate the next season
 */
export async function activateNextSeason() {
  try {
    // Deactivate current season
    await supabase
      .from('family_seasons')
      .update({ is_active: false })
      .eq('is_active', true)

    // Find and activate next season
    const { data: nextSeason } = await supabase
      .from('family_seasons')
      .select('*')
      .eq('is_active', false)
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .single()

    if (nextSeason) {
      await supabase
        .from('family_seasons')
        .update({ is_active: true })
        .eq('id', nextSeason.id)

      // Log new season activation
      await supabase
        .from('family_activity_log')
        .insert({
          family_id: null, // System-wide event
          event_type: 'season_started',
          event_message: `New season started: ${nextSeason.name}`
        })
    }

    return { success: true, nextSeason }
  } catch (error) {
    console.error('activateNextSeason error:', error)
    return { success: false, error }
  }
}

/**
 * Get season leaderboard
 */
export async function getSeasonLeaderboard(limit: number = 50) {
  try {
    const currentSeason = await getCurrentSeason()
    if (!currentSeason) return []

    const { data: leaderboard } = await supabase
      .from('family_stats')
      .select(`
        family_id,
        season_coins,
        troll_families (
          id,
          name,
          emblem_url
        )
      `)
      .gt('season_coins', 0)
      .order('season_coins', { ascending: false })
      .limit(limit)

    return leaderboard || []
  } catch (error) {
    console.error('getSeasonLeaderboard error:', error)
    return []
  }
}

/**
 * Get family season stats
 */
export async function getFamilySeasonStats(familyId: string) {
  try {
    const currentSeason = await getCurrentSeason()

    const { data: stats } = await supabase
      .from('family_stats')
      .select('season_coins, weekly_coins')
      .eq('family_id', familyId)
      .maybeSingle()

    const { data: rank } = await supabase
      .from('family_stats')
      .select('family_id')
      .gt('season_coins', stats?.season_coins || 0)
      .order('season_coins', { ascending: false })

    return {
      seasonCoins: stats?.season_coins || 0,
      weeklyCoins: stats?.weekly_coins || 0,
      seasonRank: (rank?.length || 0) + 1,
      currentSeason: currentSeason?.name || 'No Active Season'
    }
  } catch (error) {
    console.error('getFamilySeasonStats error:', error)
    return {
      seasonCoins: 0,
      weeklyCoins: 0,
      seasonRank: 0,
      currentSeason: 'Unknown'
    }
  }
}

/**
 * Reset weekly stats (call this weekly)
 */
export async function resetWeeklyStats() {
  try {
    const { error } = await supabase
      .from('family_stats')
      .update({
        weekly_coins: 0,
        updated_at: new Date().toISOString()
      })
      .gt('weekly_coins', 0)

    if (error) {
      console.error('Failed to reset weekly stats:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('resetWeeklyStats error:', error)
    return { success: false, error }
  }
}