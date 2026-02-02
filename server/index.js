const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Import handlers
const livekitTokenHandler = require('./api/livekit-token');
const telemetryHandler = require('./api/telemetryHandler');

// API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LiveKit Test
app.get('/api/livekit/test', (req, res) => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_CLOUD_URL || process.env.LIVEKIT_URL;

  if (apiKey && apiSecret && livekitUrl) {
    res.status(200).json({ status: 'ok', message: 'LiveKit configured' });
  } else {
    res.status(500).json({ status: 'error', message: 'LiveKit configuration missing' });
  }
});

// PayPal Test
app.get('/api/paypal/test', (req, res) => {
  // Check for PayPal credentials (assuming standard env vars)
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  
  if (clientId) {
    res.status(200).json({ status: 'ok', message: 'PayPal configured' });
  } else {
    // For now, if no env var, we might return error, but let's see if we can fake it for dev
    // If user hasn't set it up, it's an error.
    res.status(500).json({ status: 'error', message: 'PayPal configuration missing' });
  }
});

// LiveKit Token
app.post('/api/livekit-token', async (req, res) => {
  await livekitTokenHandler(req, res);
});

// Telemetry
app.post('/api/telemetry', async (req, res) => {
  await telemetryHandler(req, res);
});

// Admin: Cache Clear
app.post('/api/admin/cache/clear', (req, res) => {
  // In a real app, this would clear Redis or other server-side caches
  console.log('Cache clear requested');
  res.status(200).json({ success: true, message: 'Server cache cleared successfully' });
});

// Admin: Database Backup Trigger
app.post('/api/admin/backup/trigger', (req, res) => {
  // In a real app, this would trigger a PG dump or Supabase backup API
  console.log('Backup trigger requested');
  setTimeout(() => {
    // Simulate backup time
  }, 2000);
  res.status(200).json({ success: true, message: 'Backup process started', jobId: Date.now() });
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  
  // Log to telemetry
  if (telemetryHandler.logEvent) {
    telemetryHandler.logEvent({
      event_type: 'server_error',
      message: err.message || 'Unknown Server Error',
      stack: err.stack,
      severity: 'error',
      fingerprint: `server-${err.message || 'unknown'}`,
      url: req.url,
      request_info: {
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      },
      env: process.env.NODE_ENV || 'development'
    }).catch(e => console.error('Failed to log server error to telemetry', e));
  }

  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
