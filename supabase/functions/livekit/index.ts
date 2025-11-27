import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken } from "https://deno.land/x/livekit_server_sdk@1.0.3/mod.ts";

// Generate LiveKit token
async function generateLiveKitToken(apiKey: string, apiSecret: string, roomName: string, identity: string) {
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: identity,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return at.toJwt();
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { channelName, uid, role } = body;

    if (!channelName || !uid) {
      return new Response(JSON.stringify({ error: 'Missing channelName or uid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_KEY = Deno.env.get('LIVEKIT_API_KEY')!;
    const API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!;

    if (!API_KEY || !API_SECRET) {
      return new Response(JSON.stringify({ error: 'LiveKit API key and secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await generateLiveKitToken(
      API_KEY,
      API_SECRET,
      channelName,
      uid
    );

    return new Response(JSON.stringify({
      token,
      channelName,
      uid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Agora token generation error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
