import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference types="https://deno.land/x/types/index.d.ts" />
import { createClient } from "@supabase/supabase-js"
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void; env: { get: (key: string) => string | undefined } };

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

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
    } else if (event === 'room_finished') {
      // Mark stream as ended
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString() // Changed from end_time to ended_at to match schema usage
        })
        .eq('id', room.name);

      if (error) {
        console.error('Error updating stream to ended:', error);
      } else {
        console.log('Stream marked as ended:', room.name);
      }
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
