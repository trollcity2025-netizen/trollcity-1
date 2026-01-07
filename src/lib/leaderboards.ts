import { supabase } from './supabase'

/**
 * Get Top Gifters Leaderboard
 */
export async function getLeaderboard(period: 'daily' | 'weekly' | 'monthly', limit: number = 100) {
  const now = new Date()
  const startDate = new Date()

  if (period === 'daily') {
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is sunday
    startDate.setDate(diff)
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'monthly') {
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  }

  try {
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('user_id, amount, created_at, user_profiles(username, avatar_url)')
      .in('type', ['gift', 'gift_sent', 'gift_send'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())

    if (error) throw error

    const leaderboard = new Map<string, any>()
    transactions?.forEach((tx: any) => {
      const existing = leaderboard.get(tx.user_id) || {
        user_id: tx.user_id,
        username: tx.user_profiles?.username,
        avatar_url: tx.user_profiles?.avatar_url,
        total_coins: 0
      }
      existing.total_coins += tx.amount
      leaderboard.set(tx.user_id, existing)
    })

    return Array.from(leaderboard.values())
      .sort((a, b) => b.total_coins - a.total_coins)
      .slice(0, limit)
  } catch (err) {
    console.error(`Error fetching ${period} leaderboard:`, err)
    return []
  }
}

/**
 * Scheduled Job: Daily Reset
 * Calculates top gifters and applies boosts
 */
export async function runDailyReset() {
  console.log('Running Daily Reset...')
  
  try {
    // 1. Get Top 3 Gifters of the last 24h
    // We need a specific query for "yesterday" if running at 00:00
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Direct query fallback for reliability
    const { data: transactions, error } = await supabase
      .from('coin_transactions')
      .select('user_id, amount, created_at, user_profiles(username, avatar_url)')
      .in('type', ['gift', 'gift_sent', 'gift_send'])
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    if (error) throw error

    const leaderboard = new Map<string, any>()
    transactions?.forEach((tx: any) => {
      const existing = leaderboard.get(tx.user_id) || {
        user_id: tx.user_id,
        username: tx.user_profiles?.username,
        avatar_url: tx.user_profiles?.avatar_url,
        total_coins: 0
      }
      existing.total_coins += tx.amount
      leaderboard.set(tx.user_id, existing)
    })

    const topGifters = Array.from(leaderboard.values())
      .sort((a, b) => b.total_coins - a.total_coins)
      .slice(0, 3)

    if (topGifters && topGifters.length > 0) {
      // 2. Apply Boosts
      const boosts = [
        { rank: 1, percent: 50 },
        { rank: 2, percent: 30 },
        { rank: 3, percent: 20 }
      ]

      for (let i = 0; i < topGifters.length; i++) {
        const gifter = topGifters[i]
        const boost = boosts[i]
        
        if (boost) {
          await applyUserBoost(gifter.user_id, boost.percent, 'Top Gifter Boost')
          // Grant "Top Gifter" badge for 24h? Or just a flag?
          // User said: special badge for 24 hours.
          // We might need to insert into user_badges with an expiry or check logic.
        }
      }
    }
    
    console.log('Daily Reset Completed')
  } catch (err) {
    console.error('Daily Reset Failed:', err)
  }
}

/**
 * Scheduled Job: Weekly Reset
 * Calculates winning families and applies boosts
 */
export async function runWeeklyReset() {
  console.log('Running Weekly Reset...')
  
  try {
    // 1. Get Top Families by War Points/Wins
    // Assuming RPC `get_top_war_families`
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    
    // Direct query fallback
    const { data: results, error } = await supabase
      .from('war_results')
      .select('family_id, points, families(id, name)')
      .gte('created_at', lastWeek.toISOString())

    if (error) throw error

    const familyPoints = new Map<string, any>()
    results?.forEach((res: any) => {
      const fId = res.family_id
      const fName = res.families?.name
      const existing = familyPoints.get(fId) || {
        family_id: fId,
        family_name: fName,
        total_points: 0
      }
      existing.total_points += res.points
      familyPoints.set(fId, existing)
    })

    const topFamilies = Array.from(familyPoints.values())
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 3)

    if (topFamilies && topFamilies.length > 0) {
      const boosts = [
        { rank: 1, percent: 30 },
        { rank: 2, percent: 15 },
        { rank: 3, percent: 15 }
      ]

      for (let i = 0; i < topFamilies.length; i++) {
        const family = topFamilies[i]
        const boost = boosts[i]
        
        if (boost) {
          await applyFamilyBoost(family.family_id, boost.percent)
        }
      }
    }

    // 2. Wipe Weekly War Points
    // If there is a specific column, update it.
    // await supabase.from('families').update({ weekly_war_points: 0 }).neq('id', '0000')

    console.log('Weekly Reset Completed')
  } catch (err) {
    console.error('Weekly Reset Failed:', err)
  }
}

async function applyUserBoost(userId: string, percentage: number, reason: string) {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const { error } = await supabase.from('user_boosts').insert({
      user_id: userId,
      boost_percentage: percentage,
      expires_at: expiresAt.toISOString(),
      reason: reason
    })

    if (error) {
      // If table doesn't exist, ignore (or log warning)
      if (error.code === '42P01') { // undefined_table
        console.warn('Table user_boosts does not exist. Skipping boost application.')
      } else {
        throw error
      }
    }
  } catch (err) {
    console.error('Failed to apply user boost:', err)
  }
}

async function applyFamilyBoost(familyId: string, percentage: number) {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error } = await supabase.from('family_boosts').insert({
      family_id: familyId,
      boost_percentage: percentage,
      expires_at: expiresAt.toISOString(),
      reason: 'Weekly War Winner'
    })

    if (error) {
      if (error.code === '42P01') { // undefined_table
        console.warn('Table family_boosts does not exist. Skipping boost application.')
      } else {
        throw error
      }
    }
  } catch (err) {
    console.error('Failed to apply family boost:', err)
  }
}
