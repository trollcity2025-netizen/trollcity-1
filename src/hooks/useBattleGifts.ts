import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export function useBattleGifts(battleId: string | null, receiverId: string) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendBattleGift = async (
    gift: { id: string; name: string; coinCost: number; type: 'paid' | 'free' }
  ): Promise<boolean> => {
    if (!battleId || !user || !profile) {
      toast.error('Battle not found')
      return false
    }

    // Check balance
    const balance = gift.type === 'paid' ? profile.paid_coin_balance : profile.free_coin_balance
    if (balance < gift.coinCost) {
      toast.error(`Insufficient ${gift.type === 'paid' ? 'paid' : 'free'} coins`)
      return false
    }

    setIsSending(true)
    try {
      // Deduct from sender
      if (gift.type === 'paid') {
        await supabase
          .from('user_profiles')
          .update({
            paid_coin_balance: (profile.paid_coin_balance || 0) - gift.coinCost,
            total_spent_coins: (profile.total_spent_coins || 0) + gift.coinCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      } else {
        await supabase
          .from('user_profiles')
          .update({
            free_coin_balance: (profile.free_coin_balance || 0) - gift.coinCost,
            total_spent_coins: (profile.total_spent_coins || 0) + gift.coinCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }

      // Add to receiver (only paid coins go to receiver's balance)
      if (gift.type === 'paid') {
        const { data: receiverProfile } = await supabase
          .from('user_profiles')
          .select('paid_coin_balance, total_earned_coins')
          .eq('id', receiverId)
          .single()

        if (receiverProfile) {
          await supabase
            .from('user_profiles')
            .update({
              paid_coin_balance: (receiverProfile.paid_coin_balance || 0) + gift.coinCost,
              total_earned_coins: (receiverProfile.total_earned_coins || 0) + gift.coinCost,
              updated_at: new Date().toISOString(),
            })
            .eq('id', receiverId)
        }
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

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'gift',
        transaction_type: 'battle_gift',
        coins_used: gift.coinCost,
        description: `Battle gift: ${gift.name}`,
        created_at: new Date().toISOString(),
      })

      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile)
      }

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

