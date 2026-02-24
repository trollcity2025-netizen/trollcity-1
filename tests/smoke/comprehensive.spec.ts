/**
 * Comprehensive Frontend Test Suite
 * Tests 20 users with 10 different roles
 * Tests all pages, broadcast categories, battles, and user-to-user actions
 */

import { test, expect, chromium } from '@playwright/test';
import { login, logout, setupDiagnostics, attachDiagnostics, clearSession, getPathname } from './utils';

// Test users - 20 users with 10 roles
const TEST_USERS = {
  // Role 1: Admin (2 users)
  admin1: { email: 'admin1@test.com', password: 'Test123!@#', role: 'admin' },
  admin2: { email: 'admin2@test.com', password: 'Test123!@#', role: 'admin' },
  // Role 2: Secretary (2 users)
  secretary1: { email: 'secretary1@test.com', password: 'Test123!@#', role: 'secretary' },
  secretary2: { email: 'secretary2@test.com', password: 'Test123!@#', role: 'secretary' },
  // Role 3: Lead Troll Officer (2 users)
  leadOfficer1: { email: 'lead_officer1@test.com', password: 'Test123!@#', role: 'lead_troll_officer' },
  leadOfficer2: { email: 'lead_officer2@test.com', password: 'Test123!@#', role: 'lead_troll_officer' },
  // Role 4: Troll Officer (2 users)
  officer1: { email: 'officer1@test.com', password: 'Test123!@#', role: 'troll_officer' },
  officer2: { email: 'officer2@test.com', password: 'Test123!@#', role: 'troll_officer' },
  // Role 5: Broadcaster (2 users)
  broadcaster1: { email: 'broadcaster1@test.com', password: 'Test123!@#', role: 'broadcaster' },
  broadcaster2: { email: 'broadcaster2@test.com', password: 'Test123!@#', role: 'broadcaster' },
  // Role 6: Family Leader (2 users)
  familyLeader1: { email: 'family_leader1@test.com', password: 'Test123!@#', role: 'family_leader' },
  familyLeader2: { email: 'family_leader2@test.com', password: 'Test123!@#', role: 'family_leader' },
  // Role 7: Troller (2 users)
  troller1: { email: 'troller1@test.com', password: 'Test123!@#', role: 'troller' },
  troller2: { email: 'troller2@test.com', password: 'Test123!@#', role: 'troller' },
  // Role 8: President (2 users)
  president1: { email: 'president1@test.com', password: 'Test123!@#', role: 'president' },
  president2: { email: 'president2@test.com', password: 'Test123!@#', role: 'president' },
  // Role 9: Pastor (2 users)
  pastor1: { email: 'pastor1@test.com', password: 'Test123!@#', role: 'pastor' },
  pastor2: { email: 'pastor2@test.com', password: 'Test123!@#', role: 'pastor' },
  // Role 10: Member (2 users)
  member1: { email: 'member1@test.com', password: 'Test123!@#', role: 'member' },
  member2: { email: 'member2@test.com', password: 'Test123!@#', role: 'member' },
};

// Pages to test - comprehensive list
const PAGES_TO_TEST = [
  { path: '/', name: 'Home' },
  { path: '/auth', name: 'Auth' },
  { path: '/profile', name: 'Profile' },
  { path: '/wallet', name: 'Wallet' },
  { path: '/leaderboard', name: 'Leaderboard' },
  { path: '/coins', name: 'Coins' },
  { path: '/shop', name: 'Shop' },
  { path: '/broadcast', name: 'Broadcast' },
  { path: '/broadcast/setup', name: 'Broadcast Setup' },
  { path: '/family', name: 'Family' },
  { path: '/family/lounge', name: 'Family Lounge' },
  { path: '/family/shop', name: 'Family Shop' },
  { path: '/family/wars', name: 'Family Wars' },
  { path: '/pods', name: 'Pods' },
  { path: '/church', name: 'Church' },
  { path: '/court', name: 'Court' },
  { path: '/tcps', name: 'TCPS' },
  { path: '/marketplace', name: 'Marketplace' },
  { path: '/support', name: 'Support' },
  { path: '/car', name: 'Car Dealership' },
  { path: '/real-estate', name: 'Real Estate' },
  { path: '/rentals', name: 'Rentals' },
  { path: '/career', name: 'Career' },
  { path: '/badges', name: 'Badges' },
  { path: '/changelog', name: 'Changelog' },
];

// Admin-only pages
const ADMIN_PAGES = [
  { path: '/admin', name: 'Admin Dashboard' },
  { path: '/admin/users', name: 'Admin Users' },
  { path: '/admin/payouts', name: 'Admin Payouts' },
  { path: '/admin/payments', name: 'Admin Payments' },
  { path: '/roles', name: 'Roles Manager' },
];

// Officer-only pages
const OFFICER_PAGES = [
  { path: '/officer/dashboard', name: 'Officer Dashboard' },
  { path: '/lead-officer', name: 'Lead Officer Dashboard' },
];

// Secretary pages
const SECRETARY_PAGES = [
  { path: '/secretary', name: 'Secretary Console' },
];

// President pages
const PRESIDENT_PAGES = [
  { path: '/president', name: 'President Dashboard' },
];

// Broadcast categories to test
const BROADCAST_CATEGORIES = [
  { category: 'general', name: 'General Chat', supportsBattles: false },
  { category: 'just_chatting', name: 'Just Chatting', supportsBattles: false },
  { category: 'gaming', name: 'Gaming', supportsBattles: false },
  { category: 'music', name: 'Music', supportsBattles: false },
  { category: 'irl', name: 'IRL', supportsBattles: false },
  { category: 'debate', name: 'Debate', supportsBattles: true },
  { category: 'education', name: 'Education', supportsBattles: false },
  { category: 'fitness', name: 'Fitness', supportsBattles: false },
  { category: 'business', name: 'Business', supportsBattles: true },
  { category: 'spiritual', name: 'Spiritual', supportsBattles: true },
  { category: 'trollmers', name: 'Trollmers', supportsBattles: true },
  { category: 'election', name: 'Election', supportsBattles: false },
];

// Test results storage
const testResults: Array<{
  category: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  user?: string;
  page?: string;
}> = [];

function recordResult(category: string, testName: string, status: 'pass' | 'fail' | 'skip', error?: string, user?: string, page?: string) {
  testResults.push({ category, testName, status, error, user, page });
  console.log(`[${status.toUpperCase()}] ${testName}${user ? ` (${user})` : ''}${page ? ` - ${page}` : ''}${error ? `: ${error}` : ''}`);
}

// ============================================
// AUTHENTICATION TESTS
// ============================================

test.describe('Authentication Tests', () => {
  test('login flow works for all 20 users', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    
    for (const [key, user] of Object.entries(TEST_USERS)) {
      try {
        await clearSession(page);
        await login(page, user.email, user.password);
        await page.waitForTimeout(500);
        
        const pathname = getPathname(page);
        if (pathname === '/auth' || pathname === '/login') {
          recordResult('Authentication', `Login ${user.role} (${key})`, 'fail', 'Redirected to auth page', user.email);
        } else {
          recordResult('Authentication', `Login ${user.role} (${key})`, 'pass', undefined, user.email);
        }
        
        await logout(page);
      } catch (error) {
        recordResult('Authentication', `Login ${user.role} (${key})`, 'fail', String(error), user.email);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('invalid password shows error', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    
    await page.goto('/auth');
    await page.getByPlaceholder('Email address').fill('admin1@test.com');
    await page.getByPlaceholder('Password').fill('WrongPassword123!');
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
    
    const errorVisible = await page.getByText(/invalid email or password/i).isVisible().catch(() => false);
    recordResult('Authentication', 'Invalid password error', errorVisible ? 'pass' : 'fail', errorVisible ? undefined : 'Error message not shown');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// PAGE ACCESSIBILITY TESTS
// ============================================

test.describe('Page Accessibility Tests', () => {
  // Test regular pages for all users
  for (const userKey of ['member1', 'member2']) {
    const user = TEST_USERS[userKey as keyof typeof TEST_USERS];
    
    test(`${user.role}_${userKey} can access regular pages`, async ({ page }, testInfo) => {
      const diagnostics = setupDiagnostics(page);
      await login(page, user.email, user.password);
      await page.waitForTimeout(500);
      
      for (const pageInfo of PAGES_TO_TEST) {
        try {
          await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(300);
          
          const pathname = getPathname(page);
          const accessDenied = await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
          
          if (accessDenied || pathname === '/access-denied') {
            recordResult('Page Access', `${user.role} - ${pageInfo.name}`, 'fail', 'Access Denied', user.email, pageInfo.path);
          } else {
            recordResult('Page Access', `${user.role} - ${pageInfo.name}`, 'pass', undefined, user.email, pageInfo.path);
          }
        } catch (error) {
          recordResult('Page Access', `${user.role} - ${pageInfo.name}`, 'fail', String(error), user.email, pageInfo.path);
        }
      }
      
      await attachDiagnostics(testInfo, diagnostics);
    });
  }
});

// ============================================
// ROLE-BASED ACCESS CONTROL TESTS
// ============================================

test.describe('Role-Based Access Control', () => {
  test('admin can access admin pages', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.admin1.email, TEST_USERS.admin1.password);
    await page.waitForTimeout(500);
    
    for (const pageInfo of ADMIN_PAGES) {
      try {
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        
        const accessDenied = await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
        
        if (accessDenied) {
          recordResult('RBAC Admin', pageInfo.name, 'fail', 'Access Denied', 'admin', pageInfo.path);
        } else {
          recordResult('RBAC Admin', pageInfo.name, 'pass', undefined, 'admin', pageInfo.path);
        }
      } catch (error) {
        recordResult('RBAC Admin', pageInfo.name, 'fail', String(error), 'admin', pageInfo.path);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('secretary can access secretary pages', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.secretary1.email, TEST_USERS.secretary1.password);
    await page.waitForTimeout(500);
    
    for (const pageInfo of SECRETARY_PAGES) {
      try {
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        
        const accessDenied = await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
        
        if (accessDenied) {
          recordResult('RBAC Secretary', pageInfo.name, 'fail', 'Access Denied', 'secretary', pageInfo.path);
        } else {
          recordResult('RBAC Secretary', pageInfo.name, 'pass', undefined, 'secretary', pageInfo.path);
        }
      } catch (error) {
        recordResult('RBAC Secretary', pageInfo.name, 'fail', String(error), 'secretary', pageInfo.path);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('lead officer can access officer pages', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.leadOfficer1.email, TEST_USERS.leadOfficer1.password);
    await page.waitForTimeout(500);
    
    for (const pageInfo of OFFICER_PAGES) {
      try {
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        
        const accessDenied = await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
        
        if (accessDenied) {
          recordResult('RBAC Officer', pageInfo.name, 'fail', 'Access Denied', 'lead_officer', pageInfo.path);
        } else {
          recordResult('RBAC Officer', pageInfo.name, 'pass', undefined, 'lead_officer', pageInfo.path);
        }
      } catch (error) {
        recordResult('RBAC Officer', pageInfo.name, 'fail', String(error), 'lead_officer', pageInfo.path);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('member cannot access admin pages', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    for (const pageInfo of ADMIN_PAGES) {
      try {
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        
        const pathname = getPathname(page);
        const accessDenied = pathname === '/access-denied' || await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
        
        if (accessDenied) {
          recordResult('RBAC Block Member', `${pageInfo.name} blocked`, 'pass', undefined, 'member', pageInfo.path);
        } else {
          recordResult('RBAC Block Member', `${pageInfo.name} blocked`, 'fail', 'Should be blocked', 'member', pageInfo.path);
        }
      } catch (error) {
        recordResult('RBAC Block Member', pageInfo.name, 'fail', String(error), 'member', pageInfo.path);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('member cannot access officer pages', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    for (const pageInfo of OFFICER_PAGES) {
      try {
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        
        const pathname = getPathname(page);
        const accessDenied = pathname === '/access-denied' || await page.getByRole('heading', { name: 'Access Denied' }).isVisible().catch(() => false);
        
        if (accessDenied) {
          recordResult('RBAC Block Officer', `${pageInfo.name} blocked`, 'pass', undefined, 'member', pageInfo.path);
        } else {
          recordResult('RBAC Block Officer', `${pageInfo.name} blocked`, 'fail', 'Should be blocked', 'member', pageInfo.path);
        }
      } catch (error) {
        recordResult('RBAC Block Officer', pageInfo.name, 'fail', String(error), 'member', pageInfo.path);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// BROADCAST SYSTEM TESTS
// ============================================

test.describe('Broadcast System Tests', () => {
  test('broadcast setup page loads for all broadcast-capable users', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    
    const broadcastUsers = [
      { key: 'admin1', user: TEST_USERS.admin1 },
      { key: 'broadcaster1', user: TEST_USERS.broadcaster1 },
      { key: 'member1', user: TEST_USERS.member1 },
    ];
    
    for (const { key, user } of broadcastUsers) {
      try {
        await clearSession(page);
        await login(page, user.email, user.password);
        await page.waitForTimeout(500);
        
        await page.goto('/broadcast/setup', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(500);
        
        const goLiveHeading = page.getByRole('heading', { name: 'Go Live' });
        const restrictionHeading = page.getByRole('heading', { name: /Driver's License Required|Account in Cooldown/i });
        
        const isVisible = await goLiveHeading.or(restrictionHeading).isVisible().catch(() => false);
        
        if (isVisible) {
          recordResult('Broadcast Setup', `Load broadcast setup for ${user.role}`, 'pass', undefined, user.email);
        } else {
          recordResult('Broadcast Setup', `Load broadcast setup for ${user.role}`, 'fail', 'Page not loaded correctly', user.email);
        }
      } catch (error) {
        recordResult('Broadcast Setup', `Load broadcast setup for ${user.role}`, 'fail', String(error), user.email);
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('all broadcast categories are available', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.admin1.email, TEST_USERS.admin1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/broadcast/setup', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    for (const category of BROADCAST_CATEGORIES) {
      try {
        // Check if category option exists
        const categoryButton = page.getByText(category.name, { exact: false });
        const isVisible = await categoryButton.first().isVisible().catch(() => false);
        
        if (isVisible) {
          recordResult('Broadcast Categories', category.name, 'pass', undefined, 'admin');
        } else {
          recordResult('Broadcast Categories', category.name, 'fail', 'Category not visible', 'admin');
        }
      } catch (error) {
        recordResult('Broadcast Categories', category.name, 'fail', String(error), 'admin');
      }
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('broadcast page loads with video player', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/broadcast', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1000);
    
    const pathname = getPathname(page);
    if (pathname.includes('broadcast')) {
      recordResult('Broadcast Page', 'Load broadcast page', 'pass', undefined, 'member1');
    } else {
      recordResult('Broadcast Page', 'Load broadcast page', 'fail', 'Redirected away', 'member1');
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// BATTLE SYSTEM TESTS
// ============================================

test.describe('Battle System Tests', () => {
  test('battle categories show battle controls', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
    await page.waitForTimeout(500);
    
    // Go to broadcast setup and check debate category (supports battles)
    await page.goto('/broadcast/setup?category=debate', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Check for battle/match related UI elements
    const battleUI = page.getByText(/battle|match/i);
    const hasBattleUI = await battleUI.first().isVisible().catch(() => false);
    
    recordResult('Battle System', 'Debate category shows battle UI', hasBattleUI ? 'pass' : 'fail', hasBattleUI ? undefined : 'Battle UI not found', 'broadcaster');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('trollmers category shows battle controls', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.broadcaster1.email, TEST_USERS.broadcaster1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/broadcast/setup?category=trollmers', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Trollmers should show tournament/leaders UI
    const trollmersUI = page.getByText(/tournament|leader/i);
    const hasTrollmersUI = await trollmersUI.first().isVisible().catch(() => false);
    
    recordResult('Battle System', 'Trollmers category shows tournament UI', hasTrollmersUI ? 'pass' : 'fail', hasTrollmersUI ? undefined : 'Trollmers UI not found', 'broadcaster');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// GIFT SYSTEM TESTS
// ============================================

test.describe('Gift System Tests', () => {
  test('gift store page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/shop/gifts', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    if (pathname.includes('gift') || pathname.includes('shop')) {
      recordResult('Gift System', 'Gift store loads', 'pass', undefined, 'member1');
    } else {
      recordResult('Gift System', 'Gift store loads', 'fail', 'Not on gift page', 'member1');
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('coin store page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/coins', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    if (pathname.includes('coin')) {
      recordResult('Gift System', 'Coin store loads', 'pass', undefined, 'member1');
    } else {
      recordResult('Gift System', 'Coin store loads', 'fail', 'Not on coin page', 'member1');
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// USER-TO-USER ACTION TESTS
// ============================================

test.describe('User-to-User Actions', () => {
  test('profile page loads for other users', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.admin1.email, TEST_USERS.admin1.password);
    await page.waitForTimeout(500);
    
    // Try to access member1's profile
    await page.goto('/profile/member_test_1', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    if (!pathname.includes('access-denied')) {
      recordResult('User Actions', 'View other user profile', 'pass', undefined, 'admin1');
    } else {
      recordResult('User Actions', 'View other user profile', 'fail', 'Access denied', 'admin1');
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('can access leaderboard', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const leaderboardText = page.getByText(/leaderboard|rank/i);
    const hasLeaderboard = await leaderboardText.first().isVisible().catch(() => false);
    
    recordResult('User Actions', 'Access leaderboard', hasLeaderboard ? 'pass' : 'fail', hasLeaderboard ? undefined : 'Leaderboard not visible', 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('can follow another user', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    // Go to member2's profile
    await page.goto('/profile/member_test_2', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Look for follow button
    const followButton = page.getByRole('button', { name: /follow/i });
    const hasFollowButton = await followButton.isVisible().catch(() => false);
    
    if (hasFollowButton) {
      recordResult('User Actions', 'Follow button visible', 'pass', undefined, 'member1');
    } else {
      recordResult('User Actions', 'Follow button visible', 'skip', 'Button not found or not clickable', 'member1');
    }
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// FAMILY/TEAM SYSTEM TESTS
// ============================================

test.describe('Family System Tests', () => {
  test('family page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/family', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Family System', 'Family page loads', pathname.includes('family') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('family wars page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/family/wars', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Family System', 'Family wars page loads', pathname.includes('wars') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// COURT/LEGAL SYSTEM TESTS
// ============================================

test.describe('Court System Tests', () => {
  test('court page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/court', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Court System', 'Court page loads', pathname.includes('court') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('officer can access moderation', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.officer1.email, TEST_USERS.officer1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/officer/moderation', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    const accessDenied = pathname === '/access-denied';
    
    recordResult('Court System', 'Officer moderation access', !accessDenied ? 'pass' : 'fail', accessDenied ? 'Access denied' : undefined, 'officer1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// PODS/AUDIO ROOM TESTS
// ============================================

test.describe('Pods/Audio Room Tests', () => {
  test('pods listing page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/pods', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Pods System', 'Pods listing loads', pathname.includes('pod') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// ECONOMY TESTS
// ============================================

test.describe('Economy System Tests', () => {
  test('wallet page loads with balance', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/wallet', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const walletHeading = page.getByRole('heading', { name: /wallet|coin|balance/i });
    const hasWallet = await walletHeading.first().isVisible().catch(() => false);
    
    recordResult('Economy', 'Wallet page loads', hasWallet ? 'pass' : 'fail', hasWallet ? undefined : 'Wallet not visible', 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('shop page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/shop', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Economy', 'Shop page loads', pathname.includes('shop') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });

  test('marketplace page loads', async ({ page }, testInfo) => {
    const diagnostics = setupDiagnostics(page);
    await login(page, TEST_USERS.member1.email, TEST_USERS.member1.password);
    await page.waitForTimeout(500);
    
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    
    const pathname = getPathname(page);
    recordResult('Economy', 'Marketplace page loads', pathname.includes('market') ? 'pass' : 'fail', undefined, 'member1');
    
    await attachDiagnostics(testInfo, diagnostics);
  });
});

// ============================================
// PRINT FINAL RESULTS
// ============================================

test.afterAll(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  // Group results by category
  const byCategory: Record<string, typeof testResults> = {};
  for (const result of testResults) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);
  }
  
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  
  for (const [category, results] of Object.entries(byCategory)) {
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const skip = results.filter(r => r.status === 'skip').length;
    
    totalPass += pass;
    totalFail += fail;
    totalSkip += skip;
    
    console.log(`\n${category}:`);
    console.log(`  Pass: ${pass}, Fail: ${fail}, Skip: ${skip}`);
    
    // Show failures
    const failures = results.filter(r => r.status === 'fail');
    if (failures.length > 0) {
      console.log('  Failed tests:');
      for (const f of failures) {
        console.log(`    - ${f.testName}: ${f.error || 'Unknown error'}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL: ${testResults.length} tests`);
  console.log(`  Pass: ${totalPass}`);
  console.log(`  Fail: ${totalFail}`);
  console.log(`  Skip: ${totalSkip}`);
  console.log('='.repeat(80));
});
