import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { Room, RoomEvent, LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { registerGlobals, RTCAudioSource, RTCVideoSource, RTCVideoFrame } from '@livekit/rtc-node';

registerGlobals();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDGE_FUNCTIONS_URL = process.env.VITE_EDGE_FUNCTIONS_URL || `${SUPABASE_URL}/functions/v1`;
const TOKEN_URL = process.env.VITE_LIVEKIT_TOKEN_URL || `${EDGE_FUNCTIONS_URL}/livekit-token`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const RUN_ID = process.env.RUN_ID || `livekit_launch_${Date.now()}`;
const REPORT_DIR = path.join(process.cwd(), 'test_results');
const REPORT_FILE = path.join(REPORT_DIR, `livekit_launch_${RUN_ID}.json`);

const CONFIG = {
  rooms: Number(process.env.LIVEKIT_TEST_ROOMS || 10),
  hosts: Number(process.env.LIVEKIT_TEST_HOSTS || 10),
  viewersPerRoom: Number(process.env.LIVEKIT_VIEWERS_PER_ROOM || 25),
  runtimeSeconds: Number(process.env.LIVEKIT_RUNTIME_SECONDS || 75),
  viewerConnectConcurrency: Number(process.env.LIVEKIT_VIEWER_CONNECT_CONCURRENCY || 20),
  videoRooms: Number(process.env.LIVEKIT_VIDEO_ROOMS || 2)
};

const metrics = {
  tokenMintMs: [],
  roomJoinMs: [],
  connectSuccess: 0,
  connectFailures: 0,
  publishSuccess: 0,
  publishFailures: 0,
  disconnects: 0,
  reconnects: 0
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWithConcurrency(tasks, limit) {
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const current = index++;
      await tasks[current]();
    }
  };
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
}

async function createHosts(count) {
  const password = `LKPass!${Date.now()}`;
  const hosts = [];
  for (let i = 0; i < count; i++) {
    const email = `livekit+${RUN_ID}-${i}@trollcity.local`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error || !data?.user) {
      console.error('Failed to create host', error?.message || 'unknown');
      continue;
    }
    hosts.push({ id: data.user.id, email, password });
  }

  const profiles = hosts.map((host, idx) => ({
    id: host.id,
    username: `lk_host_${RUN_ID}_${idx}`,
    troll_coins: 1_000_000,
    is_broadcaster: true,
    run_id: RUN_ID,
    source: 'livekit_test'
  }));

  if (profiles.length) {
    await adminClient.from('user_profiles').upsert(profiles, { onConflict: 'id' });
  }

  return hosts;
}

async function signInHost(host) {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: host.email,
    password: host.password
  });
  if (error || !data?.session?.access_token) {
    throw new Error(error?.message || 'Failed to sign in host');
  }
  return data.session.access_token;
}

async function requestToken({ roomName, identity, accessToken }) {
  const start = performance.now();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({
      roomName,
      identity,
      allowPublish: !!accessToken
    })
  });
  const json = await response.json();
  metrics.tokenMintMs.push(performance.now() - start);
  if (!response.ok) {
    throw new Error(json?.error || `Token request failed (${response.status})`);
  }
  return json;
}

async function connectParticipant({ token, livekitUrl, publishAudio, publishVideo }) {
  const room = new Room();
  let connectedAt = 0;

  room.on(RoomEvent.Disconnected, () => {
    metrics.disconnects += 1;
  });
  room.on(RoomEvent.Reconnected, () => {
    metrics.reconnects += 1;
  });

  const start = performance.now();
  await room.connect(livekitUrl, token);
  connectedAt = performance.now();
  metrics.roomJoinMs.push(connectedAt - start);
  metrics.connectSuccess += 1;

  if (publishAudio) {
    try {
      const audioSource = new RTCAudioSource();
      const audioTrack = LocalAudioTrack.createAudioTrack('mic', audioSource);
      await room.localParticipant.publishTrack(audioTrack);
      metrics.publishSuccess += 1;
    } catch {
      metrics.publishFailures += 1;
    }
  }

  if (publishVideo) {
    try {
      const videoSource = new RTCVideoSource();
      const frame = new RTCVideoFrame(Buffer.alloc(4), 1, 1);
      videoSource.onFrame(frame);
      const videoTrack = LocalVideoTrack.createVideoTrack('camera', videoSource);
      await room.localParticipant.publishTrack(videoTrack);
      metrics.publishSuccess += 1;
    } catch {
      metrics.publishFailures += 1;
    }
  }

  return room;
}

async function main() {
  console.log('🚀 LiveKit launch test starting...');
  const rooms = Array.from({ length: CONFIG.rooms }, (_, i) => `launch-${RUN_ID}-${i + 1}`);

  const hosts = await createHosts(CONFIG.hosts);
  const hostTokens = [];

  for (let i = 0; i < Math.min(CONFIG.rooms, hosts.length); i++) {
    const host = hosts[i];
    const accessToken = await signInHost(host);
    const tokenData = await requestToken({ roomName: rooms[i], identity: host.id, accessToken });
    hostTokens.push({ roomName: rooms[i], token: tokenData.token, livekitUrl: tokenData.livekitUrl || tokenData.url });
  }

  const hostRooms = await Promise.all(
    hostTokens.map((hostToken, idx) =>
      connectParticipant({
        token: hostToken.token,
        livekitUrl: hostToken.livekitUrl,
        publishAudio: true,
        publishVideo: idx < CONFIG.videoRooms
      })
    )
  );

  const viewerTasks = [];
  for (const roomName of rooms) {
    for (let i = 0; i < CONFIG.viewersPerRoom; i++) {
      viewerTasks.push(async () => {
        try {
          const guestId = `guest-${RUN_ID}-${roomName}-${i}`;
          const tokenData = await requestToken({ roomName, identity: guestId });
          const room = await connectParticipant({
            token: tokenData.token,
            livekitUrl: tokenData.livekitUrl || tokenData.url,
            publishAudio: false,
            publishVideo: false
          });
          await sleep(CONFIG.runtimeSeconds * 1000);
          room.disconnect();
        } catch {
          metrics.connectFailures += 1;
        }
      });
    }
  }

  await runWithConcurrency(viewerTasks, CONFIG.viewerConnectConcurrency);

  await sleep(CONFIG.runtimeSeconds * 1000);
  hostRooms.forEach((room) => room.disconnect());

  const participantMinutes = (CONFIG.rooms * (CONFIG.viewersPerRoom + 1) * CONFIG.runtimeSeconds) / 60;

  const report = {
    startedAt: new Date().toISOString(),
    run_id: RUN_ID,
    config: CONFIG,
    metrics: {
      token_p50_ms: percentile(metrics.tokenMintMs, 50),
      token_p95_ms: percentile(metrics.tokenMintMs, 95),
      join_p50_ms: percentile(metrics.roomJoinMs, 50),
      join_p95_ms: percentile(metrics.roomJoinMs, 95),
      connect_success_rate: metrics.connectSuccess / Math.max(1, metrics.connectSuccess + metrics.connectFailures),
      publish_success_rate: metrics.publishSuccess / Math.max(1, metrics.publishSuccess + metrics.publishFailures),
      disconnects: metrics.disconnects,
      reconnects: metrics.reconnects
    },
    estimated_participant_minutes: participantMinutes
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`LiveKit launch test complete. Report: ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error('LiveKit launch test failed:', err);
  process.exit(1);
});
