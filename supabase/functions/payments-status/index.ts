// Payments Status Edge Function - Square Connection Check
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const requestId = `pay_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[PaymentsStatus ${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
  })

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  try {
    // Debug: Check what environment variables are available
    const allEnvKeys = Object.keys(Deno.env.toObject())
    const squareEnvKeys = allEnvKeys.filter(k => k.includes('SQUARE'))
    console.log(`[PaymentsStatus ${requestId}] 🔍 All env keys with SQUARE:`, squareEnvKeys)
    console.log(`[PaymentsStatus ${requestId}] 🔍 Total env keys:`, allEnvKeys.length)
    
    // Also check for SUPABASE env vars to verify env access works
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    console.log(`[PaymentsStatus ${requestId}] 🔍 SUPABASE_URL exists:`, !!supabaseUrl)
    
    // Get Square credentials
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_APPLICATION_ID = Deno.env.get('SQUARE_APPLICATION_ID')
    const SQUARE_APPLICATION_SECRET = Deno.env.get('SQUARE_APPLICATION_SECRET')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production'

    const hasToken = !!SQUARE_ACCESS_TOKEN
    const hasAppId = !!SQUARE_APPLICATION_ID
    const hasLocationId = !!SQUARE_LOCATION_ID
    
    console.log(`[PaymentsStatus ${requestId}] Square credentials check:`, {
      hasToken,
      hasAppId,
      hasLocationId,
      env: SQUARE_ENVIRONMENT,
      tokenValue: SQUARE_ACCESS_TOKEN ? `${SQUARE_ACCESS_TOKEN.substring(0, 10)}...` : 'NULL',
      appIdValue: SQUARE_APPLICATION_ID ? `${SQUARE_APPLICATION_ID.substring(0, 10)}...` : 'NULL',
      locationIdValue: SQUARE_LOCATION_ID || 'NULL',
    })

    // Test Square API if credentials exist
    let apiOk = false
    let details = ''
    
    if (hasToken && hasAppId && hasLocationId) {
      try {
        // Use correct Square API URL based on environment
        const squareBaseUrl = SQUARE_ENVIRONMENT === 'production' 
          ? 'https://connect.squareup.com'
          : 'https://connect.squareupsandbox.com'
        
        const testUrl = `${squareBaseUrl}/v2/locations`
        
        // Test Square API with a simple request to locations endpoint
        const testResponse = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-10-18',
          },
        })

        if (testResponse.ok) {
          const responseData = await testResponse.json().catch(() => null)
          console.log(`[PaymentsStatus ${requestId}] ✅ Square API connection successful`)
          apiOk = true
          details = 'Square API connection successful'
        } else {
          let errorData = ''
          try {
            const errorJson = await testResponse.json()
            errorData = JSON.stringify(errorJson)
          } catch {
            errorData = await testResponse.text()
          }
          details = `Square API test failed: ${testResponse.status} ${errorData}`
        }
      } catch (error: any) {
        console.error(`[PaymentsStatus ${requestId}] ❌ Square API exception:`, error.message)
        details = `Square API error: ${error.message || 'Network error'}`
      }
    } else {
      const missing = []
      const missingDetails: any = {}
      
      if (!hasToken) {
        missing.push('SQUARE_ACCESS_TOKEN')
        missingDetails.SQUARE_ACCESS_TOKEN = {
          name: 'SQUARE_ACCESS_TOKEN',
          location: 'Supabase Dashboard → Project Settings → Edge Functions → Secrets',
          description: 'Your Square API access token from Square Developer Dashboard',
          command: 'npx supabase secrets set SQUARE_ACCESS_TOKEN=your_token_here',
          where: 'Supabase Edge Functions Secrets'
        }
      }
      if (!hasAppId) {
        missing.push('SQUARE_APPLICATION_ID')
        missingDetails.SQUARE_APPLICATION_ID = {
          name: 'SQUARE_APPLICATION_ID',
          location: 'Supabase Dashboard → Project Settings → Edge Functions → Secrets',
          description: 'Your Square Application ID from Square Developer Dashboard',
          command: 'npx supabase secrets set SQUARE_APPLICATION_ID=your_app_id_here',
          where: 'Supabase Edge Functions Secrets'
        }
      }
      if (!hasLocationId) {
        missing.push('SQUARE_LOCATION_ID')
        missingDetails.SQUARE_LOCATION_ID = {
          name: 'SQUARE_LOCATION_ID',
          location: 'Supabase Dashboard → Project Settings → Edge Functions → Secrets',
          description: 'Your Square Location ID from Square Developer Dashboard',
          command: 'npx supabase secrets set SQUARE_LOCATION_ID=your_location_id_here',
          where: 'Supabase Edge Functions Secrets'
        }
      }
      if (!SQUARE_APPLICATION_SECRET) {
        missingDetails.SQUARE_APPLICATION_SECRET = {
          name: 'SQUARE_APPLICATION_SECRET',
          location: 'Supabase Dashboard → Project Settings → Edge Functions → Secrets',
          description: 'Your Square Application Secret (optional, for OAuth)',
          command: 'npx supabase secrets set SQUARE_APPLICATION_SECRET=your_secret_here',
          where: 'Supabase Edge Functions Secrets',
          optional: true
        }
      }
      
      details = `Missing Square credentials in Supabase Edge Functions Secrets: ${missing.join(', ')}`
      
      // Return detailed missing secrets info
      return withCors({
        apiOk: false,
        env: SQUARE_ENVIRONMENT,
        hasToken,
        hasAppId,
        hasLocationId,
        details,
        status: 'FAILED',
        requestId,
        missingSecrets: missing,
        missingSecretsDetails: missingDetails,
        setupInstructions: {
          where: 'Supabase Dashboard',
          steps: [
            '1. Go to Supabase Dashboard → Your Project → Settings → Edge Functions',
            '2. Click "Secrets" tab',
            '3. Add each missing secret using the commands below',
            '4. Or use Supabase CLI: npx supabase secrets set KEY=value'
          ],
          commands: Object.values(missingDetails).map((secret: any) => secret.command).filter(Boolean)
        }
      })
    }

    // Return response in the exact shape the frontend expects
    const response = {
      apiOk,
      env: SQUARE_ENVIRONMENT,
      hasToken,
      hasAppId,
      hasLocationId,
      hasSecret: !!SQUARE_APPLICATION_SECRET,
      details: details || undefined,
      status: apiOk ? 'CONNECTED' : 'FAILED',
      requestId, // Include for debugging
      allCredentials: {
        SQUARE_ACCESS_TOKEN: hasToken ? 'SET' : 'MISSING',
        SQUARE_APPLICATION_ID: hasAppId ? 'SET' : 'MISSING',
        SQUARE_LOCATION_ID: hasLocationId ? 'SET' : 'MISSING',
        SQUARE_APPLICATION_SECRET: SQUARE_APPLICATION_SECRET ? 'SET' : 'MISSING (optional)',
        SQUARE_ENVIRONMENT: SQUARE_ENVIRONMENT || 'sandbox (default)',
        SQUARE_WEBHOOK_SIGNATURE_KEY: Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY') ? 'SET' : 'MISSING (optional)'
      }
    }

    console.log(`[PaymentsStatus ${requestId}] Returning response:`, {
      apiOk,
      hasDetails: !!details,
    })

    return withCors(response)
  } catch (error: any) {
    console.error(`[PaymentsStatus ${requestId}] ❌ Unhandled exception:`, error.message)
    
    // Return error in the shape the frontend expects
    return withCors({ 
      apiOk: false,
      env: Deno.env.get('SQUARE_ENVIRONMENT') || 'unknown',
      hasToken: false,
      hasAppId: false,
      hasLocationId: false,
      error: error.message || 'Unknown error',
      details: `Error: ${error.message || 'Unknown error'}`,
      status: 'FAILED',
      requestId,
    }, 500)
  }
})

