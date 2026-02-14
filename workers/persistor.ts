
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_NAME = 'tc_events_v1';
const CONSUMER_GROUP = 'persistence_group';
const CONSUMER_NAME = `worker_${process.pid}`;

const BATCH_SIZE = 200;
const FLUSH_INTERVAL_MS = 250;
const MAX_RETRIES = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(REDIS_URL);

// Metrics
let eventsRead = 0;
let eventsPersisted = 0;
let totalBatchSize = 0;
let batchCount = 0;
let dbInsertTimes: number[] = [];
let streamLags: number[] = [];
let retriesCount = 0;
let dlqCount = 0;

interface EventEnvelope {
  txn_id: string;
  stream_id: string;
  t: string;
  ts: number;
  s: string;
  payload: string;
}

async function init() {
  try {
    await redis.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }
  console.log(`[*] Worker ${CONSUMER_NAME} started. Reading from ${STREAM_NAME}...`);
  
  // Stats reporter
  setInterval(reportMetrics, 60000);
  
  poll();
}

function reportMetrics() {
  const avgBatch = batchCount > 0 ? (totalBatchSize / batchCount).toFixed(2) : 0;
  const p95Db = dbInsertTimes.length > 0 ? percentile(dbInsertTimes, 95).toFixed(2) : 0;
  const p95Lag = streamLags.length > 0 ? percentile(streamLags, 95).toFixed(2) : 0;
  
  console.log(`[METRICS] ${new Date().toISOString()}`);
  console.log(`- events_read/sec: ${(eventsRead / 60).toFixed(2)}`);
  console.log(`- persisted/sec: ${(eventsPersisted / 60).toFixed(2)}`);
  console.log(`- batch_size_avg: ${avgBatch}`);
  console.log(`- db_insert_p95_ms: ${p95Db}`);
  console.log(`- stream_lag_ms_p95: ${p95Lag}`);
  console.log(`- retries: ${retriesCount}, dlq: ${dlqCount}`);
  
  // Reset for next minute
  eventsRead = 0;
  eventsPersisted = 0;
  totalBatchSize = 0;
  batchCount = 0;
  dbInsertTimes = [];
  streamLags = [];
}

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p / 100;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

async function poll() {
  let batch: { id: string; data: EventEnvelope }[] = [];
  let lastFlush = Date.now();

  while (true) {
    try {
      // Read batch from Redis Stream
      const results = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', BATCH_SIZE,
        'BLOCK', 100,
        'STREAMS', STREAM_NAME, '>'
      );

      if (results) {
        const [_stream, messages] = results[0];
        for (const [id, fields] of messages) {
          const data: any = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          batch.push({ id, data: data as EventEnvelope });
          eventsRead++;
          streamLags.push(Date.now() - Number(data.ts));
        }
      }

      if (batch.length >= BATCH_SIZE || (Date.now() - lastFlush > FLUSH_INTERVAL_MS && batch.length > 0)) {
        await processBatch(batch);
        batch = [];
        lastFlush = Date.now();
      }
    } catch (err) {
      console.error('[ERROR] Polling error:', err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function processBatch(batch: { id: string; data: EventEnvelope }[]) {
  const start = Date.now();
  
  // Filter for persistence
  const chatMessages = batch.filter(b => b.data.t === 'chat').map(b => ({
    stream_id: b.data.stream_id,
    user_id: b.data.s,
    content: JSON.parse(b.data.payload).d.content,
    txn_id: b.data.txn_id,
    created_at: new Date(Number(b.data.ts)).toISOString()
  }));

  const gifts = batch.filter(b => b.data.t === 'gift').map(b => {
    const payload = JSON.parse(b.data.payload).d;
    return {
      stream_id: b.data.stream_id,
      sender_id: b.data.s,
      recipient_id: payload.receiver_id,
      gift_id: payload.gift_id,
      amount: payload.amount,
      txn_id: b.data.txn_id,
      created_at: new Date(Number(b.data.ts)).toISOString()
    };
  });

  try {
    const promises = [];
    if (chatMessages.length > 0) {
      promises.push(supabase.from('stream_messages').upsert(chatMessages, { onConflict: 'stream_id,txn_id' }));
    }
    if (gifts.length > 0) {
      promises.push(supabase.from('stream_gifts').upsert(gifts, { onConflict: 'stream_id,txn_id' }));
    }

    if (promises.length > 0) {
      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw res.error;
      }
    }

    // Acknowledge messages
    await redis.xack(STREAM_NAME, CONSUMER_GROUP, ...batch.map(b => b.id));
    
    eventsPersisted += batch.length;
    totalBatchSize += batch.length;
    batchCount++;
    dbInsertTimes.push(Date.now() - start);

  } catch (err) {
    console.error('[ERROR] Batch persistence failed:', err);
    retriesCount++;
    await handleFailure(batch);
  }
}

async function handleFailure(batch: { id: string; data: EventEnvelope }[], attempt = 1) {
  if (attempt > MAX_RETRIES) {
    console.error(`[CRITICAL] Max retries reached for batch of ${batch.length}. Moving to DLQ.`);
    dlqCount += batch.length;
    for (const item of batch) {
      await redis.xadd('tc_events_dlq_v1', '*', {
        ...item.data as any,
        error: 'MAX_RETRIES_REACHED',
        failed_at: Date.now().toString()
      });
      await redis.xack(STREAM_NAME, CONSUMER_GROUP, item.id);
    }
    return;
  }

  const delay = Math.pow(2, attempt) * 1000;
  console.log(`[RETRY] Attempt ${attempt} in ${delay}ms...`);
  await new Promise(r => setTimeout(r, delay));
  
  try {
    await processBatch(batch);
  } catch (error) {
    console.error(`[RETRY] Batch failed on attempt ${attempt}:`, error);
    await handleFailure(batch, attempt + 1);
  }
}

init().catch(console.error);
