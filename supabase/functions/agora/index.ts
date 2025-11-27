import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const appId = Deno.env.get('AGORA_APP_ID') || '7b95b64b0e154f7ab931e2abf000e694';

    // For now, return a mock token - TODO: Implement proper Agora token generation
    const mockToken = `006${appId}00000000000000000000000000000000${Date.now().toString().slice(-10)}`;

    return new Response(JSON.stringify({
      token: mockToken,
      appId,
      channelName,
      uid,
      expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours from now
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
