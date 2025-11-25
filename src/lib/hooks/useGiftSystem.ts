import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { recordAppEvent } from '../../lib/progressionEngine'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'

interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
}

export function useGiftSystem(streamerId: string, streamId: string) {
  const { user } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendGift = async (gift: GiftItem) => {
    if (!user) { toast.error('You must be logged in to send gifts.'); return false }
    setIsSending(true)
    try {
      const { data, error } = await supabase.rpc('process_gift', {
        p_sender_id: user.id,
        p_streamer_id: streamerId,
        p_stream_id: streamId,
        p_gift_id: gift.id,
        p_gift_name: gift.name,
        p_coins_spent: gift.coinCost,
        p_gift_type: gift.type,
      })
      if (error) throw error
      toast.success(`Gift sent: ${gift.name}`)
      // Identity event hook — Gift sent
      try { await recordAppEvent(user.id, 'SENT_CHAOS_GIFT', { gift_id: gift.id, coins: gift.coinCost, stream_id: streamId, streamer_id: streamerId }) } catch {}
      return true
    } catch (err) {
      toast.error('Failed to send gift')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return { sendGift, isSending }
}
