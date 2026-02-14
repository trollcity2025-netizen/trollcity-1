
const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL || 'http://localhost:54321/functions/v1/send-message';
const TEST_JWT = process.env.TEST_USER_JWT!;
const STREAM_ID = 'test-stream-idempotency';

async function testIdempotency() {
  const txn_id = crypto.randomUUID();
  const payload = {
    type: 'chat',
    stream_id: STREAM_ID,
    txn_id: txn_id,
    data: { content: 'Idempotency test' }
  };

  console.log(`[*] Sending txn_id ${txn_id} 5 times...`);
  
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_JWT}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(`- Attempt ${i}: Status ${res.status}, Code: ${data.code || 'SUCCESS'}`);
  }
}

testIdempotency().catch(console.error);
