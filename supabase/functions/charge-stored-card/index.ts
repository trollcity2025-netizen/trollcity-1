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

      console.log(`[ChargeStoredCard ${requestId}] Request body:`, {
        userId, amountUsd, coins, packageId, packageName, purchaseType, paymentMethodId
      })

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

    // Get VALID saved card from saved_cards table
    let cardId = null
    let customerId = null

    console.log(`[ChargeStoredCard ${requestId}] Looking for paymentMethodId: ${paymentMethodId}`)

    if (paymentMethodId) {
      const cardRes = await fetch(
        `${supabaseUrl}/rest/v1/user_payment_methods?id=eq.${paymentMethodId}&select=*`,
        { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const paymentMethods = await cardRes.json()
      const card = paymentMethods?.[0]

      console.log(`[ChargeStoredCard ${requestId}] Found payment method:`, {
        id: card?.id,
        square_customer_id: card?.square_customer_id,
        square_card_id: card?.square_card_id,
        brand: card?.brand,
        last4: card?.last4,
        is_default: card?.is_default
      })

      // Only accept payment methods with valid Square IDs
      if (card && card.square_customer_id && card.square_card_id) {
        cardId = card.square_card_id
        customerId = card.square_customer_id
        console.log(`[ChargeStoredCard ${requestId}] Using payment method: cardId=${cardId}, customerId=${customerId}`)
      } else {
        console.log(`[ChargeStoredCard ${requestId}] Payment method invalid - missing Square IDs`)
      }
    }

    // Fallback: query for default payment method with valid Square IDs
    if (!cardId || !customerId) {
      console.log(`[ChargeStoredCard ${requestId}] No payment method found, trying fallback for user ${userId}`)
      const defaultCardRes = await fetch(
        `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&is_default=eq.true&limit=1&select=*`,
        { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const defaultCards = await defaultCardRes.json()
      const defaultCard = defaultCards?.[0]

      console.log(`[ChargeStoredCard ${requestId}] Fallback found:`, defaultCard ? {
        id: defaultCard.id,
        square_customer_id: defaultCard.square_customer_id,
        square_card_id: defaultCard.square_card_id,
        brand: defaultCard.brand,
        last4: defaultCard.last4
      } : 'none')

      if (defaultCard) {
        cardId = defaultCard.square_card_id
        customerId = defaultCard.square_customer_id
        console.log(`[ChargeStoredCard ${requestId}] Using fallback payment method: cardId=${cardId}, customerId=${customerId}`)
      }
    }
    
    // Fallback to profile if still not found in payment methods
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

    if (!cardId || !customerId) {
      console.error(`[ChargeStoredCard ${requestId}] CRITICAL: Missing card or customer ID`)
      console.error(`[ChargeStoredCard ${requestId}] cardId: "${cardId}" (type: ${typeof cardId})`)
      console.error(`[ChargeStoredCard ${requestId}] customerId: "${customerId}" (type: ${typeof customerId})`)
      console.error(`[ChargeStoredCard ${requestId}] paymentMethodId received: "${paymentMethodId}"`)

      // Let's also check what payment methods exist for this user
      try {
        const allPmRes = await fetch(
          `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&select=*`,
          { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
        )
        const allPms = await allPmRes.json()
        console.error(`[ChargeStoredCard ${requestId}] All payment methods for user:`, allPms)
      } catch (debugErr) {
        console.error(`[ChargeStoredCard ${requestId}] Failed to fetch debug info:`, debugErr)
      }

      return withCors({
        success: false,
        error: 'No valid payment method found. Please add a card first.',
        needsCard: true,
      }, 400)
    }

    console.log(`[ChargeStoredCard ${requestId}] ✅ Found valid payment method`)
    console.log(`[ChargeStoredCard ${requestId}] customerId: "${customerId}"`)
    console.log(`[ChargeStoredCard ${requestId}] cardId: "${cardId}"`)
    console.log(`[ChargeStoredCard ${requestId}] source_id will be: "${cardId}"`)

    const referenceId = `coins_${Date.now()}`.slice(0, 40)

    // First create a Square order (required for stored card payments)
    const orderRes = await fetch(`${baseUrl}/v2/orders`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: {
          location_id: SQUARE_LOCATION_ID,
          reference_id: referenceId,
          line_items: [
            {
              name: packageName || `${coins} Troll Coins`,
              quantity: '1',
              base_price_money: {
                amount: Math.round(amountUsd * 100),
                currency: 'USD',
              },
            },
          ],
          metadata: {
            user_id: userId,
            coins: String(coins),
            package_id: packageId || '',
            purchase_type: purchaseType || 'coins',
          },
        },
        idempotency_key: `order_${Date.now()}`.slice(0, 45),
      }),
    })

    if (!orderRes.ok) {
      const err = await orderRes.json()
      console.error(`[ChargeStoredCard ${requestId}] Order creation failed:`, err)
      return withCors({ success: false, error: 'Failed to create order' }, 400)
    }

    const orderData = await orderRes.json()
    const orderId = orderData.order?.id

    console.log(`[ChargeStoredCard ${requestId}] Order created: ${orderId}`)

    // Verify card exists before charging
    const cardCheckRes = await fetch(`${baseUrl}/v2/cards/${cardId}`, {
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
      },
    })

    if (!cardCheckRes.ok) {
      console.error(`[ChargeStoredCard ${requestId}] Card verification failed:`, await cardCheckRes.text())
      return withCors({ success: false, error: 'Card not found or invalid' }, 400)
    }

    const cardData = await cardCheckRes.json()
    console.log(`[ChargeStoredCard ${requestId}] Card verified: ${cardData.card?.card_brand} •••• ${cardData.card?.last4}`)

    // Create payment with stored card and order
    const paymentRes = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: `pay_${Date.now()}`.slice(0, 45),
        source_id: cardId,
        customer_id: customerId,
        order_id: orderId,
        location_id: SQUARE_LOCATION_ID,
        reference_id: referenceId,
        amount_money: {
          amount: Math.round(amountUsd * 100),
          currency: 'USD',
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
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=troll_coins`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    const profiles = await profileRes.json()
    const currentCoins = profiles?.[0]?.troll_coins || 0
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
          troll_coins: currentCoins + coinAmount
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
