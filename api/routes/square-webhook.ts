import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { getSupabaseAdmin } from '../lib/supabase'
import { addCoins } from '../../src/lib/coinTransactions.js'

const router = Router()
const supabase = getSupabaseAdmin()

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || process.env.VITE_SQUARE_WEBHOOK_SIGNATURE_KEY

function verifySquareSignature(req: Request): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.warn('Square webhook signature key not configured')
    return false
  }

  const signatureHeader = req.headers['x-square-hmacsha256-signature'] as string
  if (!signatureHeader) return false

  const body = (req as any).rawBody?.toString() ?? ''
  const hmac = crypto.createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY)
  hmac.update(body)
  const expected = hmac.digest('base64')
  return expected === signatureHeader
}

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify Square signature for security
    if (!verifySquareSignature(req)) {
      console.error('Invalid Square webhook signature')
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const event = req.body
    const eventId = event?.event_id || event?.id
    const type = event?.type

    console.log(`[Square Webhook] Received event: ${type} (${eventId})`)

    // Store raw event for audit trail (create table if needed)
    const { error: insertError } = await supabase
      .from('square_events')
      .insert({
        event_id: eventId,
        type,
        data: event,
        created_at: new Date().toISOString()
      })

    // Ignore duplicate event errors (23505 = unique constraint violation)
    if (insertError && insertError.code !== '23505') {
      console.error('Failed to store square event', insertError)
    }

    // Handle payment.created or payment.updated with status COMPLETED
    if (type === 'payment.created' || type === 'payment.updated') {
      const payment = event.data?.object?.payment
      
      if (payment?.status === 'COMPLETED') {
        const amountMoney = payment.amount_money
        const amountInCents = amountMoney?.amount ?? 0
        const currency = amountMoney?.currency ?? 'USD'

        // Extract metadata from Square payment
        const userId = payment.metadata?.user_id
        const coinAmount = Number(payment.metadata?.coin_amount ?? 0)
        const packageName = payment.metadata?.package_name || 'Unknown Package'

        if (userId && coinAmount > 0) {
          console.log(`[Square Webhook] Crediting ${coinAmount} coins to user ${userId}`)

          // Use centralized coin transaction system
          const result = await addCoins({
            userId,
            amount: coinAmount,
            type: 'purchase',
            coinType: 'paid',
            metadata: {
              square_payment_id: payment.id,
              package_name: packageName,
              currency,
              amount_cents: amountInCents,
              amount_usd: (amountInCents / 100).toFixed(2),
              webhook_event_id: eventId,
              webhook_type: type
            }
          })

          if (result.success) {
            console.log(`[Square Webhook] Successfully credited ${coinAmount} coins. New balance: ${result.newBalance}`)
          } else {
            console.error(`[Square Webhook] Failed to credit coins:`, result.error)
            // Don't return error to Square - we logged the event
          }
        } else {
          console.warn(`[Square Webhook] Missing userId or coinAmount in payment metadata`, {
            userId,
            coinAmount,
            paymentId: payment.id
          })
        }
      } else {
        console.log(`[Square Webhook] Payment status: ${payment?.status} (not COMPLETED, skipping)`)
      }
    }

    // Acknowledge receipt to Square
    res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('[Square Webhook] Error:', err)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
})

export default router
