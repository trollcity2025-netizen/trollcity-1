import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PURCHASE_REQUIRED_MESSAGE } from "../_shared/purchaseGate.ts";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const { action, stream_id, user_id, title, category, room_name } = body || {};

    const requesterId = authData.user.id;
    const { data: requesterProfile } = await supabase
      .from('user_profiles')
      .select('id, is_admin, is_lead_officer, has_paid')
      .eq('id', requesterId)
      .maybeSingle();
    const isAdmin = !!requesterProfile?.is_admin;
    const hasElevatedAccess = Boolean(requesterProfile?.is_admin || requesterProfile?.is_lead_officer);

    if (action === 'start') {
      if (!hasElevatedAccess && !requesterProfile?.has_paid) {
        return new Response(
          JSON.stringify({ error: PURCHASE_REQUIRED_MESSAGE }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      if (!user_id || requesterId !== user_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!room_name || !title) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const now = new Date().toISOString();
      const { data: streamRow, error } = await supabase
        .from('streams')
        .insert({
          broadcaster_id: user_id,
          title,
          category,
          current_viewers: 1,
          is_live: true,
          start_time: now,
          room_name,
          created_at: now,
        })
        .select('*')
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Award birthday coins if eligible (when user goes live on their birthday)
      try {
        const { data: birthdayResult } = await supabase.rpc('award_birthday_coins_if_eligible', {
          p_user_id: user_id
        });
        if (birthdayResult?.success) {
          console.log(`[Live] Birthday coins awarded to user ${user_id}: ${birthdayResult.coins_awarded} coins`);
        }
      } catch (birthdayErr) {
        // Non-critical error, log but don't fail stream creation
        console.warn('[Live] Birthday coin check failed:', birthdayErr);
      }
      
      return new Response(JSON.stringify({ success: true, stream: streamRow }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'end') {
      if (!stream_id) {
        return new Response(JSON.stringify({ error: 'Missing stream_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: stream } = await supabase
        .from('streams')
        .select('id, broadcaster_id')
        .eq('id', stream_id)
        .maybeSingle();
      if (!stream) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (stream.broadcaster_id !== requesterId && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false, ended_at: now })
        .eq('id', stream_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'status') {
      if (!stream_id && !user_id) {
        return new Response(JSON.stringify({ error: 'Missing stream_id or user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let query = supabase.from('streams').select('*');
      if (stream_id) query = query.eq('id', stream_id);
      if (user_id) query = query.eq('broadcaster_id', user_id);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, stream: data || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'force-end-all') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('streams')
        .update({ is_live: false, ended_at: now })
        .eq('is_live', true)
        .select('id');
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, ended: (data || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
