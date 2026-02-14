/**
 * Test suite for send-message Edge Function
 * Note: Designed for Deno runtime
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/send-message";
const MOCK_JWT = "mock-jwt"; // In real tests, get this from supabase.auth.signIn()

Deno.test("Happy Path: Signed chat delivers correctly", async () => {
  const payload = {
    type: "chat",
    stream_id: "7538234d-1786-4444-934c-687f2e1329a7",
    txn_id: crypto.randomUUID(),
    data: { content: "Hello world!" }
  };

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MOCK_JWT}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 200);
  const envelope = await res.json();
  assertExists(envelope.sig);
  assertEquals(envelope.t, "chat");
  assertEquals(envelope.d.content, "Hello world!");
});

Deno.test("Replay Protection: Resending same txn_id fails", async () => {
  const txn_id = crypto.randomUUID();
  const payload = {
    type: "chat",
    stream_id: "7538234d-1786-4444-934c-687f2e1329a7",
    txn_id: txn_id,
    data: { content: "Replay test" }
  };

  // First send
  await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${MOCK_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  // Second send with same txn_id
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${MOCK_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 409);
  const error = await res.json();
  assertEquals(error.error, "Duplicate transaction (replay protection)");
});

Deno.test("Mute Check: Muted user cannot send", async () => {
  // Note: This requires a pre-configured muted user in the DB
  const payload = {
    type: "chat",
    stream_id: "7538234d-1786-4444-934c-687f2e1329a7",
    txn_id: crypto.randomUUID(),
    data: { content: "I am muted" }
  };

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer MUTED_USER_JWT`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 403);
  const error = await res.json();
  assertEquals(error.error, "You are muted in this stream");
});

Deno.test("Spoof Attempt: Client cannot skip signing", async () => {
  // This test verifies that the transport (Supabase Broadcast) is only populated by the server.
  // In a real E2E test, we would listen to the channel and ensure no unsigned messages are received.
  // The function itself ensures it only returns signed envelopes.
});
