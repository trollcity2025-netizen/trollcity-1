import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const { roomName } = await req.json()

    if (!roomName) {
      throw new Error('Missing roomName')
    }

    // 1. Get Stream Key from DB (or create via Mux if missing)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: streamData, error: streamError } = await supabaseClient
      .from('streams')
      .select('mux_stream_key, user_id')
      .eq('id', roomName) // Assuming roomName is streamId
      .single()

    if (streamError || !streamData) {
      console.warn('Stream record not found for room:', roomName)
    }

    let streamKey = streamData?.mux_stream_key || null;
    let muxStreamId = streamData?.mux_stream_id || null;

    // If no Mux stream exists, create one now (server-side)
    if (!streamKey) {
      const tokenId = Deno.env.get('MUX_TOKEN_ID');
      const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET');

      if (!tokenId || !tokenSecret) {
        console.error('Mux credentials missing in env');
        return new Response(JSON.stringify({ error: 'Mux not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const apiUrl = 'https://api.mux.com/video/v1/live-streams';
      const auth = btoa(`${tokenId}:${tokenSecret}`);

      const createBody = {
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        name: `stream-${roomName}`,
      };

      const muxResp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(createBody)
      });

      if (!muxResp.ok) {
        const errText = await muxResp.text().catch(() => 'unknown');
        console.error('Mux create error:', muxResp.status, errText);
        return new Response(JSON.stringify({ error: 'Mux API error', status: muxResp.status }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const muxData = await muxResp.json().catch(() => ({}));
      // Best-effort extraction of stream key
      streamKey = muxData?.data?.stream_key?.value || muxData?.data?.stream_key || null;
      muxStreamId = muxData?.data?.id || null;

      if (!streamKey) {
        console.error('Created mux stream but no stream key present', muxData);
        return new Response(JSON.stringify({ error: 'Mux stream created but no stream key available' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Persist to DB
      try {
        await supabaseClient.from('streams').update({ mux_stream_key: streamKey, mux_stream_id: muxStreamId }).eq('id', roomName);
      } catch (e) {
        console.warn('Failed to persist mux stream key to DB', e);
      }
    }

    const rtmpUrl = `rtmp://live.mux.com/app/${streamKey}`;

    // Start Agora RTMP Push
    const appId = Deno.env.get('AGORA_APP_ID') || '';
    const customerId = Deno.env.get('AGORA_CUSTOMER_ID') || '';
    const customerSecret = Deno.env.get('AGORA_CUSTOMER_SECRET') || '';

    if (appId && customerId && customerSecret) {
        try {
            const agoraApiUrl = `https://api.agora.io/v1/projects/${appId}/rtmp-converters`;
            const auth = btoa(`${customerId}:${customerSecret}`);

            const agoraResp = await fetch(agoraApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({
                    "name": roomName,
                    "transcodeOptions": {
                        "rtcChannel": roomName,
                        "rtmpUrls": [rtmpUrl],
                    }
                })
            });

            if (!agoraResp.ok) {
                const errText = await agoraResp.text().catch(() => 'unknown');
                console.error('Agora start relay error:', agoraResp.status, errText);
                // Do not block the response to the client, just log the error
            }
        } catch (e) {
            console.error('Agora start relay exception:', e);
        }
    }

    return new Response(JSON.stringify({ rtmpUrl, muxStreamId, streamKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error('Relay error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})