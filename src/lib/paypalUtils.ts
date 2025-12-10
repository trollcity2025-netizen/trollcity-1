import { supabase } from './supabase'
import { toast } from 'sonner'

export interface PayPalConfig {
  clientId: string
  environment: 'sandbox' | 'live'
  currency: string
  intent: 'capture' | 'authorize'
}

export interface PayPalOrder {
  id: string
  status: string
  amount: {
    currency_code: string
    value: string
  }
  links?: Array<{
    href: string
    rel: string
    method: string
  }>
  purchase_units?: Array<{
    reference_id: string
    amount: {
      currency_code: string
      value: string
    }
  }>
}

export interface PayPalTransaction {
  order_id: string
  payer_id?: string
  status: string
  amount: number
  currency: string
  coins_purchased: number
  user_id: string
  created_at: string
  completed_at?: string
  external_transaction_id?: string
}

export interface PayPalValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Production-ready PayPal configuration
export const getPayPalConfig = (): PayPalConfig => {
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
  
  if (!clientId) {
    throw new Error('PayPal Client ID not configured')
  }

  // Determine environment based on client ID pattern or environment variable
  const isLive = import.meta.env.VITE_PAYPAL_ENV === 'live' || 
    (!clientId.includes('sandbox') && !clientId.includes('test'))

  return {
    clientId,
    environment: isLive ? 'live' : 'sandbox',
    currency: 'USD',
    intent: 'capture'
  }
}

// Enhanced PayPal order creation with validation
export const createPayPalOrder = async (
  userId: string,
  amount: number,
  coinsAmount: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; order?: PayPalOrder; error?: string; approvalUrl?: string }> => {
  try {
    // Validate inputs
    if (!userId) {
      return { success: false, error: 'User ID required' }
    }

    if (amount <= 0 || coinsAmount <= 0) {
      return { success: false, error: 'Amount and coins must be positive' }
    }

    if (amount > 10000) { // $10,000 max per transaction
      return { success: false, error: 'Amount exceeds maximum transaction limit' }
    }

    const config = getPayPalConfig()
    const edgeFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

    // Create order via Supabase Edge Function
    const response = await fetch(`${edgeFunctionsUrl}/paypal-create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        amount: amount.toFixed(2),
        coins: coinsAmount,
        currency: config.currency,
        metadata: {
          ...metadata,
          created_by: 'web_app',
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.success || !data.orderID || !data.approvalUrl) {
      throw new Error(data.error || 'Failed to create PayPal order')
    }

    // Log order creation for audit
    await logPayPalAction(userId, 'order_created', {
      order_id: data.orderID,
      amount,
      coins_amount: coinsAmount,
      environment: config.environment
    })

    return {
      success: true,
      order: {
        id: data.orderID,
        status: 'CREATED',
        amount: {
          currency_code: config.currency,
          value: amount.toFixed(2)
        }
      },
      approvalUrl: data.approvalUrl
    }

  } catch (error: any) {
    console.error('PayPal order creation error:', error)
    await logPayPalAction(userId, 'order_creation_failed', {
      error: error.message,
      amount,
      coins_amount: coinsAmount
    })
    
    return { 
      success: false, 
      error: error.message || 'Failed to create PayPal order' 
    }
  }
}

// Enhanced PayPal order capture with comprehensive validation
export const capturePayPalOrder = async (
  userId: string,
  orderId: string
): Promise<{ success: boolean; transaction?: PayPalTransaction; error?: string; coinsAdded?: number }> => {
  try {
    if (!orderId) {
      return { success: false, error: 'Order ID required' }
    }

    const edgeFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

    // Capture order via Supabase Edge Function
    const response = await fetch(`${edgeFunctionsUrl}/paypal-complete-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        paypal_order_id: orderId
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to capture PayPal order')
    }

    const transaction: PayPalTransaction = {
      order_id: orderId,
      payer_id: data.payer_id,
      status: 'COMPLETED',
      amount: data.amount || 0,
      currency: data.currency || 'USD',
      coins_purchased: data.coins_awarded || data.coinsAdded || 0,
      user_id: userId,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      external_transaction_id: data.transaction_id
    }

    // Log successful capture
    await logPayPalAction(userId, 'order_captured', {
      order_id: orderId,
      transaction_id: data.transaction_id,
      amount: transaction.amount,
      coins_purchased: transaction.coins_purchased
    })

    return {
      success: true,
      transaction,
      coinsAdded: transaction.coins_purchased
    }

  } catch (error: any) {
    console.error('PayPal order capture error:', error)
    await logPayPalAction(userId, 'order_capture_failed', {
      order_id: orderId,
      error: error.message
    })
    
    return { 
      success: false, 
      error: error.message || 'Failed to capture PayPal order' 
    }
  }
}

// PayPal payout request with enhanced validation
export const requestPayPalPayout = async (
  userId: string,
  amount: number,
  paypalEmail: string,
  coinsAmount: number
): Promise<{ success: boolean; error?: string; requestId?: string }> => {
  try {
    // Validate inputs
    const validation = validatePayPalPayoutRequest({
      amount,
      paypalEmail,
      coinsAmount
    })

    if (!validation.isValid) {
      return { 
        success: false, 
        error: validation.errors.join(', ') 
      }
    }

    if (validation.warnings.length > 0) {
      console.warn('PayPal payout warnings:', validation.warnings)
    }

    const edgeFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

    const response = await fetch(`${edgeFunctionsUrl}/paypal-payout-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        paypal_email: paypalEmail,
        cash_amount: amount,
        coins_redeemed: coinsAmount,
        metadata: {
          requested_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create payout request')
    }

    // Log payout request
    await logPayPalAction(userId, 'payout_requested', {
      amount,
      coins_amount: coinsAmount,
      paypal_email: paypalEmail.substring(0, 3) + '***', // Partial masking for security
      request_id: data.request_id
    })

    return {
      success: true,
      requestId: data.request_id
    }

  } catch (error: any) {
    console.error('PayPal payout request error:', error)
    await logPayPalAction(userId, 'payout_request_failed', {
      amount,
      coins_amount: coinsAmount,
      error: error.message
    })
    
    return { 
      success: false, 
      error: error.message || 'Failed to create payout request' 
    }
  }
}

// Enhanced PayPal email validation
export const validatePayPalEmail = (email: string): PayPalValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!email || typeof email !== 'string') {
    errors.push('PayPal email is required')
    return { isValid: false, errors, warnings }
  }

  const trimmedEmail = email.trim().toLowerCase()

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format')
  }

  // PayPal-specific validation
  if (trimmedEmail.includes('+')) {
    warnings.push('Email contains + symbol - may not work with all PayPal accounts')
  }

  if (trimmedEmail.length > 254) {
    errors.push('Email address too long')
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /temp|disposable|temporary/i,
    /10minutemail|guerrillamail/i,
    /test|fake|dummy/i
  ]

  if (suspiciousPatterns.some(pattern => pattern.test(trimmedEmail))) {
    warnings.push('Email appears to be temporary or test email')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Validate PayPal payout request
export const validatePayPalPayoutRequest = (request: {
  amount: number
  paypalEmail: string
  coinsAmount: number
}): PayPalValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate amount
  if (typeof request.amount !== 'number' || request.amount <= 0) {
    errors.push('Valid amount is required')
  }

  if (request.amount < 1) {
    errors.push('Minimum payout amount is $1.00')
  }

  if (request.amount > 10000) {
    errors.push('Maximum payout amount is $10,000.00')
  }

  // Validate coins amount
  if (typeof request.coinsAmount !== 'number' || request.coinsAmount <= 0) {
    errors.push('Valid coins amount is required')
  }

  if (request.coinsAmount < 1000) {
    errors.push('Minimum coins redemption is 1,000 coins')
  }

  if (request.coinsAmount > 10000000) {
    errors.push('Maximum coins redemption is 10,000,000 coins')
  }

  // Validate PayPal email
  const emailValidation = validatePayPalEmail(request.paypalEmail)
  errors.push(...emailValidation.errors)
  warnings.push(...emailValidation.warnings)

  // Check amount vs coins ratio (100 coins = $1)
  const expectedAmount = request.coinsAmount / 100
  const ratioDifference = Math.abs(request.amount - expectedAmount) / expectedAmount

  if (ratioDifference > 0.05) { // 5% tolerance
    warnings.push(`Amount ($${request.amount}) doesn't match coins amount (${request.coinsAmount} coins ≈ $${expectedAmount.toFixed(2)})`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Production-ready PayPal transaction verification
export const verifyPayPalTransaction = async (
  transactionId: string
): Promise<{ success: boolean; verified: boolean; error?: string }> => {
  try {
    if (!transactionId) {
      return { success: false, verified: false, error: 'Transaction ID required' }
    }

    const edgeFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

    const response = await fetch(`${edgeFunctionsUrl}/paypal-verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        transaction_id: transactionId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      verified: data.verified || false,
      error: data.error
    }

  } catch (error: any) {
    console.error('PayPal transaction verification error:', error)
    return {
      success: false,
      verified: false,
      error: error.message || 'Verification failed'
    }
  }
}

// Get PayPal transaction history
export const getPayPalTransactionHistory = async (
  userId: string,
  options: {
    limit?: number
    status?: string
    startDate?: string
    endDate?: string
  } = {}
) => {
  try {
    let query = supabase
      .from('paypal_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
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

    const { data, error } = await query

    if (error) {
      throw error
    }

    return { transactions: data || [], error: null }
  } catch (error: any) {
    console.error('PayPal transaction history error:', error)
    return { transactions: [], error: error.message }
  }
}

// Comprehensive PayPal audit logging
export const logPayPalAction = async (
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> => {
  try {
    await supabase.from('paypal_audit_log').insert({
      user_id: userId,
      action,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        environment: getPayPalConfig().environment
      },
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('PayPal audit logging error:', error)
    // Don't throw - audit logging shouldn't break main operations
  }
}

// Production-ready PayPal connection test
export const testPayPalConnection = async (): Promise<{
  success: boolean
  error?: string
  details?: any
}> => {
  try {
    const edgeFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    const config = getPayPalConfig()

    const response = await fetch(`${edgeFunctionsUrl}/paypal-test-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        test_type: 'connectivity',
        environment: config.environment
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`)
    }

    return {
      success: true,
      details: data
    }

  } catch (error: any) {
    console.error('PayPal connection test error:', error)
    return {
      success: false,
      error: error.message || 'Connection test failed'
    }
  }
}