
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
// We use SERVICE_ROLE_KEY to bypass RLS and ensure we can always write telemetry
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Telemetry: Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null;

function hashUserId(userId) {
  if (!userId) return null;
  return crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);
}

function sanitizeContent(text) {
  if (!text) return text;
  // Simple regex to mask potential credit card numbers
  return String(text).replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
}

async function logEvent(event) {
  if (!supabase) {
    console.warn('Telemetry: Supabase client not initialized');
    return { error: { message: 'Supabase client not initialized' } };
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
    user_id_hash
  } = event;

  const sanitizedMessage = sanitizeContent(message);
  const sanitizedStack = sanitizeContent(stack);
  const finalUserIdHash = user_id ? hashUserId(user_id) : user_id_hash;

  return await supabase.from('telemetry_events').insert({
    event_type,
    message: sanitizedMessage,
    stack: sanitizedStack,
    fingerprint: fingerprint || 'unknown',
    url,
    user_id_hash: finalUserIdHash,
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

module.exports = async function telemetryHandler(req, res) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.set(corsHeaders);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    
    // Add IP to request_info if not present
    if (!body.request_info) body.request_info = {};
    body.request_info.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const { error } = await logEvent(body);

    if (error) {
      console.error('Telemetry insert error:', error);
      res.set(corsHeaders);
      return res.status(500).json({ error: error.message || 'Failed to store event' });
    }

    res.set(corsHeaders);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Telemetry handler error:', err);
    res.set(corsHeaders);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
};

module.exports.logEvent = logEvent;
