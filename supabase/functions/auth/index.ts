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
    const path = url.pathname.split('/').pop();

    // /admin-create-user
    if (path === 'admin-create-user' && req.method === 'POST') {
      const body = await req.json();
      const { email, password, role, username } = body;
      const r = String(role || 'user').toLowerCase();
      const allowed = ['admin', 'troll_officer', 'troller', 'user'];
      
      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: 'Missing email, password or username' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!allowed.includes(r)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (r === 'admin') {
        const { data: exists } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);
        if ((exists || []).length > 0) {
          return new Response(JSON.stringify({ error: 'Admin already initialized' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: r }
      });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Create failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uid = created.user.id;
      const uname = String(username).trim().slice(0, 20);
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname || email.split('@')[0]}`;
      
      const { error: upErr } = await supabase
        .from('user_profiles')
        .insert({
          id: uid,
          username: uname,
          bio: null,
          role: r === 'troller' ? 'user' : r,
          tier: 'Bronze',
          paid_coin_balance: 0,
          free_coin_balance: 100,
          total_earned_coins: 100,
          total_spent_coins: 0,
          avatar_url: avatar,
          email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: uid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /admin-exists
    if (path === 'admin-exists' && req.method === 'GET') {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
      const exists = (data || []).length > 0;
      
      return new Response(JSON.stringify({ exists }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /whoami
    if (path === 'whoami' && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, id: data.user.id, email: data.user.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /logout
    if (path === 'logout' && req.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Logged out.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /fix-admin-role
    if (path === 'fix-admin-role' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adminEmail = (Deno.env.get('VITE_ADMIN_EMAIL') || 'trollcity2025@gmail.com').trim().toLowerCase();
      const userEmail = String(data.user.email || '').trim().toLowerCase();

      if (userEmail !== adminEmail) {
        return new Response(JSON.stringify({ error: 'Not admin email' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existingProfile.role !== 'admin') {
        await supabase
          .from('user_profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', data.user.id);
        
        return new Response(JSON.stringify({ success: true, profile: { ...existingProfile, role: 'admin' } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, profile: existingProfile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // /signup
    if (path === 'signup' && req.method === 'POST') {
      const body = await req.json();
      const { email, password, username } = body;
      
      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: 'Missing email, password or username' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check testing mode
      const { data: testingModeSettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'testing_mode')
        .single();
      
      const testingMode = testingModeSettings?.value || { enabled: false, signup_limit: 15, current_signups: 0 };
      const isTestingMode = testingMode.enabled;
      
      if (isTestingMode && testingMode.current_signups >= testingMode.signup_limit) {
        return new Response(JSON.stringify({ error: 'Signups are currently limited. Testing mode is active and the signup limit has been reached. Please contact an administrator.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get test user benefits
      const { data: benefitsSettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'test_user_benefits')
        .single();
      
      const benefits = benefitsSettings?.value || { free_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true };

      const trimmedUsername = username.trim();
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: trimmedUsername, is_test_user: isTestingMode },
        app_metadata: { username: trimmedUsername, is_test_user: isTestingMode }
      });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uid = created.user.id;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedUsername}`;
      const initialCoins = isTestingMode ? benefits.free_coins : 100;

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .insert({
          id: uid,
          username: trimmedUsername,
          avatar_url: avatar,
          role: 'user',
          tier: 'Bronze',
          free_coin_balance: initialCoins,
          paid_coin_balance: 0,
          total_earned_coins: initialCoins,
          total_spent_coins: 0,
          is_test_user: isTestingMode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update signup count if testing mode
      if (isTestingMode) {
        await supabase
          .from('app_settings')
          .update({ value: { ...testingMode, current_signups: testingMode.current_signups + 1 } })
          .eq('key', 'testing_mode');
      }

      return new Response(JSON.stringify({ success: true, user: created.user }), {
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
