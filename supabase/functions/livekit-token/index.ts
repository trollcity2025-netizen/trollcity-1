// File: /supabase/functions/livekit-token/index.ts
// Universal LiveKit token endpoint for ALL Troll City live features
// Rule: POST = broadcaster (can publish), GET = viewer (cannot publish)

import { serve } from "https://deno.land/std@0.214.0/http/server.ts"
import { AccessToken, TrackSource } from "https://esm.sh/livekit-server-sdk@2.0.1"

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

type JsonRecord = Record<string, unknown>

function jsonResponse(body: JsonRecord, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
    },
  })
}

serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  /* ============================
     METHOD GUARD
  ============================ */
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405)
  }

  /* ============================
     PARAMS
  ============================ */
  let room: string | null = null
  let identity: string | null = null
  let user_id: string | null = null
  let levelRaw: string | null = null

  if (request.method === "POST") {
    // POST expects JSON body
    let body: any = null
    try {
      body = await request.json()
    } catch {
      return jsonResponse(
        { success: false, error: "Invalid JSON body" },
        400
      )
    }

    room = body?.room ?? null
    identity = body?.identity ?? null
    user_id = body?.user_id ?? null
    levelRaw = body?.level != null ? String(body.level) : null
  } else {
    // GET uses query params
    const sp = new URL(request.url).searchParams
    room = sp.get("room")
    identity = sp.get("identity")
    user_id = sp.get("user_id")
    levelRaw = sp.get("level")
  }

  /* ============================
     HARD GUARDS
  ============================ */
  if (!room || !identity) {
    return jsonResponse(
      { success: false, error: "Missing required parameters: room or identity" },
      400
    )
  }

  /* ============================
     POST-BASED AUTHORITY (AUTHORITATIVE)
     - Never trust client-provided role for authority
  ============================ */
  const isBroadcaster = request.method === "POST"
  const resolvedRole = isBroadcaster ? "broadcaster" : "viewer"

  /* ============================
     METADATA
  ============================ */
  const metadata = {
    user_id: user_id ?? null,
    role: resolvedRole,
    level: Number(levelRaw ?? 1),
  }

  /* ============================
     ENV VALIDATION
  ============================ */
  const apiKey = Deno.env.get("LIVEKIT_API_KEY")
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")
  const livekitUrl = Deno.env.get("LIVEKIT_CLOUD_URL")

  if (!apiKey || !apiSecret || !livekitUrl) {
    return jsonResponse(
      { success: false, error: "LiveKit not configured" },
      500
    )
  }

  /* ============================
     TOKEN
  ============================ */
  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(identity),
    ttl: 60 * 60 * 6,
    metadata: JSON.stringify(metadata),
  })

  const canPublish = isBroadcaster
  const canPublishData = isBroadcaster

  /* ============================
     DEBUG LOG
  ============================ */
  console.log("[LiveKit Token Issued]", {
    method: request.method,
    room,
    identity,
    role: resolvedRole,
    isBroadcaster,
    canPublish,
    sources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
  })

  /* ============================
     GRANTS
  ============================ */
  token.addGrant({
    room: String(room),
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    canPublishData,
    canUpdateOwnMetadata: true,
    canPublishSources: canPublish
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
      : [],
  })

  /* ============================
     RESPONSE
  ============================ */
  try {
    const jwt = await token.toJwt()
    return jsonResponse({
      success: true,
      token: jwt,
      livekitUrl,
      serverUrl: livekitUrl,
      url: livekitUrl,
      role: resolvedRole,
      isBroadcaster,
    })
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: "Failed to generate token",
        details: String(err),
      },
      500
    )
  }
})
