import { Router } from 'express'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const router = Router()

// ----------------- Helpers -----------------

let squareClient: any = null

function sanitizeBigInt(value: any): any {
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(sanitizeBigInt)
  if (value && typeof value === 'object') {
    const out: any = {}
    for (const k of Object.keys(value)) out[k] = sanitizeBigInt((value as any)[k])
    return out
  }
  return value
}

function getSquareBaseUrl() {
  return 'https://connect.squareup.com'
}

async function squareRequest(path: string, method: string, body?: any) {
  const base = getSquareBaseUrl()
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
  if (!accessToken) throw new Error('Missing SQUARE_ACCESS_TOKEN')
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-09-18'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const json = await resp.json().catch(() => ({}))
  return { ok: resp.ok, status: resp.status, json }
}

async function ensureSquareReady() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
  const locationId = process.env.SQUARE_LOCATION_ID || ''
  if (!accessToken || !locationId) return false
  return true
}

async function ensureSquareClient() {
  if (squareClient) return true
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
    if (!accessToken) return false
    const squareMod = await import('square')
    const SquareClient = (squareMod as any).Client || (squareMod as any).default?.Client
    const SquareEnvironment = (squareMod as any).Environment || (squareMod as any).default?.Environment
    if (!SquareClient || !SquareEnvironment) throw new Error('Square SDK not available')
    squareClient = new SquareClient({
      bearerAuthCredentials: { accessToken },
      environment: SquareEnvironment.Production,
    })
    return true
  } catch (error) {
    console.warn('Failed to initialize Square client:', error)
    squareClient = null
    return false
  }
}

// ----------------- Create Payment (buy coins) -----------------

router.post('/create-payment', async (req, res) => {
  try {
    console.log('payments:create-payment')
    const ready = await ensureSquareReady()
    console.log('payments:create-payment:ready', ready)
    if (!ready) {
      return res.status(500).json({
        error: 'Payment service unavailable',
        details: 'Square client not properly initialized'
      })
    }

    const body: any = req.body ?? {}
    console.log('payments:create-payment:body', body)
    const sourceId = body.sourceId
    const userId = body.userId
    const packageId = body.packageId
    const provider = String(body.provider || 'card').toLowerCase()

    if (!sourceId || !userId || !packageId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: pkg, error: pkgErr } = await supabase
      .from('coin_packages')
      .select('*')
      .eq('id', packageId)
      .single()
    if (pkgErr) {
      return res.status(400).json({ error: 'Package not found' })
    }

    const packageName = pkg?.name || 'Package'
    const currency = pkg?.currency || 'USD'
    const coinAmount = Number(pkg?.coin_amount || 0)
    const price = Number(pkg?.price)

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(coinAmount) || coinAmount <= 0) {
      return res.status(400).json({ error: 'Invalid package configuration' })
    }

    const amtNum = Number(price)
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const hash = crypto
      .createHash('sha256')
      .update(`${userId}-${packageId || 'pkg'}-${Math.round(amtNum * 100)}-${currency}`)
      .digest('hex')
    const idemKey = `tc-${hash.slice(0, 42)}`

    console.log('payments:create-payment:creating')
    const createBody = {
      source_id: sourceId,
      idempotency_key: idemKey,
      location_id: process.env.SQUARE_LOCATION_ID,
      amount_money: {
        amount: Math.round(amtNum * 100),
        currency,
      },
      verification_token: body.verificationToken,
      note: `Troll City coin purchase - User: ${userId}`,
      autocomplete: true
    }

    const { ok, json } = await squareRequest('/v2/payments', 'POST', createBody)
    if (!ok) {
      const details = Array.isArray(json?.errors)
        ? json.errors.map((e: any) => e.detail || e.message).join('; ')
        : 'Unknown error'
      return res.status(500).json({ error: 'Payment failed', details })
    }

    console.log('payments:create-payment:success', json?.payment?.id)
    const payment = sanitizeBigInt(json.payment)

    const { data: profile, error: loadErr } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', userId)
      .single()
    if (loadErr) throw loadErr

    const coinBase = coinAmount
    const isFriday = new Date().getDay() === 5
    const qualifiesForBonus = amtNum > 20
    const bonusCoins = isFriday && qualifiesForBonus ? Math.round(coinBase * 0.1) : 0
    const totalCoinsToAdd = coinBase + bonusCoins
    const newBalance = Number(profile?.paid_coin_balance || 0) + totalCoinsToAdd

    const { error: balErr } = await supabase
      .from('user_profiles')
      .update({ paid_coin_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (balErr) throw balErr

    const { error: txErr } = await supabase
      .from('coin_transactions')
      .insert([{
        user_id: userId,
        type: 'purchase',
        coins: totalCoinsToAdd,
        amount_usd: amtNum,
        payment_method: 'square',
        status: 'completed',
        description: bonusCoins > 0
          ? `Purchased ${packageName} - ${coinBase} coins (+${bonusCoins} Friday bonus)`
          : `Purchased ${packageName} - ${coinBase} coins`,
        metadata: {
          payment_id: payment?.id,
          package_id: packageId,
          provider,
          currency,
          amount_paid: amtNum,
          bonus_coins: bonusCoins,
          is_friday_bonus: isFriday && qualifiesForBonus
        },
        created_at: new Date().toISOString()
      }])
    if (txErr) throw txErr

    res.json({
      success: true,
      payment,
      coins_added: totalCoinsToAdd,
      new_balance: newBalance
    })
  } catch (error: any) {
    console.error('Square payment error:', error)
    const details = Array.isArray(error?.errors)
      ? error.errors.map((e: any) => e.detail || e.message).join('; ')
      : error?.message || 'Unknown error'
    res.status(500).json({
      error: 'Payment failed',
      details
    })
  }
})

// ----------------- Save Card (link method for profile / wallet) -----------------

router.post('/save-card', async (req, res) => {
  try {
    const { userId, cardToken, saveAsDefault } = req.body
    if (!userId || !cardToken) {
      return res.status(400).json({ error: 'Missing userId or cardToken' })
    }

    const ready = await ensureSquareReady()
    if (!ready) {
      return res.status(500).json({ error: 'Square not ready' })
    }

    // Save card in Square Vault using Payments token
    const { ok, json } = await squareRequest('/v2/cards', 'POST', {
      idempotency_key: crypto.randomUUID(),
      source_id: cardToken
    })

    if (!ok || !json.card) {
      const details = Array.isArray(json?.errors)
        ? json.errors.map((e: any) => e.detail || e.message).join('; ')
        : 'Unknown error'
      return res.status(500).json({
        error: 'Failed to save card to Square',
        details
      })
    }

    const card = json.card
    const cardInfo = {
      user_id: userId,
      provider: 'card',
      token_id: card.id,
      brand: card.card_brand || '',
      last4: card.last_4 || '',
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      is_default: !!saveAsDefault,
      display_name: `${card.card_brand || 'Card'} •••• ${card.last_4}`,
      created_at: new Date().toISOString()
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    if (saveAsDefault) {
      await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    const { error } = await supabase
      .from('user_payment_methods')
      .insert(cardInfo)

    if (error) throw error

    res.json({ success: true, method: cardInfo })
  } catch (error: any) {
    console.error('save-card error:', error)
    res.status(500).json({ error: error?.message || 'Failed to save card' })
  }
})

// ----------------- Webhook -----------------

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-square-hmacsha256-signature'] as string
    const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || ''
    if (key) {
      const raw = (req as any).rawBody
        ? String((req as any).rawBody)
        : JSON.stringify(req.body)
      const computed = crypto.createHmac('sha256', key).update(raw).digest('base64')
      if (!signature || signature !== computed) {
        return res.status(401).json({ error: 'Invalid webhook signature' })
      }
    }

    const { type, data } = req.body

    if ((type === 'payment.created' || type === 'payment.updated') && data.object.payment) {
      const payment = data.object.payment
      const paymentId = payment.id
      const status = payment.status

      if (status === 'COMPLETED') {
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        )
        const { data: tx } = await supabase
          .from('coin_transactions')
          .select('*')
          .filter('metadata->>payment_id', 'eq', paymentId)
          .maybeSingle()

        if (tx && tx.status !== 'completed') {
          await supabase
            .from('coin_transactions')
            .update({ status: 'completed' })
            .eq('id', tx.id)
          // Optional RPC hook for any extra logic
          try {
            await supabase.rpc('confirm_coin_purchase', { p_tx_id: tx.id })
          } catch (e) {
            console.warn('confirm_coin_purchase RPC failed', e)
          }
        }
      }
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ----------------- Wallet Bind (CashApp/ApplePay/GooglePay pseudo-link) -----------------

router.get('/wallet-bind', async (req, res) => {
  try {
    const provider = String(req.query.provider || '').toLowerCase()
    const redirect = String(req.query.redirect_uri || '')

    if (!provider || !redirect) {
      return res.status(400).json({ error: 'Missing provider or redirect_uri' })
    }

    // Dev-style lightweight token. Real implementation would use Square's
    // Web Payments SDK to generate a true token.
    const tokenId = `square_${provider}_${Math.random().toString(36).slice(2)}_${Date.now()}`

    const url = new URL(redirect)
    url.searchParams.set('provider', provider)
    url.searchParams.set('token_id', tokenId)

    res.redirect(302, url.toString())
  } catch (error) {
    console.error('Wallet bind error:', error)
    res.status(500).json({ error: 'Failed to initiate wallet binding' })
  }
})

// ----------------- Health / Status -----------------

router.get('/ping', (req, res) => {
  res.json({ ok: true })
})

router.get('/status', async (req, res) => {
  try {
    const env = process.env.SQUARE_ENVIRONMENT || 'unknown'
    const hasToken = !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_ACCESS_TOKEN.length > 10)
    const ready = await ensureSquareReady()
    let apiOk = false
    let apiMessage = ''
    if (ready) {
      const { ok, json } = await squareRequest('/v2/locations', 'GET')
      apiOk = ok
      if (!ok) {
        apiMessage = Array.isArray(json?.errors)
          ? json.errors.map((e: any) => e.detail || e.message).join('; ')
          : 'Unknown error'
      }
    }
    res.json({ env, hasToken, clientReady: ready, apiOk, details: apiMessage })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'status failed' })
  }
})

router.get('/locations', async (req, res) => {
  try {
    const ready = await ensureSquareReady()
    if (!ready) return res.status(500).json({ error: 'Square not ready' })
    const { ok, json } = await squareRequest('/v2/locations', 'GET')
    if (!ok) {
      const details = Array.isArray(json?.errors)
        ? json.errors.map((e: any) => e.detail || e.message).join('; ')
        : 'Unknown error'
      return res.status(500).json({ error: 'Failed to fetch locations', details })
    }
    res.json({ locations: json.locations || [] })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'locations failed' })
  }
})

export default router
