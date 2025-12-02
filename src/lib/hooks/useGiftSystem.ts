import { useState } from 'react'
import { supabase } from '../../lib/supabase'
// Removed progressionEngine import - using direct RPC calls instead
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import { applyGiftToBattle } from '../../lib/battleHelpers'

interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
}

export function useGiftSystem(
  streamerId: string, 
  streamId: string | null, 
  activeBattleId?: string | null,
  receiverId?: string | null // Optional: specific receiver (for participant targeting)
) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)

  const sendGift = async (gift: GiftItem): Promise<boolean | { success: boolean; bonus?: any }> => {
    if (!user || !profile) { 
      toast.error('You must be logged in to send gifts.')
      return false 
    }

    // Use receiverId if provided, otherwise fallback to streamerId
    const targetReceiverId = receiverId || streamerId

    // Validate balance based on gift type (paid or free)
    const balance = gift.type === 'paid' 
      ? (profile.paid_coin_balance || 0)
      : (profile.free_coin_balance || 0)

    if (balance < gift.coinCost) {
      toast.error(`Not enough ${gift.type} coins for this gift.`)
      return false
    }

    setIsSending(true)
    try {
      // ✅ REAL COIN LOGIC: Use spend_coins RPC for all gift sending
      // This replaces the old fake direct database updates
      // The RPC handles: balance deduction, receiver credit, gift record, transaction log
      const { data: spendResult, error: spendError } = await supabase.rpc('spend_coins', {
        p_sender_id: user.id,
        p_receiver_id: targetReceiverId,
        p_coin_amount: gift.coinCost,
        p_source: 'gift',
        p_item: gift.name,
      })

      if (spendError) {
        throw spendError
      }

      // Check if RPC returned an error
      if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !spendResult.success) {
        const errorMsg = (spendResult as any).error || 'Failed to send gift'
        throw new Error(errorMsg)
      }

      // If streamId is provided, also insert gift record with stream/battle context
      // (spend_coins RPC already creates a gift record, but we may need stream_id/battle_id)
      if (streamId && streamId !== 'profile-gift' && streamId !== 'null') {
        // Update the gift record with stream/battle context if needed
        // The RPC creates the gift, but we can enhance it with stream context
        const { error: giftUpdateError } = await supabase
          .from('gifts')
          .update({
            stream_id: streamId,
            battle_id: activeBattleId || null,
          })
          .eq('id', (spendResult as any)?.gift_id)
          .limit(1)

        // If update fails, it's not critical - the gift was already sent
        if (giftUpdateError) {
          console.warn('Could not update gift with stream context:', giftUpdateError)
        }
      }
      
      // Refresh sender's profile from database to get accurate balance
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      }
      
      toast.success(`Gift sent: ${gift.name}`)
      
      // Check for gift bonus milestones
      let bonusInfo = null
      try {
        const { data: bonusData, error: bonusError } = await supabase.rpc('handle_gift_bonus', {
          p_sender_id: user.id,
        })
        
        if (!bonusError && bonusData?.bonus_awarded) {
          bonusInfo = bonusData
          // Refresh profile to get updated free coin balance
          const { data: refreshedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (refreshedProfile) {
            useAuthStore.getState().setProfile(refreshedProfile as any)
          }
        }
      } catch (bonusErr) {
        console.error('Error checking gift bonus:', bonusErr)
      }
      
      // Identity event hook — Gift sent
      try {
        await supabase.rpc('record_dna_event', {
          p_user_id: user.id,
          p_event_type: 'SENT_CHAOS_GIFT',
          p_event_data: {
            gift_id: gift.id,
            coins: gift.coinCost,
            stream_id: streamId,
            streamer_id: streamerId
          }
        })
        // Add XP for sending gift (1 XP per 50 coins, minimum 1)
        await supabase.rpc('add_xp', {
          p_user_id: user.id,
          p_amount: Math.max(1, Math.floor(gift.coinCost / 50)),
          p_reason: 'gift_sent'
        })
      } catch (err) {
        console.error('Error recording gift event:', err)
      }
      
      // Return bonus info if awarded, otherwise return true
      if (bonusInfo) {
        return { success: true, bonus: bonusInfo }
      }
      return true
    } catch (err) {
      console.error('Gift send error:', err)
      toast.error('Failed to send gift')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return { sendGift, isSending }
}
