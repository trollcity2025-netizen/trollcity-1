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
    const { platform, code_challenge, code_verifier } = await req.json();
    
    if (!platform || !["x", "instagram", "facebook"].includes(platform)) {
      throw new Error("Invalid platform. Must be 'x', 'instagram', or 'facebook'");
    }

    // X (Twitter) OAuth2 now requires PKCE
    if (platform === "x" && !code_challenge) {
      throw new Error("Missing PKCE code_challenge for X OAuth");
    }

    // Use env vars for credentials
    const finalClientId = Deno.env.get("SOCIAL_OAUTH_CLIENT_ID") || "";
    const finalClientSecret = Deno.env.get("SOCIAL_OAUTH_CLIENT_SECRET") || "";
    const finalRedirectUri = (Deno.env.get("SITE_URL") || "https://maitrollcity.com").replace(/\/$/, "") + '/admin/x-ads/oauth-callback';

    log('Input', { platform, hasCodeChallenge: !!code_challenge });

    if (!finalClientId) {
      throw new Error("OAuth client_id not configured.");
    }

    log('Building auth URL', { clientId: finalClientId, redirectUri: finalRedirectUri });

    let authUrl = "";
    let scopes = "";

    if (platform === "x") {
      scopes = "tweet.read tweet.write users.read offline.access";
      const stateValue = code_verifier ? `${code_verifier}|${Date.now()}` : `${finalClientId}|${Date.now()}`;
      if (code_challenge) {
        authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&code_challenge=${code_challenge}&code_challenge_method=S256&state=${stateValue}`;
      } else {
        authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${stateValue}`;
      }
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