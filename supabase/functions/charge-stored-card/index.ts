// charge-stored-card Edge Function
// Charges a stored card for coin purchases using Square

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  const requestId = `sq_charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[ChargeStoredCard ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { userId, amountUsd, coins, packageId, packageName, purchaseType, paymentMethodId } = body

    if (!userId) {
      return withCors({ success: false, error: 'userId is required' }, 400)
    }
    if (!amountUsd || amountUsd <= 0) {
      return withCors({ success: false, error: 'Invalid amount' }, 400)
    }
    if (!coins || coins <= 0) {
      return withCors({ success: false, error: 'Invalid coin amount' }, 400)
    }

    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      console.error(`[ChargeStoredCard ${requestId}] Square not configured`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500)
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_URL : SQUARE_API_URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Get payment method from user_payment_methods table
    let cardId = null
    let customerId = null
    
    if (paymentMethodId) {
      const pmRes = await fetch(
        `${supabaseUrl}/rest/v1/user_payment_methods?id=eq.${paymentMethodId}&select=*`,
        { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const paymentMethods = await pmRes.json()
      const pm = paymentMethods?.[0]
      
      if (pm) {
        cardId = pm.square_card_id || pm.card_id || pm.token_id
        customerId = pm.square_customer_id || pm.customer_id
      }
    }
    
    // Fallback to profile if not found in payment methods
    if (!cardId || !customerId) {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username,email,square_customer_id,square_card_id`,
        { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const profiles = await profileRes.json()
      const profile = profiles?.[0]
      
      if (!cardId) cardId = profile?.square_card_id
      if (!customerId) customerId = profile?.square_customer_id
    }

    if (!customerId || !cardId) {
      console.error(`[ChargeStoredCard ${requestId}] No payment method found`)
      return withCors({ 
        success: false, 
        error: 'No saved payment method. Please add a card first.',
        needsCard: true,
      }, 400)
    }

    console.log(`[ChargeStoredCard ${requestId}] Charging customer ${customerId}, card ${cardId}, amount ${amountUsd}`)

    // Create payment with stored card
    const paymentRes = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: `pay_${requestId}_${Date.now()}`,
        source_id: `cnon:${cardId}`,
        customer_id: customerId,
        amount_money: {
          amount: Math.round(amountUsd * 100),
          currency: 'USD',
        },
        location_id: SQUARE_LOCATION_ID,
        reference_id: `${userId}_${packageId || 'coins'}_${Date.now()}`,
        metadata: {
          user_id: userId,
          coins: String(coins),
          package_id: packageId || '',
          purchase_type: purchaseType || 'coins',
        },
      }),
    })

    if (!paymentRes.ok) {
      const err = await paymentRes.json()
      console.error(`[ChargeStoredCard ${requestId}] Payment failed:`, err)
      return withCors({ 
        success: false, 
        error: err.errors?.[0]?.detail || 'Payment failed. Please try again.',
      }, 400)
    }

    const paymentData = await paymentRes.json()
    const payment = paymentData.payment

    if (!payment || payment.status !== 'COMPLETED') {
      console.error(`[ChargeStoredCard ${requestId}] Payment not completed:`, payment)
      return withCors({ 
        success: false, 
        error: 'Payment was not completed',
      }, 400)
    }

    console.log(`[ChargeStoredCard ${requestId}] Payment successful: ${payment.id}`)

    // Credit coins to user
    const coinAmount = Number(coins)
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          troll_coins: { increment: coinAmount }
        }),
      }
    )

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      console.error(`[ChargeStoredCard ${requestId}] Failed to credit coins:`, errText)
      // Payment succeeded but coin credit failed - log for manual correction
      console.error(`[ChargeStoredCard ${requestId}] PAYMENT SUCCESSFUL BUT COINS NOT CREDITED - MANUAL FIX NEEDED`)
    }

    // Log transaction
    await fetch(
      `${supabaseUrl}/rest/v1/coin_transactions`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'store_purchase',
          status: 'completed',
          coin_type: 'paid',
          amount: coinAmount,
          balance_after: null, // Not fetched for performance
          metadata: {
            payment_id: payment.id,
            amount_usd: amountUsd,
            package_id: packageId,
            purchase_type: purchaseType,
            square_payment: true
          }
        }),
      }
    )

    console.log(`[ChargeStoredCard ${requestId}] Coins credited: ${coinAmount}`)

    return withCors({
      success: true,
      paymentId: payment.id,
      amount: amountUsd,
      coins: coinAmount,
      packageId,
      purchaseType,
    })

  } catch (err) {
    console.error(`[ChargeStoredCard ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Payment processing error' }, 500)
  }
})