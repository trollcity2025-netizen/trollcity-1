import { handleCorsPreflight, withCors } from "../_shared/cors.ts"

import { RtcTokenBuilder, RtcRole } from 'npm:agora-access-token';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight()

  try {
    const body = await req.json()
    
    // Accept both formats: frontend sends { channel, uid, role } 
    // or legacy format { room, identity, role }
    const channel = body.channel || body.room
    const uid = body.uid || (body.identity ? parseInt(body.identity.replace(/-/g, '').slice(0, 8), 16) % 100000 : Math.floor(Math.random() * 100000))
    const role = body.role || 'publisher'
    const isPublisher = role === 'publisher' || role === 1

    const appId = Deno.env.get('AGORA_APP_ID')
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')

    if (!appId) return withCors({ error: 'AGORA_APP_ID not configured' }, 500)

    if (!appCertificate) return withCors({ error: 'AGORA_APP_CERTIFICATE not configured' }, 500)

    // Calculate expire time (1 hour from now)
    const expireTime = Math.floor(Date.now() / 1000) + 3600
    
    // Role: 1 = publisher, 2 = subscriber
    const tokenRole = isPublisher ? 1 : 2
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId.trim(),
      appCertificate.trim(),
      channel,
      uid,
      tokenRole,
      expireTime
    );

    return withCors({
      token,
      appId,
      uid,
      channel,
      expireTime,
      role: isPublisher ? 'publisher' : 'subscriber'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Token generation error:', message)
    return withCors({ error: message }, 500)
  }
})
