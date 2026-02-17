/* global __ENV, __VU */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// --- Configuration ---
// Replace with your actual Supabase URL and Anon Key
const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321'; 
const _SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Replace with your actual LiveKit Token Edge Function URL
const LIVEKIT_TOKEN_FUNCTION_URL = __ENV.LIVEKIT_TOKEN_FUNCTION_URL || `${SUPABASE_URL}/functions/v1/livekit-token`;

// Define a single test stream ID for all users to try and join
const TEST_STREAM_ID = __ENV.TEST_STREAM_ID || 'some-test-stream-id';

// --- Test Data (replace with real user credentials for more realistic tests) ---
// For simplicity, we'll generate dummy users. In a real scenario, you'd load real user data.
const users = new SharedArray('users', function () {
  const data = [];
  for (let i = 0; i < 500; i++) {
    data.push({
      email: `test_user_${i}@example.com`,
      password: `password${i}`,
    });
  }
  return data;
});

// --- k6 Options ---
export const options = {
  // A single virtual user (VU) for demonstration
  // For 500 concurrent users, you'd set vus: 500, duration: '5m'
  vus: 1, 
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.01'], // Error rate should be below 1%
  },
};

// --- Main Test Scenario ---
export default function () {
  const user = users[__VU - 1]; // Get a unique user for each virtual user

  // 1. User Registration/Login (for simplicity, we'll simulate login with a dummy JWT)
  // In a real test, you'd register/login and obtain a JWT.
  // For this basic example, we'll assume a valid JWT can be obtained.
  // If you want to test Supabase Auth, you'd add actual /auth/v1/signup or /auth/v1/token requests here.

  // For demonstration, we'll just mock a JWT. Replace with actual token generation if needed.
  const authToken = 'YOUR_MOCKED_JWT_TOKEN'; 

  // 2. Get LiveKit Token from Edge Function
  const livekitTokenRes = http.post(
    LIVEKIT_TOKEN_FUNCTION_URL,
    JSON.stringify({
      user_id: user.email, // Use email as user ID for simplicity
      stream_id: TEST_STREAM_ID,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );

  check(livekitTokenRes, {
    'LiveKit Token function call successful': (res) => res.status === 200,
    'LiveKit Token is not empty': (res) => res.json() && res.json().livekit_token !== '',
  });

  const livekitToken = livekitTokenRes.json('livekit_token');

  if (livekitToken) {
    // 3. Simulate joining a LiveKit room (simplified - real connection happens client-side)
    console.log(`VU ${__VU}: User ${user.email} got LiveKit token for stream ${TEST_STREAM_ID}.`);
    // In a real scenario, you'd use a LiveKit client to connect to the room.
    // k6 doesn't directly support WebSockets for LiveKit client, but you can measure HTTP parts.
    // For full E2E testing, you'd use a browser automation tool like Playwright/Selenium.
  } else {
    console.error(`VU ${__VU}: Failed to get LiveKit token for user ${user.email}. Response: ${livekitTokenRes.body}`);
  }

  sleep(1); // Simulate some user think time
}
