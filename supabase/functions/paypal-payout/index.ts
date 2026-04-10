import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const { payoutRequestId, adminId, force = false } = await req.json()
    
    // Only allow payouts on Fridays unless forced
    const today = new Date().getDay()
    if (today !== 5 && !force) {
      throw new Error('Payouts are only processed on Fridays')
    }

    if (!payoutRequestId) {
      throw new Error('payoutRequestId is required')
    }
    
    // 1. Initialize Supabase Client (Service Role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Fetch Payout Request
    const { data: request, error: fetchError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', payoutRequestId)
      .single()

    if (fetchError || !request) {
      throw new Error('Payout request not found')
    }

    if (request.status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already paid' }),
        { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    // Determine amount and email
    let amount = request.net_amount || request.cash_amount
    if (!amount && request.usd_estimate) {
        amount = parseFloat(request.usd_estimate)
    }

    const email = request.paypal_email || request.payout_address || request.payment_reference // Fallback
    
    if (!amount || amount <= 0) {
        throw new Error('Invalid payout amount')
    }
    if (!email) {
        throw new Error('No PayPal email found for this request')
    }

    // 3. Authenticate with PayPal
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

    // 4. Create Payout Batch
    const payoutPayload = {
        sender_batch_header: {
            sender_batch_id: `payout_${payoutRequestId}_${Date.now()}`,
            email_subject: "You have a payout from TrollCity!",
            email_message: "You have received a payout for your TrollCity earnings."
        },
        items: [
            {
                recipient_type: "EMAIL",
                amount: {
                    value: amount.toFixed(2),
                    currency: "USD"
                },
                note: "TrollCity Payout",
                sender_item_id: payoutRequestId,
                receiver: email,
                notification_language: "en-US"
            }
        ]
    }

    const payoutRes = await fetch(`${baseUrl}/v1/payments/payouts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payoutPayload)
    })

    if (!payoutRes.ok) {
        const errText = await payoutRes.text()
        console.error('PayPal Payout Error:', errText)
        throw new Error(`PayPal Payout failed: ${errText}`)
    }

    const payoutData = await payoutRes.json()
    const batchId = payoutData.batch_header?.payout_batch_id

    // 5. Finalize in Database (Burn Coins & Mark Paid)
    // We use the RPC if available, or manual update
    
    // Attempt to call troll_bank_finalize_cashout
    // We need an admin ID. If not provided, we might fail or use a system fallback.
    // For now, if adminId is missing, we'll just do the manual update which is safer than failing.
    
    if (adminId) {
        const { error: rpcError } = await supabase.rpc('troll_bank_finalize_cashout', {
            p_request_id: payoutRequestId,
            p_admin_id: adminId
        })
        
        if (rpcError) {
             console.error('RPC Finalize Error:', rpcError)
             // Fallback to manual update if RPC fails
        } else {
             return new Response(
              JSON.stringify({ success: true, batchId }),
              { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
            )
        }
    }

    // Manual Fallback (if no adminId or RPC failed)
    const { error: updateError } = await supabase
        .from('payout_requests')
        .update({
            status: 'paid', 
            payment_reference: batchId,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', payoutRequestId)

    // Also try to burn coins manually if we didn't use RPC
    if (request.escrowed_coins > 0) {
         await supabase.from('coin_ledger').insert({
            user_id: request.user_id,
            delta: -request.escrowed_coins,
            bucket: 'escrow',
            source: 'cashout_finalized',
            ref_id: payoutRequestId,
            reason: 'Cashout Paid via PayPal'
         })
         
         await supabase.from('payout_requests')
            .update({ escrowed_coins: 0 })
            .eq('id', payoutRequestId)
    }

    if (updateError) {
        console.error('Failed to update payout status in DB:', updateError)
    }

    return new Response(
      JSON.stringify({ success: true, batchId }),
      { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
