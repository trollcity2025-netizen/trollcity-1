// File: /api/livekit-token.ts  (Vercel serverless function)
// Universal LiveKit token endpoint for all streaming features

import { AccessToken } from 'livekit-server-sdk'

export default async function handler(req: any, res: any) {
  // Support both GET (query params) and POST (body) for flexibility
  const { room, identity, user_id, role, level } = req.method === 'POST' ? req.body : req.query

  // Build metadata from request
  const metadata = {
    user_id: user_id || req.body?.user_id || req.query?.user_id,
    role: role || req.body?.role || req.query?.role || 'viewer',
    level: level || req.body?.level || req.query?.level || 1,
    ...req.body?.metadata, // Allow additional metadata
  }

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const livekitUrl = process.env.LIVEKIT_CLOUD_URL!

  const token = new AccessToken(apiKey, apiSecret, {
    identity: identity as string,
    ttl: 120, // 2 minutes expiration
    metadata: JSON.stringify(metadata),
  })

  // Role-based permissions for court room
  let canPublish = true
  let canPublishData = true

  if (room === 'troll-court') {
    // Court room permissions - only specific roles can broadcast
    const courtPublishRoles = ["admin", "lead_troll_officer", "troll_officer", "defendant", "accuser", "witness"]
    canPublish = courtPublishRoles.includes(metadata.role)
    canPublishData = canPublish // Same permission for data
  }

  token.addGrant({
    room: room as string,
    roomJoin: true,
    canPublish: canPublish,
    canSubscribe: true,
    canPublishData: canPublishData,
  })

  res.status(200).json({
    token: await token.toJwt(),
    livekitUrl: livekitUrl,
    serverUrl: livekitUrl,
    url: livekitUrl,
  })
}