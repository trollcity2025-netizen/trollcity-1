import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const APP_URL = process.env.APP_URL
const STRIPE_TROLL_PASS_PRICE_ID = process.env.STRIPE_TROLL_PASS_PRICE_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

function getBearerToken(req: VercelRequest): string {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new Error('Missing auth token')
  }

  return token
}

async function getOrCreateCustomer(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    metadata: { user_id: userId },
  })

  const { error: insertError } = await supabaseAdmin
    .from('stripe_customers')
    .insert({ user_id: userId, stripe_customer_id: customer.id })

  if (insertError) {
    console.error('[stripe] failed to insert stripe_customer', insertError)
  }

  return customer.id
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function parseJsonBody(req: VercelRequest): Promise<any> {
  const rawBody = await readRawBody(req)
  if (!rawBody.length) return {}
  try {
    return JSON.parse(rawBody.toString('utf8'))
  } catch {
    return {}
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const action = typeof req.query.action === 'string' ? req.query.action : ''

  if (action === 'webhook') {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed')
    }

    try {
      if (!STRIPE_WEBHOOK_SECRET) {
        return res.status(500).send('STRIPE_WEBHOOK_SECRET not configured')
      }

      const rawBody = await readRawBody(req)
      const sig = req.headers['stripe-signature'] as string | undefined

      if (!sig) {
        return res.status(400).send('Missing Stripe signature')
      }

      const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const sessionId = session.id
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null
        const purchaseType = session.metadata?.purchase_type

        const { data: order, error: orderError } = await supabaseAdmin
          .from('coin_orders')
          .select('id, user_id, coins, status')
          .eq('stripe_checkout_session_id', sessionId)
          .single()

        if (orderError || !order) {
          console.warn('[stripe webhook] order not found for session', sessionId, orderError?.message)
          return res.status(200).json({ received: true })
        }

          if (order.status !== 'paid' && order.status !== 'fulfilled') {
            const { error: updateError } = await supabaseAdmin
              .from('coin_orders')
              .update({
                status: 'paid',
                stripe_payment_intent_id: paymentIntentId,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', order.id)

            if (updateError) {
              console.error('[stripe webhook] failed to mark order paid', updateError)
              return res.status(200).json({ received: true })
            }
          }

          if (purchaseType === 'troll_pass_bundle') {
            const { error: passError } = await supabaseAdmin.rpc('apply_troll_pass_bundle', {
              p_user_id: order.user_id,
            })

            if (passError) {
              console.error('[stripe webhook] apply_troll_pass_bundle failed', passError)
            }

            const { error: fulfillError } = await supabaseAdmin
              .from('coin_orders')
              .update({
                status: 'fulfilled',
                fulfilled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', order.id)

            if (fulfillError) {
              console.error('[stripe webhook] failed to fulfill troll pass order', fulfillError)
            }
          } else {
            const { error: creditError } = await supabaseAdmin.rpc('credit_coins', {
              p_user_id: order.user_id,
              p_coins: order.coins,
              p_order_id: order.id,
            })

            if (creditError) {
              console.error('[stripe webhook] credit_coins failed', creditError)
            }
          }
      }

      return res.status(200).json({ received: true })
    } catch (err: any) {
      console.error('[stripe webhook] error', err)
      return res.status(400).send(`Webhook Error: ${err?.message || 'Unknown error'}`)
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const body = await parseJsonBody(req)
    const token = getBearerToken(req)
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    switch (action) {
      case 'create-checkout-session': {
        if (!APP_URL) {
          return res.status(500).json({ error: 'APP_URL must be set' })
        }

        const { packageId } = body || {}
        if (!packageId) {
          return res.status(400).json({ error: 'Missing packageId' })
        }

        const { data: pkg, error: pkgError } = await supabaseAdmin
          .from('coin_packages')
          .select('id, coins, price_usd, amount_cents, stripe_price_id, is_active')
          .eq('id', packageId)
          .single()

        if (pkgError || !pkg) {
          return res.status(404).json({ error: 'Package not found' })
        }

        if (!pkg.is_active) {
          return res.status(400).json({ error: 'Package inactive' })
        }

        if (!pkg.stripe_price_id) {
          return res.status(400).json({ error: 'Package missing stripe_price_id' })
        }

        const amountCents =
          typeof pkg.amount_cents === 'number'
            ? pkg.amount_cents
            : Math.round(Number(pkg.price_usd || 0) * 100)

        const { data: stripeCustomer } = await supabaseAdmin
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', authData.user.id)
          .maybeSingle()

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
          success_url: `${APP_URL}/wallet?success=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/wallet?canceled=1`,
          customer: stripeCustomer?.stripe_customer_id || undefined,
          client_reference_id: authData.user.id,
          metadata: {
            user_id: authData.user.id,
            package_id: pkg.id,
            coins: String(pkg.coins ?? 0),
          },
        })

        const { error: orderError } = await supabaseAdmin.from('coin_orders').insert({
          user_id: authData.user.id,
          package_id: pkg.id,
          coins: pkg.coins,
          amount_cents: amountCents,
          status: 'created',
          stripe_checkout_session_id: session.id,
        })

        if (orderError) {
          console.error('[stripe] failed to insert coin_orders:', orderError)
          return res.status(500).json({ error: 'Failed to create order' })
        }

        return res.status(200).json({ url: session.url })
      }

      case 'create-troll-pass-session': {
        if (!APP_URL) {
          return res.status(500).json({ error: 'APP_URL must be set' })
        }

        if (!STRIPE_TROLL_PASS_PRICE_ID) {
          return res.status(500).json({ error: 'STRIPE_TROLL_PASS_PRICE_ID must be set' })
        }

        const price = await stripe.prices.retrieve(STRIPE_TROLL_PASS_PRICE_ID)
        const amountCents = typeof price.unit_amount === 'number' ? price.unit_amount : 0

        const { data: stripeCustomer } = await supabaseAdmin
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', authData.user.id)
          .maybeSingle()

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: STRIPE_TROLL_PASS_PRICE_ID, quantity: 1 }],
          success_url: `${APP_URL}/wallet?success=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/wallet?canceled=1`,
          customer: stripeCustomer?.stripe_customer_id || undefined,
          client_reference_id: authData.user.id,
          metadata: {
            user_id: authData.user.id,
            purchase_type: 'troll_pass_bundle',
            coins: '1500',
          },
        })

        const { error: orderError } = await supabaseAdmin.from('coin_orders').insert({
          user_id: authData.user.id,
          package_id: null,
          coins: 1500,
          amount_cents: amountCents,
          status: 'created',
          stripe_checkout_session_id: session.id,
        })

        if (orderError) {
          console.error('[stripe] failed to insert troll pass order:', orderError)
          return res.status(500).json({ error: 'Failed to create order' })
        }

        return res.status(200).json({ url: session.url })
      }

      case 'create-setup-intent': {
        const customerId = await getOrCreateCustomer(authData.user.id)
        const intent = await stripe.setupIntents.create({
          customer: customerId,
          usage: 'off_session',
        })

        return res.status(200).json({ clientSecret: intent.client_secret })
      }

      case 'save-payment-method': {
        const { paymentMethodId } = body || {}
        if (!paymentMethodId) {
          return res.status(400).json({ error: 'Missing paymentMethodId' })
        }

        const customerId = await getOrCreateCustomer(authData.user.id)

        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
        if (!paymentMethod || paymentMethod.customer && paymentMethod.customer !== customerId) {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
        }

        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        })

        await supabaseAdmin
          .from('user_payment_methods')
          .update({ is_default: false })
          .eq('user_id', authData.user.id)

        const card = paymentMethod.card
        const displayName = card
          ? `${card.brand?.toUpperCase() || 'Card'} •••• ${card.last4 || ''}`
          : paymentMethod.type

        const methodPayload = {
          user_id: authData.user.id,
          provider: 'stripe',
          token_id: paymentMethodId,
          display_name: displayName,
          brand: card?.brand || null,
          last4: card?.last4 || null,
          exp_month: card?.exp_month || null,
          exp_year: card?.exp_year || null,
          stripe_customer_id: customerId,
          stripe_payment_method_id: paymentMethodId,
          is_default: true,
        }

        const upsertMethod = async (payload: Record<string, unknown>) => supabaseAdmin
          .from('user_payment_methods')
          .upsert(payload, { onConflict: 'user_id,provider,token_id' })
          .select()
          .single()

        let { data: savedMethod, error: saveError } = await upsertMethod(methodPayload)

        if (saveError?.message?.includes('stripe_customer_id') || saveError?.message?.includes('stripe_payment_method_id')) {
          const { stripe_customer_id, stripe_payment_method_id, ...fallbackPayload } = methodPayload
          ;({ data: savedMethod, error: saveError } = await upsertMethod(fallbackPayload))
        }

        if (saveError) {
          console.error('[stripe] save-payment-method error:', saveError)
          return res.status(500).json({ error: 'Failed to save payment method' })
        }

        return res.status(200).json({ success: true, method: savedMethod })
      }

      case 'delete-payment-method': {
        const { id } = body || {}
        if (!id) {
          return res.status(400).json({ error: 'Missing id' })
        }

        const { data: method, error: methodError } = await supabaseAdmin
          .from('user_payment_methods')
          .select('id, user_id, stripe_payment_method_id')
          .eq('id', id)
          .single()

        if (methodError || !method) {
          return res.status(404).json({ error: 'Payment method not found' })
        }

        if (method.user_id !== authData.user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }

        if (method.stripe_payment_method_id) {
          await stripe.paymentMethods.detach(method.stripe_payment_method_id)
        }

        const { error: deleteError } = await supabaseAdmin
          .from('user_payment_methods')
          .delete()
          .eq('id', id)

        if (deleteError) {
          return res.status(500).json({ error: 'Failed to delete payment method' })
        }

        return res.status(200).json({ success: true })
      }

      case 'set-default-payment-method': {
        const { id } = body || {}
        if (!id) {
          return res.status(400).json({ error: 'Missing id' })
        }

        const { data: method, error: methodError } = await supabaseAdmin
          .from('user_payment_methods')
          .select('id, user_id, stripe_payment_method_id, stripe_customer_id')
          .eq('id', id)
          .single()

        if (methodError || !method) {
          return res.status(404).json({ error: 'Payment method not found' })
        }

        if (method.user_id !== authData.user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }

        if (method.stripe_customer_id && method.stripe_payment_method_id) {
          await stripe.customers.update(method.stripe_customer_id, {
            invoice_settings: { default_payment_method: method.stripe_payment_method_id },
          })
        }

        await supabaseAdmin
          .from('user_payment_methods')
          .update({ is_default: false })
          .eq('user_id', authData.user.id)

        const { error: updateError } = await supabaseAdmin
          .from('user_payment_methods')
          .update({ is_default: true })
          .eq('id', id)

        if (updateError) {
          return res.status(500).json({ error: 'Failed to set default' })
        }

        return res.status(200).json({ success: true })
      }

      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (error: any) {
    console.error('[stripe] action error:', error)
    return res.status(500).json({ error: error?.message || 'Server error' })
  }
}
