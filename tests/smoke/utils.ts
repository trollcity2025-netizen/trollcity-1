import type { Page, TestInfo } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Test123!@#';

export const TEST_USERS = {
  admin: { email: 'admin@test.com', password: TEST_PASSWORD },
  secretary: { email: 'secretary@test.com', password: TEST_PASSWORD },
  leadOfficer: { email: 'lead.troll@test.com', password: TEST_PASSWORD },
  officer: { email: 'officer@test.com', password: TEST_PASSWORD },
  user: { email: 'user@test.com', password: TEST_PASSWORD },
};

// Initialize Supabase client for test setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function ensureProfileComplete(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  
  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const profileData = profile as Record<string, any> | null;
    if (!profileData) return;
    
    // Ensure all required fields are set
    const updates: Record<string, any> = {};
    if (!profileData.full_name) updates.full_name = 'Test User';
    if (!profileData.username) updates.username = `user_${userId.substring(0, 8)}`;
    if (!profileData.gender) updates.gender = 'male';
    if (!profileData.terms_accepted) updates.terms_accepted = true;
    if (!profileData.court_recording_consent) updates.court_recording_consent = true;
    
    if (Object.keys(updates).length > 0) {
      const sb = supabase as any;
      await sb
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);
    }
  } catch {
    // Silently fail - test will proceed anyway
    console.warn('Failed to ensure profile complete');
  }
}

export async function login(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 });

  // Wait a moment for auth store to update
  await page.waitForTimeout(1000);

  // Get userId from localStorage (set by auth store)
  const userId = await page.evaluate(() => {
    try {
      const authState = localStorage.getItem('auth-store');
      if (authState) {
        const parsed = JSON.parse(authState);
        return parsed.state?.user?.id;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  });

  // Ensure profile is complete
  if (userId) {
    await ensureProfileComplete(userId);
  }

  // Wait for redirect if still on profile setup
  if (getPathname(page).startsWith('/profile/setup')) {
    const continueButton = page.getByRole('button', { name: /continue to home/i });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForURL((url) => !url.pathname.startsWith('/profile/setup'), { timeout: 15000 });
    }
  }
}

export async function logout(page: Page) {
  const logoutButton = page.getByTitle('Logout');
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/auth/, { timeout: 15000 });
    return;
  }

  await clearSession(page);
}

export function setupDiagnostics(page: Page) {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    requestFailures.push(`${req.method()} ${req.url()} -> ${failure?.errorText || 'unknown error'}`);
  });

  return { consoleMessages, pageErrors, requestFailures };
}

export async function attachDiagnostics(testInfo: TestInfo, diagnostics: ReturnType<typeof setupDiagnostics>) {
  if (testInfo.status === testInfo.expectedStatus) return;

  if (diagnostics.consoleMessages.length > 0) {
    await testInfo.attach('console-errors', {
      body: diagnostics.consoleMessages.join('\n'),
      contentType: 'text/plain',
    });
  }

  if (diagnostics.pageErrors.length > 0) {
    await testInfo.attach('page-errors', {
      body: diagnostics.pageErrors.join('\n'),
      contentType: 'text/plain',
    });
  }

  if (diagnostics.requestFailures.length > 0) {
    await testInfo.attach('request-failures', {
      body: diagnostics.requestFailures.join('\n'),
      contentType: 'text/plain',
    });
  }
}

export async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 1;
  });

  if (hasOverflow) {
    throw new Error('Horizontal overflow detected');
  }
}

export function getPathname(page: Page) {
  return new URL(page.url()).pathname;
}
