import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(message: string, data?: any) {
  console.log(`[OAuth] ${message}`, data || '');
}

interface OAuthConfig {
  x: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  instagram: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  facebook: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

function getOAuthConfig(): OAuthConfig {
  const clientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
  const siteUrl = Deno.env.get("SITE_URL") || "https://maitrollcity.com";
  
  return {
    x: {
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: `${siteUrl}/admin/x-ads/oauth-callback`,
    },
    instagram: {
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: `${siteUrl}/admin/x-ads/oauth-callback`,
    },
    facebook: {
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: `${siteUrl}/admin/x-ads/oauth-callback`,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { platform, redirect_url, client_id, client_secret } = await req.json();
    
    if (!platform || !["x", "instagram", "facebook"].includes(platform)) {
      throw new Error("Invalid platform. Must be 'x', 'instagram', or 'facebook'");
    }

    // Use provided credentials or fall back to env
    const finalClientId = client_id || Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
    const finalClientSecret = client_secret || Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
    const finalRedirectUri = redirect_url || 'https://maitrollcity.com/admin/x-ads/oauth-callback';

    log('Input', { platform, hasClientId: !!client_id, hasSecret: !!client_secret, redirect_url });

    if (!finalClientId) {
      throw new Error("OAuth client_id required.");
    }

    log('Building auth URL', { clientId: finalClientId, redirectUri: finalRedirectUri });

    let authUrl = "";
    let scopes = "";

    if (platform === "x") {
      scopes = "tweet.read tweet.write users.read offline.access";
      authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${Date.now()}`;
      log('X Auth URL built', { authUrl });
    } else if (platform === "instagram") {
      scopes = "instagram_basic,instagram_content_publish,instagram_manage_insights";
      authUrl = `https://api.instagram.com/oauth/authorize?client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${Date.now()}`;
    } else if (platform === "facebook") {
      scopes = "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish";
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${Date.now()}`;
    }

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});