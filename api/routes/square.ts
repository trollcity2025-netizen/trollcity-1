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

// CHECK SQUARE ENVIRONMENT
router.get('/environment-check', async (req, res) => {
  try {
    const appId = process.env.VITE_SQUARE_APPLICATION_ID || process.env.SQUARE_APPLICATION_ID || ''
    const locationId = getSquareLocationId()
    const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
    
    // Detect sandbox mode
    // Square sandbox app IDs contain 'sandbox'
    // Square production app IDs start with sq0idp-
    // Square production access tokens are long and complex (no simple prefix rule)
    const isSandboxAppId = appId.includes('sandbox')
    const isSandboxLocation = locationId.includes('sandbox')
    const isProductionAppId = appId.startsWith('sq0idp-') || appId.startsWith('sq0atp-')
    
    // If we have production app ID, assume production mode
    const mode = isProductionAppId ? 'production' : (isSandboxAppId || isSandboxLocation) ? 'sandbox' : 'production'
    
    res.json({
      mode,
      configured: !!accessToken && !!locationId,
      appIdPrefix: appId.substring(0, 10) + '...',
      locationIdPrefix: locationId.substring(0, 10) + '...',
      warning: mode === 'sandbox' ? 'Cards will display as TestCard in sandbox mode. Use production credentials for real cards.' : null
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

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
          token_id: `pending_${userId}`,
          square_customer_id: customerId,
          is_default: false,  // Don't mark as default until a real card is saved
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
    
    // Reject mock/test tokens in production
    if (cardToken.includes('mock_') || cardToken.startsWith('test_')) {
      return res.status(400).json({ 
        error: 'Invalid card token',
        details: 'Test cards are not allowed in production. Please use a valid debit or credit card.'
      })
    }
    
    // Reject mock/test tokens
    if (cardToken.startsWith('mock_') || cardToken.startsWith('test_')) {
      return res.status(400).json({ 
        error: 'Invalid card token',
        details: 'Payment form not properly initialized. Try refreshing the page and adding your card again.'
      })
    }

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

    // Use Square Cards API to create a card on file for the customer
    const createCardBody = {
      source_id: cardToken,
      card: {
        customer_id: pm.square_customer_id,
      },
      idempotency_key: `card-${userId}-${crypto.randomUUID()}`,
    }

    const { ok, json } = await squareRequest('/v2/cards', 'POST', createCardBody)
    if (!ok) {
      const errorDetail = json?.errors?.[0]?.detail || 'Unknown error'
      const errorCode = json?.errors?.[0]?.code || ''
      console.error('Square save-card error:', { errorCode, errorDetail, cardToken })
      
      // Log failed card save attempt
      try {
        await sb.from('declined_transactions').insert({
          user_id: userId,
          amount_usd: 0,
          currency: 'USD',
          error_code: errorCode,
          error_message: errorDetail,
          error_details: json?.errors || null,
          payment_provider: 'square',
          source_id: cardToken,
          metadata: {
            operation: 'save_card',
          }
        })
      } catch (logErr) {
        console.error('Failed to log declined card save:', logErr)
      }
      
      // Provide helpful message
      if (errorDetail?.includes('TEST_') || errorCode?.includes('TEST_') || errorDetail?.includes('declined')) {
        return res.status(500).json({
          error: 'Card declined or invalid',
          details: 'This card cannot be used. If testing, make sure you are using valid test card numbers for your environment.'
        })
      }
      
      return res.status(500).json({
        error: 'Failed to save card',
        details: errorDetail,
      })
    }

    // Extract card details from the Cards API response
    const card = json?.card || {}
    const cardId = card.id
    
    if (!cardId) {
      return res.status(500).json({ 
        error: 'Card save failed', 
        details: 'No card ID returned from Square' 
      })
    }
    
    // If saving as default, clear other defaults first
    if (saveAsDefault) {
      await sb
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId)
    }
    
    // Upsert into `user_payment_methods` with the proper card ID from Cards API
    const { data: savedMethods } = await sb
      .from('user_payment_methods')
      .upsert({
        user_id: userId,
        provider: 'card',
        token_id: cardId,  // Use the card ID, not the nonce
        square_card_id: cardId,  // Store the reusable card ID
        square_customer_id: pm?.square_customer_id || null,
        brand: card.card_brand,
        last4: card.last_4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        is_default: !!saveAsDefault,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider,token_id',
        ignoreDuplicates: false
      })
      .select()
    
    const updatedMethod = savedMethods?.[0] || null

    // Also upsert into legacy `payment_methods` table so the store UI recognizes the new card
    try {
      if (saveAsDefault) {
        await sb.from('payment_methods').update({ is_default: false }).eq('user_id', userId)
      }

      const { data: existing } = await sb
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'card')
        .maybeSingle()

      const pmRow = {
        user_id: userId,
        provider: 'card',
        card_brand: card.card_brand || null,
        last_4: card.last_4 || null,
        token_id: cardId,  // Use the card ID from Cards API
        is_default: !!saveAsDefault,
        display_name: `${card.card_brand || 'Card'} •••• ${card.last_4}`,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      if (existing && existing.id) {
        await sb.from('payment_methods').update(pmRow).eq('id', existing.id)
      } else {
        await sb.from('payment_methods').insert(pmRow)
      }
    } catch (err) {
      // Non-fatal: log and continue — store may still work from user_payment_methods
      console.warn('Failed to upsert into payment_methods table:', err)
    }

    res.json({
      success: true,
      card: {
        brand: card.card_brand,
        last4: card.last_4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
      },
      method: updatedMethod || null,
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
      .not('square_card_id', 'like', 'mock_%')
      .not('square_card_id', 'like', 'test_%')
      .not('square_card_id', 'like', 'pending_%')
      .maybeSingle()

    if (!method?.square_card_id) {
      return res.status(400).json({
        error: 'No default payment method',
        details: 'Please add a valid debit or credit card in your wallet settings.'
      })
    }

    // Additional validation to reject mock/test/pending tokens
    if (method.square_card_id.startsWith('mock_') || method.square_card_id.startsWith('test_') || method.square_card_id.startsWith('pending_')) {
      return res.status(400).json({
        error: 'Invalid payment method',
        details: 'Test payment methods cannot be used. Please add a valid debit or credit card.'
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
