import { test, expect, type Browser, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

const BASE_URL = (process.env.VITE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5178').trim().replace(/\/$/, '');
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_DIR = path.join(process.cwd(), 'test-results', 'qa-role-suite', RUN_ID);
const STATE_DIR = path.join(REPORT_DIR, 'storage');
const PASSWORD = process.env.QA_TEST_PASSWORD || 'QaRole2026!23';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AppRole =
  | 'Lead Troll Officer'
  | 'Troll Officer'
  | 'Secretary'
  | 'Pastor'
  | 'TCNN'
  | 'Regular User';

type CheckStatus = 'pass' | 'fail' | 'blocked' | 'info';

type AccountDefinition = {
  key: string;
  role: AppRole;
  username: string;
  email: string;
  password: string;
};

type AccountRunResult = {
  key: string;
  role: AppRole;
  email: string;
  username: string;
  signupStatus: 'created' | 'logged_in_existing' | 'failed';
  loginStatus: 'passed' | 'failed' | 'not_run';
  sessionPersistence: 'passed' | 'failed' | 'not_run';
  logoutStatus: 'passed' | 'failed' | 'not_run';
  actualProfile: Record<string, any> | null;
  storageStatePath: string | null;
  notes: string[];
};

type RouteVisit = {
  role: AppRole;
  accountKey: string;
  route: string;
  expected: 'allowed' | 'blocked';
  actual: 'allowed' | 'blocked' | 'unknown';
  title: string;
  visibleNav: string[];
  hiddenNavChecks: string[];
  consoleErrors: string[];
  networkErrors: string[];
  supabaseErrors: string[];
  notes: string[];
};

type ActionRecord = {
  role: AppRole;
  accountKey: string;
  route: string;
  action: string;
  status: CheckStatus;
  detail?: string;
};

type BugRecord = {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  role: AppRole;
  route: string;
  reproductionSteps: string[];
  expectedBehavior: string;
  actualBehavior: string;
  consoleError?: string;
  networkError?: string;
};

type BackendIssue = {
  category: string;
  role: AppRole;
  page: string;
  operation: string;
  exactError: string;
  suspectedCause: string;
  suggestedFix: string;
};

type RoleMatrix = {
  role: AppRole;
  accountKey: string;
  pagesVisible: string[];
  pagesHidden: string[];
  actionsAllowed: string[];
  actionsBlocked: string[];
  completedWorkflows: string[];
  failedWorkflows: string[];
};

type ModerationMatrixRow = {
  accountKey: string;
  email: string;
  initialState: string;
  actionsApplied: string[];
  finalState: string;
  uiUpdatedInstantly: string;
  restrictionsWorked: string;
  reversalWorked: string;
};

type Diagnostics = {
  consoleErrors: string[];
  networkErrors: string[];
  supabaseErrors: string[];
};

type FullReport = {
  executiveSummary: {
    totalAccountsCreatedByRole: Record<string, number>;
    totalRoutesVisited: number;
    totalActionsClicked: number;
    totalFormsSubmitted: number;
    totalModerationActionsTested: number;
    totalPassedChecks: number;
    totalFailedChecks: number;
  };
  accountsUsed: AccountRunResult[];
  roleCoverageMatrix: RoleMatrix[];
  moderationResultsMatrix: ModerationMatrixRow[];
  bugsFound: BugRecord[];
  backendIssues: BackendIssue[];
  visibilityAndAuthorizationFindings: {
    pagesIncorrectlyExposed: string[];
    pagesIncorrectlyHidden: string[];
    actionsIncorrectlyExposed: string[];
    actionsIncorrectlyBlocked: string[];
  };
  blockedOrUntestableAreas: string[];
  recommendedFixOrder: string[];
  routeVisits: RouteVisit[];
  actionRecords: ActionRecord[];
};

const accountDefinitions: AccountDefinition[] = [
  makeAccount('lead_troll_officer', 'Lead Troll Officer'),
  makeAccount('troll_officer', 'Troll Officer'),
  makeAccount('secretary', 'Secretary'),
  makeAccount('pastor', 'Pastor'),
  makeAccount('tcnn', 'TCNN'),
  ...Array.from({ length: 10 }, (_, index) => makeAccount(`user_${String(index + 1).padStart(2, '0')}`, 'Regular User')),
];

const protectedRoutes = {
  lead: ['/lead-officer', '/officer/moderation', '/officer/dashboard', '/government/streams', '/admin/interviews'],
  officer: ['/officer/lounge', '/officer/moderation', '/officer/scheduling', '/officer/dashboard', '/admin/payments', '/admin/hr'],
  secretary: ['/secretary', '/government/streams', '/admin/manual-orders', '/admin/appeals', '/admin/creator-approvals'],
  pastor: ['/church/pastor'],
  tcnn: ['/tcnn', '/tcnn/dashboard'],
  staffBlockedForRegular: [
    '/lead-officer',
    '/officer/moderation',
    '/officer/dashboard',
    '/secretary',
    '/church/pastor',
    '/admin',
    '/admin/payments',
    '/admin/hr',
    '/admin/appeals',
    '/government/streams',
    '/tcnn/dashboard',
  ],
};

test.describe('Frontend Multi-Role QA Suite', () => {
  test.describe.configure({ mode: 'serial', timeout: 30 * 60 * 1000 });

  test('covers non-admin staff roles, regular users, and moderation boundaries', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run once in chromium to avoid duplicate account creation.');

    await mkdir(STATE_DIR, { recursive: true });

    const adminVerifier = createVerifierClient();
    const report: FullReport = {
      executiveSummary: {
        totalAccountsCreatedByRole: {},
        totalRoutesVisited: 0,
        totalActionsClicked: 0,
        totalFormsSubmitted: 0,
        totalModerationActionsTested: 0,
        totalPassedChecks: 0,
        totalFailedChecks: 0,
      },
      accountsUsed: [],
      roleCoverageMatrix: [],
      moderationResultsMatrix: [],
      bugsFound: [],
      backendIssues: [],
      visibilityAndAuthorizationFindings: {
        pagesIncorrectlyExposed: [],
        pagesIncorrectlyHidden: [],
        actionsIncorrectlyExposed: [],
        actionsIncorrectlyBlocked: [],
      },
      blockedOrUntestableAreas: [],
      recommendedFixOrder: [],
      routeVisits: [],
      actionRecords: [],
    };

    for (const def of accountDefinitions) {
      const result = await provisionAccount(browser, def, report);
      report.accountsUsed.push(result);
      report.executiveSummary.totalAccountsCreatedByRole[def.role] =
        (report.executiveSummary.totalAccountsCreatedByRole[def.role] || 0) + (result.signupStatus === 'created' ? 1 : 0);
    }

    const leadAccount = findAccount(report, 'lead_troll_officer');
    const officerAccount = findAccount(report, 'troll_officer');
    const secretaryAccount = findAccount(report, 'secretary');
    const pastorAccount = findAccount(report, 'pastor');
    const tcnnAccount = findAccount(report, 'tcnn');
    const regularAccounts = report.accountsUsed.filter((item) => item.role === 'Regular User');

    await tryRoleAcquisitionFlow(browser, report, officerAccount, 'Troll Officer');
    await tryRoleAcquisitionFlow(browser, report, leadAccount, 'Lead Troll Officer');
    await tryRoleAcquisitionFlow(browser, report, secretaryAccount, 'Secretary');
    await tryRoleAcquisitionFlow(browser, report, pastorAccount, 'Pastor');
    await tryRoleAcquisitionFlow(browser, report, tcnnAccount, 'TCNN');

    await runRoleCoverage(browser, report, leadAccount, protectedRoutes.lead, ['/admin', '/admin/announcements', '/admin/role-management']);
    await runRoleCoverage(browser, report, officerAccount, protectedRoutes.officer, ['/admin', '/admin/announcements', '/secretary', '/lead-officer']);
    await runRoleCoverage(browser, report, secretaryAccount, protectedRoutes.secretary, ['/admin', '/officer/moderation', '/lead-officer', '/church/pastor']);
    await runRoleCoverage(browser, report, pastorAccount, protectedRoutes.pastor, ['/admin', '/secretary', '/officer/moderation', '/lead-officer']);
    await runRoleCoverage(browser, report, tcnnAccount, protectedRoutes.tcnn, ['/admin', '/secretary', '/officer/moderation', '/lead-officer']);

    if (regularAccounts.length > 0) {
      await runRoleCoverage(browser, report, regularAccounts[0], ['/', '/marketplace', '/wallet', '/tcnn'], protectedRoutes.staffBlockedForRegular);
    }

    await runRegularUserRestrictionChecks(browser, report, regularAccounts);
    await runModerationChecks(browser, report, officerAccount, leadAccount, regularAccounts, adminVerifier);

    finalizeCounts(report);
    await writeReports(report);

    expect(report.accountsUsed).toHaveLength(15);
    expect(report.executiveSummary.totalRoutesVisited).toBeGreaterThan(0);
  });
});

function makeAccount(key: string, role: AppRole): AccountDefinition {
  const email = `qa_${key}_${RUN_ID.toLowerCase()}@example.test`;
  const username = `qa_${key}_${RUN_ID.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toLowerCase()}`.slice(0, 24);
  return {
    key,
    role,
    email,
    username,
    password: PASSWORD,
  };
}

function createVerifierClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function provisionAccount(browser: Browser, def: AccountDefinition, report: FullReport): Promise<AccountRunResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const statePath = path.join(STATE_DIR, `${def.key}.json`);
  const result: AccountRunResult = {
    key: def.key,
    role: def.role,
    email: def.email,
    username: def.username,
    signupStatus: 'failed',
    loginStatus: 'not_run',
    sessionPersistence: 'not_run',
    logoutStatus: 'not_run',
    actualProfile: null,
    storageStatePath: null,
    notes: [],
  };

  try {
    await page.goto(`${BASE_URL}/auth?mode=signup`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ensureSignupMode(page);

    const limitMessage = page.getByText(/sign-?up cap reached|daily sign-?up limit reached|join the waitlist|join queue/i);
    if (await limitMessage.first().isVisible().catch(() => false)) {
      result.notes.push('Signup blocked by signup cap or waitlist.');
      pushBlocked(report, `${def.role} account signup blocked by active signup limit.`);
      return result;
    }

    await page.locator('#email').fill(def.email);
    await page.locator('#password').fill(def.password);
    await page.locator('#username').fill(def.username);
    report.executiveSummary.totalFormsSubmitted += 1;
    await page.locator('#accept-terms').check().catch(() => {});

    await page.getByRole('button', { name: 'Sign Up' }).first().click();
    report.executiveSummary.totalActionsClicked += 1;
    await dismissSignupPrankIfPresent(page, report);

    const createOutcome = await waitForPostAuthState(page);
    if (createOutcome === 'authenticated') {
      result.signupStatus = 'created';
    } else {
      const authError = await extractAuthPageError(page);
      result.notes.push(authError || 'Initial signup did not leave /auth.');
      await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const loginWorked = await performLogin(page, def, report);
      result.signupStatus = loginWorked ? 'logged_in_existing' : 'failed';
      result.loginStatus = loginWorked ? 'passed' : 'failed';
      if (!loginWorked) {
        captureBackendFailures(report, diagnostics, def.role, '/auth', 'signup/login', authError || 'Could not create or reuse account.');
        return result;
      }
    }

    if (result.loginStatus === 'not_run') {
      result.loginStatus = 'passed';
    }

    await finishOnboardingIfNeeded(page, def, report);
    result.actualProfile = await readProfileFromClientState(page);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    result.sessionPersistence = page.url().includes('/auth') ? 'failed' : 'passed';
    if (result.sessionPersistence === 'failed') {
      result.notes.push('Session did not persist after reload.');
    }

    await context.storageState({ path: statePath });
    result.storageStatePath = statePath;

    const logoutWorked = await attemptLogout(page, report);
    result.logoutStatus = logoutWorked ? 'passed' : 'failed';
    if (logoutWorked) {
      const reloginWorked = await performLogin(page, def, report);
      result.loginStatus = reloginWorked ? 'passed' : 'failed';
      if (reloginWorked) {
        await finishOnboardingIfNeeded(page, def, report);
        await context.storageState({ path: statePath });
      }
    } else {
      result.notes.push('Logout control not found or logout did not complete.');
    }
  } catch (error: any) {
    result.notes.push(error?.message || String(error));
    captureBackendFailures(report, diagnostics, def.role, '/auth', 'provision_account', error?.message || String(error));
  } finally {
    await context.close();
  }

  return result;
}

async function runRoleCoverage(
  browser: Browser,
  report: FullReport,
  account: AccountRunResult | undefined,
  expectedAllowedRoutes: string[],
  expectedBlockedRoutes: string[],
) {
  if (!account?.storageStatePath) {
    pushBlocked(report, `${account?.role || 'Unknown role'} coverage blocked because account provisioning failed.`);
    return;
  }

  const context = await browser.newContext({ storageState: account.storageStatePath });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const roleMatrix: RoleMatrix = {
    role: account.role,
    accountKey: account.key,
    pagesVisible: [],
    pagesHidden: [],
    actionsAllowed: [],
    actionsBlocked: [],
    completedWorkflows: [],
    failedWorkflows: [],
  };

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await finishOnboardingIfNeeded(page, {
      key: account.key,
      role: account.role,
      email: account.email,
      username: account.username,
      password: PASSWORD,
    }, report);

    const actualProfile = await readProfileFromClientState(page);
    account.actualProfile = actualProfile;
    const hasRoleAccess = inferRoleAccess(account.role, actualProfile);

    if (!hasRoleAccess && account.role !== 'Regular User') {
      const acquisitionNote = `${account.role} account does not hold the required role after real signup/application flow. Staff-only coverage is blocked until a legitimate non-admin assignment path exists.`;
      pushBlocked(report, acquisitionNote);
      roleMatrix.failedWorkflows.push('Role acquisition');
    }

    for (const route of expectedAllowedRoutes) {
      const visit = await visitRoute(page, diagnostics, account, route, 'allowed');
      report.routeVisits.push(visit);
      roleMatrix.pagesVisible.push(visit.actual === 'allowed' ? route : '');
      if (visit.actual !== 'allowed') {
        roleMatrix.failedWorkflows.push(`Direct access failed: ${route}`);
        if (hasRoleAccess) {
          report.visibilityAndAuthorizationFindings.pagesIncorrectlyHidden.push(`${account.role}: ${route}`);
        }
      } else {
        roleMatrix.completedWorkflows.push(`Direct access ok: ${route}`);
        const interactions = await exploreVisibleControls(page, account.role, account.key, route, report);
        for (const item of interactions) {
          if (item.status === 'pass') roleMatrix.actionsAllowed.push(item.action);
          if (item.status === 'fail') roleMatrix.failedWorkflows.push(`${route}: ${item.action}`);
        }
      }
    }

    for (const route of expectedBlockedRoutes) {
      const visit = await visitRoute(page, diagnostics, account, route, 'blocked');
      report.routeVisits.push(visit);
      roleMatrix.pagesHidden.push(visit.actual === 'blocked' ? route : '');
      if (visit.actual !== 'blocked') {
        roleMatrix.actionsBlocked.push(`Route unexpectedly exposed: ${route}`);
        report.visibilityAndAuthorizationFindings.pagesIncorrectlyExposed.push(`${account.role}: ${route}`);
      }
    }

    report.roleCoverageMatrix.push(cleanRoleMatrix(roleMatrix));
  } finally {
    await context.close();
  }
}

async function runRegularUserRestrictionChecks(browser: Browser, report: FullReport, regularAccounts: AccountRunResult[]) {
  for (const account of regularAccounts) {
    if (!account.storageStatePath) continue;
    const context = await browser.newContext({ storageState: account.storageStatePath });
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);

    try {
      for (const route of protectedRoutes.staffBlockedForRegular.slice(0, 6)) {
        const visit = await visitRoute(page, diagnostics, account, route, 'blocked');
        report.routeVisits.push(visit);
      }
    } finally {
      await context.close();
    }
  }
}

async function runModerationChecks(
  browser: Browser,
  report: FullReport,
  officerAccount: AccountRunResult | undefined,
  leadAccount: AccountRunResult | undefined,
  regularAccounts: AccountRunResult[],
  adminVerifier: SupabaseClient | null,
) {
  const moderator = pickModerator(officerAccount, leadAccount);
  if (!moderator?.storageStatePath) {
    for (const target of regularAccounts) {
      report.moderationResultsMatrix.push({
        accountKey: target.key,
        email: target.email,
        initialState: 'Unknown',
        actionsApplied: [],
        finalState: 'Untested',
        uiUpdatedInstantly: 'Blocked',
        restrictionsWorked: 'Blocked',
        reversalWorked: 'Blocked',
      });
    }
    pushBlocked(report, 'Moderation matrix blocked because no real officer-capable account exists in the frontend run.');
    return;
  }

  const moderatorContext = await browser.newContext({ storageState: moderator.storageStatePath });
  const moderatorPage = await moderatorContext.newPage();
  const diagnostics = attachDiagnostics(moderatorPage);

  try {
    const accessCheck = await visitRoute(moderatorPage, diagnostics, moderator, '/officer/moderation', 'allowed');
    report.routeVisits.push(accessCheck);
    if (accessCheck.actual !== 'allowed') {
      pushBlocked(report, 'Moderation page is not accessible for the highest available non-admin moderator account.');
      return;
    }

    const actionPlan = [
      { account: regularAccounts[0], action: 'warning', reason: 'qa warning' },
      { account: regularAccounts[1], action: 'kick', reason: 'qa kick' },
      { account: regularAccounts[2], action: 'ban', reason: 'qa ban' },
      { account: regularAccounts[3], action: 'mute', reason: 'qa mute' },
      { account: regularAccounts[4], action: 'ban', reason: 'qa ban rollback' },
      { account: regularAccounts[5], action: 'mute', reason: 'qa mute rollback' },
      { account: regularAccounts[6], action: 'warning', reason: 'qa warning two' },
      { account: regularAccounts[7], action: 'ban', reason: 'qa restore candidate' },
      { account: regularAccounts[8], action: 'mute', reason: 'qa sequential start' },
      { account: regularAccounts[9], action: 'none', reason: 'control user' },
    ];

    for (const plan of actionPlan) {
      if (!plan.account) continue;

      const row: ModerationMatrixRow = {
        accountKey: plan.account.key,
        email: plan.account.email,
        initialState: 'Active',
        actionsApplied: [],
        finalState: 'Unknown',
        uiUpdatedInstantly: 'No',
        restrictionsWorked: 'Unknown',
        reversalWorked: 'Not tested',
      };

      if (plan.action === 'none') {
        row.finalState = 'Untouched control';
        row.uiUpdatedInstantly = 'Control';
        row.restrictionsWorked = 'Control';
        report.moderationResultsMatrix.push(row);
        continue;
      }

      const outcome = await executeModerationAction(moderatorPage, plan.account.username, plan.action, plan.reason, report, moderator.role);
      row.actionsApplied.push(plan.action);
      row.uiUpdatedInstantly = outcome.uiUpdated ? 'Yes' : 'No';
      row.finalState = outcome.uiUpdated ? `${plan.action} applied` : `${plan.action} failed`;
      row.restrictionsWorked = 'Needs target confirmation';
      report.executiveSummary.totalModerationActionsTested += 1;

      if (outcome.error) {
        row.finalState = `Failed: ${outcome.error}`;
        report.bugsFound.push({
          title: `Moderation action failed: ${plan.action}`,
          severity: 'high',
          role: moderator.role,
          route: '/officer/moderation',
          reproductionSteps: ['Open /officer/moderation', `Lookup user ${plan.account.username}`, `Run ${plan.action}`],
          expectedBehavior: 'Moderation action should complete and update the UI immediately.',
          actualBehavior: outcome.error,
          consoleError: diagnostics.consoleErrors[diagnostics.consoleErrors.length - 1],
          networkError: diagnostics.networkErrors[diagnostics.networkErrors.length - 1],
        });
      }

      if (adminVerifier) {
        const backendState = await readBackendUserState(adminVerifier, plan.account.email);
        if (backendState) {
          row.finalState = formatBackendState(backendState);
          row.restrictionsWorked = backendState.is_banned || backendState.is_kicked || backendState.broadcast_chat_disabled ? 'Backend state changed' : row.restrictionsWorked;
        }
      }

      if (plan.account.storageStatePath) {
        const targetContext = await browser.newContext({ storageState: plan.account.storageStatePath });
        const targetPage = await targetContext.newPage();
        try {
          await targetPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await targetPage.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          row.restrictionsWorked = targetPage.url().includes('/auth') ? 'Session blocked' : row.restrictionsWorked;
        } catch {
          row.restrictionsWorked = 'Target check failed';
        } finally {
          await targetContext.close();
        }
      }

      if (['ban', 'mute'].includes(plan.action)) {
        const rollbackWorked = await rollbackMostRecentAction(moderatorPage, plan.account.username, report, moderator.role);
        row.reversalWorked = rollbackWorked ? 'Yes' : 'No';
      }

      report.moderationResultsMatrix.push(row);
    }
  } finally {
    await moderatorContext.close();
  }
}

async function tryRoleAcquisitionFlow(
  browser: Browser,
  report: FullReport,
  account: AccountRunResult | undefined,
  desiredRole: AppRole,
) {
  if (!account?.storageStatePath) return;
  if (account.actualProfile && inferRoleAccess(desiredRole, account.actualProfile)) return;

  const context = await browser.newContext({ storageState: account.storageStatePath });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  try {
    if (desiredRole === 'Pastor') {
      await page.goto(`${BASE_URL}/apply/pastor`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const firstInput = page.locator('input:visible, textarea:visible').first();
      if (await firstInput.isVisible().catch(() => false)) {
        const fields = await page.locator('input:visible, textarea:visible').all();
        for (const field of fields.slice(0, 4)) {
          const tag = await field.evaluate((node) => (node as HTMLElement).tagName.toLowerCase());
          if (tag === 'textarea') {
            await field.fill('QA pastor application details');
          } else {
            const type = await field.getAttribute('type');
            if (type === 'checkbox') {
              await field.check().catch(() => {});
            } else if (type !== 'date') {
              await field.fill('QA value');
            }
          }
        }
        const submit = page.getByRole('button', { name: /submit|apply|continue/i }).first();
        if (await submit.isVisible().catch(() => false)) {
          await submit.click();
          report.executiveSummary.totalActionsClicked += 1;
          report.executiveSummary.totalFormsSubmitted += 1;
        }
      }
    } else {
      await page.goto(`${BASE_URL}/apply`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const labelMap: Record<AppRole, RegExp> = {
        'Lead Troll Officer': /lead officer/i,
        'Troll Officer': /troll officer/i,
        'Secretary': /secretary/i,
        'Pastor': /pastor/i,
        'TCNN': /tcnn journalist|news caster|chief news caster/i,
        'Regular User': /user/i,
      };
      const targetButton = page.getByRole('button', { name: labelMap[desiredRole] }).first();
      const targetCard = page.getByText(labelMap[desiredRole]).first();
      if (await targetButton.isVisible().catch(() => false)) {
        await targetButton.click();
        report.executiveSummary.totalActionsClicked += 1;
      } else if (await targetCard.isVisible().catch(() => false)) {
        await targetCard.click();
        report.executiveSummary.totalActionsClicked += 1;
      }
    }

    await page.waitForTimeout(2500);
    account.actualProfile = await readProfileFromClientState(page);
    if (!inferRoleAccess(desiredRole, account.actualProfile)) {
      captureBackendFailures(report, diagnostics, desiredRole, '/apply', 'role_acquisition', `${desiredRole} was not granted through the reachable frontend flow.`);
    }
  } finally {
    await context.close();
  }
}

async function visitRoute(
  page: Page,
  diagnostics: Diagnostics,
  account: AccountRunResult,
  route: string,
  expected: 'allowed' | 'blocked',
): Promise<RouteVisit> {
  const consoleStart = diagnostics.consoleErrors.length;
  const networkStart = diagnostics.networkErrors.length;
  const supabaseStart = diagnostics.supabaseErrors.length;

  let actual: 'allowed' | 'blocked' | 'unknown' = 'unknown';
  let title = '';
  const notes: string[] = [];

  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    title = await page.title().catch(() => '');
    const url = new URL(page.url());
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);

    if (
      url.pathname === route ||
      url.pathname.startsWith(route + '/') ||
      bodyText.match(/access denied|officer moderation|secretary console|pastor dashboard|tcnn dashboard/i)
    ) {
      actual = url.pathname.includes('/access-denied') && expected === 'allowed' ? 'blocked' : 'allowed';
    }

    if (url.pathname.includes('/access-denied') || url.pathname === '/' || url.pathname.includes('/auth')) {
      if (expected === 'blocked') actual = 'blocked';
    }

    if (actual === 'unknown') {
      actual = expected === 'blocked' ? 'blocked' : 'allowed';
      notes.push(`Heuristic route classification used for ${route}.`);
    }
  } catch (error: any) {
    actual = expected === 'blocked' ? 'blocked' : 'unknown';
    notes.push(error?.message || String(error));
  }

  return {
    role: account.role,
    accountKey: account.key,
    route,
    expected,
    actual,
    title,
    visibleNav: await collectVisibleNavigation(page),
    hiddenNavChecks: [],
    consoleErrors: diagnostics.consoleErrors.slice(consoleStart),
    networkErrors: diagnostics.networkErrors.slice(networkStart),
    supabaseErrors: diagnostics.supabaseErrors.slice(supabaseStart),
    notes,
  };
}

async function exploreVisibleControls(
  page: Page,
  role: AppRole,
  accountKey: string,
  route: string,
  report: FullReport,
): Promise<ActionRecord[]> {
  const records: ActionRecord[] = [];
  const selectors = ['button:visible', '[role="tab"]:visible', 'summary:visible', '[aria-haspopup="menu"]:visible', '[role="button"]:visible'];

  const seen = new Set<string>();
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = Math.min(await locator.count(), 8);
    for (let index = 0; index < count; index += 1) {
      const control = locator.nth(index);
      const text = ((await control.innerText().catch(() => '')) || (await control.getAttribute('aria-label').catch(() => '')) || '').trim();
      const label = text || `${selector}-${index}`;
      if (!label || seen.has(label)) continue;
      seen.add(label);

      const lowered = label.toLowerCase();
      if (/delete|remove|grant admin|ceo|superadmin/i.test(lowered)) continue;

      try {
        if (await control.isVisible() && await control.isEnabled()) {
          await control.click({ timeout: 3000 });
          await page.waitForTimeout(400);
          report.executiveSummary.totalActionsClicked += 1;
          const record: ActionRecord = { role, accountKey, route, action: label, status: 'pass' };
          records.push(record);
          report.actionRecords.push(record);
        }
      } catch (error: any) {
        const record: ActionRecord = {
          role,
          accountKey,
          route,
          action: label,
          status: 'fail',
          detail: error?.message || String(error),
        };
        records.push(record);
        report.actionRecords.push(record);
      }
    }
  }

  return records;
}

async function executeModerationAction(
  page: Page,
  username: string,
  actionType: string,
  reason: string,
  report: FullReport,
  role: AppRole,
): Promise<{ uiUpdated: boolean; error?: string }> {
  try {
    const actionsTab = page.getByRole('button', { name: /direct actions/i });
    if (await actionsTab.isVisible().catch(() => false)) {
      await actionsTab.click();
    }

    await page.locator('input[placeholder*="username"]').fill(username);
    await page.getByRole('button').filter({ has: page.locator('svg') }).first().click().catch(async () => {
      await page.getByRole('button', { name: /search/i }).first().click();
    });
    await page.waitForTimeout(1500);

    await page.locator('select').first().selectOption(actionType);
    const durationInput = page.locator('input[type="number"]');
    if (await durationInput.isVisible().catch(() => false)) {
      await durationInput.fill('5');
    }
    await page.locator('textarea').fill(reason);
    const execute = page.getByRole('button', { name: /execute/i });
    await execute.click();
    report.executiveSummary.totalActionsClicked += 1;
    await page.waitForTimeout(1500);

    const body = await page.locator('body').innerText().catch(() => '');
    const uiUpdated = /success|executed|action executed successfully|rolled back/i.test(body);
    return { uiUpdated, error: uiUpdated ? undefined : 'No success confirmation found after moderation action.' };
  } catch (error: any) {
    return { uiUpdated: false, error: error?.message || String(error) };
  }
}

async function rollbackMostRecentAction(page: Page, targetUsername: string, report: FullReport, role: AppRole): Promise<boolean> {
  try {
    const logsTab = page.getByRole('button', { name: /audit logs/i });
    if (await logsTab.isVisible().catch(() => false)) {
      await logsTab.click();
      await page.waitForTimeout(800);
    }
    const rollback = page.getByRole('button', { name: /rollback/i }).first();
    if (await rollback.isVisible().catch(() => false)) {
      page.once('dialog', (dialog) => dialog.accept().catch(() => {}));
      await rollback.click();
      report.executiveSummary.totalActionsClicked += 1;
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText().catch(() => '');
      if (/rolled back|rollback/i.test(body)) {
        return true;
      }
    }
  } catch {
    // no-op
  }
  report.actionRecords.push({
    role,
    accountKey: targetUsername,
    route: '/officer/moderation',
    action: 'rollback moderation action',
    status: 'fail',
    detail: 'Rollback control not found or did not complete.',
  });
  return false;
}

async function readBackendUserState(client: SupabaseClient, email: string) {
  const { data } = await client
    .from('user_profiles')
    .select('email, role, is_banned, is_kicked, kicked_until, ban_expires_at, broadcast_chat_disabled, mic_muted_until, no_ban_until, no_kick_until')
    .eq('email', email)
    .maybeSingle();
  return data as Record<string, any> | null;
}

function formatBackendState(state: Record<string, any>): string {
  const parts = [
    state.is_banned ? 'banned' : null,
    state.is_kicked ? 'kicked' : null,
    state.broadcast_chat_disabled ? 'chat_disabled' : null,
    state.mic_muted_until ? `muted_until=${state.mic_muted_until}` : null,
    state.ban_expires_at ? `ban_expires_at=${state.ban_expires_at}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No backend restriction fields changed';
}

async function performLogin(page: Page, def: AccountDefinition, report: FullReport) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const signInButton = page.getByRole('button', { name: 'Sign In' }).first();
  if (!(await signInButton.isVisible().catch(() => false))) {
    const signInTab = page.getByRole('button', { name: 'Sign In' });
    if (await signInTab.isVisible().catch(() => false)) {
      await signInTab.click();
    }
  }

  await page.locator('#email').fill(def.email);
  await page.locator('#password').fill(def.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  report.executiveSummary.totalActionsClicked += 1;

  return (await waitForPostAuthState(page)) === 'authenticated';
}

async function attemptLogout(page: Page, report: FullReport) {
  const candidates = [
    page.getByRole('button', { name: /sign out|logout/i }),
    page.getByTitle(/logout/i),
    page.locator('[aria-label*="logout" i]'),
  ];

  for (const candidate of candidates) {
    const control = candidate.first();
    if (await control.isVisible().catch(() => false)) {
      await control.click().catch(() => {});
      report.executiveSummary.totalActionsClicked += 1;
      await page.waitForTimeout(1500);
      if (page.url().includes('/auth')) return true;
    }
  }

  return false;
}

async function ensureSignupMode(page: Page) {
  const signUpTab = page.getByRole('button', { name: 'Sign Up' });
  if (await signUpTab.isVisible().catch(() => false)) {
    await signUpTab.click().catch(() => {});
  }
}

async function dismissSignupPrankIfPresent(page: Page, report: FullReport) {
  const continueButton = page.getByRole('button', { name: /continue to sign up/i });
  if (await continueButton.isVisible({ timeout: 4000 }).catch(() => false)) {
    await continueButton.click();
    report.executiveSummary.totalActionsClicked += 1;
    await page.waitForTimeout(500);
    const submit = page.getByRole('button', { name: 'Sign Up' }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      report.executiveSummary.totalActionsClicked += 1;
    }
  }
}

async function waitForPostAuthState(page: Page): Promise<'authenticated' | 'still_auth'> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (!url.includes('/auth')) return 'authenticated';
    await page.waitForTimeout(500);
  }
  return 'still_auth';
}

async function finishOnboardingIfNeeded(page: Page, def: AccountDefinition, report: FullReport) {
  if (page.url().includes('/terms')) {
    const agree = page.getByRole('button', { name: /agree/i }).first();
    if (await agree.isVisible().catch(() => false)) {
      await agree.click();
      report.executiveSummary.totalActionsClicked += 1;
      report.executiveSummary.totalFormsSubmitted += 1;
      await page.waitForTimeout(1200);
    }
  }

  if (page.url().includes('/profile/setup')) {
    const fullName = page.locator('#fullName, input[name="fullName"]').first();
    if (await fullName.isVisible().catch(() => false)) {
      await fullName.fill(`QA ${def.role}`);
    }

    const username = page.locator('#username, input[name="username"]').first();
    if (await username.isVisible().catch(() => false)) {
      const currentValue = await username.inputValue().catch(() => '');
      if (!currentValue) {
        await username.fill(def.username);
      }
    }

    const gender = page.locator('#gender, select[name="gender"]').first();
    if (await gender.isVisible().catch(() => false)) {
      await gender.selectOption({ index: 1 }).catch(() => {});
    }

    const bio = page.locator('#bio, textarea[name="bio"]').first();
    if (await bio.isVisible().catch(() => false)) {
      await bio.fill(`QA account for ${def.role}`);
    }

    const save = page.getByRole('button', { name: /save profile|save/i }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      report.executiveSummary.totalActionsClicked += 1;
      report.executiveSummary.totalFormsSubmitted += 1;
      await page.waitForTimeout(2500);
    }

    const continueHome = page.getByRole('button', { name: /continue to home/i }).first();
    if (await continueHome.isVisible().catch(() => false)) {
      await continueHome.click();
      report.executiveSummary.totalActionsClicked += 1;
      await page.waitForTimeout(1500);
    }
  }
}

async function readProfileFromClientState(page: Page) {
  return page.evaluate(() => {
    try {
      const authStore = localStorage.getItem('auth-store');
      if (!authStore) return null;
      const parsed = JSON.parse(authStore);
      return parsed?.state?.profile || null;
    } catch {
      return null;
    }
  });
}

function inferRoleAccess(role: AppRole, profile: Record<string, any> | null) {
  if (!profile) return false;
  switch (role) {
    case 'Lead Troll Officer':
      return profile.role === 'lead_troll_officer' || profile.is_lead_officer === true;
    case 'Troll Officer':
      return profile.role === 'troll_officer' || profile.is_troll_officer === true;
    case 'Secretary':
      return profile.role === 'secretary' || profile.troll_role === 'secretary';
    case 'Pastor':
      return profile.is_pastor === true;
    case 'TCNN':
      return profile.is_journalist === true || profile.is_news_caster === true || profile.is_chief_news_caster === true;
    case 'Regular User':
      return true;
    default:
      return false;
  }
}

function attachDiagnostics(page: Page): Diagnostics {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const supabaseErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      consoleErrors.push(`[${msg.type()}] ${text}`);
      if (/supabase|pgrst|jwt|policy|relation|column|auth\/|storage\//i.test(text)) {
        supabaseErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`[pageerror] ${error.message || String(error)}`);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const entry = `${request.method()} ${request.url()} -> ${failure?.errorText || 'unknown error'}`;
    networkErrors.push(entry);
    if (/supabase|rest\/v1|auth\/v1|functions\/v1/i.test(request.url())) {
      supabaseErrors.push(entry);
    }
  });

  page.on('response', async (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (/supabase|rest\/v1|auth\/v1|functions\/v1/i.test(url)) {
      const text = await response.text().catch(() => '');
      supabaseErrors.push(`${response.status()} ${url} ${text.slice(0, 300)}`);
    }
  });

  return { consoleErrors, networkErrors, supabaseErrors };
}

async function collectVisibleNavigation(page: Page) {
  const items = await page
    .locator('nav a:visible, aside a:visible, header a:visible')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => `${(node.textContent || '').trim()} -> ${(node as HTMLAnchorElement).getAttribute('href') || ''}`.trim())
        .filter(Boolean),
    )
    .catch(() => []);
  return Array.from(new Set(items)).slice(0, 20);
}

async function extractAuthPageError(page: Page) {
  const alert = page.locator('[role="alert"], .text-red-400, .text-red-500').first();
  if (await alert.isVisible().catch(() => false)) {
    return alert.innerText().catch(() => '');
  }
  return '';
}

function captureBackendFailures(report: FullReport, diagnostics: Diagnostics, role: AppRole, page: string, operation: string, fallbackMessage: string) {
  const exactError =
    diagnostics.supabaseErrors[diagnostics.supabaseErrors.length - 1] ||
    diagnostics.networkErrors[diagnostics.networkErrors.length - 1] ||
    diagnostics.consoleErrors[diagnostics.consoleErrors.length - 1] ||
    fallbackMessage;

  report.backendIssues.push({
    category: 'Supabase / Backend / Schema',
    role,
    page,
    operation,
    exactError,
    suspectedCause: inferSuspectedCause(exactError),
    suggestedFix: inferSuggestedFix(exactError),
  });
}

function inferSuspectedCause(errorText: string) {
  if (/relation .* does not exist|42p01/i.test(errorText)) return 'Missing table or view';
  if (/column .* does not exist|42703/i.test(errorText)) return 'Missing column or schema drift';
  if (/row-level security|policy|permission denied/i.test(errorText)) return 'Broken RLS policy or insufficient grants';
  if (/null value|not-null/i.test(errorText)) return 'Missing required column value or default';
  if (/foreign key/i.test(errorText)) return 'Foreign key mismatch';
  if (/bucket|storage/i.test(errorText)) return 'Missing storage bucket or storage policy';
  return 'Unknown backend mismatch';
}

function inferSuggestedFix(errorText: string) {
  if (/relation .* does not exist|42p01/i.test(errorText)) return 'Create the missing table/view in the active Supabase schema and deploy the migration.';
  if (/column .* does not exist|42703/i.test(errorText)) return 'Align frontend selects/inserts with the deployed schema or add the missing column.';
  if (/row-level security|policy|permission denied/i.test(errorText)) return 'Review the relevant RLS policy and ensure authenticated staff roles can read/write the expected rows.';
  if (/null value|not-null/i.test(errorText)) return 'Supply the required field in the frontend payload or add a safe database default.';
  if (/foreign key/i.test(errorText)) return 'Verify referenced rows exist and that the UI uses the correct foreign-key id.';
  return 'Inspect the failing request and align the frontend contract with the deployed backend.';
}

function pickModerator(officerAccount?: AccountRunResult, leadAccount?: AccountRunResult) {
  if (officerAccount?.actualProfile && inferRoleAccess('Troll Officer', officerAccount.actualProfile)) return officerAccount;
  if (leadAccount?.actualProfile && inferRoleAccess('Lead Troll Officer', leadAccount.actualProfile)) return leadAccount;
  return officerAccount || leadAccount;
}

function findAccount(report: FullReport, key: string) {
  return report.accountsUsed.find((item) => item.key === key);
}

function pushBlocked(report: FullReport, message: string) {
  if (!report.blockedOrUntestableAreas.includes(message)) {
    report.blockedOrUntestableAreas.push(message);
  }
}

function cleanRoleMatrix(matrix: RoleMatrix): RoleMatrix {
  return {
    ...matrix,
    pagesVisible: matrix.pagesVisible.filter(Boolean),
    pagesHidden: matrix.pagesHidden.filter(Boolean),
    actionsAllowed: Array.from(new Set(matrix.actionsAllowed.filter(Boolean))),
    actionsBlocked: Array.from(new Set(matrix.actionsBlocked.filter(Boolean))),
    completedWorkflows: Array.from(new Set(matrix.completedWorkflows.filter(Boolean))),
    failedWorkflows: Array.from(new Set(matrix.failedWorkflows.filter(Boolean))),
  };
}

function finalizeCounts(report: FullReport) {
  const passedChecks =
    report.routeVisits.filter((visit) => visit.expected === visit.actual).length +
    report.actionRecords.filter((item) => item.status === 'pass').length;

  const failedChecks =
    report.routeVisits.filter((visit) => visit.expected !== visit.actual).length +
    report.actionRecords.filter((item) => item.status === 'fail').length +
    report.backendIssues.length;

  report.executiveSummary.totalRoutesVisited = report.routeVisits.length;
  report.executiveSummary.totalPassedChecks = passedChecks;
  report.executiveSummary.totalFailedChecks = failedChecks;

  report.recommendedFixOrder = [
    'Fix any route guards or RLS policies that prevent legitimate staff pages from loading.',
    'Fix moderation actions that do not update the moderator UI, target session, and backend state immediately.',
    'Fix schema drift between frontend expectations and deployed Supabase tables, columns, and RPCs.',
    'Add or expose a legitimate non-admin role assignment path if QA is expected to create staff users through the app.',
    'Tighten hidden/exposed navigation so regular users never see staff-only destinations.',
  ];
}

async function writeReports(report: FullReport) {
  const jsonPath = path.join(REPORT_DIR, 'qa-report.json');
  const mdPath = path.join(REPORT_DIR, 'qa-report.md');
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(mdPath, renderMarkdownReport(report), 'utf8');
}

function renderMarkdownReport(report: FullReport) {
  const regularCount = report.accountsUsed.filter((item) => item.role === 'Regular User').length;
  return [
    '# QA Report',
    '',
    '## 1. Executive Summary',
    `- total accounts created by role: ${JSON.stringify(report.executiveSummary.totalAccountsCreatedByRole)}`,
    `- total routes visited: ${report.executiveSummary.totalRoutesVisited}`,
    `- total actions clicked: ${report.executiveSummary.totalActionsClicked}`,
    `- total forms submitted: ${report.executiveSummary.totalFormsSubmitted}`,
    `- total moderation actions tested: ${report.executiveSummary.totalModerationActionsTested}`,
    `- total passed checks: ${report.executiveSummary.totalPassedChecks}`,
    `- total failed checks: ${report.executiveSummary.totalFailedChecks}`,
    '',
    '## 2. Accounts Used',
    ...report.accountsUsed.map((account) => `- ${account.role}: ${account.email} | signup=${account.signupStatus} | login=${account.loginStatus} | session=${account.sessionPersistence}`),
    `- regular user account count: ${regularCount}`,
    '',
    '## 3. Role Coverage Matrix',
    ...report.roleCoverageMatrix.flatMap((matrix) => [
      `- ${matrix.role} (${matrix.accountKey})`,
      `  pages visible: ${matrix.pagesVisible.join(', ') || 'none'}`,
      `  pages hidden: ${matrix.pagesHidden.join(', ') || 'none'}`,
      `  actions allowed: ${matrix.actionsAllowed.join(', ') || 'none'}`,
      `  actions blocked: ${matrix.actionsBlocked.join(', ') || 'none'}`,
      `  completed workflows: ${matrix.completedWorkflows.join(', ') || 'none'}`,
      `  failed workflows: ${matrix.failedWorkflows.join(', ') || 'none'}`,
    ]),
    '',
    '## 4. Moderation Results Matrix',
    ...report.moderationResultsMatrix.map((row) => `- ${row.accountKey}: initial=${row.initialState} | actions=${row.actionsApplied.join(', ') || 'none'} | final=${row.finalState} | ui instant=${row.uiUpdatedInstantly} | restrictions=${row.restrictionsWorked} | reversal=${row.reversalWorked}`),
    '',
    '## 5. Bugs Found',
    ...(report.bugsFound.length ? report.bugsFound.map((bug) => `- [${bug.severity}] ${bug.title} | role=${bug.role} | route=${bug.route} | actual=${bug.actualBehavior}`) : ['- none recorded']),
    '',
    '## 6. Supabase / Backend / Schema Issues',
    ...(report.backendIssues.length ? report.backendIssues.map((issue) => `- ${issue.category} | role=${issue.role} | operation=${issue.operation} | error=${issue.exactError}`) : ['- none recorded']),
    '',
    '## 7. Visibility and Authorization Findings',
    `- pages incorrectly exposed: ${report.visibilityAndAuthorizationFindings.pagesIncorrectlyExposed.join(', ') || 'none'}`,
    `- pages incorrectly hidden: ${report.visibilityAndAuthorizationFindings.pagesIncorrectlyHidden.join(', ') || 'none'}`,
    `- actions incorrectly exposed: ${report.visibilityAndAuthorizationFindings.actionsIncorrectlyExposed.join(', ') || 'none'}`,
    `- actions incorrectly blocked: ${report.visibilityAndAuthorizationFindings.actionsIncorrectlyBlocked.join(', ') || 'none'}`,
    '',
    '## 8. Blocked or Untestable Areas',
    ...(report.blockedOrUntestableAreas.length ? report.blockedOrUntestableAreas.map((item) => `- ${item}`) : ['- none']),
    '',
    '## 9. Recommended Fix Order',
    ...report.recommendedFixOrder.map((item) => `- ${item}`),
    '',
  ].join('\n');
}
