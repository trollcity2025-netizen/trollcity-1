import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAlters() {
    const columns = [
        'troll_coins',
        'free_coin_balance',
        'earned_coin_balance',
        'paid_coin_balance',
        'total_earned_coins',
        'trollmonds',
        'total_trollmonds',
        'paid_coins',
        'total_spent_coins'
    ];

    for (const col of columns) {
        console.log(`Testing ALTER for ${col}...`);
        const sql = `ALTER TABLE public.user_profiles ALTER COLUMN ${col} TYPE BIGINT;`;
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error(`FAILED ${col}:`, error.message);
        } else {
            console.log(`SUCCESS ${col}`);
        }
    }
}

testAlters();
