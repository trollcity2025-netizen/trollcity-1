
import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { attachDiagnostics, login, logout, setupDiagnostics, TEST_USERS } from './utils';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, serviceRoleKey!);

const password = process.env.TEST_USER_PASSWORD || 'Test123!@#';

const SMOKE_TEST_USERS: { [key: string]: { email: string; password?: string; username: string; role?: string; } } = {
  broadcaster1: { email: 'broadcaster1@test.com', password, username: 'broadcaster1' },
  broadcaster2: { email: 'broadcaster2@test.com', password, username: 'broadcaster2' },
  viewer1: { email: 'viewer1@test.com', password, username: 'viewer1' },
  viewer2: { email: 'viewer2@test.com', password, username: 'viewer2' },
  judge: { email: 'judge@test.com', password, username: 'judge', role: 'lead_troll_officer' },
  jail_user: { email: 'jail_user@test.com', password, username: 'jail_user' },
  coins_user: { email: 'coins_user@test.com', password, username: 'coins_user' },
  mute_user: { email: 'mute_user@test.com', password, username: 'mute_user' },
};

async function createTestUser(user: any) {
  let userId;
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes('User already registered')) {
      console.log(`User ${user.email} already exists, fetching ID.`);
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing users:', listError);
        return;
      }
      const existingUser = users.users.find(u => u.email === user.email);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        console.error(`Could not find existing user ${user.email} after creation failed.`);
        return;
      }
    } else {
      console.error('Error creating user:', createError.message);
      return;
    }
  } else if (newUser?.user) {
    userId = newUser.user.id;
  }

  if (userId) {
    await supabase.from('user_profiles').upsert({
      id: userId,
      email: user.email,
      username: user.username,
      role: user.role || 'user',
      is_test_user: true,
      troll_coins: 1000,
      is_admin: user.role === 'admin',
    });
  }
}

async function deleteTestUsers() {
    const usersToDelete = Object.values(SMOKE_TEST_USERS).map(u => u.email);

    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('Error listing users for deletion:', error);
        return;
    }

    for (const user of users.users) {
        if (user.email && usersToDelete.includes(user.email)) {
            await supabase.auth.admin.deleteUser(user.id);
        }
    }
}

const BATTLE_DURATION = 3 * 60 * 1000; // 3 minutes

test.describe('Full Smoke Test', () => {
  test.beforeAll(async () => {
    await createTestUser({ ...TEST_USERS.admin, username: 'admin_smoke', role: 'admin' });

    for (let i = 0; i < 5; i++) {
      await createTestUser({ email: `broadcaster${i}@test.com`, password, username: `broadcaster${i}` });
    }

    for (let i = 0; i < 45; i++) {
      await createTestUser({ email: `viewer${i}@test.com`, password, username: `viewer${i}` });
    }

    for (const user of Object.values(SMOKE_TEST_USERS)) {
      await createTestUser(user);
    }
  });

  test.afterAll(async () => {
    await deleteTestUsers();
    const usersToDelete = [];
    for (let i = 0; i < 5; i++) {
        usersToDelete.push(`broadcaster${i}@test.com`);
    }
    for (let i = 0; i < 45; i++) {
        usersToDelete.push(`viewer${i}@test.com`);
    }

    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('Error listing users for deletion:', error);
        return;
    }

    for (const user of users.users) {
        if (user.email && usersToDelete.includes(user.email)) {
            await supabase.auth.admin.deleteUser(user.id);
        }
    }
  });

  test('run full smoke test', async ({ page }, testInfo) => {
    test.setTimeout(BATTLE_DURATION + 60 * 1000);
    const diagnostics = setupDiagnostics(page);

    // 1. Auth and Roles
    await login(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await page.waitForSelector('[role="link"][href="/admin/creator-safety"]');
    await expect(page.getByRole('heading', { name: 'City Feed' })).toBeVisible();
    // check for admin panel
    await expect(page.getByRole('link', { name: 'Creator Safety' })).toBeVisible();
    await logout(page);

    await login(page, 'broadcaster0@test.com', password);
    await expect(page.getByRole('heading', { name: 'City Feed' })).toBeVisible();
    // check that admin panel is not visible
    await expect(page.getByRole('link', { name: 'Creator Safety' })).not.toBeVisible();

    // Verify credit score is visible on profile
    await page.goto('/@broadcaster0');
    await expect(page.getByText('Credit Score')).toBeVisible();
    // The default score is 400
    await expect(page.getByText('400')).toBeVisible();



    // 2. Create Broadcast
    await page.goto('/broadcast/setup');
    await page.getByRole('button', { name: 'Go Live' }).click();
    await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();

    const broadcastUrl = page.url();

    // 3. Live Chat
    const viewer1Page = await page.context().newPage();
    await login(viewer1Page, 'viewer0@test.com', password);
    await viewer1Page.goto(broadcastUrl);
    await viewer1Page.getByPlaceholder('Say something...').fill('Hello from viewer0!');
    await viewer1Page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Hello from viewer0!')).toBeVisible();


    // 4. Create Battle
    await page.getByRole('button', { name: 'Start Battle' }).click();
    const battleInviteUrl = await page.getByLabel('Copy Invite Link').inputValue();

    const broadcaster2Page = await page.context().newPage();
    await login(broadcaster2Page, 'broadcaster1@test.com', password);
    await broadcaster2Page.goto(battleInviteUrl);
    await expect(broadcaster2Page.getByText('Battle in progress')).toBeVisible();

    await page.waitForTimeout(BATTLE_DURATION);

    // 5. Gifting
    await viewer1Page.getByRole('button', { name: 'Send Gift' }).click();
    await viewer1Page.getByText('Common Velvet Ember').click();
    await expect(page.getByText('viewer0 sent a Common Velvet Ember')).toBeVisible();

    // 6. Sudden Death
    // This is a placeholder for triggering and verifying sudden death
    // I will need to investigate how to trigger this
    console.log('Sudden Death testing needs implementation');

    // 7. Troll Court
    const judgePage = await page.context().newPage();
    await login(judgePage, SMOKE_TEST_USERS.judge.email, SMOKE_TEST_USERS.judge.password);
    await judgePage.goto('/troll-court');

    // Sentence user to jail
    await judgePage.getByRole('row', { name: SMOKE_TEST_USERS.jail_user.username }).getByRole('button', { name: 'Sentence' }).click();
    await judgePage.getByRole('option', { name: 'Jail' }).click();
    await judgePage.getByRole('button', { name: 'Submit Sentence' }).click();

    // Verify user is in jail
    const { data: jailedUser, error: jailedUserError } = await supabase
        .from('user_profiles')
        .select('is_jailed')
        .eq('email', SMOKE_TEST_USERS.jail_user.email)
        .single();
    expect(jailedUserError).toBeNull();
    expect(jailedUser?.is_jailed).toBe(true);


    // Sentence user to pay coins
    const { data: coinsUserBefore, error: coinsUserBeforeError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('email', SMOKE_TEST_USERS.coins_user.email)
        .single();
    expect(coinsUserBeforeError).toBeNull();

    await judgePage.getByRole('row', { name: SMOKE_TEST_USERS.coins_user.username }).getByRole('button', { name: 'Sentence' }).click();
    await judgePage.getByRole('option', { name: 'Coins' }).click();
    await judgePage.getByRole('button', { name: 'Submit Sentence' }).click();

    const { data: coinsUserAfter, error: coinsUserAfterError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('email', SMOKE_TEST_USERS.coins_user.email)
        .single();
    expect(coinsUserAfterError).toBeNull();
    expect(coinsUserAfter?.troll_coins).toBeLessThan(coinsUserBefore!.troll_coins);

    // Sentence user to be muted
    await judgePage.getByRole('row', { name: SMOKE_TEST_USERS.mute_user.username }).getByRole('button', { name: 'Sentence' }).click();
    await judgePage.getByRole('option', { name: 'Mute' }).click();
    await judgePage.getByRole('button', { name: 'Submit Sentence' }).click();

    const muteUserPage = await page.context().newPage();
    await login(muteUserPage, SMOKE_TEST_USERS.mute_user.email, SMOKE_TEST_USERS.mute_user.password);
    await muteUserPage.goto(broadcastUrl);
    await muteUserPage.getByPlaceholder('Say something...').fill('This message should not appear');
    await muteUserPage.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('This message should not appear')).not.toBeVisible();

    // 8. Delete Account
    await login(page, 'broadcaster0@test.com', password);
    await page.goto('/profile/settings');
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await page.getByRole('button', { name: 'Confirm Deletion' }).click();
    await expect(page).toHaveURL(/\/auth/);


    await attachDiagnostics(testInfo, diagnostics);
  });
});
