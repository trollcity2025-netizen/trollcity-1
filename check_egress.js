import { EgressClient } from 'livekit-server-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load dotenv
try {
    dotenv.config();
} catch {
    console.log("Note: dotenv not found or failed to load. Relying on system environment variables.");
}

// Helper to manually load .env if dotenv didn't work or for specific locations
function loadEnvFile(filePath) {
    if (fs.existsSync(filePath)) {
        console.log(`Loading env from ${filePath}`);
        const envConfig = fs.readFileSync(filePath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

// Try loading from standard locations if vars are missing
if (!process.env.LIVEKIT_URL) {
    loadEnvFile(path.join(__dirname, '.env'));
    loadEnvFile(path.join(__dirname, 'server', '.env'));
}

async function checkEgress() {
    console.log("--- LiveKit Egress & Bunny.net Check ---");

    const livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    // Assuming the user might set this, or we just validate what they have
    const bunnyRtmpUrl = process.env.BUNNY_RTMP_URL; 

    // 1. Check LIVEKIT_URL
    if (!livekitUrl) {
        console.error("❌ LIVEKIT_URL is missing in environment variables.");
        return;
    }

    if (livekitUrl.startsWith('wss://')) {
        console.log(`✅ LIVEKIT_URL starts with wss:// (${livekitUrl})`);
    } else {
        console.error(`❌ LIVEKIT_URL does NOT start with wss://. Found: ${livekitUrl}`);
        console.log("   Please update your LIVEKIT_URL to use wss:// protocol.");
    }

    // 2. Check Bunny.net RTMP URL
    if (bunnyRtmpUrl) {
        const bunnyRegex = /^rtmp:\/\/video\.bunnycdn\.com\/stream\/[a-zA-Z0-9_-]+$/;
        if (bunnyRegex.test(bunnyRtmpUrl)) {
            console.log(`✅ Bunny.net RTMP URL format is correct.`);
        } else {
            console.error(`❌ Bunny.net RTMP URL format is INCORRECT.`);
            console.log(`   Expected format: rtmp://video.bunnycdn.com/stream/STREAM_KEY`);
            console.log(`   Found: ${bunnyRtmpUrl}`);
        }
    } else {
        console.log("⚠️ BUNNY_RTMP_URL not found in env. Skipping format check.");
        console.log("   (Set BUNNY_RTMP_URL to verify your specific stream key format)");
    }

    if (!apiKey || !apiSecret) {
        console.error("❌ LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing.");
        return;
    }

    // 3. List Egress
    // EgressClient usually needs the HTTPS URL.
    let apiUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    
    console.log(`\nConnecting to LiveKit API at ${apiUrl}...`);

    const egressClient = new EgressClient(apiUrl, apiKey, apiSecret);

    try {
        const egressList = await egressClient.listEgress({ limit: 5 });
        
        console.log(`\n--- Last 5 Egress Attempts ---`);
        if (egressList.length === 0) {
            console.log("No egress attempts found.");
        } else {
            egressList.forEach((egress, index) => {
                console.log(`\n[${index + 1}] Egress ID: ${egress.egressId}`);
                console.log(`    Status: ${egress.status}`); // 0: STARTING, 1: ACTIVE, 2: ENDING, 3: ENDED, 4: FAILED
                if (egress.error) {
                    console.log(`    Error: ${egress.error}`);
                } else {
                    console.log(`    Error: None`);
                }
                // Log start/end time if available
                if (egress.startedAt) {
                     // LiveKit timestamps are often in nanoseconds (BigInt) or milliseconds depending on SDK version
                     // Try to parse it
                     try {
                        const date = new Date(Number(egress.startedAt) / 1000000); // ns to ms
                        console.log(`    Started At: ${date.toISOString()}`);
                     } catch {
                        console.log(`    Started At: ${egress.startedAt}`);
                     }
                }
            });
        }

    } catch (error) {
        console.error("\n❌ Error listing egress:", error.message || error);
        console.error('--- FULL ERROR DETAILS ---');
        console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        if (error?.response?.data) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code === 'ENOTFOUND') {
            console.error("   Check your internet connection and LIVEKIT_URL.");
        } else if (error.response && error.response.status === 401) {
            console.error("   Authentication failed. Check API Key and Secret.");
        }
    }
}

checkEgress();
