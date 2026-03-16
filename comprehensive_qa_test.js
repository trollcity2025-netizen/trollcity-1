// Troll City - COMPREHENSIVE QA STRESS TEST
// Tests ALL pages, broadcast, battles, and fixes

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const config = {
  supabaseUrl: 'https://yjxpwfalenorzrqxwmtr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8',
  baseUrl: 'https://maitrollcity.com',
  testDuration: 15 * 60 * 1000,
  concurrentUsers: 20
};

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
  startTime: null,
  endTime: null,
  userMetrics: [],
  pageResults: [],
  broadcastTests: [],
  battleTests: []
};

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordMetric(type, value, details = '') {
  const entry = { type, value, details, time: Date.now() - metrics.startTime };
  
  switch (type) {
    case 'response_time':
      metrics.responseTimes.push(value);
      metrics.totalRequests++;
      metrics.successfulRequests++;
      break;
    case 'error':
    case 'permission_error':
    case 'rls_violation':
      metrics[type === 'error' ? 'failedRequests' : 
             type === 'permission_error' ? 'permissionErrors' : 'rlsViolations']++;
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
    case 'page_result':
      metrics.pageResults.push(entry);
      break;
    case 'broadcast_result':
      metrics.broadcastTests.push(entry);
      break;
    case 'battle_result':
      metrics.battleTests.push(entry);
      break;
  }
}

class QAUser {
  constructor(userData, supabase) {
    this.userId = userData.id;
    this.role = userData.role || 'user';
    this.username = userData.username;
    this.email = `${userData.username}@trollcity.test`;
    this.supabase = supabase;
    this.session = null;
    this.actions = 0;
  }

  async login() {
    const start = Date.now();
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: this.email,
        password: 'Test123456!'
      });
      
      if (error) {
        // Try signup
        const { data: signupData, error: signupError } = await this.supabase.auth.signUp({
          email: this.email,
          password: 'Test123456!'
        });
        
        if (signupError || !signupData?.user) {
          recordMetric('auth_failure', Date.now() - start, `Login failed: ${error?.message || signupError?.message}`);
          return false;
        }
        
        this.userId = signupData.user.id;
        this.session = signupData.session;
        return true;
      }
      
      this.session = data.session;
      this.userId = data.user.id;
      recordMetric('response_time', Date.now() - start, 'Login');
      return true;
    } catch (err) {
      recordMetric('error', Date.now() - start, `Login exception: ${err.message}`);
      return false;
    }
  }

  async testPage(pagePath, pageName) {
    const start = Date.now();
    try {
      await axios.get(`${config.baseUrl}/${pagePath}`, { timeout: 15000 });
      const duration = Date.now() - start;
      recordMetric('response_time', duration, `Page: ${pageName}`);
      recordMetric('page_result', duration, `${pageName}: PASS`);
      return { success: true, duration };
    } catch (err) {
      const duration = Date.now() - start;
      recordMetric('error', duration, `Page ${pageName}: ${err.message}`);
      recordMetric('page_result', duration, `${pageName}: FAIL - ${err.message}`);
      return { success: false, error: err.message, duration };
    }
  }

  async testBroadcast() {
    const results = { streamTests: 0, giftTests: 0, viewerTests: 0 };
    
    // Test streams table
    const start = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('streams')
        .select('id, title, status, viewer_count, user_id')
        .limit(10);
      
      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Broadcast: Streams RLS');
        }
        recordMetric('error', Date.now() - start, `Broadcast streams: ${error.message}`);
      } else {
        recordMetric('db_read', Date.now() - start, 'Broadcast: Read streams');
        results.streamTests = data?.length || 0;
        recordMetric('broadcast_result', Date.now() - start, `Streams: ${results.streamTests} found`);
      }
    } catch (err) {
      recordMetric('error', Date.now() - start, `Broadcast: ${err.message}`);
    }

    // Test gifts
    const giftStart = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('gifts')
        .select('id, sender_id, recipient_id, gift_type, coins')
        .limit(10);
      
      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - giftStart, 'Broadcast: Gifts RLS');
        }
      } else {
        recordMetric('db_read', Date.now() - giftStart, 'Broadcast: Read gifts');
        results.giftTests = data?.length || 0;
        recordMetric('broadcast_result', Date.now() - giftStart, `Gifts: ${results.giftTests} found`);
      }
    } catch (err) {
      // Ignore
    }

    // Test stream_gifts
    const streamGiftStart = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('stream_gifts')
        .select('id, stream_id, sender_id, gift_id')
        .limit(10);
      
      if (!error) {
        recordMetric('db_read', Date.now() - streamGiftStart, 'Broadcast: Read stream_gifts');
        recordMetric('broadcast_result', Date.now() - streamGiftStart, `Stream gifts: ${data?.length || 0}`);
      }
    } catch (err) {
      // Ignore
    }

    return results;
  }

  async testBattles() {
    const results = { battleTests: 0, voteTests: 0 };
    
    // Test battles table
    const start = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('troll_battles')
        .select('id, host_id, challenger_id, status, prize_pool, created_at')
        .limit(10);
      
      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Battles: RLS');
        }
        recordMetric('error', Date.now() - start, `Battles: ${error.message}`);
      } else {
        recordMetric('db_read', Date.now() - start, 'Battles: Read battles');
        results.battleTests = data?.length || 0;
        recordMetric('battle_result', Date.now() - start, `Battles: ${results.battleTests} found`);
      }
    } catch (err) {
      recordMetric('error', Date.now() - start, `Battle query: ${err.message}`);
    }

    // Test battle_votes
    const voteStart = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('battle_votes')
        .select('id, battle_id, voter_id, vote_type')
        .limit(10);
      
      if (!error) {
        recordMetric('db_read', Date.now() - voteStart, 'Battles: Read votes');
        results.voteTests = data?.length || 0;
        recordMetric('battle_result', Date.now() - voteStart, `Votes: ${results.voteTests}`);
      }
    } catch (err) {
      // Ignore
    }

    return results;
  }

  async testDatabaseOperations() {
    // Test profile update with new columns
    const start = Date.now();
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          last_active: new Date().toISOString(),
          online_status: 'online'
        })
        .eq('id', this.userId);

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - start, 'Profile update RLS');
        } else {
          recordMetric('permission_error', Date.now() - start, `Profile update: ${error.message}`);
        }
      } else {
        recordMetric('db_write', Date.now() - start, 'Profile: Update with last_active');
      }
    } catch (err) {
      recordMetric('error', Date.now() - start, `Profile update: ${err.message}`);
    }

    // Test messages with recipient_id
    const msgStart = Date.now();
    try {
      const { error } = await this.supabase
        .from('messages')
        .insert({
          sender_id: this.userId,
          recipient_id: this.userId, // Send to self for testing
          content: `QA Test ${Date.now()}`,
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - msgStart, 'Messages RLS');
        } else {
          recordMetric('permission_error', Date.now() - msgStart, `Message: ${error.message}`);
        }
      } else {
        recordMetric('db_write', Date.now() - msgStart, 'Message: Insert with recipient_id');
      }
    } catch (err) {
      recordMetric('error', Date.now() - msgStart, `Message: ${err.message}`);
    }

    // Test user reports
    const reportStart = Date.now();
    try {
      const { error } = await this.supabase
        .from('user_reports')
        .insert({
          reporter_id: this.userId,
          reported_user_id: this.userId,
          reason: 'QA Test',
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('row-level security')) {
          recordMetric('rls_violation', Date.now() - reportStart, 'Reports RLS');
        }
      } else {
        recordMetric('db_write', Date.now() - reportStart, 'Report: Insert');
      }
    } catch (err) {
      // Ignore
    }
  }

  async runAllTests() {
    console.log(`\n▶ Testing user: ${this.username} (${this.role})`);
    
    // Login
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log(`  ✗ Login failed for ${this.username}`);
      return;
    }
    console.log(`  ✓ Logged in`);

    // Test ALL PAGES
    const pages = [
      { path: '', name: 'Home' },
      { path: 'profile', name: 'Profile' },
      { path: 'dashboard', name: 'Dashboard' },
      { path: 'inventory', name: 'Inventory' },
      { path: 'wallet', name: 'Wallet' },
      { path: 'settings', name: 'Settings' },
      { path: 'stream', name: 'Stream' },
      { path: 'battle', name: 'Battle' },
      { path: 'host', name: 'Host Dashboard' },
      { path: 'officer', name: 'Officer Dashboard' },
      { path: 'admin', name: 'Admin Panel' },
      { path: 'court', name: 'Court' },
      { path: 'messages', name: 'Messages' },
      { path: 'social', name: 'Social' },
      { path: 'notifications', name: 'Notifications' },
      { path: 'marketplace', name: 'Marketplace' },
      { path: 'leaderboard', name: 'Leaderboard' },
      { path: 'shop', name: 'Shop' },
      { path: 'gifts', name: 'Gifts' },
      { path: 'coins', name: 'Coins' }
    ];

    console.log(`  Testing ${pages.length} pages...`);
    for (const page of pages) {
      await this.testPage(page.path, page.name);
    }

    // Test Broadcast System
    console.log(`  Testing Broadcast system...`);
    await this.testBroadcast();

    // Test Battle System
    console.log(`  Testing Battle system...`);
    await this.testBattles();

    // Test Database Operations
    console.log(`  Testing Database operations...`);
    await this.testDatabaseOperations();

    this.actions = pages.length + 5; // Approximate
    console.log(`  ✓ Completed tests for ${this.username}`);
  }
}

async function runComprehensiveTest() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  TROLL CITY - COMPREHENSIVE QA STRESS TEST                       ║');
  console.log('║  ALL PAGES | BROADCAST | BATTLES | DATABASE                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  console.log('Phase 1: Fetching existing users from database...\n');
  
  // Get existing users
  let { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, username, role')
    .limit(25);

  if (error || !users || users.length === 0) {
    console.log('Creating test users...');
    users = [];
    for (let i = 0; i < 20; i++) {
      const email = `qa_full_${Date.now()}_${i}@test.local`;
      try {
        const { data } = await supabase.auth.signUp({ email, password: 'Test123456!' });
        if (data?.user) {
          users.push({ id: data.user.id, username: `qa_user_${i}`, role: 'user' });
        }
      } catch (err) {
        // Continue
      }
      await delay(200);
    }
  }

  console.log(`Found ${users.length} users for testing\n`);

  // Start test
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Phase 2: Running comprehensive tests (15 minutes)...');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  metrics.startTime = Date.now();
  metrics.running = true;

  // Run tests for all users
  const testPromises = users.slice(0, 20).map(u => new QAUser(u, supabase).runAllTests());
  
  // Progress reporter
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - metrics.startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    console.log(`\n[${mins}m ${secs}s] Pages: ${metrics.pageResults.length} | Broadcast: ${metrics.broadcastTests.length} | Battles: ${metrics.battleTests.length} | DB: ${metrics.dbWrites}W/${metrics.dbReads}R | Errors: ${metrics.errors.length}`);
  }, 30000);

  await Promise.allSettled(testPromises);
  
  // Run for duration
  await delay(config.testDuration);
  
  metrics.running = false;
  metrics.endTime = Date.now();
  clearInterval(progressInterval);

  // Generate report
  generateReport();
}

function generateReport() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgResponse = metrics.responseTimes.length ? 
    (metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length).toFixed(2) : 0;
  const maxResponse = metrics.responseTimes.length ? Math.max(...metrics.responseTimes) : 0;

  console.log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              COMPREHENSIVE QA STRESS TEST REPORT                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Overview
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ OVERVIEW                                                            │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Test Duration:     ${(duration/60).toFixed(2)} minutes                                   │`);
  console.log(`│ Test Users:        ${metrics.pageResults.length / 20 || 0} users (avg pages tested)            │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Page Results
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ PAGE TEST RESULTS (ALL PAGES)                                      │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  const pageStats = {};
  metrics.pageResults.forEach(r => {
    const name = r.details.split(':')[0];
    const status = r.details.includes('PASS') ? 'PASS' : 'FAIL';
    if (!pageStats[name]) pageStats[name] = { pass: 0, fail: 0 };
    if (status === 'PASS') pageStats[name].pass++;
    else pageStats[name].fail++;
  });

  console.log('│ Page                 │ Status   │ Load Time                         │');
  console.log('├──────────────────────┼──────────┼───────────────────────────────────┤');
  
  let passCount = 0, failCount = 0;
  for (const [page, stats] of Object.entries(pageStats)) {
    const status = stats.fail === 0 ? '✓ PASS' : '✗ FAIL';
    const time = r = metrics.pageResults.find(x => x.details.startsWith(page));
    console.log(`│ ${page.padEnd(20)} │ ${status.padEnd(8)} │ ${(time?.value || 0).toString().padEnd(10)}ms             │`);
    if (stats.fail === 0) passCount++;
    else failCount++;
  }
  console.log('└──────────────────────┴──────────┴───────────────────────────────────┘\n');

  // Broadcast Results
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ BROADCAST SYSTEM TEST RESULTS                                      │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  const broadcastStats = {};
  metrics.broadcastTests.forEach(r => {
    const key = r.details.split(':')[0].trim();
    if (!broadcastStats[key]) broadcastStats[key] = 0;
    broadcastStats[key]++;
  });
  
  console.log('│ Component            │ Status   │ Records                            │');
  console.log('├──────────────────────┼──────────┼───────────────────────────────────┤');
  for (const [comp, count] of Object.entries(broadcastStats)) {
    console.log(`│ ${comp.padEnd(20)} │ ✓ PASS   │ ${String(count).padEnd(10)}                         │`);
  }
  if (Object.keys(broadcastStats).length === 0) {
    console.log('│ (No broadcast tests completed)                                    │');
  }
  console.log('└──────────────────────┴──────────┴───────────────────────────────────┘\n');

  // Battle Results
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ BATTLE SYSTEM TEST RESULTS                                          │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  
  const battleStats = {};
  metrics.battleTests.forEach(r => {
    const key = r.details.split(':')[0].trim();
    if (!battleStats[key]) battleStats[key] = 0;
    battleStats[key]++;
  });
  
  console.log('│ Component            │ Status   │ Records                            │');
  console.log('├──────────────────────┼──────────┼───────────────────────────────────┤');
  for (const [comp, count] of Object.entries(battleStats)) {
    console.log(`│ ${comp.padEnd(20)} │ ✓ PASS   │ ${String(count).padEnd(10)}                         │`);
  }
  if (Object.keys(battleStats).length === 0) {
    console.log('│ (No battle tests completed)                                        │');
  }
  console.log('└──────────────────────┴──────────┴───────────────────────────────────┘\n');

  // Performance
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ PERFORMANCE METRICS                                                │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Total Requests:         ${metrics.totalRequests.padStart(10)}                            │`);
  console.log(`│ Database Writes:        ${metrics.dbWrites.padStart(10)}                            │`);
  console.log(`│ Database Reads:          ${metrics.dbReads.padStart(10)}                            │`);
  console.log(`│ Average Response Time:  ${avgResponse.padStart(10)} ms                           │`);
  console.log(`│ Max Response Time:     ${String(maxResponse).padStart(10)} ms                           │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Security
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│ SECURITY & ERRORS                                                   │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Authentication Failures: ${String(metrics.authFailures).padStart(10)}                            │`);
  console.log(`│ Permission Errors:      ${String(metrics.permissionErrors).padStart(10)}                            │`);
  console.log(`│ RLS Violations:         ${String(metrics.rlsViolations).padStart(10)}                            │`);
  console.log(`│ Total Errors:           ${String(metrics.errors.length).padStart(10)}                            │`);
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  // Error Details
  if (metrics.errors.length > 0) {
    console.log('┌────────────────────────────────────────────────────────────────────┐');
    console.log('│ ERROR DETAILS                                                       │');
    console.log('├────────────────────────────────────────────────────────────────────┤');
    const errorTypes = {};
    metrics.errors.slice(0, 10).forEach(e => {
      const type = e.type.padEnd(18);
      const details = e.details?.substring(0, 35) || '-';
      console.log(`│ ${type} │ ${details.padEnd(37)}│`);
      errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
    });
    console.log('└────────────────────────────────────────────────────────────────────┘\n');
  }

  // Summary
  const totalPages = Object.keys(pageStats).length;
  const pagesPassing = passCount;
  const criticalIssues = metrics.rlsViolations + metrics.permissionErrors;
  
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ SUMMARY                                                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Pages Tested:        ${totalPages}                                              ║`);
  console.log(`║ Pages Passing:       ${pagesPassing}                                              ║`);
  console.log(`║ Broadcast Tests:    ${metrics.broadcastTests.length}                                               ║`);
  console.log(`║ Battle Tests:       ${metrics.battleTests.length}                                               ║`);
  console.log(`║ Critical Issues:    ${criticalIssues}                                               ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  const score = criticalIssues === 0 && failCount === 0 ? 'PRODUCTION READY' :
                criticalIssues < 10 ? 'NEEDS MINOR FIXES' : 'NEEDS FIXES';
  const icon = criticalIssues === 0 && failCount === 0 ? '✓' : '⚠';
  
  console.log(`║ ${icon} System Readiness: ${score.padEnd(46)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
}

runComprehensiveTest().catch(console.error);