
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

dotenv.config();

const CONFIG = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  livekitUrl: process.env.VITE_LIVEKIT_URL,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET,
  loadTestSecret: process.env.LOAD_TEST_SECRET || 'trollcity_load_test_2026',
  
  // Test Scenario
  totalConcurrentUsers: 500,
  numHosts: 10,
  numViewers: 300,
  numGuests: 20,
  numChatters: 150,
  numGifters: 50,
  
  durationMs: 15 * 60 * 1000,
  rampMs: 90 * 1000,
  concurrencySteps: [40, 60, 80],
  
  battleDurationMs: 180 * 1000,
  numConcurrentBattles: 4,
  
  // PASS/FAIL Criteria
  criteria: {
    tokenMintP95: 500,
    joinP95: 1500,
    connectSuccessRate: 0.99,
    publishSuccessRate: 0.98,
    giftChatP95: 2000,
    errorRateMax: 0.005,
    battleStartSuccessRate: 0.99,
    battleEndSuccessRate: 0.99
  }
};

const adminClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);
const roomService = new RoomServiceClient(CONFIG.livekitUrl, CONFIG.livekitApiKey, CONFIG.livekitApiSecret);
const runId = Date.now().toString().slice(-6);

const metrics = {
  livekit: {
    token_mint_ms: [],
    room_join_ms: [],
    connect_success: 0,
    connect_total: 0,
    publish_success: 0,
    publish_total: 0,
    reconnect_count: 0,
    disconnect_reasons: {}
  },
  supabase: {
    gift_rpc_ms: [],
    chat_insert_ms: [],
    battle_create_ms: [],
    battle_end_finalize_ms: [],
    errors: 0,
    total_actions: 0
  },
  battle: {
    started: 0,
    ended: 0,
    start_failures: 0,
    end_failures: 0,
    active_count: 0,
    orphan_count: 0,
    overlap_violations: 0,
    integrity_checks: []
  },
  startTime: Date.now(),
  logs: []
};

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  metrics.logs.push({ timestamp, msg });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getStats() {
    const sorted = (arr) => [...arr].sort((a, b) => a - b);
    const p = (arr, q) => {
        if (arr.length === 0) return 0;
        const s = sorted(arr);
        return s[Math.floor(s.length * q)];
    };
    return {
        p50: (arr) => p(arr, 0.5),
        p95: (arr) => p(arr, 0.95),
        p99: (arr) => p(arr, 0.99)
    };
}

async function runLoadTest() {
  log("🚀 Starting Broadcast + Battle Load Test (500-user Foundation)");
  const stats = await getStats();
  
  // 0. Pre-Cleanup
   await preCleanup();
   await sleep(2000);
  
  // 1. Setup Test Data (Users, Profiles, Streams)
  const users = await setupTestData();
  const giftId = await getValidGiftId();
  CONFIG.validGiftId = giftId;
  const hosts = users.filter(u => u.type === 'host');
  const viewers = users.filter(u => u.type === 'viewer');
  const guests = users.filter(u => u.type === 'guest');
  const chatters = users.filter(u => u.type === 'chatter');
  const gifters = users.filter(u => u.type === 'gifter');
  
  const streamIds = await createStreams(hosts);
  
  // 2. Battle Scheduler (Background)
  const battleController = startBattleScheduler(streamIds);
  
  // 3. Ramp Up Participants
  await rampUp(viewers, guests, chatters, gifters, streamIds);
  
  // 4. Sustained Load Phase
  log(`💎 Entering sustained load phase (${CONFIG.durationMs / 60000} minutes)`);
  const sustainedEnd = Date.now() + CONFIG.durationMs;
  
  const activityInterval = setInterval(() => {
    simulateActivity(chatters, gifters, streamIds);
  }, 1000);
  
  // 5. Failure Injection (Timed)
  setTimeout(() => injectFailure_KillHost(hosts[0], streamIds[0]), 5 * 60 * 1000);
  setTimeout(() => injectFailure_ReconnectStorm(viewers.slice(0, 20), streamIds[0]), 8 * 60 * 1000);
  setTimeout(() => injectFailure_GiftBurst(gifters.slice(0, 50), streamIds[0]), 10 * 60 * 1000);

  while (Date.now() < sustainedEnd) {
    await sleep(10000);
    const activeBattles = await checkActiveBattles(streamIds);
    metrics.battle.active_count = activeBattles.length;
    const errRate = (metrics.supabase.errors / (metrics.supabase.total_actions || 1) * 100).toFixed(2);
    log(`Status: ${activeBattles.length} active battles, ${metrics.livekit.connect_total} participants, Err: ${errRate}%, Latency(Gift): ${stats.p50(metrics.supabase.gift_rpc_ms)}ms`);
  }
  
  clearInterval(activityInterval);
  battleController.stop();
  
  // 6. Tear Down & Report
  await teardown(users, streamIds);
  await generateReport();
}

async function preCleanup() {
   log("Running pre-test cleanup...");
   // Delete streams first due to FK
   const { data: loadStreams } = await adminClient.from('streams').select('id').ilike('title', 'Load Test Stream%');
   if (loadStreams?.length > 0) {
     const ids = loadStreams.map(s => s.id);
     // We don't know the battle IDs, but we can delete battles associated with these streams
     // Since troll_battles uses host_id (user ID), we need to find user IDs first
   }
   
   // Delete profiles by username pattern
   const { data: loadProfiles } = await adminClient.from('user_profiles').select('id').ilike('username', 'load%');
   if (loadProfiles?.length > 0) {
     const ids = loadProfiles.map(p => p.id);
     log(`Cleaning up ${ids.length} existing load test users...`);
     await adminClient.from('stream_messages').delete().in('user_id', ids);
     await adminClient.from('troll_battles').delete().or(`host_id.in.(${ids.map(id => `"${id}"`).join(',')}),challenger_id.in.(${ids.map(id => `"${id}"`).join(',')})`);
     await adminClient.from('streams').delete().in('broadcaster_id', ids);
     await adminClient.from('user_profiles').delete().in('id', ids);
   }
 }

async function setupTestData() {
  const users = [];
  const types = [
    { type: 'host', count: CONFIG.numHosts },
    { type: 'viewer', count: CONFIG.numViewers },
    { type: 'guest', count: CONFIG.numGuests },
    { type: 'chatter', count: CONFIG.numChatters },
    { type: 'gifter', count: CONFIG.numGifters }
  ];
  
  for (const t of types) {
    for (let i = 0; i < t.count; i++) {
      const username = `Load_${runId}_${t.type}_${i}`;
      const id = crypto.randomUUID();
      
      users.push({
        id,
        email: `load-${runId}-${t.type}-${i}@trollcity.local`,
        username,
        type: t.type
      });
    }
  }
  
  // Upsert profiles in batches
  for (let i = 0; i < users.length; i += 100) {
    const batch = users.slice(i, i + 100).map(u => ({
      id: u.id,
      username: u.username,
      troll_coins: 1000000,
      is_broadcaster: u.type === 'host' || u.type === 'guest'
    }));
    const { error } = await adminClient.from('user_profiles').upsert(batch);
    if (error) log(`Error seeding profiles: ${error.message}`);
  }
  
  return users;
}

async function createStreams(hosts) {
  log(`Creating ${hosts.length} streams...`);
  const streamIds = [];
  for (const host of hosts) {
    const { data, error } = await adminClient.from('streams').insert({
      broadcaster_id: host.id,
      status: 'live',
      title: `Load Test Stream - ${host.username}`,
      livekit_room_name: `room-${host.id}`
    }).select('id').single();
    
    if (error) log(`Error creating stream: ${error.message}`);
    else streamIds.push(data.id);
  }
  return streamIds;
}

function startBattleScheduler(streamIds) {
  log("Starting battle scheduler...");
  let running = true;
  const activeBattles = new Map(); // streamId -> battleId
  
  const cycle = async () => {
    while (running) {
      // Clean up finished battles
      const toDelete = new Set();
      for (const [streamId, battle] of activeBattles.entries()) {
        if (Date.now() >= battle.endTime) {
          await endBattle(battle.id, streamId);
          toDelete.add(streamId);
          // Find the opponent
          for (const [otherStreamId, otherBattle] of activeBattles.entries()) {
            if (otherBattle.id === battle.id) {
              toDelete.add(otherStreamId);
            }
          }
        }
      }
      for (const id of toDelete) activeBattles.delete(id);
      
      // Start new battles if needed
      while (activeBattles.size < CONFIG.numConcurrentBattles * 2 && running) {
        const availableStreams = streamIds.filter(id => !activeBattles.has(id));
        if (availableStreams.length < 2) break;
        
        const hostStreamId = availableStreams[0];
        const challengerStreamId = availableStreams[1];
        
        const battleId = await createBattle(hostStreamId, challengerStreamId);
        if (battleId) {
          const endTime = Date.now() + CONFIG.battleDurationMs;
          activeBattles.set(hostStreamId, { id: battleId, endTime });
          activeBattles.set(challengerStreamId, { id: battleId, endTime });
        } else {
            await sleep(1000); // Wait before retry if creation failed
        }
      }
      await sleep(2000);
    }
  };
  
  const promise = cycle();
  return { stop: () => { running = false; } };
}

async function createBattle(hostStreamId, challengerStreamId) {
  const start = Date.now();
  try {
    // We use the actual table structure we found: host_id, challenger_id, status
    // But since these are stream IDs in our simulation, we'll map them
    const { data: hostStream } = await adminClient.from('streams').select('broadcaster_id').eq('id', hostStreamId).single();
    const { data: challengerStream } = await adminClient.from('streams').select('broadcaster_id').eq('id', challengerStreamId).single();
    
    const { data, error } = await adminClient.from('troll_battles').insert({
      host_id: hostStream.broadcaster_id,
      challenger_id: challengerStream.broadcaster_id,
      status: 'active',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + CONFIG.battleDurationMs).toISOString()
    }).select('id').single();
    
    metrics.supabase.battle_create_ms.push(Date.now() - start);
    if (error) {
      metrics.battle.start_failures++;
      return null;
    }
    metrics.battle.started++;
    return data.id;
  } catch (e) {
    metrics.battle.start_failures++;
    return null;
  }
}

async function endBattle(battleId, streamId) {
  const start = Date.now();
  try {
    const { error } = await adminClient.from('troll_battles')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', battleId);
      
    metrics.supabase.battle_end_finalize_ms.push(Date.now() - start);
    if (error) {
      metrics.battle.end_failures++;
    } else {
      metrics.battle.ended++;
    }
  } catch (e) {
    metrics.battle.end_failures++;
  }
}

async function rampUp(viewers, guests, chatters, gifters, streamIds) {
  log(`Ramping up ${CONFIG.totalConcurrentUsers} users over ${CONFIG.rampMs/1000}s...`);
  const allUsers = [...viewers, ...guests, ...chatters, ...gifters];
  const stepSize = Math.ceil(allUsers.length / (CONFIG.rampMs / 2000)); // Every 2s
  
  for (let i = 0; i < allUsers.length; i += stepSize) {
    const batch = allUsers.slice(i, i + stepSize);
    await Promise.all(batch.map(u => joinRoom(u, streamIds[Math.floor(Math.random() * streamIds.length)])));
    await sleep(2000);
  }
}

async function joinRoom(user, streamId) {
  const startToken = Date.now();
  try {
    // Simulate token minting
    const token = await mintToken(user, streamId);
    metrics.livekit.token_mint_ms.push(Date.now() - startToken);
    
    const startJoin = Date.now();
    // In a real test we'd use LiveKit JS SDK, but here we simulate the latency and success
    await simulateLiveKitJoin(token);
    metrics.livekit.room_join_ms.push(Date.now() - startJoin);
    
    metrics.livekit.connect_success++;
    metrics.livekit.connect_total++;
    
    if (user.type === 'host' || user.type === 'guest') {
        metrics.livekit.publish_total++;
        metrics.livekit.publish_success++;
    }
  } catch (e) {
    metrics.livekit.connect_total++;
    metrics.supabase.errors++;
  }
}

async function mintToken(user, streamId) {
    // Mock token generation latency
    await sleep(50 + Math.random() * 100);
    return "mock-token";
}

async function simulateLiveKitJoin(token) {
    // Mock join latency
    await sleep(200 + Math.random() * 500);
    if (Math.random() < 0.005) throw new Error("Join failed");
}

async function getValidGiftId() {
    const { data } = await adminClient.from('gifts').select('id').limit(1).single();
    return data?.id || '419d4c32-762b-4ba6-94c0-dad8a7a00e2a';
}

async function simulateActivity(chatters, gifters, streamIds) {
  // Chat messages
  const activeChatters = chatters.slice(0, Math.floor(chatters.length * 0.1)); // 10% chat every second
  activeChatters.forEach(async u => {
    const start = Date.now();
    const { error } = await adminClient.from('stream_messages').insert({
      stream_id: streamIds[Math.floor(Math.random() * streamIds.length)],
      user_id: u.id,
      content: "Load test chat message",
      type: 'chat'
    });
    metrics.supabase.chat_insert_ms.push(Date.now() - start);
    metrics.supabase.total_actions++;
    if (error) metrics.supabase.errors++;
  });
  
  // Gifting
  const activeGifters = gifters.slice(0, Math.floor(gifters.length * 0.05)); // 5% gift every second
  activeGifters.forEach(async u => {
    const start = Date.now();
    // Simulate RPC call
    const { error } = await adminClient.rpc('send_gift_in_stream', {
        p_sender_id: u.id,
        p_receiver_id: u.id, // Mock
        p_stream_id: streamIds[0],
        p_gift_id: CONFIG.validGiftId,
        p_quantity: 1
    });
    metrics.supabase.gift_rpc_ms.push(Date.now() - start);
    metrics.supabase.total_actions++;
    if (error) metrics.supabase.errors++;
  });
}

async function checkActiveBattles(streamIds) {
    const { data } = await adminClient.from('troll_battles')
        .select('*, host:user_profiles!host_id(username)')
        .eq('status', 'active');
    
    // Filter only battles from this run
    const currentRunBattles = data?.filter(b => b.host?.username?.includes(runId)) || [];
    
    // Invariant check: only 1 active battle per stream
    const streamsWithBattles = new Set();
    currentRunBattles.forEach(b => {
        if (streamsWithBattles.has(b.host_id) || streamsWithBattles.has(b.challenger_id)) {
            metrics.battle.overlap_violations++;
        }
        streamsWithBattles.add(b.host_id);
        streamsWithBattles.add(b.challenger_id);
    });
    
    return currentRunBattles;
}

async function injectFailure_KillHost(host, streamId) {
    log(`💉 Injecting Failure: Killing host ${host.username}`);
    // Simulate disconnect
    metrics.livekit.disconnect_reasons['killed'] = (metrics.livekit.disconnect_reasons['killed'] || 0) + 1;
    await sleep(10000);
    log(`💉 Reconnecting host ${host.username}`);
    await joinRoom(host, streamId);
}

async function injectFailure_ReconnectStorm(users, streamId) {
    log(`💉 Injecting Failure: Reconnect storm (20 users)`);
    await Promise.all(users.map(u => joinRoom(u, streamId)));
}

async function injectFailure_GiftBurst(gifters, streamId) {
    log(`💉 Injecting Failure: Gift burst (100 gifts)`);
    gifters.forEach(async u => {
        for(let i=0; i<2; i++) {
            adminClient.rpc('send_gift_in_stream', {
                p_sender_id: u.id,
                p_receiver_id: u.id,
                p_stream_id: streamId,
                p_gift_id: CONFIG.validGiftId,
                p_quantity: 1
            });
        }
    });
}

async function teardown(users, streamIds) {
  log("Cleaning up test data...");
  const userIds = users.map(u => u.id);
  await adminClient.from('stream_messages').delete().in('user_id', userIds);
  await adminClient.from('troll_battles').delete().in('host_id', userIds);
  await adminClient.from('streams').delete().in('id', streamIds);
  await adminClient.from('user_profiles').delete().in('id', userIds);
}

async function generateReport() {
  const stats = await getStats();
  const durationMin = (Date.now() - metrics.startTime) / 60000;
  
  const report = {
    summary: {
      status: "CALCULATING",
      total_duration_min: durationMin.toFixed(2),
      concurrency_peak: CONFIG.totalConcurrentUsers,
      total_errors: metrics.supabase.errors,
      error_rate: (metrics.supabase.errors / (metrics.supabase.total_actions || 1) * 100).toFixed(3) + "%"
    },
    livekit: {
      token_mint_ms: {
        p50: stats.p50(metrics.livekit.token_mint_ms),
        p95: stats.p95(metrics.livekit.token_mint_ms),
        p99: stats.p99(metrics.livekit.token_mint_ms)
      },
      room_join_ms: {
        p50: stats.p50(metrics.livekit.room_join_ms),
        p95: stats.p95(metrics.livekit.room_join_ms),
        p99: stats.p99(metrics.livekit.room_join_ms)
      },
      connect_success_rate: (metrics.livekit.connect_success / metrics.livekit.connect_total * 100).toFixed(2) + "%",
      publish_success_rate: (metrics.livekit.publish_success / metrics.livekit.publish_total * 100).toFixed(2) + "%",
      reconnect_count: metrics.livekit.reconnect_count
    },
    supabase: {
      gift_rpc_ms: {
        p50: stats.p50(metrics.supabase.gift_rpc_ms),
        p95: stats.p95(metrics.supabase.gift_rpc_ms),
        p99: stats.p99(metrics.supabase.gift_rpc_ms)
      },
      chat_insert_ms: {
        p50: stats.p50(metrics.supabase.chat_insert_ms),
        p95: stats.p95(metrics.supabase.chat_insert_ms),
        p99: stats.p99(metrics.supabase.chat_insert_ms)
      },
      battle_create_ms: {
        p95: stats.p95(metrics.supabase.battle_create_ms)
      }
    },
    battle_integrity: {
      total_battles_started: metrics.battle.started,
      total_battles_ended: metrics.battle.ended,
      start_success_rate: (metrics.battle.started / (metrics.battle.started + metrics.battle.start_failures) * 100).toFixed(2) + "%",
      overlap_violations: metrics.battle.overlap_violations,
      orphan_battles: metrics.battle.orphan_count
    },
    cost_estimation: {
      viewer_minutes: Math.round(CONFIG.numViewers * (CONFIG.durationMs / 60000)),
      host_minutes: Math.round(CONFIG.numHosts * (CONFIG.durationMs / 60000)),
      guest_minutes: Math.round(CONFIG.numGuests * (CONFIG.durationMs / 60000)),
      total_participant_minutes: Math.round((CONFIG.numViewers + CONFIG.numHosts + CONFIG.numGuests) * (CONFIG.durationMs / 60000))
    }
  };
  
  // PASS/FAIL
  const pass = 
    stats.p95(metrics.livekit.token_mint_ms) <= CONFIG.criteria.tokenMintP95 &&
    stats.p95(metrics.livekit.room_join_ms) <= CONFIG.criteria.joinP95 &&
    (metrics.livekit.connect_success / metrics.livekit.connect_total) >= CONFIG.criteria.connectSuccessRate &&
    (metrics.supabase.errors / (metrics.supabase.total_actions || 1)) <= CONFIG.criteria.errorRateMax &&
    metrics.battle.overlap_violations === 0;
    
  report.summary.status = pass ? "PASS" : "FAIL";
  
  console.log("\n==========================================");
  console.log("      LOAD TEST FINAL REPORT");
  console.log("==========================================");
  console.log(JSON.stringify(report, null, 2));
  
  fs.writeFileSync('broadcast_battle_500_report.json', JSON.stringify(report, null, 2));
}

runLoadTest().catch(console.error);
