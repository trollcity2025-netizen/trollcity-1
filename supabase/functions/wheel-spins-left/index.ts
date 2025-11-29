import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference types="https://deno.land/x/types/index.d.ts" />
import { createClient } from "@supabase/supabase-js";
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void; env: { get: (key: string) => string | undefined } };

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get user from auth header
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get wheel config
  let { data: cfg } = await supabase
    .from('wheel_config')
    .select('*')
    .limit(1)
    .single();

  if (!cfg) {
    const { data: newCfg } = await supabase
      .from('wheel_config')
      .insert({ is_active: true, spin_cost: 500, max_spins_per_day: 10 })
      .select('*')
      .single();
    cfg = newCfg || { is_active: true, spin_cost: 500, max_spins_per_day: 10 };
  }

  // Get user's role for spin limit
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const maxSpins = profile?.role === 'troll_officer' ? 15 : (cfg.max_spins_per_day || 10);

  // Count today's spins
  const today = new Date().toISOString().split('T')[0];
  const { data: spins } = await supabase
    .from('wheel_spins')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  const usedSpins = Array.isArray(spins) ? spins.length : 0;
  const spinsLeft = Math.max(0, maxSpins - usedSpins);

  return new Response(JSON.stringify({
    success: true,
    isActive: cfg.is_active,
    spins_left: spinsLeft,
    maxSpins,
    usedSpins
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
