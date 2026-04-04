// save-card Edge Function
// Saves a card to Square's card-on-file system and stores the result in Supabase
// This is the production-ready Troll City card saving flow

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

// Square API configuration
const SQUARE_API_BASE = 'https://connect.squareup.com'
const SQUARE_SANDBOX_BASE = 'https://connect.squareupsandbox.com'

interface SaveCardRequest {
  userId: string
  cardToken: string  // From Square Web Payments SDK tokenization
}

interface SaveCardResponse {
  success: boolean
  cardId?: string
  customerId?: string
  error?: string
}

Deno.serve(async (req) => {
  const requestId = `save_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[SaveCard ${requestId}] Request started`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    // Parse and validate request
    const body: SaveCardRequest = await req.json()
    const { userId, cardToken } = body

    console.log(`[SaveCard ${requestId}] Processing for user: ${userId}`)

    if (!userId || typeof userId !== 'string') {
      return withCors({ success: false, error: 'Valid userId is required' }, 400)
    }

    if (!cardToken || typeof cardToken !== 'string') {
      return withCors({ success: false, error: 'Valid cardToken is required' }, 400)
    }

    // Get Square configuration
    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      console.error(`[SaveCard ${requestId}] Square configuration missing`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500)
    }

    const squareBaseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_BASE : SQUARE_API_BASE
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[SaveCard ${requestId}] Supabase configuration missing`)
      return withCors({ success: false, error: 'Database not configured' }, 500)
    }

    // ============================================================================
    // STEP 1: Get or create Square customer
    // ============================================================================

    console.log(`[SaveCard ${requestId}] Step 1: Getting Square customer for user ${userId}`)

    // First, check if user already has a Square customer
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username,email,square_customer_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!profileRes.ok) {
      console.error(`[SaveCard ${requestId}] Failed to fetch user profile: ${profileRes.status}`)
      return withCors({ success: false, error: 'Failed to access user profile' }, 500)
    }

    const profiles = await profileRes.json()
    const profile = profiles?.[0]

    if (!profile) {
      console.error(`[SaveCard ${requestId}] User profile not found for user: ${userId}`)
      return withCors({ success: false, error: 'User profile not found' }, 404)
    }

    let customerId = profile.square_customer_id

    // Create Square customer if it doesn't exist
    if (!customerId) {
      console.log(`[SaveCard ${requestId}] Creating new Square customer`)

      const customerPayload = {
        given_name: profile.username || 'TrollCity User',
        email_address: profile.email || `user_${userId}@trollcity.com`,
        reference_id: userId,
        note: 'Troll City user'
      }

      const customerRes = await fetch(`${squareBaseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerPayload),
      })

      if (!customerRes.ok) {
        const errorData = await customerRes.json()
        console.error(`[SaveCard ${requestId}] Square customer creation failed:`, errorData)
        return withCors({
          success: false,
          error: 'Failed to create payment account. Please try again.'
        }, 400)
      }

      const customerData = await customerRes.json()
      customerId = customerData.customer?.id

      if (!customerId) {
        console.error(`[SaveCard ${requestId}] Square customer creation returned no ID`)
        return withCors({ success: false, error: 'Failed to create payment account' }, 500)
      }

      console.log(`[SaveCard ${requestId}] Created Square customer: ${customerId}`)

      // Save the customer ID to the user profile
      const updateProfileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ square_customer_id: customerId }),
      })

      if (!updateProfileRes.ok) {
        console.error(`[SaveCard ${requestId}] Failed to update user profile with customer ID`)
        // Continue anyway - we can still save the card
      }
    } else {
      console.log(`[SaveCard ${requestId}] Using existing Square customer: ${customerId}`)
    }

    // ============================================================================
    // STEP 2: Create card-on-file with Square
    // ============================================================================

    console.log(`[SaveCard ${requestId}] Step 2: Creating card-on-file with Square`)

    // Generate idempotency key for card creation (important for retries)
    const idempotencyKey = `troll_city_card_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.slice(0, 45)

    const cardPayload = {
      idempotency_key: idempotencyKey,
      source_id: cardToken,  // The tokenized card from Web Payments SDK
      card: {
        customer_id: customerId,
      },
    }

    console.log(`[SaveCard ${requestId}] Creating card with idempotency key: ${idempotencyKey}`)

    const cardRes = await fetch(`${squareBaseUrl}/v2/cards`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardPayload),
    })

    if (!cardRes.ok) {
      const errorData = await cardRes.json()
      console.error(`[SaveCard ${requestId}] Square card creation failed:`, errorData)

      // Provide user-friendly error messages
      let errorMessage = 'Failed to save card. Please try again.'
      if (errorData.errors?.[0]?.detail) {
        errorMessage = errorData.errors[0].detail
      }

      return withCors({ success: false, error: errorMessage }, cardRes.status || 400)
    }

    const cardData = await cardRes.json()
    const squareCardId = cardData.card?.id

    if (!squareCardId) {
      console.error(`[SaveCard ${requestId}] Square card creation returned no card ID:`, cardData)
      return withCors({ success: false, error: 'Failed to save card' }, 500)
    }

    console.log(`[SaveCard ${requestId}] ✅ Created Square card-on-file: ${squareCardId}`)

    // Extract card metadata for storage
    const cardBrand = cardData.card?.card_brand || 'Card'
    const last4 = cardData.card?.last4 || '****'
    const expMonth = cardData.card?.exp_month
    const expYear = cardData.card?.exp_year

    console.log(`[SaveCard ${requestId}] Card details: ${cardBrand} ••••${last4}, exp ${expMonth}/${expYear}`)

    // ============================================================================
    // STEP 3: Save to Troll City database
    // ============================================================================

    console.log(`[SaveCard ${requestId}] Step 3: Saving to Troll City database`)

    // Check if user already has payment methods to determine if this should be default
    const existingCardsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const existingCards = await existingCardsRes.json()
    const isDefault = !existingCards || existingCards.length === 0

    console.log(`[SaveCard ${requestId}] Setting as default: ${isDefault} (${existingCards?.length || 0} existing payment methods)`)

    // Check if this card already exists
    const existingCardCheck = await fetch(
      `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&square_card_id=eq.${encodeURIComponent(squareCardId)}&select=id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const existingCardData = await existingCardCheck.json()
    const cardAlreadyExists = existingCardData && existingCardData.length > 0

    console.log(`[SaveCard ${requestId}] Card already exists: ${cardAlreadyExists}`)

    let saveCardRes

    if (cardAlreadyExists) {
      // Update existing card instead of inserting
      console.log(`[SaveCard ${requestId}] Updating existing card: ${existingCardData[0].id}`)
      const updatePayload = {
        display_name: `${cardBrand} •••• ${last4}`,
        brand: cardBrand,
        last4: last4,
        exp_month: expMonth,
        exp_year: expYear,
        is_default: isDefault, // Only update default if this is the new default
        updated_at: new Date().toISOString(),
      }

      saveCardRes = await fetch(`${supabaseUrl}/rest/v1/user_payment_methods?id=eq.${existingCardData[0].id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(updatePayload),
      })
    } else {
      // Save new card to our database
      const savedCardPayload = {
        user_id: userId,
        provider: 'square',
        token_id: squareCardId, // Use card ID as token_id
        display_name: `${cardBrand} •••• ${last4}`,
        brand: cardBrand,
        last4: last4,
        exp_month: expMonth,
        exp_year: expYear,
        square_customer_id: customerId,
        square_card_id: squareCardId,
        is_default: isDefault,
      }

      console.log(`[SaveCard ${requestId}] Saving new card to database:`, savedCardPayload)

      saveCardRes = await fetch(`${supabaseUrl}/rest/v1/user_payment_methods`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(savedCardPayload),
      })
    }

    if (!saveCardRes.ok) {
      const errorText = await saveCardRes.text()
      console.error(`[SaveCard ${requestId}] Failed to save card to database: ${saveCardRes.status} - ${errorText}`)
      console.error(`[SaveCard ${requestId}] Payload:`, savedCardPayload)

      // Check if user exists in user_profiles
      try {
        const userCheckRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        })
        const userData = await userCheckRes.json()
        console.error(`[SaveCard ${requestId}] User check result:`, userData)
      } catch (userCheckErr) {
        console.error(`[SaveCard ${requestId}] User check failed:`, userCheckErr)
      }

      return withCors({
        success: false,
        error: `Failed to save card information: ${errorText}`,
        status: saveCardRes.status
      }, 500)
    }

    console.log(`[SaveCard ${requestId}] ✅ Card saved successfully`)

    // ============================================================================
    // STEP 4: Return success response
    // ============================================================================

    const response: SaveCardResponse = {
      success: true,
      cardId: squareCardId,
      customerId: customerId,
    }

    console.log(`[SaveCard ${requestId}] 🎉 Request completed successfully`)
    return withCors(response)

  } catch (error) {
    console.error(`[SaveCard ${requestId}] Unexpected error:`, error)

    const errorResponse: SaveCardResponse = {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }

    return withCors(errorResponse, 500)
  }
})