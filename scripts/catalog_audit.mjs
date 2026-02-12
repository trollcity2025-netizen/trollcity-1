import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const REPORT_DIR = path.join(process.cwd(), 'test_results');
const REPORT_FILE = path.join(REPORT_DIR, `catalog_audit_report_${Date.now()}.json`);

const report = {
  startedAt: new Date().toISOString(),
  scope: 'catalog-audit',
  environment: 'production',
  checks: {
    tables: [],
    columns: [],
    counts: []
  },
  warnings: [],
  errors: [],
  summary: {}
};

const CATALOG_TABLES = [
  { table: 'gifts', id: 'id', label: 'gifts' },
  { table: 'shop_items', id: 'id', label: 'shop_items' },
  { table: 'insurance_options', id: 'id', label: 'insurance_options' },
  { table: 'insurance_plans', id: 'id', label: 'insurance_plans' },
  { table: 'vehicles_catalog', id: 'id', label: 'vehicles_catalog' },
  { table: 'purchasable_items', id: 'id', label: 'purchasable_items' },
  { table: 'broadcast_themes', id: 'id', label: 'broadcast_themes' },
  { table: 'entrance_effects', id: 'id', label: 'entrance_effects' },
  { table: 'call_sound_catalog', id: 'id', label: 'call_sound_catalog' },
  { table: 'perks', id: 'id', label: 'perks' },
  { table: 'houses_catalog', id: 'id', label: 'houses_catalog' }
];

const REQUIRED_TABLES = [
  'user_profiles',
  'streams',
  'stream_messages',
  'gifts',
  'battles',
  'coin_ledger',
  'coin_transactions',
  'vehicles_catalog',
  'user_vehicles',
  'properties',
  'gift_ledger',
  'gift_transactions',
  'purchasable_items',
  'shop_items',
  'insurance_options',
  'houses_catalog'
];

const REQUIRED_COLUMNS = {
  user_profiles: ['troll_coins', 'credit_score', 'credit_used'],
  streams: ['broadcaster_id', 'status'],
  stream_messages: ['stream_id', 'user_id', 'content'],
  battles: ['score_challenger', 'score_opponent', 'status']
};

function logWarning(step, warning) {
  report.warnings.push({ time: new Date().toISOString(), step, warning: String(warning) });
}

function logError(step, error) {
  report.errors.push({ time: new Date().toISOString(), step, error: String(error) });
}

async function checkTableExists(table) {
  const { error } = await supabase.from(table).select('id').limit(1);
  const exists = !error || !error.message?.includes('does not exist');
  report.checks.tables.push({ table, exists, error: error?.message || null });
  if (!exists) logWarning('table_missing', table);
  return exists;
}

async function checkColumnExists(table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  const exists = !error || !error.message?.includes('column');
  report.checks.columns.push({ table, column, exists, error: error?.message || null });
  if (!exists) logWarning('column_missing', `${table}.${column}`);
  return exists;
}

async function checkCounts() {
  for (const item of CATALOG_TABLES) {
    const { count, error } = await supabase
      .from(item.table)
      .select(item.id, { count: 'exact', head: true });

    report.checks.counts.push({ table: item.table, count: count ?? null, error: error?.message || null });
    if (error) {
      logWarning('catalog_count_error', `${item.table}: ${error.message}`);
    } else if (!count || count === 0) {
      logWarning('catalog_empty', item.table);
    }
  }
}

async function main() {
  try {
    for (const table of REQUIRED_TABLES) {
      await checkTableExists(table);
    }

    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      for (const column of columns) {
        await checkColumnExists(table, column);
      }
    }

    await checkCounts();

    report.summary = {
      errors: report.errors.length,
      warnings: report.warnings.length,
      tablesChecked: report.checks.tables.length,
      columnsChecked: report.checks.columns.length,
      countsChecked: report.checks.counts.length
    };
  } catch (error) {
    logError('fatal', error);
  } finally {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Catalog audit complete. Report: ${REPORT_FILE}`);
  }
}

main();
