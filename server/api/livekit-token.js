const { AccessToken, TrackSource } = require('livekit-server-sdk');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function sendJson(res, status, body) {
  res.status(status).set(CORS_HEADERS).json(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    console.log("✅ /api/livekit-token HIT", {
      method: req.method,
      hasAuth: !!req.headers.authorization,
      origin: req.headers.origin,
    });

    const body = req.body || {};
    const room = body.room || body.roomName;
    let identity = body.identity;
    const name = body.name || body.username || null;
    const allowPublish = body.allowPublish === true || body.allowPublish === 'true' || body.allowPublish === '1';

    if (!room) return sendJson(res, 400, { error: 'Missing room' });
    if (!identity || identity === 'null') identity = String(body.user_id || 'guest');

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_CLOUD_URL || process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return sendJson(res, 500, { error: 'LiveKit not configured' });
    }

    // Basic metadata — keep lightweight
    const metadata = {
      name: name || null,
      user_id: body.user_id || null,
      role: body.role || null,
    };

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: name || undefined,
      ttl: 60 * 60,
      metadata: JSON.stringify(metadata),
    });

    token.addGrant({
      room: String(room),
      roomJoin: true,
      canSubscribe: true,
      canPublish: !!allowPublish,
      canPublishData: !!allowPublish,
      canUpdateOwnMetadata: true,
      canPublishSources: allowPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    });

    const jwt = await token.toJwt();

    console.log("✅ TOKEN ISSUED", {
      room,
      identity,
      allowPublish: allowPublish,
    });

    return sendJson(res, 200, { token: jwt, livekitUrl, room, identity: String(identity), allowPublish: !!allowPublish });
  } catch (err) {
    console.error('[livekit-token] error', err?.message || err);
    return sendJson(res, 500, { error: err?.message || 'Server error' });
  }
};
