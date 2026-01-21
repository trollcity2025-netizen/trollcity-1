import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        throw new Error('Missing Authorization header')
    }
    
    const { data: { user }, error: _authError } = await supabaseClient.auth.getUser()
    
    let isAuthorized = false;
    
    if (user) {
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();
            
        if (profile && (profile.role === 'admin' || profile.is_admin || profile.role === 'secretary')) {
            isAuthorized = true;
        }
    } else {
        const token = authHeader.split(' ')[1];
        if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
                try {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.role === 'service_role') {
                        isAuthorized = true;
                    }
                } catch {
                    // ignore
                }
            }
        }
    }
    
    if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { user_id, coins, bucket, source, ref_id } = await req.json()

    if (!user_id || !coins || !bucket || !source) {
         return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabaseAdmin.rpc('troll_bank_credit_coins', {
        p_user_id: user_id,
        p_coins: coins,
        p_bucket: bucket,
        p_source: source,
        p_ref_id: ref_id
    })

    if (error) throw error

    await supabaseAdmin.from('bank_audit_log').insert({
        action: 'credit_coins',
        performed_by: user?.id || null,
        target_user_id: user_id,
        details: { coins, bucket, source, ref_id, result: data }
    })

    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
