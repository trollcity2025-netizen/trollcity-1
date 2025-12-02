// Add Card Edge Function
// Vaults a card using Square Card on File API
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const requestId = `add_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[AddCard ${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
  })

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return withCors({ success: false, error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return withCors({ success: false, error: 'Invalid authentication' }, 401)
    }

    // Parse request body
    const { cardNonce } = await req.json()
    
    if (!cardNonce) {
      return withCors({ success: false, error: 'Missing required field: cardNonce' }, 400)
    }

    // Get user profile with Square customer ID
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('square_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(`[AddCard ${requestId}] Error fetching profile:`, profileError)
      return withCors({ success: false, error: 'Failed to fetch user profile' }, 500)
    }

    // Create Square customer if doesn't exist
    let customerId = profile?.square_customer_id
    if (!customerId) {
      // Call create-square-customer internally
      const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
      const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
      const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production'
      const squareBaseUrl = SQUARE_ENVIRONMENT === 'production' 
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com'

      const customerResponse = await fetch(`${squareBaseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify({
          given_name: profile?.username || 'User',
          email_address: user.email || undefined,
        })
      })

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }))
        return withCors({ 
          success: false, 
          error: errorData.errors?.[0]?.detail || 'Failed to create Square customer' 
        }, 400)
      }

      const customerData = await customerResponse.json()
      customerId = customerData.customer?.id

      if (!customerId) {
        return withCors({ success: false, error: 'Failed to create customer' }, 500)
      }

      // Save customer ID
      await supabaseAdmin
        .from('user_profiles')
        .update({ square_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get Square credentials
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox'

    // Check for missing credentials
    const missing = []
    if (!SQUARE_ACCESS_TOKEN) missing.push('SQUARE_ACCESS_TOKEN')
    if (!SQUARE_LOCATION_ID) missing.push('SQUARE_LOCATION_ID')
    
    if (missing.length > 0) {
      return withCors({ 
        success: false, 
        error: `Missing Square credentials in Supabase Edge Functions Secrets: ${missing.join(', ')}`,
        missingSecrets: missing,
        setupInstructions: {
          where: 'Supabase Dashboard → Settings → Edge Functions → Secrets',
          commands: missing.map(key => `npx supabase secrets set ${key}=your_value_here`)
        }
      }, 500)
    }

    // Square API base URL
    const squareBaseUrl = SQUARE_ENVIRONMENT === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    // Vault the card using Square Card on File API
    const vaultRequest = {
      source_id: cardNonce,
      card: {
        customer_id: customerId,
      }
    }

    const squareResponse = await fetch(`${squareBaseUrl}/v2/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18',
      },
      body: JSON.stringify(vaultRequest)
    })

    if (!squareResponse.ok) {
      const errorData = await squareResponse.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }))
      console.error(`[AddCard ${requestId}] Square API error:`, errorData)
      
      // Parse Square error codes
      const errorCode = errorData.errors?.[0]?.code
      const errorDetail = errorData.errors?.[0]?.detail || 'Failed to vault card'
      
      return withCors({ 
        success: false, 
        error: errorDetail,
        errorCode
      }, 400)
    }

    const squareData = await squareResponse.json()
    const cardId = squareData.card?.id
    const card = squareData.card

    if (!cardId) {
      return withCors({ success: false, error: 'Failed to get card ID from Square' }, 500)
    }

    // Update user profile with Square card ID
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ square_card_id: cardId })
      .eq('id', user.id)

    if (updateError) {
      console.error(`[AddCard ${requestId}] Error updating profile:`, updateError)
      return withCors({ success: false, error: 'Failed to save card ID' }, 500)
    }

    console.log(`[AddCard ${requestId}] ✅ Card vaulted successfully: ${cardId}`)

    return withCors({
      success: true,
      cardId,
      card: {
        id: cardId,
        last4: card?.last_4,
        brand: card?.card_brand,
        expMonth: card?.exp_month,
        expYear: card?.exp_year,
      },
      message: 'Card successfully added'
    })
  } catch (error: any) {
    console.error(`[AddCard ${requestId}] ❌ Unhandled exception:`, error)
    return withCors({ 
      success: false,
      error: error.message || 'Unknown error',
      requestId
    }, 500)
  }
})

