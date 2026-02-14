import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const _supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function checkDebugInfo() {
    console.log('--- Checking Any Gift ---');
    const { data: gifts, error: giftError } = await adminClient
        .from('gifts')
        .select('*')
        .limit(5);
    
    if (giftError) console.error(giftError);
    else console.log('Gifts found:', gifts);

    console.log('\n--- Checking Battles Table Schema (via introspection simulation) ---');
    // We can't easily check schema via client, but we can insert a dummy battle and check it.
    
    // Check recent battles
    const { data: battles, error: battleError } = await adminClient
        .from('battles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
        
    if (battleError) console.error(battleError);
    else console.log('Most recent battle:', battles);

    // Check if there are triggers? We can't see triggers via client easily.
}

checkDebugInfo();
