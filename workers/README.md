
# Persistence Worker

The persistence worker reads signed event envelopes from Redis Streams (`tc_events_v1`) and batches them into Postgres (Supabase).

## Requirements
- Node.js 20+
- Redis (Upstash or Local)
- Supabase Project

## Setup
1. Copy `.env.example` to `.env` (ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `REDIS_URL` are set).
2. Install dependencies: `npm install ioredis dotenv @supabase/supabase-js`
3. Apply the SQL migration: `supabase/migrations/20260213000000_idempotent_persistence.sql`

## Run
```bash
npx tsx workers/persistor.ts
```

## Features
- **Batching**: Inserts up to 200 messages at a time or every 250ms.
- **Idempotency**: Uses `upsert` with unique constraints on `(stream_id, txn_id)`.
- **Fail-Closed**: If the DB is down, it retries with exponential backoff before moving to `tc_events_dlq_v1`.
- **Metrics**: Outputs performance stats every 60 seconds.
