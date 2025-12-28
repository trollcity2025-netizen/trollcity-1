import { supabase, UserProfile } from './supabase'
import { toast } from 'sonner'

export interface CoinTransaction {
  user_id: string
  type: 'purchase' | 'gift' | 'spin' | 'insurance' | 'cashout' | 'refund' | 'admin_grant' | 'penalty' | 'verification'
  amount: number
  description: string
  metadata?: Record<string, any>
  source?: string
  external_id?: string
}

export interface CoinValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface BalanceCheckResult {
  hasSufficientBalance: boolean
  currentBalance: number
  requiredAmount: number
  shortfall: number
}

// Production-ready coin validation
export const validateCoinAmount = (amount: number, transactionType?: string): CoinValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  // Basic validation
  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number')
  }

  if (amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  if (amount > 1000000) { // 1 million coins max per transaction
    errors.push('Amount exceeds maximum transaction limit')
  }

  // Type-specific validation
  if (transactionType === 'purchase' && amount < 100) {
    warnings.push('Minimum purchase amount is 100 coins')
  }

  if (transactionType === 'gift' && amount > 50000) {
    warnings.push('Large gift amount - consider breaking into smaller transactions')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Enhanced balance checking with detailed feedback
export const checkBalance = async (
  userId: string, 
  requiredAmount: number, 
  coinType: 'paid' | 'free' | 'either' = 'paid'
): Promise<BalanceCheckResult> => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('troll_coins, free_coin_balance, total_earned_coins')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      throw new Error('Failed to fetch user balance')
    }

    let currentBalance = 0

    switch (coinType) {
      case 'paid':
        currentBalance = profile.troll_coins || 0
        break
      case 'free':
        currentBalance = profile.free_coin_balance || 0
        break
      case 'either':
        currentBalance = (profile.troll_coins || 0) + (profile.free_coin_balance || 0)
        break
    }

    const shortfall = Math.max(0, requiredAmount - currentBalance)

    return {
      hasSufficientBalance: currentBalance >= requiredAmount,
      currentBalance,
      requiredAmount,
      shortfall
    }
  } catch (error) {
    console.error('Balance check error:', error)
    return {
      hasSufficientBalance: false,
      currentBalance: 0,
      requiredAmount,
      shortfall: requiredAmount
    }
  }
}

// Production-ready coin spending with comprehensive logging
export const spendCoins = async (
  userId: string,
  amount: number,
  transaction: Omit<CoinTransaction, 'user_id' | 'amount'>
): Promise<{ success: boolean; error?: string; newBalance?: number }> => {
  const validation = validateCoinAmount(amount, transaction.type)
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(', ') }
  }

  if (validation.warnings.length > 0) {
    console.warn('Coin spending warnings:', validation.warnings)
  }

  try {
    // Use database transaction for atomicity
    const { data, error } = await supabase.rpc('spend_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transaction.type,
      p_description: transaction.description,
      p_metadata: transaction.metadata || {},
      p_source: transaction.source || 'app',
      p_external_id: transaction.external_id
    })

    if (error) {
      console.error('Spend coins error:', error)
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Transaction failed' }
    }

    return {
      success: true,
      newBalance: data.new_balance
    }
  } catch (error: any) {
    console.error('Spend coins exception:', error)
    return { success: false, error: error.message || 'Transaction failed' }
  }
}

// Production-ready coin earning with comprehensive logging
export const earnCoins = async (
  userId: string,
  amount: number,
  transaction: Omit<CoinTransaction, 'user_id' | 'amount'>
): Promise<{ success: boolean; error?: string; newBalance?: number }> => {
  const validation = validateCoinAmount(amount, transaction.type)
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(', ') }
  }

  try {
    // Use database transaction for atomicity
    const { data, error } = await supabase.rpc('earn_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transaction.type,
      p_description: transaction.description,
      p_metadata: transaction.metadata || {},
      p_source: transaction.source || 'app',
      p_external_id: transaction.external_id
    })

    if (error) {
      console.error('Earn coins error:', error)
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Transaction failed' }
    }

    return {
      success: true,
      newBalance: data.new_balance
    }
  } catch (error: any) {
    console.error('Earn coins exception:', error)
    return { success: false, error: error.message || 'Transaction failed' }
  }
}

// Enhanced gift sending with validation
export const sendGift = async (
  senderId: string,
  receiverId: string,
  amount: number,
  giftType: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> => {
  // Validate gift amount
  const validation = validateCoinAmount(amount, 'gift')
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(', ') }
  }

  // Check sender has sufficient balance
  const balanceCheck = await checkBalance(senderId, amount, 'paid')
  if (!balanceCheck.hasSufficientBalance) {
    return { 
      success: false, 
      error: `Insufficient balance. Need ${balanceCheck.shortfall} more coins.` 
    }
  }

  try {
    // Use database transaction for atomic gift operation
    const { data, error } = await supabase.rpc('send_gift', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_amount: amount,
      p_gift_type: giftType,
      p_metadata: metadata || {}
    })

    if (error) {
      console.error('Send gift error:', error)
      return { success: false, error: error.message }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Gift transaction failed' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Send gift exception:', error)
    return { success: false, error: error.message || 'Gift transaction failed' }
  }
}

// Production-ready balance refresh
export const refreshUserBalance = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Refresh balance error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Refresh balance exception:', error)
    return null
  }
}

// Comprehensive transaction history with filtering
export const getTransactionHistory = async (
  userId: string,
  options: {
    limit?: number
    offset?: number
    type?: string
    startDate?: string
    endDate?: string
  } = {}
) => {
  try {
    let query = supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options.type) {
      query = query.eq('type', options.type)
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate)
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Transaction history error:', error)
      return { transactions: [], error: error.message }
    }

    return { transactions: data || [], error: null }
  } catch (error: any) {
    console.error('Transaction history exception:', error)
    return { transactions: [], error: error.message }
  }
}

// Production-ready audit logging
export const logCoinAction = async (
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> => {
  try {
    await supabase.from('coin_audit_log').insert({
      user_id: userId,
      action,
      details,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Audit logging error:', error)
    // Don't throw - audit logging shouldn't break main operations
  }
}