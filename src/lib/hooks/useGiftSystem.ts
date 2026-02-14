import { useState } from 'react'
import { supabase } from '../../lib/supabase'
// Removed progressionEngine import - using direct RPC calls instead
import { processGiftXp } from '../xp'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'

// import { generateUUID } from '../uuid'
// import { coinOptimizer } from '../coinRotation'

export interface GiftItem {
  id: string
  name: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
  category?: string
  subcategory?: string
  slug?: string
  currency?: 'troll_coins'
}

export function useGiftSystem(
  streamerId: string, 
  streamId: string | null, 
  activeBattleId?: string | null,
  receiverId?: string | null // Optional: specific receiver (for participant targeting)
) {
  const { user, profile, refreshProfile } = useAuthStore()
  const [isSending, setIsSending] = useState(false)
  
  const _toGiftSlug = (value?: string) => {
    if (!value) return 'gift'
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'gift'
  }

  const sendGift = async (gift: GiftItem, overrideReceiverId?: string): Promise<boolean | { success: boolean; bonus?: any }> => {
    const targetReceiverId = overrideReceiverId || receiverId || streamerId

    if (!user || !profile) {
      // Handle guest gifting
      if (streamerId && streamId) {
        const { data: _result, error: rpcError } = await supabase.rpc('send_guest_gift', {
          p_guest_id: streamerId, // Using streamerId as a temporary guest ID
          p_receiver_id: targetReceiverId,
          p_stream_id: streamId || null,
          p_gift_id: gift.id, // Pass the UUID
          p_cost: gift.coinCost,
          p_quantity: 1
        });

        if (rpcError) {
          throw rpcError;
        }

        return true;
      } else {
        toast.error('You must be logged in to send gifts.');
        return false;
      }
    }

    // Use receiverId if provided, otherwise fallback to streamerId

    // Validate balance based on gift type (paid or free)
    const _currency = gift.currency || 'troll_coins'
    
    let balance = 0
    if (gift.type === 'paid') {
      balance = (profile.troll_coins || 0)
    }

    if (balance < gift.coinCost) {
      toast.error(`Not enough Coins for this gift.`)
      return false
    }

    setIsSending(true)
    try {
      console.log('[GiftDebugger] Sending gift...', {
        sender: user.id,
        receiver: targetReceiverId,
        streamId: streamId || null,
        giftId: gift.id,
        cost: gift.coinCost,
        currentBalance: profile.troll_coins
      })

      // ✅ Standardized send_gift RPC
      // Handles cost calculation server-side, 95% credit to receiver, and transaction logging
      const { data: result, error: rpcError } = await supabase.rpc('send_gift', {
        p_stream_id: streamId,         // uuid
        p_recipient_id: targetReceiverId,     // uuid
        p_gift_id: gift.id,     // uuid
        p_quantity: 1           // integer
      });

      if (rpcError) {
        throw rpcError
      }

      if (!result?.success) {
        const message = result?.message || result?.error || 'Failed to send gift'
        toast.error(message)
        return false
      }

      console.log('[GiftDebugger] Success:', result)

      // ✅ Award XP and evaluate badges
      // The send_gift RPC handles coin transfers. We now call the server-side XP logic
      // using the transaction ID returned by the RPC.
      try {
        if (result.transaction_id) {
          await processGiftXp(result.transaction_id, streamId);
        }
      } catch (xpError) {
        console.error('[GiftDebugger] XP Award Error:', xpError);
      }

      // Refresh balance
      await refreshProfile()
      
      return { success: true, bonus: result }

    } catch (error: any) {
      console.error('[GiftDebugger] Error:', error)
      toast.error(error.message || 'Failed to send gift')
      return false
    } finally {
      setIsSending(false)
    }
  }

  return {
    sendGift,
    isSending
  }
}
