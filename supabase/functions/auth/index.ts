import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const decodeSettingValue = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const buildAppSettingFetcher = (client: ReturnType<typeof createClient>) => async (key: string) => {
  try {
    const { data, error } = await client
      .from("app_settings")
      .select("setting_value")
      .eq("key", key)
      .single();

    if (error) {
      throw error;
    }

    return decodeSettingValue(data?.setting_value ?? null);
  } catch (error: any) {
    console.warn(
      `Unable to load app_settings.${key} (row or table may be missing); falling back to defaults.`,
      error?.message || error
    );
    return null;
  }
};

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const fetchAppSettingValue = buildAppSettingFetcher(supabase);

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
          troll_coins: 0,
          total_earned_coins: 0,
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
        .limit(2);
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

    if (path === 'logout' && req.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Logged out.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'delete-account' && req.method === 'POST') {
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

      const userId = data.user.id;

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message || 'Failed to delete auth user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message || 'Failed to delete profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // /signup - No auth required (user doesn't exist yet)
    // This endpoint uses service role key internally, so no user auth needed
    if (path === 'signup' && req.method === 'POST') {
      const body = await req.json();
      const { email, password, username, referral_code } = body;
      
      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: 'Missing email, password or username' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check testing mode
      const testingModeSetting = await fetchAppSettingValue('testing_mode');
      const testingMode = testingModeSetting || { enabled: false, signup_limit: 15, current_signups: 0 };
      const isTestingMode = testingMode.enabled;

      if (isTestingMode && testingMode.current_signups >= testingMode.signup_limit) {
        return new Response(JSON.stringify({ error: 'Signups are currently limited. Testing mode is active and the signup limit has been reached. Please contact an administrator.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get test user benefits
      const benefitsSetting = await fetchAppSettingValue('test_user_benefits');
      const benefits = benefitsSetting || { initial_coins: 5000, bypass_family_fee: true, bypass_admin_message_fee: true };

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
      const initialCoins = isTestingMode ? (benefits.initial_coins ?? benefits.free_coins ?? 0) : 0;

      const profilePayload = {
        id: uid,
        username: trimmedUsername,
        avatar_url: avatar,
        email,
        role: 'user',
        tier: 'Bronze',
        troll_coins: initialCoins,
        free_troll_coins: 0,
        total_earned_coins: initialCoins,
        total_spent_coins: 0,
        is_test_user: isTestingMode,
        updated_at: new Date().toISOString()
      };

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileErr) {
        console.error('Profile creation error:', profileErr);
        return new Response(JSON.stringify({
          error: `Database error creating user profile: ${profileErr.message}`,
          details: profileErr
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update signup count if testing mode
      if (isTestingMode) {
        await supabase
          .from('app_settings')
          .update({ setting_value: { ...testingMode, current_signups: testingMode.current_signups + 1 } })
          .eq('key', 'testing_mode');
      }

      // Handle referral code if provided
      if (referral_code) {
        try {
          // Verify referral code is a valid user ID
          const { data: recruiterProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', referral_code)
            .single();

          if (recruiterProfile && recruiterProfile.id !== uid) {
            // Create referral relationship using new table structure
            const { error: referralError } = await supabase
              .from('referrals')
              .insert({
                referrer_id: referral_code,
                referred_user_id: uid,
                referred_at: new Date().toISOString(),
                reward_status: 'pending',
                deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() // 21 days from now
              });

            if (referralError) {
              console.error('Error creating referral:', referralError);
              // Don't fail signup if referral creation fails
            }
          }
        } catch (error) {
          console.error('Error processing referral code:', error);
          // Don't fail signup if referral processing fails
        }
      }

      return new Response(JSON.stringify({ success: true }), {
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
