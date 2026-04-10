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
      const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: `${Deno.env.get("SITE_URL")}/admin/x-ads/oauth-callback`,
          code_verifier: state || "",
        }),
      });

      tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        const userResponse = await fetch("https://api.twitter.com/2/users/me", {
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
          },
        });
        const userData = await userResponse.json();
        platformUserId = userData.data?.id || "";
        platformUsername = userData.data?.username || "";
      }
    } else if (platform === "instagram") {
      const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: `${Deno.env.get("SITE_URL")}/admin/x-ads/oauth-callback`,
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
      const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${Deno.env.get("SITE_URL")}/admin/x-ads/oauth-callback`)}&client_secret=${clientSecret}&code=${code}`);
      
      tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${tokenData.access_token}`);
        const userData = await userResponse.json();
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