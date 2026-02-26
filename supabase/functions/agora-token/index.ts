uconst corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert string to buffer
function strToBuffer(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// HMAC-SHA256 implementation for Deno
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

// Generate random salt
function generateSalt(): Uint8Array {
  const salt = new Uint8Array(4);
  crypto.getRandomValues(salt);
  return salt;
}

// Calculate CRC32
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate Agora RTC token with proper binary format
async function generateRtcToken(
  appId: string,
  appCertificate: string, 
  channelName: string,
  uid: number,
  role: number, // 1 = publisher, 2 = subscriber
  expireTime: number
): Promise<string> {
  const version = '001';
  const issueTime = Math.floor(Date.now() / 1000);
  const expire = expireTime;
  const salt = generateSalt();
  
  // Build the signature content (in the correct order per Agora spec)
  // The signature is HMAC-SHA256 over: appId + issueTime + salt + channelName + uid + expireTime + role
  const signatureContent = new Uint8Array([
    ...strToBuffer(appId),
    ...intToBytes(issueTime),
    ...salt,
    ...strToBuffer(channelName),
    ...intToBytes(uid),
    ...intToBytes(expire),
    ...intToBytes(role)
  ]);
  
  // Create signature using HMAC-SHA256
  const keyBuffer = strToBuffer(appCertificate);
  const signature = await hmacSha256(keyBuffer, signatureContent);
  
  // Build the final token buffer
  // Format: version(3) + appId(32) + issueTime(4) + salt(4) + signature(32) + expire(4) + crc(4)
  const tokenBuffer = new Uint8Array(3 + 32 + 4 + 4 + 32 + 4 + 4);
  
  // Version (3 bytes, string)
  const versionBytes = strToBuffer(version);
  tokenBuffer.set(versionBytes, 0);
  
  // App ID (32 bytes, string)
  const appIdBytes = strToBuffer(appId.padEnd(32, '\0'));
  tokenBuffer.set(appIdBytes, 3);
  
  // Issue Time (4 bytes, little-endian)
  tokenBuffer.set(intToBytesLE(issueTime), 35);
  
  // Salt (4 bytes)
  tokenBuffer.set(salt, 39);
  
  // Signature (32 bytes)
  tokenBuffer.set(signature, 43);
  
  // Expire Time (4 bytes, little-endian)
  tokenBuffer.set(intToBytesLE(expire), 75);
  
  // CRC (4 bytes)
  const crc = crc32(tokenBuffer.slice(0, 79));
  tokenBuffer.set(intToBytesLE(crc), 79);
  
  // Convert to base64
  const base64Token = uint8ArrayToBase64(tokenBuffer);
  
  return base64Token;
}

// Helper: int to bytes (big-endian)
function intToBytes(num: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (num >> 24) & 0xFF;
  buf[1] = (num >> 16) & 0xFF;
  buf[2] = (num >> 8) & 0xFF;
  buf[3] = num & 0xFF;
  return buf;
}

// Helper: int to bytes (little-endian)
function intToBytesLE(num: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = num & 0xFF;
  buf[1] = (num >> 8) & 0xFF;
  buf[2] = (num >> 16) & 0xFF;
  buf[3] = (num >> 24) & 0xFF;
  return buf;
}

// Helper: uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    if (!appId) {
      return new Response(
        JSON.stringify({ error: 'AGORA_APP_ID not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!appCertificate) {
      return new Response(
        JSON.stringify({ error: 'AGORA_APP_CERTIFICATE not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Calculate expire time (1 hour from now)
    const expireTime = Math.floor(Date.now() / 1000) + 3600
    
    // Role: 1 = publisher, 2 = subscriber
    const tokenRole = isPublisher ? 1 : 2
    
    // Generate valid Agora token
    const token = await generateRtcToken(
      appId, 
      appCertificate, 
      channel, 
      uid, 
      tokenRole, 
      expireTime
    )

    return new Response(
      JSON.stringify({ 
        token,
        appId,
        uid,
        channel: channel,
        expireTime,
        role: isPublisher ? 'publisher' : 'subscriber'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Token generation error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
