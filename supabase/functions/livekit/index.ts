import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AccessToken } from "https://deno.land/x/livekit_server_sdk@1.0.3/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const { roomName, identity } = await req.json()

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: 3600,
    })
    at.addGrant({ roomJoin: true, room: roomName })

    const token = await at.toJwt()

    return new Response(JSON.stringify({ token, url: LIVEKIT_URL }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})
