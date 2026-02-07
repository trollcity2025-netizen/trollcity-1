import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySql() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node apply_sql.mjs <path_to_sql_file>');
        process.exit(1);
    }

    const sqlPath = path.resolve(args[0]);
    console.log(`Applying SQL from: ${sqlPath}`);
    
    try {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
            console.error('Failed to apply SQL:', error);
            process.exit(1);
        } else {
            console.log('SQL applied successfully!');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Error reading file or executing:', err);
        process.exit(1);
    }
}

applySql();
