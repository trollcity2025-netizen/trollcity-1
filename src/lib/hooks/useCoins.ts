import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { UserProfile } from '../supabase'
import { toast } from 'sonner'

interface CoinBalance {
  troll_coins_balance: number
  free_coin_balance: number
  total_earned_coins: number
  total_spent_coins: number
}

const getPaidBalanceFromProfile = (profile?: Partial<UserProfile> | null) => {
  if (!profile) return undefined
  if (typeof profile.troll_coins === 'number') return profile.troll_coins
  if (typeof profile.troll_coins_balance === 'number') return profile.troll_coins_balance
  return undefined
}

const getFreeBalanceFromProfile = (profile?: Partial<UserProfile> | null) => {
  if (!profile) return undefined
  if (typeof profile.trollmonds === 'number') return profile.trollmonds
  if (typeof profile.free_coin_balance === 'number') return profile.free_coin_balance
  return undefined
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
  const [balances, setBalances] = useState<CoinBalance>({
    troll_coins_balance: (profile?.troll_coins || profile?.troll_coins_balance) || 0,
    free_coin_balance: (profile?.trollmonds || profile?.free_coin_balance) || 0,
    total_earned_coins: profile?.total_earned_coins || 0,
    total_spent_coins: profile?.total_spent_coins || 0,
  })

  /**
   * Refresh coin balances from database
   * Call this after any coin operation to ensure UI is in sync
   */
  const refreshCoins = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error loading profile balances:', profileError)
      }

      const currentProfile = useAuthStore.getState().profile
      const paidBalance =
        getPaidBalanceFromProfile(profileData) ??
        getPaidBalanceFromProfile(currentProfile) ??
        0
      const freeBalance =
        getFreeBalanceFromProfile(profileData) ??
        getFreeBalanceFromProfile(currentProfile) ??
        0
      const nextTotals = {
        total_earned_coins:
          profileData?.total_earned_coins ??
          currentProfile?.total_earned_coins ??
          0,
        total_spent_coins:
          profileData?.total_spent_coins ??
          currentProfile?.total_spent_coins ??
          0,
      }

      const nextBalances = {
        troll_coins_balance: paidBalance,
        free_coin_balance: freeBalance,
        total_earned_coins: nextTotals.total_earned_coins,
        total_spent_coins: nextTotals.total_spent_coins,
      }

      setBalances((prev) => {
        const isSame =
          prev.troll_coins_balance === nextBalances.troll_coins_balance &&
          prev.free_coin_balance === nextBalances.free_coin_balance &&
          prev.total_earned_coins === nextBalances.total_earned_coins &&
          prev.total_spent_coins === nextBalances.total_spent_coins

        return isSame ? prev : nextBalances
      })

      if (currentProfile) {
        const profileNeedsUpdate =
          currentProfile.troll_coins_balance !== paidBalance ||
          currentProfile.free_coin_balance !== freeBalance ||
          currentProfile.troll_coins !== paidBalance ||
          currentProfile.trollmonds !== freeBalance ||
          currentProfile.total_earned_coins !== nextTotals.total_earned_coins ||
          currentProfile.total_spent_coins !== nextTotals.total_spent_coins

        if (profileNeedsUpdate) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            troll_coins_balance: paidBalance,
            free_coin_balance: freeBalance,
            troll_coins: paidBalance,
            trollmonds: freeBalance,
            total_earned_coins: nextTotals.total_earned_coins,
            total_spent_coins: nextTotals.total_spent_coins,
          } as UserProfile)
        }
      }
    } catch (err: any) {
      console.error('Unexpected error refreshing coins:', err)
      setError(err.message || 'Failed to refresh coins')
    } finally {
      setLoading(false)
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
    if (!user?.id) {
      toast.error('You must be logged in to spend coins')
      return false
    }

    // Validate balance
    if (balances.troll_coins_balance < params.amount) {
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
  }, [user?.id, balances.troll_coins_balance, refreshCoins])

  // Set up real-time subscription for coin balance updates
  useEffect(() => {
    if (!user?.id) return

    refreshCoins()

    const coinChannel = supabase
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
          refreshCoins()
        }
      )
      .subscribe()

    const profileChannel = supabase
      .channel('profile-balance-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new as any
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile) {
            useAuthStore.getState().setProfile({
              ...currentProfile,
              total_earned_coins:
                updatedProfile.total_earned_coins || currentProfile.total_earned_coins,
              total_spent_coins:
                updatedProfile.total_spent_coins || currentProfile.total_spent_coins,
            } as UserProfile)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(coinChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [user?.id, refreshCoins])

  return {
    balances,
    loading,
    error,
    refreshCoins,
    spendCoins,
    // Convenience getters
    troll_coins: balances.troll_coins_balance,
    trollmonds: balances.free_coin_balance,
    totalEarned: balances.total_earned_coins,
    totalSpent: balances.total_spent_coins,
  }
}
