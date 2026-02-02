
import { supabaseAdmin } from './_shared/auth'
import crypto from 'crypto'

// 64KB limit
const MAX_PAYLOAD_SIZE = 64 * 1024;

// Simple in-memory rate limiter (per instance)
// Map<key, { count: number, resetTime: number }>
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(key: string): boolean {
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

function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

function sanitizeContent(text: string | undefined): string | undefined {
  if (!text) return text;
  // Simple regex to mask potential credit card numbers (Luhn check not applied, just pattern)
  // Matches 13-19 digits, possibly separated by dashes or spaces
  const sanitized = text.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
  // Mask potential email addresses if not explicitly allowed (simple check)
  // sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  return sanitized;
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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
    const {
      event_type,
      message,
      stack,
      fingerprint,
      url,
      user_id, // Optional, will be hashed
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
      app_version
    } = body;

    if (!event_type) {
      return res.status(400).json({ error: 'Missing event_type' });
    }

    // 4. Sanitize & Prepare
    const sanitizedMessage = sanitizeContent(message);
    const sanitizedStack = sanitizeContent(stack);
    
    const userIdHash = user_id ? hashUserId(user_id) : body.user_id_hash;

    // 5. Insert - FAIL SAFE (Never return 500)
    const { error } = await supabaseAdmin.from('telemetry_events').insert({
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

    if (error) {
      console.error('Telemetry insert error (swallowed):', error);
      // Return 200 even on database error to avoid blocking client
      return res.status(200).json({ success: false, ok: false, error: 'Internal storage failed, but handled safely' });
    }

    return res.status(200).json({ success: true, ok: true });

  } catch (err: any) {
    console.error('Telemetry handler error (swallowed):', err);
    // Return 200 even on unhandled exception
    return res.status(200).json({ success: false, ok: false, error: 'Internal server error handled safely' });
  }

}
