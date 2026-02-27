import { useState, useEffect, useCallback } from 'react'
import { supabase, ensureSupabaseSession } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

interface TrollzBalances {
  trollz_balance: number
  bonus_coin_balance: number
  troll_coin_balance: number
}

interface SpinResult {
  success: boolean
  spin_cost: number
  reward_type: string
  reward_amount: number
  new_trollz_balance: number
  new_bonus_balance: number
  error?: string
}

interface ConversionResult {
  success: boolean
  trollz_spent: number
  coins_awarded: number
  new_trollz_balance: number
  new_bonus_balance: number
  error?: string
}

/**
 * Unified Trollz and Bonus Coin management hook
 * 
 * Provides:
 * - Real-time balance fetching
 * - Wheel spinning functionality
 * - Trollz to coin conversion
 * - Balance refresh after operations
 */
export function useTrollz() {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<TrollzBalances>({
    trollz_balance: profile?.trollz_balance ?? 0,
    bonus_coin_balance: profile?.bonus_coin_balance ?? 0,
    troll_coin_balance: profile?.troll_coins ?? 0,
  })
  const [spinning, setSpinning] = useState(false)
  const [converting, setConverting] = useState(false)

  // Sync balances with profile from AuthStore
  useEffect(() => {
    if (profile) {
      setBalances({
        trollz_balance: profile.trollz_balance ?? 0,
        bonus_coin_balance: profile.bonus_coin_balance ?? 0,
        troll_coin_balance: profile.troll_coins ?? 0,
      })
    }
  }, [profile, profile?.trollz_balance, profile?.bonus_coin_balance, profile?.troll_coins])

  /**
   * Refresh Trollz balances from database
   */
  const refreshBalances = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      await ensureSupabaseSession(supabase)

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('trollz_balance, bonus_coin_balance, troll_coins')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error loading profile balances:', profileError)
      }

      const currentProfile = useAuthStore.getState().profile
      
      setBalances({
        trollz_balance: profileData?.trollz_balance ?? currentProfile?.trollz_balance ?? 0,
        bonus_coin_balance: profileData?.bonus_coin_balance ?? currentProfile?.bonus_coin_balance ?? 0,
        troll_coin_balance: profileData?.troll_coins ?? currentProfile?.troll_coins ?? 0,
      })

      // Also update the auth store
      if (profileData) {
        useAuthStore.setState({
          profile: {
            ...currentProfile,
            trollz_balance: profileData.trollz_balance,
            bonus_coin_balance: profileData.bonus_coin_balance,
          }
        })
      }
    } catch (err) {
      console.error('Error refreshing balances:', err)
      setError('Failed to refresh balances')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  /**
   * Spin the Troll Wheel
   * Cost: 100 Trollz per spin
   * Returns: SpinResult with reward details
   */
  const spinWheel = useCallback(async (): Promise<SpinResult | null> => {
    if (!user?.id) {
      toast.error('Please log in to spin the wheel')
      return null
    }

    if (spinning) {
      return null
    }

    setSpinning(true)
    setError(null)

    try {
      await ensureSupabaseSession(supabase)

      const { data, error: spinError } = await supabase.rpc('spin_troll_wheel', {
        p_user_id: user.id
      })

      if (spinError) {
        console.error('Wheel spin error:', spinError)
        throw new Error(spinError.message || 'Failed to spin wheel')
      }

      if (!data?.success) {
        // Handle specific error cases
        if (data?.error?.includes('Insufficient Trollz')) {
          toast.error(`Not enough Trollz! You need 100 Trollz to spin.`)
        } else {
          toast.error(data?.error || 'Failed to spin wheel')
        }
        setSpinning(false)
        return data
      }

      // Show success message based on reward type
      if (data.reward_type === 'trollz') {
        toast.success(`🎉 You won ${data.reward_amount} Trollz!`)
      } else if (data.reward_type === 'bonus_coins') {
        toast.success(`🎉 You won ${data.reward_amount} Bonus Coins!`)
      }

      // Update local balances
      setBalances(prev => ({
        ...prev,
        trollz_balance: data.new_trollz_balance,
        bonus_coin_balance: data.new_bonus_balance,
      }))

      // Update auth store
      const currentProfile = useAuthStore.getState().profile
      if (currentProfile) {
        useAuthStore.setState({
          profile: {
            ...currentProfile,
            trollz_balance: data.new_trollz_balance,
            bonus_coin_balance: data.new_bonus_balance,
          }
        })
      }

      setSpinning(false)
      return data

    } catch (err: any) {
      console.error('Spin wheel error:', err)
      toast.error(err?.message || 'Failed to spin wheel')
      setSpinning(false)
      return { 
        success: false, 
        spin_cost: 100, 
        reward_type: '', 
        reward_amount: 0, 
        new_trollz_balance: balances.trollz_balance,
        new_bonus_balance: balances.bonus_coin_balance,
        error: err?.message 
      }
    }
  }, [user?.id, spinning, balances.trollz_balance, balances.bonus_coin_balance])

  /**
   * Convert Trollz to Bonus Coins
   * Rate: 100 Trollz = 10 Bonus Coins
   * Minimum: 100 Trollz
   */
  const convertToCoins = useCallback(async (trollzAmount: number): Promise<ConversionResult | null> => {
    if (!user?.id) {
      toast.error('Please log in to convert Trollz')
      return null
    }

    if (converting) {
      return null
    }

    const minConversion = 100
    if (trollzAmount < minConversion) {
      toast.error(`Minimum conversion is ${minConversion} Trollz`)
      return null
    }

    setConverting(true)
    setError(null)

    try {
      await ensureSupabaseSession(supabase)

      const { data, error: convertError } = await supabase.rpc('convert_trollz_to_coins', {
        p_user_id: user.id,
        p_trollz_amount: trollzAmount
      })

      if (convertError) {
        console.error('Conversion error:', convertError)
        throw new Error(convertError.message || 'Failed to convert Trollz')
      }

      if (!data?.success) {
        if (data?.error?.includes('Insufficient Trollz')) {
          toast.error(`Not enough Trollz! You have ${balances.trollz_balance} Trollz.`)
        } else {
          toast.error(data?.error || 'Failed to convert Trollz')
        }
        setConverting(false)
        return data
      }

      toast.success(`🎉 Converted ${data.trollz_spent} Trollz to ${data.coins_awarded} Bonus Coins!`)

      // Update local balances
      setBalances(prev => ({
        ...prev,
        trollz_balance: data.new_trollz_balance,
        bonus_coin_balance: data.new_bonus_balance,
      }))

      // Update auth store
      const currentProfile = useAuthStore.getState().profile
      if (currentProfile) {
        useAuthStore.setState({
          profile: {
            ...currentProfile,
            trollz_balance: data.new_trollz_balance,
            bonus_coin_balance: data.new_bonus_balance,
          }
        })
      }

      setConverting(false)
      return data

    } catch (err: any) {
      console.error('Convert to coins error:', err)
      toast.error(err?.message || 'Failed to convert Trollz')
      setConverting(false)
      return { 
        success: false, 
        trollz_spent: trollzAmount, 
        coins_awarded: 0, 
        new_trollz_balance: balances.trollz_balance,
        new_bonus_balance: balances.bonus_coin_balance,
        error: err?.message 
      }
    }
  }, [user?.id, converting, balances.trollz_balance, balances.bonus_coin_balance])

  /**
   * Get the conversion rate display
   */
  const getConversionRate = useCallback(() => {
    return {
      trollz: 100,
      coins: 10,
      display: '100 Trollz = 10 Bonus Coins'
    }
  }, [])

  /**
   * Get the wheel spin cost
   */
  const getSpinCost = useCallback(() => {
    return 100
  }, [])

  // Initial load
  useEffect(() => {
    if (user?.id) {
      refreshBalances()
    }
  }, [user?.id, refreshBalances])

  return {
    balances,
    loading,
    error,
    spinning,
    converting,
    refreshBalances,
    spinWheel,
    convertToCoins,
    getConversionRate,
    getSpinCost,
  }
}
