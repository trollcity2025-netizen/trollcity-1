import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference types="https://deno.land/x/types/index.d.ts" />
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "../_shared/cors.ts";
import { EgressClient } from "livekit-server-sdk";

declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void; env: { get: (key: string) => string | undefined } };

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { event, room } = body;

    console.log('LiveKit webhook received:', { event, room });

    if (event === 'room_started') {
      // Mark stream as live
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'live', // Changed from is_live to status='live' to match GoLive/StreamMonitor
          is_live: true,
          start_time: new Date().toISOString()
        })
        .eq('id', room.name); // room.name is the stream ID

      if (error) {
        console.error('Error updating stream to live:', error);
      } else {
        console.log('Stream marked as live:', room.name);
      }

      // Also try to update pod_rooms and court_sessions (since room.name might be a pod or court session ID)
      // We do this blindly because IDs are UUIDs and collision is unlikely.
      // 1. Pod Rooms
      const { error: podError } = await supabase
        .from('pod_rooms')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          ended_at: null
        })
        .eq('id', room.name);
      
      if (!podError) console.log('Updated pod_room start status for:', room.name);

      // 2. Court Sessions
      const { error: courtError } = await supabase
        .from('court_sessions')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          ended_at: null
        })
        .eq('id', room.name);

      if (!courtError) console.log('Updated court_session start status for:', room.name);

        // TRIGGER HLS EGRESS
        try {
            const livekitUrl = Deno.env.get("VITE_LIVEKIT_URL") || Deno.env.get("LIVEKIT_URL");
            const apiKey = Deno.env.get("LIVEKIT_API_KEY");
            const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

            if (livekitUrl && apiKey && apiSecret) {
                // Convert WSS to HTTPS for API
                const httpUrl = livekitUrl.replace('wss://', 'https://');
                const egressClient = new EgressClient(httpUrl, apiKey, apiSecret);

                console.log('Starting HLS Egress for room:', room.name);

                // Configure HLS Output
                // This assumes an S3/compatible bucket is configured in LiveKit Cloud or passed here.
                // We use a predictable path structure: streams/<stream_id>/master.m3u8
                // This applies to ALL room types (streams, pods, court) so they all share the same CDN path structure.
                const segmentsOptions = {
                    protocol: 1, // S3 = 1 (ProtocolType.S3)
                    filenamePrefix: `streams/${room.name}/`,
                    playlistName: 'master.m3u8',
                    segmentDuration: 4,
                } as any;

                // Add S3 config if available in env
                const s3Bucket = Deno.env.get("S3_BUCKET");
                const s3Key = Deno.env.get("S3_ACCESS_KEY");
                const s3Secret = Deno.env.get("S3_SECRET_KEY");
                const s3Endpoint = Deno.env.get("S3_ENDPOINT");
                const s3Region = Deno.env.get("S3_REGION");

                if (s3Bucket && s3Key && s3Secret) {
                    segmentsOptions.s3 = {
                        accessKey: s3Key,
                        secret: s3Secret,
                        bucket: s3Bucket,
                        endpoint: s3Endpoint,
                        region: s3Region
                    };
                }

                // Start Egress
                const egressInfo = await egressClient.startRoomCompositeEgress(
                    room.name,
                    {
                        segments: segmentsOptions,
                    },
                    {
                        layout: 'grid', // Standard grid layout
                        audioOnly: false,
                        videoOnly: false,
                    }
                );

                console.log('HLS Egress started:', egressInfo.egressId);

                // Optimistically update hls_url if we know the bucket URL
                // Format: https://cdn.maitrollcity.com/streams/<stream_id>/master.m3u8
                const publicUrlBase = Deno.env.get("S3_PUBLIC_URL") || 'https://cdn.maitrollcity.com';
                const hlsUrl = `${publicUrlBase}/streams/${room.name}/master.m3u8`;

                // Update ALL possible tables with the HLS URL
                await Promise.all([
                    supabase.from('streams').update({ hls_url: hlsUrl }).eq('id', room.name),
                    supabase.from('pod_rooms').update({ hls_url: hlsUrl }).eq('id', room.name),
                    supabase.from('court_sessions').update({ hls_url: hlsUrl }).eq('id', room.name)
                ]);

                console.log('Updated hls_url for all matching tables:', hlsUrl);
            } else {
                console.warn('Missing LiveKit credentials, skipping Egress trigger');
            }
        } catch (egressErr) {
            console.error('Failed to trigger Egress:', egressErr);
        }
    } else if (event === 'room_finished') {
      // Mark stream as ended
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', room.name);

      if (error) {
        console.error('Error updating stream to ended:', error);
      } else {
        console.log('Stream marked as ended:', room.name);
      }

      // Also update pod_rooms and court_sessions
      await Promise.all([
        supabase.from('pod_rooms').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', room.name),
        supabase.from('court_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', room.name)
      ]);
      
      console.log('Updated end status for potential pod/court sessions:', room.name);

    } else if (event === 'egress_ended') {
      // Handle recording finished
      const egress = body.egress;
      const file = egress?.file || egress?.file_results?.[0]; // Handle different egress versions
      const recordingUrl = file?.location || file?.filename;
      const roomName = egress?.room_name;

      console.log('Egress ended for room:', roomName, 'URL:', recordingUrl);

      if (roomName && recordingUrl) {
         const { error } = await supabase
            .from('streams')
            .update({
               recording_url: recordingUrl,
               is_live: false, // Ensure it's marked as ended
               status: 'ended'
            })
            .eq('id', roomName); // Assuming roomName maps to stream ID

         if (error) {
            console.error('Error updating recording_url:', error);
         } else {
            console.log('Recording URL updated for stream:', roomName);
         }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
