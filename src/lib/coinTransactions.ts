// src/lib/coinTransactions.ts
// Centralized coin transaction logging utility

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, ensureSupabaseSession } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { trackCoinEarning } from './familyTasks'
import { trackWarActivity } from './familyWars'

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'bigint') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatBalanceForRecord = (value: unknown): number | string | null => {
  if (value === undefined || value === null) return null
  if (typeof value === 'bigint') return value.toString()
  return value as number | string
}

const getSessionUserId = async (client: SupabaseClient) => {
  const { data } = await client.auth.getSession()
  return data?.session?.user?.id ?? null
}

const sanitizeMetadata = (metadata?: CoinTransactionMetadata) => {
  if (!metadata) return null
  try {
    return JSON.parse(
      JSON.stringify(metadata, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    )
  } catch {
    return metadata
  }
}

export type CoinTransactionType = 
  | 'purchase'
  | 'gift_sent'
  | 'gift_received'
  | 'cashout'
  | 'admin_grant'
  | 'admin_deduct'
  | 'insurance_purchase'
  | 'entrance_effect'
  | 'perk_purchase'
  | 'refund'
  | 'reward'
  | 'lucky_gift_win'
  | 'troll_town_purchase'
  | 'troll_town_sale'
  | 'troll_town_upgrade'

export type CoinType = 'troll_coins'

export interface CoinTransactionMetadata {
  [key: string]: any
  effect_name?: string
  duration?: number
  rarity?: string
  icon?: string
  perk_id?: string
  insurance_id?: string
  gift_id?: string
  package_id?: string
  admin_reason?: string
}

export interface RecordCoinTransactionParams {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  sourceType?: string // Legacy field, defaults to type
  sourceId?: string
  description?: string
  metadata?: CoinTransactionMetadata
  balanceAfter?: number | string | null // If not provided, will be calculated
  platformProfit?: number // USD profit for platform (revenue)
  liability?: number // Liability created (coins)
  supabaseClient?: SupabaseClient // Optional supabase client (for backend usage)
  allowServiceRole?: boolean
}

/**
 * Records a coin transaction to the database
 * This is the ONLY function that should be used to log coin changes
 * 
 * @param params Transaction parameters
 * @returns The created transaction record or null on error
 */
export async function recordCoinTransaction(params: RecordCoinTransactionParams) {
  try {
    const {
      userId,
      amount,
      type,
      coinType,
      sourceType,
      sourceId,
      description,
      metadata,
      balanceAfter,
      platformProfit,
      liability,
      supabaseClient,
      allowServiceRole = false
    } = params

    const sb = supabaseClient || supabase
    if (!sb) {
      console.error('recordCoinTransaction: No supabase client available')
      return null
    }

    const sessionUserId = await getSessionUserId(sb)
    if (!sessionUserId && !allowServiceRole) {
      throw new Error('User not authenticated')
    }

    const targetUserId = sessionUserId ?? userId
    if (!targetUserId) {
      console.error('recordCoinTransaction: userId is required')
      return null
    }

    if (sessionUserId && userId && sessionUserId !== userId) {
      console.debug('recordCoinTransaction session mismatch', {
        authUid: sessionUserId,
        payloadUid: userId
      })
    }

    if (amount === undefined || amount === null) {
      console.error('recordCoinTransaction: amount is required')
      return null
    }

    const finalBalanceAfter = formatBalanceForRecord(balanceAfter ?? null)
    const coinTypeValue = coinType || 'troll_coins'
    const metadataPayload = sanitizeMetadata(metadata)

    const insertPayload = {
      user_id: targetUserId,
      amount,
      coin_delta: amount,
      type,
      coin_type: coinTypeValue,
      source_type: sourceType || type,
      source_id: sourceId || null,
      description: description || null,
      balance_after: finalBalanceAfter,
      metadata: metadataPayload,
      platform_profit: platformProfit || 0,
      liability: liability || 0,
      created_at: new Date().toISOString()
    }

    const { data, error } = await sb
      .from('coin_transactions')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      const message = error.message || ''
      const isCoinTypeCheck =
        error.code === '23514' &&
        message.toLowerCase().includes('coin_transactions_coin_type_check')

      if (isCoinTypeCheck) {
        const legacyCoinType = coinType === 'troll_coins' ? 'paid' : 'free'
        const { data: retryData, error: retryError } = await sb
          .from('coin_transactions')
          .insert({ ...insertPayload, coin_type: legacyCoinType })
          .select()
          .single()

        if (retryError) {
          console.error('recordCoinTransaction error:', retryError)
          return null
        }

        return retryData
      }

      console.error('recordCoinTransaction error:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('recordCoinTransaction exception:', err)
    return null
  }
}

/**
 * Deducts coins from user balance and logs transaction
 * Use this for purchases (insurance, effects, perks, etc.)
 * 
 * @returns { success: boolean, newBalance: number, transaction: object | null }
 */
export async function deductCoins(params: {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  description?: string
  metadata?: CoinTransactionMetadata
  supabaseClient?: SupabaseClient
  balanceAfter?: number | string | null
  platformProfit?: number
  liability?: number
}) {
  const { userId, amount, type, coinType = 'troll_coins', description, metadata, supabaseClient, balanceAfter, platformProfit, liability } = params

  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('deductCoins: No supabase client available')
    return { success: false, newBalance: 0, transaction: null, error: 'No supabase client' }
  }

  try {
    const sessionUserId = await getSessionUserId(sb) || userId

    if (!sessionUserId) {
      throw new Error('User not authenticated')
    }

    if (sessionUserId && sessionUserId !== userId) {
      console.debug('deductCoins session mismatch', { authUid: sessionUserId, payloadUid: userId })
    }

    const normalizedAmount = Math.max(0, Math.round(amount))
    if (normalizedAmount <= 0) {
      return {
        success: false,
        newBalance: null,
        transaction: null,
        error: 'Invalid amount'
      }
    }

    const metadataPayload = sanitizeMetadata(metadata)

    if (coinType === 'troll_coins' || !coinType) {
      // Use Troll Bank centralized spending
      const { data: bankResult, error: bankError } = await sb.rpc('troll_bank_spend_coins_secure', {
        p_user_id: userId,
        p_amount: normalizedAmount,
        p_bucket: 'paid', // Spending is usually from 'paid' (or fungible balance)
        p_source: type,
        p_ref_id: null,
        p_metadata: metadataPayload || {}
      })

      if (bankError) {
             console.error('deductCoins: Troll Bank error', bankError)
             // Fallback: use legacy RPC if bank fails due to schema drift (e.g., missing columns)
             const msg = (bankError.message || '').toLowerCase()
             if (msg.includes('column') && msg.includes('coins') && msg.includes('does not exist')) {
               try {
                 const amountParam = normalizedAmount.toString()
                 const { data: rpcBalance, error: legacyErr } = await sb.rpc('deduct_user_troll_coins', {
                   p_user_id: userId,
                   p_amount: amountParam,
                   p_coin_type: 'troll_coins'
                 })

                 if (legacyErr) {
                   console.error('deductCoins legacy fallback failed:', legacyErr)
                   return { success: false, newBalance: null, transaction: null, error: legacyErr.message }
                 }

                 const parsedBalance = safeNumber(rpcBalance)
                 let newBalance: number | string | null = parsedBalance
                 if (newBalance === null && rpcBalance !== null && rpcBalance !== undefined) {
                   newBalance = typeof rpcBalance === 'string' ? rpcBalance : String(rpcBalance)
                 }

                 // Update store
                 try {
                   const { profile, setProfile } = useAuthStore.getState()
                   if (profile && profile.id === userId && newBalance !== null) {
                     const numericBalance = Number(newBalance)
                     if (!isNaN(numericBalance)) {
                       setProfile({ ...profile, troll_coins: numericBalance })
                     }
                   }
                 } catch (e) {
                   console.warn('deductCoins fallback: Failed to update local store', e)
                 }

                 return { success: true, newBalance, transaction: null, error: null }
               } catch (fallbackErr: any) {
                 console.error('deductCoins fallback exception:', fallbackErr)
                 return { success: false, newBalance: null, transaction: null, error: fallbackErr.message }
               }
             }

             return { success: false, newBalance: null, transaction: null, error: bankError.message }
      } else {
        // Success
        if (!bankResult.success) {
           return { success: false, newBalance: null, transaction: null, error: bankResult.error || 'Failed to spend coins' }
        }

        const newBalance = bankResult.new_balance
        
        // Update global store
        try {
          const { profile, setProfile } = useAuthStore.getState()
          if (profile && profile.id === userId) {
             setProfile({ ...profile, troll_coins: newBalance })
          }
        } catch (e) {
          console.warn('deductCoins: Failed to update local store', e)
        }

        return {
          success: true,
          newBalance,
          transaction: null, // Handled by ledger
          error: null
        }
      }
    }

    // Legacy path for non-Troll Coins (e.g. Trollmonds)
    const amountParam = normalizedAmount.toString()
    const { data: rpcBalance, error: deductError } = await sb.rpc('deduct_user_troll_coins', {
      p_user_id: userId,
      p_amount: amountParam,
      p_coin_type: coinType || 'troll_coins'
    })

    if (deductError) {
      console.error('deductCoins: RPC error', deductError)
      return { success: false, newBalance: null, transaction: null, error: deductError.message || 'Failed to deduct coins' }
    }

    const parsedBalance = safeNumber(rpcBalance)
    let newBalance: number | string | null = parsedBalance
    if (newBalance === null && rpcBalance !== null && rpcBalance !== undefined) {
      newBalance = typeof rpcBalance === 'string' ? rpcBalance : String(rpcBalance)
    }

    const balanceAfterForRecord = formatBalanceForRecord(
      balanceAfter ?? newBalance ?? null
    )

    const transaction = await recordCoinTransaction({
      userId,
      amount: -normalizedAmount,
      type,
      coinType,
      description,
      metadata,
      balanceAfter: balanceAfterForRecord,
      platformProfit,
      liability,
      supabaseClient: sb
    })

    // Update global store if the deduction was for the current user
    // This ensures UI components (like Sidebar) reflect the change immediately
    try {
      const { profile, setProfile } = useAuthStore.getState()
      if (profile && profile.id === userId && newBalance !== null) {
        const numericBalance = Number(newBalance)
        if (!isNaN(numericBalance)) {
          // Update the specific coin balance based on coinType
          const updatedProfile = { ...profile }
          
          updatedProfile.troll_coins = numericBalance
          
          setProfile(updatedProfile)
        }
      }
    } catch (e) {
      console.warn('deductCoins: Failed to update local store', e)
    }

    return {
      success: true,
      newBalance,
      transaction,
      error: null
    }
  } catch (err: any) {
    console.error('deductCoins exception:', err)
    return {
      success: false,
      newBalance: null,
      transaction: null,
      error: err.message || 'Unknown error'
    }
  }
}

/**
 * Adds coins to user balance and logs transaction
 * Use this for rewards, refunds, admin grants, etc.
 */
export async function addCoins(params: {
  userId: string
  amount: number
  type: CoinTransactionType
  coinType?: CoinType
  description?: string
  metadata?: CoinTransactionMetadata
  supabaseClient?: SupabaseClient // Optional supabase client (for backend usage)
  platformProfit?: number
  liability?: number
  sourceId?: string
}) {
  const { userId, amount, type, coinType = 'troll_coins', description: _description, metadata, supabaseClient, platformProfit: _platformProfit, liability: _liability, sourceId } = params
  const finalCoinType = coinType || 'troll_coins'

  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('addCoins: No supabase client available')
    return { success: false, newBalance: 0, transaction: null, error: 'No supabase client' }
  }

  try {
    await ensureSupabaseSession(sb)

    const { data: profile, error: profileError } = await sb
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('addCoins: Failed to get profile', profileError)
      return { success: false, newBalance: 0, transaction: null, error: 'Profile not found' }
    }

    const currentBalance = profile.troll_coins ?? 0
    const metadataPayload = sanitizeMetadata(metadata)

    // Use Troll Bank RPC for centralized credit + repayment logic
    const bucketMap: Record<string, string> = {
      purchase: 'paid',
      gift_received: 'gifted',
      reward: 'promo',
      admin_grant: 'promo',
      lucky_gift_win: 'promo',
      refund: 'paid',
      cashout: 'paid',
      insurance_purchase: 'paid',
      entrance_effect: 'paid',
      perk_purchase: 'paid',
      troll_town_sale: 'paid'
    }

    const bucket = bucketMap[type] || 'promo' // Default to promo for safety
    const transactionRefId = sourceId || null

    const { data: bankResult, error: bankError } = await sb.rpc('troll_bank_credit_coins', {
      p_user_id: userId,
      p_coins: amount,
      p_bucket: bucket,
      p_source: type,
      p_ref_id: transactionRefId,
      p_metadata: metadataPayload || {}
    })

    if (bankError) {
      console.error('addCoins: Troll Bank credit failed', bankError)
      const msg = (bankError.message || '').toLowerCase()
      // Fallback to legacy credit if schema drift occurs
      if (msg.includes('column') && msg.includes('coins') && msg.includes('does not exist')) {
        try {
          const { data: updated, error: legacyErr } = await sb
            .from('user_profiles')
            .update({ troll_coins: (currentBalance || 0) + amount })
            .eq('id', userId)
            .select('troll_coins')
            .single()

          if (legacyErr) {
            console.error('addCoins legacy fallback failed:', legacyErr)
            return { success: false, newBalance: currentBalance, transaction: null, error: legacyErr.message }
          }

          const finalBalance = updated?.troll_coins ?? (currentBalance + amount)
          try {
            const { profile, setProfile } = useAuthStore.getState()
            if (profile && profile.id === userId) {
              setProfile({ ...profile, troll_coins: finalBalance })
            }
          } catch (e) {
            console.warn('addCoins fallback: Failed to update local store', e)
          }

          return { success: true, newBalance: finalBalance, transaction: null, error: null }
        } catch (fallbackErr: any) {
          console.error('addCoins fallback exception:', fallbackErr)
          return { success: false, newBalance: currentBalance, transaction: null, error: fallbackErr.message }
        }
      }

      return { success: false, newBalance: currentBalance, transaction: null, error: bankError.message }
    }

    // Parse bank result
    const actualCredited = bankResult?.user_gets ?? amount
    // const repaymentAmount = bankResult?.repay ?? 0
    const finalBalance = currentBalance + actualCredited

    // Update global store if the addition was for the current user
    try {
      const { profile, setProfile } = useAuthStore.getState()
      if (profile && profile.id === userId) {
        const updatedProfile = { ...profile }
        
        updatedProfile.troll_coins = finalBalance
        
        setProfile(updatedProfile)
      }
    } catch (e) {
      console.warn('addCoins: Failed to update local store', e)
    }

    // Family token earning hook: Allocate 10% of earned coins to family stats
    if (finalCoinType === 'troll_coins' && amount > 0) {
      try {
        // Check if user is in a family
        const { data: familyMember } = await sb
          .from('family_members')
          .select('family_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (familyMember?.family_id) {
          const familyBonus = Math.floor(amount * 0.10) // 10% of earned coins
          if (familyBonus > 0) {
            // Use RPC function to atomically update family stats
            const { data: _familyResult, error: familyError } = await sb.rpc('increment_family_stats', {
              p_family_id: familyMember.family_id,
              p_coin_bonus: familyBonus,
              p_xp_bonus: 0
            })

            if (familyError) {
              console.warn('Failed to update family stats for coin earning:', familyError)
            } else {
              console.log(`Allocated ${familyBonus} family tokens to family ${familyMember.family_id}`)
            }
          }

          // Track coin earning for family tasks
          try {
            await trackCoinEarning(userId, amount)
          } catch (taskErr) {
            console.warn('Failed to track coin earning for tasks:', taskErr)
          }

          // Track coin earning for active wars
          try {
            await trackWarActivity(userId, 'coin_earned', amount)
          } catch (warErr) {
            console.warn('Failed to track coin earning for wars:', warErr)
          }
        }
      } catch (familyErr) {
        console.warn('Family coin allocation failed:', familyErr)
        // Don't fail the main transaction for family allocation errors
      }
    }

    return {
      success: true,
      newBalance: finalBalance,
      transaction: bankResult, // Return bank result as transaction info
      error: null
    }
  } catch (err: any) {
    console.error('addCoins exception:', err)
    return {
      success: false,
      newBalance: 0,
      transaction: null,
      error: err.message || 'Unknown error'
    }
  }
}

/**
 * Check if user has active insurance of a specific type
 */
export async function hasActiveInsurance(
  userId: string,
  protectionType: 'kick' | 'full',
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('hasActiveInsurance: No supabase client available')
    return false
  }
  
  try {
    const { data, error } = await sb
      .from('user_insurances')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .or(`protection_type.eq.${protectionType},protection_type.eq.full`)
      .limit(1)

    if (error) {
      console.error('hasActiveInsurance error:', error)
      return false
    }

    return (data?.length || 0) > 0
  } catch (err) {
    console.error('hasActiveInsurance exception:', err)
    return false
  }
}

/**
 * Increment insurance trigger count
 */
export async function triggerInsurance(insuranceId: string, supabaseClient?: SupabaseClient) {
  const sb = supabaseClient || supabase
  if (!sb) {
    console.error('triggerInsurance: No supabase client available')
    return
  }
  
  try {
    await sb.rpc('increment_insurance_trigger', { insurance_id: insuranceId })
  } catch (err) {
    console.error('triggerInsurance error:', err)
  }
}
