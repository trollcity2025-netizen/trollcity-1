import { serve } from "https://deno.land/std@0.214.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.maitrollcity.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Manual JWT generation for Deno compatibility
async function generateLiveKitToken(identity: string, room: string, role: string) {
  const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!
  const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!
  const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!

  const header = { alg: "HS256", typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)

  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: identity,
    aud: LIVEKIT_URL,
    exp: now + 60 * 60 * 6, // 6 hours
    nbf: now - 10,
    video: {
      room,
      roomJoin: true,
      canPublish: role !== "viewer",
      canSubscribe: true,
      canPublishData: role !== "viewer",
      canUpdateOwnMetadata: true,
    },
  }

  function base64url(source: string) {
    return btoa(source).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }

  const encoder = new TextEncoder()
  const headerEncoded = base64url(JSON.stringify(header))
  const payloadEncoded = base64url(JSON.stringify(payload))
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LIVEKIT_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsignedToken))
  const signatureEncoded = base64url(String.fromCharCode(...new Uint8Array(signature)))

  return `${unsignedToken}.${signatureEncoded}`
}

serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { room, identity, role } = await request.json()

    if (!room || !identity) {
      return new Response(
        JSON.stringify({ success: false, error: "Identity is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const token = await generateLiveKitToken(identity, room, role || "viewer")

    return new Response(
      JSON.stringify({ success: true, token }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate token",
        details: String(err),
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
