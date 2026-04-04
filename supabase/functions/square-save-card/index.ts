// square-save-card Edge Function
// Saves a payment card to user's Square customer profile

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  const requestId = `sq_save_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[SquareSaveCard ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { userId, cardNonce, customerId: existingCustomerId } = body

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
      return withCors({ success: false, error: 'Payment system not configured' }, 500)
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_URL : SQUARE_API_URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Get user profile
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username,email,square_customer_id`, {
      headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const profiles = await profileRes.json()
    const profile = profiles?.[0]

    let customerId = existingCustomerId || profile?.square_customer_id

    // Create customer if doesn't exist
    if (!customerId) {
      console.log(`[SquareSaveCard ${requestId}] Creating new Square customer`)
      
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
        console.error(`[SquareSaveCard ${requestId}] Customer creation failed:`, err)
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
    console.log(`[SquareSaveCard ${requestId}] Adding card to customer ${customerId}`)
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
      console.error(`[SquareSaveCard ${requestId}] Card creation failed:`, err)
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

    if (!cardId) {
      return withCors({ success: false, error: 'Failed to get card ID' }, 400)
    }

    // Save card ID to profile
    await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ square_card_id: cardId }),
    })

    console.log(`[SquareSaveCard ${requestId}] Card saved: ${cardId}`)

    return withCors({
      success: true,
      cardId,
      customerId,
    })

  } catch (err) {
    console.error(`[SquareSaveCard ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Failed to save card' }, 500)
  }
})