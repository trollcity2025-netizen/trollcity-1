
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log('Inspecting Tables...');
    
    // Check user_profiles schema
    console.log('\n--- user_profiles columns ---');
    const { data: profiles, error: pError } = await supabase.from('user_profiles').select('*').limit(1);
    if (profiles && profiles.length > 0) {
        Object.keys(profiles[0]).forEach(key => console.log(key));
    } else if (profiles && profiles.length === 0) {
        console.log("Table exists but empty. Cannot infer columns easily via SELECT *.");
        // Try to insert a dummy row that fails to see columns in error, or just rely on what we have.
        // Or we can query information_schema if possible (usually not via JS client unless rpc).
    } else {
        console.log('Error:', pError);
    }

    // Check stream_bans schema
    console.log('\n--- stream_bans columns ---');
    const { data: bans, error: bError } = await supabase.from('stream_bans').select('*').limit(1);
    if (bans && bans.length > 0) {
        Object.keys(bans[0]).forEach(key => console.log(key));
    } else if (bans && bans.length === 0) {
         console.log("Table exists but empty.");
    } else {
        console.log('Error:', bError);
    }
}

inspect();
