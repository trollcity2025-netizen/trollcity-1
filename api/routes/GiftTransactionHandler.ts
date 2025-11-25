import { getSupabaseAdmin } from '../lib/supabase'
const supabase = getSupabaseAdmin()

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
  let hasEnoughCoins = false

  // STEP 2: Verify correct balance type (paid or free)
  if (gift.type === 'paid') {
    hasEnoughCoins = paid_coin_balance >= gift.coinCost
  } else {
    hasEnoughCoins = free_coin_balance >= gift.coinCost
  }

  if (!hasEnoughCoins) {
    throw new Error('Not enough coins to send gift')
  }

  // STEP 3: Deduct coins from sender
  const updatedPaid = gift.type === 'paid'
    ? paid_coin_balance - gift.coinCost
    : paid_coin_balance

  const updatedFree = gift.type === 'free'
    ? free_coin_balance - gift.coinCost
    : free_coin_balance

  const { error: updateSenderError } = await supabase
    .from('user_profiles')
    .update({
      paid_coin_balance: updatedPaid,
      free_coin_balance: updatedFree,
    })
    .eq('id', senderId)

  if (updateSenderError) {
    console.error('Error updating sender coins', updateSenderError)
    throw new Error('Failed to update sender coin balance')
  }

  // STEP 4: Log gift transaction in 'gifts' table
  const { error: giftLogError } = await supabase
    .from('gifts')
    .insert({
      sender_id: senderId,
      receiver_id: streamerId,
      stream_id: streamId,
      coins_spent: gift.coinCost,
      gift_type: gift.type,
      message: gift.name,
    })

  if (giftLogError) {
    console.error('Error inserting gift log', giftLogError)
    throw new Error('Failed to log gift transaction')
  }

  // STEP 5: Add coin earnings to streamer
  const { data: streamerProfile, error: streamerError } = await supabase
    .from('user_profiles')
    .select('total_earned_coins')
    .eq('id', streamerId)
    .single()

  if (!streamerError && streamerProfile) {
    const newEarnings = (streamerProfile.total_earned_coins || 0) + gift.coinCost
    await supabase
      .from('user_profiles')
      .update({ total_earned_coins: newEarnings })
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
