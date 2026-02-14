
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
let envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
    envPath = path.resolve(__dirname, '../.env');
}
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = Object.fromEntries(
    envContent.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
            const [key, ...val] = line.split('=');
            return [key.trim(), val.join('=').trim().replace(/^["']|["']$/g, '')];
        })
);

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createOrUpdateUser(email, password, role = 'user') {
    // Check if exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    let user = users.find(u => u.email === email);

    if (!user) {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username: email.split('@')[0] }
        });
        if (error) {
            console.error(`Failed to create ${email}:`, error.message);
            return null;
        }
        user = data.user;
        console.log(`Created user: ${email}`);
    } else {
        console.log(`User exists: ${email}`);
    }

    // Update profile with coins and role
    const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
            troll_coins: 10000,
            role: role
        })
        .eq('id', user.id);

    if (updateError) console.error(`Failed to fund ${email}:`, updateError.message);
    else console.log(`Funded ${email} with 10,000 coins`);

    return user;
}

async function run() {
    console.log('--- SETTING UP HEAVY TEST USERS ---');

    // Create 2 Streamers
    await createOrUpdateUser('heavy_streamer1@example.com', 'password123', 'user');
    await createOrUpdateUser('heavy_streamer2@example.com', 'password123', 'user');

    // Create 100 Viewers (Batch of 10)
    const totalViewers = 100;
    const batchSize = 10;
    
    for (let i = 1; i <= totalViewers; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && (i + j) <= totalViewers; j++) {
            const num = i + j;
            batch.push(createOrUpdateUser(`heavy_viewer${num}@example.com`, 'password123', 'user'));
        }
        await Promise.all(batch);
        console.log(`Processed viewers ${i} to ${Math.min(i + batchSize - 1, totalViewers)}`);
    }

    console.log('--- SETUP COMPLETE ---');
}

run().catch(console.error);
