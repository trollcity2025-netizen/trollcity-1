import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

// Helper to print status
const log = (step, msg, status) => {
    const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} [${step}] ${msg}`);
};

async function main() {
    console.log("=== TrollCity Broadcast System Full Check ===");

    // 1. Environment Variables Check
    const requiredVars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'LIVEKIT_API_KEY',
        'LIVEKIT_API_SECRET',
        'VITE_LIVEKIT_URL', // or LIVEKIT_URL
        'BUNNY_STORAGE_ZONE',
        'BUNNY_STORAGE_API_KEY',
        'BUNNY_STORAGE_PASSWORD' // or BUNNY_STORAGE_KEY
    ];

    let missingVars = [];
    for (const v of requiredVars) {
        if (!process.env[v] && !process.env[v.replace('VITE_', '')]) {
            // Check for alternate names
            if (v === 'VITE_LIVEKIT_URL' && process.env.LIVEKIT_URL) continue;
            if (v === 'VITE_SUPABASE_URL' && process.env.SUPABASE_URL) continue;
            if (v === 'BUNNY_STORAGE_PASSWORD' && process.env.BUNNY_STORAGE_KEY) continue;
            missingVars.push(v);
        }
    }

    if (missingVars.length > 0) {
        log('Env', `Missing variables: ${missingVars.join(', ')}`, 'warn');
    } else {
        log('Env', 'All required environment variables present', 'ok');
    }

    // 2. Supabase Connection
    const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbKey) {
        log('Supabase', 'Cannot initialize Supabase client (missing URL/Key)', 'error');
    } else {
        const sb = createClient(sbUrl, sbKey);
        const { data, error } = await sb.from('streams').select('count').limit(1);
        if (error) {
            log('Supabase', `Connection failed: ${error.message}`, 'error');
        } else {
            log('Supabase', 'Connection successful (read access verified)', 'ok');
        }
    }

    // 3. LiveKit Connection & Token Generation
    const lkUrl = process.env.VITE_LIVEKIT_URL || process.env.LIVEKIT_URL;
    const lkKey = process.env.LIVEKIT_API_KEY;
    const lkSecret = process.env.LIVEKIT_API_SECRET;

    if (!lkUrl || !lkKey || !lkSecret) {
        log('LiveKit', 'Missing LiveKit credentials', 'error');
    } else {
        try {
            // Test Token Generation
            const at = new AccessToken(lkKey, lkSecret, {
                identity: "test-broadcaster",
                name: "Test Broadcaster"
            });
            at.addGrant({ roomJoin: true, roomName: "test-room", canPublish: true, canSubscribe: true });
            const token = await at.toJwt();
            log('LiveKit', 'Token generation successful', 'ok');

            // Test API Connection
            let apiHost = lkUrl;
            
            const svc = new RoomServiceClient(apiHost, lkKey, lkSecret);
            const rooms = await svc.listRooms();
            log('LiveKit', `API Connection successful. Active rooms: ${rooms.length}`, 'ok');
            
        } catch (e) {
            log('LiveKit', `Check failed: ${e.message}`, 'error');
        }
    }

    // 4. HLS / Bunny Configuration
    const hlsBase = process.env.VITE_HLS_BASE_URL;
    const bunnyZone = process.env.BUNNY_STORAGE_ZONE;
    
    if (hlsBase) {
        log('HLS', `Base URL configured: ${hlsBase}`, 'ok');
    } else if (bunnyZone) {
        log('HLS', `Using fallback Bunny URL: https://${bunnyZone}.b-cdn.net`, 'warn');
    } else {
        log('HLS', 'No HLS Base URL or Bunny Zone configured', 'error');
    }

    // Verify HLS URL Logic
    const testStreamId = "test-stream-id";
    const expectedUrl = hlsBase 
        ? `${hlsBase.replace(/\/$/, '')}/streams/${testStreamId}/master.m3u8`
        : `https://${bunnyZone}.b-cdn.net/streams/${testStreamId}/master.m3u8`;
    
    log('HLS', `Expected HLS URL for stream '${testStreamId}': ${expectedUrl}`, 'ok');

    console.log("=== Check Complete ===");
}

main().catch(console.error);
