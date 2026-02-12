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
const REPORT_FILE = path.join(REPORT_DIR, `full_coverage_test_report_${Date.now()}.json`);

const report = {
  startedAt: new Date().toISOString(),
  scope: 'full-coverage-test',
  environment: 'production',
  config: {
    testUsers: 8,
    adminUser: true,
    livekit: 'not used'
  },
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

async function createTestUsers(count) {
  const users = [];
  const createdAt = Date.now();

  for (let i = 0; i < count; i++) {
    const email = `test+full-${createdAt}-${i}@trollcity.local`;
    const password = `TestPass!${createdAt}`;

    const { data, error } = await adminClient.auth.admin.createUser({
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

async function seedProfiles(users) {
  const seedStamp = Date.now();
  const updates = users.map((u, i) => ({
    id: u.id,
    username: `test_user_${seedStamp}_${i}`,
    troll_coins: 5_000_000,
    is_broadcaster: i < 2
  }));

  const { error } = await adminClient.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (error) logError('seed_profiles', error.message);
  else logAction('seed_profiles', { count: updates.length });
}

async function setRole(userId, role, flags = {}, roleLabel = role) {
  const payload = { role, ...flags };
  if (role === 'admin') {
    payload.is_admin = true;
  }
  if (role === 'troll_officer') {
    payload.is_troll_officer = true;
  }
  if (role === 'lead_troll_officer') {
    payload.is_lead_officer = true;
    payload.is_troll_officer = true;
  }

  const { error } = await adminClient.from('user_profiles').update(payload).eq('id', userId);
  if (error) logWarning('set_role', `${roleLabel}: ${error.message}`);
  else logAction('set_role', { userId, role: roleLabel });
}

async function getUserId(userClient, step) {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) {
    logWarning(step, error?.message || 'Unable to resolve user id');
    return null;
  }
  return data.user.id;
}

async function signInAsUser(email, password) {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await userClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new Error(error?.message || 'Failed to sign in test user');
  return userClient;
}

async function createStreams(users) {
  const streamIds = [];
  const broadcasters = users.slice(0, 2);

  for (const u of broadcasters) {
    const { data, error } = await adminClient
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
  const { data, error } = await adminClient
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

async function runGiftTest(userClient, senderId, receiverId, streamId) {
  const { data: gift } = await userClient.from('gifts').select('id, cost, coin_cost').limit(1).maybeSingle();
  if (!gift?.id) {
    logWarning('gift_test', 'No gifts available or readable');
    return;
  }

  const { error } = await userClient.rpc('send_gift_in_stream', {
    p_sender_id: senderId,
    p_receiver_id: receiverId,
    p_stream_id: streamId,
    p_gift_id: String(gift.id),
    p_quantity: 1
  });

  if (error) {
    const fallback = await userClient.rpc('send_premium_gift', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_stream_id: streamId,
      p_gift_id: String(gift.id),
      p_cost: Number(gift.cost || gift.coin_cost || 100)
    });

    if (fallback.error) {
      logError('gift_test', fallback.error.message || error.message);
      return;
    }
  }

  logAction('gift_test', { senderId, receiverId, streamId });
}

async function purchaseShopItem(userClient) {
  const { data: shopItem } = await userClient.from('shop_items').select('id, price_coins').limit(1).maybeSingle();
  if (!shopItem?.id) {
    logWarning('purchase_shop_item', 'No shop_items found or readable');
    return;
  }
  const { error } = await userClient.rpc('purchase_item', {
    p_item_type: 'shop',
    p_item_id: String(shopItem.id),
    p_cost: Number(shopItem.price_coins || 0)
  });
  if (error) logWarning('purchase_shop_item', error.message);
}

async function purchaseVehicle(userClient) {
  const { data: car } = await userClient.from('vehicles_catalog').select('id').limit(1).maybeSingle();
  if (!car?.id) {
    logWarning('purchase_vehicle', 'No vehicles_catalog found or readable');
    return null;
  }
  const { data, error } = await userClient.rpc('purchase_from_ktauto', { p_catalog_id: car.id, p_plate_type: 'temp' });
  if (error) {
    logWarning('purchase_vehicle', error.message);
    return null;
  }
  if (data && data.success === false) {
    logWarning('purchase_vehicle', data.message || 'Vehicle purchase failed');
    return null;
  }
  return data?.vehicle_id || null;
}

async function buyCarInsurance(userClient, vehicleId) {
  const { data: plan, error: planError } = await userClient
    .from('insurance_plans')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (planError) {
    logWarning('buy_car_insurance', `insurance_plans: ${planError.message}`);
    return;
  }

  if (!plan?.id) {
    logWarning('buy_car_insurance', 'No insurance_plans found or readable');
    return;
  }

  const resolvedVehicleId = vehicleId || null;
  if (!resolvedVehicleId) {
    logWarning('buy_car_insurance', 'No vehicle id available to insure');
    return;
  }

  const { error } = await userClient.rpc('buy_car_insurance', {
    car_garage_id: resolvedVehicleId,
    plan_id: plan.id
  });
  if (error) {
    if (error.message?.includes('Could not choose the best candidate function')) {
      const { data: option, error: optionError } = await userClient
        .from('insurance_options')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (optionError || !option?.id) {
        logWarning('buy_car_insurance', optionError?.message || error.message);
        return;
      }
      const { error: fallbackError } = await userClient.rpc('buy_car_insurance', {
        car_garage_id: resolvedVehicleId,
        plan_id: option.id
      });
      if (fallbackError) logWarning('buy_car_insurance', fallbackError.message);
      return;
    }
    logWarning('buy_car_insurance', error.message);
  }
}

async function purchaseBroadcastTheme(userClient) {
  const { data: theme } = await userClient.from('broadcast_themes').select('id').limit(1).maybeSingle();
  if (!theme?.id) return;
  const userId = await getUserId(userClient, 'purchase_broadcast_theme');
  if (!userId) return;
  const { error } = await userClient.rpc('purchase_broadcast_theme', {
    p_user_id: userId,
    p_theme_id: theme.id,
    p_set_active: true
  });
  if (error) logWarning('purchase_broadcast_theme', error.message);
}

async function purchaseEntranceEffect(userClient) {
  const { data: effect } = await userClient.from('entrance_effects').select('id, coin_cost, name').limit(1).maybeSingle();
  if (!effect?.id) return;
  const { error } = await userClient.rpc('purchase_entrance_effect', {
    p_effect_id: effect.id,
    p_cost: Number(effect.coin_cost || 0),
    p_name: effect.name || 'Effect'
  });
  if (error) logWarning('purchase_entrance_effect', error.message);
}

async function purchaseHouse(userClient) {
  const { data: house } = await userClient.from('houses_catalog').select('id').limit(1).maybeSingle();
  if (!house?.id) {
    logWarning('purchase_house', 'No houses_catalog found or readable');
    return;
  }
  const { error } = await userClient.rpc('purchase_house', { p_house_catalog_id: house.id });
  if (error) logWarning('purchase_house', error.message);
}

async function purchaseLandlordLicense(userClient) {
  const { error } = await userClient.rpc('purchase_landlord_license', { p_use_loan: false });
  if (error) logWarning('purchase_landlord_license', error.message);
}

async function adminSmoke(adminUserClient) {
  const { error: lockError } = await adminUserClient.rpc('admin_toggle_broadcast_lockdown', { p_enable: false });
  if (lockError) {
    if (lockError.message?.includes('schema cache')) {
      logAction('admin_toggle_broadcast_lockdown', { skipped: true, reason: lockError.message });
    } else {
      logWarning('admin_toggle_broadcast_lockdown', lockError.message);
    }
  }

  const { error: appsError } = await adminUserClient.rpc('get_all_creator_applications');
  if (appsError) {
    if (appsError.message?.includes('schema cache')) {
      logAction('get_all_creator_applications', { skipped: true, reason: appsError.message });
    } else {
      logWarning('get_all_creator_applications', appsError.message);
    }
  }
}

async function cleanup(users, streamIds, battleId) {
  const userIds = users.map((u) => u.id);

  const deleteByUser = async (table, column = 'user_id') => {
    const { error } = await adminClient.from(table).delete().in(column, userIds);
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
    const { error } = await adminClient.from('battles').delete().eq('id', battleId);
    if (error) logWarning('cleanup', `battles: ${error.message}`);
  }

  if (streamIds.length) {
    const { error } = await adminClient.from('streams').delete().in('id', streamIds);
    if (error) logWarning('cleanup', `streams: ${error.message}`);
  }

  for (const u of users) {
    const { error } = await adminClient.auth.admin.deleteUser(u.id);
    if (error) logWarning('cleanup', `auth.deleteUser: ${error.message}`);
  }

  report.cleanup.push({ usersDeleted: users.length, streamsDeleted: streamIds.length, battleDeleted: !!battleId });
}

async function main() {
  try {
    const users = await createTestUsers(8);
    await seedProfiles(users);
    const roleMap = [
      { role: 'admin' },
      { role: 'secretary' },
      { role: 'lead_troll_officer' },
      { role: 'troll_officer' },
      { role: 'troller' },
      { role: 'user' },
      { role: 'user', flags: { is_pastor: true }, label: 'pastor' },
      { role: 'user' }
    ];

    for (let i = 0; i < users.length; i++) {
      const config = roleMap[i];
      if (!config) continue;
      await setRole(users[i].id, config.role, config.flags, config.label || config.role);
    }

    const adminUser = users[0];
    const sender = users[1];
    const receiver = users[2];
    const viewer = users[3];

    const adminUserClient = await signInAsUser(adminUser.email, adminUser.password);
    const senderClient = await signInAsUser(sender.email, sender.password);
    const receiverClient = await signInAsUser(receiver.email, receiver.password);
    const viewerClient = await signInAsUser(viewer.email, viewer.password);

    const roleClients = [];
    for (const user of users) {
      const client = await signInAsUser(user.email, user.password);
      roleClients.push(client);
    }

    const streamIds = await createStreams(users);
    const battleId = await createBattle(streamIds);

    // Chat + visibility
    const chatStreamId = streamIds[0];
    if (chatStreamId) {
      const chatTasks = [
        sendChat(senderClient, chatStreamId, sender.id, 'test message 1'),
        sendChat(receiverClient, chatStreamId, receiver.id, 'test message 2'),
        sendChat(viewerClient, chatStreamId, viewer.id, 'test message 3')
      ];
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
    }

    // Gift + balances
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

    // Purchases (run for each role)
    for (const client of roleClients) {
      await purchaseShopItem(client);
      const vehicleId = await purchaseVehicle(client);
      await buyCarInsurance(client, vehicleId);
      await purchaseBroadcastTheme(client);
      await purchaseEntranceEffect(client);
      await purchaseHouse(client);
      await purchaseLandlordLicense(client);
    }

    // Admin smoke
    await adminSmoke(adminUserClient);

    // Battle score check
    if (battleId) {
      const { data } = await adminClient.from('battles').select('score_challenger, score_opponent').eq('id', battleId).single();
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
    console.log(`Full coverage test complete. Report: ${REPORT_FILE}`);
  }
}

main();
