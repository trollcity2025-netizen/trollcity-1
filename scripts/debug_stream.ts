import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Load .env manually
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envFile = fs.readFileSync(envPath, 'utf8');
            const envVars: Record<string, string> = {};
            envFile.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value && !key.startsWith('#')) {
                    envVars[key.trim()] = value.trim();
                }
            });
            return envVars;
        }
    } catch { }
    return {};
}

const env = { ...process.env, ...loadEnv() };

const SUPABASE_URL = env.VITE_SUPABASE_URL;
// Prefer Service Role Key for Admin access, fallback to Anon
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const LIVEKIT_URL = env.VITE_LIVEKIT_URL || env.VITE_LIVEKIT_CLOUD_URL;
const LK_API_KEY = env.LIVEKIT_API_KEY;
const LK_API_SECRET = env.LIVEKIT_API_SECRET;
const HLS_BASE_URL = env.VITE_HLS_BASE_URL;

async function checkUrl(url: string): Promise<{ status: number, ok: boolean }> {
    return new Promise((resolve) => {
        if (url.startsWith('https')) {
            https.get(url, (res) => {
                resolve({ status: res.statusCode || 0, ok: res.statusCode === 200 });
            }).on('error', () => resolve({ status: 0, ok: false }));
        } else {
             resolve({ status: 0, ok: false });
        }
    });
}

async function run() {
    console.log("🔍 DIAGNOSTIC REPORT\n");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing Supabase credentials in .env");
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Find the stream in DB
    const { data: streams, error } = await supabase
        .from('streams')
        .select('*')
        .ilike('title', '%test%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("❌ Supabase Error:", error.message);
        return;
    }

    if (!streams || streams.length === 0) {
        console.error("❌ No streams found with title containing 'test'");
        return;
    }
    
    const stream = streams[0];
    console.log(`✅ Stream Found in DB`);
    console.log(`   Title: "${stream.title}"`);
    console.log(`   ID (Room Name): ${stream.id}`);
    console.log(`   Status: ${stream.status}`);
    console.log(`   Is Live: ${stream.is_live}`);
    console.log(`   HLS URL (DB): ${stream.hls_url || '(none)'}`);

    // 2. Check LiveKit Room
    if (!LIVEKIT_URL || !LK_API_KEY || !LK_API_SECRET) {
        console.error("❌ Missing LiveKit credentials in .env");
        return;
    }

    const svc = new RoomServiceClient(LIVEKIT_URL.replace('wss://', 'https://'), LK_API_KEY, LK_API_SECRET);
    let rooms: any[] = [];
    try {
        rooms = await svc.listRooms();
    } catch (e: any) {
        console.error("❌ Failed to list rooms:", e.message);
    }
    
    const room = rooms.find(r => r.name === stream.id);

    if (room) {
        console.log(`\n✅ LiveKit Room Active`);
        console.log(`   SID: ${room.sid}`);
        console.log(`   Participants: ${room.numParticipants}`);
    } else {
        console.log(`\n⚠️  LiveKit Room NOT FOUND`);
        console.log(`   (Stream is in DB but no active room on server)`);
    }

    // 3. Check Storage / HLS
    console.log(`\n📦 Checking Storage Access...`);
    
    // Construct URLs
    const directUrl = `${SUPABASE_URL}/storage/v1/object/public/hls/streams/${stream.id}/master.m3u8`;
    const cdnUrl = HLS_BASE_URL ? `${HLS_BASE_URL}/streams/${stream.id}/master.m3u8` : null;

    console.log(`   Target File: streams/${stream.id}/master.m3u8`);
    
    const directCheck = await checkUrl(directUrl);
    console.log(`   Supabase Direct: ${directCheck.status} ${directCheck.ok ? '✅' : '❌'}`);

    if (cdnUrl) {
        const cdnCheck = await checkUrl(cdnUrl);
        console.log(`   CDN (${HLS_BASE_URL}): ${cdnCheck.status} ${cdnCheck.ok ? '✅' : '❌'}`);
    }

    if (!directCheck.ok) {
        console.log(`\n   ℹ️  Note: 404 is expected if Egress hasn't started or failed.`);
        console.log(`       402/403 indicates a permissions or billing issue.`);
    }

    // 4. Connection Test
    console.log("\n🔌 Connectivity Test...");
    const at = new AccessToken(LK_API_KEY, LK_API_SECRET, {
        identity: `debugger-${Date.now()}`,
    });
    at.addGrant({ roomJoin: true, room: stream.id, canSubscribe: true, canPublish: false });
    const token = await at.toJwt();
    const wsUrl = `${LIVEKIT_URL}/rtc?access_token=${token}&protocol=8&sdk=js&version=1.0.0`;
    
    // Simple WS open/close check
    try {
        await new Promise<void>((resolve) => {
            if (typeof WebSocket === 'undefined') {
                console.log("   (Skipping WS test - requires global WebSocket)");
                resolve();
                return;
            }
            const ws = new WebSocket(wsUrl);
            const tm = setTimeout(() => { ws.close(); console.log("   ❌ WS Timeout"); resolve(); }, 5000);
            ws.onopen = () => { clearTimeout(tm); console.log("   ✅ WS Connected"); ws.close(); resolve(); };
            ws.onerror = () => { clearTimeout(tm); console.log("   ❌ WS Error"); resolve(); };
        });
    } catch {
        console.log("   ❌ WS Exception");
    }
}

run().catch(console.error);
