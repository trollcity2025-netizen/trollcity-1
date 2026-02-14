import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EgressClient, RoomServiceClient } from "npm:livekit-server-sdk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const { roomName } = await req.json()

    if (!roomName) {
      throw new Error('Missing roomName')
    }

    // 1. Setup Clients
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!
    
    // Ensure URL is HTTP/HTTPS for API
    const apiUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

    const roomService = new RoomServiceClient(apiUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const egressClient = new EgressClient(apiUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // 2. Get Stream Key from DB
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: streamData, error: streamError } = await supabaseClient
      .from('streams')
      .select('mux_stream_key, user_id')
      .eq('id', roomName) // Assuming roomName is streamId
      .single()

    if (streamError || !streamData || !streamData.mux_stream_key) {
      console.error('Stream key missing for room:', roomName)
      throw new Error('Stream key not found or Mux not initialized for this stream')
    }

    const rtmpUrl = `rtmp://live.mux.com/app/${streamData.mux_stream_key}`

    // 3. Find Broadcaster Tracks
    const participants = await roomService.listParticipants(roomName);
    
    // Broadcaster is usually the one with identity matching user_id (if roomName is streamId)
    // Or just find the first one publishing Camera
    const broadcaster = participants.find(p => p.identity === streamData.user_id) || 
                        participants.find(p => p.tracks.some(t => t.source === 0)); // 0 = Camera in proto

    if (!broadcaster) {
      throw new Error('Broadcaster not found in room')
    }

    const videoTrack = broadcaster.tracks.find(t => t.source === 0); // Camera
    const audioTrack = broadcaster.tracks.find(t => t.source === 2); // Microphone

    if (!videoTrack) {
        throw new Error('Broadcaster is not publishing video')
    }

    // 4. Start Egress (Track Composite or Room Composite)
    // Use TrackComposite to mix specific audio/video tracks.
    // If audio is missing, we can still proceed with video only? Or fail? 
    // Mux needs audio usually, but silence is okay.
    
    const audioTrackId = audioTrack?.sid;
    const videoTrackId = videoTrack.sid;

    console.log(`Starting Egress for room ${roomName} to ${rtmpUrl}`);
    console.log(`Tracks: Video=${videoTrackId}, Audio=${audioTrackId}`);

    const info = await egressClient.startTrackCompositeEgress(
        roomName,
        {
            stream: {
                urls: [rtmpUrl]
            },
            audioTrackId: audioTrackId, // Optional, but highly recommended
            videoTrackId: videoTrackId,
        }
    );

    return new Response(JSON.stringify(info), {
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