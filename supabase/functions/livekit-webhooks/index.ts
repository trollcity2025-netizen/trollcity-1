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

            console.log('LiveKit Env Check:', {
                hasUrl: !!livekitUrl,
                hasKey: !!apiKey,
                hasSecret: !!apiSecret
            });

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

                // Add S3 config if available in env (Support generic S3 or Bunny specific)
                const s3Bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("BUNNY_STORAGE_ZONE");
                const s3Key = Deno.env.get("S3_ACCESS_KEY") || Deno.env.get("BUNNY_STORAGE_ZONE"); // Bunny uses Zone Name as Access Key
                const s3Secret = Deno.env.get("S3_SECRET_KEY") || Deno.env.get("BUNNY_STORAGE_PASSWORD") || Deno.env.get("BUNNY_STORAGE_KEY");
                const s3Endpoint = Deno.env.get("S3_ENDPOINT") || Deno.env.get("BUNNY_STORAGE_ENDPOINT") || "https://storage.bunnycdn.com";
                const s3Region = Deno.env.get("S3_REGION") || "us-east-1"; // Bunny ignores region but some clients need it

                console.log('S3/Bunny Env Check:', {
                    hasBucket: !!s3Bucket,
                    hasKey: !!s3Key,
                    hasSecret: !!s3Secret,
                    endpoint: s3Endpoint
                });

                if (s3Bucket && s3Key && s3Secret) {
                    segmentsOptions.s3 = {
                        accessKey: s3Key,
                        secret: s3Secret,
                        bucket: s3Bucket,
                        endpoint: s3Endpoint,
                        region: s3Region
                    };
                }

                console.log('PAYLOAD DEBUG:', {
                    event: event,
                    roomName: room.name,
                    computedHlsPath: `streams/${room.name}/master.m3u8`
                });

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

                // Construct full HLS URL
                const hlsBaseUrl = Deno.env.get("VITE_HLS_BASE_URL");
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                
                // Clean path storage
                const hlsPath = `/streams/${room.name}/master.m3u8`;
                let hlsUrl = '';

                if (hlsBaseUrl) {
                    hlsUrl = `${hlsBaseUrl}${hlsPath}`;
                } else if (supabaseUrl) {
                    hlsUrl = `${supabaseUrl}/storage/v1/object/public/hls${hlsPath}`;
                } else {
                    hlsUrl = hlsPath;
                }

                // Update ALL possible tables with the HLS URL and Path
                await Promise.all([
                    supabase.from('streams').update({ 
                        hls_url: hlsUrl,
                        hls_path: hlsPath,
                        room_name: room.name
                    }).eq('id', room.name),
                    supabase.from('pod_rooms').update({ hls_url: hlsUrl }).eq('id', room.name),
                    supabase.from('court_sessions').update({ hls_url: hlsUrl }).eq('id', room.name)
                ]);

                console.log('Updated hls_path and hls_url for all matching tables:', hlsPath);
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
               recording_url: recordingUrl
               // Do NOT mark as ended here. Let room_finished handle the status.
               // is_live: false, 
               // status: 'ended'
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
