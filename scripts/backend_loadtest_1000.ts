import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

dotenv.config();

// Type definitions
interface LogAction {
  time: string;
  type: string;
  detail: unknown;
}

interface LogWarning {
  time: string;
  step: string;
  warning: string;
}

interface LogError {
  time: string;
  step: string;
  error: string;
}

interface Invariant {
  name: string;
  success: boolean;
  details?: unknown;
}

interface ReportMetrics {
  error_rate: number;
  error_rate_threshold: number;
  error_rate_pass: boolean;
  join_p50_ms?: number;
  join_p95_ms?: number;
  chat_p50_ms?: number;
  chat_p95_ms?: number;
  gift_p50_ms?: number;
  gift_p95_ms?: number;
  [key: string]: unknown;
}

interface DbStats {
  callsByAction: Record<string, number>;
  slowQueries: Array<{ action: string; label: string; ms: number; at: string }>;
  retries: { total: number; byAction: Record<string, number> };
  failures: { total: number; byAction: Record<string, number>; byCode: Record<string, number> };
  timeouts: number;
  lockContention: { total: number; byCode: Record<string, number> };
}

interface RunReport {
  run_id: string;
  label: string;
  concurrency: number;
  actions: LogAction[];
  warnings: LogWarning[];
  errors: LogError[];
  timings: {
    join: number[];
    chat: number[];
    gift: number[];
    battle: number[];
  };
  metrics: ReportMetrics;
  invariants: Invariant[];
  cleanup: unknown[];
  summary: Record<string, unknown>;
  db: DbStats;
}

interface TestReport {
  startedAt: string;
  scope: string;
  environment: string;
  run_id: string;
  livekit_used: boolean;
  livekit_tokens_minted: number;
  livekit_connects: number;
  config: Record<string, unknown>;
  runs: RunReport[];
  summary: Record<string, unknown>;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const REPORT_DIR = path.join(process.cwd(), 'test_results');
const RUN_ID = process.env.RUN_ID || `loadtest_${Date.now()}`;
const REPORT_FILE = path.join(REPORT_DIR, `backend_loadtest_1000_${RUN_ID}.json`);

const SCENARIOS = {
  default1000: {
    label: 'backend-loadtest-1000',
    totalUsers: 1000,
    authUsers: 12,
    hosts: 10,
    viewers: 600,
    chatters: 200,
    gifters: 100,
    giftsPerGifter: 3,
    battles: 100,
    messagesPerChatterPerMinute: 2,
    chatWindowSeconds: 60,
    concurrencySteps: [40],
    rampSeconds: 90,
    stopIfP95Ms: 2000,
    stopIfErrorRate: 0.005,
    dbTimeoutMs: 6000,
    slowQueryMs: 800,
    maxRetries: 1,
    cleanup: true
  },
  launch500: {
    label: 'backend-loadtest-500-launch',
    totalUsers: 500,
    authUsers: 12,
    hosts: 10,
    viewers: 360,
    chatters: 120,
    gifters: 35,
    giftsPerGifter: 2,
    battles: 30,
    messagesPerChatterPerMinute: 3,
    chatWindowSeconds: 60,
    concurrencySteps: [40, 60, 80],
    rampSeconds: 90,
    stopIfP95Ms: 2000,
    stopIfErrorRate: 0.005,
    dbTimeoutMs: 6000,
    slowQueryMs: 800,
    maxRetries: 1,
    cleanup: true
  }
};

const scenarioName = process.env.LOADTEST_SCENARIO || 'default1000';
const scenario = SCENARIOS[scenarioName as keyof typeof SCENARIOS] || SCENARIOS.default1000;

const CONFIG = {
  ...scenario,
  authUsers: Number(process.env.LOADTEST_AUTH_USERS || scenario.authUsers),
  hosts: Number(process.env.LOADTEST_HOSTS || scenario.hosts),
  viewers: Number(process.env.LOADTEST_VIEWERS || scenario.viewers),
  chatters: Number(process.env.LOADTEST_CHATTERS || scenario.chatters),
  gifters: Number(process.env.LOADTEST_GIFTERS || scenario.gifters),
  giftsPerGifter: Number(process.env.LOADTEST_GIFTS_PER_GIFTER || scenario.giftsPerGifter),
  battles: Number(process.env.LOADTEST_BATTLES || scenario.battles),
  messagesPerChatterPerMinute: Number(
    process.env.LOADTEST_MESSAGES_PER_CHATTER_PER_MIN || scenario.messagesPerChatterPerMinute
  ),
  chatWindowSeconds: Number(process.env.LOADTEST_CHAT_WINDOW_SECONDS || scenario.chatWindowSeconds),
  concurrencySteps: String(process.env.LOADTEST_CONCURRENCY_STEPS || scenario.concurrencySteps.join(','))
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0),
  rampSeconds: Number(process.env.LOADTEST_RAMP_SECONDS || scenario.rampSeconds),
  stopIfP95Ms: Number(process.env.LOADTEST_STOP_P95_MS || scenario.stopIfP95Ms),
  stopIfErrorRate: Number(process.env.LOADTEST_STOP_ERROR_RATE || scenario.stopIfErrorRate),
  dbTimeoutMs: Number(process.env.LOADTEST_DB_TIMEOUT_MS || scenario.dbTimeoutMs),
  slowQueryMs: Number(process.env.LOADTEST_SLOW_QUERY_MS || scenario.slowQueryMs),
  maxRetries: Number(process.env.LOADTEST_DB_RETRIES || scenario.maxRetries),
  cleanup: process.env.LOADTEST_CLEANUP ? process.env.LOADTEST_CLEANUP !== 'false' : scenario.cleanup
};

const report: TestReport = {
  startedAt: new Date().toISOString(),
  scope: String(CONFIG.label || 'backend-loadtest'),
  environment: 'production',
  run_id: RUN_ID,
  livekit_used: false,
  livekit_tokens_minted: 0,
  livekit_connects: 0,
  config: CONFIG,
  runs: [],
  summary: {}
};

let currentRun: RunReport | null = null;

function createRunReport(label: string, concurrency: number): RunReport {
  return {
    run_id: RUN_ID,
    label,
    concurrency,
    actions: [],
    warnings: [],
    errors: [],
    timings: {
      join: [],
      chat: [],
      gift: [],
      battle: []
    },
    metrics: {
      error_rate: 0,
      error_rate_threshold: CONFIG.stopIfErrorRate,
      error_rate_pass: true
    },
    invariants: [],
    cleanup: [],
    summary: {},
    db: {
      callsByAction: {},
      slowQueries: [],
      retries: { total: 0, byAction: {} },
      failures: { total: 0, byAction: {}, byCode: {} },
      timeouts: 0,
      lockContention: { total: 0, byCode: {} }
    }
  };
}

function setCurrentRun(run: RunReport) {
  currentRun = run;
  report.runs.push(run);
}

function logAction(type: string, detail: unknown) {
  if (!currentRun) return;
  currentRun.actions.push({ time: new Date().toISOString(), type, detail });
}

function logWarning(step: string, warning: unknown) {
  if (!currentRun) return;
  currentRun.warnings.push({ time: new Date().toISOString(), step, warning: String(warning) });
}

function logError(step: string, error: unknown) {
  if (!currentRun) return;
  currentRun.errors.push({ time: new Date().toISOString(), step, error: String(error) });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<void> {
  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < tasks.length) {
      const current = index++;
      try {
        await tasks[current]();
      } catch (error) {
        logWarning('task_error', error);
      }
    }
  };

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

function recordTiming(bucket: keyof RunReport['timings'], ms: number) {
  if (!currentRun) return;
  currentRun.timings[bucket].push(ms);
}

function bumpCounter(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function recordDbFailure(action: string, error: any) {
  if (!currentRun) return;
  currentRun.db.failures.total += 1;
  bumpCounter(currentRun.db.failures.byAction, action);
  const code = String(error?.code || error?.status || error?.statusCode || 'unknown');
  bumpCounter(currentRun.db.failures.byCode, code);
  if (code === '55P03' || code === '40P01') {
    currentRun.db.lockContention.total += 1;
    bumpCounter(currentRun.db.lockContention.byCode, code);
  }
}

function recordDbRetry(action: string) {
  if (!currentRun) return;
  currentRun.db.retries.total += 1;
  bumpCounter(currentRun.db.retries.byAction, action);
}

function recordDbCall(action: string) {
  if (!currentRun) return;
  bumpCounter(currentRun.db.callsByAction, action);
}

function recordSlowQuery(action: string, label: string, ms: number) {
  if (!currentRun) return;
  currentRun.db.slowQueries.push({ action, label, ms, at: new Date().toISOString() });
}

function isTimeoutError(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '57014' || message.includes('timeout') || message.includes('statement timeout');
}

function isLockContentionError(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '55P03' || code === '40P01' || message.includes('deadlock') || message.includes('could not obtain lock');
}

function shouldRetry(error: any) {
  const status = Number(error?.status || error?.statusCode || 0);
  return isTimeoutError(error) || isLockContentionError(error) || status === 429 || status === 503;
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<{ timedOut: boolean; result?: T }> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  const result = await Promise.race([
    Promise.resolve(promise).then((value) => ({ timedOut: false, result: value })),
    timeoutPromise
  ]);
  if (timer) clearTimeout(timer);
  return result as { timedOut: boolean; result?: T };
}

async function runDbCall<T>(
  action: string,
  label: string,
  fn: () => PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const maxRetries = Math.max(0, CONFIG.maxRetries);
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    recordDbCall(action);
    const started = performance.now();
    const resultWrapper = await withTimeout(fn(), CONFIG.dbTimeoutMs);
    const elapsed = performance.now() - started;
    if (elapsed >= CONFIG.slowQueryMs) recordSlowQuery(action, label, Math.round(elapsed));

    if (resultWrapper.timedOut) {
      if (currentRun) currentRun.db.timeouts += 1;
      recordDbFailure(action, { code: 'timeout', message: 'db timeout' });
      if (attempt <= maxRetries) {
        recordDbRetry(action);
        continue;
      }
      return { data: null, error: new Error('DB timeout') };
    }

    const result = resultWrapper.result as { data: T | null; error: any };
    if (result?.error) {
      recordDbFailure(action, result.error);
      if (shouldRetry(result.error) && attempt <= maxRetries) {
        recordDbRetry(action);
        continue;
      }
    }
    return result;
  }

  return { data: null, error: new Error('DB retry limit exceeded') };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

async function assertColumns(table: string, columns: string[]) {
    const { error } = await runDbCall('preflight.select', `${table}.columns`, () =>
    adminClient.from(table).select(columns.join(',')).limit(1)
  );
  if (error) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      throw new Error(`${table} missing required columns: ${columns.join(', ')}`);
    }
  }
}

async function preflight() {
  await assertColumns('streams', ['run_id', 'source']);
  await assertColumns('battles', ['run_id', 'source']);
  await assertColumns('stream_participants', ['run_id', 'source']);
  await assertColumns('stream_messages', ['run_id', 'source']);
  await assertColumns('user_profiles', ['run_id', 'source']);
  logAction('preflight', { ok: true, run_id: RUN_ID });
}

async function createAuthUsers(count: number) {
  const users: Array<{ id: string; email: string; password: string }> = [];
  const createdAt = Date.now();
  const password = `LoadPass!${createdAt}`;
  const batchSize = 20;

  for (let i = 0; i < count; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, idx) => {
      const email = `loadtest+${RUN_ID}-${i + idx}@trollcity.local`;
      return adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    });

    const results = await Promise.all(batch);
    for (const result of results) {
      const { data, error } = result || {};
      if (error || !data?.user) {
        logError('create_auth_user', error?.message || 'Unknown error');
        continue;
      }
      users.push({ id: data.user.id, email: data.user.email || `loadtest-${data.user.id}@trollcity.local`, password });
    }
    await sleep(200);
  }

  logAction('create_auth_users', { count: users.length });
  return users;
}

async function seedProfiles(profiles: Array<{ id: string; username: string; coins: number; isBroadcaster?: boolean }>) {
  const rows = profiles.map((p) => ({
    id: p.id,
    username: p.username,
    troll_coins: p.coins,
    is_broadcaster: !!p.isBroadcaster,
    run_id: RUN_ID,
    source: 'loadtest'
  }));

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await runDbCall('user_profiles.upsert', `seed_profiles:${chunk.length}`, () =>
      adminClient.from('user_profiles').upsert(chunk, { onConflict: 'id' })
    );
    if (error) logError('seed_profiles', error.message);
    await sleep(100);
  }

  logAction('seed_profiles', { count: rows.length });
}

async function createStreams(hostIds: string[], label: string) {
  const streamIds: string[] = [];
  for (let i = 0; i < hostIds.length; i++) {
    const { data, error } = await runDbCall<{ id: string }>('streams.insert', `create_stream:${i + 1}`, () =>
      adminClient
        .from('streams')
        .insert({
          broadcaster_id: hostIds[i],
          status: 'live',
          title: `${label} ${i + 1} [${RUN_ID}]`,
          run_id: RUN_ID,
          source: 'loadtest'
        })
        .select('id')
        .single()
    );
    if (error || !data?.id) {
      logError('create_stream', error.message);
      continue;
    }
    streamIds.push(data.id);
  }
  return streamIds;
}

async function createBattles(streamIds: string[]) {
  const rows = [] as Array<{ challenger_stream_id: string; opponent_stream_id: string; status: string; run_id: string; source: string }>;
  for (let i = 0; i < streamIds.length; i += 2) {
    if (rows.length >= CONFIG.battles) break;
    rows.push({
      challenger_stream_id: streamIds[i],
      opponent_stream_id: streamIds[i + 1],
      status: 'active',
      run_id: RUN_ID,
      source: 'loadtest'
    });
  }

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await runDbCall('battles.insert', `create_battles:${chunk.length}`, () =>
      adminClient.from('battles').insert(chunk)
    );
    if (error) logWarning('create_battles', error.message);
    await sleep(100);
  }

  logAction('create_battles', { count: rows.length });
  return rows.length;
}

async function rampedRun(tasks: Array<() => Promise<void>>, label: string) {
  const total = tasks.length;
  const stageTargets = [0.25, 0.5, 0.75, 1].map((ratio) => Math.floor(total * ratio));
  let startIndex = 0;
  const stageDelay = Math.floor((CONFIG.rampSeconds * 1000) / stageTargets.length);

  const concurrency = currentRun?.concurrency || CONFIG.concurrencySteps[0] || 1;

  for (const target of stageTargets) {
    const stageTasks = tasks.slice(startIndex, target);
    startIndex = target;
    await runWithConcurrency(stageTasks, concurrency);
    const jitter = Math.floor(Math.random() * 500);
    await sleep(stageDelay + jitter);
  }

  logAction('ramp_complete', { label, total });
}

async function insertParticipants(streamIds: string[], watcherIds: Array<{ id: string; username: string }>) {
  const tasks = watcherIds.map((viewer) => async () => {
    const streamId = pickRandom(streamIds);
    const start = performance.now();
    const { error } = await runDbCall('stream_participants.insert', `join:${streamId}`, () =>
      adminClient.from('stream_participants').insert({
        stream_id: streamId,
        user_id: viewer.id,
        username: `${viewer.username}-${RUN_ID}`,
        is_active: true,
        run_id: RUN_ID,
        source: 'loadtest'
      })
    );
    recordTiming('join', performance.now() - start);
    if (error) logWarning('join_insert', error.message);
  });

  await rampedRun(tasks, 'join');
}

async function insertChat(streamIds: string[], chatters: Array<{ id: string; username: string }>) {
  const tasks: Array<() => Promise<void>> = [];
  const messagesPerChatter = Math.max(
    1,
    Math.round((CONFIG.messagesPerChatterPerMinute * CONFIG.chatWindowSeconds) / 60)
  );
  for (const chatter of chatters) {
    for (let i = 0; i < messagesPerChatter; i++) {
      tasks.push(async () => {
        const streamId = pickRandom(streamIds);
        const start = performance.now();
        const { error } = await runDbCall('stream_messages.insert', `chat:${streamId}`, () =>
          adminClient.from('stream_messages').insert({
            stream_id: streamId,
            user_id: chatter.id,
            content: `[${RUN_ID}] loadtest message ${i + 1}`,
            user_name: chatter.username,
            run_id: RUN_ID,
            source: 'loadtest'
          })
        );
        recordTiming('chat', performance.now() - start);
        if (error) logWarning('chat_insert', error.message);
      });
    }
  }

  await rampedRun(tasks, 'chat');
}

async function sendGifts(streamIds: string[], gifters: Array<{ id: string }>, receivers: string[], giftId: string) {
  const tasks: Array<() => Promise<void>> = [];

  for (const gifter of gifters) {
    for (let i = 0; i < CONFIG.giftsPerGifter; i++) {
      tasks.push(async () => {
        const start = performance.now();
        const { error } = await runDbCall('send_gift_in_stream', `gift:${gifter.id}`, () =>
          adminClient.rpc('send_gift_in_stream', {
            p_sender_id: gifter.id,
            p_receiver_id: pickRandom(receivers),
            p_stream_id: pickRandom(streamIds),
            p_gift_id: giftId,
            p_quantity: 1,
            p_metadata: { run_id: RUN_ID, source: 'loadtest', scenario: 'gift' }
          })
        );
        recordTiming('gift', performance.now() - start);
        if (error) logWarning('gift_rpc', error.message);
      });
    }
  }

  await rampedRun(tasks, 'gift');
}

async function validateBattles() {
  const { data, error } = await runDbCall<Array<{ id: string; score_challenger: number | null; score_opponent: number | null }>>(
    'battles.select',
    'validate_battles',
    () =>
    adminClient
      .from('battles')
      .select('id, score_challenger, score_opponent')
      .eq('run_id', RUN_ID)
      .limit(5)
  );
  if (error) {
    logWarning('battle_check', error.message);
    return;
  }
  const changed = (data || []).some((b) => (b.score_challenger || 0) > 0 || (b.score_opponent || 0) > 0);
  if (currentRun) currentRun.invariants.push({ name: 'battle_scores_changed', success: changed });
}

async function cleanup(authUsers: Array<{ id: string }>) {
  if (!CONFIG.cleanup) return;

  await runDbCall('stream_participants.delete', 'cleanup_participants', () =>
    adminClient.from('stream_participants').delete().eq('run_id', RUN_ID)
  );
  await runDbCall('stream_messages.delete', 'cleanup_messages', () =>
    adminClient.from('stream_messages').delete().eq('run_id', RUN_ID)
  );
  await runDbCall('battles.delete', 'cleanup_battles', () =>
    adminClient.from('battles').delete().eq('run_id', RUN_ID)
  );
  await runDbCall('streams.delete', 'cleanup_streams', () =>
    adminClient.from('streams').delete().eq('run_id', RUN_ID)
  );
  await runDbCall('user_profiles.delete', 'cleanup_profiles', () =>
    adminClient.from('user_profiles').delete().eq('run_id', RUN_ID)
  );

  for (const user of authUsers) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) logWarning('cleanup_auth_user', error.message);
  }

  if (currentRun) currentRun.cleanup.push({ run_id: RUN_ID, auth_users: authUsers.length });
}

async function main() {
  try {
    const setupRun = createRunReport('setup', 0);
    setCurrentRun(setupRun);

    await preflight();

    const { data: giftRow, error: giftError } = await runDbCall<{ id: string } | null>('gifts.select', 'get_gift', () =>
      adminClient
        .from('gifts')
        .select('id')
        .limit(1)
        .maybeSingle()
    );
    if (giftError || !giftRow?.id) throw new Error(giftError?.message || 'No gifts available');

    const authUsers = await createAuthUsers(CONFIG.authUsers);
    const authProfiles = authUsers.map((u, i) => ({
      id: u.id,
      username: `load_auth_${RUN_ID}_${i}`,
      coins: 50_000_000,
      isBroadcaster: i < CONFIG.hosts
    }));
    await seedProfiles(authProfiles);

    const hostIds = authUsers.slice(0, CONFIG.hosts).map((u) => u.id);
    const hostStreams = await createStreams(hostIds, 'LoadTest Host Stream');
    logAction('create_host_streams', { count: hostStreams.length });

    const battleBroadcasters = Array.from({ length: CONFIG.battles * 2 }, (_, i) => ({
      id: randomUUID(),
      username: `load_battle_${RUN_ID}_${i}`,
      coins: 10_000_000,
      isBroadcaster: true
    }));
    await seedProfiles(battleBroadcasters);

    const battleStreams = await createStreams(
      battleBroadcasters.map((b) => b.id),
      'LoadTest Battle Stream'
    );
    logAction('create_battle_streams', { count: battleStreams.length });

    const battleCount = await createBattles(battleStreams);

    const chatters = Array.from({ length: CONFIG.chatters }, (_, i) => ({
      id: randomUUID(),
      username: `load_chatter_${RUN_ID}_${i}`,
      coins: 5_000_000
    }));
    const gifters = Array.from({ length: CONFIG.gifters }, (_, i) => ({
      id: randomUUID(),
      username: `load_gifter_${RUN_ID}_${i}`,
      coins: 5_000_000
    }));
    await seedProfiles([...chatters, ...gifters]);

    const watchers = Array.from({ length: CONFIG.viewers }, (_, i) => ({
      id: randomUUID(),
      username: `load_viewer_${RUN_ID}_${i}`
    }));

    const receiverIds = hostIds.length ? hostIds : battleBroadcasters.map((b) => b.id).slice(0, 5);

    let safeConcurrency = 0;
    for (const concurrency of CONFIG.concurrencySteps) {
      const runLabel = `${CONFIG.label || 'backend-loadtest'}-c${concurrency}`;
      const run = createRunReport(runLabel, concurrency);
      setCurrentRun(run);

      await insertParticipants(hostStreams, watchers);
      await insertChat(hostStreams, chatters);
      await sendGifts(battleStreams.length ? battleStreams : hostStreams, gifters, receiverIds, giftRow.id);
      await validateBattles();

      const errorRate = run.errors.length / Math.max(1, run.actions.length);
      const joinP50 = percentile(run.timings.join, 50);
      const joinP95 = percentile(run.timings.join, 95);
      const chatP50 = percentile(run.timings.chat, 50);
      const chatP95 = percentile(run.timings.chat, 95);
      const giftP50 = percentile(run.timings.gift, 50);
      const giftP95 = percentile(run.timings.gift, 95);

      run.metrics = {
        join_p50_ms: joinP50,
        join_p95_ms: joinP95,
        chat_p50_ms: chatP50,
        chat_p95_ms: chatP95,
        gift_p50_ms: giftP50,
        gift_p95_ms: giftP95,
        error_rate: errorRate,
        error_rate_threshold: CONFIG.stopIfErrorRate,
        error_rate_pass: errorRate < CONFIG.stopIfErrorRate
      };

      const p95Breached = joinP95 > CONFIG.stopIfP95Ms || chatP95 > CONFIG.stopIfP95Ms || giftP95 > CONFIG.stopIfP95Ms;
      const errorBreached = errorRate > CONFIG.stopIfErrorRate;

      run.summary = {
        errors: run.errors.length,
        warnings: run.warnings.length,
        actions: run.actions.length,
        battles_created: battleCount,
        p95_threshold_ms: CONFIG.stopIfP95Ms,
        error_rate_threshold: CONFIG.stopIfErrorRate,
        pass: !p95Breached && !errorBreached
      };

      run.db.slowQueries = run.db.slowQueries.sort((a, b) => b.ms - a.ms).slice(0, 10);

      if (!p95Breached && !errorBreached) {
        safeConcurrency = concurrency;
      } else {
        logWarning('stop_condition', `Stopping at concurrency ${concurrency} due to threshold breach.`);
        break;
      }
    }

    report.summary = {
      runs: report.runs.length,
      safe_concurrency: safeConcurrency,
      battles_created: battleCount
    };

    await cleanup(authUsers);
  } catch (error) {
    logError('fatal', error);
  } finally {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Backend load test complete. Report: ${REPORT_FILE}`);
  }
}

main();
