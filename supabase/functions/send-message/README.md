# Message Trust: send-message Edge Function

This Edge Function provides a secure, production-grade way to send messages (chat, gifts, etc.) with server-side signing and anti-replay protection.

## Envelope Format

The function returns a signed JSON envelope:

```json
{
  "v": 1,
  "kid": "k1",
  "t": "chat|gift|mod|sys|battle|count",
  "stream_id": "uuid",
  "s": "sender_user_id",
  "ts": 1676234500123,
  "txn_id": "uuid",
  "d": { "content": "..." },
  "sig": "base64url(hmac_sha256(canonical_string))"
}
```

## Signing Mechanism

### Canonical String
The signature is generated over a canonical string to avoid JSON key ordering issues:
`v=1|t={type}|stream_id={stream_id}|sender_id={user_id}|txn_id={txn_id}|ts={ts}|payload_hash={payload_hash}`

### Payload Hash
The `payload_hash` is a SHA-256 hash of the minified JSON data (`d`).

### Signature
The `sig` is an HMAC-SHA256 signature using a server-side `MESSAGE_SIGNING_SECRET`.

## Anti-Replay Protection
- **txn_id**: Each request must include a unique UUID v4.
- **Redis Check**: The function checks Redis for the `txn_id` with a 15-minute TTL. If seen before, the request is rejected with `409 Conflict`.

## Verification Rules (for Consumers)
1.  **Verify Signature**: Compute the canonical string and verify `sig` using the shared secret.
2.  **Verify Timestamp**: Reject messages with `ts` older than 60s (to prevent long-term replay).
3.  **Verify Sender**: Ensure `s` matches the expected sender if applicable.

## Failure Modes
- `401 Unauthorized`: Missing or invalid Supabase JWT.
- `400 Bad Request`: Missing required fields (`type`, `stream_id`, `txn_id`, `data`).
- `403 Forbidden`: User is muted or banned in the target stream.
- `404 Not Found`: Stream does not exist or is inactive.
- `409 Conflict`: Duplicate `txn_id` detected (replay attack).
- `429 Too Many Requests`: Rate limit exceeded (5 messages/sec per type).
- `500 Internal Server Error`: Signing or transport failure.

## Transport
The function publishes the signed envelope to:
1.  **Supabase Broadcast**: Channel `stream:{stream_id}` for immediate UI updates.
2.  **Redis Streams**: Stream `stream:events:{stream_id}` for persistence workers (updating leaderboards, DB logs, etc.).
