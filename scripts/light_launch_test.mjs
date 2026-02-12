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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const REPORT_DIR = path.join(process.cwd(), 'test_results');
const REPORT_FILE = path.join(REPORT_DIR, `light_launch_test_report_${Date.now()}.json`);

const report = {
  startedAt: new Date().toISOString(),
  scope: 'light-launch-test',
  environment: 'production',
  config: {
    testUsers: 4,
    concurrency: 4,
    livekit: 'not used',
  },
  checks: {
    tables: [],
    columns: [],
    routines: [],
  },
  actions: [],
  warnings: [],
  errors: [],
  cleanup: [],
  summary: {}
};

const REQUIRED_TABLES = [
  'user_profiles',
  'streams',
  'stream_messages',
  'gifts',
  'battles',
  'coin_ledger',
  'coin_transactions',
  'vehicles_catalog',
  'user_vehicles',
  'properties',
  'gift_ledger',
  'gift_transactions',
  'purchasable_items',
  'shop_items'
];

const REQUIRED_ROUTINES = [
  'send_gift_in_stream',
  'send_premium_gift',
  'purchase_item',
  'purchase_from_ktauto',
  'buy_car_insurance',
  'purchase_broadcast_theme',
  'purchase_entrance_effect'
];

function logAction(type, detail) {
  report.actions.push({ time: new Date().toISOString(), type, detail });
}

function logError(step, error) {
  report.errors.push({ time: new Date().toISOString(), step, error: String(error) });
}

function logWarning(step, warning) {
  report.warnings.push({ time: new Date().toISOString(), step, warning: String(warning) });
}

async function checkTables() {
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('id').limit(1);
    const exists = !error || !error.message?.includes('does not exist');
    report.checks.tables.push({ table, exists, error: error?.message || null });
    if (!exists) logWarning('table_missing', table);
  }
}

async function checkRoutines(userClient) {
  for (const routine of REQUIRED_ROUTINES) {
    const { error } = await userClient.rpc(routine, { _ping: true });
    const exists = !error || !String(error)?.includes('function');
    report.checks.routines.push({ routine, exists, error: error?.message || String(error) || null });
    if (!exists) logWarning('routine_missing', routine);
  }
}

async function createTestUsers(count) {
  const users = [];
  const createdAt = Date.now();

  for (let i = 0; i < count; i++) {
    const email = `test+launch-${createdAt}-${i}@trollcity.local`;
    const password = `TestPass!${createdAt}`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error || !data?.user) {
      logError('create_user', error?.message || 'Unknown error');
      continue;
    }

    users.push({ id: data.user.id, email, password });
  }

  if (!users.length) throw new Error('No test users created');
  logAction('create_users', { count: users.length });
  return users;
}

async function signInAsUser(email, password) {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await userClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new Error(error?.message || 'Failed to sign in test user');
  return userClient;
}

async function seedProfiles(users) {
  const { data: cols } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'user_profiles');

  const colSet = new Set((cols || []).map((c) => c.column_name));

  const updates = users.map((u, i) => {
    const payload = { id: u.id };
    if (colSet.has('username')) payload.username = `test_user_${i}`;
    if (colSet.has('troll_coins')) payload.troll_coins = 5_000_000;
    if (colSet.has('is_broadcaster')) payload.is_broadcaster = i < 2;
    return payload;
  });

  const { error } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (error) logError('seed_profiles', error.message);
  else logAction('seed_profiles', { count: updates.length });
}

async function createStreams(users) {
  const streamIds = [];
  const broadcasters = users.slice(0, 2);

  for (const u of broadcasters) {
    const { data, error } = await supabase
      .from('streams')
      .insert({ broadcaster_id: u.id, status: 'live', title: 'Test Stream' })
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

async function createBattle(streamIds) {
  if (streamIds.length < 2) return null;
  const { data, error } = await supabase
    .from('battles')
    .insert({
      challenger_stream_id: streamIds[0],
      opponent_stream_id: streamIds[1],
      status: 'active'
    })
    .select('id')
    .single();

  if (error) {
    logError('create_battle', error.message);
    return null;
  }

  logAction('create_battle', { battleId: data.id });
  return data.id;
}

async function sendChat(userClient, streamId, userId, content) {
  const { error } = await userClient.from('stream_messages').insert({
    stream_id: streamId,
    user_id: userId,
    content,
    type: 'chat'
  });
  if (error) throw error;
}

async function tryGiftRPC(userClient, payload) {
  const { data, error } = await userClient.rpc('send_gift_in_stream', payload);
  if (error && error.message?.includes('function')) return { ok: false, reason: error.message };
  if (error) return { ok: false, reason: error.message };
  return { ok: true, data };
}

async function tryPremiumGiftRPC(userClient, payload) {
  const { data, error } = await userClient.rpc('send_premium_gift', payload);
  if (error) return { ok: false, reason: error.message };
  return { ok: true, data };
}

async function runGiftTest(userClient, senderId, receiverId, streamId) {
  const { data: gift, error } = await userClient
    .from('gifts')
    .select('id, cost')
    .limit(1)
    .single();

  if (error || !gift) {
    logWarning('gift_test', 'No gifts available');
    return;
  }

  const result = await tryGiftRPC(userClient, {
    p_sender_id: senderId,
    p_receiver_id: receiverId,
    p_stream_id: streamId,
    p_gift_id: String(gift.id),
    p_quantity: 1
  });

  if (!result.ok) {
    const fallback = await tryPremiumGiftRPC(userClient, {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_stream_id: streamId,
      p_gift_id: String(gift.id),
      p_cost: Number(gift.cost || 100)
    });

    if (!fallback.ok) {
      logError('gift_test', fallback.reason || result.reason);
      return;
    }
  }

  logAction('gift_test', { senderId, receiverId, streamId });
}

async function runPurchaseSmokeTest(userClient) {
  // purchase_shop_item
  const { data: shopItem } = await userClient.from('shop_items').select('id, price').limit(1).maybeSingle();
  if (shopItem?.id) {
    const { error } = await userClient.rpc('purchase_item', {
      p_item_type: 'shop',
      p_item_id: String(shopItem.id),
      p_cost: Number(shopItem.price || 0)
    });
    if (error) logWarning('purchase_shop_item', error.message);
  } else {
    logWarning('purchase_shop_item', 'No shop_items found');
  }

  // purchase_vehicle
  const { data: car } = await userClient.from('vehicles_catalog').select('id').limit(1).maybeSingle();
  if (car?.id) {
    const { error } = await userClient.rpc('purchase_from_ktauto', { p_catalog_id: car.id, p_plate_type: 'temp' });
    if (error) logWarning('purchase_vehicle', error.message);
  } else {
    logWarning('purchase_vehicle', 'No vehicles_catalog found');
  }

  // buy_car_insurance
  const { data: insurance } = await userClient.from('insurance_options').select('id').limit(1).maybeSingle();
  if (insurance?.id) {
    const { data: ownedCar } = await userClient
      .from('user_vehicles')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await userClient.rpc('buy_car_insurance', {
      p_option_id: insurance.id,
      p_car_id: ownedCar?.id || null
    });
    if (error) logWarning('buy_car_insurance', error.message);
  } else {
    logWarning('buy_car_insurance', 'No insurance_options found');
  }

  // purchase_broadcast_theme
  const { data: theme } = await userClient.from('broadcast_themes').select('id, price, name').limit(1).maybeSingle();
  if (theme?.id) {
    const { error } = await userClient.rpc('purchase_broadcast_theme', {
      p_theme_id: theme.id,
      p_cost: Number(theme.price || 0),
      p_name: theme.name || 'Theme'
    });
    if (error) logWarning('purchase_broadcast_theme', error.message);
  }

  // purchase_entrance_effect
  const { data: effect } = await userClient.from('entrance_effects').select('id, price, name').limit(1).maybeSingle();
  if (effect?.id) {
    const { error } = await userClient.rpc('purchase_entrance_effect', {
      p_effect_id: effect.id,
      p_cost: Number(effect.price || 0),
      p_name: effect.name || 'Effect'
    });
    if (error) logWarning('purchase_entrance_effect', error.message);
  }
}

async function cleanup(users, streamIds, battleId) {
  const userIds = users.map((u) => u.id);

  const deleteByUser = async (table, column = 'user_id') => {
    const { error } = await supabase.from(table).delete().in(column, userIds);
    if (error) logWarning('cleanup', `${table}: ${error.message}`);
  };

  await deleteByUser('stream_messages', 'user_id');
  await deleteByUser('coin_ledger', 'user_id');
  await deleteByUser('coin_transactions', 'user_id');
  await deleteByUser('gift_ledger', 'sender_id');
  await deleteByUser('gift_ledger', 'receiver_id');
  await deleteByUser('gift_transactions', 'from_user_id');
  await deleteByUser('gift_transactions', 'to_user_id');
  await deleteByUser('user_vehicles', 'user_id');
  await deleteByUser('properties', 'owner_user_id');
  await deleteByUser('user_perks', 'user_id');
  await deleteByUser('user_insurances', 'user_id');
  await deleteByUser('user_call_sounds', 'user_id');
  await deleteByUser('user_entrance_effects', 'user_id');
  await deleteByUser('user_broadcast_theme_purchases', 'user_id');
  await deleteByUser('user_purchases', 'user_id');
  await deleteByUser('user_active_items', 'user_id');
  await deleteByUser('marketplace_items', 'seller_id');

  if (battleId) {
    const { error } = await supabase.from('battles').delete().eq('id', battleId);
    if (error) logWarning('cleanup', `battles: ${error.message}`);
  }

  if (streamIds.length) {
    const { error } = await supabase.from('streams').delete().in('id', streamIds);
    if (error) logWarning('cleanup', `streams: ${error.message}`);
  }

  for (const u of users) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) logWarning('cleanup', `auth.deleteUser: ${error.message}`);
  }

  report.cleanup.push({ usersDeleted: users.length, streamsDeleted: streamIds.length, battleDeleted: !!battleId });
}

async function main() {
  try {
    await checkTables();

    const users = await createTestUsers(4);
    await seedProfiles(users);

    const sender = users[0];
    const receiver = users[1];
    const viewerA = users[2];
    const viewerB = users[3];
    const senderClient = await signInAsUser(sender.email, sender.password);
    const receiverClient = await signInAsUser(receiver.email, receiver.password);
    const viewerAClient = await signInAsUser(viewerA.email, viewerA.password);
    const viewerBClient = await signInAsUser(viewerB.email, viewerB.password);

    await checkRoutines(senderClient);

    const streamIds = await createStreams(users);
    const battleId = await createBattle(streamIds);

    const chatTasks = [];
    const chatStreamId = streamIds[0];
    if (chatStreamId) {
      for (let i = 0; i < 20; i++) {
        const user = users[i % users.length];
        const client = user.id === sender.id ? senderClient : user.id === receiver.id ? receiverClient : user.id === viewerA.id ? viewerAClient : viewerBClient;
        chatTasks.push(sendChat(client, chatStreamId, user.id, `test message ${i}`));
      }
      await Promise.allSettled(chatTasks);
      logAction('chat_test', { messages: chatTasks.length });

      const { data: chatRead, error: chatReadError } = await receiverClient
        .from('stream_messages')
        .select('id')
        .eq('stream_id', chatStreamId)
        .limit(1);
      if (chatReadError || !chatRead?.length) {
        logWarning('chat_visibility', chatReadError?.message || 'Receiver could not see chat messages');
      } else {
        logAction('chat_visibility', { visible: true });
      }
    } else {
      logWarning('chat_test', 'No stream available');
    }

    if (streamIds.length >= 1) {
      const { data: beforeSender } = await senderClient.from('user_profiles').select('troll_coins').eq('id', sender.id).maybeSingle();
      const { data: beforeReceiver } = await senderClient.from('user_profiles').select('troll_coins').eq('id', receiver.id).maybeSingle();

      await runGiftTest(senderClient, sender.id, receiver.id, streamIds[0]);

      const { data: afterSender } = await senderClient.from('user_profiles').select('troll_coins').eq('id', sender.id).maybeSingle();
      const { data: afterReceiver } = await senderClient.from('user_profiles').select('troll_coins').eq('id', receiver.id).maybeSingle();

      if (beforeSender && afterSender && afterSender.troll_coins >= beforeSender.troll_coins) {
        logWarning('gift_balance', 'Sender balance did not decrease');
      }
      if (beforeReceiver && afterReceiver && afterReceiver.troll_coins <= beforeReceiver.troll_coins) {
        logWarning('gift_balance', 'Receiver balance did not increase');
      }
    }

    await runPurchaseSmokeTest(senderClient);
    await runPurchaseSmokeTest(receiverClient);
    await runPurchaseSmokeTest(viewerAClient);
    await runPurchaseSmokeTest(viewerBClient);

    if (battleId) {
      const { data } = await supabase.from('battles').select('score_challenger, score_opponent').eq('id', battleId).single();
      if (!data || (data.score_challenger === 0 && data.score_opponent === 0)) {
        logWarning('battle_gift_test', 'Battle scores did not change');
      } else {
        logAction('battle_gift_test', data);
      }
    }

    await cleanup(users, streamIds, battleId);

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
    console.log(`Light test complete. Report: ${REPORT_FILE}`);
  }
}

main();
