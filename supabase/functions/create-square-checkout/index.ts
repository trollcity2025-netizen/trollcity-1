// create-square-checkout Edge Function
// Creates a Square payment checkout for coin purchases

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  const requestId = `sq_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[CreateSquareCheckout ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req)
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405, req)
  }

  try {
    const body = await req.json()
    const { userId, coins, amountUsd, packageId, packageName, purchaseType } = body

    if (!userId) {
      return withCors({ success: false, error: 'userId is required' }, 400, req)
    }
    if (!amountUsd || amountUsd <= 0) {
      return withCors({ success: false, error: 'Invalid amount' }, 400, req)
    }

    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      console.error(`[CreateSquareCheckout ${requestId}] Square credentials not configured`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500, req)
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_URL : SQUARE_API_URL

    // Get user profile for customer info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,username,email,square_customer_id`, {
      headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const profiles = await profileRes.json()
    const profile = profiles?.[0]

    // Create or get Square customer
    let customerId = profile?.square_customer_id
    
    if (!customerId) {
      console.log(`[CreateSquareCheckout ${requestId}] Creating new Square customer`)
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
        console.error(`[CreateSquareCheckout ${requestId}] Customer creation failed:`, err)
        return withCors({ success: false, error: 'Failed to create payment account' }, 400, req)
      }

      const customerData = await customerRes.json()
      customerId = customerData.customer?.id

      // Save customer ID to profile
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

    // Create checkout link
    const checkoutUrl = `${baseUrl}/v2/orders`
    
    const orderRes = await fetch(checkoutUrl, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: {
          location_id: SQUARE_LOCATION_ID,
          reference_id: `${userId}_${packageId || 'coins'}`.slice(0, 40),
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
            coins: String(coins || ''),
            package_id: packageId || '',
            purchase_type: purchaseType || 'coins',
          },
        },
        idempotency_key: `${requestId}_${Date.now()}`,
      }),
    })

    if (!orderRes.ok) {
      const err = await orderRes.json()
      console.error(`[CreateSquareCheckout ${requestId}] Order creation failed:`, err)
      return withCors({ success: false, error: 'Failed to create payment order' }, 400, req)
    }

    const orderData = await orderRes.json()
    const orderId = orderData.order?.id

    if (!orderId) {
      return withCors({ success: false, error: 'Failed to get order ID' }, 400, req)
    }

    // Create payment link
    const linkRes = await fetch(`${baseUrl}/v2/checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: `link_${requestId}_${Date.now()}`,
        order: {
          location_id: SQUARE_LOCATION_ID,
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
        },
        metadata: {
          user_id: userId,
          order_id: orderId,
          coins: String(coins || ''),
          package_id: packageId || '',
          purchase_type: purchaseType || 'coins',
        },
      }),
    })

    if (!linkRes.ok) {
      const err = await linkRes.json()
      console.error(`[CreateSquareCheckout ${requestId}] Payment link failed:`, err)
      // Fall back to just returning the order
      return withCors({
        success: true,
        orderId,
        amount: amountUsd,
        customerId,
        message: 'Order created. Please complete payment manually.',
      }, 200, req)
    }

    const linkData = await linkRes.json()
    
    console.log(`[CreateSquareCheckout ${requestId}] Success: ${linkData.payment_link?.url}`)

    return withCors({
      success: true,
      paymentUrl: linkData.payment_link?.url,
      orderId,
      amount: amountUsd,
      customerId,
    }, 200, req)

  } catch (err) {
    console.error(`[CreateSquareCheckout ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Payment system error' }, 500, req)
  }
})