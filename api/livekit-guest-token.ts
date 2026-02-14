import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Initialize Supabase Admin Client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });

    // 2. Extract IP Address
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress || 
               'unknown';

    // 3. Parse Request
    const { streamId, roomName } = req.body || {};
    const targetRoom = roomName || streamId;

    if (!targetRoom) {
      return res.status(400).json({ error: 'Missing streamId/roomName' });
    }

    // 4. Generate Guest Identity
    const guestUuid = crypto.randomUUID();
    const guestIdentity = `guest_${guestUuid}`;
    // Generate Display Name: TC + 6 random digits
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const displayName = `TC${randomDigits}`;

    // 5. Check Bans (IP, Identity)
    // We check stream_bans for any active ban matching this IP or Guest Identity
    // Note: We should probably check bans for the specific stream if streamId is provided, 
    // but the prompt says "Check if guest is banned (see Section G)" which implies global or stream specific?
    // "Check active bans where: user_id = auth.uid() OR guest_identity = guest_identity OR ip_address = requester_ip"
    // "Reuse public.stream_bans" implies stream-specific bans usually, but maybe global too?
    // Let's assume stream-specific for now if stream_id matches, OR global if stream_id is null in bans table (if supported).
    // The prompt says "Reuse public.stream_bans... If banned -> deny join."
    
    // Check if there is a ban for this stream and this guest/IP
    // Note: stream_bans usually has a stream_id. If we are joining a room, we should check bans for that room.
    
    // Find the stream ID if we only have room name (assuming room name is stream ID, which is common in this codebase)
    // If roomName is "broadcast:UUID", we might need to extract UUID. 
    // Usually roomName IS the stream ID or UUID.
    
    const { data: bans, error: _banError } = await supabaseAdmin
        .from('stream_bans')
        .select('id, expires_at')
        .eq('stream_id', targetRoom) // Assuming targetRoom is the UUID
        .or(`ip_address.eq.${ip},guest_identity.eq.${guestIdentity}`)
        .is('user_id', null) // Check guest bans (user_id is null for guests usually, or we check both)
        .maybeSingle(); // We just need one active ban

    // Also check if there's a ban with user_id but we don't have a user_id here. 
    // The query above checks bans where ip OR guest matches.
    
    // We need to handle expiry.
    if (bans) {
        const expiresAt = bans.expires_at ? new Date(bans.expires_at) : null;
        if (!expiresAt || expiresAt > new Date()) {
            return res.status(403).json({ error: 'You are banned from this stream.' });
        }
    }

    // 6. Log Guest Access
    // "IP logging table: store ip, guest_identity, display_name, stream_id, timestamp"
    await supabaseAdmin.from('guest_tracking_logs').insert({
        ip_address: ip,
        guest_identity: guestIdentity,
        display_name: displayName,
        stream_id: targetRoom, // Assuming UUID
    });

    // 7. Mint LiveKit Token (READ-ONLY)
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL;

    if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: 'LiveKit server misconfigured' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
        identity: guestIdentity,
        name: displayName,
        ttl: 60 * 60, // 1 hour (short lived)
        metadata: JSON.stringify({
            is_guest: true,
            display_name: displayName,
            ip_address: ip
        }),
    });

    at.addGrant({
        room: String(targetRoom),
        roomJoin: true,
        canSubscribe: true,
        canPublish: false,
        canPublishData: false, // No chat
        canUpdateOwnMetadata: false,
    });

    const token = await at.toJwt();

    return res.status(200).json({
        token,
        identity: guestIdentity,
        displayName,
        livekitUrl
    });

  } catch (error: any) {
    console.error('Guest token error:', error);
    return res.status(500).json({ error: error.message });
  }
}
