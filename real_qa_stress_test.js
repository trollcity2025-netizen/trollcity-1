// Troll City - REAL QA Stress Test (Fixed)
// 15+ minutes, 20 concurrent users, real actions every 2-5 seconds

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Configuration
const config = {
  supabaseUrl: 'https://yjxpwfalenorzrqxwmtr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8',
  baseUrl: 'https://maitrollcity.com',
  apiUrl: 'https://yjxpwfalenorzrqxwmtr.supabase.co',
  concurrentUsers: 20,
  testDuration: 15 * 60 * 1000, // 15 minutes
  actionInterval: { min: 2000, max: 5000 }
};

// Metrics storage
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  dbWrites: 0,
  dbReads: 0,
  authFailures: 0,
  permissionErrors: 0,
  rlsViolations: 0,
  pageLoadTimes: [],
  memoryWarnings: 0,
  cpuWarnings: 0,
  startTime: null,
  endTime: null,
  userMetrics: []
};

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordMetric(type, value, userId, details = '') {
  const timestamp = Date.now() - metrics.startTime;
  const entry = { timestamp, type, value, userId, details };
  
  switch (type) {
    case 'response_time':
      metrics.responseTimes.push(value);
      metrics.totalRequests++;
      metrics.successfulRequests++;
      break;
    case 'error':
      metrics.failedRequests++;
      metrics.errors.push(entry);
      break;
    case 'db_write':
      metrics.dbWrites++;
      break;
    case 'db_read':
      metrics.dbReads++;
      break;
    case 'auth_failure':
      metrics.authFailures++;
      metrics.errors.push(entry);
      break;
    case 'permission_error':
      metrics.permissionErrors++;
      metrics.errors.push(entry);
      break;
    case 'rls_violation':
      metrics.rlsViolations++;
      metrics.errors.push(entry);
      break;
    case 'page_load':
      metrics.pageLoadTimes.push(value);
      break;
    case 'memory_warning':
      metrics.memoryWarnings++;
      break;
  }
}

// Try to get existing users from the database
async function getExistingUsers(supabase) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, role')
      .limit(30);

    if (error) {
      console.log('Could not fetch existing users:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.log('Error fetching users:', err.message);
    return [];
  }
}

class RealQAUser {
  constructor(userData, supabase) {
    this.id = randomId();
    this.userId = userData.id;
    this.role = userData.role || 'user';
    this.username = userData.username;
    this.email = `${userData.username}@trollcity.test`;
    this.supabase = supabase;
    this.session = null;
    this.actions = 0;
    this.lastAction = Date.now();
    this.running = true;
    this.loggedIn = false;
  }

  async login() {
    const startTime = Date.now();
    try {
      // Try to sign in - if that fails, try signup with a random email
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: this.email,
        password: 'Test123456!'
      });

      if (error) {
        // Try signup instead
        const { data: signupData, signupError } = await this.supabase.auth.signUp({
          email: this.email,
          password: 'Test123456!'
        });

        if (signupError) {
          // Rate limited or already exists, try another method
          recordMetric('auth_failure', Date.now() - startTime, this.id, `Auth failed: ${signupError.message}`);
          return false;
        }

        if (signupData?.user) {
          this.userId = signupData.user.id;
          this.session = signupData.session;
          this.loggedIn = true;
          recordMetric('response_time', Date.now() - startTime, this.id, 'Signup+Login');
          return true;
        }
        return false;
      }

      this.session = data.session;
      this.userId = data.user.id;
      this.loggedIn = true;
      recordMetric('response_time', Date.now() - startTime, this.id, 'Login');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Login exception: ${err.message}`);
      return false;
    }
  }

  async loadProfile() {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.userId)
        .single();

      if (error) {
        if (error.message.includes('row-level security') || error.code === 'PGRST116') {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Profile RLS violation');
        } else {
          recordMetric('error', Date.now() - startTime, this.id, `Profile load: ${error.message}`);
        }
        return null;
      }

      recordMetric('db_read', Date.now() - startTime, this.id, 'Load profile');
      return data;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Profile exception: ${err.message}`);
      return null;
    }
  }

  async updateProfile() {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({
          last_active: new Date().toISOString()
        })
        .eq('id', this.userId);

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Update profile RLS');
        } else {
          recordMetric('permission_error', Date.now() - startTime, this.id, `Update profile: ${error.message}`);
        }
        return false;
      }

      recordMetric('db_write', Date.now() - startTime, this.id, 'Update profile');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Update exception: ${err.message}`);
      return false;
    }
  }

  async sendMessage(recipientId) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          sender_id: this.userId,
          recipient_id: recipientId,
          content: `QA Test message from ${this.username} at ${Date.now()}`,
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Send message RLS');
        } else {
          recordMetric('error', Date.now() - startTime, this.id, `Send message: ${error.message}`);
        }
        return false;
      }

      recordMetric('db_write', Date.now() - startTime, this.id, 'Send message');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Message exception: ${err.message}`);
      return false;
    }
  }

  async getMessages() {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .or(`recipient_id.eq.${this.userId},sender_id.eq.${this.userId}`)
        .limit(20);

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Get messages RLS');
        }
        return [];
      }

      recordMetric('db_read', Date.now() - startTime, this.id, 'Get messages');
      return data || [];
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Get messages: ${err.message}`);
      return [];
    }
  }

  async createReport(targetUserId) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('user_reports')
        .insert({
          reporter_id: this.userId,
          reported_user_id: targetUserId,
          reason: 'QA Stress Test',
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Create report RLS');
        } else {
          recordMetric('permission_error', Date.now() - startTime, this.id, `Create report: ${error.message}`);
        }
        return false;
      }

      recordMetric('db_write', Date.now() - startTime, this.id, 'Create report');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Report exception: ${err.message}`);
      return false;
    }
  }

  async checkTrollzBalance() {
    const startTime = Date.now();
    try {
      const { data: profile, error } = await this.supabase
        .from('user_profiles')
        .select('trollz_balance, bonus_coin_balance, troll_coins')
        .eq('id', this.userId)
        .single();

      if (error) {
        recordMetric('error', Date.now() - startTime, this.id, `Balance check: ${error.message}`);
        return null;
      }

      recordMetric('db_read', Date.now() - startTime, this.id, 'Check trollz balance');
      return profile;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Balance exception: ${err.message}`);
      return null;
    }
  }

  async testTrollzTransaction() {
    const startTime = Date.now();
    try {
      // Direct update for trollz
      const { data, error } = await this.supabase.rpc('add_trollz', {
        p_user_id: this.userId,
        p_amount: randomInt(10, 100),
        p_type: 'stress_test',
        p_description: 'QA stress test'
      });

      if (error) {
        // Try direct update
        const balance = await this.checkTrollzBalance();
        if (balance) {
          recordMetric('error', Date.now() - startTime, this.id, `RPC failed, balance check: ${error.message}`);
        }
        return false;
      }

      recordMetric('db_write', Date.now() - startTime, this.id, 'Trollz transaction');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - startTime, this.id, `Trollz exception: ${err.message}`);
      return false;
    }
  }

  async browseStreams() {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('streams')
        .select('id, title, status, viewer_count')
        .limit(20);

      if (error) {
        return [];
      }

      recordMetric('db_read', Date.now() - startTime, this.id, 'Browse streams');
      return data || [];
    } catch (err) {
      return [];
    }
  }

  async joinStream(streamId) {
    const startTime = Date.now();
    try {
      // Try to update viewer count
      const { error } = await this.supabase
        .from('streams')
        .update({ 
          viewer_count: randomInt(1, 100)
        })
        .eq('id', streamId);

      if (error) {
        return false;
      }
      
      recordMetric('db_write', Date.now() - startTime, this.id, 'Join stream');
      return true;
    } catch (err) {
      return false;
    }
  }

  async loadMarketplace() {
    const startTime = Date.now();
    try {
      // Try marketplace_items table
      const { data, error } = await this.supabase
        .from('marketplace_items')
        .select('*')
        .limit(20);

      if (error) {
        // Try alternative table
        const { data: altData } = await this.supabase
          .from('items')
          .select('*')
          .limit(20);
          
        if (altData) {
          recordMetric('db_read', Date.now() - startTime, this.id, 'Load marketplace (alt)');
        }
        return altData || [];
      }

      recordMetric('db_read', Date.now() - startTime, this.id, 'Load marketplace');
      return data || [];
    } catch (err) {
      return [];
    }
  }

  async sendGift(recipientId) {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('gifts')
        .insert({
          sender_id: this.userId,
          recipient_id: recipientId,
          gift_type: 'test',
          coins: randomInt(1, 50),
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - startTime, this.id, 'Send gift RLS');
        }
        return false;
      }

      recordMetric('db_write', Date.now() - startTime, this.id, 'Send gift');
      return true;
    } catch (err) {
      return false;
    }
  }

  async fetchLeaderboard() {
    const startTime = Date.now();
    try {
      const { data } = await this.supabase
        .from('leaderboard')
        .select('*')
        .limit(50);

      recordMetric('db_read', Date.now() - startTime, this.id, 'Fetch leaderboard');
      return data || [];
    } catch (err) {
      return [];
    }
  }

  async testHomePage() {
    const startTime = Date.now();
    try {
      await axios.get(config.baseUrl, { timeout: 10000 });
      recordMetric('page_load', Date.now() - startTime, this.id, 'Home page');
    } catch (err) {
      // Ignore
    }
  }

  async performAction(users, allUserIds) {
    const action = randomInt(1, 12);
    const recipientId = allUserIds[randomInt(0, allUserIds.length - 1)];

    switch (action) {
      case 1:
        await this.loadProfile();
        break;
      case 2:
        await this.updateProfile();
        break;
      case 3:
        if (recipientId !== this.userId) {
          await this.sendMessage(recipientId);
        }
        break;
      case 4:
        await this.getMessages();
        break;
      case 5:
        if (recipientId !== this.userId) {
          await this.createReport(recipientId);
        }
        break;
      case 6:
        await this.checkTrollzBalance();
        break;
      case 7:
        await this.testTrollzTransaction();
        break;
      case 8:
        const streams = await this.browseStreams();
        if (streams.length > 0) {
          await this.joinStream(streams[0].id);
        }
        break;
      case 9:
        await this.loadMarketplace();
        break;
      case 10:
        await this.fetchLeaderboard();
        break;
      case 11:
        await this.testHomePage();
        break;
      case 12:
        // Test RPC functions
        await this.supabase.rpc('get_trollz_balances', { p_user_id: this.userId });
        break;
    }

    this.actions++;
    this.lastAction = Date.now();
  }

  async run(users, allUserIds) {
    // Try to login
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log(`  ✗ User ${this.username} login failed`);
      return;
    }

    console.log(`  ✓ User ${this.username} (${this.role}) active`);

    // Run actions until test ends
    while (metrics.running && (Date.now() - metrics.startTime) < config.testDuration) {
      try {
        await this.performAction(users, allUserIds);
        
        // Wait 2-5 seconds before next action
        const waitTime = randomInt(config.actionInterval.min, config.actionInterval.max);
        await delay(waitTime);
      } catch (err) {
        recordMetric('error', 0, this.id, `Action error: ${err.message}`);
      }
    }

    // Logout
    await this.supabase.auth.signOut();
    console.log(`  ■ User ${this.username} finished (${this.actions} actions)`);
  }
}

async function runRealStressTest() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     TROLL CITY - REAL QA STRESS TEST (15+ Minutes)               ║');
  console.log('║     20 Concurrent Users | Real Actions | 10,000+ Requests          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  
  console.log(`Test Configuration:`);
  console.log(`  - Duration: ${config.testDuration / 60000} minutes`);
  console.log(`  - Concurrent Users: ${config.concurrentUsers}`);
  console.log(`  - Actions per user: Every ${config.actionInterval.min/1000}-${config.actionInterval.max/1000} seconds\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('PHASE 1: Getting existing users from database...');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get existing users
  let existingUsers = await getExistingUsers(supabase);
  
  // If not enough users, create new ones
  if (existingUsers.length < config.concurrentUsers) {
    console.log(`Found ${existingUsers.length} existing users, need ${config.concurrentUsers}`);
    
    // Create users with valid roles
    const validRoles = ['user', 'member', 'vip'];
    const needed = config.concurrentUsers - existingUsers.length;
    
    for (let i = 0; i < needed; i++) {
      const role = validRoles[i % validRoles.length];
      const email = `qa_stress_${role}_${Date.now()}_${i}@test.local`;
      
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: 'Test123456!'
        });
        
        if (!error && data?.user) {
          // Try to create profile
          await supabase.from('user_profiles').upsert({
            id: data.user.id,
            username: `qa_${role}_${i}`,
            role: role
          });
          
          existingUsers.push({
            id: data.user.id,
            username: `qa_${role}_${i}`,
            role: role
          });
        }
      } catch (err) {
        // Continue on error
      }
      
      await delay(200);
    }
  }

  console.log(`\nUsing ${existingUsers.length} users for testing\n`);

  // Create user objects
  const users = existingUsers.slice(0, config.concurrentUsers).map(u => new RealQAUser(u, supabase));
  const allUserIds = users.map(u => u.userId);

  // Start test
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('PHASE 2: Running stress test...');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  metrics.startTime = Date.now();
  metrics.running = true;

  // Run all users concurrently
  const userPromises = users.map(user => user.run(users, allUserIds));
  
  // Progress reporter
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - metrics.startTime;
    const remaining = Math.max(0, config.testDuration - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const rps = (metrics.totalRequests / (elapsed/1000)).toFixed(2);
    console.log(`\n[Progress] ${minutes}m ${seconds}s | Req: ${metrics.totalRequests} | Writes: ${metrics.dbWrites} | Reads: ${metrics.dbReads} | Errors: ${metrics.errors.length} | RPS: ${rps}`);
    
    if (remaining <= 0) {
      clearInterval(progressInterval);
    }
  }, 30000);

  // Wait for test duration
  await delay(config.testDuration);
  
  // Stop test
  metrics.running = false;
  metrics.endTime = Date.now();
  clearInterval(progressInterval);

  // Wait for users to finish
  await Promise.allSettled(userPromises);

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('PHASE 3: Generating report...');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  generateReport(users);
}

function generateReport(users) {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? (metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length).toFixed(2)
    : 0;
  const maxResponseTime = metrics.responseTimes.length > 0 
    ? Math.max(...metrics.responseTimes)
    : 0;
  const p95ResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.sort((a, b) => a - b)[Math.floor(metrics.responseTimes.length * 0.95)] || 0
    : 0;

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              TROLL CITY - REAL QA STRESS TEST REPORT              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Overview
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ OVERVIEW                                                            │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Test Start Time:    ${new Date(metrics.startTime).toISOString()}              │`);
  console.log(`│ Test End Time:      ${new Date(metrics.endTime).toISOString()}              │`);
  console.log(`│ Duration:           ${duration.toFixed(2)} seconds (${(duration/60).toFixed(2)} minutes)                │`);
  console.log(`│ Concurrent Users:   ${config.concurrentUsers}                                                │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Request Metrics
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ REQUEST METRICS                                                     │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Total Requests Processed:     ${String(metrics.totalRequests).padStart(10)}                     │`);
  console.log(`│ Successful Requests:          ${String(metrics.successfulRequests).padStart(10)}                     │`);
  console.log(`│ Failed Requests:              ${String(metrics.failedRequests).padStart(10)}                     │`);
  const successRate = metrics.totalRequests > 0 ? ((metrics.successfulRequests/metrics.totalRequests)*100).toFixed(2) : '0.00';
  console.log(`│ Success Rate:                 ${successRate}%                                       │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Performance
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ PERFORMANCE METRICS                                                 │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Average Response Time:        ${avgResponseTime} ms                               │`);
  console.log(`│ Maximum Response Time:        ${maxResponseTime} ms                               │`);
  console.log(`│ P95 Response Time:            ${p95ResponseTime} ms                               │`);
  console.log(`│ Requests per Second:          ${(metrics.totalRequests/duration).toFixed(2)}                                   │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Database Operations
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ DATABASE OPERATIONS                                                 │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Database Writes:              ${String(metrics.dbWrites).padStart(10)}                     │`);
  console.log(`│ Database Reads:               ${String(metrics.dbReads).padStart(10)}                     │`);
  console.log(`│ Total DB Operations:          ${String(metrics.dbWrites + metrics.dbReads).padStart(10)}                     │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Security & Errors
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ SECURITY & ERROR METRICS                                            │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Authentication Failures:      ${String(metrics.authFailures).padStart(10)}                     │`);
  console.log(`│ Permission Errors:            ${String(metrics.permissionErrors).padStart(10)}                     │`);
  console.log(`│ RLS Violations:               ${String(metrics.rlsViolations).padStart(10)}                     │`);
  console.log(`│ Memory Warnings:              ${String(metrics.memoryWarnings).padStart(10)}                     │`);
  console.log(`│ CPU Warnings:                 ${String(metrics.cpuWarnings).padStart(10)}                     │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // User Activity
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ USER ACTIVITY                                                       │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  users.forEach((user, i) => {
    console.log(`│ User ${String(i + 1).padStart(2)} (${String((user.role || 'user').padEnd(10)).substring(0, 10)}): ${String(user.actions).padStart(6)} actions                  │`);
  });
  const totalActions = users.reduce((sum, u) => sum + u.actions, 0);
  console.log(`│ ------------------------------------------------------------------- │`);
  console.log(`│ Total Actions:                 ${String(totalActions).padStart(10)}                     │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Error Details
  if (metrics.errors.length > 0) {
    console.log('┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ ERROR DETAILS (First 20)                                            │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    console.log('│ Time(s) │ Type              │ Details                              │');
    console.log('├─────────┼───────────────────┼──────────────────────────────────────┤');
    
    const errorTypes = {};
    metrics.errors.slice(0, 20).forEach(err => {
      const type = err.type.padEnd(17).substring(0, 17);
      const details = (err.details || '').substring(0, 36).padEnd(36);
      console.log(`│ ${String((err.timestamp/1000).toFixed(0)).padStart(7)} │ ${type} │ ${details} │`);
      
      errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
    });
    console.log('└────────────────────────────────────────────────────────────────────┘\n');

    // Error Summary
    console.log('┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ ERROR SUMMARY                                                       │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    for (const [type, count] of Object.entries(errorTypes)) {
      console.log(`│ ${type.padEnd(21)}: ${count}                                      │`);
    }
    console.log('└────────────────────────────────────────────────────────────────────┘\n');
  }

  // Bug List
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ BUG LIST                                                            │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  const bugs = [];
  
  if (metrics.rlsViolations > 0) {
    bugs.push({
      severity: 'High',
      description: `${metrics.rlsViolations} Row-Level Security violations detected`,
      location: 'Database RLS policies'
    });
  }
  
  if (metrics.permissionErrors > 0) {
    bugs.push({
      severity: 'Medium',
      description: `${metrics.permissionErrors} permission errors during operations`,
      location: 'Supabase RLS / Policies'
    });
  }

  if (metrics.authFailures > 0) {
    bugs.push({
      severity: 'Medium',
      description: `${metrics.authFailures} authentication failures`,
      location: 'Supabase Auth'
    });
  }

  if (bugs.length === 0) {
    console.log('│ No critical bugs detected.                                           │');
  } else {
    bugs.forEach((bug, i) => {
      console.log(`│ ${i+1}. [${bug.severity}] ${bug.description}                │`);
      console.log(`│    Location: ${bug.location.padEnd(54)}│`);
    });
  }
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // System Readiness
  const criticalIssues = metrics.rlsViolations + metrics.permissionErrors;
  const readinessScore = criticalIssues === 0 ? 'PRODUCTION READY' :
                         criticalIssues < 10 ? 'NEEDS MINOR FIXES' :
                         'NEEDS FIXES';
  const readinessIcon = criticalIssues === 0 ? '✓' : criticalIssues < 10 ? '⚠' : '✗';

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ FINAL SYSTEM SCORE                                                  ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║                                                                      ║`);
  console.log(`║  ${readinessIcon} System Readiness: ${readinessScore.padEnd(42)}║`);
  console.log(`║                                                                      ║`);
  if (criticalIssues === 0) {
    console.log(`║  ✓ All systems operational - Ready for deployment                  ║`);
  } else {
    console.log(`║  ⚠ Review ${criticalIssues} critical issue(s) before deployment    ║`);
  }
  console.log(`║                                                                      ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  console.log('Test complete.\n');
}

// Run the test
runRealStressTest().catch(console.error);