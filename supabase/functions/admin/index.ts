import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
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
    const path = url.pathname.split('/').filter(p => p).pop(); // Get the last path segment

    // /profit-summary
    if (path === 'profit-summary' && req.method === 'GET') {
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
      const totalPayouts = payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const fees = feesRes.data || [];
      const totalFees = fees.reduce((sum, f) => sum + Number(f.processing_fee || 0), 0);

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
    if (path === 'testing-mode' && req.method === 'GET') {
      const { data: testingModeSettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'testing_mode')
        .single();

      const testingMode = testingModeSettings?.value || { enabled: false, signup_limit: 15, current_signups: 0 };

      return new Response(JSON.stringify(testingMode), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /risk/overview
    if (path === 'risk' && req.method === 'GET') {
      const { data: frozenUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .not('frozen_until', 'is', null)
        .gt('frozen_until', new Date().toISOString());

      const frozenCount = frozenUsers?.length || 0;

      // For simplicity, return empty topHighRisk for now
      const topHighRisk = [];

      return new Response(JSON.stringify({
        frozenCount,
        topHighRisk
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /economy/summary
    if (path === 'economy' && req.method === 'GET') {
      // Get paid coins data
      const { data: paidCoinsTx } = await supabase
        .from('coin_transactions')
        .select('user_id, amount, type')
        .in('type', ['purchase', 'cashout']);

      const paidCoinsMap = new Map();
      paidCoinsTx?.forEach(tx => {
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
      broadcasterEarnings?.forEach(e => {
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

      const totalUsdPaid = officerPayments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

      // Wheel activity
      const { data: wheelSpins } = await supabase
        .from('coin_transactions')
        .select('amount, metadata')
        .eq('type', 'wheel_spin');

      let totalSpins = 0;
      let totalCoinsSpent = 0;
      let totalCoinsAwarded = 0;
      let jackpotCount = 0;
      wheelSpins?.forEach(spin => {
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
