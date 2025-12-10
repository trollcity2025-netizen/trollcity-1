// File: /api/livekit-token.ts  (Vercel serverless function)

import { AccessToken } from 'livekit-server-sdk'

export default async function handler(req: any, res: any) {
  const { room, identity } = req.query
  const metadata = req.body?.metadata || {}

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const livekitUrl = process.env.LIVEKIT_CLOUD_URL!

  const token = new AccessToken(apiKey, apiSecret, {
    identity: identity as string,
    ttl: 3600,
    metadata: JSON.stringify(metadata),
  })

  token.addGrant({
    room: room as string,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  res.status(200).json({
    token: await token.toJwt(),
    livekitUrl: livekitUrl,
    serverUrl: livekitUrl,
    url: livekitUrl,
  })
}