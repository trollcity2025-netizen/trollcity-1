import { supabase } from './supabase'
import { xpService } from '../services/xpService'
import { evaluateBadgesForUser } from '../services/badgeEvaluationService'

// Level Thresholds (Legacy - Source of Truth is now Database RPC 'calculate_level')
export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 500 },
  { level: 3, xp: 1500 },
  // ...
]

/**
 * Get level name/title based on level number
 */
export function getLevelName(level: number): string {
  if (level >= 2000) return 'Mythic Legend'
  if (level >= 1500) return 'Divine Master'
  if (level >= 1000) return 'Legendary Champion'
  if (level >= 750) return 'Epic Warlord'
  if (level >= 500) return 'Elite Commander'
  if (level >= 250) return 'Veteran Warrior'
  if (level >= 100) return 'Skilled Fighter'
  if (level >= 50) return 'Experienced Troll'
  if (level >= 25) return 'Rising Star'
  if (level >= 10) return 'Rookie Troll'
  return 'Citizen'
}

export const BADGE_TYPES = {
  GIFTER: 'gifter',
  STREAMER: 'streamer',
  FAMILY_WAR: 'family_war',
  MILLIONAIRE: 'millionaire',
  TOP_GIFTER: 'top_gifter_daily'
}

// ===========================
// COMPREHENSIVE XP RATES
// ===========================

// Economy Actions
export const ECONOMY_XP = {
  PAID_COIN_SPEND: 1,        // +1 XP per paid coin spent
  LIVE_GIFT_BONUS: 1.1,      // +1.1 XP per coin (10% bonus) for live gifts
  STORE_PURCHASE: 5,         // +5 XP per $1 spent in store
}

// Engagement Actions
export const ENGAGEMENT_XP = {
  WATCH_PER_MINUTE: 2,       // +2 XP per minute watching live
  CHAT_MESSAGE: 5,           // +5 XP per chat (30s cooldown)
  DAILY_LOGIN: 25,           // +25 XP first login per day
  STREAK_7_DAY: 150,         // +150 XP bonus for 7-day streak
}

// Streaming Actions
export const STREAMING_XP = {
  GO_LIVE_BASE: 200,         // +200 XP for going live (10+ min)
  VIEWER_MINUTE: 1,          // +1 XP per viewer per minute
  GIFT_RECEIVED_MULTIPLIER: 1.0, // +1 XP per coin received
}

// Troll Court Actions
export const COURT_XP = {
  JURY_PARTICIPATION: 100,   // +100 XP for serving on jury
  RULING_ACCEPTED: 250,      // +250 XP when your ruling is accepted
  HELPFUL_REPORT: 150,       // +150 XP for filing helpful report
}

// Level-based perks unlock thresholds
export const LEVEL_PERKS = {
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

// Badge thresholds
export const BADGE_THRESHOLDS = {
  LEVEL: [10, 50, 100, 250, 500, 750, 1000, 1500, 2000],
}

// XP Multipliers per Coin (Legacy)
export const XP_RATES = {
  GIFTER: 0.25, // 25% of coins
  STREAMER: 1.0, // 100% of coins
  WAR: 5
}

/**
 * Calculate level based on XP (Client-side estimation)
 * Note: Real level is determined by Database RPC
 * Matches the logic in calculate_level_details SQL function
 */
export function calculateLevel(xp: number): number {
  let curr_lvl = 1;
  let xp_accum = 0;
  let xp_needed = 100;
  
  while (true) {
    if (curr_lvl < 50) {
      xp_needed = Math.floor(100 * Math.pow(1.1, curr_lvl - 1));
    } else {
      xp_needed = 10000;
    }

    if (xp < (xp_accum + xp_needed)) {
      return curr_lvl;
    }

    xp_accum += xp_needed;
    curr_lvl++;
    if (curr_lvl >= 10000) return curr_lvl; // Safety break
  }
}

// ===========================
// ECONOMY XP FUNCTIONS
// ===========================

/**
 * Award XP for spending paid coins (general)
 * +1 XP per paid coin
 */
export async function awardPaidCoinXP(userId: string, coinAmount: number, metadata: any = {}) {
  const xpAmount = Math.floor(coinAmount * ECONOMY_XP.PAID_COIN_SPEND)
  const sourceId = `paid_coin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const result = await xpService.grantXP(
    userId,
    xpAmount,
    'paid_coin_spend',
    sourceId,
    metadata
  )
  
  if (result.success) {
    evaluateBadgesForUser(userId).catch(console.error)
  }
  
  return result
}

/**
 * Award XP for live gift with 10% bonus
 * +1.1 XP per coin
 */
export async function awardLiveGiftXP(userId: string, coinAmount: number, metadata: any = {}) {
  const xpAmount = Math.floor(coinAmount * ECONOMY_XP.LIVE_GIFT_BONUS)
  const sourceId = `live_gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const result = await xpService.grantXP(
    userId,
    xpAmount,
    'live_gift_send',
    sourceId,
    metadata
  )

  if (result.success) {
    evaluateBadgesForUser(userId, { giftAmount: coinAmount }).catch(console.error)
  }

  return result
}

/**
 * Award XP for store purchase
 * +5 XP per $1
 */
export async function awardStorePurchaseXP(userId: string, dollarAmount: number, metadata: any = {}) {
  const xpAmount = Math.floor(dollarAmount * ECONOMY_XP.STORE_PURCHASE)
  const sourceId = `store_purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const result = await xpService.grantXP(
    userId,
    xpAmount,
    'store_purchase',
    sourceId,
    metadata
  )

  if (result.success) {
    evaluateBadgesForUser(userId).catch(console.error)
  }

  return result
}

// ===========================
// ENGAGEMENT XP FUNCTIONS
// ===========================

/**
 * Award XP for watching live stream
 * +2 XP per minute
 */
export async function awardWatchStreamXP(userId: string, minutesWatched: number, streamId: string) {
  const xpAmount = Math.floor(minutesWatched * ENGAGEMENT_XP.WATCH_PER_MINUTE)
  const sourceId = `watch_stream_${streamId}_${Date.now()}`
  
  return await xpService.grantXP(
    userId,
    xpAmount,
    'watch_stream',
    sourceId,
    { stream_id: streamId, minutes: minutesWatched }
  )
}

/**
 * Award XP for chat message (with cooldown check)
 * +5 XP per message (30s cooldown)
 */
export async function awardChatMessageXP(userId: string, roomId: string) {
  const sourceId = `chat_message_${roomId}_${Date.now()}`
  
  return await xpService.grantXP(
    userId,
    ENGAGEMENT_XP.CHAT_MESSAGE,
    'chat_message',
    sourceId,
    { room_id: roomId }
  )
}

/**
 * Award XP for daily login
 * +25 XP first login per day
 */
export async function awardDailyLoginXP(userId: string) {
  const sourceId = `daily_login_${new Date().toISOString().split('T')[0]}_${userId}`
  
  return await xpService.grantXP(
    userId,
    ENGAGEMENT_XP.DAILY_LOGIN,
    'daily_login',
    sourceId,
    { date: new Date().toISOString().split('T')[0] }
  )
}

/**
 * Award XP for 7-day streak bonus
 * +150 XP bonus
 */
export async function award7DayStreakXP(userId: string, streakCount: number) {
  const sourceId = `streak_${streakCount}_${Date.now()}`
  
  return await xpService.grantXP(
    userId,
    ENGAGEMENT_XP.STREAK_7_DAY,
    '7day_streak',
    sourceId,
    { streak_count: streakCount }
  )
}

// ===========================
// STREAMING XP FUNCTIONS
// ===========================

/**
 * Award XP for going live
 * +200 XP for streams 10+ minutes
 */
export async function awardGoLiveXP(userId: string, streamId: string) {
  const sourceId = `go_live_${streamId}`
  
  const result = await xpService.grantXP(
    userId,
    STREAMING_XP.GO_LIVE_BASE,
    'go_live',
    sourceId,
    { stream_id: streamId }
  )

  if (result.success) {
    evaluateBadgesForUser(userId).catch(console.error)
  }

  return result
}

/**
 * Award XP for viewer minutes
 * +1 XP per viewer per minute
 */
export async function awardViewerMinuteXP(userId: string, viewerMinutes: number, streamId: string) {
  const xpAmount = Math.floor(viewerMinutes * STREAMING_XP.VIEWER_MINUTE)
  const sourceId = `viewer_minute_${streamId}_${Date.now()}`
  
  const result = await xpService.grantXP(
    userId,
    xpAmount,
    'viewer_minute',
    sourceId,
    { stream_id: streamId, viewer_minutes: viewerMinutes }
  )

  if (result.success) {
    evaluateBadgesForUser(userId).catch(console.error)
  }

  return result
}

/**
 * Award XP for receiving gifts as streamer
 * Base amount + bonus %
 */
export async function awardGiftReceivedXP(userId: string, coinAmount: number, streamId: string, metadata: any = {}) {
  const xpAmount = Math.floor(coinAmount * XP_RATES.STREAMER)
  const sourceId = `gift_received_${streamId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const result = await xpService.grantXP(
    userId,
    xpAmount,
    'gift_received',
    sourceId,
    { stream_id: streamId, coin_amount: coinAmount, ...metadata }
  )

  if (result.success) {
    evaluateBadgesForUser(userId, { giftAmount: coinAmount }).catch(console.error)
  }

  return result
}

// ===========================
// TROLL COURT XP FUNCTIONS
// ===========================

/**
 * Award XP for jury participation
 * +100 XP
 */
export async function awardJuryParticipationXP(userId: string, caseId: string) {
  const sourceId = `jury_${caseId}_${userId}`
  
  return await xpService.grantXP(
    userId,
    COURT_XP.JURY_PARTICIPATION,
    'jury_participation',
    sourceId,
    { case_id: caseId }
  )
}

/**
 * Award XP for ruling accepted
 * +250 XP
 */
export async function awardRulingAcceptedXP(userId: string, caseId: string) {
  const sourceId = `ruling_${caseId}_${userId}`
  
  return await xpService.grantXP(
    userId,
    COURT_XP.RULING_ACCEPTED,
    'ruling_accepted',
    sourceId,
    { case_id: caseId }
  )
}

/**
 * Award XP for helpful report
 * +150 XP
 */
export async function awardHelpfulReportXP(userId: string, reportId: string) {
  const sourceId = `report_${reportId}_${userId}`
  
  return await xpService.grantXP(
    userId,
    COURT_XP.HELPFUL_REPORT,
    'helpful_report',
    sourceId,
    { report_id: reportId }
  )
}

/**
 * Process Gift XP Logic (Server-Side)
 * Calls the process_gift_xp RPC which validates live status and awards XP idempotently.
 */
export async function processGiftXp(giftTxId: string, streamId: string | null = null) {
  if (!giftTxId) {
    console.error('[processGiftXp] Missing giftTxId');
    return { success: false };
  }

  const { data, error } = await supabase.rpc('process_gift_xp', {
    p_gift_tx_id: giftTxId,
    p_stream_id: streamId
  });

  if (error) {
    console.error('[processGiftXp] Error calling RPC:', error);
    return { success: false, error };
  }

  // Refresh badges for sender and receiver if we have their IDs
  // Note: RPC might not return IDs, but we can usually get them from the gift context if needed.
  // For now, let the backend handle XP and rely on frontend events for badge updates.
  
  return { success: true, data };
}

/**
 * Add to Millionaire Hall of Fame
 */
async function _addToMillionaireHallOfFame(senderId: string, receiverId: string, amount: number) {
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
