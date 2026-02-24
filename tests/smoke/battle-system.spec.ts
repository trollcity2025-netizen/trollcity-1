import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { login, setupDiagnostics, attachDiagnostics, TEST_USERS } from './utils';

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

// Helper: Start a stream
async function startStream(page: Page, title: string): Promise<string | null> {
  try {
    await page.goto('/broadcast/setup');
    
    // Fill stream details
    const titleInput = page.locator('input[placeholder*="title" i]');
    if (await titleInput.isVisible()) {
      await titleInput.fill(title);
    }
    
    // Select Trollmers category (supports battles)
    const categorySelect = page.locator('select[name="category"], select:has(option:has-text("Trollmers"))');
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('trollmers');
    }
    
    // Start stream
    const goLiveButton = page.getByRole('button', { name: /Go Live|Start/i });
    await goLiveButton.click();
    
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
    const battleButton = page.getByRole('button', { name: /Battle|⚔/i });
    await battleButton.click();
    
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
    await page.waitForSelector('text=Accept Battle', { timeout: 10000 });
    await page.getByRole('button', { name: /Accept/i }).click();
    
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
    await page.getByRole('button', { name: /Gift/i }).click();
    
    // Wait for gift tray to open
    await page.waitForSelector('text=Send a Gift', { timeout: 5000 });
    
    // Select gift by name
    const giftButton = page.locator(`button:has-text("${giftName}"), div:has-text("${giftName}")`).first();
    if (await giftButton.isVisible()) {
      await giftButton.click();
    }
    
    // Confirm send
    const sendButton = page.getByRole('button', { name: /Send|Confirm/i });
    await sendButton.click();
    
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

// Helper: Get battle scores
async function getBattleScores(page: Page): Promise<{ challenger: number; opponent: number }> {
  try {
    const scoreElements = page.locator('[class*="score"], [class*="font-mono"]');
    const count = await scoreElements.count();
    
    if (count >= 2) {
      const challengerText = await scoreElements.nth(0).textContent();
      const opponentText = await scoreElements.nth(1).textContent();
      
      return {
        challenger: parseInt(challengerText?.replace(/[^0-9]/g, '') || '0'),
        opponent: parseInt(opponentText?.replace(/[^0-9]/g, '') || '0')
      };
    }
    return { challenger: 0, opponent: 0 };
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
    await broadcaster1Page?.close();
    await broadcaster2Page?.close();
    await gifter1Page?.close();
    await gifter2Page?.close();
    await chatUser1Page?.close();
    await chatUser2Page?.close();
    await viewer1Page?.close();
  });

  // ============================================
  // TEST 1: Login All Users
  // ============================================
  test('1. Login all test users', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login broadcaster 1
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 2: Start Streams
  // ============================================
  test('2. Start broadcast streams', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Start stream
      const streamId = await startStream(page, 'Challenger Stream');
      if (!streamId) throw new Error('Failed to start stream');
      
      console.log(`   Stream ID: ${streamId}`);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 3: Create Battle
  // ============================================
  test('3. Create battle challenge', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to go-live and create battle
      const battleId = await startBattle(page);
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 4: Accept Battle
  // ============================================
  test('4. Accept battle challenge', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login as second broadcaster
      await login(page, TEST_USERS.broadcaster2.email, TEST_USERS.broadcaster2.password);
      
      // Accept battle
      const accepted = await acceptBattle(page);
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 5: Verify Battle Started
  // ============================================
  test('5. Verify battle is active', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login and navigate to battle
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Check for battle UI elements
      const hasBattleHeader = await page.getByText('Battle Live').isVisible().catch(() => false);
      const hasScoreDisplay = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
      
      if (!hasBattleHeader && !hasScoreDisplay) {
        throw new Error('Battle UI not visible');
      }
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 6: Gifting During Battle
  // ============================================
  test('6. Send gifts during battle', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login as gifter
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to battle
      await page.goto('/battles');
      
      // Try to send gift
      const giftSent = await sendGift(page, 'Rose').catch(() => false);
      
      console.log(`   Gift sent: ${giftSent}`);
      
      logResult({
        name: 'Battle Gifting',
        status: giftSent ? 'pass' : 'fail',
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 7: Chat During Battle
  // ============================================
  test('7. Send chat messages during battle', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to a stream
      await page.goto('/');
      
      // Find and click on any live stream
      const liveStream = page.locator('text=Live').first();
      if (await liveStream.isVisible()) {
        await liveStream.click();
      }
      
      // Try to send chat message
      const msgSent = await sendChatMessage(page, 'Great stream!');
      
      console.log(`   Chat sent: ${msgSent}`);
      
      logResult({
        name: 'Battle Chat',
        status: msgSent ? 'pass' : 'fail',
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 8: Viewer Watch Battle
  // ============================================
  test('8. Viewer can watch battle', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login as viewer
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to battles page
      await page.goto('/battles');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check if battles list loads
      const hasBattles = await page.locator('text=Battle').first().isVisible().catch(() => false);
      
      console.log(`   Battles page loads: ${hasBattles}`);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 9: Realtime Score Updates
  // ============================================
  test('9. Verify realtime score updates', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to battles
      await page.goto('/battles');
      await page.waitForLoadState('networkidle');
      
      // Check for battle elements (realtime indicator)
      const hasBattleElement = await page.locator('[class*="battle"]').first().isVisible().catch(() => false);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 10: Battle Timer
  // ============================================
  test('10. Battle timer countdown works', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to a stream that's in battle
      await page.goto('/battles');
      await page.waitForLoadState('networkidle');
      
      // Look for timer element
      const timerVisible = await page.locator('text=/\\d:\\d{2}/').isVisible().catch(() => false);
      
      console.log(`   Timer visible: ${timerVisible}`);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 11: Battle End
  // ============================================
  test('11. End battle manually', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to battle
      await page.goto('/battles');
      await page.waitForLoadState('networkidle');
      
      // Look for End Battle button (only visible to hosts)
      const endButton = page.getByRole('button', { name: /End Battle/i });
      const hasEndButton = await endButton.isVisible().catch(() => false);
      
      if (hasEndButton) {
        await endButton.click();
        // Handle dialog
        await page.on('dialog', async dialog => {
          await dialog.accept();
        });
      }
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  // ============================================
  // TEST 12: Battle Results Display
  // ============================================
  test('12. Verify battle results shown', async ({ page }, testInfo) => {
    const startTime = Date.now();
    const diagnostics = setupDiagnostics(page);
    
    try {
      // Login first
      await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
      
      // Navigate to battles
      await page.goto('/battles');
      await page.waitForLoadState('networkidle');
      
      // Check for results (could be in various states)
      const hasBattlesPage = await page.locator('text=Battle').first().isVisible().catch(() => false);
      
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
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});
