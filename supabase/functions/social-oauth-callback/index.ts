import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const platform = url.searchParams.get("platform");
    const state = url.searchParams.get("state");

    if (!code || !platform) {
      throw new Error("Missing code or platform");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";

    let tokenData: any = null;
    let platformUserId = "";
    let platformUsername = "";

    if (platform === "x") {
      const stateParts = (state || '').split('|');
      const codeVerifier = stateParts[0] || "";
      const callbackClientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
      const callbackClientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
      // Use same redirect URI pattern as init function
      const redirectUri = (Deno.env.get("SITE_URL") || "https://maitrollcity.com").replace(/\/$/, "") + "/admin/x-ads/oauth-callback";

      console.log('X OAuth - using client_id:', callbackClientId, 'code_verifier:', codeVerifier ? 'yes' : 'none', 'redirect_uri:', redirectUri);

      const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${callbackClientId}:${callbackClientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      tokenData = await tokenResponse.json();
      console.log('X token response:', tokenData);

      if (tokenData.access_token) {
        const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=id,username,name", {
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
          },
        });
        const userData = await userResponse.json();
        console.log('X user response:', userData);
        platformUserId = userData.data?.id || "";
        platformUsername = userData.data?.username || "";
      }
    } else if (platform === "instagram") {
      const igClientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
      const igClientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
      const redirectUri = (Deno.env.get("SITE_URL") || "https://maitrollcity.com").replace(/\/$/, "") + "/admin/x-ads/oauth-callback";

      const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: igClientId,
          client_secret: igClientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code: code,
        }),
      });

      tokenData = await tokenResponse.response.json();

      if (tokenData.access_token) {
        const userResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`);
        const userData = await userResponse.json();
        platformUserId = userData.id || "";
        platformUsername = userData.username || "";
      }
    } else if (platform === "facebook") {
      const fbClientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
      const fbClientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
      const redirectUri = (Deno.env.get("SITE_URL") || "https://maitrollcity.com").replace(/\/$/, "") + "/admin/x-ads/oauth-callback";

      const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${fbClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${fbClientSecret}&code=${code}`);
      
      tokenData = await tokenResponse.json();
      console.log('FB token response:', tokenData);

      if (tokenData.access_token) {
        const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${tokenData.access_token}`);
        const userData = await userResponse.json();
        console.log('FB user response:', userData);
        platformUserId = userData.id || "";
        platformUsername = userData.name || "";
      }
    }

    // Save account to database
    if (platformUserId && tokenData?.access_token) {
      const { error: upsertError } = await supabase.from('connected_social_accounts').upsert({
        user_id: null, // Will be set by auth context
        platform: platform,
        platform_user_id: platformUserId,
        platform_username: platformUsername,
        platform_display_name: platformUsername,
        access_token_encrypted: tokenData.access_token,
        refresh_token_encrypted: tokenData.refresh_token || "",
        token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        account_status: 'active',
        last_synced_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' });

      if (upsertError) {
        console.error('Failed to save account:', upsertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        platform: platform,
        username: platformUsername
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});