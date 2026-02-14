import { RoomServiceClient } from 'livekit-server-sdk';
import fs from 'fs';
import path from 'path';

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
const LIVEKIT_URL = env.VITE_LIVEKIT_URL || env.VITE_LIVEKIT_CLOUD_URL;
const LK_API_KEY = env.LIVEKIT_API_KEY;
const LK_API_SECRET = env.LIVEKIT_API_SECRET;

async function run() {
    console.log("📡 LiveKit Connection Check");
    console.log(`   URL: ${LIVEKIT_URL}`);
    console.log(`   Key: ${LK_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`   Secret: ${LK_API_SECRET ? 'Set' : 'Missing'}`);

    if (!LIVEKIT_URL || !LK_API_KEY || !LK_API_SECRET) {
        console.error("❌ Missing Credentials");
        return;
    }

    const svc = new RoomServiceClient(LIVEKIT_URL.replace('wss://', 'https://'), LK_API_KEY, LK_API_SECRET);
    try {
        const rooms = await svc.listRooms();
        console.log(`\n✅ Connected to LiveKit Server`);
        console.log(`   Active Rooms: ${rooms.length}`);
        
        if (rooms.length > 0) {
            rooms.forEach(r => {
                console.log(`   - Name: ${r.name}`);
                console.log(`     SID: ${r.sid}`);
                console.log(`     Participants: ${r.numParticipants}`);
            });
        } else {
            console.log("   (No active broadcasts found)");
        }
    } catch (e) {
        console.error("\n❌ Connection Failed:", e);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
}

run();
