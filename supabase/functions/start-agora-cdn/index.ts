// Edge function to start Agora CDN pushing
// This enables HLS streaming via Agora's CDN for viewer playback

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
    const { stream_id, channel_name } = body || {};

    if (!stream_id || !channel_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: stream_id, channel_name' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get Agora credentials from environment
    const agoraAppId = Deno.env.get('AGORA_APP_ID');
    const agoraAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    const agoraCustomerId = Deno.env.get('AGORA_CUSTOMER_ID');
    const agoraCustomerSecret = Deno.env.get('AGORA_CUSTOMER_SECRET');

    if (!agoraAppId || !agoraCustomerId || !agoraCustomerSecret) {
      return new Response(JSON.stringify({ error: 'Agora credentials not configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get Agora token for API call
    const { data: streamData } = await supabase
      .from('streams')
      .select('agora_token, user_id')
      .eq('id', stream_id)
      .single();

    if (!streamData) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Generate Agora API token (different from RTC token)
    // For REST API calls, we need a different token generation
    // Using the project-level token generation
    
    // For now, we'll use the recording API which doesn't require additional token
    // The cloud recording feature creates HLS files that can be served via CDN
    
    const authString = btoa(`${agoraCustomerId}:${agoraCustomerSecret}`);
    
    // First, check if there's already a recording started
    const checkResponse = await fetch(
      `https://api.agora.io/v1/projects/${agoraAppId}/cloud-recording/resourceid`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Start cloud recording to generate HLS
    // This is the primary way to get HLS from Agora
    const recordingResponse = await fetch(
      `https://api.agora.io/v1/projects/${agoraAppId}/recordings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: "recorder",
          cname: channel_name,
          clientRequest: {
            recordingConfig: {
              maxIdleTime: 30,
              streamTypes: 2, // both audio and video
              audioProfile: 1,
              videoStreamType: 0,
              transcodingConfig: {
                width: 1280,
                height: 720,
                fps: 30,
                bitrate: 1500
              }
            },
            storageConfig: {
              vendor: 1, // AWS
              region: 0, // us-east-1
              bucket: Deno.env.get('AGORA_RECORDING_BUCKET') || 'your-bucket',
              accessKey: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
              secretKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
              fileNamePrefix: ["recordings", stream_id]
            }
          }
        })
      }
    );

    const recordingResult = await recordingResponse.json();
    
    console.log('[Agora CDN] Recording response:', JSON.stringify(recordingResult));

    if (recordingResult.code || recordingResult.error) {
      console.error('[Agora CDN] Recording error:', recordingResult);
      return new Response(JSON.stringify({ 
        error: 'Failed to start recording',
        details: recordingResult 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Recording started successfully
    // The HLS files will be uploaded to the configured storage
    // We store the recording ID for later retrieval
    
    const recordingId = recordingResult.resourceId;
    
    // Update stream with CDN status
    await supabase
      .from('streams')
      .update({
        // Store recording ID for later use
        egress_id: recordingId,
        hls_started_at: new Date().toISOString()
      })
      .eq('id', stream_id);

    return new Response(JSON.stringify({ 
      success: true, 
      recording_id: recordingId,
      message: 'Agora CDN streaming enabled. HLS will be available once recording starts.'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Agora CDN Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
