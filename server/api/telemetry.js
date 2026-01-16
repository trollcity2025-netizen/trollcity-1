
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} else {
  console.warn('Missing Supabase Service Key for telemetry - writes will fail');
}

// 64KB limit
const MAX_PAYLOAD_SIZE = 64 * 1024;

// Simple in-memory rate limiter (per instance)
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

function hashUserId(userId) {
  return crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);
}

function sanitizeContent(text) {
  if (!text) return text;
  // Simple regex to mask potential credit card numbers
  let sanitized = String(text).replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
  return sanitized;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function logEvent(event) {
  if (!supabaseAdmin) {
    console.warn('Telemetry: Supabase admin not initialized');
    return { error: 'Config missing' };
  }

  const {
    event_type,
    message,
    stack,
    fingerprint,
    url,
    user_id,
    session_id,
    device,
    browser,
    os,
    severity,
    tags,
    breadcrumbs,
    request_info,
    extra,
    env,
    app_version,
    user_id_hash // Allow direct hash passing
  } = event;

  const sanitizedMessage = sanitizeContent(message);
  const sanitizedStack = sanitizeContent(stack);
  const userIdHash = user_id ? hashUserId(user_id) : user_id_hash;

  return await supabaseAdmin.from('telemetry_events').insert({
    event_type,
    message: sanitizedMessage,
    stack: sanitizedStack,
    fingerprint: fingerprint || 'unknown',
    url,
    user_id_hash: userIdHash,
    session_id,
    device,
    browser,
    os,
    severity: severity || 'info',
    tags: tags || {},
    breadcrumbs: breadcrumbs || [],
    request_info: request_info || {},
    extra: extra || {},
    env: env || process.env.NODE_ENV || 'development',
    app_version: app_version || '1.0.0'
  });
}

const handler = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(CORS_HEADERS);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.set(CORS_HEADERS);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Payload Size Check
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const body = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Missing body' });
    }

    // 2. Rate Limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const sessionId = body.session_id || 'unknown';
    
    if (!checkRateLimit(`ip:${ip}`) || !checkRateLimit(`sess:${sessionId}`)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // 3. Validation
    if (!body.event_type) {
      return res.status(400).json({ error: 'Missing event_type' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Telemetry service unavailable (config)' });
    }

    // 4. Insert via helper
    const { error } = await logEvent(body);

    if (error) {
      console.error('Telemetry insert error:', error);
      return res.status(500).json({ error: 'Failed to store event' });
    }

    res.set(CORS_HEADERS);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Telemetry handler error:', err);
    res.set(CORS_HEADERS);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = handler;
module.exports.logEvent = logEvent;
