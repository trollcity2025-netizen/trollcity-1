import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Coin transaction utilities
const deductCoins = async (params: any) => {
  const { userId, amount, type, coinType, metadata, supabaseClient } = params;
  
  const { data: profile } = await supabaseClient
    .from('user_profiles')
    .select('free_coin_balance, paid_coin_balance')
    .eq('id', userId)
    .single();
  
  if (!profile) return { success: false, error: 'User not found' };
  
  const currentBalance = coinType === 'free' ? profile.free_coin_balance : profile.paid_coin_balance;
  if (currentBalance < amount) return { success: false, error: 'Insufficient coins' };
  
  const updateField = coinType === 'free' ? 'free_coin_balance' : 'paid_coin_balance';
  const { error } = await supabaseClient
    .from('user_profiles')
    .update({ [updateField]: currentBalance - amount })
    .eq('id', userId);
  
  if (error) return { success: false, error: error.message };
  
  await supabaseClient.from('coin_transactions').insert({
    user_id: userId,
    amount: -amount,
    type,
    coin_type: coinType,
    metadata,
  });
  
  return { success: true };
};

const addCoins = async (params: any) => {
  const { userId, amount, type, coinType, metadata, supabaseClient } = params;
  
  const { data: profile } = await supabaseClient
    .from('user_profiles')
    .select('free_coin_balance, paid_coin_balance')
    .eq('id', userId)
    .single();
  
  if (!profile) return { success: false, error: 'User not found' };
  
  const currentBalance = coinType === 'free' ? profile.free_coin_balance : profile.paid_coin_balance;
  const updateField = coinType === 'free' ? 'free_coin_balance' : 'paid_coin_balance';
  
  const { error } = await supabaseClient
    .from('user_profiles')
    .update({ [updateField]: currentBalance + amount })
    .eq('id', userId);
  
  if (error) return { success: false, error: error.message };
  
  await supabaseClient.from('coin_transactions').insert({
    user_id: userId,
    amount,
    type,
    coin_type: coinType,
    metadata,
  });
  
  return { success: true };
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // /deduct endpoint
    if (path === 'deduct' && req.method === 'POST') {
      const body = await req.json();
      const { userId: bodyUserId, amount } = body;
      const amt = Number(amount || 0);

      if (!bodyUserId || userId !== bodyUserId) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!Number.isFinite(amt) || amt <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await deductCoins({
        userId,
        amount: amt,
        type: 'wheel_spin',
        coinType: 'free',
        metadata: { action: 'wheel_spin_cost' },
        supabaseClient: supabase
      });

      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: result.error || 'Failed to deduct coins' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, free_coin_balance, paid_coin_balance')
        .eq('id', userId)
        .single();

      return new Response(JSON.stringify({ success: true, profile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /award endpoint
    if (path === 'award' && req.method === 'POST') {
      const body = await req.json();
      const { userId: bodyUserId, awardType, value } = body;

      if (!bodyUserId || userId !== bodyUserId) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();

      if (awardType === 'coins') {
        const add = Number(value || 0);
        if (!Number.isFinite(add) || add <= 0) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid coin value' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await addCoins({
          userId,
          amount: add,
          type: 'wheel_prize',
          coinType: 'free',
          metadata: { source: 'wheel_spin', prize_type: 'coins' },
          supabaseClient: supabase
        });

        if (!result.success) {
          return new Response(JSON.stringify({ success: false, error: result.error || 'Failed to award coins' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        return new Response(JSON.stringify({ success: true, profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (awardType === 'insurance') {
        const { data: updated, error: updErr } = await supabase
          .from('user_profiles')
          .update({ has_insurance: true, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single();
        
        if (updErr) throw updErr;
        
        return new Response(JSON.stringify({ success: true, profile: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (awardType === 'multiplier') {
        const mult = Number(value || 0);
        if (!Number.isFinite(mult) || mult <= 0) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid multiplier value' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const { data: updated, error: updErr } = await supabase
          .from('user_profiles')
          .update({ 
            multiplier_active: true, 
            multiplier_value: mult, 
            multiplier_expires: expires, 
            updated_at: now 
          })
          .eq('id', userId)
          .select('*')
          .single();
        
        if (updErr) throw updErr;
        
        return new Response(JSON.stringify({ success: true, profile: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (awardType === 'bankrupt') {
        const { data: insurance } = await supabase
          .from('user_insurances')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gte('expires_at', now)
          .or('protection_type.eq.bankrupt,protection_type.eq.full')
          .limit(1)
          .maybeSingle();

        if (insurance) {
          await supabase
            .from('user_insurances')
            .update({ is_active: false })
            .eq('id', insurance.id);

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

          return new Response(JSON.stringify({ 
            success: true, 
            protected: true, 
            message: 'Insurance protected you from bankruptcy!',
            profile 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: updated, error: updErr } = await supabase
          .from('user_profiles')
          .update({ free_coin_balance: 0, paid_coin_balance: 0, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single();
        
        if (updErr) throw updErr;
        
        return new Response(JSON.stringify({ success: true, protected: false, profile: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid award type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /status endpoint
    if (path === 'status' && req.method === 'GET') {
      const { data: config } = await supabase
        .from('wheel_config')
        .select('*')
        .limit(1)
        .single();

      const isActive = config?.is_active || false;
      const cost = config?.spin_cost || 1;
      const maxSpins = config?.max_spins_per_day || 3;

      return new Response(JSON.stringify({
        success: true,
        isActive,
        cost,
        maxSpins
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /spins-left endpoint
    if (path === 'spins-left' && req.method === 'GET') {
      let { data: config } = await supabase
        .from('wheel_config')
        .select('*')
        .limit(1)
        .single();

      if (!config) {
        const { data: newConfig } = await supabase
          .from('wheel_config')
          .insert({ is_active: true, spin_cost: 500, max_spins_per_day: 10 })
          .select('*')
          .single();
        config = newConfig || { is_active: true, spin_cost: 500, max_spins_per_day: 10 };
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: spins } = await supabase
        .from('wheel_spins')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      const used = Array.isArray(spins) ? spins.length : 0;
      const maxSpins = Number(config?.max_spins_per_day || 3);
      const spinsLeft = Math.max(0, maxSpins - used);

      return new Response(JSON.stringify({
        success: true,
        isActive: !!config?.is_active,
        maxSpins,
        spins_used: used,
        spins_left: spinsLeft
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /spin endpoint
    if (path === 'spin' && req.method === 'POST') {
      const body = await req.json();
      const { userId: bodyUserId } = body;

      if (!bodyUserId || userId !== bodyUserId) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let { data: config } = await supabase
        .from('wheel_config')
        .select('*')
        .limit(1)
        .single();

      if (!config) {
        // Insert default config
        const { data: newConfig, error: insertError } = await supabase
          .from('wheel_config')
          .insert({
            is_active: true,
            spin_cost: 1,
            max_spins_per_day: 3
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create wheel config:', insertError);
          return new Response(JSON.stringify({ success: false, error: 'Wheel configuration error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        config = newConfig;
      }

      if (!config.is_active) {
        return new Response(JSON.stringify({ success: false, error: 'Wheel is not active' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const spinCost = config.spin_cost || 1;

      // Deduct spin cost
      const deductResult = await deductCoins({
        userId,
        amount: spinCost,
        type: 'wheel_spin',
        coinType: 'free',
        metadata: { action: 'wheel_spin_cost' },
        supabaseClient: supabase
      });

      if (!deductResult.success) {
        return new Response(JSON.stringify({ success: false, error: deductResult.error || 'Failed to deduct coins' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: spins } = await supabase
        .from('wheel_spins')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      if (spins && spins.length >= (config.max_spins_per_day || 3)) {
        return new Response(JSON.stringify({ success: false, error: 'Daily spin limit reached' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prizes = [
        { type: 'coins', value: 10, weight: 30 },
        { type: 'coins', value: 25, weight: 20 },
        { type: 'coins', value: 50, weight: 15 },
        { type: 'coins', value: 100, weight: 10 },
        { type: 'multiplier', value: 1.5, weight: 10 },
        { type: 'multiplier', value: 2, weight: 5 },
        { type: 'insurance', value: 1, weight: 5 },
        { type: 'bankrupt', value: 0, weight: 5 }
      ];

      const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedPrize = prizes[0];

      for (const prize of prizes) {
        random -= prize.weight;
        if (random <= 0) {
          selectedPrize = prize;
          break;
        }
      }

      // Record the spin
      await supabase.from('wheel_spins').insert({
        user_id: userId,
        prize_type: selectedPrize.type,
        prize_value: selectedPrize.value,
        created_at: new Date().toISOString()
      });

      // Award the prize
      let awardResult;
      if (selectedPrize.type === 'coins') {
        awardResult = await addCoins({
          userId,
          amount: selectedPrize.value,
          type: 'wheel_prize',
          coinType: 'free',
          metadata: { source: 'wheel_spin', prize_type: 'coins', is_jackpot: selectedPrize.value >= 100 },
          supabaseClient: supabase
        });
      } else if (selectedPrize.type === 'insurance') {
        const now = new Date().toISOString();
        const { data: updated, error: updErr } = await supabase
          .from('user_profiles')
          .update({ has_insurance: true, updated_at: now })
          .eq('id', userId)
          .select('*')
          .single();

        awardResult = updErr ? { success: false, error: updErr.message } : { success: true, profile: updated };
      } else if (selectedPrize.type === 'multiplier') {
        const mult = selectedPrize.value;
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        const { data: updated, error: updErr } = await supabase
          .from('user_profiles')
          .update({
            multiplier_active: true,
            multiplier_value: mult,
            multiplier_expires: expires,
            updated_at: now
          })
          .eq('id', userId)
          .select('*')
          .single();

        awardResult = updErr ? { success: false, error: updErr.message } : { success: true, profile: updated };
      } else if (selectedPrize.type === 'bankrupt') {
        const now = new Date().toISOString();
        const { data: insurance } = await supabase
          .from('user_insurances')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gte('expires_at', now)
          .or('protection_type.eq.bankrupt,protection_type.eq.full')
          .limit(1)
          .maybeSingle();

        if (insurance) {
          await supabase
            .from('user_insurances')
            .update({ is_active: false })
            .eq('id', insurance.id);

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

          awardResult = { success: true, protected: true, message: 'Insurance protected you from bankruptcy!', profile };
        } else {
          const { data: updated, error: updErr } = await supabase
            .from('user_profiles')
            .update({ free_coin_balance: 0, paid_coin_balance: 0, updated_at: now })
            .eq('id', userId)
            .select('*')
            .single();

          awardResult = updErr ? { success: false, error: updErr.message } : { success: true, protected: false, profile: updated };
        }
      }

      if (!awardResult.success) {
        return new Response(JSON.stringify({ success: false, error: awardResult.error || 'Failed to award prize' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      return new Response(JSON.stringify({
        success: true,
        prize: selectedPrize,
        profile
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
