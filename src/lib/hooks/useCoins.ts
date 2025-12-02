import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { toast } from 'sonner'

interface CoinBalance {
  paid_coin_balance: number
  free_coin_balance: number
  total_earned_coins: number
  total_spent_coins: number
}

interface SpendCoinsParams {
  senderId: string
  receiverId?: string // Optional - if not provided, coins are just deducted (e.g., wheel, effects)
  amount: number
  source: 'gift' | 'wheel' | 'badge' | 'entrance_effect' | 'boost' | 'purchase' | 'bonus' | 'payroll'
  item?: string // Optional item name (e.g., 'TrollRose', 'Wheel Spin', 'VIP Badge')
}

/**
 * Unified coin management hook
 * 
 * Provides:
 * - Real-time coin balance fetching
 * - Secure coin spending via RPC
 * - Balance refresh after operations
 * - Error handling
 */
export function useCoins() {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current balances from profile
  const balances: CoinBalance = {
    paid_coin_balance: profile?.paid_coin_balance || 0,
    free_coin_balance: profile?.free_coin_balance || 0,
    total_earned_coins: profile?.total_earned_coins || 0,
    total_spent_coins: profile?.total_spent_coins || 0,
  }

  /**
   * Refresh coin balances from database
   * Call this after any coin operation to ensure UI is in sync
   */
  const refreshCoins = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance, total_earned_coins, total_spent_coins')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        console.error('Error refreshing coins:', fetchError)
        return
      }

      if (data) {
        // Update auth store profile
        const currentProfile = useAuthStore.getState().profile
        if (currentProfile) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            paid_coin_balance: data.paid_coin_balance || 0,
            free_coin_balance: data.free_coin_balance || 0,
            total_earned_coins: data.total_earned_coins || 0,
            total_spent_coins: data.total_spent_coins || 0,
          })
        }
      }
    } catch (err: any) {
      console.error('Unexpected error refreshing coins:', err)
    }
  }, [user?.id])

  /**
   * Spend coins via secure RPC
   * 
   * This is the ONLY way coins should be deducted in the frontend.
   * All coin spending (gifts, wheel, badges, effects) must go through this.
   * 
   * @param params - Spending parameters
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  const spendCoins = useCallback(async (params: SpendCoinsParams): Promise<boolean> => {
    if (!user?.id || !profile) {
      toast.error('You must be logged in to spend coins')
      return false
    }

    // Validate balance
    if (balances.paid_coin_balance < params.amount) {
      toast.error('Not enough coins!')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // Call spend_coins RPC
      // If receiverId is not provided, the RPC will only deduct from sender
      // (useful for wheel spins, badges, effects where coins are consumed)
      const { data, error: rpcError } = await supabase.rpc('spend_coins', {
        p_sender_id: params.senderId,
        p_receiver_id: params.receiverId || params.senderId, // If no receiver, use sender (coins consumed)
        p_coin_amount: params.amount,
        p_source: params.source,
        p_item: params.item || params.source,
      })

      if (rpcError) {
        console.error('Error spending coins:', rpcError)
        
        // Check if it's a "not enough coins" error
        if (rpcError.message?.includes('Not enough coins') || rpcError.message?.includes('insufficient')) {
          toast.error('Not enough coins!')
        } else {
          toast.error(rpcError.message || 'Failed to spend coins')
        }
        
        setError(rpcError.message || 'Failed to spend coins')
        return false
      }

      // Check if RPC returned an error in the response
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        const errorMsg = (data as any).error || 'Failed to spend coins'
        
        if (errorMsg.includes('Not enough coins')) {
          toast.error('Not enough coins!')
        } else {
          toast.error(errorMsg)
        }
        
        setError(errorMsg)
        return false
      }

      // Refresh balances after successful spend
      await refreshCoins()

      return true
    } catch (err: any) {
      console.error('Unexpected error spending coins:', err)
      const errorMsg = err.message || 'Failed to spend coins'
      toast.error(errorMsg)
      setError(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile, balances.paid_coin_balance, refreshCoins])

  // Set up real-time subscription for coin balance updates
  useEffect(() => {
    if (!user?.id) return

    // Initial refresh
    refreshCoins()

    // Subscribe to coin_transactions table for real-time updates
    const channel = supabase
      .channel('coin-balance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coin_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh balances when a new transaction is created
          refreshCoins()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Update local state when profile is updated
          const updatedProfile = payload.new as any
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile) {
            useAuthStore.getState().setProfile({
              ...currentProfile,
              paid_coin_balance: updatedProfile.paid_coin_balance || currentProfile.paid_coin_balance,
              free_coin_balance: updatedProfile.free_coin_balance || currentProfile.free_coin_balance,
              total_earned_coins: updatedProfile.total_earned_coins || currentProfile.total_earned_coins,
              total_spent_coins: updatedProfile.total_spent_coins || currentProfile.total_spent_coins,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, refreshCoins])

  return {
    balances,
    loading,
    error,
    refreshCoins,
    spendCoins,
    // Convenience getters
    paidCoins: balances.paid_coin_balance,
    freeCoins: balances.free_coin_balance,
    totalEarned: balances.total_earned_coins,
    totalSpent: balances.total_spent_coins,
  }
}

