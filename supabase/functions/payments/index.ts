// Payments Edge Function - Square Status Check & Card Saving
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withCors, handleCorsPreflight, corsHeaders } from '../_shared/cors.ts'

/**
 * Handle saving Square card to user_payment_methods table
 * This is called when frontend POSTs to /payments with userId and nonce
 */
async function handleSaveCard(req: Request, supabase: any, requestId: string) {
  try {
    console.log(`[Payments ${requestId}] Handling POST request for card saving`)
    
    // Get auth token
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return withCors({ success: false, error: 'Missing authorization' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return withCors({ success: false, error: 'Invalid user' }, 401)
    }

    // Get Square credentials
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production'

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      return withCors({ success: false, error: 'Square credentials not configured' }, 500)
    }

    const SQUARE_API_URL = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com'
     

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { userId, nonce } = body

    if (!nonce) {
      return withCors({ success: false, error: 'nonce is required' }, 400)
    }

    // Verify userId matches authenticated user
    if (userId && userId !== user.id) {
      return withCors({ success: false, error: 'User ID mismatch' }, 403)
    }

    // Get or create Square customer
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('square_customer_id, username')
      .eq('id', user.id)
      .single()

    let customerId = profile?.square_customer_id

    if (!customerId) {
      console.log(`[Payments ${requestId}] Creating Square customer for user ${user.id}`)
      const customerResponse = await fetch(`${SQUARE_API_URL}/v2/customers`, {
        method: 'POST',
        headers: {
          'Square-Version': '2023-10-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          given_name: profile?.username || 'User',
          email_address: user.email,
        }),
      })

      if (!customerResponse.ok) {
        const error = await customerResponse.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }))
        console.error(`[Payments ${requestId}] Square customer creation error:`, error)
        return withCors({ success: false, error: 'Failed to create Square customer' }, 400)
      }

      const customerData = await customerResponse.json()
      customerId = customerData.customer?.id

      if (!customerId) {
        return withCors({ success: false, error: 'Failed to get customer ID' }, 400)
      }

      // Save customer ID to profile
      await supabase
        .from('user_profiles')
        .update({ square_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create card from token
    console.log(`[Payments ${requestId}] Creating Square card for customer ${customerId}`)
    const cardResponse = await fetch(`${SQUARE_API_URL}/v2/cards`, {
      method: 'POST',
      headers: {
        'Square-Version': '2023-10-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: nonce,
        card: {
          customer_id: customerId,
        },
      }),
    })

    if (!cardResponse.ok) {
      const error = await cardResponse.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }))
      console.error(`[Payments ${requestId}] Square card creation error:`, error)
      return withCors({ success: false, error: 'Failed to save card' }, 400)
    }

    const cardData = await cardResponse.json()
    const card = cardData.card

    if (!card) {
      return withCors({ success: false, error: 'Failed to get card data' }, 400)
    }

    console.log(`[Payments ${requestId}] Card created:`, {
      cardId: card.id,
      brand: card.card_brand,
      last4: card.last_4,
    })

    // Mark previous default cards as non-default
    await supabase
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true)

    // Save card to user_payment_methods (the table the frontend queries)
    const displayName = `${card.card_brand || 'Card'} •••• ${card.last_4 || '****'}`
    
    console.log(`[Payments ${requestId}] Saving to user_payment_methods:`, {
      user_id: user.id,
      display_name: displayName,
      brand: card.card_brand,
      last4: card.last_4,
    })
    
    const { data: savedCard, error: saveError } = await supabase
      .from('user_payment_methods')
      .insert({
        user_id: user.id,
        provider: 'square',
        display_name: displayName,
        brand: card.card_brand || 'UNKNOWN',
        last4: card.last_4 || '',
        exp_month: parseInt(card.exp_month || '0'),
        exp_year: parseInt(card.exp_year || '0'),
        square_customer_id: customerId,
        square_card_id: card.id,
        is_default: true,
      })
      .select()
      .single()

    if (saveError) {
      console.error(`[Payments ${requestId}] Payment method save error:`, saveError)
      console.error(`[Payments ${requestId}] Error details:`, {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
      })
      return withCors({ success: false, error: `Failed to save payment method: ${saveError.message}` }, 400)
    }

    if (!savedCard) {
      console.error(`[Payments ${requestId}] No card returned from insert`)
      return withCors({ success: false, error: 'Card saved but not returned' }, 500)
    }

    console.log(`[Payments ${requestId}] ✅ Card saved successfully:`, {
      id: savedCard.id,
      display_name: savedCard.display_name,
      brand: savedCard.brand,
      last4: savedCard.last4,
    })

    // Return the saved card in the format the frontend expects
    const methodResponse = {
      id: savedCard.id,
      provider: savedCard.provider || 'square',
      display_name: savedCard.display_name || displayName,
      brand: savedCard.brand || card.card_brand || 'UNKNOWN',
      last4: savedCard.last4 || card.last_4 || '',
      exp_month: savedCard.exp_month || parseInt(card.exp_month || '0'),
      exp_year: savedCard.exp_year || parseInt(card.exp_year || '0'),
      is_default: savedCard.is_default !== undefined ? savedCard.is_default : true,
    }

    console.log(`[Payments ${requestId}] Returning method response:`, methodResponse)

    return withCors({
      success: true,
      method: methodResponse,
    }, 200)
  } catch (e: any) {
    console.error(`[Payments ${requestId}] ❌ Save card error:`, e)
    return withCors({ success: false, error: 'Internal error' }, 500)
  }
}

Deno.serve(async (req) => {
  const requestId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[Payments ${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  })

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[Payments ${requestId}] CORS preflight - returning 204`)
    return handleCorsPreflight()
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error(`[Payments ${requestId}] Missing Supabase credentials:`, {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    })
    return withCors({ error: 'Missing Supabase configuration' }, 500)
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  console.log(`[Payments ${requestId}] Supabase client created`)

  // Handle POST requests for saving cards
  if (req.method === 'POST') {
    return handleSaveCard(req, supabase, requestId)
  }

  // GET requests are for status checks
  try {

    // Check Square credentials
    // Debug: List all available environment variables
    try {
      const allEnvKeys = Object.keys(Deno.env.toObject())
      const squareEnvKeys = allEnvKeys.filter(k => k.includes('SQUARE'))
      console.log(`[Payments ${requestId}] 🔍 Debug - Available env keys with SQUARE:`, squareEnvKeys)
      console.log(`[Payments ${requestId}] 🔍 Debug - All env keys count:`, allEnvKeys.length)
      console.log(`[Payments ${requestId}] 🔍 Debug - Sample env keys:`, allEnvKeys.slice(0, 10))
    } catch (e) {
      console.warn(`[Payments ${requestId}] Could not list env keys:`, e)
    }
    
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_APPLICATION_ID = Deno.env.get('SQUARE_APPLICATION_ID')
    const SQUARE_APPLICATION_SECRET = Deno.env.get('SQUARE_APPLICATION_SECRET')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production'
    
    console.log(`[Payments ${requestId}] 🔍 Debug - Direct env access:`, {
      'SQUARE_ACCESS_TOKEN': SQUARE_ACCESS_TOKEN ? 'EXISTS' : 'MISSING',
      'SQUARE_APPLICATION_ID': SQUARE_APPLICATION_ID ? 'EXISTS' : 'MISSING',
      'SQUARE_LOCATION_ID': SQUARE_LOCATION_ID ? 'EXISTS' : 'MISSING',
      'SQUARE_ENVIRONMENT': SQUARE_ENVIRONMENT,
    })

    const hasToken = !!SQUARE_ACCESS_TOKEN
    const hasAppId = !!SQUARE_APPLICATION_ID
    const hasLocationId = !!SQUARE_LOCATION_ID
    
    console.log(`[Payments ${requestId}] Square credentials check:`, {
      hasToken,
      hasAppId,
      hasLocationId,
      env: SQUARE_ENVIRONMENT,
      tokenPrefix: SQUARE_ACCESS_TOKEN ? SQUARE_ACCESS_TOKEN.substring(0, 10) + '...' : 'none',
      appIdPrefix: SQUARE_APPLICATION_ID ? SQUARE_APPLICATION_ID.substring(0, 10) + '...' : 'none',
      locationId: SQUARE_LOCATION_ID || 'none',
      rawTokenExists: SQUARE_ACCESS_TOKEN !== undefined && SQUARE_ACCESS_TOKEN !== null,
      rawAppIdExists: SQUARE_APPLICATION_ID !== undefined && SQUARE_APPLICATION_ID !== null,
      rawLocationIdExists: SQUARE_LOCATION_ID !== undefined && SQUARE_LOCATION_ID !== null,
    })

    // Test Square API if credentials exist
    let apiOk = false
    let details = ''
    
    if (hasToken && hasAppId && hasLocationId) {
      try {
        // Use correct Square API URL based on environment
        const squareBaseUrl = SQUARE_ENVIRONMENT === 'production' 
          ? 'https://connect.squareup.com'
          
        
        const testUrl = `${squareBaseUrl}/v2/locations`
        console.log(`[Payments ${requestId}] Testing Square API:`, {
          url: testUrl,
          env: SQUARE_ENVIRONMENT,
          baseUrl: squareBaseUrl,
        })
        
        // Test Square API with a simple request to locations endpoint
        const testResponse = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-10-18',
          },
        })

        console.log(`[Payments ${requestId}] Square API response:`, {
          status: testResponse.status,
          statusText: testResponse.statusText,
          ok: testResponse.ok,
          headers: Object.fromEntries(testResponse.headers.entries()),
        })

        if (testResponse.ok) {
          const responseData = await testResponse.json().catch(() => null)
          console.log(`[Payments ${requestId}] ✅ Square API connection successful:`, {
            locationsCount: responseData?.locations?.length || 0,
          })
          apiOk = true
          details = 'Square API connection successful'
        } else {
          let errorData = ''
          try {
            const errorJson = await testResponse.json()
            errorData = JSON.stringify(errorJson)
            console.error(`[Payments ${requestId}] ❌ Square API error (JSON):`, errorJson)
          } catch {
            errorData = await testResponse.text()
            console.error(`[Payments ${requestId}] ❌ Square API error (text):`, errorData)
          }
          details = `Square API test failed: ${testResponse.status} ${errorData}`
        }
      } catch (error: any) {
        console.error(`[Payments ${requestId}] ❌ Square API exception:`, {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause,
        })
        details = `Square API error: ${error.message || 'Network error'}`
      }
    } else {
      const missing: string[] = []
      const missingDetails: Record<string, {
        name: string
        where: string
        command: string
        location: string
      }> = {}
      
      if (!hasToken) {
        missing.push('SQUARE_ACCESS_TOKEN')
        missingDetails['SQUARE_ACCESS_TOKEN'] = {
          name: 'SQUARE_ACCESS_TOKEN',
          where: 'Supabase Edge Functions Secrets',
          command: 'npx supabase secrets set SQUARE_ACCESS_TOKEN=your_token_here',
          location: 'Supabase Dashboard → Settings → Edge Functions → Secrets'
        }
      }
      if (!hasAppId) {
        missing.push('SQUARE_APPLICATION_ID')
        missingDetails['SQUARE_APPLICATION_ID'] = {
          name: 'SQUARE_APPLICATION_ID',
          where: 'Supabase Edge Functions Secrets',
          command: 'npx supabase secrets set SQUARE_APPLICATION_ID=your_app_id_here',
          location: 'Supabase Dashboard → Settings → Edge Functions → Secrets'
        }
      }
      if (!hasLocationId) {
        missing.push('SQUARE_LOCATION_ID')
        missingDetails['SQUARE_LOCATION_ID'] = {
          name: 'SQUARE_LOCATION_ID',
          where: 'Supabase Edge Functions Secrets',
          command: 'npx supabase secrets set SQUARE_LOCATION_ID=your_location_id_here',
          location: 'Supabase Dashboard → Settings → Edge Functions → Secrets'
        }
      }
      
      console.warn(`[Payments ${requestId}] Missing Square credentials:`, missing)
      details = `Missing Square credentials in Supabase Edge Functions Secrets: ${missing.join(', ')}`
      
      return withCors({
        env: SQUARE_ENVIRONMENT,
        hasToken,
        hasAppId,
        hasLocationId,
        clientReady: false,
        apiOk: false,
        details,
        requestId,
        missingSecrets: missing,
        missingSecretsDetails: missingDetails,
        setupInstructions: {
          where: 'Supabase Dashboard',
          steps: [
            '1. Go to Supabase Dashboard → Your Project → Settings → Edge Functions',
            '2. Click "Secrets" tab',
            '3. Add each missing secret',
            '4. Or use CLI: npx supabase secrets set KEY=value'
          ]
        }
      })
    }

    const response = {
      env: SQUARE_ENVIRONMENT,
      hasToken,
      hasAppId,
      hasLocationId,
      clientReady: hasToken && hasAppId && hasLocationId,
      apiOk,
      details: details || undefined,
      requestId, // Include for debugging
    }

    console.log(`[Payments ${requestId}] Returning response:`, {
      apiOk,
      clientReady: response.clientReady,
      hasDetails: !!details,
    })

    return withCors(response)
  } catch (error: any) {
    console.error(`[Payments ${requestId}] ❌ Unhandled exception:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    
    return withCors({ 
      error: error.message,
      apiOk: false,
      env: Deno.env.get('SQUARE_ENVIRONMENT') || 'unknown',
      requestId,
      debug: {
        errorName: error.name,
        errorStack: error.stack,
      },
    }, 500)
  }
})
