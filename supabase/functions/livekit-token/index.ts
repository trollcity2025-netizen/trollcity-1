import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

/**
 * LiveKit Token Generator
 * Generates access tokens for LiveKit rooms
 */

function base64Decode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Encode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// HMAC-SHA256 implementation
async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

// Create JWT-like token for LiveKit
async function createLiveKitToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  isPublisher: boolean;
}): Promise<string> {
  const { apiKey, apiSecret, roomName, participantName, isPublisher } = params;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiry

  // Create the signing key
  const encoder = new TextEncoder();
  
  // Create the token payload (JWT-like format)
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: apiKey,
    sub: participantName,
    aud: roomName,
    exp: exp,
    nbf: now,
    iat: now,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: true,
    }
  };

  // Create JWT-like token
  const headerBase64 = base64Encode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64Encode(encoder.encode(JSON.stringify(payload)));
  
  // Sign the token - use the secret string directly
  const message = `${headerBase64}.${payloadBase64}`;
  const signature = await hmacSha256(apiSecret, message);
  const signatureBase64 = base64Encode(signature);

  return `${message}.${signatureBase64}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight();

  try {
    const body = await req.json();

    const roomName = body.room || body.channel;
    const participantName = body.identity || body.userId || body.user_name || 'participant';
    const isPublisher = body.role === 'publisher' || body.role === 'host' || body.isHost === true;

    // Guard: Check for missing room
    if (!roomName) {
      console.error('[livekit-token] Missing room name');
      return withCors({ error: 'Missing room name' }, 400);
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    // Guard: Check for missing environment variables
    if (!apiKey || !apiSecret) {
      console.error('[livekit-token] LiveKit credentials not configured');
      return withCors({ 
        error: 'LiveKit credentials not configured',
        hint: 'Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Supabase secrets'
      }, 500);
    }

    console.log('[livekit-token] Generating token for room:', roomName, 'participant:', participantName, 'isPublisher:', isPublisher);

    const token = await createLiveKitToken({
      apiKey,
      apiSecret,
      roomName,
      participantName,
      isPublisher
    });

    console.log('[livekit-token] Token generated successfully');

    return withCors({
      token,
      roomName,
      participantName,
      isPublisher
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[livekit-token] Error generating token:', message);
    return withCors({ error: message }, 500);
  }
});
