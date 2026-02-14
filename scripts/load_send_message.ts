
const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL || 'http://localhost:54321/functions/v1/send-message';
const TEST_JWT = process.env.TEST_USER_JWT!;
const STREAM_ID = 'test-stream-100k';
const TOTAL_MESSAGES = 240000; // 2000 msg/s * 120s
const CONCURRENCY = 50;

async function send() {
  const txn_id = crypto.randomUUID();
  const payload = {
    type: 'chat',
    stream_id: STREAM_ID,
    txn_id: txn_id,
    data: { content: 'Load test message ' + Math.random() }
  };

  const start = Date.now();
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_JWT}`
      },
      body: JSON.stringify(payload)
    });
    const latency = Date.now() - start;
    return { status: res.status, latency };
  } catch {
    return { status: 500, latency: Date.now() - start };
  }
}

async function run() {
  console.log(`[*] Starting load test: ${TOTAL_MESSAGES} messages, Concurrency: ${CONCURRENCY}`);
  let completed = 0;
  const results: { status: number, latency: number }[] = [];

  const workers = Array(CONCURRENCY).fill(0).map(async () => {
    while (completed < TOTAL_MESSAGES) {
      completed++;
      const res = await send();
      results.push(res);
      if (completed % 1000 === 0) console.log(`[PROGRESS] ${completed}/${TOTAL_MESSAGES} sent...`);
    }
  });

  await Promise.all(workers);

  // Analysis
  const latencies = results.map(r => r.latency).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const errors = results.filter(r => r.status !== 200).reduce((acc: any, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n--- LOAD TEST RESULTS ---');
  console.log(`Total Sent: ${results.length}`);
  console.log(`p50 Latency: ${p50}ms`);
  console.log(`p95 Latency: ${p95}ms`);
  console.log('Error Breakdown:', errors);
}

run().catch(console.error);
