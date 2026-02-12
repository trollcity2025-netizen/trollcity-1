import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIRS = ['src', 'supabase/functions'];
const REPORT_DIR = path.join(ROOT, 'test_results');
const REPORT_FILE = path.join(REPORT_DIR, `usage_audit_report_${Date.now()}.json`);

const INCLUDE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const RPC_REGEX = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
const TABLE_REGEX = /\.(from|insert|update|delete)\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
const ROLE_REGEX = /(role\s*===\s*['"][a-zA-Z_]+['"])|(is_admin)|(is_troll_officer)|(is_lead_officer)|(lead_troll_officer)|(troll_officer)|(secretary)|(pastor)|(seller)/gi;

const report = {
  startedAt: new Date().toISOString(),
  scope: 'usage-audit',
  sources: SRC_DIRS,
  rpcUsage: {},
  tableUsage: {},
  roleUsage: {},
  filesScanned: 0
};

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
      walk(full, files);
    } else if (INCLUDE_EXT.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function addUsage(map, key, file, line) {
  if (!map[key]) map[key] = { count: 0, locations: [] };
  map[key].count += 1;
  if (map[key].locations.length < 50) {
    map[key].locations.push({ file: path.relative(ROOT, file), line });
  }
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

const files = SRC_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  report.filesScanned += 1;

  let match;
  while ((match = RPC_REGEX.exec(content)) !== null) {
    const line = lineNumberAt(content, match.index);
    addUsage(report.rpcUsage, match[1], file, line);
  }

  while ((match = TABLE_REGEX.exec(content)) !== null) {
    const line = lineNumberAt(content, match.index);
    addUsage(report.tableUsage, match[2], file, line);
  }

  let roleMatch;
  while ((roleMatch = ROLE_REGEX.exec(content)) !== null) {
    const role = roleMatch[0];
    const line = lineNumberAt(content, roleMatch.index);
    addUsage(report.roleUsage, role, file, line);
  }
}

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
console.log(`Usage audit complete. Report: ${REPORT_FILE}`);
