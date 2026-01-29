import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {


    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    console.log("[bank-apply] has auth header:", !!authHeader);
    console.log("[bank-apply] auth header prefix:", authHeader?.slice(0, 15));

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          reason: "missing bearer token",
          hasAuthHeader: !!authHeader,
          authHeaderPrefix: authHeader?.slice(0, 15) || null
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          reason: authError?.message ?? "user not found",
          hasAuthHeader: !!authHeader,
          authHeaderPrefix: authHeader?.slice(0, 15) || null,
          authError: authError?.message || null
        }),
        { status: 401, headers: corsHeaders }
      );
    }


    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
    }

    const coins = body.amount || body.requested_coins;
    if (!coins) {
      return new Response(JSON.stringify({ error: 'Missing amount' }), { status: 400, headers: corsHeaders });
    }



    // Call the RPC with derived user.id
    let rpcReached = false;
    let rpcErrorMsg = null;
    let rpcData = null;
    try {
      const { error: rpcError, data } = await supabase.rpc(
        'troll_bank_apply_for_loan',
        {
          p_user_id: user.id,
          p_requested_coins: coins,
        }
      );
      rpcReached = true;
      rpcErrorMsg = rpcError?.message || null;
      rpcData = data;
      if (rpcError) {
        return new Response(
          JSON.stringify({
            error: rpcError.message,
            rpcReached,
            rpcErrorMsg,
            rpcData
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (data && data.success === false) {
        return new Response(
          JSON.stringify({
            error: data.reason || data.message || 'Loan application denied',
            data,
            rpcReached,
            rpcErrorMsg,
            rpcData
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    } catch (rpcCatchError) {
      return new Response(
        JSON.stringify({
          error: 'RPC call failed',
          rpcReached,
          rpcErrorMsg: rpcCatchError?.message || String(rpcCatchError),
          rpcData
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Audit Log (using Service Role)
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseAdmin.from('bank_audit_log').insert({
            action: 'loan_application',
            performed_by: userId,
            target_user_id: userId,
            details: { requested_coins: coins, result: data, via_service: isServiceCall }
        })
    } catch (auditError) {
        console.error('Audit log error:', auditError)
        // Don't fail the request if audit fails
    }

    return new Response(JSON.stringify({
      success: true,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.slice(0, 15) || null,
      rpcReached,
      rpcErrorMsg,
      rpcData
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
