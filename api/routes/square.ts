import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ------------------ Helpers -------------------

function getSquareLocationId() {
  return process.env.SQUARE_LOCATION_ID || process.env.VITE_SQUARE_LOCATION_ID || ''
}

function ensureSquareReady() {
  return !!process.env.SQUARE_ACCESS_TOKEN && !!getSquareLocationId()
}

async function squareRequest(path: string, method: string, body?: any) {
  const base = 'https://connect.squareup.com'
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
  if (!accessToken) throw new Error('Missing SQUARE_ACCESS_TOKEN')

  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-09-18',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await resp.json().catch(() => ({}))
  return { ok: resp.ok, status: resp.status, json }
}

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ------------------ Router -------------------

const router = Router()

// CREATE CUSTOMER
router.post('/create-customer', async (req, res) => {
  try {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    if (!ensureSquareReady()) return res.status(500).json({ error: 'Square not configured' })

    const sb = supabaseAdmin()
    let email: string | null = null
    let username: string | null = null

    try {
      const { data: prof } = await sb.from('user_profiles').select('username').eq('id', userId).single()
      username = prof?.username || null
      const { data: auth } = await (sb as any).auth.admin.getUserById(userId)
      email = auth?.user?.email || null
    } catch {}

    const idem = crypto.createHash('sha256').update(`cust-${userId}`).digest('hex').slice(0, 42)
    const { ok, json } = await squareRequest('/v2/customers', 'POST', {
      idempotency_key: `tc-${idem}`,
      email_address: email || undefined,
      given_name: username || undefined,
      reference_id: userId,
    })

    if (!ok) {
      return res.status(500).json({
        error: 'Create customer failed',
        details: json?.errors?.[0]?.detail || 'Unknown error',
      })
    }

    const customerId = json?.customer?.id
    if (!customerId) return res.status(500).json({ error: 'Customer ID missing' })

    await sb
      .from('user_payment_methods')
      .upsert(
        {
          user_id: userId,
          provider: 'card',
          square_customer_id: customerId,
          is_default: true,
        },
        { onConflict: 'id' }
      )

    res.json({ success: true, square_customer_id: customerId })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'create-customer error' })
  }
})

// SAVE CARD
router.post('/save-card', async (req, res) => {
  try {
    const { userId, cardToken, saveAsDefault } = req.body || {}
    if (!userId || !cardToken) return res.status(400).json({ error: 'Missing data' })

    const sb = supabaseAdmin()
    let { data: pm } = await sb
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'card')
      .maybeSingle()

    if (!pm?.square_customer_id) {
      const resp = await fetch(
        `${req.protocol}://${req.get('host')}/api/square/create-customer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      )
      const json = await resp.json()
      if (!resp.ok) return res.status(500).json(json)
      pm = { square_customer_id: json.square_customer_id }
    }

    const createBody = {
      source_id: cardToken,
      autocomplete: false,
      location_id: getSquareLocationId(),
      customer_id: pm.square_customer_id,
      idempotency_key: `save-${userId}-${crypto.randomUUID()}`,
    }

    const { ok, json } = await squareRequest('/v2/payments', 'POST', createBody)
    if (!ok) {
      return res.status(500).json({
        error: 'Failed to vault card',
        details: json?.errors?.[0]?.detail,
      })
    }

    const card = json?.payment?.card_details?.card || {}
    const paymentId = json?.payment?.id
    if (paymentId) {
      await squareRequest(`/v2/payments/${paymentId}/cancel`, 'POST')
    }

    await sb
      .from('user_payment_methods')
      .update({
        square_card_id: card.id,
        brand: card.card_brand,
        last4: card.last_4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        is_default: !!saveAsDefault,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'card')

    res.json({
      success: true,
      card: {
        brand: card.card_brand,
        last4: card.last_4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
      },
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'save-card error' })
  }
})

// CHARGE COINS
router.post('/charge', async (req, res) => {
  try {
    const { userId, packageId } = req.body || {}
    if (!userId || !packageId) return res.status(400).json({ error: 'Missing fields' })

    const sb = supabaseAdmin()
    const { data: pkg } = await sb.from('coin_packages').select('*').eq('id', packageId).single()

    const { data: method } = await sb
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle()

    if (!method?.square_card_id) {
      return res.status(400).json({
        error: 'No default payment method',
      })
    }

    const createBody = {
      source_id: method.square_card_id,
      amount_money: { amount: Math.round(pkg.price * 100), currency: pkg.currency },
      autocomplete: true,
      location_id: getSquareLocationId(),
      customer_id: method.square_customer_id,
      idempotency_key: `pay-${crypto.randomUUID()}`,
      note: `Troll City purchase: ${pkg.name}`,
    }

    const { ok, json } = await squareRequest('/v2/payments', 'POST', createBody)
    if (!ok) {
      return res.status(500).json({
        error: 'Payment processing error',
        details: json?.errors?.[0]?.detail,
      })
    }

    await sb.rpc('purchase_coins', {
      p_user_id: userId,
      p_package_id: packageId,
      p_amount: pkg.price,
      p_square_tx_id: json?.payment?.id,
    })

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'charge error' })
  }
})

// WALLET BIND (CashApp, Venmo, ApplePay tokens)
router.post('/wallet-bind', async (req, res) => {
  try {
    const { userId, provider, tokenId } = req.body || {}
    const sb = supabaseAdmin()
    await sb.from('user_payment_methods').insert({
      user_id: userId,
      provider,
      token_id: tokenId,
      display_name: provider,
    })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE PAYMENT METHOD
router.delete('/delete-method/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.query

    await supabaseAdmin()
      .from('user_payment_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// LIST METHODS
router.get('/methods/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { data } = await supabaseAdmin()
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)

    res.json({ methods: data || [] })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
