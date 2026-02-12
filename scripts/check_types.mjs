import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTypes() {
    const sql = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name IN (
            'troll_coins', 'free_coin_balance', 'earned_coin_balance', 
            'paid_coin_balance', 'total_earned_coins', 'trollmonds', 
            'total_trollmonds', 'paid_coins', 'total_spent_coins'
        );
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error('Error:', error);
    } else {
        // exec_sql in this project seems to return a JSON with a message, 
        // but maybe it can be coaxed into returning rows if we change it.
        // Let's just try to select from the table and check the result.
        console.log('Data:', data);
    }
}

checkTypes();
