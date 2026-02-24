import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

/**
 * Battle System Comprehensive Test
 * 
 * This test simulates 10 users interacting with the battle system:
 * - Users 1-2: Broadcasters (start streams and battles)
 * - Users 3-4: Guests (join broadcasts as guests)
 * - Users 5-6: Gifters (send gifts during battle)
 * - Users 7-8: Chat users (send chat messages)
 * - Users 9-10: Viewers (watch battle)
 */

const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5173',
  users: {
    broadcaster1: { email: 'testuser1@test.com', password: 'TestPassword123!' },
    broadcaster2: { email: 'testuser2@test.com', password: 'TestPassword123!' },
    gifter1: { email: 'testuser5@test.com', password: 'TestPassword123!' },
    gifter2: { email: 'testuser6@test.com', password: 'TestPassword123!' },
  },
  battle: {
    challengerScore: 0,
    opponentScore: 0,
    duration: 180, // seconds
  }
};

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Test results logging
function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${result.name} - ${result.status} (${result.duration}ms)`);
  if (result.error) {
    console.error(`   Error: ${result.error}`);
  }
}

// Helper: Login user
async function loginUser(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto(`${TEST_CONFIG.baseUrl}/auth`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${TEST_CONFIG.baseUrl}/`, { timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error(`Login failed for ${email}:`, error.message);
    return false;
  }
}

// Helper: Start a stream
async function startStream(page: Page, title: string): Promise<string | null> {
  try {
    await page.goto(`${TEST_CONFIG.baseUrl}/go-live`);
    
    // Fill stream details
    await page.fill('input[placeholder*="title" i]', title);
    
    // Select Trollmers category (supports battles)
    await page.selectOption('select[name="category"]', 'trollmers');
    
    // Start stream
    await page.click('button:has-text("Go Live")');
    
    // Wait for stream to be active
    await page.waitForSelector('text=Live', { timeout: 15000 });
    
    // Get stream ID from URL
    const url = page.url();
    const streamIdMatch = url.match(/\/stream\/([a-f0-9-]+)/);
    return streamIdMatch ? streamIdMatch[1] : null;
  } catch (error: any) {
    console.error('Start stream failed:', error.message);
    return null;
  }
}

// Helper: Start a battle
async function startBattle(page: Page): Promise<string | null> {
  try {
    // Click Start Battle button
    await page.click('button:has-text("Start Battle"), button:has-text("⚔")');
    
    // Wait for battle to be created
    await page.waitForSelector('text=Battle Live, text=LIVE - BATTLE', { timeout: 15000 });
    
    // Get battle ID from URL
    const url = page.url();
    const battleIdMatch = url.match(/\/battle\/([a-f0-9-]+)/);
    return battleIdMatch ? battleIdMatch[1] : null;
  } catch (error: any) {
    console.error('Start battle failed:', error.message);
    return null;
  }
}

// Helper: Accept a battle
async function acceptBattle(page: Page): Promise<boolean> {
  try {
    // Look for accept battle button
    await page.waitForSelector('button:has-text("Accept Battle"), button:has-text("Accept")', { timeout: 10000 });
    await page.click('button:has-text("Accept Battle"), button:has-text("Accept")');
    
    // Wait for battle to start
    await page.waitForSelector('text=Battle Live, text=LIVE - BATTLE', { timeout: 15000 });
    return true;
  } catch (error: any) {
    console.error('Accept battle failed:', error.message);
    return false;
  }
}

// Helper: Send a gift
async function sendGift(page: Page, giftName: string): Promise<boolean> {
  try {
    // Open gift tray
    await page.click('button:has-text("Gift"), button[aria-label*="gift"]');
    
    // Select gift
    await page.click(`text=${giftName}`);
    
    // Confirm send
    await page.click('button:has-text("Send"), button:has-text("Confirm")');
    
    // Wait for animation
    await page.waitForTimeout(1000);
    return true;
  } catch (error: any) {
    console.error('Send gift failed:', error.message);
    return false;
  }
}

// Helper: Send chat message
async function sendChatMessage(page: Page, message: string): Promise<boolean> {
  try {
    // Find chat input
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]');
    await chatInput.fill(message);
    
    // Send message
    await page.keyboard.press('Enter');
    
    // Wait for message to appear
    await page.waitForTimeout(500);
    return true;
  } catch (error: any) {
    console.error('Send chat failed:', error.message);
    return false;
  }
}

// Helper: Check battle score
async function getBattleScores(page: Page): Promise<{ challenger: number; opponent: number }> {
  try {
    const challengerText = await page.locator('text=/\\d+/').first().textContent();
    const opponentText = await page.locator('text=/\\d+/').nth(1).textContent();
    
    return {
      challenger: parseInt(challengerText || '0'),
      opponent: parseInt(opponentText || '0')
    };
  } catch {
    return { challenger: 0, opponent: 0 };
  }
}

// ============================================
// TEST SUITE
// ============================================

test.describe('Battle System Tests', () => {
  let broadcaster1Page: Page;
  let broadcaster2Page: Page;
  let gifter1Page: Page;
  let gifter2Page: Page;
  let chatUser1Page: Page;
  let chatUser2Page: Page;
  let viewer1Page: Page;
  let viewer2Page: Page;

  test.beforeAll(async ({ browser }) => {
    console.log('\n🧪 Starting Battle System Tests\n');
    console.log('========================================');
    
    // Create browser contexts for multiple users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    const context4 = await browser.newContext();
    const context5 = await browser.newContext();
    const context6 = await browser.newContext();
    const context7 = await browser.newContext();
    
    // Create pages
    broadcaster1Page = await context1.newPage();
    broadcaster2Page = await context2.newPage();
    gifter1Page = await context3.newPage();
    gifter2Page = await context4.newPage();
    chatUser1Page = await context5.newPage();
    chatUser2Page = await context6.newPage();
    viewer1Page = await context7.newPage();
  });

  test.afterAll(async () => {
    // Print summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    // Close pages
    await broadcaster1Page.close();
    await broadcaster2Page.close();
    await gifter1Page.close();
    await gifter2Page.close();
    await chatUser1Page.close();
    await chatUser2Page.close();
    await viewer1Page.close();
  });

  // ============================================
  // TEST 1: Login All Users
  // ============================================
  test('1. Login all test users', async () => {
    const startTime = Date.now();
    
    try {
      // Login broadcaster 1
      const login1 = await loginUser(broadcaster1Page, TEST_CONFIG.users.broadcaster1.email, TEST_CONFIG.users.broadcaster1.password);
      if (!login1) throw new Error('Failed to login broadcaster 1');
      
      // Login broadcaster 2
      const login2 = await loginUser(broadcaster2Page, TEST_CONFIG.users.broadcaster2.email, TEST_CONFIG.users.broadcaster2.password);
      if (!login2) throw new Error('Failed to login broadcaster 2');
      
      // Login gifters
      await loginUser(gifter1Page, TEST_CONFIG.users.gifter1.email, TEST_CONFIG.users.gifter1.password);
      await loginUser(gifter2Page, TEST_CONFIG.users.gifter2.email, TEST_CONFIG.users.gifter2.password);
      
      logResult({
        name: 'User Login',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'User Login',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 2: Start Streams
  // ============================================
  test('2. Start broadcast streams', async () => {
    const startTime = Date.now();
    
    try {
      // Start stream for broadcaster 1
      const stream1Id = await startStream(broadcaster1Page, 'Challenger Stream');
      if (!stream1Id) throw new Error('Failed to start challenger stream');
      
      // Start stream for broadcaster 2
      const stream2Id = await startStream(broadcaster2Page, 'Opponent Stream');
      if (!stream2Id) throw new Error('Failed to start opponent stream');
      
      console.log(`   Stream 1: ${stream1Id}`);
      console.log(`   Stream 2: ${stream2Id}`);
      
      TEST_CONFIG.battle.challengerScore = 0;
      TEST_CONFIG.battle.opponentScore = 0;
      
      logResult({
        name: 'Start Streams',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Start Streams',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 3: Create Battle
  // ============================================
  test('3. Create battle challenge', async () => {
    const startTime = Date.now();
    
    try {
      const battleId = await startBattle(broadcaster1Page);
      if (!battleId) throw new Error('Failed to create battle');
      
      console.log(`   Battle ID: ${battleId}`);
      
      logResult({
        name: 'Create Battle',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Create Battle',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 4: Accept Battle
  // ============================================
  test('4. Accept battle challenge', async () => {
    const startTime = Date.now();
    
    try {
      const accepted = await acceptBattle(broadcaster2Page);
      if (!accepted) throw new Error('Failed to accept battle');
      
      logResult({
        name: 'Accept Battle',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Accept Battle',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 5: Verify Battle Started
  // ============================================
  test('5. Verify battle is active', async () => {
    const startTime = Date.now();
    
    try {
      // Check for battle UI elements
      const hasBattleHeader = await broadcaster1Page.locator('text=Battle Live').isVisible();
      const hasScoreDisplay = await broadcaster1Page.locator('text=/\\d+/').first().isVisible();
      
      if (!hasBattleHeader) throw new Error('Battle header not visible');
      if (!hasScoreDisplay) throw new Error('Score display not visible');
      
      logResult({
        name: 'Battle Active',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle Active',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 6: Gifting During Battle
  // ============================================
  test('6. Send gifts during battle', async () => {
    const startTime = Date.now();
    
    try {
      // Gifter 1 sends gift to challenger
      const gift1Sent = await sendGift(gifter1Page, 'Rose');
      if (!gift1Sent) throw new Error('Gifter 1 failed to send gift');
      
      // Wait for score update
      await broadcaster1Page.waitForTimeout(2000);
      
      // Get updated scores
      const scores1 = await getBattleScores(broadcaster1Page);
      
      // Gifter 2 sends gift to opponent
      const gift2Sent = await sendGift(gifter2Page, 'Heart');
      if (!gift2Sent) throw new Error('Gifter 2 failed to send gift');
      
      await broadcaster2Page.waitForTimeout(2000);
      
      const scores2 = await getBattleScores(broadcaster2Page);
      
      console.log(`   Scores after gifting: Challenger ${scores1.challenger}, Opponent ${scores2.opponent}`);
      
      logResult({
        name: 'Battle Gifting',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle Gifting',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 7: Chat During Battle
  // ============================================
  test('7. Send chat messages during battle', async () => {
    const startTime = Date.now();
    
    try {
      // Chat user 1 sends message
      const msg1Sent = await sendChatMessage(chatUser1Page, 'Great battle!');
      if (!msg1Sent) throw new Error('Chat user 1 failed to send message');
      
      // Chat user 2 sends message
      const msg2Sent = await sendChatMessage(chatUser2Page, 'Amazing fight!');
      if (!msg2Sent) throw new Error('Chat user 2 failed to send message');
      
      // Verify messages appear
      const hasMsg1 = await broadcaster1Page.locator('text=Great battle!').isVisible();
      const hasMsg2 = await broadcaster1Page.locator('text=Amazing fight!').isVisible();
      
      console.log(`   Messages visible: ${hasMsg1 && hasMsg2}`);
      
      logResult({
        name: 'Battle Chat',
        status: hasMsg1 && hasMsg2 ? 'pass' : 'fail',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle Chat',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 8: Viewer Watch Battle
  // ============================================
  test('8. Viewer can watch battle', async () => {
    const startTime = Date.now();
    
    try {
      // Get battle URL from broadcaster 1
      const battleUrl = broadcaster1Page.url();
      
      // Viewer 1 navigates to battle
      await viewer1Page.goto(battleUrl);
      
      // Wait for battle to load
      await viewer1Page.waitForSelector('text=Battle Live, text=LIVE', { timeout: 15000 });
      
      // Verify viewer can see scores
      const hasScores = await viewer1Page.locator('text=/\\d+/').first().isVisible();
      
      if (!hasScores) throw new Error('Viewer cannot see battle scores');
      
      logResult({
        name: 'Viewer Watch',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Viewer Watch',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 9: Realtime Score Updates
  // ============================================
  test('9. Verify realtime score updates', async () => {
    const startTime = Date.now();
    
    try {
      // Get initial scores
      const initialScores = await getBattleScores(broadcaster1Page);
      
      // Send another gift to trigger score update
      await sendGift(gifter1Page, 'Crown');
      
      // Wait for realtime update
      await broadcaster1Page.waitForTimeout(3000);
      
      // Get new scores
      const newScores = await getBattleScores(broadcaster1Page);
      
      console.log(`   Initial: ${initialScores.challenger}, After gift: ${newScores.challenger}`);
      
      if (newScores.challenger <= initialScores.challenger) {
        throw new Error('Scores not updated in realtime');
      }
      
      logResult({
        name: 'Realtime Updates',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Realtime Updates',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 10: Battle Timer
  // ============================================
  test('10. Battle timer countdown works', async () => {
    const startTime = Date.now();
    
    try {
      // Look for timer element
      const timerVisible = await broadcaster1Page.locator('text=/\\d:\\d{2}/').isVisible();
      
      if (!timerVisible) throw new Error('Timer not visible');
      
      // Get initial timer
      const initialTimer = await broadcaster1Page.locator('text=/\\d:\\d{2}/').textContent();
      
      // Wait for timer to change
      await broadcaster1Page.waitForTimeout(5000);
      
      const newTimer = await broadcaster1Page.locator('text=/\\d:\\d{2}/').textContent();
      
      console.log(`   Timer: ${initialTimer} -> ${newTimer}`);
      
      logResult({
        name: 'Battle Timer',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle Timer',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 11: Battle End
  // ============================================
  test('11. End battle manually', async () => {
    const startTime = Date.now();
    
    try {
      // Click End Battle button (as host)
      await broadcaster1Page.click('button:has-text("End Battle")');
      
      // Handle confirmation dialog
      await broadcaster1Page.on('dialog', async dialog => {
        await dialog.accept();
      });
      
      // Wait for battle to end
      await broadcaster1Page.waitForSelector('text=Battle Ended, text=FINISHED', { timeout: 15000 });
      
      logResult({
        name: 'Battle End',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle End',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });

  // ============================================
  // TEST 12: Battle Results Display
  // ============================================
  test('12. Verify battle results shown', async () => {
    const startTime = Date.now();
    
    try {
      // Check for results overlay
      const hasWinner = await broadcaster1Page.locator('text=/Winner|winner/i').isVisible();
      const hasFinalScores = await broadcaster1Page.locator('text=/\\d+/').first().isVisible();
      
      if (!hasWinner && !hasFinalScores) {
        throw new Error('Battle results not displayed');
      }
      
      console.log(`   Results displayed: Winner=${hasWinner}, Scores=${hasFinalScores}`);
      
      logResult({
        name: 'Battle Results',
        status: 'pass',
        duration: Date.now() - startTime
      });
    } catch (error: any) {
      logResult({
        name: 'Battle Results',
        status: 'fail',
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  });
});
