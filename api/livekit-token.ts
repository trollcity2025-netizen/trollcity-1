import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

type TokenRequest = {
  room?: string;
  roomName?: string;
  identity?: string;
  name?: string;
  role?: string;
  allowPublish?: boolean | string | number;
  level?: number | string;
  user_id?: string;
};

function parseAllowPublish(v: any): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[livekit-token] 🔄 New request: ${req.method} ${req.url}`);
  
  if (req.method !== "POST") {
    console.log(`[livekit-token] ❌ Method not allowed: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract and validate authorization header
    const auth = req.headers.authorization || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!jwt) {
      console.log('[livekit-token] ❌ Missing Authorization header');
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    
    console.log('[livekit-token] ✅ Authorization header found');

    // Parse request body
    const payload: TokenRequest = req.body || {};
    const roomName = String(payload.room || payload.roomName || "").trim();
    let identity = payload.identity;
    const name = String(payload.name || payload.identity || "Anonymous");

    console.log('[livekit-token] 📝 Request payload:', {
      roomName,
      identity,
      name,
      allowPublish: payload.allowPublish,
      role: payload.role,
      level: payload.level,
      hasAuth: !!jwt
    });

    if (!roomName) {
      console.log('[livekit-token] ❌ Missing roomName');
      return res.status(400).json({ error: "Missing roomName" });
    }
    
    console.log('[livekit-token] ✅ Room name validated:', roomName);

    // Validate LiveKit environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    console.log('[livekit-token] 🔧 Environment check:', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasLivekitUrl: !!livekitUrl,
      livekitUrl
    });

    if (!apiKey || !apiSecret) {
      console.error('[livekit-token] ❌ Missing LiveKit environment variables');
      return res.status(500).json({ error: "LiveKit env vars missing" });
    }
    
    console.log('[livekit-token] ✅ LiveKit environment variables validated');

    // Validate Supabase environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[livekit-token] ❌ Missing Supabase environment variables');
      return res.status(500).json({ error: "Supabase env vars missing" });
    }
    
    console.log('[livekit-token] ✅ Supabase environment variables validated');

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !userData?.user) {
      console.error("[livekit-token] User validation error:", userError?.message);
      return res.status(401).json({ error: "Invalid Supabase session" });
    }

    // Use user ID as identity if not provided, or validate identity matches user
    if (!identity || identity === "null") {
      identity = userData.user.id;
    }

    // Optional: Enforce identity matches logged in user for security
    // if (identity !== userData.user.id) {
    //   return res.status(403).json({ error: "Identity mismatch" });
    // }

    // Determine publish permissions
    const explicitAllow = parseAllowPublish(payload.allowPublish);
    const roleParam = String(payload.role || "").toLowerCase();
    const canPublish =
      explicitAllow || roleParam === "broadcaster" || roleParam === "admin";

    // Create LiveKit token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: String(name),
      ttl: 60 * 60, // 1 hour
      metadata: JSON.stringify({
        identity,
        role: roleParam || "viewer",
        level: Number(payload.level || 1),
        user_id: userData.user.id,
      }),
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: canPublish,
      canPublishData: canPublish,
    });

    // ✅ CRITICAL FIX: Ensure toJwt() returns a string, not an object
    // Handle both sync and async toJwt() methods
    let jwtString: string;
    try {
      const jwtResult = token.toJwt();
      
      // If it's a Promise, await it
      const jwt = jwtResult instanceof Promise ? await jwtResult : jwtResult;
      
      // ✅ STRICT VALIDATION: Ensure jwt is a string
      if (typeof jwt !== 'string') {
        console.error('[livekit-token] toJwt() returned non-string:', {
          type: typeof jwt,
          value: jwt,
          stringified: JSON.stringify(jwt)
        });
        throw new Error(`toJwt() returned ${typeof jwt} instead of string`);
      }
      
      // ✅ Validate JWT format (should start with 'eyJ')
      if (!jwt.startsWith('eyJ')) {
        console.error('[livekit-token] JWT does not have expected format:', {
          jwtPreview: jwt.substring(0, 50),
          jwtLength: jwt.length
        });
        throw new Error('Invalid JWT format');
      }
      
      jwtString = jwt;
    } catch (jwtError: any) {
      console.error('[livekit-token] Failed to generate JWT:', jwtError);
      throw new Error(`JWT generation failed: ${jwtError?.message || jwtError}`);
    }

    // ✅ Return string, NOT object
    return res.status(200).json({
      token: jwtString, // ✅ String JWT, not AccessToken object
      livekitUrl: livekitUrl || null,
      room: roomName,
      identity: String(identity),
      allowPublish: canPublish,
    });
  } catch (e: any) {
    console.error("❌ livekit-token error:", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
