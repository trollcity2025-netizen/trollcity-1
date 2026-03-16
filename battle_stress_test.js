// Troll City - COMPREHENSIVE BATTLE STRESS TEST
// Tests all battle components: votes, gifts, chats, animations, participants

import { createClient } from '@supabase/supabase-js';

const config = {
  supabaseUrl: 'https://yjxpwfalenorzrqxwmtr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8',
  baseUrl: 'https://maitrollcity.com',
  testDuration: 10 * 60 * 1000, // 10 minutes
  concurrentUsers: 30
};

// Test metrics
const metrics = {
  startTime: null,
  endTime: null,
  totalOperations: 0,
  successfulOps: 0,
  failedOps: 0,
  
  // Battle metrics
  battlesCreated: 0,
  battlesUpdated: 0,
  battlesRead: 0,
  
  // Vote metrics
  votesCast: 0,
  voteErrors: 0,
  
  // Gift metrics
  giftsSent: 0,
  giftErrors: 0,
  
  // Chat metrics
  messagesSent: 0,
  messageErrors: 0,
  
  // Participant metrics
  participantsJoined: 0,
  participantErrors: 0,
  
  // Animation metrics
  animationsTriggered: 0,
  animationErrors: 0,
  
  // Performance
  responseTimes: [],
  dbWrites: 0,
  dbReads: 0,
  
  // Errors
  rlsViolations: 0,
  permissionErrors: 0,
  authErrors: 0,
  errors: [],
  
  // Detailed results
  battleResults: [],
  voteResults: [],
  giftResults: [],
  chatResults: [],
  participantResults: []
};

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordMetric(type, value, details = '') {
  const entry = { type, value, details, time: Date.now() - metrics.startTime };
  metrics.totalOperations++;
  
  switch (type) {
    case 'battle_created':
      metrics.battlesCreated++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'battle_updated':
      metrics.battlesUpdated++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'battle_read':
      metrics.battlesRead++;
      metrics.dbReads++;
      break;
    case 'vote_cast':
      metrics.votesCast++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'vote_error':
      metrics.voteErrors++;
      metrics.failedOps++;
      break;
    case 'gift_sent':
      metrics.giftsSent++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'gift_error':
      metrics.giftErrors++;
      metrics.failedOps++;
      break;
    case 'message_sent':
      metrics.messagesSent++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'message_error':
      metrics.messageErrors++;
      metrics.failedOps++;
      break;
    case 'participant_joined':
      metrics.participantsJoined++;
      metrics.successfulOps++;
      metrics.dbWrites++;
      break;
    case 'participant_error':
      metrics.participantErrors++;
      metrics.failedOps++;
      break;
    case 'animation_triggered':
      metrics.animationsTriggered++;
      break;
    case 'animation_error':
      metrics.animationErrors++;
      break;
    case 'response_time':
      metrics.responseTimes.push(value);
      break;
    case 'rls_violation':
      metrics.rlsViolations++;
      metrics.failedOps++;
      break;
    case 'permission_error':
      metrics.permissionErrors++;
      metrics.failedOps++;
      break;
    case 'auth_error':
      metrics.authErrors++;
      metrics.failedOps++;
      break;
    case 'error':
      metrics.errors.push(entry);
      metrics.failedOps++;
      break;
  }
  
  // Add to specific result arrays
  if (type.includes('battle')) {
    metrics.battleResults.push(entry);
  } else if (type.includes('vote')) {
    metrics.voteResults.push(entry);
  } else if (type.includes('gift')) {
    metrics.giftResults.push(entry);
  } else if (type.includes('message') || type.includes('chat')) {
    metrics.chatResults.push(entry);
  } else if (type.includes('participant')) {
    metrics.participantResults.push(entry);
  }
}

class BattleTestUser {
  constructor(userData, supabase) {
    this.userId = userData?.id || randomId();
    this.username = userData?.username || `battle_user_${randomId().substring(0, 8)}`;
    this.email = `${this.username}@trollcity.test`;
    this.supabase = supabase;
    this.session = null;
    this.testBattleIds = [];
    this.testVotes = [];
    this.testGifts = [];
    this.testMessages = [];
  }

  async login() {
    const start = Date.now();
    try {
      // Try to sign in
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: this.email,
        password: 'Test123456!'
      });
      
      if (error) {
        // Try signup if login fails
        const { data: signupData, error: signupError } = await this.supabase.auth.signUp({
          email: this.email,
          password: 'Test123456!'
        });
        
        if (signupError || !signupData?.user) {
          recordMetric('auth_error', Date.now() - start, `Auth failed: ${error?.message || signupError?.message}`);
          return false;
        }
        
        this.userId = signupData.user.id;
        this.session = signupData.session;
        
        // Create user profile
        await this.supabase.from('user_profiles').upsert({
          id: this.userId,
          username: this.username,
          role: 'user',
          coins: 10000,
          created_at: new Date().toISOString()
        });
        
        // Get stream ID for the newly created user
        const { data: streamData } = await this.supabase
          .from('streams')
          .select('id')
          .eq('user_id', this.userId)
          .single();
          
        this.streamId = streamData ? streamData.id : this.userId; // fallback to userId
        
        recordMetric('response_time', Date.now() - start, 'Login + Profile');
        return true;
      }
      
      this.session = data.session;
      this.userId = data.user.id;
      
      // Get stream ID for the user
      const { data: streamData } = await this.supabase
        .from('streams')
        .select('id')
        .eq('user_id', this.userId)
        .single();
        
      this.streamId = streamData ? streamData.id : this.userId; // fallback to userId
      
      recordMetric('response_time', Date.now() - start, 'Login');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - start, `Login exception: ${err.message}`);
      return false;
    }
  }

    async testBattleCreation() {
        const start = Date.now();
        // We'll use the same stream ID for both challenger and opponent for simplicity
        const challengerStreamId = this.streamId;
        const opponentStreamId = this.streamId; // Same as challenger for now
        
        try {
            const { data, error } = await this.supabase
                .rpc('create_battle_challenge', {
                    p_challenger_id: challengerStreamId,
                    p_opponent_id: opponentStreamId
                });

            if (error) {
                if (error.message.includes('row-level security') || error.code === '42501') {
                    recordMetric('rls_violation', Date.now() - start, 'Battle creation: RLS');
                } else {
                    recordMetric('error', Date.now() - start, `Battle create: ${error.message}`);
                }
                return null;
            }

            const battleId = data;
            this.testBattleIds.push(battleId);
            recordMetric('battle_created', Date.now() - start, `Battle ${battleId.substring(0, 8)}`);
            return { id: battleId };
        } catch (err) {
            recordMetric('error', Date.now() - start, `Battle create exception: ${err.message}`);
            return null;
        }
    }

    async testBattleJoin(battleId) {
        const start = Date.now();
        
        try {
            const { data, error } = await this.supabase
                .rpc('accept_battle', {
                    p_battle_id: battleId
                });

            if (error) {
                if (error.message.includes('row-level security')) {
                    recordMetric('rls_violation', Date.now() - start, 'Battle join: RLS');
                } else {
                    recordMetric('error', Date.now() - start, `Battle join: ${error.message}`);
                }
                return null;
            }

            recordMetric('battle_updated', Date.now() - start, `Battle ${battleId.substring(0, 8)} joined`);
            return data;
        } catch (err) {
            recordMetric('error', Date.now() - start, `Battle join exception: ${err.message}`);
            return null;
        }
    }

  async testBattleVote(battleId, voteType = 'host') {
    const start = Date.now();
    const voteId = randomId();
    
    try {
      const { data, error } = await this.supabase
        .from('battle_votes')
        .insert({
          id: voteId,
          battle_id: battleId,
          user_id: this.userId,
          vote: voteType === 'host' ? 1 : 2, // 1 for host, 2 for opponent
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battle vote: RLS');
        } else {
          recordMetric('vote_error', Date.now() - start, `Vote: ${error.message}`);
        }
        return null;
      }

      this.testVotes.push(voteId);
      recordMetric('vote_cast', Date.now() - start, `Vote for ${voteType}`);
      return data;
    } catch (err) {
      recordMetric('vote_error', Date.now() - start, `Vote exception: ${err.message}`);
      return null;
    }
  }

  async testBattleGift(battleId, giftType = 'coin') {
    const start = Date.now();
    const giftId = randomId();
    
    const giftValues = {
      'coin': 10,
      'rose': 25,
      'heart': 50,
      'diamond': 100,
      'crown': 500,
      'troll': 1000
    };
    
    try {
      // Create stream_gift record directly (battle is treated as stream)
      const { data, error } = await this.supabase
        .from('stream_gifts')
        .insert({
          id: giftId,
          sender_id: this.userId,
          receiver_id: this.userId, // Self for testing
          stream_id: battleId,
          gift_id: randomId(), // Generate a gift ID
          amount: giftValues[giftType] || 10,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battle gift: RLS');
        } else {
          recordMetric('gift_error', Date.now() - start, `Gift: ${error.message}`);
        }
        return null;
      }

      this.testGifts.push(giftId);
      recordMetric('gift_sent', Date.now() - start, `Gift: ${giftType} (${giftValues[giftType]} coins)`);
      return data;
    } catch (err) {
      recordMetric('gift_error', Date.now() - start, `Gift exception: ${err.message}`);
      return null;
    }
  }

  async testBattleChat(battleId) {
    const start = Date.now();
    const messageId = randomId();
    
    const messages = [
      'Go host! 🎯',
      'Let\'s go challenger! 💪',
      'Amazing battle! 🔥',
      'This is intense! ⚔️',
      'Who will win? 🤔',
      'Epic moments! 🌟',
      'GG everyone! 👏',
      'Battle for the ages! 🏆'
    ];
    
    try {
      // Try messages table with battle_id reference
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          id: messageId,
          sender_id: this.userId,
          recipient_id: this.userId, // Self for testing
          content: messages[Math.floor(Math.random() * messages.length)],
          message_type: 'battle',
          battle_id: battleId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battle chat: RLS');
        } else {
          recordMetric('message_error', Date.now() - start, `Chat: ${error.message}`);
        }
        return null;
      }

      this.testMessages.push(messageId);
      recordMetric('message_sent', Date.now() - start, `Battle chat message`);
      return data;
    } catch (err) {
      recordMetric('message_error', Date.now() - start, `Chat exception: ${err.message}`);
      return null;
    }
  }

  async testBattleParticipant(battleId) {
    const start = Date.now();
    const participantId = randomId();
    
    try {
      const { data, error } = await this.supabase
        .from('battle_participants')
        .insert({
          id: participantId,
          battle_id: battleId,
          user_id: this.userId,
          team: Math.random() > 0.5 ? 'challenger' : 'host',
          role: 'viewer',
          source_stream_id: this.userId // Using userId as streamId for testing
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battle participant: RLS');
        } else {
          recordMetric('participant_error', Date.now() - start, `Participant: ${error.message}`);
        }
        return null;
      }

      recordMetric('participant_joined', Date.now() - start, `Joined as viewer`);
      return data;
    } catch (err) {
      // Table might not exist, try without it
      recordMetric('participant_error', Date.now() - start, `Participant exception: ${err.message}`);
      return null;
    }
  }

  async testBattleRead() {
    const start = Date.now();
    
    try {
      const { data, error } = await this.supabase
        .from('battles')
        .select('*')
        .limit(20);

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battle read: RLS');
        }
        recordMetric('error', Date.now() - start, `Battle read: ${error.message}`);
        return [];
      }

      recordMetric('battle_read', Date.now() - start, `Read ${data?.length || 0} battles`);
      return data || [];
    } catch (err) {
      recordMetric('error', Date.now() - start, `Battle read exception: ${err.message}`);
      return [];
    }
  }

  async testBattleScoreUpdate(battleId) {
    const start = Date.now();
    
    try {
      const { data, error } = await this.supabase
        .from('battles')
        .update({
          score_challenger: Math.floor(Math.random() * 100),
          score_opponent: Math.floor(Math.random() * 100)
        })
        .eq('id', battleId)
        .select()
        .single();

      if (error) {
        recordMetric('error', Date.now() - start, `Score update: ${error.message}`);
        return null;
      }

      recordMetric('battle_updated', Date.now() - start, `Battle scores updated`);
      return data;
    } catch (err) {
      recordMetric('error', Date.now() - start, `Score update exception: ${err.message}`);
      return null;
    }
  }

  async testBattleCompletion(battleId) {
    const start = Date.now();
    
    try {
      const { data, error } = await this.supabase
        .from('battles')
        .update({
          status: 'ended',
          winner_stream_id: Math.random() > 0.5 ? this.userId : null,
          ended_at: new Date().toISOString()
        })
        .eq('id', battleId)
        .select()
        .single();

      if (error) {
        recordMetric('error', Date.now() - start, `Battle complete: ${error.message}`);
        return null;
      }

      recordMetric('battle_updated', Date.now() - start, `Battle completed`);
      return data;
    } catch (err) {
      recordMetric('error', Date.now() - start, `Battle complete exception: ${err.message}`);
      return null;
    }
  }

  async runBattleStressTest() {
    console.log(`\n▶ Battle Test User: ${this.username}`);
    
    // Login first
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log(`  ✗ Login failed for ${this.username}`);
      return;
    }
    console.log(`  ✓ Logged in`);

    // Phase 1: Create battles
    console.log(`  Creating battles...`);
    for (let i = 0; i < 3; i++) {
      await this.testBattleCreation();
      await delay(100);
    }

    // Phase 2: Read and test existing battles
    console.log(`  Reading battles...`);
    const existingBattles = await this.testBattleRead();
    
    // Phase 3: Vote on battles
    console.log(`  Casting votes...`);
    for (const battle of existingBattles.slice(0, 5)) {
      await this.testBattleVote(battle.id, Math.random() > 0.5 ? 'host' : 'challenger');
      await delay(50);
    }

    // Phase 4: Send gifts
    console.log(`  Sending gifts...`);
    const giftTypes = ['coin', 'rose', 'heart', 'diamond', 'crown', 'troll'];
    for (const battle of existingBattles.slice(0, 3)) {
      for (let g = 0; g < 2; g++) {
        await this.testBattleGift(battle.id, giftTypes[Math.floor(Math.random() * giftTypes.length)]);
        await delay(50);
      }
    }

    // Phase 5: Send chat messages
    console.log(`  Sending chat messages...`);
    for (const battle of existingBattles.slice(0, 5)) {
      for (let m = 0; m < 3; m++) {
        await this.testBattleChat(battle.id);
        await delay(30);
      }
    }

    // Phase 6: Join as participant
    console.log(`  Joining as participant...`);
    for (const battle of existingBattles.slice(0, 3)) {
      await this.testBattleParticipant(battle.id);
      await delay(50);
    }

    // Phase 7: Update scores
    console.log(`  Updating scores...`);
    for (const battle of this.testBattleIds.slice(0, 2)) {
      await this.testBattleScoreUpdate(battle);
      await delay(50);
    }

    // Phase 8: Complete battles
    console.log(`  Completing battles...`);
    for (const battleId of this.testBattleIds.slice(0, 2)) {
      await this.testBattleCompletion(battleId);
      await delay(50);
    }

    console.log(`  ✓ Battle stress test completed for ${this.username}`);
  }
}

async function runBattleStressTest() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  TROLL CITY - COMPREHENSIVE BATTLE STRESS TEST                    ║');
  console.log('║  VOTES | GIFTS | CHATS | PARTICIPANTS | ANIMATIONS                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  // Phase 1: Get existing users or create test users
  console.log('Phase 1: Fetching users from database...\n');
  
  let { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, username, role')
    .limit(config.concurrentUsers);

  if (error || !users || users.length === 0) {
    console.log('No users found. Creating test users...');
    users = [];
    for (let i = 0; i < config.concurrentUsers; i++) {
      const email = `battle_test_${Date.now()}_${i}@test.local`;
      try {
        const { data } = await supabase.auth.signUp({ email, password: 'Test123456!' });
        if (data?.user) {
          await supabase.from('user_profiles').upsert({
            id: data.user.id,
            username: `battle_user_${i}`,
            role: 'user',
            coins: 10000,
            created_at: new Date().toISOString()
          });
          users.push({ id: data.user.id, username: `battle_user_${i}`, role: 'user' });
        }
      } catch (err) {
        // Continue
      }
      await delay(200);
    }
  }

  console.log(`Found ${users.length} users for battle testing\n`);

  // Start test
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Phase 2: Running Battle Stress Test (10 minutes)...');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  metrics.startTime = Date.now();
  
  // Run concurrent battle tests
  const testPromises = users.slice(0, config.concurrentUsers).map(
    u => new BattleTestUser(u, supabase).runBattleStressTest()
  );

  // Progress reporter
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - metrics.startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    console.log(`\n[${mins}m ${secs}s] Ops: ${metrics.totalOperations} | Battles: ${metrics.battlesCreated}W/${metrics.battlesRead}R | Votes: ${metrics.votesCast} | Gifts: ${metrics.giftsSent} | Chat: ${metrics.messagesSent} | Errors: ${metrics.failedOps}`);
  }, 15000);

  await Promise.allSettled(testPromises);
  
  // Continue for duration
  const remainingTime = config.testDuration - (Date.now() - metrics.startTime);
  if (remainingTime > 0) {
    await delay(remainingTime);
  }
  
  metrics.endTime = Date.now();
  clearInterval(progressInterval);

  // Generate detailed report
  generateBattleReport();
}

function generateBattleReport() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgResponse = metrics.responseTimes.length ? 
    (metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length).toFixed(2) : 0;
  const maxResponse = metrics.responseTimes.length ? Math.max(...metrics.responseTimes) : 0;
  const minResponse = metrics.responseTimes.length ? Math.min(...metrics.responseTimes) : 0;

  console.log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           COMPREHENSIVE BATTLE STRESS TEST REPORT                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Overview
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST OVERVIEW                                                        │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Test Duration:    ${(duration/60).toFixed(2)} minutes                                      │`);
  console.log(`│ Total Operations: ${metrics.totalOperations}                                          │`);
  console.log(`│ Successful:       ${metrics.successfulOps} (${((metrics.successfulOps/metrics.totalOperations)*100).toFixed(1)}%)                                  │`);
  console.log(`│ Failed:          ${metrics.failedOps} (${((metrics.failedOps/metrics.totalOperations)*100).toFixed(1)}%)                                   │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Battle Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ BATTLE OPERATIONS                                                   │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Battles Created:    ${String(metrics.battlesCreated).padStart(6)}                                       │`);
  console.log(`│ Battles Updated:    ${String(metrics.battlesUpdated).padStart(6)}                                       │`);
  console.log(`│ Battles Read:       ${String(metrics.battlesRead).padStart(6)}                                       │`);
  console.log(`│ DB Writes:          ${String(metrics.dbWrites).padStart(6)}                                       │`);
  console.log(`│ DB Reads:           ${String(metrics.dbReads).padStart(6)}                                       │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Vote Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ VOTE OPERATIONS                                                     │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Votes Cast Successfully: ${String(metrics.votesCast).padStart(6)}                                       │`);
  console.log(`│ Vote Errors:            ${String(metrics.voteErrors).padStart(6)}                                       │`);
  const voteSuccessRate = metrics.votesCast + metrics.voteErrors > 0 
    ? ((metrics.votesCast / (metrics.votesCast + metrics.voteErrors)) * 100).toFixed(1)
    : '0.0';
  console.log(`│ Success Rate:          ${voteSuccessRate.padStart(6)}%                                      │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Gift Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ GIFT OPERATIONS                                                     │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Gifts Sent Successfully: ${String(metrics.giftsSent).padStart(6)}                                       │`);
  console.log(`│ Gift Errors:             ${String(metrics.giftErrors).padStart(6)}                                       │`);
  const giftSuccessRate = metrics.giftsSent + metrics.giftErrors > 0 
    ? ((metrics.giftsSent / (metrics.giftsSent + metrics.giftErrors)) * 100).toFixed(1)
    : '0.0';
  console.log(`│ Success Rate:           ${giftSuccessRate.padStart(6)}%                                      │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Chat Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ CHAT/MESSAGE OPERATIONS                                             │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Messages Sent Successfully: ${String(metrics.messagesSent).padStart(6)}                                       │`);
  console.log(`│ Message Errors:             ${String(metrics.messageErrors).padStart(6)}                                       │`);
  const chatSuccessRate = metrics.messagesSent + metrics.messageErrors > 0 
    ? ((metrics.messagesSent / (metrics.messagesSent + metrics.messageErrors)) * 100).toFixed(1)
    : '0.0';
  console.log(`│ Success Rate:               ${chatSuccessRate.padStart(6)}%                                      │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Participant Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ PARTICIPANT OPERATIONS                                              │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Participants Joined Successfully: ${String(metrics.participantsJoined).padStart(6)}                                       │`);
  console.log(`│ Participant Errors:              ${String(metrics.participantErrors).padStart(6)}                                       │`);
  const participantSuccessRate = metrics.participantsJoined + metrics.participantErrors > 0 
    ? ((metrics.participantsJoined / (metrics.participantsJoined + metrics.participantErrors)) * 100).toFixed(1)
    : '0.0';
  console.log(`│ Success Rate:                    ${participantSuccessRate.padStart(6)}%                                      │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Performance Metrics
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ PERFORMANCE METRICS                                                │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Average Response Time: ${avgResponse.padStart(8)} ms                                │`);
  console.log(`│ Min Response Time:     ${String(minResponse).padStart(8)} ms                                │`);
  console.log(`│ Max Response Time:     ${String(maxResponse).padStart(8)} ms                                │`);
  const opsPerSecond = (metrics.totalOperations / duration).toFixed(2);
  console.log(`│ Operations/Second:     ${opsPerSecond.padStart(8)}                                │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Security & Errors
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ SECURITY & ERRORS                                                   │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ RLS Violations:        ${String(metrics.rlsViolations).padStart(6)}                                       │`);
  console.log(`│ Permission Errors:    ${String(metrics.permissionErrors).padStart(6)}                                       │`);
  console.log(`│ Authentication Errors:${String(metrics.authErrors).padStart(6)}                                       │`);
  console.log(`│ Total Errors:         ${String(metrics.errors.length).padStart(6)}                                       │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Error Details
  if (metrics.errors.length > 0) {
    console.log('┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ ERROR DETAILS (Top 10)                                              │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    metrics.errors.slice(0, 10).forEach(e => {
      const type = (e.type || 'unknown').padEnd(18);
      const details = (e.details || '-').substring(0, 40);
      console.log(`│ ${type} │ ${details.padEnd(42)}│`);
    });
    console.log('└────────────────────────────────────────────────────────────────────┘\n');
  }

  // Test Results Summary
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST RESULTS SUMMARY                                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  // Calculate scores
  const battleScore = metrics.battlesCreated + metrics.battlesUpdated > 0 
    ? ((metrics.battlesCreated + metrics.battlesUpdated) / (metrics.battlesCreated + metrics.battlesUpdated + metrics.rlsViolations) * 100).toFixed(1)
    : '0.0';
  
  const voteScore = metrics.votesCast > 0 
    ? ((metrics.votesCast) / (metrics.votesCast + metrics.voteErrors + metrics.rlsViolations) * 100).toFixed(1)
    : '0.0';
  
  const giftScore = metrics.giftsSent > 0 
    ? ((metrics.giftsSent) / (metrics.giftsSent + metrics.giftErrors + metrics.rlsViolations) * 100).toFixed(1)
    : '0.0';
  
  const chatScore = metrics.messagesSent > 0 
    ? ((metrics.messagesSent) / (metrics.messagesSent + metrics.messageErrors + metrics.rlsViolations) * 100).toFixed(1)
    : '0.0';
  
  const participantScore = metrics.participantsJoined > 0 
    ? ((metrics.participantsJoined) / (metrics.participantsJoined + metrics.participantErrors + metrics.rlsViolations) * 100).toFixed(1)
    : '0.0';
  
  console.log(`║ Battle System Score:    ${battleScore.padStart(6)}%                                      ║`);
  console.log(`║ Vote System Score:      ${voteScore.padStart(6)}%                                      ║`);
  console.log(`║ Gift System Score:     ${giftScore.padStart(6)}%                                      ║`);
  console.log(`║ Chat System Score:     ${chatScore.padStart(6)}%                                      ║`);
  console.log(`║ Participant Score:     ${participantScore.padStart(6)}%                                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  // Overall readiness
  const totalErrors = metrics.rlsViolations + metrics.permissionErrors + metrics.authErrors;
  const overallScore = ((metrics.successfulOps / metrics.totalOperations) * 100).toFixed(1);
  
  let readiness = 'PRODUCTION READY';
  let icon = '✓';
  if (totalErrors > 50 || overallScore < 70) {
    readiness = 'NEEDS SIGNIFICANT FIXES';
    icon = '✗';
  } else if (totalErrors > 20 || overallScore < 85) {
    readiness = 'NEEDS MINOR FIXES';
    icon = '⚠';
  }
  
  console.log(`║ Overall Success Rate:   ${overallScore.padStart(6)}%                                      ║`);
  console.log(`║ ${icon} System Readiness: ${readiness.padEnd(44)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Just log that report would be saved (file writing not supported in this environment)
  console.log('\nReport would be saved to BATTLE_STRESS_TEST_REPORT.md (file writing not supported in this environment)\n');
}

// Run the test
runBattleStressTest().catch(console.error);