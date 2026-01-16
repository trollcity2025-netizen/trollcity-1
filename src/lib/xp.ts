import { supabase } from './supabase'
import { xpService } from '../services/xpService'

// Level Thresholds (Legacy - Source of Truth is now Database RPC 'calculate_level')
export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 500 },
  { level: 3, xp: 1500 },
  // ...
]

export const BADGE_TYPES = {
  GIFTER: 'gifter',
  STREAMER: 'streamer',
  FAMILY_WAR: 'family_war',
  MILLIONAIRE: 'millionaire',
  TOP_GIFTER: 'top_gifter_daily'
}

// XP Multipliers per Coin
export const XP_RATES = {
  GIFTER: 0.25, // 25% of coins
  STREAMER: 1.0, // 100% of coins
  WAR: 5
}

/**
 * Calculate level based on XP (Client-side estimation)
 * Note: Real level is determined by Database RPC
 */
export function calculateLevel(_xp: number): number {
    // Simplified linear approximation matching DB for now, or just return 1
    // The DB uses a progressive curve.
    return 1; 
}

/**
 * Process Gift XP Logic
 * Migrated to use xpService (RPC)
 */
export async function processGiftXp(senderId: string, receiverId: string, coinAmount: number) {
  const sourceId = `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 1. Calculate XP
  const gifterXp = Math.floor(coinAmount * XP_RATES.GIFTER)
  const streamerXp = Math.floor(coinAmount * XP_RATES.STREAMER)

  // 2. Update Sender (Gifter)
  // We use the new service which calls the secure RPC
  const senderResultRaw = await xpService.grantXP(
      senderId, 
      gifterXp, 
      'gift_sent', 
      sourceId + '_sender',
      { coin_amount: coinAmount, receiver_id: receiverId }
  )

  // 3. Update Receiver (Streamer)
  const receiverResultRaw = await xpService.grantXP(
      receiverId, 
      streamerXp, 
      'gift_received', 
      sourceId + '_receiver',
      { coin_amount: coinAmount, sender_id: senderId }
  )

  // 4. Map to legacy return format for compatibility with useGiftSystem
  const senderResult = {
      leveledUp: false, // RPC doesn't return this bool yet, but Sidebar will update auto
      newLevel: senderResultRaw.data?.level || 1,
      type: 'gifter'
  }

  const receiverResult = {
      leveledUp: false,
      newLevel: receiverResultRaw.data?.level || 1,
      type: 'streamer'
  }

  // 5. Check for Millionaire Hall of Fame (Legacy logic preserved)
  if (coinAmount >= 250000) {
    await addToMillionaireHallOfFame(senderId, receiverId, coinAmount)
  }

  return { senderResult, receiverResult }
}

/**
 * Add to Millionaire Hall of Fame
 */
async function addToMillionaireHallOfFame(senderId: string, receiverId: string, amount: number) {
  try {
    await supabase
      .from('hall_of_fame')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        amount: amount,
        created_at: new Date().toISOString()
      })
    
    // Also grant millionaire badge (Legacy badge system)
    // await grantBadge(...) 
  } catch (err) {
    console.error('addToMillionaireHallOfFame error:', err)
  }
}

// Deprecated: Old direct update function
export async function updateUserXp(userId: string, type: 'gifter' | 'streamer', _xpAmount: number) {
    console.warn('updateUserXp is deprecated. Use xpService.grantXP instead.')
    return { leveledUp: false, newLevel: 1, type }
}
