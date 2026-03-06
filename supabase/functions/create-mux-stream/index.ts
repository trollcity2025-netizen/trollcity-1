// Edge function to create Mux live streams for pods and broadcasts
// Automatically creates a Mux live stream and returns the playback ID

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
    const { type, room_id, room_name, title } = body || {};

    if (!type || !room_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, room_id' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get Mux credentials from environment
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET');
    
    // Standard Mux RTMP URL format
    const rtmpUrl = "rtmp://global-live.mux.com:5222/app";

    if (!muxTokenId || !muxTokenSecret) {
      // If no Mux credentials, return a placeholder that can be updated later
      const playbackId = `placeholder_${Date.now()}`;
      const streamKey = `placeholder_key_${Date.now()}`;
      
      // Update the room with placeholder - can be updated manually or later
      if (type === 'pod') {
        await supabase
          .from('pod_rooms')
          .update({ 
            mux_playback_id: playbackId,
            mux_stream_key: streamKey,
            mux_rtmp_url: rtmpUrl
          })
          .eq('id', room_id);
      } else if (type === 'broadcast') {
        await supabase
          .from('streams')
          .update({ 
            mux_playback_id: playbackId,
            mux_stream_key: streamKey,
            mux_rtmp_url: rtmpUrl
          })
          .eq('id', room_id);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        playback_id: playbackId,
        stream_key: streamKey,
        rtmp_url: rtmpUrl,
        message: 'Mux credentials not configured. Using placeholder.'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create Mux live stream
    const muxResponse = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${muxTokenId}:${muxTokenSecret}`)}`
      },
      body: JSON.stringify({
        playback_policy: ['public'],
        new_asset_settings: {
          playback_policy: ['public']
        },
        metadata: {
          type,
          room_id,
          room_name: room_name || title || 'Untitled'
        }
      })
    });

    if (!muxResponse.ok) {
      const error = await muxResponse.text();
      console.error('Mux API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create Mux stream', details: error }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const muxData = await muxResponse.json();
    const stream = muxData.data;
    const playbackId = stream.playback_ids?.[0]?.id;
    const ingestUrl = stream.ingest_url;
    const streamKey = stream.stream_key;
    const muxStreamId = stream.id; // Store this for webhook correlation

    if (!playbackId) {
      return new Response(JSON.stringify({ error: 'No playback ID returned from Mux' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update the room with all Mux details
    if (type === 'pod') {
      await supabase
        .from('pod_rooms')
        .update({ 
          mux_playback_id: playbackId,
          mux_stream_key: streamKey,
          mux_rtmp_url: rtmpUrl,
          mux_stream_id: muxStreamId
        })
        .eq('id', room_id);
    } else if (type === 'broadcast') {
      await supabase
        .from('streams')
        .update({ 
          mux_playback_id: playbackId,
          mux_stream_key: streamKey,
          mux_rtmp_url: rtmpUrl,
          mux_stream_id: muxStreamId
        })
        .eq('id', room_id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      playback_id: playbackId,
      stream_key: streamKey,
      rtmp_url: rtmpUrl,
      ingest_url: ingestUrl,
      mux_stream_id: muxStreamId
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
