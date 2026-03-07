// Edge function to start Agora RTMP relay to Mux
// This pushes the host's Agora stream to Mux for HLS playback

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json();
    const { 
      stream_id, 
      agora_channel_name, 
      agora_uid, 
      mux_rtmp_url, 
      mux_stream_key 
    } = body || {};

    if (!stream_id || !agora_channel_name || !mux_rtmp_url || !mux_stream_key) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: stream_id, agora_channel_name, agora_uid, mux_rtmp_url, mux_stream_key' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get Agora credentials from environment
    const agoraAppId = Deno.env.get('AGORA_APP_ID');
    const agoraAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!agoraAppId) {
      return new Response(JSON.stringify({ error: 'Agora App ID not configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Generate Agora RTMP push token if certificate is available
    let rtmpToken = '';
    if (agoraAppCertificate) {
      // For RTMP relay, we need a publisher token
      // The channel name for RTMP relay is: protocol + ":" + push URL
      // We'll use a simplified token generation
      const channelForToken = `rtmp:${mux_rtmp_url}/${mux_stream_key}`;
      
      // Import crypto for timestamp calculation
      const timestamp = Math.floor(Date.now() / 1000) + 3600; // Token valid for 1 hour
      const randomInt = Math.floor(Math.random() * 1000000);
      
      // Build the signature
      const signatureInfo = `${agoraAppId}${channelForToken}${agora_uid}${timestamp}`;
      
      // For simplicity, we'll skip token for RTMP relay in most cases
      // Agora RTC token doesn't work directly for RTMP - need special handling
      console.log('[RTMP Relay] Starting relay without token (or with special handling)');
    }

    // Store the relay configuration in the database for tracking
    const { data: streamData, error: streamError } = await supabase
      .from('streams')
      .select('id, mux_stream_key, egress_id')
      .eq('id', stream_id)
      .single();

    if (streamError || !streamData) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Store the RTMP relay info
    // Note: The actual RTMP relay needs to be started from the frontend using Agora SDK
    // This function stores the configuration and returns what the frontend needs
    
    // The RTMP push URL format: rtmp://global-live.mux.com:5222/app/{stream_key}
    const fullRtmpUrl = `${mux_rtmp_url}/${mux_stream_key}`;
    
    // Update stream with relay status
    await supabase
      .from('streams')
      .update({
        // Store relay configuration
        mux_rtmp_url: fullRtmpUrl,
        // Mark that relay should be active
        status: 'live'
      })
      .eq('id', stream_id);

    return new Response(JSON.stringify({ 
      success: true, 
      rtmp_url: fullRtmpUrl,
      stream_key: mux_stream_key,
      message: 'RTMP relay configuration ready. Frontend should start Agora RTMP push.'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('RTMP Relay Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
