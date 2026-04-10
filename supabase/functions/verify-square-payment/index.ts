// verify-square-payment Edge Function
// Verifies Square payment completion and credits coins

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  const requestId = `sq_verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[VerifySquarePayment ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { orderId, paymentId, userId, expectedAmount, coins, packageId, purchaseType } = body

    if (!userId) {
      return withCors({ success: false, error: 'userId is required' }, 400)
    }
    if (!orderId && !paymentId) {
      return withCors({ success: false, error: 'orderId or paymentId is required' }, 400)
    }

    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      return withCors({ success: false, error: 'Payment system not configured' }, 500)
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_URL : SQUARE_API_URL

    // Verify payment with Square API
    let paymentVerified = false
    let paymentAmount = 0

    if (paymentId) {
      const paymentRes = await fetch(`${baseUrl}/v2/payments/${paymentId}`, {
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        },
      })

      if (paymentRes.ok) {
        const paymentData = await paymentRes.json()
        const payment = paymentData.payment
        if (payment?.status === 'COMPLETED') {
          paymentVerified = true
          paymentAmount = (payment.amount_money?.amount || 0) / 100
        }
      }
    } else     if (orderId) {
      // Check order status
      const orderRes = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        },
      })

      if (orderRes.ok) {
        const orderData = await orderRes.json()
        const order = orderData.order
        
        if (order?.state === 'COMPLETED') {
          paymentVerified = true
          paymentAmount = (order.total_money?.amount || 0) / 100
        }
        
        // Explicit payment failure detection
        if (order?.state === 'CANCELED' || order?.state === 'DECLINED' || order?.state === 'FAILED') {
          return withCors({ 
            success: false, 
            verified: false,
            error: 'Payment declined' 
          }, 400)
        }
      }
    }

    if (!paymentVerified) {
      return withCors({ 
        success: false, 
        verified: false,
        error: 'Payment not completed or not found' 
      }, 400)
    }

    // Check if expected amount matches (if provided)
    if (expectedAmount && Math.abs(paymentAmount - expectedAmount) > 0.01) {
      console.warn(`[VerifySquarePayment ${requestId}] Amount mismatch: expected ${expectedAmount}, got ${paymentAmount}`)
    }

    // Get order details for coin amount if not provided
    let coinAmount = coins || 0
    let pkgId = packageId || ''
    let pType = purchaseType || 'coins'

    if (orderId && !coinAmount) {
      const orderRes = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        },
      })

      if (orderRes.ok) {
        const orderData = await orderRes.json()
        const order = orderData.order
        const metadata = order?.metadata || {}
        coinAmount = parseInt(metadata.coins || '0')
        pkgId = metadata.package_id || ''
        pType = metadata.purchase_type || 'coins'
      }
    }

    console.log(`[VerifySquarePayment ${requestId}] Payment verified: ${paymentAmount}, coins: ${coinAmount}`)

    // After successful payment, sync payment methods from Square if user has a customer
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      // Get profile with customer ID
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=id,square_customer_id`, {
        headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` }
      })
      const profiles = await profileRes.json()
      const profile = profiles?.[0]
      const customerId = profile?.square_customer_id
      
      // If user has a Square customer, get their cards and save to user_payment_methods
      if (customerId) {
        try {
          const cardsRes = await fetch(`${baseUrl}/v2/cards?customer_id=${customerId}`, {
            headers: {
              'Square-Version': '2024-01-18',
              'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            },
          })
          
          if (cardsRes.ok) {
            const cardsData = await cardsRes.json()
            const cards = cardsData.cards || []
            
            for (const card of cards) {
              // Check if already saved
              const checkRes = await fetch(
                `${supabaseUrl}/rest/v1/user_payment_methods?user_id=eq.${userId}&square_card_id=eq.${card.id}&limit=1`,
                { headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` } }
              )
              const existing = await checkRes.json()
              
              if (!existing || existing.length === 0) {
                // Save new card
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
                    square_card_id: card.id,
                    brand: card.card_brand || 'Card',
                    last4: card.last4 || '****',
                    is_default: cards.length === 1,
                  }),
                })
                console.log(`[VerifySquarePayment ${requestId}] Saved card ${card.id} for user ${userId}`)
              }
            }
          }
        } catch (cardErr) {
          console.error(`[VerifySquarePayment ${requestId}] Failed to sync cards:`, cardErr)
        }
      }
    }

    // Credit coins to user account
    if (coinAmount > 0 && userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      // Get current coins
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=troll_coins`, {
        headers: { 'apikey': supabaseKey!, 'Authorization': `Bearer ${supabaseKey}` }
      })
      const profiles = await profileRes.json()
      const currentCoins = profiles?.[0]?.troll_coins || 0

      // Update coins
      await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ troll_coins: currentCoins + coinAmount }),
      })

      // Record in purchase_ledger (Revenue Sync)
      if (pkgId) {
        await fetch(
          `${supabaseUrl}/rest/v1/purchasable_items?item_key=eq.${pkgId}&select=id`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        )
          .then(res => res.json())
          .then(items => {
            if (items && items.length > 0) {
              return fetch(
                `${supabaseUrl}/rest/v1/purchase_ledger`,
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
                    item_id: items[0].id,
                    usd_amount: paymentAmount,
                    coin_amount: coinAmount,
                    payment_method: 'card',
                    source_context: 'CoinStore',
                    metadata: {
                      order_id: orderId,
                      payment_id: paymentId,
                      square_payment: true
                    }
                  }),
                }
              )
            }
          })
          .catch(err => {
            console.warn(`[VerifySquarePayment ${requestId}] Failed to insert into purchase_ledger:`, err)
          })
      }

      // Record transaction
      await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: userId,
          amount: coinAmount,
          type: 'store_purchase',
          status: 'completed',
          description: `Purchased ${coinAmount} coins via Square`,
          platform_profit: paymentAmount,
          metadata: {
            order_id: orderId,
            payment_id: paymentId,
            amount_usd: paymentAmount,
            package_id: pkgId,
            purchase_type: pType,
          },
        }),
      })

      console.log(`[VerifySquarePayment ${requestId}] Credited ${coinAmount} coins to user ${userId}`)
    }

    return withCors({
      success: true,
      verified: true,
      amount: paymentAmount,
      coins: coinAmount,
      packageId: pkgId,
      purchaseType: pType,
    })

  } catch (err) {
    console.error(`[VerifySquarePayment ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Payment verification error' }, 500)
  }
})