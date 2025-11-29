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

    if (event === 'room.started') {
      // Mark stream as live
      const { error } = await supabase
        .from('troll_streams')
        .update({
          is_live: true,
          start_time: new Date().toISOString()
        })
        .eq('livekit_room', room.name);

      if (error) {
        console.error('Error updating stream to live:', error);
        return new Response(JSON.stringify({ error: 'Failed to update stream' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Stream marked as live:', room.name);
    } else if (event === 'room.ended') {
      // Mark stream as ended
      const { error } = await supabase
        .from('troll_streams')
        .update({
          is_live: false,
          end_time: new Date().toISOString()
        })
        .eq('livekit_room', room.name);

      if (error) {
        console.error('Error updating stream to ended:', error);
        return new Response(JSON.stringify({ error: 'Failed to update stream' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Stream marked as ended:', room.name);
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
