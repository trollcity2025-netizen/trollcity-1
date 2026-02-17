
import fetch from 'node-fetch';
import WebSocket from 'ws';

// --- Configuration ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const TARGET_CONCURRENCY = parseInt(process.env.TARGET_CONCURRENCY || '10', 10); // Number of concurrent users
const TEST_DURATION_SECONDS = parseInt(process.env.TEST_DURATION_SECONDS || '60', 10); // How long to run the test
const USER_SIMULATION_INTERVAL_MS = parseInt(process.env.USER_SIMULATION_INTERVAL_MS || '5000', 10); // How often each user performs an action

const USERS_TO_REGISTER = parseInt(process.env.USERS_TO_REGISTER || '0', 10); // Number of new users to register before testing
const BASE_USERNAME = 'loadtest_user_';

// --- Metrics ---
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalWsMessages: 0,
  responseTimes: [], // Store response times for statistics
  errors: {},
};

const authTokens = [];

// --- Helper Functions ---

async function registerUser(index) {
  const username = `${BASE_USERNAME}${Date.now()}_${index}`;
  const email = `${username}@example.com`;
  const password = 'password123';

  console.log(`Registering user: ${username}...`);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { username } }),
    });
    const data = await response.json();
    if (response.ok && data.session?.access_token) {
      console.log(`User ${username} registered and logged in.`);
      return data.session.access_token;
    } else {
      console.error(`Failed to register user ${username}:`, data.message || data);
      metrics.errors['registration_failed'] = (metrics.errors['registration_failed'] || 0) + 1;
      return null;
    }
  } catch (error) {
    console.error(`Exception during user registration ${username}:`, error.message);
    metrics.errors['registration_exception'] = (metrics.errors['registration_exception'] || 0) + 1;
    return null;
  }
}

async function loginUser(index) {
  const username = `${BASE_USERNAME}${Date.now()}_${index}`;
  const email = `${username}@example.com`; // Assuming email is derived from username
  const password = 'password123';

  console.log(`Logging in user: ${email}...`);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok && data.access_token) {
      console.log(`User ${email} logged in successfully.`);
      return data.access_token;
    } else {
      console.error(`Failed to log in user ${email}:`, data.message || data);
      metrics.errors['login_failed'] = (metrics.errors['login_failed'] || 0) + 1;
      return null;
    }
  } catch (error) {
    console.error(`Exception during user login ${email}:`, error.message);
    metrics.errors['login_exception'] = (metrics.errors['login_exception'] || 0) + 1;
    return null;
  }
}

async function performApiRequest(authToken, endpoint, method = 'GET', body = null) {
  const start = Date.now();
  metrics.totalRequests++;
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const duration = Date.now() - start;
    metrics.responseTimes.push(duration);

    if (response.ok) {
      metrics.successfulRequests++;
      return await response.json();
    } else {
      metrics.failedRequests++;
      const errorText = await response.text();
      console.error(`API Request failed (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
      metrics.errors[response.status] = (metrics.errors[response.status] || 0) + 1;
      return null;
    }
  } catch (error) {
    metrics.failedRequests++;
    console.error(`API Request exception (${endpoint}):`, error.message);
    metrics.errors['network_error'] = (metrics.errors['network_error'] || 0) + 1;
    return null;
  }
}

function setupWebSocket(authToken, userId) {
  const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket';
  const socket = new WebSocket(wsUrl, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
    }
  });

  socket.onopen = () => {
    // console.log(`[User ${userId}] WebSocket opened.`);
    // Join a presence channel, e.g., 'global_metrics'
    socket.send(JSON.stringify({
      event: 'phx_join',
      topic: 'realtime:global_metrics',
      payload: { user_id: userId },
      ref: '1'
    }));

    // Send heartbeat every 10 seconds
    setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          event: 'heartbeat',
          topic: 'realtime:global_metrics',
          payload: { user_id: userId },
          ref: '2'
        }));
      }
    }, 10000);
  };

  socket.onmessage = (_event) => {
    metrics.totalWsMessages++;
    // console.log(`[User ${userId}] WebSocket message:`, event.data);
  };

  socket.onerror = (error) => {
    console.error(`[User ${userId}] WebSocket error:`, error.message);
    metrics.errors['websocket_error'] = (metrics.errors['websocket_error'] || 0) + 1;
  };

  socket.onclose = () => {
    // console.log(`[User ${userId}] WebSocket closed.`);
  };

  return socket;
}

async function simulateUserActivity(userId, authToken) {
  // Perform some API requests
  await performApiRequest(authToken, '/rest/v1/user_profiles?select=username', 'GET');
  await performApiRequest(authToken, '/functions/v1/online-users', 'GET');

  // Simulate chat message if applicable
  // await performApiRequest(authToken, '/rest/v1/messages', 'POST', { chat_id: 'some_id', text: 'hello' });
}

async function runTest() {
  console.log('--- Load Test Started ---');
  console.log(`Target Concurrency: ${TARGET_CONCURRENCY} users`);
  console.log(`Test Duration: ${TEST_DURATION_SECONDS} seconds`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  // 1. Register or Login users
  console.log('\n--- Preparing Users ---');
  for (let i = 0; i < TARGET_CONCURRENCY; i++) {
    let token;
    if (USERS_TO_REGISTER > 0 && i < USERS_TO_REGISTER) {
      token = await registerUser(i);
    } else {
      // For existing users, you'd need to create them beforehand or have a list of credentials
      // For simplicity, this example will try to log in newly registered users or fail if not found.
      // In a real scenario, you'd load existing user credentials here.
      token = await loginUser(i); // Attempt to log in a generic user if not registering
    }

    if (token) {
      authTokens.push(token);
    }
  }

  if (authTokens.length === 0) {
    console.error('No users successfully authenticated. Exiting.');
    return;
  }

  console.log(`Successfully authenticated ${authTokens.length} users.`);

  // 2. Start WebSocket connections and simulate activity
  console.log('\n--- Simulating User Activity ---');
  const userSimulations = authTokens.map((token, index) => {
    const userId = `user_${index}`;
    const ws = setupWebSocket(token, userId);

    // Periodically simulate API requests
    const interval = setInterval(() => {
      simulateUserActivity(userId, token);
    }, USER_SIMULATION_INTERVAL_MS + Math.random() * 1000); // Add some randomness

    return { ws, interval };
  });

  // 3. Run for test duration
  await new Promise(resolve => setTimeout(resolve, TEST_DURATION_SECONDS * 1000));

  // 4. Clean up
  console.log('\n--- Cleaning Up ---');
  userSimulations.forEach(({ ws, interval }) => {
    clearInterval(interval);
    ws.close();
  });

  // 5. Report metrics
  console.log('\n--- Test Results ---');
  console.log(`Total duration: ${TEST_DURATION_SECONDS} seconds`);
  console.log(`Concurrent users: ${authTokens.length}`);
  console.log(`Total HTTP Requests: ${metrics.totalRequests}`);
  console.log(`Successful HTTP Requests: ${metrics.successfulRequests}`);
  console.log(`Failed HTTP Requests: ${metrics.failedRequests}`);
  console.log(`Total WebSocket Messages (received/sent): ${metrics.totalWsMessages}`);

  if (metrics.responseTimes.length > 0) {
    const sortedResponseTimes = [...metrics.responseTimes].sort((a, b) => a - b);
    const min = sortedResponseTimes[0];
    const max = sortedResponseTimes[sortedResponseTimes.length - 1];
    const avg = metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length;
    const p95 = sortedResponseTimes[Math.floor(metrics.responseTimes.length * 0.95)];

    console.log(`HTTP Response Times (ms):`);
    console.log(`  Min: ${min.toFixed(2)}`);
    console.log(`  Max: ${max.toFixed(2)}`);
    console.log(`  Avg: ${avg.toFixed(2)}`);
    console.log(`  P95: ${p95.toFixed(2)}`);
  }

  if (Object.keys(metrics.errors).length > 0) {
    console.log('\nErrors Encountered:');
    for (const errorType in metrics.errors) {
      console.log(`  ${errorType}: ${metrics.errors[errorType]}`);
    }
  }

  console.log('\n--- Load Test Finished ---');
}

// Run the test
runTest();
