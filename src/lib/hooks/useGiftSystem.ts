import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
// Removed progressionEngine import - using direct RPC calls instead
import { processGiftXp } from '../xp'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import { addCoins } from '../coinTransactions'

export interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
  category?: string
  slug?: string
}

export function useGiftSystem(
  streamerId: string, 
  streamId: string | null, 
  activeBattleId?: string | null,
  receiverId?: string | null // Optional: specific receiver (for participant targeting)
) {
  const { user, profile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)
  const comboRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 })
  const isUuid = (value?: string | null) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  const toGiftSlug = (value?: string) => {
    if (!value) return 'gift'
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift'
  }

  const sendGift = async (gift: GiftItem): Promise<boolean | { success: boolean; bonus?: any }> => {
    if (!user || !profile) { 
      toast.error('You must be logged in to send gifts.')
      return false 
    }

    // Use receiverId if provided, otherwise fallback to streamerId
    const targetReceiverId = receiverId || streamerId

    // Validate balance based on gift type (paid or free)
    const balance = gift.type === 'paid' 
      ? (profile.troll_coins || 0)
      : (profile.troll_coins || 0)

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
        const giftId = (spendResult as any)?.gift_id
        const giftSlug =
          gift.slug ||
          (typeof gift.id === 'string' && !isUuid(gift.id) ? gift.id : null) ||
          toGiftSlug(gift.name)
        if (!isUuid(giftId)) {
          console.warn('Skipping gift context update; invalid gift_id from RPC', giftId)
        } else {
        // Update the gift record with stream/battle context if needed
        // The RPC creates the gift, but we can enhance it with stream context
        const { error: giftUpdateError } = await supabase
          .from('gifts')
          .update({
            stream_id: streamId,
            battle_id: activeBattleId || null,
            gift_slug: giftSlug,
          })
          .eq('id', giftId)
          .limit(1)

        // If update fails, it's not critical - the gift was already sent
        if (giftUpdateError) {
          console.warn('Could not update gift with stream context:', giftUpdateError)
        }
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

      const now = Date.now()
      const withinWindow = now - comboRef.current.lastTime <= 10000
      const newCount = withinWindow ? comboRef.current.count + 1 : 1
      comboRef.current = { count: newCount, lastTime: now }

      let comboCashback = 0
      if (gift.coinCost >= 2000) {
        comboCashback = Math.floor(gift.coinCost * 0.05)
      } else if (newCount >= 20) {
        comboCashback = Math.floor(gift.coinCost * 1.5)
      }

      if (comboCashback > 0) {
        try {
          const { success } = await addCoins({
            userId: user.id,
            amount: comboCashback,
            type: 'reward',
            coinType: 'troll_coins',
            description: gift.coinCost >= 2000 ? 'High value gift cashback' : 'Gift combo cashback',
            metadata: {
              gift_id: (spendResult as any)?.gift_id || null,
              combo_count: newCount,
              gift_value: gift.coinCost
            }
          })
          if (success) {
            toast.success(`Bonus: +${comboCashback} coins`)
          }
        } catch (comboErr) {
          console.warn('Combo cashback failed', comboErr)
        }
      }

      // Troll Pass 5% gift bonus (cashback to sender in troll_coins)
      try {
        const tpExpire = (updatedProfile || profile)?.troll_pass_expires_at
        const isTrollPassActive = tpExpire && new Date(tpExpire) > new Date()
        if (isTrollPassActive) {
          const bonusAmount = Math.floor(gift.coinCost * 0.05)
          if (bonusAmount > 0) {
            const { success } = await addCoins({
              userId: user.id,
              amount: bonusAmount,
              type: 'reward',
              coinType: 'troll_coins',
              description: 'Troll Pass 5% gift bonus',
              metadata: {
                gift_id: (spendResult as any)?.gift_id || null,
                bonus_pct: 5,
                source: 'troll_pass'
              }
            })
            if (success) {
              const { data: refreshedProfile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle()
              if (refreshedProfile) {
                useAuthStore.getState().setProfile(refreshedProfile as any)
              }
              toast.success(`🎟️ Troll Pass bonus: +${bonusAmount} coins`)
            }
          }
        }
      } catch (bonusErr) {
        console.warn('Troll Pass bonus failed', bonusErr)
      }
      
      toast.success(`Gift sent: ${gift.name}`)
      
      try {
        if (gift.category === 'Family') {
          const { data: streamerMember } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', streamerId)
            .maybeSingle()

          const familyId = streamerMember?.family_id || null
          if (familyId) {
            const { data: activeWar } = await supabase
              .from('family_wars')
              .select('*')
              .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
              .in('status', ['pending', 'active'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (activeWar?.id) {
              const points = Math.max(1, Math.round(gift.coinCost / 100))
              await supabase
                .from('family_war_scores')
                .upsert({
                  war_id: activeWar.id,
                  family_id: familyId,
                  score: points,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'war_id,family_id' })
              
              // XP = war_points / 5
              const familyXp = Math.max(1, Math.round(points / 5))
              
              await supabase.rpc('increment_family_stats', {
                p_family_id: familyId,
                p_coin_bonus: Math.round(gift.coinCost * 0.05),
                p_xp_bonus: familyXp
              })
            }
          }
        }
      } catch (warErr) {
        console.warn('Family war gift handling failed', warErr)
      }
      
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
        
        // Process XP for Gifter and Streamer (New Logic)
        const { senderResult } = await processGiftXp(user.id, targetReceiverId, gift.coinCost)
        
        if (senderResult?.leveledUp) {
          toast.success(`🎉 Level Up! You reached Level ${senderResult.newLevel}!`)
          // Trigger badge toast if needed handled in processGiftXp via db, but UI toast here is good
        }
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
