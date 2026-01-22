import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json()
    const coins = body.amount || body.requested_coins

    if (!coins) {
         return new Response(JSON.stringify({ error: 'Missing amount' }), { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabaseClient.rpc('troll_bank_apply_for_loan', {
        p_user_id: user.id,
        p_requested_coins: coins
    })

    if (error) {
      console.error('RPC Error:', error)
      return new Response(JSON.stringify({ error: error.message || 'Loan application failed' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Check if the RPC returned a logical error structure
    if (data && data.success === false) {
       return new Response(JSON.stringify({ error: data.message || 'Loan application denied' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabaseAdmin.from('bank_audit_log').insert({
        action: 'loan_application',
        performed_by: user.id,
        target_user_id: user.id,
        details: { requested_coins: coins, result: data }
    })

    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
