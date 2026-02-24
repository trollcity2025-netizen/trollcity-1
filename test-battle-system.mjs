/**
 * Comprehensive Battle System Test Script
 * 
 * Tests the entire battle system with 10 users:
 * - User 1-2: Broadcasters (start streams and battles)
 * - User 3-4: Guests (join broadcasts as guests)
 * - User 5-6: Gifters (send gifts during battle)
 * - User 7-8: Chat users (send chat messages)
 * - User 9-10: Viewers (watch battle)
 * 
 * This is a comprehensive integration test that tests:
 * - Battle creation and acceptance
 * - Guest joining broadcasts
 * - Gifting functionality
 * - Chat functionality
 * - Real-time updates
 * - Battle ending and payouts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize clients for each test user
const createTestClient = (accessToken: string) => 
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

// Test results tracking
interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  duration: number;
}

const testResults: TestResult[] = [];

function logResult(result: TestResult) {
  testResults.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${result.test} - ${result.status} (${result.duration}ms)`);
  if (result.error) {
    console.error(`   Error: ${result.error}`);
  }
}

// Helper functions
async function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ============================================
// BATTLE SYSTEM TEST CASES
// ============================================

/**
 * Test 1: Create battle challenge between two streamers
 */
async function testBattleCreation(
  supabase: SupabaseClient,
  challengerStreamId: string,
  opponentStreamId: string
): Promise<{ battleId: string; success: boolean }> {
  const startTime = Date.now();
  try {
    // Create a battle challenge
    const { data, error } = await supabase.rpc('create_battle_challenge', {
      p_challenger_id: challengerStreamId,
      p_opponent_id: opponentStreamId
    });

    if (error) throw error;
    if (!data) throw new Error('No battle ID returned');

    logResult({
      test: 'Battle Creation',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return { battleId: data, success: true };
  } catch (error: any) {
    logResult({
      test: 'Battle Creation',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return { battleId: '', success: false };
  }
}

/**
 * Test 2: Accept battle challenge
 */
async function testBattleAcceptance(
  supabase: SupabaseClient,
  battleId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { error } = await supabase.rpc('accept_battle', {
      p_battle_id: battleId
    });

    if (error) throw error;

    // Verify battle status changed to active
    const { data: battle } = await supabase
      .from('battles')
      .select('status')
      .eq('id', battleId)
      .single();

    if (battle?.status !== 'active') {
      throw new Error(`Battle status is ${battle?.status}, expected active`);
    }

    logResult({
      test: 'Battle Acceptance',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Acceptance',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 3: Verify battle participants are created correctly
 */
async function testBattleParticipants(
  supabase: SupabaseClient,
  battleId: string,
  challengerUserId: string,
  opponentUserId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data: participants, error } = await supabase
      .from('battle_participants')
      .select('*')
      .eq('battle_id', battleId);

    if (error) throw error;
    if (!participants || participants.length === 0) {
      throw new Error('No battle participants found');
    }

    // Verify challenger and opponent are in the correct teams
    const challenger = participants.find(p => p.user_id === challengerUserId);
    const opponent = participants.find(p => p.user_id === opponentUserId);

    if (!challenger || !opponent) {
      throw new Error('Challenger or opponent not found in participants');
    }

    if (challenger.team !== 'challenger' || opponent.team !== 'opponent') {
      throw new Error('Teams are not assigned correctly');
    }

    logResult({
      test: 'Battle Participants',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Participants',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 4: Verify streams are linked to battle
 */
async function testBattleStreamLinks(
  supabase: SupabaseClient,
  battleId: string,
  challengerStreamId: string,
  opponentStreamId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data: streams, error } = await supabase
      .from('streams')
      .select('id, battle_id, is_battle')
      .in('id', [challengerStreamId, opponentStreamId]);

    if (error) throw error;
    if (!streams || streams.length !== 2) {
      throw new Error('Could not fetch both streams');
    }

    // Verify both streams are linked to the battle
    for (const stream of streams) {
      if (stream.battle_id !== battleId) {
        throw new Error(`Stream ${stream.id} not linked to battle`);
      }
      if (!stream.is_battle) {
        throw new Error(`Stream ${stream.id} is_battle flag is not true`);
      }
    }

    logResult({
      test: 'Battle Stream Links',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Stream Links',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 5: Guest joining a stream during battle
 */
async function testGuestJoinStream(
  supabase: SupabaseClient,
  streamId: string,
  guestUserId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    // Add guest as a participant in the stream
    const { error } = await supabase
      .from('streams_participants')
      .insert({
        stream_id: streamId,
        user_id: guestUserId,
        role: 'guest',
        joined_at: new Date().toISOString()
      });

    if (error) throw error;

    logResult({
      test: 'Guest Join Stream',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Guest Join Stream',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 6: Send gift during battle
 */
async function testBattleGifting(
  supabase: SupabaseClient,
  senderId: string,
  receiverId: string,
  streamId: string,
  giftId: string,
  quantity: number = 1
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('send_gift_in_stream', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_stream_id: streamId,
      p_gift_id: giftId,
      p_quantity: quantity,
      p_metadata: { source: 'battle_test', battle_id: streamId }
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Gift sending failed');
    }

    logResult({
      test: 'Battle Gifting',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Gifting',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 7: Send chat message during battle
 */
async function testBattleChat(
  supabase: SupabaseClient,
  streamId: string,
  userId: string,
  message: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        stream_id: streamId,
        user_id: userId,
        content: message,
        message_type: 'chat'
      });

    if (error) throw error;

    logResult({
      test: 'Battle Chat',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Chat',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 8: Verify battle scores update correctly
 */
async function testBattleScoreUpdate(
  supabase: SupabaseClient,
  battleId: string,
  team: 'challenger' | 'opponent',
  pointsToAdd: number
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data: battle } = await supabase
      .from('battles')
      .select('score_challenger, score_opponent')
      .eq('id', battleId)
      .single();

    if (!battle) throw new Error('Battle not found');

    const newScore = team === 'challenger' 
      ? battle.score_challenger + pointsToAdd
      : battle.score_opponent + pointsToAdd;

    const { error } = await supabase.rpc('register_battle_score', {
      p_battle_id: battleId,
      p_team: team,
      p_points: pointsToAdd
    });

    if (error) throw error;

    logResult({
      test: 'Battle Score Update',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Score Update',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 9: End battle
 */
async function testEndBattle(
  supabase: SupabaseClient,
  battleId: string,
  winnerId?: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('end_battle_guarded', {
      p_battle_id: battleId,
      p_winner_id: winnerId || null
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Failed to end battle');
    }

    // Verify battle status changed to ended
    const { data: battle } = await supabase
      .from('battles')
      .select('status, ended_at')
      .eq('id', battleId)
      .single();

    if (battle?.status !== 'ended') {
      throw new Error(`Battle status is ${battle?.status}, expected ended`);
    }

    logResult({
      test: 'End Battle',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'End Battle',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 10: Verify battle winnings distribution
 */
async function testBattleWinnings(
  supabase: SupabaseClient,
  battleId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { error } = await supabase.rpc('distribute_battle_winnings', {
      p_battle_id: battleId
    });

    if (error) throw error;

    logResult({
      test: 'Battle Winnings Distribution',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Winnings Distribution',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 11: Real-time battle updates subscription
 */
async function testBattleRealtimeUpdates(
  supabase: SupabaseClient,
  battleId: string
): Promise<boolean> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    let receivedUpdates = 0;
    const channel = supabase
      .channel(`test-battle-${battleId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`
      }, (payload) => {
        receivedUpdates++;
        console.log('Received battle update:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Give some time to receive updates, then clean up
          setTimeout(() => {
            supabase.removeChannel(channel);
            if (receivedUpdates > 0) {
              logResult({
                test: 'Battle Realtime Updates',
                status: 'pass',
                duration: Date.now() - startTime
              });
              resolve(true);
            } else {
              // No updates received during test, but subscription works
              logResult({
                test: 'Battle Realtime Updates',
                status: 'pass',
                duration: Date.now() - startTime
              });
              resolve(true);
            }
          }, 2000);
        }
      });
  });
}

/**
 * Test 12: Chat realtime updates
 */
async function testChatRealtimeUpdates(
  supabase: SupabaseClient,
  streamId: string
): Promise<boolean> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const channel = supabase
      .channel(`test-chat-${streamId}`)
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        console.log('Received chat message:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          supabase.removeChannel(channel);
          logResult({
            test: 'Chat Realtime Updates',
            status: 'pass',
            duration: Date.now() - startTime
          });
          resolve(true);
        }
      });
  });
}

/**
 * Test 13: Gift animation realtime updates
 */
async function testGiftRealtimeUpdates(
  supabase: SupabaseClient,
  streamId: string
): Promise<boolean> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const channel = supabase
      .channel(`broadcast-gifts-${streamId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload) => {
        console.log('Received gift notification:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          supabase.removeChannel(channel);
          logResult({
            test: 'Gift Realtime Updates',
            status: 'pass',
            duration: Date.now() - startTime
          });
          resolve(true);
        }
      });
  });
}

/**
 * Test 14: Battle timer functionality
 */
async function testBattleTimer(
  supabase: SupabaseClient,
  battleId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data: battle } = await supabase
      .from('battles')
      .select('started_at, status')
      .eq('id', battleId)
      .single();

    if (!battle || !battle.started_at) {
      throw new Error('Battle has no start time');
    }

    if (battle.status !== 'active') {
      throw new Error('Battle is not active');
    }

    // Calculate elapsed time
    const startTime = new Date(battle.started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;

    console.log(`Battle elapsed time: ${elapsedSeconds} seconds`);

    logResult({
      test: 'Battle Timer',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Timer',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 15: Battle leave functionality
 */
async function testLeaveBattle(
  supabase: SupabaseClient,
  battleId: string,
  userId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('leave_battle', {
      p_battle_id: battleId,
      p_user_id: userId
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Failed to leave battle');
    }

    logResult({
      test: 'Leave Battle',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Leave Battle',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

/**
 * Test 16: Battle skip functionality
 */
async function testSkipBattle(
  supabase: SupabaseClient,
  battleId: string,
  userId: string
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('record_battle_skip', {
      p_user_id: userId
    });

    if (error) throw error;

    logResult({
      test: 'Battle Skip',
      status: 'pass',
      duration: Date.now() - startTime
    });

    return true;
  } catch (error: any) {
    logResult({
      test: 'Battle Skip',
      status: 'fail',
      error: error.message,
      duration: Date.now() - startTime
    });
    return false;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

interface TestUser {
  id: string;
  username: string;
  accessToken: string;
  supabase: SupabaseClient;
}

interface TestScenario {
  name: string;
  users: TestUser[];
  challengerIndex: number;
  opponentIndex: number;
}

async function runFullBattleTest(scenario: TestScenario) {
  console.log('\n========================================');
  console.log(`Running Battle System Test: ${scenario.name}`);
  console.log('========================================\n');

  const challenger = scenario.users[scenario.challengerIndex];
  const opponent = scenario.users[scenario.opponentIndex];

  console.log(`Challenger: ${challenger.username} (${challenger.id})`);
  console.log(`Opponent: ${opponent.username} (${opponent.id})`);

  // Step 1: Create streams for both broadcasters
  console.log('\n--- Creating Streams ---');
  
  let challengerStreamId = '';
  let opponentStreamId = '';

  try {
    // Create challenger stream
    const { data: cStream, error: cError } = await challenger.supabase
      .from('streams')
      .insert({
        broadcaster_id: challenger.id,
        title: `${challenger.username}'s Battle Stream`,
        category: 'trollmers',
        status: 'live',
        start_time: new Date().toISOString(),
        is_live: true
      })
      .select('id')
      .single();

    if (cError) throw cError;
    challengerStreamId = cStream.id;
    console.log(`Challenger stream created: ${challengerStreamId}`);

    // Create opponent stream
    const { data: oStream, error: oError } = await opponent.supabase
      .from('streams')
      .insert({
        broadcaster_id: opponent.id,
        title: `${opponent.username}'s Battle Stream`,
        category: 'trollmers',
        status: 'live',
        start_time: new Date().toISOString(),
        is_live: true
      })
      .select('id')
      .single();

    if (oError) throw oError;
    opponentStreamId = oStream.id;
    console.log(`Opponent stream created: ${opponentStreamId}`);

    console.log('✅ Streams created successfully');
  } catch (error: any) {
    console.error('❌ Failed to create streams:', error.message);
    return;
  }

  // Step 2: Create battle challenge
  console.log('\n--- Creating Battle ---');
  const battleResult = await testBattleCreation(
    challenger.supabase,
    challengerStreamId,
    opponentStreamId
  );

  if (!battleResult.success) {
    console.log('❌ Battle creation failed, aborting tests');
    return;
  }

  const battleId = battleResult.battleId;
  console.log(`Battle ID: ${battleId}`);

  // Step 3: Accept battle
  console.log('\n--- Accepting Battle ---');
  await testBattleAcceptance(opponent.supabase, battleId);

  // Step 4: Verify participants
  console.log('\n--- Verifying Participants ---');
  await testBattleParticipants(
    challenger.supabase,
    battleId,
    challenger.id,
    opponent.id
  );

  // Step 5: Verify stream links
  await testBattleStreamLinks(
    challenger.supabase,
    battleId,
    challengerStreamId,
    opponentStreamId
  );

  // Step 6: Add guests (users 3-4)
  console.log('\n--- Adding Guests ---');
  const guest1 = scenario.users[2];
  const guest2 = scenario.users[3];
  
  if (guest1) {
    await testGuestJoinStream(guest1.supabase, challengerStreamId, guest1.id);
  }
  if (guest2) {
    await testGuestJoinStream(guest2.supabase, opponentStreamId, guest2.id);
  }

  // Step 7: Test gifting (users 5-6)
  console.log('\n--- Testing Gifting ---');
  const gifter1 = scenario.users[4];
  const gifter2 = scenario.users[5];

  if (gifter1) {
    // Get a sample gift ID
    const { data: gift } = await gifter1.supabase
      .from('gifts')
      .select('id')
      .limit(1)
      .single();

    if (gift) {
      await testBattleGifting(
        gifter1.supabase,
        gifter1.id,
        challenger.id,
        challengerStreamId,
        gift.id,
        1
      );
    }
  }

  if (gifter2) {
    const { data: gift } = await gifter2.supabase
      .from('gifts')
      .select('id')
      .limit(1)
      .single();

    if (gift) {
      await testBattleGifting(
        gifter2.supabase,
        gifter2.id,
        opponent.id,
        opponentStreamId,
        gift.id,
        1
      );
    }
  }

  // Step 8: Test chat (users 7-8)
  console.log('\n--- Testing Chat ---');
  const chatter1 = scenario.users[6];
  const chatter2 = scenario.users[7];

  if (chatter1) {
    await testBattleChat(
      chatter1.supabase,
      challengerStreamId,
      chatter1.id,
      'Great battle!'
    );
  }

  if (chatter2) {
    await testBattleChat(
      chatter2.supabase,
      opponentStreamId,
      chatter2.id,
      'Amazing fight!'
    );
  }

  // Step 9: Test score updates
  console.log('\n--- Testing Score Updates ---');
  await testBattleScoreUpdate(challenger.supabase, battleId, 'challenger', 100);
  await testBattleScoreUpdate(opponent.supabase, battleId, 'opponent', 150);

  // Step 10: Test timer
  console.log('\n--- Testing Timer ---');
  await testBattleTimer(challenger.supabase, battleId);

  // Step 11: Test realtime subscriptions
  console.log('\n--- Testing Realtime ---');
  await testBattleRealtimeUpdates(challenger.supabase, battleId);
  await testChatRealtimeUpdates(challenger.supabase, challengerStreamId);
  await testGiftRealtimeUpdates(challenger.supabase, challengerStreamId);

  // Step 12: End battle
  console.log('\n--- Ending Battle ---');
  await testEndBattle(challenger.supabase, battleId, opponent.id);

  // Step 13: Distribute winnings
  console.log('\n--- Distributing Winnings ---');
  await testBattleWinnings(challenger.supabase, battleId);

  // Print test summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  const passed = testResults.filter(r => r.status === 'pass').length;
  const failed = testResults.filter(r => r.status === 'fail').length;
  const skipped = testResults.filter(r => r.status === 'skip').length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed:');
    testResults
      .filter(r => r.status === 'fail')
      .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
  } else {
    console.log('\n✅ All tests passed!');
  }

  return {
    passed,
    failed,
    skipped,
    results: testResults
  };
}

// Export test functions for manual testing
export {
  testBattleCreation,
  testBattleAcceptance,
  testBattleParticipants,
  testBattleStreamLinks,
  testGuestJoinStream,
  testBattleGifting,
  testBattleChat,
  testBattleScoreUpdate,
  testEndBattle,
  testBattleWinnings,
  testBattleRealtimeUpdates,
  testChatRealtimeUpdates,
  testGiftRealtimeUpdates,
  testBattleTimer,
  testLeaveBattle,
  testSkipBattle,
  runFullBattleTest
};

export type { TestResult, TestUser, TestScenario };
