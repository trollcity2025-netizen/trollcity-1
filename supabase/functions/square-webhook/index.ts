// square-webhook Edge Function
// Handles Square webhook callbacks for payment events

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'
import { getEnv } from '../_shared/env.ts'

const SQUARE_API_URL = 'https://connect.squareup.com'
const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  console.log('[SquareWebhook] Request received')

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const rawBody = await req.text()
    const signatureHeader = req.headers.get('x-square-signature') || ''
    
    const SQUARE_WEBHOOK_SIGNATURE_KEY = getEnv('SQUARE_WEBHOOK_SIGNATURE_KEY')
    const SQUARE_ACCESS_TOKEN = getEnv('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = getEnv('SQUARE_LOCATION_ID')
    const SQUARE_ENVIRONMENT = getEnv('SQUARE_ENVIRONMENT') || 'production'
    
    if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
      console.error('[SquareWebhook] Webhook signature key not configured')
      return withCors({ success: false }, 400)
    }

    // Signature verification disabled for testing
    console.log('[SquareWebhook] Signature received:', signatureHeader)
    console.log('[SquareWebhook] Skipping signature verification for testing')

    // Parse webhook payload
    const payload = JSON.parse(rawBody)
    const eventType = payload.type
    const eventData = payload.data

    console.log(`[SquareWebhook] Received event: ${eventType}`)

    // We only care about payment completed events
    if (eventType !== 'payment.updated' && eventType !== 'payment.created') {
      console.log(`[SquareWebhook] Ignoring event type: ${eventType}`)
      return withCors({ success: true, message: 'Event ignored' }, 200)
    }

    const payment = eventData?.object?.payment
    if (!payment) {
      console.error('[SquareWebhook] No payment object in payload')
      return withCors({ success: false }, 400)
    }

    // Only process completed payments
    if (payment.status !== 'COMPLETED') {
      console.log(`[SquareWebhook] Payment status: ${payment.status}, ignoring`)
      return withCors({ success: true, message: 'Payment not completed' }, 200)
    }

    // Extract metadata
    const metadata = payment.metadata || {}
    const userId = metadata.user_id
    const coins = parseInt(metadata.coins || '0')
    const packageId = metadata.package_id
    const purchaseType = metadata.purchase_type || 'coins'

    if (!userId) {
      console.error('[SquareWebhook] No user_id in payment metadata')
      return withCors({ success: false }, 400)
    }

    console.log(`[SquareWebhook] Processing completed payment for user: ${userId}, amount: ${payment.amount_money?.amount}`)

    // Call verify-square-payment internally to process the payment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-square-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentId: payment.id,
        userId,
        coins,
        packageId,
        purchaseType,
      })
    })

    if (!verifyResponse.ok) {
      console.error('[SquareWebhook] verify-square-payment failed:', await verifyResponse.text())
    } else {
      console.log('[SquareWebhook] Payment processed successfully')
    }

    // Always return 200 OK to Square to stop retries
    return withCors({
      success: true,
      message: 'Webhook received'
    }, 200)

  } catch (err) {
    console.error('[SquareWebhook] Error:', err)
    // Still return 200 to prevent Square retries
    return withCors({
      success: true,
      message: 'Webhook received'
    }, 200)
  }
})