import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const REPORT_DIR = path.join(process.cwd(), 'test_results');
const REPORT_FILE = path.join(REPORT_DIR, `db_load_test_report_${Date.now()}.json`);

const CONFIG = {
  totalUsers: 1000,
  streams: 10,
  viewers: 600,
  chatters: 200,
  gifters: 100,
  giftsPerGifter: 3,
  battles: 100,
  messagePerChatter: 2,
  cleanup: process.env.LOAD_TEST_CLEANUP === 'true'
};

const report = {
  startedAt: new Date().toISOString(),
  scope: 'db-load-test',
  environment: 'production',
  config: CONFIG,
  actions: [],
  warnings: [],
  errors: [],
  cleanup: [],
  summary: {}
};

function logAction(type, detail) {
  report.actions.push({ time: new Date().toISOString(), type, detail });
}

function logWarning(step, warning) {
  report.warnings.push({ time: new Date().toISOString(), step, warning: String(warning) });
}

function logError(step, error) {
  report.errors.push({ time: new Date().toISOString(), step, error: String(error) });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTestUsers(count) {
  const users = [];
  const createdAt = Date.now();
  const password = `LoadPass!${createdAt}`;

  const batchSize = 25;
  for (let i = 0; i < count; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, idx) => {
      const email = `load+${createdAt}-${i + idx}@trollcity.local`;
      return adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    });

    const results = await Promise.all(batch);
    for (let j = 0; j < results.length; j++) {
      const { data, error } = results[j] || {};
      if (error || !data?.user) {
        logError('create_user', error?.message || 'Unknown error');
        continue;
      }
      users.push({ id: data.user.id, email: data.user.email, password });
    }

    await sleep(200);
  }

  if (!users.length) throw new Error('No test users created');
  logAction('create_users', { count: users.length });
  return users;
}

async function seedProfiles(users) {
  const seedStamp = Date.now();
  const updates = users.map((u, i) => ({
    id: u.id,
    username: `load_user_${seedStamp}_${i}`,
    troll_coins: 50_000_000,
    is_broadcaster: i < CONFIG.streams
  }));

  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await adminClient.from('user_profiles').upsert(chunk, { onConflict: 'id' });
    if (error) logError('seed_profiles', error.message);
    await sleep(100);
  }
  logAction('seed_profiles', { count: updates.length });
}

async function createStreams(users) {
  const streamIds = [];
  for (let i = 0; i < CONFIG.streams; i++) {
    const broadcaster = users[i];
    const { data, error } = await adminClient
      .from('streams')
      .insert({ broadcaster_id: broadcaster.id, status: 'live', title: `Load Stream ${i + 1}` })
      .select('id')
      .single();

    if (error) {
      logError('create_stream', error.message);
      continue;
    }
    streamIds.push(data.id);
  }
  logAction('create_streams', { count: streamIds.length });
  return streamIds;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function createViewers(streamIds, users) {
  const viewerUsers = users.slice(CONFIG.streams, CONFIG.streams + CONFIG.viewers);
  const rows = viewerUsers.map((u) => ({
    stream_id: pickRandom(streamIds),
    user_id: u.id
  }));

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await adminClient.from('stream_viewers').upsert(chunk, { onConflict: 'stream_id,user_id' });
    if (error) logWarning('create_viewers', error.message);
    await sleep(100);
  }
  logAction('create_viewers', { count: rows.length });
}

async function createChat(streamIds, users) {
  const start = CONFIG.streams + CONFIG.viewers;
  const chatUsers = users.slice(start, start + CONFIG.chatters);
  const rows = [];

  for (const u of chatUsers) {
    for (let i = 0; i < CONFIG.messagePerChatter; i++) {
      rows.push({
        stream_id: pickRandom(streamIds),
        user_id: u.id,
        content: `load test message ${i + 1}`,
        type: 'chat'
      });
    }
  }

  const chunkSize = 250;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await adminClient.from('stream_messages').insert(chunk);
    if (error) logWarning('create_chat', error.message);
    await sleep(100);
  }
  logAction('create_chat', { count: rows.length });
}

async function createBattles(streamIds) {
  const rows = [];
  for (let i = 0; i < CONFIG.battles; i++) {
    const challenger = pickRandom(streamIds);
    let opponent = pickRandom(streamIds);
    if (opponent === challenger) opponent = pickRandom(streamIds);
    rows.push({ challenger_stream_id: challenger, opponent_stream_id: opponent, status: 'active' });
  }

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await adminClient.from('battles').insert(chunk);
    if (error) logWarning('create_battles', error.message);
    await sleep(100);
  }
  logAction('create_battles', { count: rows.length });
}

async function sendGifts(streamIds, users) {
  const giftUserStart = CONFIG.streams + CONFIG.viewers + CONFIG.chatters;
  const giftUsers = users.slice(giftUserStart, giftUserStart + CONFIG.gifters);

  const { data: gift } = await adminClient.from('gifts').select('id, cost, coin_cost').limit(1).maybeSingle();
  if (!gift?.id) {
    logWarning('send_gifts', 'No gifts available');
    return;
  }

  let sent = 0;
  for (const gifter of giftUsers) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: session, error: signInError } = await userClient.auth.signInWithPassword({
      email: gifter.email,
      password: gifter.password
    });

    if (signInError || !session?.session) {
      logWarning('send_gifts', signInError?.message || 'Failed to sign in gifter');
      continue;
    }

    for (let i = 0; i < CONFIG.giftsPerGifter; i++) {
      const streamId = pickRandom(streamIds);
      const receiver = pickRandom(users.slice(0, CONFIG.streams));
      const { error } = await userClient.rpc('send_gift_in_stream', {
        p_sender_id: gifter.id,
        p_receiver_id: receiver.id,
        p_stream_id: streamId,
        p_gift_id: String(gift.id),
        p_quantity: 1
      });

      if (error) {
        logWarning('send_gifts', error.message);
        continue;
      }
      sent += 1;
    }

    await sleep(50);
  }

  logAction('send_gifts', { count: sent });
}

async function cleanup(users, streamIds) {
  if (!CONFIG.cleanup) return;

  const userIds = users.map((u) => u.id);

  const deleteByUser = async (table, column = 'user_id') => {
    const { error } = await adminClient.from(table).delete().in(column, userIds);
    if (error) logWarning('cleanup', `${table}: ${error.message}`);
  };

  await deleteByUser('stream_viewers');
  await deleteByUser('stream_messages');
  await deleteByUser('coin_ledger');
  await deleteByUser('coin_transactions');
  await deleteByUser('gift_ledger', 'sender_id');
  await deleteByUser('gift_ledger', 'receiver_id');
  await deleteByUser('gift_transactions', 'from_user_id');
  await deleteByUser('gift_transactions', 'to_user_id');

  if (streamIds.length) {
    const { error } = await adminClient.from('streams').delete().in('id', streamIds);
    if (error) logWarning('cleanup', `streams: ${error.message}`);
  }

  for (const u of users) {
    const { error } = await adminClient.auth.admin.deleteUser(u.id);
    if (error) logWarning('cleanup', `auth.deleteUser: ${error.message}`);
  }

  report.cleanup.push({ usersDeleted: users.length, streamsDeleted: streamIds.length });
}

async function main() {
  try {
    const users = await createTestUsers(CONFIG.totalUsers);
    await seedProfiles(users);
    const streamIds = await createStreams(users);

    await createViewers(streamIds, users);
    await createChat(streamIds, users);
    await createBattles(streamIds);
    await sendGifts(streamIds, users);

    await cleanup(users, streamIds);

    report.summary = {
      errors: report.errors.length,
      warnings: report.warnings.length,
      actions: report.actions.length
    };
  } catch (error) {
    logError('fatal', error);
  } finally {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`DB load test complete. Report: ${REPORT_FILE}`);
  }
}

main();
