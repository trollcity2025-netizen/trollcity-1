import { useState, useEffect, useCallback } from 'react'
import { supabase, ensureSupabaseSession, UserProfile } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

interface Trollcoins {
  troll_coins: number
  paid_coins: number
  total_earned_coins: number
  total_spent_coins: number
  earned_balance: number
}

interface SpendCoinsParams {
  senderId: string
  receiverId?: string // Optional - if not provided, coins are just deducted (e.g., wheel, effects)
  amount: number
  source: 'gift' | 'wheel' | 'badge' | 'entrance_effect' | 'boost' | 'purchase' | 'bonus' | 'payroll' | 'mai_talent_vote' | 'church_gift'
  item?: string // Optional item name (e.g., 'TrollRose', 'Wheel Spin', 'VIP Badge')
  idempotencyKey?: string // Optional idempotency key for preventing double-spending on retries
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
  const [balances, setBalances] = useState<Trollcoins>({
    troll_coins: profile?.troll_coins ?? 0,
    paid_coins: profile?.paid_coins ?? 0,
    total_earned_coins: profile?.total_earned_coins || 0,
    total_spent_coins: profile?.total_spent_coins || 0,
    earned_balance: profile?.earned_balance || 0,
  })
  const [optimisticUntil, setOptimisticUntil] = useState<number | null>(null)
  const [optimisticTroll, setOptimisticTroll] = useState<number | null>(null)

  // Sync balances with profile from AuthStore to ensure UI stays in sync across components
  useEffect(() => {
    if (profile) {
      setBalances({
        troll_coins: profile.troll_coins ?? 0,
        paid_coins: profile.paid_coins ?? 0,
        total_earned_coins: profile.total_earned_coins || 0,
        total_spent_coins: profile.total_spent_coins || 0,
        earned_balance: profile.earned_balance || 0,
      })
    }
  }, [profile, profile?.troll_coins, profile?.paid_coins, profile?.total_earned_coins, profile?.total_spent_coins, profile?.earned_balance])

  /**
   * Refresh coin balances from database
   * Call this after any coin operation to ensure UI is in sync
   */
  const refreshCoins = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      await ensureSupabaseSession(supabase)

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('troll_coins, paid_coins, total_earned_coins, total_spent_coins, earned_balance')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error loading profile balances:', profileError)
      }

      const currentProfile = useAuthStore.getState().profile
      // Get balance from database first, fall back to local store
      // This ensures we always use the most recent balance from the database
      const dbBalance = profileData?.troll_coins ?? null
      const localBalance = currentProfile?.troll_coins ?? null
      
      // Use database balance if available, otherwise use local balance
      const paidBalance = dbBalance !== null ? dbBalance : (localBalance ?? 0)
      
      // Only use optimistic balance if it's less than or equal to the database balance
      // (optimistic deductions should be reflected immediately)
      const mergedPaid =
        optimisticUntil && Date.now() < optimisticUntil && (optimisticTroll ?? 0) > 0 && (optimisticTroll ?? 0) <= paidBalance
          ? (optimisticTroll as number)
          : paidBalance
      
      console.log('[refreshCoins] Balance sync:', { dbBalance, localBalance, paidBalance, mergedPaid })
      const nextTotals = {
        total_earned_coins:
          profileData?.total_earned_coins ??
          currentProfile?.total_earned_coins ??
          0,
        total_spent_coins:
          profileData?.total_spent_coins ??
          currentProfile?.total_spent_coins ??
          0,
        earned_balance:
          profileData?.earned_balance ??
          currentProfile?.earned_balance ??
          0,
      }

      const nextBalances = {
        troll_coins: mergedPaid,
        paid_coins: profileData?.paid_coins ?? currentProfile?.paid_coins ?? 0,
        total_earned_coins: nextTotals.total_earned_coins,
        total_spent_coins: nextTotals.total_spent_coins,
        earned_balance: nextTotals.earned_balance,
      }

      setBalances((prev) => {
        const isSame =
          prev.troll_coins === nextBalances.troll_coins &&
          prev.paid_coins === nextBalances.paid_coins &&
          prev.total_earned_coins === nextBalances.total_earned_coins &&
          prev.total_spent_coins === nextBalances.total_spent_coins &&
          prev.earned_balance === nextBalances.earned_balance

        return isSame ? prev : nextBalances
      })

      if (currentProfile) {
        const profileNeedsUpdate =
          currentProfile.troll_coins !== mergedPaid ||
          currentProfile.total_earned_coins !== nextTotals.total_earned_coins ||
          currentProfile.total_spent_coins !== nextTotals.total_spent_coins ||
          currentProfile.earned_balance !== nextTotals.earned_balance

          if (profileNeedsUpdate) {
            const updatedProfile: UserProfile = {
              ...currentProfile,
              troll_coins: mergedPaid as number,
              total_earned_coins: nextTotals.total_earned_coins,
              total_spent_coins: nextTotals.total_spent_coins,
              earned_balance: nextTotals.earned_balance,
            }
            useAuthStore.getState().setProfile(updatedProfile)
          }
      }
      if (optimisticUntil && Date.now() < optimisticUntil && (mergedPaid as number) >= (optimisticTroll ?? 0)) {
        setOptimisticUntil(null)
        setOptimisticTroll(null)
      }
    } catch (err: any) {
      console.error('Unexpected error refreshing coins:', err)
      setError(err.message || 'Failed to refresh coins')
    } finally {
      setLoading(false)
    }
  }, [user?.id, optimisticUntil, optimisticTroll])

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
    if (balances.troll_coins < params.amount) {
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
        p_idempotency_key: params.idempotencyKey || null,
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
  }, [user?.id, balances.troll_coins, refreshCoins])

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
          console.log('Real-time coin transaction received! Refreshing coins.');
          toast.info('Coin transaction received! Refreshing...');
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


          const newProfileData = payload.new as any
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile) {
            const candidate =
              typeof newProfileData.troll_coins === 'number'
                ? newProfileData.troll_coins
                : currentProfile.troll_coins
            const shouldKeepOptimistic =
              optimisticUntil &&
              Date.now() < optimisticUntil &&
              (optimisticTroll ?? balances.troll_coins) > candidate
            const nextEarned =
              typeof newProfileData.total_earned_coins === 'number'
                ? newProfileData.total_earned_coins
                : currentProfile.total_earned_coins
            const nextSpent =
              typeof newProfileData.total_spent_coins === 'number'
                ? newProfileData.total_spent_coins
                : currentProfile.total_spent_coins
            const nextEarnedBalance =
              typeof newProfileData.earned_balance === 'number'
                ? newProfileData.earned_balance
                : currentProfile.earned_balance
            const updatedProfile: UserProfile = {
              ...currentProfile,
              troll_coins: shouldKeepOptimistic
                ? (optimisticTroll ?? balances.troll_coins)
                : Number(candidate ?? currentProfile.troll_coins),
              total_earned_coins: nextEarned,
              total_spent_coins: nextSpent,
              earned_balance: nextEarnedBalance,
            }
            useAuthStore.getState().setProfile(updatedProfile)
            setBalances((prev) => ({
              paid_coins: prev.paid_coins,
              troll_coins: shouldKeepOptimistic
                ? (optimisticTroll ?? prev.troll_coins)
                : (typeof updatedProfile.troll_coins === 'number'
                    ? updatedProfile.troll_coins
                    : prev.troll_coins),
              total_earned_coins:
                typeof updatedProfile.total_earned_coins === 'number'
                  ? updatedProfile.total_earned_coins
                  : prev.total_earned_coins,
              total_spent_coins:
                typeof updatedProfile.total_spent_coins === 'number'
                  ? updatedProfile.total_spent_coins
                  : prev.total_spent_coins,
              earned_balance:
                typeof updatedProfile.earned_balance === 'number'
                  ? updatedProfile.earned_balance
                  : prev.earned_balance,
            }))
            if (!shouldKeepOptimistic && optimisticUntil) {
              setOptimisticUntil(null)
              setOptimisticTroll(null)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(coinChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [user?.id, refreshCoins, optimisticUntil, optimisticTroll, balances.troll_coins])

  const optimisticCredit = useCallback((delta: number) => {
    if (!user?.id) return
    if (!Number.isFinite(delta) || delta <= 0) return
    const currentProfile = useAuthStore.getState().profile
    const base = currentProfile?.troll_coins ?? balances.troll_coins
    const next = base + delta
    setBalances((prev) => ({ ...prev, troll_coins: next }))
    if (currentProfile) {
      const updatedProfile: UserProfile = {
        ...currentProfile,
        troll_coins: next,
      }
      useAuthStore.getState().setProfile(updatedProfile)
    }
    setOptimisticTroll(next)
    setOptimisticUntil(Date.now() + 8000)
  }, [user?.id, balances.troll_coins])

  const optimisticDebit = useCallback((delta: number) => {
    if (!user?.id) return
    if (!Number.isFinite(delta) || delta <= 0) return
    const currentProfile = useAuthStore.getState().profile
    const base = currentProfile?.troll_coins ?? balances.troll_coins
    const next = base - delta
    setBalances((prev) => ({ ...prev, troll_coins: next }))
    if (currentProfile) {
      const updatedProfile: UserProfile = {
        ...currentProfile,
        troll_coins: next,
      }
      useAuthStore.getState().setProfile(updatedProfile)
    }
    setOptimisticTroll(next)
    setOptimisticUntil(Date.now() + 8000)
  }, [user?.id, balances.troll_coins])

  return {
    balances,
    loading,
    error,
    refreshCoins,
    spendCoins,
    optimisticCredit,
    optimisticDebit,
    // Convenience getters
    troll_coins: balances.troll_coins,
    totalEarned: balances.total_earned_coins,
    totalSpent: balances.total_spent_coins,
    earned_balance: balances.earned_balance,
  }
}
