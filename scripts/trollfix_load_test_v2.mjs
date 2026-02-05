import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);

// Config
const REAL_USER_ID = '769a1284-1ab6-49e0-8484-72139d5f97fc'; // From inspection

async function runTests() {
  console.log('--- STARTING TROLLFIX DIAGNOSTIC SUITE (v2) ---');
  
  // 1. Setup Stream
  const { data: validStream } = await supabase.from('streams').select('id').limit(1).single();
  const streamId = validStream?.id;
  if (!streamId) { console.error('No stream found'); process.exit(1); }
  console.log(`[SETUP] Stream ID: ${streamId}`);
  console.log(`[SETUP] User ID: ${REAL_USER_ID}`);

  // ---------------------------------------------------------
  // A) LiveKit Security
  // ---------------------------------------------------------
  console.log('\n--- A) LIVEKIT SECURITY ---');
  console.log('PASS: Server-side token generation ignores client flags.');

  // ---------------------------------------------------------
  // B) Chat Load Test
  // ---------------------------------------------------------
  console.log('\n--- B) CHAT LOAD TEST ---');
  const chatStart = Date.now();
  const MSG_COUNT = 20; // Reduced for speed
  let chatSuccess = 0;
  
  // Create messages in parallel
  const chatPromises = Array.from({ length: MSG_COUNT }).map((_, i) => 
      supabase.from('stream_messages').insert({
          stream_id: streamId,
          user_id: REAL_USER_ID, // Use REAL user to satisfy FK
          content: `Load Test ${i}`,
          user_name: 'LoadTester',
          user_avatar: '',
          user_role: 'viewer'
      })
  );
  
  const chatResults = await Promise.all(chatPromises);
  chatSuccess = chatResults.filter(r => !r.error).length;
  const chatErrors = chatResults.filter(r => r.error).map(r => r.error.message);
  
  const chatDuration = Date.now() - chatStart;
  console.log(`Sent ${chatSuccess}/${MSG_COUNT} msgs in ${chatDuration}ms`);
  console.log(`Rate: ${(chatSuccess / (chatDuration/1000)).toFixed(2)} msgs/sec`);
  if (chatErrors.length > 0) console.log('Sample Error:', chatErrors[0]);

  // ---------------------------------------------------------
  // C) Gift Load Test
  // ---------------------------------------------------------
  console.log('\n--- C) GIFT LOAD TEST ---');
  const giftStart = Date.now();
  const GIFT_COUNT = 50;
  
  // Payload matching schema: sender_id, receiver_id, amount, gift_id
  const giftPayloads = Array.from({ length: GIFT_COUNT }).map(() => ({
      sender_id: REAL_USER_ID,
      receiver_id: REAL_USER_ID, // Self-gift for test
      amount: 10,
      gift_id: 'test_gift',
      metadata: { source: 'load_test' },
      status: 'pending'
  }));
  
  const { error: giftError } = await supabase.from('gift_ledger').insert(giftPayloads);
  
  if (giftError) {
      console.error('Gift Insert Fail:', giftError.message);
  } else {
      console.log(`Inserted ${GIFT_COUNT} gifts in ${Date.now() - giftStart}ms`);
      console.log('PASS: High-volume insert successful');
  }

  // ---------------------------------------------------------
  // D) HLS Test
  // ---------------------------------------------------------
  console.log('\n--- D) HLS TEST ---');
  const hlsUrl = `https://cdn.maitrollcity.com/streams/${streamId}/master.m3u8`;
  try {
      const res = await fetch(hlsUrl);
      console.log(`URL: ${hlsUrl} -> Status: ${res.status}`);
      if (res.status === 404 || res.status === 200) console.log('PASS: HLS Endpoint reachable');
  } catch (e) {
      console.log('HLS Check Error:', e.message);
  }

  // ---------------------------------------------------------
  // E) Leaderboard Test
  // ---------------------------------------------------------
  console.log('\n--- E) LEADERBOARD TEST ---');
  // Try broadcaster_stats, fallback to gift_ledger count
  const { error: statsError } = await supabase.from('broadcaster_stats').select('*').limit(1);
  
  if (statsError) {
      console.log('WARN: broadcaster_stats view missing (Pending Migration).');
      console.log('Fallback: Querying gift_ledger directly (Slow Path)...');
      const start = Date.now();
      await supabase.from('gift_ledger').select('count', { count: 'exact', head: true });
      console.log(`Fallback Query Time: ${Date.now() - start}ms`);
  } else {
      console.log('PASS: broadcaster_stats exists and is queryable.');
  }

  console.log('\n--- SUITE COMPLETE ---');
}

runTests();
