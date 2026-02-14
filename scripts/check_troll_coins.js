
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumn() {
    const { data: _data, error } = await supabase.from('user_profiles').select('troll_coins').limit(1);
    if (error) {
        console.error('Error selecting troll_coins:', error);
    } else {
        console.log('troll_coins exists!');
    }
}

checkColumn();
