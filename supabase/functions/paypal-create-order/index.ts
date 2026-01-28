import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, coins, user_id, package_id } = await req.json()
    
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const isSandbox = Deno.env.get('PAYPAL_MODE') === 'sandbox'
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured')
    }

    const auth = btoa(`${clientId}:${clientSecret}`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })

    if (!tokenRes.ok) {
        throw new Error('Failed to authenticate with PayPal')
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: amount.toString()
            },
            description: `${coins.toLocaleString()} Troll Coins`,
            custom_id: JSON.stringify({ user_id, package_id, coins })
        }]
    }

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
    })

    if (!orderRes.ok) {
        const errText = await orderRes.text()
        console.error('Create Order Error:', errText)
        throw new Error('Failed to create PayPal order')
    }


    const orderData = await orderRes.json()
    // Find approval URL from PayPal response
    let approvalUrl = null;
    if (orderData && orderData.links && Array.isArray(orderData.links)) {
      const approve = orderData.links.find((l) => l.rel === 'approve');
      if (approve) approvalUrl = approve.href;
    }

    return new Response(
      JSON.stringify({ orderId: orderData.id, approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
