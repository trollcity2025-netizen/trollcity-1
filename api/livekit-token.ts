import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Validate Auth Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    // 2. Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Client for Auth Validation (using user's JWT)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 3. Validate User
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error('User validation error:', userError?.message);
      return res.status(401).json({ error: 'No active session. Please sign in again.' });
    }

    // 4. Fetch Profile (Use Service Role if available for reliability, else fallback to user auth)
    const supabaseAdmin = supabaseServiceKey 
        ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
        : supabaseAuth;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, role, avatar_url, is_broadcaster, is_admin, is_lead_officer, is_troll_officer')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError?.message);
      return res.status(500).json({ error: 'Unable to load user profile' });
    }

    // 5. Parse Request Params
    const params = req.body || {};
    // Handle query params if GET request (fallback)
    if (req.method === 'GET') {
        Object.assign(params, req.query);
    }

    const roomName = params.room || params.roomName;
    const rawIdentity = params.identity;
    
    // Identity fallback
    const identity = (rawIdentity && rawIdentity !== 'null') ? rawIdentity : profile.id;

    if (!roomName) {
      return res.status(400).json({ error: 'Missing roomName' });
    }

    // 6. Determine Permissions
    const allowPublish = 
        params.allowPublish === true || 
        params.allowPublish === 'true' || 
        params.allowPublish === 1 ||
        // @ts-expect-error - canPublish is not in the type definition but used
        params.canPublish === true;

    const roleParam = String(params.role || '').toLowerCase();
    
    // Role-based overrides
    let canPublish = Boolean(allowPublish);
    if (roleParam === 'broadcaster' || roleParam === 'publisher' || roleParam === 'admin') {
        canPublish = true;
    }
    if (profile.is_broadcaster || profile.is_admin) {
        canPublish = true;
    }
    // Force allow if explicitly requested (and authenticated)
    if (allowPublish) canPublish = true;

    // 7. Mint LiveKit Token
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL;

    if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: 'LiveKit server misconfigured' });
    }

    const metadata = {
        user_id: profile.id,
        username: profile.username,
        role: profile.role,
        avatar_url: profile.avatar_url,
        level: Number(params.level ?? 1),
    };

    const at = new AccessToken(apiKey, apiSecret, {
        identity: String(identity),
        name: profile.username,
        ttl: 24 * 60 * 60, // 24 hours
        metadata: JSON.stringify(metadata),
    });

    at.addGrant({
        room: String(roomName),
        roomJoin: true,
        canSubscribe: true,
        canPublish: canPublish,
        canPublishData: canPublish,
        canUpdateOwnMetadata: true,
        // TrackSource.CAMERA, TrackSource.MICROPHONE
        canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] as unknown as TrackSource[] : [],
    });

    const token = await at.toJwt();

    // 8. Return Response
    return res.status(200).json({
        token,
        livekitUrl,
        url: livekitUrl,
        room: roomName,
        identity: String(identity),
        allowPublish: canPublish,
        publishAllowed: canPublish,
        roleParam,
    });

  } catch (error: any) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
