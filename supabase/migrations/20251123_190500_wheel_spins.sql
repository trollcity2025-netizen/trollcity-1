import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'

interface GiftItem {
  id: string
  name: string
  icon: string
  coinCost: number
  type: 'paid' | 'free'
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

export function useGiftSystem(streamerId: string, streamId: string) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendGift = async (gift: GiftItem) => {
    if (!user || !profile) {
      toast.error('You must be logged in to send gifts.')
      return false
    }

    // Balance validation client-side (smoother UX)
    const balance =
      gift.type === 'paid'
        ? profile.paid_coin_balance
        : profile.free_coin_balance

    if (balance < gift.coinCost) {
      toast.error('Not enough coins for this gift.')
      return false
    }

    setIsSending(true)

    try {
      // PROCESS GIFT (via Supabase RPC)
      const { data, error } = await supabase.rpc('process_gift', {
        p_sender_id: profile.id,
        p_streamer_id: streamerId,
        p_stream_id: streamId,
        p_gift_id: gift.id,
        p_gift_name: gift.name,
        p_coins_spent: gift.coinCost,
        p_gift_type: gift.type,
      })

      if (error) throw error

      toast.success(`Gift sent: ${gift.name} ${gift.icon || '🎁'}`)

      // 🔥 Trigger live gift banner in stream
      await supabase.from('live_event_notifications').insert({
        stream_id: streamId,
        type: 'GIFT_SENT',
        message: `${profile.username} sent ${gift.name} ${gift.icon} to ${data?.streamer_username}!`,
        duration_seconds: 6,
      })

      // ⭐ Shock-drop rare gift chance (1 in 50)
      if (Math.random() < 0.02) {
        await createSpecialGiftDrop(profile.id, streamerId, streamId)
      }

      // 🎯 Auto-level streamer XP
      await supabase.rpc('update_streamer_xp', {
        p_streamer_id: streamerId,
        p_xp_amount: Math.floor(gift.coinCost / 5),
      })

      // 💾 Save gift to stream history
      await supabase.from('gift_history').insert({
        stream_id: streamId,
        sender_id: profile.id,
        recipient_id: streamerId,
        gift_id: gift.id,
        gift_name: gift.name,
        coin_cost: gift.coinCost,
        gift_type: gift.type,
      })

      return true
    } catch (err) {
      toast.error('Failed to send gift.')
      return false
    } finally {
      setIsSending(false)
    }
  }

  // ✨ Rare mythic drop handler
  const createSpecialGiftDrop = async (
    senderId: string,
    streamerId: string,
    streamId: string
  ) => {
    const rareList = [
      { name: 'VIVED Basketball', value: 5000, icon: '🏀' },
      { name: 'SAV Cat Scratch', value: 25000, icon: '🐾' },
      { name: 'Royal Troll Car', value: 100000, icon: '🚗' },
      { name: 'Million Coin Drop', value: 1000000, icon: '💰' },
    ]
    const reward = rareList[Math.floor(Math.random() * rareList.length)]

    await supabase.from('live_event_notifications').insert({
      stream_id: streamId,
      type: 'RARE_DROP',
      message: `🔥 ${profile.username} triggered a ${reward.name} ${reward.icon}! (${reward.value} Free Coins)`,
      duration_seconds: 8,
    })

    toast.success(`LEGENDARY DROP! ${reward.name} ${reward.icon}`, {
      duration: 6000,
    })
  }

  return { sendGift, isSending }
}
