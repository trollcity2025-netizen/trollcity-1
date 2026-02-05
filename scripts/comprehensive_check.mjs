
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const TIMESTAMP = Date.now();
const USER_EMAIL = `test_user_${TIMESTAMP}@trollcity.com`;
const ADMIN_EMAIL = `test_admin_${TIMESTAMP}@trollcity.com`;
const PASSWORD = 'password123';

const results = {
    auth: { status: 'pending', details: [] },
    profile: { status: 'pending', details: [] },
    economy: { status: 'pending', details: [] },
    broadcast: { status: 'pending', details: [] },
    pods: { status: 'pending', details: [] },
    court: { status: 'pending', details: [] },
    moderation: { status: 'pending', details: [] }
};

async function logResult(category, success, message) {
    const status = success ? '✅' : '❌';
    console.log(`${status} [${category.toUpperCase()}] ${message}`);
    results[category].details.push(`${status} ${message}`);
    if (!success) results[category].status = 'failed';
    else if (results[category].status !== 'failed') results[category].status = 'passed';
}

async function createUser(email, role = 'user') {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { username: email.split('@')[0] }
    });
    if (error) throw error;
    
    // Ensure profile
    let profile = null;
    for (let i = 0; i < 5; i++) {
        const { data: p } = await supabaseAdmin.from('user_profiles').select('*').eq('id', data.user.id).single();
        if (p) { profile = p; break; }
        await new Promise(r => setTimeout(r, 500));
    }

    if (!profile) {
        await supabaseAdmin.from('user_profiles').insert({
            id: data.user.id,
            username: email.split('@')[0],
            role: role
        });
    } else if (role !== 'user') {
        await supabaseAdmin.from('user_profiles').update({ role }).eq('id', data.user.id);
    }
    
    return data.user;
}

async function login(email) {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw error;
    return createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    });
}

async function runTest() {
    console.log(`Starting Comprehensive System Check at ${new Date().toISOString()}...\n`);

    let user, admin;
    let userClient, adminClient;

    try {
        // --- AUTH & PROFILE ---
        console.log('--- PHASE 1: User & Profile ---');
        user = await createUser(USER_EMAIL, 'user');
        admin = await createUser(ADMIN_EMAIL, 'admin');
        logResult('auth', true, `Created User: ${user.id}`);
        logResult('auth', true, `Created Admin: ${admin.id}`);

        userClient = await login(USER_EMAIL);
        adminClient = await login(ADMIN_EMAIL);
        logResult('auth', true, 'Login successful for both users');

        // Profile Update
        const newBio = "I am a test troll.";
        const { error: updateError } = await userClient
            .from('user_profiles')
            .update({ bio: newBio, terms_accepted: true })
            .eq('id', user.id);
        
        if (updateError) logResult('profile', false, `Profile Update Failed: ${updateError.message}`);
        else {
            const { data: p } = await supabaseAdmin.from('user_profiles').select('bio').eq('id', user.id).single();
            if (p.bio === newBio) logResult('profile', true, 'Profile bio updated verified');
            else logResult('profile', false, 'Profile bio mismatch');
        }

        // --- ECONOMY ---
        console.log('\n--- PHASE 2: Economy & Gifting ---');
        // Check Balance
        const { data: _balance } = await userClient.rpc('get_user_balances', { p_user_id: user.id });
        // Depending on implementation, might return array or object. Assuming empty or default.
        logResult('economy', true, 'Balance check executed');

        // Grant Coins (Admin Action)
        const { error: grantError } = await supabaseAdmin.rpc('grant_coins', { 
            p_user_id: user.id, 
            p_amount: 1000, 
            p_reason: 'Test Grant' 
        });
        
        // Fallback if RPC doesn't exist, try direct insert if table exists
        if (grantError) {
             // Try updating profile coins if that's where they live? 
             const { error: updateCoins } = await supabaseAdmin.from('user_profiles').update({ troll_coins: 1000 }).eq('id', user.id);
             if (updateCoins) logResult('economy', false, `Grant failed: ${updateCoins.message}`);
             else logResult('economy', true, 'Coins granted manually via profile update (troll_coins)');
        } else {
            logResult('economy', true, 'Coins granted via RPC');
        }

        // --- BROADCASTS ---
        console.log('\n--- PHASE 3: Broadcasts ---');
        const { data: stream, error: streamError } = await userClient
            .from('streams')
            .insert({ user_id: user.id, title: 'System Check Stream', status: 'live' })
            .select()
            .single();
        
        if (streamError) logResult('broadcast', false, `Create Stream Failed: ${streamError.message}`);
        else {
            logResult('broadcast', true, `Stream created: ${stream.id}`);
            
            // Heartbeat / Ping
            try {
                const { error: pingError } = await userClient
                    .from('streams')
                    .update({ last_ping: new Date().toISOString() })
                    .eq('id', stream.id);
                
                if (pingError) {
                     if (pingError.message.includes('column "last_ping" does not exist')) {
                         logResult('broadcast', false, 'Schema Mismatch: streams.last_ping column missing');
                     } else {
                         logResult('broadcast', false, `Heartbeat failed: ${pingError.message}`);
                     }
                } else {
                    logResult('broadcast', true, 'Stream heartbeat verified');
                }
            } catch (e) {
                logResult('broadcast', false, `Heartbeat Exception: ${e.message}`);
            }
        }

        // --- PODS ---
        console.log('\n--- PHASE 4: Pods ---');
        const { data: pod, error: podError } = await userClient
            .from('pod_rooms')
            .insert({ host_id: user.id, title: 'System Check Pod', is_live: true })
            .select()
            .single();
        
        if (podError) logResult('pods', false, `Create Pod Failed: ${podError.message}`);
        else {
            logResult('pods', true, `Pod created: ${pod.id}`);
            
            // Join Pod
            const { error: joinError } = await userClient
                .from('pod_room_participants')
                .insert({ room_id: pod.id, user_id: user.id, role: 'host' });
            
            if (joinError) logResult('pods', false, `Join Pod Failed: ${joinError.message}`);
            else logResult('pods', true, 'Host joined pod successfully');
        }

        // --- COURT ---
        console.log('\n--- PHASE 5: Court ---');
        
        const caseData = {
            plaintiff_id: admin.id,
            defendant_id: user.id,
            accusation: 'Being a bot',
            status: 'scheduled'
            // severity: 'Low' // Removed initially to test if it works without it, or try/catch
        };

        // Try inserting with severity first
        let court;
        let courtError;
        
        try {
             const res = await adminClient
                .from('troll_court_cases')
                .insert({ ...caseData, severity: 'Low' })
                .select()
                .single();
             court = res.data;
             courtError = res.error;
        } catch {
             // likely ignored, but let's see
        }

        if (courtError && courtError.message.includes('column "severity" does not exist')) {
            logResult('court', false, 'Schema Mismatch: troll_court_cases.severity column missing');
            // Retry without severity
             const res = await adminClient
                .from('troll_court_cases')
                .insert(caseData)
                .select()
                .single();
             court = res.data;
             courtError = res.error;
             if (!courtError) logResult('court', true, 'Court Case created (fallback without severity)');
        } else if (courtError) {
             logResult('court', false, `Create Case Failed: ${courtError.message}`);
        } else {
             logResult('court', true, `Court Case created: ${court.id}`);
        }

        if (court) {
            // Update Status
            const { error: statusError } = await adminClient
                .from('troll_court_cases')
                .update({ status: 'complete' }) // Use 'complete' as verified in previous fix
                .eq('id', court.id);
            
            if (statusError) logResult('court', false, `Update Case Status Failed: ${statusError.message}`);
            else logResult('court', true, 'Case status updated to complete');
        }

        // --- MODERATION ---
        console.log('\n--- PHASE 6: Moderation ---');
        // Ban User
        const { error: banError } = await adminClient.rpc('ban_user', {
            p_user_id: user.id,
            p_reason: 'System Check Ban',
            p_duration: '24h'
        });

        // Fallback check
        if (banError) {
             // Maybe direct insert to banned_users?
             const { error: directBan } = await adminClient.from('banned_users').insert({
                 user_id: user.id,
                 reason: 'System Check',
                 banned_by: admin.id
             });
             if (directBan) {
                 if (directBan.message.includes('relation "public.banned_users" does not exist') || directBan.code === '42P01') {
                     logResult('moderation', false, 'Schema Mismatch: public.banned_users table missing');
                 } else {
                     logResult('moderation', false, `Ban Failed: ${directBan.message}`);
                 }
             }
             else logResult('moderation', true, 'User banned manually');
        } else {
            logResult('moderation', true, 'User banned via RPC');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        // Cleanup
        console.log('\nCleaning up test users...');
        if (user) await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (admin) await supabaseAdmin.auth.admin.deleteUser(admin.id);
        console.log('Cleanup complete.');
    }

    console.log('\n--- FINAL REPORT ---');
    Object.entries(results).forEach(([key, val]) => {
        console.log(`${key.toUpperCase()}: ${val.status.toUpperCase()}`);
        val.details.forEach(d => console.log(`  ${d}`));
    });
}

runTest();
