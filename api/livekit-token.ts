import { AccessToken } from 'livekit-server-sdk';
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
    const authHeader = req.headers.authorization;
    const loadTestSecret = req.headers['x-load-test-secret'];
    const isLoadTest = loadTestSecret && loadTestSecret === process.env.LOAD_TEST_SECRET;

    const params = req.body || {};
    if (req.method === 'GET') {
        Object.assign(params, req.query);
    }
    const roomName = params.room || params.roomName;
    if (!roomName) {
      return res.status(400).json({ error: 'Missing roomName' });
    }

    let profile: any = null;

    if (isLoadTest) {
        profile = {
            id: params.identity || 'load-test-user',
            username: 'LoadTester',
            role: 'user',
            is_broadcaster: false,
        };
    } else {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('Missing Supabase credentials');
          return res.status(500).json({ error: 'Server configuration error' });
        }

        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });

        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

        if (userError || !user) {
          console.error('User validation error:', userError?.message);
          return res.status(401).json({ error: 'No active session. Please sign in again.' });
        }

        const supabaseAdmin = supabaseServiceKey 
            ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
            : supabaseAuth;

        const { data: fetchedProfile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, role, is_broadcaster')
          .eq('id', user.id)
          .single();

        if (profileError || !fetchedProfile) {
          console.error('Profile fetch error:', profileError?.message);
          return res.status(500).json({ error: 'Unable to load user profile' });
        }
        profile = fetchedProfile;
    }

    const identity = params.identity || profile.id;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL;

    console.log('LIVEKIT_API_KEY:', apiKey);
    console.log('LIVEKIT_API_SECRET:', apiSecret);
    console.log('LIVEKIT_WS_URL:', wsUrl);

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error('LiveKit credentials not configured on server');
      return res.status(500).json({ error: 'LiveKit not configured' });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: identity, name: profile.username });

    const attributes = params.attributes || {};
    const metadata = {
        role: profile.role,
        ...attributes
    };
    at.metadata = JSON.stringify(metadata);

    at.addGrant({ 
      room: roomName, 
      roomJoin: true, 
      canPublish: true, 
      canSubscribe: true,
      canPublishData: true,
      attributes: attributes, // Add attributes to grant if supported by SDK version, else metadata is fallback
    });

    if (profile.is_broadcaster) {
        at.addGrant({ roomAdmin: true });
    }

    const token = await at.toJwt();
    return res.status(200).json({ token, wsUrl });

  } catch (error) {
    console.error('Error in livekit-token handler:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
