import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'

export function useBattleGifts(battleId: string | null, receiverId: string) {
  const { user, profile } = useAuthStore()
  const { spendCoins } = useCoins()
  const [isSending, setIsSending] = useState(false)

  const sendBattleGift = async (
    gift: { id: string; name: string; coinCost: number; type: 'paid' | 'free' }
  ): Promise<boolean> => {
    if (!battleId || !user || !profile) {
      toast.error('Battle not found')
      return false
    }

    setIsSending(true)
    try {
      // Use the spendCoins function to properly deduct and transfer coins
      const success = await spendCoins({
        senderId: user.id,
        receiverId: receiverId,
        amount: gift.coinCost,
        source: 'gift',
        item: gift.name,
      })

      if (!success) {
        return false
      }

      // Record battle gift
      await supabase.from('battle_gifts').insert({
        battle_id: battleId,
        sender_id: user.id,
        receiver_id: receiverId,
        coins_spent: gift.coinCost,
        gift_type: gift.type,
        gift_name: gift.name,
        message: gift.name,
      })

      toast.success(`Sent ${gift.name} gift!`)
      return true
    } catch (error: any) {
      console.error('Error sending battle gift:', error)
      toast.error('Failed to send gift')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return { sendBattleGift, isSending }
}

