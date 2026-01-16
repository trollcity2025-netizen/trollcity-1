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

    if (req.method === 'POST') {
      let body: any = {};
      try { body = await req.json(); } catch { /* ignore */ }
      const action = body?.action || '';
      const command = body?.command || '';

      if (action === 'testing-mode' && command === 'status') {
        try {
          const { data: testingModeSettings, error: settingsError } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'testing_mode')
            .maybeSingle();

          // If no settings exist, create default
          let testingMode = { enabled: false, signup_limit: 15, current_signups: 0 };
          
          if (settingsError && settingsError.code !== 'PGRST116') {
            console.error('Error fetching testing mode settings:', settingsError);
          } else if (testingModeSettings?.setting_value) {
            testingMode = testingModeSettings.setting_value;
          } else {
            // Create default settings if they don't exist
            // Use upsert with onConflict to handle race conditions
            const { error: upsertError } = await supabase
              .from('app_settings')
              .upsert({ 
                setting_key: 'testing_mode', 
                setting_value: testingMode,
                description: 'Testing mode configuration for controlled signups',
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'setting_key',
                ignoreDuplicates: false
              });
            
            // If upsert fails, try to fetch the existing value (might have been created by another request)
            if (upsertError) {
              console.warn('Upsert failed, attempting to fetch existing settings:', upsertError.message);
              const { data: existingAfterUpsert, error: fetchAfterError } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'testing_mode')
                .maybeSingle();
              
              if (!fetchAfterError && existingAfterUpsert?.setting_value) {
                testingMode = existingAfterUpsert.setting_value;
              } else if (fetchAfterError && !fetchAfterError.message?.includes('duplicate key')) {
                console.error('Error fetching testing mode after upsert failure:', fetchAfterError);
              }
            }
          }

          const { data: testUsers, error: testUsersError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('is_test_user', true);

          if (testUsersError) {
            console.error('Error fetching test users:', testUsersError);
          }

          const actualTestUsers = testUsers?.length || 0;

          return new Response(JSON.stringify({
            success: true,
            testingMode,
            benefits: { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true },
            actualTestUsers
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (err: any) {
          console.error('Testing mode status error:', err);
          return new Response(JSON.stringify({
            success: false,
            error: err?.message || 'Failed to fetch testing mode status',
            testingMode: { enabled: false, signup_limit: 15, current_signups: 0 },
            benefits: { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true },
            actualTestUsers: 0
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      if (action === 'testing-mode' && command === 'toggle') {
        try {
          const enabled = !!body?.enabled;
          const resetCounter = !!body?.resetCounter;

          let currentSettings = { enabled: false, signup_limit: 15, current_signups: 0 };
          const { data: existing, error: fetchError } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'testing_mode')
            .maybeSingle();
          
          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching testing mode settings:', fetchError);
          } else if (existing?.setting_value) {
            currentSettings = existing.setting_value;
          }

          const newSettings = {
            ...currentSettings,
            enabled,
            current_signups: resetCounter ? 0 : currentSettings.current_signups
          };

          // Try update first (most common case)
          const { data: updated, error: updateError } = await supabase
            .from('app_settings')
            .update({
              setting_value: newSettings,
              description: 'Testing mode configuration for controlled signups',
              updated_at: new Date().toISOString()
            })
            .eq('setting_key', 'testing_mode')
            .select('setting_value')
            .maybeSingle();

          let finalSettings = newSettings;

          // If update didn't find a row, insert instead
          if (updateError || !updated) {
            const { error: insertError } = await supabase
              .from('app_settings')
              .insert({
                setting_key: 'testing_mode',
                setting_value: newSettings,
                description: 'Testing mode configuration for controlled signups',
                updated_at: new Date().toISOString()
              })
              .select('setting_value')
              .maybeSingle();

            // If insert fails due to unique constraint (race condition), try update again
            if (insertError) {
              if (insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
                // Another process inserted it, try update one more time
                const { data: retryUpdated, error: retryError } = await supabase
                  .from('app_settings')
                  .update({
                    setting_value: newSettings,
                    description: 'Testing mode configuration for controlled signups',
                    updated_at: new Date().toISOString()
                  })
                  .eq('setting_key', 'testing_mode')
                  .select('setting_value')
                  .maybeSingle();

                if (retryError) {
                  console.error('Error updating testing mode after retry:', retryError);
                  throw retryError;
                }
                finalSettings = retryUpdated?.setting_value || newSettings;
              } else {
                console.error('Error inserting testing mode:', insertError);
                throw insertError;
              }
            } else {
              finalSettings = newSettings;
            }
          } else {
            finalSettings = updated?.setting_value || newSettings;
          }

          console.log('Testing mode toggle - enabled:', enabled, 'finalSettings:', finalSettings);

          return new Response(JSON.stringify({ 
            success: true, 
            testingMode: finalSettings 
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (err: any) {
          console.error('Testing mode toggle error:', err);
          return new Response(JSON.stringify({ 
            success: false, 
            error: err?.message || 'Failed to toggle testing mode' 
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      if (action === 'testing-mode' && command === 'reset') {
        try {
          const { data: existing, error: fetchError } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'testing_mode')
            .maybeSingle();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching testing mode settings:', fetchError);
          }

          const currentSettings = existing?.setting_value || { enabled: false, signup_limit: 15, current_signups: 0 };
          const newSettings = { ...currentSettings, current_signups: 0 };

          // Try update first
          const { data: updated, error: updateError } = await supabase
            .from('app_settings')
            .update({
              setting_value: newSettings,
              description: 'Testing mode configuration for controlled signups',
              updated_at: new Date().toISOString()
            })
            .eq('setting_key', 'testing_mode')
            .select('setting_value')
            .maybeSingle();

          // If update didn't find a row, insert instead
          if (updateError || !updated) {
            const { error: insertError } = await supabase
              .from('app_settings')
              .insert({
                setting_key: 'testing_mode',
                setting_value: newSettings,
                description: 'Testing mode configuration for controlled signups',
                updated_at: new Date().toISOString()
              })
              .select('setting_value')
              .maybeSingle();

            // If insert fails due to unique constraint (race condition), try update again
            if (insertError) {
              if (insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
                // Another process inserted it, try update one more time
                const { error: retryError } = await supabase
                  .from('app_settings')
                  .update({
                    setting_value: newSettings,
                    description: 'Testing mode configuration for controlled signups',
                    updated_at: new Date().toISOString()
                  })
                  .eq('setting_key', 'testing_mode');

                if (retryError) {
                  console.error('Error resetting testing mode counter after retry:', retryError);
                  throw retryError;
                }
              } else {
                console.error('Error resetting testing mode counter:', insertError);
                throw insertError;
              }
            }
          }

          return new Response(JSON.stringify({ success: true, testingMode: newSettings }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (err: any) {
          console.error('Testing mode reset error:', err);
          return new Response(JSON.stringify({ 
            success: false, 
            error: err?.message || 'Failed to reset testing mode counter' 
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }
    }

    // /profit-summary
    if (pathname === 'profit-summary' && req.method === 'GET') {
      // Get profit summary data
      const [
        coinSalesRes,
        payoutsRes,
        feesRes
      ] = await Promise.all([
        supabase.from('coin_transactions').select('metadata, platform_profit').eq('type', 'purchase'),
        supabase.from('earnings_payouts').select('amount'),
        supabase.from('payout_requests').select('processing_fee')
      ]);

      let coinSalesRevenue = 0;
      const coinTx = coinSalesRes.data || [];
      for (const t of coinTx) {
        const profit = Number(t.platform_profit || 0);
        if (profit > 0) {
          coinSalesRevenue += profit;
        } else {
          const meta = t.metadata || {};
          const amountPaid = Number(meta.amount_paid || 0);
          if (!isNaN(amountPaid)) coinSalesRevenue += amountPaid;
        }
      }

      const payouts = payoutsRes.data || [];
      const totalPayouts = payouts.reduce((sum: number, p: { amount?: number }) => sum + Number(p.amount || 0), 0);

      const fees = feesRes.data || [];
      const totalFees = fees.reduce((sum: number, f: { processing_fee?: number }) => sum + Number(f.processing_fee || 0), 0);

      const platformProfit = coinSalesRevenue - totalPayouts;

      return new Response(JSON.stringify({
        success: true,
        data: {
          coinSalesRevenue,
          totalPayouts,
          totalFees,
          platformProfit
        }
      }), {
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
      // Get troll_coins data
      const { data: troll_coinsTx } = await supabase
        .from('coin_transactions')
        .select('user_id, amount, type')
        .in('type', ['purchase', 'cashout']);

      const troll_coinsMap = new Map<string, { purchased: number; spent: number }>();
      troll_coinsTx?.forEach((tx: { user_id: string; amount?: number; type: string }) => {
        const existing = troll_coinsMap.get(tx.user_id) || { purchased: 0, spent: 0 };
        if (tx.type === 'purchase') {
          existing.purchased += Math.abs(Number(tx.amount || 0));
        } else if (tx.type === 'cashout') {
          existing.spent += Math.abs(Number(tx.amount || 0));
        }
        troll_coinsMap.set(tx.user_id, existing);
      });

      let totalPurchased = 0;
      let totalSpent = 0;
      for (const data of troll_coinsMap.values()) {
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

      return new Response(JSON.stringify({
        troll_coins: {
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
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /troll-events/spawn
    if (pathname === 'troll-events/spawn' && req.method === 'POST') {
      // Use the body already parsed at the top level if available
      let spawnBody = body;
      if (!spawnBody || Object.keys(spawnBody).length === 0) {
        try {
          spawnBody = await req.json();
        } catch {
          spawnBody = {};
        }
      }
      const { troll_type = 'green', reward_amount = 10, duration_minutes = 2 } = spawnBody;

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
      // Use the body already parsed at the top level if available
      let claimBody = body;
      if (!claimBody || Object.keys(claimBody).length === 0) {
        try {
          claimBody = await req.json();
        } catch {
          claimBody = {};
        }
      }
      const { event_id, user_id } = claimBody;

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
