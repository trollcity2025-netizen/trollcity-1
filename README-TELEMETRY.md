# Telemetry & Auto-Fix System

## Overview
This system provides end-to-end error detection, "user stuck" signals, and an automated fix workflow.

## Components

1. **Frontend (`src/lib/telemetry.ts`)**
   - Captures `window.onerror` and `unhandledrejection`.
   - Captures React render errors via `ErrorBoundary`.
   - Detects "Rage Clicks" (repeated clicks).
   - Detects "Stuck Spinners" (>12s).
   - buffers last 50 "breadcrumbs" (UI events, navigation).

2. **Backend (`server/api/telemetry.js` / `/api/telemetry`)**
   - Receives events via POST.
   - Rate limited (20 req/min/ip).
   - Sanitizes PII (Credit cards, secrets).
   - Hashes User IDs.
   - Stores in Supabase `telemetry_events` table.

3. **Database (`supabase/migrations/..._telemetry_events.sql`)**
   - Stores events with fingerprints for grouping.
   - Indexed for fast lookup.

4. **Auto-Fix Agent (`scripts/ai-fix-agent.js`)**
   - Fetches high-severity events.
   - Groups by fingerprint.
   - Creates a git branch.
   - (Simulated) Generates a patch.
   - Runs tests.
   - Opens a PR.

## Configuration
See `telemetry.config.json` for thresholds.

## How to View Telemetry
Query the Supabase table:
```sql
SELECT * FROM telemetry_events ORDER BY created_at DESC;
```

## Auto-Fix Workflow
Run the agent manually (or via cron):
```bash
node scripts/ai-fix-agent.js
```

### Safety Rules
- **No Direct Push**: Changes are always PRs.
- **Payment Logic Protected**: Auto-fix is disabled for payment-related files.
- **PII Redaction**: Secrets and PII are scrubbed before storage.
