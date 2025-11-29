import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference types="https://deno.land/x/types/index.d.ts" />
import { createClient } from "@supabase/supabase-js"
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void; env: { get: (key: string) => string | undefined } };

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname.includes('/admin/') ? url.pathname.split('/admin/')[1] : '';

    // /profit-summary
    if (pathname === 'profit-summary' && req.method === 'GET') {
      // Get profit summary data
      const [
        coinSalesRes,
        payoutsRes,
        feesRes
      ] = await Promise.all([
        supabase.from('coin_transactions').select('metadata').eq('type', 'purchase'),
        supabase.from('earnings_payouts').select('amount'),
        supabase.from('payout_requests').select('processing_fee')
      ]);

      let coinSalesRevenue = 0;
      const coinTx = coinSalesRes.data || [];
      for (const t of coinTx) {
        const meta = t.metadata || {};
        const amountPaid = Number(meta.amount_paid || 0);
        if (!isNaN(amountPaid)) coinSalesRevenue += amountPaid;
      }

      const payouts = payoutsRes.data || [];
      const totalPayouts = payouts.reduce((sum: number, p: { amount?: number }) => sum + Number(p.amount || 0), 0);

      const fees = feesRes.data || [];
      const totalFees = fees.reduce((sum: number, f: { processing_fee?: number }) => sum + Number(f.processing_fee || 0), 0);

      const platformProfit = coinSalesRevenue - totalPayouts;

      return new Response(JSON.stringify({
        coinSalesRevenue,
        totalPayouts,
        totalFees,
        platformProfit
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /testing-mode/status
    if (pathname === 'testing-mode/status' && req.method === 'GET') {
      const { data: testingModeSettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'testing_mode')
        .single();

      const testingMode = testingModeSettings?.value || { enabled: false, signup_limit: 15, current_signups: 0 };

      // Get actual test users count
      const { data: testUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_test_user', true);

      const actualTestUsers = testUsers?.length || 0;

      return new Response(JSON.stringify({
        testingMode,
        benefits: { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true },
        actualTestUsers
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /testing-mode/toggle
    if (pathname === 'testing-mode/toggle' && req.method === 'POST') {
      const body = await req.json();
      const { enabled, resetCounter } = body;

      let currentSettings = { enabled: false, signup_limit: 15, current_signups: 0 };
      const { data: existing } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'testing_mode')
        .single();

      if (existing) {
        currentSettings = existing.value;
      }

      const newSettings = {
        ...currentSettings,
        enabled,
        current_signups: resetCounter ? 0 : currentSettings.current_signups
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'testing_mode', value: newSettings });

      if (error) throw error;

      return new Response(JSON.stringify({ testingMode: newSettings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /testing-mode/reset-counter
    if (pathname === 'testing-mode/reset-counter' && req.method === 'POST') {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'testing_mode')
        .single();

      const currentSettings = existing?.value || { enabled: false, signup_limit: 15, current_signups: 0 };
      const newSettings = { ...currentSettings, current_signups: 0 };

      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'testing_mode', value: newSettings });

      if (error) throw error;

      return new Response(JSON.stringify({ testingMode: newSettings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /risk/overview
    if (pathname === 'risk/overview' && req.method === 'GET') {
      const { data: frozenUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .not('frozen_until', 'is', null)
        .gt('frozen_until', new Date().toISOString());

      const frozenCount = frozenUsers?.length || 0;

      // For simplicity, return empty topHighRisk for now
      const topHighRisk: Array<{ user_id: string; risk_score: number }> = [];

      return new Response(JSON.stringify({
        frozenCount,
        topHighRisk
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /economy/summary
    if (pathname === 'economy/summary' && req.method === 'GET') {
      // Get paid coins data
      const { data: paidCoinsTx } = await supabase
        .from('coin_transactions')
        .select('user_id, amount, type')
        .in('type', ['purchase', 'cashout']);

      const paidCoinsMap = new Map<string, { purchased: number; spent: number }>();
      paidCoinsTx?.forEach((tx: { user_id: string; amount?: number; type: string }) => {
        const existing = paidCoinsMap.get(tx.user_id) || { purchased: 0, spent: 0 };
        if (tx.type === 'purchase') {
          existing.purchased += Math.abs(Number(tx.amount || 0));
        } else if (tx.type === 'cashout') {
          existing.spent += Math.abs(Number(tx.amount || 0));
        }
        paidCoinsMap.set(tx.user_id, existing);
      });

      let totalPurchased = 0;
      let totalSpent = 0;
      for (const data of paidCoinsMap.values()) {
        totalPurchased += data.purchased;
        totalSpent += data.spent;
      }
      const outstandingLiability = totalPurchased - totalSpent;

      // Broadcasters earnings
      const { data: broadcasterEarnings } = await supabase
        .from('earnings_payouts')
        .select('amount, status');

      let totalUsdOwed = 0;
      let paidOutUsd = 0;
      broadcasterEarnings?.forEach((e: { amount?: number; status?: string }) => {
        const amt = Number(e.amount || 0);
        if (e.status === 'paid') {
          paidOutUsd += amt;
        }
        totalUsdOwed += amt;
      });
      const pendingCashoutsUsd = totalUsdOwed - paidOutUsd;

      // Officers earnings (assuming from admin_flags or similar)
      const { data: officerPayments } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'officer_payment');

      const totalUsdPaid = officerPayments?.reduce((sum: number, p: { amount?: number }) => sum + Number(p.amount || 0), 0) || 0;

      // Wheel activity
      const { data: wheelSpins } = await supabase
        .from('coin_transactions')
        .select('amount, metadata')
        .eq('type', 'wheel_spin');

      let totalSpins = 0;
      let totalCoinsSpent = 0;
      let totalCoinsAwarded = 0;
      let jackpotCount = 0;
      wheelSpins?.forEach((spin: { amount?: number; metadata?: any }) => {
        totalSpins++;
        const spent = Math.abs(Number(spin.amount || 0));
        totalCoinsSpent += spent;
        const meta = spin.metadata || {};
        const awarded = Number(meta.coins_awarded || 0);
        totalCoinsAwarded += awarded;
        if (meta.is_jackpot) jackpotCount++;
      });

      return new Response(JSON.stringify({
        paidCoins: {
          totalPurchased,
          totalSpent,
          outstandingLiability
        },
        broadcasters: {
          totalUsdOwed,
          pendingCashoutsUsd,
          paidOutUsd
        },
        officers: {
          totalUsdPaid
        },
        wheel: {
          totalSpins,
          totalCoinsSpent,
          totalCoinsAwarded,
          jackpotCount
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /wheel/status
    if (pathname === 'wheel/status' && req.method === 'GET') {
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

      return new Response(JSON.stringify({ success: true, config: cfg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /wheel/toggle
    if (pathname === 'wheel/toggle' && req.method === 'POST') {
      const body = await req.json();
      const enabled = !!body?.enabled;

      const { data: cfg } = await supabase
        .from('wheel_config')
        .select('id')
        .limit(1)
        .single();

      if (!cfg) {
        const { error: insErr } = await supabase
          .from('wheel_config')
          .insert({ is_active: enabled, spin_cost: 500, max_spins_per_day: 10 });
        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabase
          .from('wheel_config')
          .update({ is_active: enabled })
          .eq('id', cfg.id);
        if (updErr) throw updErr;
      }

      return new Response(JSON.stringify({ success: true, enabled }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /troll-events/spawn
    if (pathname === 'troll-events/spawn' && req.method === 'POST') {
      const body = await req.json();
      const { troll_type = 'green', reward_amount = 10, duration_minutes = 2 } = body;

      const { data: eventId, error } = await supabase.rpc('spawn_troll_event', {
        p_troll_type: troll_type,
        p_reward_amount: reward_amount,
        p_duration_minutes: duration_minutes
      });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, event_id: eventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /troll-events/claim
    if (pathname === 'troll-events/claim' && req.method === 'POST') {
      const body = await req.json();
      const { event_id, user_id } = body;

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

      if (authError || !user || user.id !== user_id) {
        return new Response(JSON.stringify({ error: 'Invalid token or user mismatch' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: result, error } = await supabase.rpc('claim_troll_event', {
        p_event_id: event_id,
        p_user_id: user_id
      });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
