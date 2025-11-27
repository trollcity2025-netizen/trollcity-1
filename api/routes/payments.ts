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
    let sourceId = body.sourceId
    const userId = body.userId
    const packageId = body.packageId
    const provider = String(body.provider || 'card').toLowerCase()
    if (!userId || !packageId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // If no sourceId provided, try to use the user's default saved card (server-side)
    let customerId: string | null = null
    if (!sourceId) {
      try {
        const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
        const { data: defMethod, error: defErr } = await sb
          .from('user_payment_methods')
          .select('square_card_id, token_id, brand, last4, square_customer_id')
          .eq('user_id', userId)
          .eq('is_default', true)
          .limit(1)
          .maybeSingle()
        
        console.log('Default payment method lookup:', { defMethod, defErr })
        
        if (!defErr && defMethod) {
          // Prefer square_card_id (new flow), fallback to token_id (legacy)
          const cardId = defMethod.square_card_id || defMethod.token_id
          if (cardId && !cardId.startsWith('mock_') && !cardId.startsWith('test_') && !cardId.startsWith('pending_')) {
            sourceId = cardId
            customerId = defMethod.square_customer_id || null
            console.log('Using default card:', { cardId, brand: defMethod.brand, last4: defMethod.last4, customerId })
          } else {
            console.log('Default card is invalid/mock/pending:', { cardId })
          }
        }
        
        // If still no sourceId, try most recent non-mock card
        if (!sourceId) {
          const { data: recent, error: recErr } = await sb
            .from('user_payment_methods')
            .select('square_card_id, token_id, brand, last4, square_customer_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          console.log('Recent payment method lookup:', { recent, recErr })
          
          if (!recErr && recent) {
            const cardId = recent.square_card_id || recent.token_id
            if (cardId && !cardId.startsWith('mock_') && !cardId.startsWith('test_') && !cardId.startsWith('pending_')) {
              sourceId = cardId
              customerId = recent.square_customer_id || null
              console.log('Using recent card:', { cardId, brand: recent.brand, last4: recent.last4, customerId })
            } else {
              console.log('Recent card is invalid/mock/pending:', { cardId })
            }
          }
        }
      } catch (e) {
        console.warn('Failed to lookup default saved method', e)
      }
    }

    if (!sourceId) {
      console.error('No valid payment method found for user:', userId)
      return res.status(400).json({ 
        error: 'No payment method found',
        details: 'Please add a valid debit or credit card with ZIP code in your wallet settings before making a purchase.'
      })
    }

    // Reject mock/test tokens for actual payments
    if (sourceId.startsWith('mock_') || sourceId.startsWith('test_')) {
      console.log('[Payment] Rejecting test card for real purchase')
      return res.status(400).json({ 
        error: 'Invalid payment method',
        details: 'Test payment methods cannot be used for real purchases. Please add a valid debit or credit card with your ZIP code.'
      })
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
    const createBody: any = {
      source_id: sourceId,
      idempotency_key: idemKey,
      location_id: process.env.SQUARE_LOCATION_ID,
      amount_money: {
        amount: Math.round(amtNum * 100),
        currency,
      },
      note: `Troll City coin purchase - User: ${userId}`,
      autocomplete: true
    }
    
    // Include customer_id when using a saved card for better authorization
    if (customerId) {
      createBody.customer_id = customerId
    }
    
    // Include verification_token if provided
    if (body.verificationToken) {
      createBody.verification_token = body.verificationToken
    }

    const { ok, json } = await squareRequest('/v2/payments', 'POST', createBody)
    if (!ok) {
      const errorArray = Array.isArray(json?.errors) ? json.errors : [json?.errors || {}]
      const details = errorArray.map((e: any) => e.detail || e.message).join('; ') || 'Unknown error'
      const errorCode = errorArray[0]?.code || ''
      
      console.error('Square payment error:', { errorCode, details, sourceId, userId })
      
      // Log declined transaction to database for admin tracking
      try {
        await supabase.from('declined_transactions').insert({
          user_id: userId,
          package_id: packageId,
          amount_usd: amtNum,
          currency,
          error_code: errorCode,
          error_message: details,
          error_details: json?.errors || null,
          payment_provider: 'square',
          source_id: sourceId,
          metadata: {
            package_name: packageName,
            coin_amount: coinAmount,
            provider,
            verification_token: body.verificationToken ? 'present' : 'missing'
          }
        })
      } catch (logErr) {
        console.error('Failed to log declined transaction:', logErr)
      }
      
      // Provide helpful feedback
      if (details.toLowerCase().includes('declined')) {
        return res.status(500).json({ error: 'Payment declined', details: 'Your card was declined. Please check your card details and try again.' })
      }
      if (errorCode?.includes('TEST_') || details.toLowerCase().includes('test')) {
        return res.status(500).json({ error: 'Invalid card', details: 'This card cannot be used for real payments. Please use a valid payment method.' })
      }
      
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

    // Get total balance after update (paid + free) for audit trail
    const { data: updatedProfile } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance, free_coin_balance')
      .eq('id', userId)
      .single()
    
    const totalBalance = (updatedProfile?.paid_coin_balance || 0) + (updatedProfile?.free_coin_balance || 0)

    // Record coin transaction for store purchase. Store revenue is in USD.
    const squareFee = Math.round((amtNum * 0.029 + 0.3) * 100) / 100
    const platformProfitUsd = Math.round((amtNum - squareFee) * 100) / 100
    const { error: txErr } = await supabase
      .from('coin_transactions')
      .insert([{
        user_id: userId,
        type: 'store_purchase',
        amount: totalCoinsToAdd,
        coin_type: 'paid',
        source: 'square',
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
          is_friday_bonus: isFriday && qualifiesForBonus,
          square_fee: squareFee
        },
        platform_profit: platformProfitUsd,
        liability: 0,
        balance_after: totalBalance,
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
    const { userId, cardToken, saveAsDefault, postalCode, cardDetails } = req.body
    
    console.log('[Save Card] Request:', { userId, cardToken: cardToken?.substring(0, 10) + '...', saveAsDefault, hasPostalCode: !!postalCode })
    
    if (!userId || !cardToken) {
      return res.status(400).json({ error: 'Missing userId or cardToken' })
    }

    // Require postal code for real cards
    if (!String(cardToken).startsWith('mock_') && !postalCode) {
      return res.status(400).json({ error: 'ZIP code is required for card verification' })
    }

    // Allow development "mock_" tokens to be stored without calling Square
    let cardInfo: any = null
    if (String(cardToken).startsWith('mock_')) {
      console.log('[Save Card] Saving mock card for testing')
      const last4 = String(cardToken).replace(/^mock_/, '').slice(-4)
      cardInfo = {
        user_id: userId,
        provider: 'card',
        token_id: cardToken,
        brand: 'TestCard',
        last4,
        exp_month: null,
        exp_year: null,
        is_default: !!saveAsDefault,
        display_name: `Test Card •••• ${last4}`,
        created_at: new Date().toISOString()
      }
    } else {
      console.log('[Save Card] Processing real card with Square')
      const ready = await ensureSquareReady()
      if (!ready) {
        return res.status(500).json({ error: 'Square payment processor not configured. Please contact support.' })
      }

      // Save card in Square Vault using Payments token with postal code
      const requestBody: any = {
        idempotency_key: crypto.randomUUID(),
        source_id: cardToken
      }
      
      // Add billing address with postal code for verification
      if (postalCode) {
        requestBody.card = {
          billing_address: {
            postal_code: postalCode
          }
        }
      }
      
      console.log('[Save Card] Calling Square API to vault card')
      const { ok, json } = await squareRequest('/v2/cards', 'POST', requestBody)

      if (!ok || !json.card) {
        const details = Array.isArray(json?.errors)
          ? json.errors.map((e: any) => e.detail || e.message).join('; ')
          : 'Card validation failed. Please check your card details.'
        console.error('[Save Card] Square API error:', details)
        return res.status(400).json({
          error: 'Failed to save card',
          details
        })
      }

      const card = json.card
      console.log('[Save Card] Card vaulted successfully:', { brand: card.card_brand, last4: card.last_4 })
      
      cardInfo = {
        user_id: userId,
        provider: 'card',
        token_id: card.id,
        square_card_id: card.id,
        brand: card.card_brand || '',
        last4: card.last_4 || '',
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        is_default: !!saveAsDefault,
        display_name: `${card.card_brand || 'Card'} •••• ${card.last_4}`,
        created_at: new Date().toISOString()
      }
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
    const hasLocationId = !!(process.env.SQUARE_LOCATION_ID && process.env.SQUARE_LOCATION_ID.length > 5)
    const ready = await ensureSquareReady()
    let apiOk = false
    let apiMessage = ''
    if (ready) {
      const { ok, status, json } = await squareRequest('/v2/locations', 'GET')
      apiOk = ok
      if (!ok) {
        console.warn('Square API error:', { status, json })
        if (status === 401) {
          apiMessage = 'Invalid or expired access token'
        } else if (status === 403) {
          apiMessage = 'Access denied - check token permissions'
        } else if (Array.isArray(json?.errors)) {
          apiMessage = json.errors.map((e: any) => e.detail || e.message).join('; ')
        } else {
          apiMessage = `HTTP ${status}: ${json?.message || 'Unknown error'}`
        }
      }
    }
    res.json({ 
      env, 
      hasToken, 
      hasLocationId,
      clientReady: ready, 
      apiOk, 
      details: apiMessage || (ready ? 'API OK' : 'Square not ready')
    })
  } catch (e: any) {
    console.error('Square status error:', e)
    res.status(500).json({ error: e?.message || 'status failed', details: 'Exception during status check' })
  }
})

// DELETE generic payment method (from legacy `payment_methods` table)
router.delete('/method/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { error } = await supabase.from('payment_methods').delete().eq('id', id)
    if (error) throw error

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to delete method' })
  }
})

// User: cancel (delete) own cashout request (only if still pending/processing)
router.delete('/cashouts/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'Missing id' })

    // Get bearer token if provided
    const authHeader = String(req.headers.authorization || '')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined

    // create supabase client
    const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')

    // verify user
    if (!token) return res.status(401).json({ error: 'Missing auth token' })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
    const uid = userData.user.id

    // load the request
    const { data: reqRow, error: getErr } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (getErr) throw getErr
    if (!reqRow) return res.status(404).json({ error: 'Cashout not found' })
    if (String(reqRow.user_id) !== String(uid)) return res.status(403).json({ error: 'Not allowed' })

    // allow cancel only when pending or processing
    if (!['pending', 'processing'].includes(String(reqRow.status))) {
      return res.status(400).json({ error: 'This request cannot be cancelled' })
    }

    const { error: delErr } = await supabase.from('cashout_requests').delete().eq('id', id)
    if (delErr) throw delErr

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to cancel cashout' })
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
