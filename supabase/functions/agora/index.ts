import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-token@2.0.4";

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
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appCertificate) {
      return new Response(JSON.stringify({ error: 'Agora app certificate not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert role string to RtcRole enum
    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Token valid for 24 hours
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 86400;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + 86400;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      parseInt(uid),
      rtcRole,
      privilegeExpiredTs
    );

    return new Response(JSON.stringify({
      token,
      appId,
      channelName,
      uid,
      expiresAt: new Date(expirationTimeInSeconds * 1000).toISOString()
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
