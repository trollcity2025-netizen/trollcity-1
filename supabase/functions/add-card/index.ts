// add-card Edge Function
// Saves a payment card to user's Square customer profile

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  const requestId = `add_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[AddCard ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { userId, cardNonce, provider } = body

    console.log(`[AddCard ${requestId}] Request body:`, {
      userId,
      cardNonce: cardNonce ? cardNonce.substring(0, 10) + '...' : 'null',
      provider
    })

    if (!userId) {
      return withCors({ success: false, error: 'userId is required' }, 400)
    }
    if (!cardNonce) {
      return withCors({ success: false, error: 'cardNonce is required' }, 400)
    }

    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      console.error(`[AddCard ${requestId}] Square not configured`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500)
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_URL : SQUARE_API_URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Get user profile
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username,email,square_customer_id`,
      { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const profiles = await profileRes.json()
    const profile = profiles?.[0]

    let customerId = profile?.square_customer_id

    // Create customer if doesn't exist
    if (!customerId) {
      console.log(`[AddCard ${requestId}] Creating new Square customer`)
      
      const customerRes = await fetch(`${baseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          given_name: profile?.username || 'TrollCity User',
          email_address: profile?.email || 'user@trollcity.com',
          reference_id: userId,
        }),
      })

      if (!customerRes.ok) {
        const err = await customerRes.json()
        console.error(`[AddCard ${requestId}] Customer creation failed:`, err)
        return withCors({ success: false, error: 'Failed to create payment account' }, 400)
      }

      const customerData = await customerRes.json()
      customerId = customerData.customer?.id

      if (customerId) {
        await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ square_customer_id: customerId }),
        })
      }
    }

    if (!customerId) {
      return withCors({ success: false, error: 'Failed to create customer' }, 400)
    }

    // Create card from nonce
    console.log(`[AddCard ${requestId}] Adding card to customer ${customerId}`)
    const rawIdempotency = `card_${requestId}_${Date.now()}`
    const idempotency_key = rawIdempotency.slice(0, 45)
    
    const cardRes = await fetch(`${baseUrl}/v2/cards`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key,
        card_nonce: cardNonce,
        card: {
          customer_id: customerId,
        },
      }),
    })

    if (!cardRes.ok) {
      const err = await cardRes.json()
      console.error(`[AddCard ${requestId}] Card creation failed:`, err)
      const sqMessage = Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.detail || e.code || JSON.stringify(e)).join(' | ')
        : err.message || 'Failed to save card. Please try again.'
      return withCors({
        success: false,
        error: sqMessage,
        squareResponse: err,
      }, cardRes.status || 400)
    }

    const cardData = await cardRes.json()
    const cardId = cardData.card?.id

    console.log(`[AddCard ${requestId}] Card creation response:`, {
      cardId,
      cardData
    })

    if (!cardId) {
      return withCors({ success: false, error: 'Failed to get card ID' }, 400)
    }

    // Update user profile with all card details
    await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        square_card_id: cardId,
        // Save all card display details to user_profiles as well
        card_brand: cardData.card?.card_brand || 'Card',
        card_last4: cardData.card?.last4 || '****',
        card_exp_month: cardData.card?.exp_month,
        card_exp_year: cardData.card?.exp_year,
      }),
    })

    // Check if user already has a payment method, if not set as default
    const existingPmRes = await fetch(
      `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&limit=1`,
      { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const existingPms = await existingPmRes.json()
    const isDefault = !existingPms || existingPms.length === 0

    // Save to user_payment_methods table
    await fetch(`${supabaseUrl}/rest/v1/user_payment_methods`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        provider: 'square',
        square_customer_id: customerId,
        square_card_id: cardId,
        last4: cardData.card?.last4 || '****',
        brand: cardData.card?.card_brand || 'Card',
        is_default: isDefault,
      }),
    })

    console.log(`[AddCard ${requestId}] Card saved: ${cardId}`)

    return withCors({
      success: true,
      cardId,
      customerId,
    })

  } catch (err) {
    console.error(`[AddCard ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Failed to save card' }, 500)
  }
})