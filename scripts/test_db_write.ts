import { createClient } from '@supabase/supabase-js';
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
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

async function run() {
    console.log("🧪 Testing Database Write Access...");
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing Credentials");
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Try to update a non-critical field or a dummy row
    // We'll search for the 'test' stream we found earlier
    const { data: streams } = await supabase.from('streams').select('id').ilike('title', '%test%').limit(1);
    
    if (!streams || streams.length === 0) {
        console.log("⚠️ No test stream found to update. Creating dummy...");
        // Skipping create to avoid clutter if blocked
        return;
    }

    const id = streams[0].id;
    console.log(`   Target Stream ID: ${id}`);

    // Attempt Update
    const { error } = await supabase
        .from('streams')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error("❌ DB WRITE FAILED:", error.message);
        console.error("   Reason:", error.details || error.hint || "Likely Billing Lock");
    } else {
        console.log("✅ DB WRITE SUCCESS! (Database is NOT locked)");
    }
}

run();
