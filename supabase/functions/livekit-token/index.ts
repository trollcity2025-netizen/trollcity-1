import { AccessToken, TrackSource } from 'npm:livekit-server-sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export default async function handler(req: Request) {
  // ✅ CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: corsHeaders }
    )
  }

  const params =
    req.method === 'POST'
      ? await req.json()
      : Object.fromEntries(new URL(req.url).searchParams)

  const room = params.room
  const identity = params.identity
  const user_id = params.user_id
  const role = params.role
  const level = params.level

  if (!room || !identity) {
    return new Response(
      JSON.stringify({ error: 'Missing room or identity' }),
      { status: 400, headers: corsHeaders }
    )
  }

  const apiKey = Deno.env.get('LIVEKIT_API_KEY')
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
  const livekitUrl = Deno.env.get('LIVEKIT_CLOUD_URL')

  if (!apiKey || !apiSecret || !livekitUrl) {
    return new Response(
      JSON.stringify({ error: 'LiveKit not configured' }),
      { status: 500, headers: corsHeaders }
    )
  }

  const isBroadcaster = req.method === 'POST'
  const resolvedRole = isBroadcaster ? role ?? 'creator' : 'viewer'

  const metadata = {
    user_id: user_id ?? null,
    role: resolvedRole,
    level: Number(level ?? 1),
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(identity),
    ttl: 60 * 60 * 6,
    metadata: JSON.stringify(metadata),
  })

  token.addGrant({
    room: String(room),
    roomJoin: true,
    canSubscribe: true,
    canPublish: isBroadcaster,
    canPublishData: isBroadcaster,
    canUpdateOwnMetadata: true,
    canPublishSources: isBroadcaster
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
      : [],
  })

  return new Response(
    JSON.stringify({
      token: await token.toJwt(),
      url: livekitUrl,
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}
