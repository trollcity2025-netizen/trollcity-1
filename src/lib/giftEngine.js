import { supabase } from './supabase'
import { deductCoins, addCoins } from './coinTransactions'
import giftCatalog, { giftCategories, tierPriority } from './giftCatalog'

const BROADCASTER_SHARE = 0.7
const PLATFORM_SHARE = 1 - BROADCASTER_SHARE
const INVENTORY_TABLE = 'gifts_owned'
const TRANSACTION_TABLE = 'gift_transactions'

export function getGiftCatalog() {
  return giftCatalog
}

export function getGiftCategories() {
  return giftCategories
}

export function getTierPriority() {
  return tierPriority
}

export function findGiftBySlug(giftSlug) {
  return giftCatalog.find((gift) => gift.gift_slug === giftSlug) || null
}

async function upsertInventory(userId, giftSlug, quantityDelta) {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TABLE)
      .select('quantity')
      .eq('user_id', userId)
      .eq('gift_slug', giftSlug)
      .maybeSingle()

    if (error) {
      console.warn('Gift inventory select failed', error)
      return null
    }

    if (data) {
      const updatedQuantity = Math.max(0, data.quantity + quantityDelta)
      if (updatedQuantity <= 0) {
        await supabase
          .from(INVENTORY_TABLE)
          .delete()
          .eq('user_id', userId)
          .eq('gift_slug', giftSlug)
      } else {
        await supabase
          .from(INVENTORY_TABLE)
          .update({
            quantity: updatedQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('gift_slug', giftSlug)
      }

      return updatedQuantity
    }

    if (quantityDelta > 0) {
      const timestamp = new Date().toISOString()
      const { error: insertError } = await supabase
        .from(INVENTORY_TABLE)
        .insert({
          user_id: userId,
          gift_slug: giftSlug,
          quantity: quantityDelta,
          created_at: timestamp,
          updated_at: timestamp
        })

      if (insertError) {
        console.warn('Failed to seed gift inventory', insertError)
        return null
      }

      return quantityDelta
    }

    return 0
  } catch (err) {
    console.warn('Inventory table unavailable', err)
    return null
  }
}

async function logGiftLedger(rows) {
  if (!rows.length) return

  try {
    await supabase.from(TRANSACTION_TABLE).insert(rows)
  } catch (err) {
    console.warn('Gift ledger unavailable', err)
  }
}

export async function purchaseGift({ userId, giftSlug, quantity = 1 }) {
  const gift = findGiftBySlug(giftSlug)
  if (!gift) {
    return { success: false, error: 'Gift not found' }
  }

  const totalCost = gift.coinCost * quantity
  const deduction = await deductCoins({
    userId,
    amount: totalCost,
    type: 'purchase',
    description: `Troll Gift: ${gift.name}`,
    metadata: { giftSlug, quantity }
  })

  if (!deduction.success) {
    return { success: false, error: deduction.error || 'Unable to deduct coins' }
  }

  const newQuantity = await upsertInventory(userId, giftSlug, quantity)

  return {
    success: true,
    gift,
    purchasedQuantity: quantity,
    inventoryQuantity: newQuantity ?? null,
    remainingBalance: deduction.newBalance
  }
}

export async function getUserInventory(userId) {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TABLE)
      .select('gift_slug,quantity')
      .eq('user_id', userId)

    if (error) {
      console.warn('Gift inventory load error', error)
      return []
    }

    if (!Array.isArray(data)) return []

    return data.map((row) => ({
      giftSlug: row.gift_slug,
      quantity: row.quantity,
      gift: findGiftBySlug(row.gift_slug)
    }))
  } catch (err) {
    console.warn('Gift inventory missing table', err)
    return []
  }
}

export async function sendGiftFromInventory({
  senderId,
  giftSlug,
  quantity = 1,
  receiverId,
  streamId = null,
  context = 'gift_tray'
}) {
  if (quantity <= 0) {
    return { success: false, error: 'Quantity must be positive' }
  }

  const gift = findGiftBySlug(giftSlug)
  if (!gift) {
    return { success: false, error: 'Gift not found' }
  }

  if (!senderId || !receiverId) {
    return { success: false, error: 'Sender or receiver missing' }
  }

  const inventory = await supabase
    .from(INVENTORY_TABLE)
    .select('quantity')
    .eq('user_id', senderId)
    .eq('gift_slug', giftSlug)
    .maybeSingle()

  const available = inventory?.quantity || 0
  if (available < quantity) {
    return { success: false, error: 'Not enough gifts' }
  }

  await upsertInventory(senderId, giftSlug, -quantity)

  const sentValue = gift.coinCost * quantity
  const broadcasterEarnings = Math.floor(sentValue * BROADCASTER_SHARE)
  const platformPortion = sentValue - broadcasterEarnings

  const ledgerRows = [
    {
      user_id: senderId,
      gift_slug: giftSlug,
      type: 'sent',
      quantity,
      coins_value: sentValue,
      target_id: receiverId,
      stream_id: streamId,
      description: gift.name,
      metadata: {
        giftSlug,
        context,
        animation: gift.animationType,
        tier: gift.tier,
        platform_share_percentage: PLATFORM_SHARE,
        broadcaster_share_percentage: BROADCASTER_SHARE,
        platform_coins: platformPortion,
        broadcaster_coins: broadcasterEarnings
      }
    }
  ]

  if (receiverId) {
    ledgerRows.push({
      user_id: receiverId,
      gift_slug: giftSlug,
      type: 'received',
      quantity,
      coins_value: broadcasterEarnings,
      target_id: senderId,
      stream_id: streamId,
      description: `Received ${gift.name}`,
      metadata: {
        giftSlug,
        context,
        animation: gift.animationType,
        tier: gift.tier,
        broadcaster_share_percentage: BROADCASTER_SHARE,
        sender_id: senderId
      }
    })
  }

  await logGiftLedger(ledgerRows)

  if (broadcasterEarnings > 0) {
    try {
      await addCoins({
        userId: receiverId,
        amount: broadcasterEarnings,
        type: 'gift_received',
        coinType: 'troll_coins',
        description: `Gift earnings: ${gift.name}`,
        metadata: {
          giftSlug,
          senderId,
          quantity,
          streamId,
          context
        }
      })
    } catch (err) {
      console.warn('Failed to credit broadcaster', err)
    }
  }

  return {
    success: true,
    gift,
    quantity,
    broadcasterEarnings,
    totalValue: sentValue
  }
}
