import { Router } from 'express'
import { getSupabaseAdmin } from '../lib/supabase'
import { validateGiftNotAbusive, requireNotFrozen } from '../lib/protection.js'
import { handlePaidGiftRevenue } from '../lib/revenue.js'
import { deductCoins, addCoins } from '../../src/lib/coinTransactions.js'

const router = Router()
const supabase = getSupabaseAdmin()

// Middleware: require authentication
function requireAuth(req: any, res: any, next: any) {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.userId = userId
  next()
}

// Types used by your gift system
export interface GiftItem {
  id: string
  name: string
  icon: string
  coinCost: number
  type: 'paid' | 'free'
}

export interface HandleGiftParams {
  senderId: string
  senderUsername: string
  streamerId: string
  streamId: string
  gift: GiftItem
}

export async function giftTransactionHandler({
  senderId,
  senderUsername,
  streamerId,
  streamId,
  gift,
}: HandleGiftParams) {

  // STEP 0: Anti-abuse validation
  await validateGiftNotAbusive({
    sender_id: senderId,
    receiver_id: streamerId,
    coins: gift.coinCost
  })

  // STEP 1: FETCH sender's coin balances
  const { data: senderProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('paid_coin_balance, free_coin_balance')
    .eq('id', senderId)
    .single()

  if (profileError || !senderProfile) {
    console.error('Error fetching sender profile', profileError)
    throw new Error('Failed to fetch coin balance')
  }

  const { paid_coin_balance, free_coin_balance } = senderProfile

  // STEP 2: Verify correct balance type and deduct using centralized system
  const coinType = gift.type === 'paid' ? 'paid' : 'free'
  const currentBalance = gift.type === 'paid' ? paid_coin_balance : free_coin_balance

  if (currentBalance < gift.coinCost) {
    throw new Error('Not enough coins to send gift')
  }

  // STEP 3: Deduct coins from sender using centralized transaction system
  const deductResult = await deductCoins({
    userId: senderId,
    amount: gift.coinCost,
    type: 'gift_sent',
    coinType: coinType,
    metadata: {
      gift_name: gift.name,
      gift_id: gift.id,
      receiver_id: streamerId,
      stream_id: streamId
    }
  })

  if (!deductResult.success) {
    throw new Error(deductResult.error || 'Failed to deduct coins')
  }

  // STEP 4: Log gift transaction in 'gifts' table
  const { data: giftRecord, error: giftLogError } = await supabase
    .from('gifts')
    .insert({
      sender_id: senderId,
      receiver_id: streamerId,
      stream_id: streamId,
      coins_spent: gift.coinCost,
      gift_type: gift.type,
      message: gift.name,
    })
    .select()
    .single()

  if (giftLogError) {
    console.error('Error inserting gift log', giftLogError)
    throw new Error('Failed to log gift transaction')
  }

  // STEP 4.5: Handle paid gift revenue split (broadcaster earnings + platform cut)
  if (gift.type === 'paid') {
    await handlePaidGiftRevenue({
      sender_id: senderId,
      broadcaster_id: streamerId,
      coins: gift.coinCost,
      gift_id: giftRecord?.id
    })
  }

  // STEP 5: Add coin earnings to streamer
  const { data: streamerProfile, error: streamerError } = await supabase
    .from('user_profiles')
    .select('total_earned_coins, xp, level')
    .eq('id', streamerId)
    .single()

  if (!streamerError && streamerProfile) {
    const newEarnings = (streamerProfile.total_earned_coins || 0) + gift.coinCost
    
    // Add XP: 100 coins = 1 XP
    const xpGained = Math.floor(gift.coinCost / 100)
    const newXp = (streamerProfile.xp || 0) + xpGained
    const newLevel = Math.floor(newXp / 1000) + 1 // Every 1000 XP = 1 level
    
    await supabase
      .from('user_profiles')
      .update({ 
        total_earned_coins: newEarnings,
        xp: newXp,
        level: Math.min(newLevel, 100) // Cap at level 100
      })
      .eq('id', streamerId)
  }

  // STEP 6: Chat popup message (gift announcement)
  await supabase.from('messages').insert({
    user_id: senderId,
    stream_id: streamId,
    content: `Gift: ${gift.name}`,
    message_type: 'gift',
    gift_amount: gift.coinCost,
  })

  return {
    success: true,
    message: 'Gift sent successfully',
  }
}

// POST /api/gifts/send - Send a gift with protection middleware
router.post('/send', requireAuth, requireNotFrozen(), async (req, res) => {
  try {
    const userId = (req as any).userId // Set by requireAuth
    const { senderUsername, streamerId, streamId, gift } = req.body

    // Validate required fields
    if (!senderUsername || !streamerId || !streamId || !gift) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate gift object
    if (!gift.id || !gift.name || !gift.icon || gift.coinCost === undefined || !gift.type) {
      return res.status(400).json({ error: 'Invalid gift object' })
    }

    // Call the transaction handler
    const result = await giftTransactionHandler({
      senderId: userId,
      senderUsername,
      streamerId,
      streamId,
      gift,
    })

    res.json(result)
  } catch (error: any) {
    console.error('Gift send error:', error)
    res.status(500).json({ 
      error: error.message || 'Failed to send gift',
      success: false 
    })
  }
})

export default router
