
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

const TEST_PREFIX = 'test_role_check_';
const TIMESTAMP = Date.now();

const USERS = {
    HOST: { email: `${TEST_PREFIX}host_${TIMESTAMP}@trollcity.com`, password: 'password123', role: 'user', id: null },
    MOD: { email: `${TEST_PREFIX}mod_${TIMESTAMP}@trollcity.com`, password: 'password123', role: 'moderator', id: null },
    USER: { email: `${TEST_PREFIX}user_${TIMESTAMP}@trollcity.com`, password: 'password123', role: 'user', id: null },
    LISTENER: { email: `${TEST_PREFIX}listener_${TIMESTAMP}@trollcity.com`, password: 'password123', role: 'user', id: null },
};

async function cleanup() {
    console.log('\nCleaning up...');
    const userIds = Object.values(USERS).map(u => u.id).filter(Boolean);
    if (userIds.length > 0) {
        const { error: _error } = await supabaseAdmin.auth.admin.deleteUser(userIds[0]); // Delete one by one or batch if supported? Supabase deleteUser is one by one.
        for (const uid of userIds) {
            await supabaseAdmin.auth.admin.deleteUser(uid);
        }
        console.log('Deleted test users.');
    }
}

async function createUser(key) {
    const user = USERS[key];
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { username: `${TEST_PREFIX}${key}_${TIMESTAMP}` }
    });

    if (error) throw error;
    USERS[key].id = data.user.id;
    
    // Ensure profile exists (wait for trigger or insert)
    let retries = 5;
    let profile = null;
    while (retries > 0) {
        const { data: profileData } = await supabaseAdmin.from('user_profiles').select('id').eq('id', data.user.id).single();
        if (profileData) {
            profile = profileData;
            break;
        }
        await new Promise(r => setTimeout(r, 500));
        retries--;
    }

    if (!profile) {
        console.log(`Profile missing for ${key}, inserting manually...`);
        const { error: insertError } = await supabaseAdmin.from('user_profiles').insert({
            id: data.user.id,
            username: `${TEST_PREFIX}${key}_${TIMESTAMP}`,
            role: user.role,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${key}`
        });
        if (insertError) {
             console.error('Manual profile insert failed:', insertError);
             throw insertError;
        }
    } else {
        // Update Role
        const { error: roleError } = await supabaseAdmin
            .from('user_profiles')
            .update({ role: user.role }) // Removed is_moderator
            .eq('id', data.user.id);
            
        if (roleError) {
            console.error(`Failed to update role for ${key}:`, roleError);
            throw roleError;
        }
    }
    
    console.log(`Created ${key}: ${data.user.id} (${user.role})`);
    return createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } } // Wait, createUser doesn't return session by default for admin.
    });
}

async function loginUser(key) {
    const user = USERS[key];
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: user.email,
        password: user.password
    });
    if (error) throw error;
    return createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    });
}

async function runTests() {
    try {
        console.log('Setting up test users...');
        await createUser('HOST');
        await createUser('MOD');
        await createUser('USER');
        
        // Clients
        const hostClient = await loginUser('HOST');
        const modClient = await loginUser('MOD');
        const userClient = await loginUser('USER');

        // --- TEST 1: BROADCAST KICK/MUTE ---
        console.log('\n--- TEST 1: BROADCAST PERMISSIONS ---');
        // 1. Host creates stream
        const { data: stream, error: streamError } = await hostClient
            .from('streams')
            .insert({
                user_id: USERS.HOST.id,
                title: 'Test Stream',
                status: 'live'
            })
            .select()
            .single();
            
        if (streamError) throw new Error(`Stream creation failed: ${streamError.message}`);
        console.log(`Stream created: ${stream.id}`);

        // 2. Mod Mutes User (Should Success)
        // Use hostClient to assign moderator (Broadcaster permission)
        const { data: modAssign, error: modAssignError } = await hostClient
            .from('stream_moderators')
            .insert({ broadcaster_id: USERS.HOST.id, user_id: USERS.MOD.id })
            .select();
            
        if (modAssignError) console.error('Mod Assignment Failed:', modAssignError);
        else console.log('Assigned Mod to Stream:', modAssign);

        // 3. Execute Mute (RPC)
        const { error: muteError } = await modClient.rpc('mute_user', {
            p_stream_id: stream.id,
            p_user_id: USERS.USER.id
        });
        
        if (muteError) {
            console.error('❌ Mod Mute Failed:', muteError);
        } else {
            console.log('✅ Mod Mute Success');
        }

        // Verify Mute in DB
        const { data: muteCheck } = await supabaseAdmin
            .from('stream_mutes')
            .select('*')
            .eq('stream_id', stream.id)
            .eq('user_id', USERS.USER.id);
            
        if (muteCheck && muteCheck.length > 0) {
            console.log('✅ Mute verified in DB');
        } else {
            console.error('❌ Mute NOT found in DB');
        }

        // 4. User tries to Mute Host (Should Fail)
        const { error: userMuteError } = await userClient.rpc('mute_user', {
            p_stream_id: stream.id,
            p_user_id: USERS.HOST.id
        });
        
        if (userMuteError) {
            console.log('✅ Unauthorized Mute Blocked (Expected)');
        } else {
            console.error('❌ User was able to mute Host! (CRITICAL FAILURE)');
        }

        // --- TEST 2: POD PERMISSIONS ---
        console.log('\n--- TEST 2: POD PERMISSIONS ---');
        // 1. Host creates Pod
        const { data: pod, error: podError } = await hostClient
            .from('pod_rooms')
            .insert({
                host_id: USERS.HOST.id,
                title: 'Test Pod',
                is_live: true,
                // topic: 'Testing' // topic might not exist either, checking schema...
            })
            .select()
            .single();
            
        if (podError) throw new Error(`Pod creation failed: ${podError.message}`);
        console.log(`Pod created: ${pod.id}`);
        
        // 2. User joins Pod
        await userClient
            .from('pod_room_participants')
            .insert({ room_id: pod.id, user_id: USERS.USER.id, role: 'listener' });
            
        console.log('User joined Pod.');

        // 3. Host Kicks User (Delete from participants)
        // RLS Policy: "Users can leave or Host can kick"
        const { error: kickError } = await hostClient
            .from('pod_room_participants')
            .delete()
            .eq('room_id', pod.id)
            .eq('user_id', USERS.USER.id);
            
        if (kickError) {
            console.error('❌ Host Pod Kick Failed:', kickError);
        } else {
            console.log('✅ Host Pod Kick Success');
        }
        
        // Verify Kick (Wait a bit for propagation if needed, though usually immediate)
        await new Promise(r => setTimeout(r, 1000));
        const { data: podCheck } = await supabaseAdmin
            .from('pod_room_participants')
            .select('*')
            .eq('room_id', pod.id)
            .eq('user_id', USERS.USER.id);
            
        if (!podCheck || podCheck.length === 0) {
            console.log('✅ Kick verified in DB');
        } else {
            console.error('❌ User still in Pod DB');
        }

        // --- TEST 3: COURT PERMISSIONS ---
        console.log('\n--- TEST 3: COURT PERMISSIONS ---');
        // 1. Create Court Case
        const { data: court, error: courtError } = await hostClient
            .from('troll_court_cases')
            .insert({
                plaintiff_id: USERS.HOST.id,
                defendant_id: USERS.USER.id,
                accusation: 'Test Case',
                status: 'scheduled'
            })
            .select()
            .single();
            
        if (courtError) {
             // Try 'open' status or ignore if table differs
             console.log(`Court creation note: ${courtError.message}`);
        } else {
            console.log(`Court Case created: ${court.id}`);
            // Check if Host can update it
            const { error: updateError } = await hostClient
                .from('troll_court_cases')
                .update({ status: 'complete' })
                .eq('id', court.id);
                
            if (updateError) console.error('❌ Host cannot update Court Case:', updateError);
            else console.log('✅ Host updated Court Case');
        }

        console.log('\nAll tests completed.');
        
    } catch (err) {
        console.error('Test Suite Failed:', err);
    } finally {
        await cleanup();
    }
}

runTests();
