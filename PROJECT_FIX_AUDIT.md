# PROJECT FIX AUDIT REPORT

## SECTION 1: CONFIRMED BREAKING ISSUES

### Issue 1: agora-token Edge Function EXISTS (CORRECTED)
- **File(s):** `supabase/functions/agora-token/index.ts` - NOW FOUND
- **Root cause:** The function exists and is properly implemented with:
  - Proper CORS handling via `_shared/cors.ts`
  - HMAC-SHA256 token generation
  - Publisher/subscriber role support
  - Uses `Deno.env.get('AGORA_APP_ID')` for server-side env vars
- **Status:** CORRECTED - Function is present and appears functional
- **Environment Note:** The function uses `Deno.env.get('AGORA_APP_ID')` (server-side), not `VITE_AGORA_APP_ID` (client-side). These must be set via `supabase secrets set AGORA_APP_ID=...` and `supabase secrets set AGORA_APP_CERTIFICATE=...`

---

### Issue 2: MediaStream Track Reuse Failure (Memory Leak + Redundant Track Creation)
- **File(s):** [`src/pages/broadcast/SetupPage.tsx`](src/pages/broadcast/SetupPage.tsx:461)
- **Root cause:** The code stores the MediaStream in PreflightStore (line 260: `PreflightStore.setStream(localStream)`), but then creates NEW Agora tracks using `createMicrophoneAudioTrack()` and `createCameraVideoTrack()` (lines 466-476) instead of reusing the existing tracks from the stored stream.
- **Why it breaks:** 
  1. Creates unnecessary new tracks, causing potential camera/mic resource conflicts
  2. The stored stream is never actually used for track creation
  3. Could cause "camera already in use" errors if browser can't handle multiple track creations
- **Exact fix required:** Instead of creating new tracks, use `AgoraRTC.createCustomAudioTrack()` or `AgoraRTC.createCustomVideoTrack()` with the existing MediaStreamTrack instances from `PreflightStore.getStream()`.

---

### Issue 3: UID Generation Inconsistency Between SetupPage and BroadcastPage
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:419`](src/pages/broadcast/SetupPage.tsx:419) vs [`src/pages/broadcast/BroadcastPage.tsx:753-760`](src/pages/broadcast/BroadcastPage.tsx:753)
- **Root cause:** 
  - SetupPage uses: `Math.floor(Math.random() * 100000)` - pure random
  - BroadcastPage uses: hash-based conversion via `stringToUid()` function
- **Why it breaks:** When a broadcaster starts from SetupPage and gets a random UID, but then BroadcastPage tries to rejoin (e.g., on refresh), it calculates a DIFFERENT hash-based UID for the same user. This causes a mismatch - the broadcaster may not be recognized as the host.
- **Exact fix required:** Use consistent UID generation in both places. Replace `Math.floor(Math.random() * 100000)` in SetupPage with the same hash function used in BroadcastPage.

---

### Issue 4: Token Request Missing Role Parameter
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:422-427`](src/pages/broadcast/SetupPage.tsx:422)
- **Root cause:** The token request in SetupPage only sends `channel` and `uid`:
  ```javascript
  body: {
    channel: streamId,
    uid: numericUid
  }
  ```
  But BroadcastPage sends `role: 'publisher'` (line 769).
- **Why it breaks:** The agora-token function may need the role to generate appropriate permissions. Without it, the token might be generated with incorrect privileges.
- **Exact fix required:** Add `role: 'publisher'` to the token request body in SetupPage.

---

### Issue 5: Race Condition - Stream Insert Before Token Generation
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:390-410`](src/pages/broadcast/SetupPage.tsx:390)
- **Root cause:** The stream is inserted into the database BEFORE generating the Agora token and joining. If the token generation fails, the stream record exists in DB with `status: 'starting'` but the user can't actually broadcast.
- **Why it breaks:** Orphaned stream records that never get cleaned up properly. Users see "starting" streams that never go live.
- **Exact fix required:** Either wrap the insert in a transaction with rollback on token failure, OR insert with `status: 'pending'` and only update to `'starting'` after successful Agora join.

---

## SECTION 2: CONFIRMED HIGH-RISK ISSUES

### Issue 6: PreflightStore Not Cleared on Navigation Failure
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:508-509`](src/pages/broadcast/SetupPage.tsx:508)
- **Root cause:** If navigation to BroadcastPage fails after storing client/tracks in PreflightStore, the store retains stale data.
- **Why it breaks:** On next page visit, stale Agora client and tracks may be reused incorrectly.
- **Exact fix required:** Add try/catch with PreflightStore.clear() in the catch block, or use React's error boundary to clear on navigation failure.

---

### Issue 7: No Error Handling for Duplicate Stream ID
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:390-410`](src/pages/broadcast/SetupPage.tsx:390)
- **Root cause:** The stream ID is pre-generated as UUID (line 86) and used in the insert. If the same ID somehow exists, there's no handling.
- **Why it breaks:** Insert will fail silently or throw unclear error.
- **Exact fix required:** Add `.upsert()` or check for existing stream with same ID before insert.

---

### Issue 8: Hardcoded RTMP URL in Gaming Category
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:530`](src/pages/broadcast/SetupPage.tsx:530)
- **Root cause:** `const agoraRTMPUrl = 'rtmp://rtmp.agora.io/live';` - hardcoded
- **Why it breaks:** If Agora changes their RTMP endpoint, this will break with no way to update without code change.
- **Exact fix required:** Move to environment variable or config file.

---

## SECTION 3: BACKEND CONTRACT MISMATCHES

### Issue 9: streams Table Column Mismatch (Potential)
- **File(s):** Database migrations vs frontend insert
- **Root cause:** Frontend inserts: `id`, `user_id`, `title`, `category`, `stream_kind`, `camera_ready`, `status`, `is_live`, `started_at`, `box_count`, `layout_mode`, `selected_religion`
- **Database migrations show columns:**
  - `stream_kind` added in: `20270330000000_trollmers_weekly_leaderboard.sql`
  - `camera_ready` added in: `20270330000000_trollmers_weekly_leaderboard.sql`
  - `layout_mode` added in: `20270220080000_battle_pot_and_schema_fix.sql`
- **Why it breaks:** If migrations aren't applied in correct order, insert will fail with "column does not exist" error.
- **Exact fix required:** Verify all migrations are applied and columns exist. Add migration version check or schema validation on app startup.

---

### Issue 10: selected_religion Column May Not Exist
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:407`](src/pages/broadcast/SetupPage.tsx:407)
- **Root cause:** Frontend sends `selected_religion` column but no migration explicitly adds it to streams table.
- **Why it breaks:** Insert will fail for 'spiritual' category broadcasts.
- **Exact fix required:** Add migration: `ALTER TABLE streams ADD COLUMN IF NOT EXISTS selected_religion TEXT;`

---

### Issue 11: user_id vs broadcaster_id / streamer_id Column Confusion
- **File(s):** Multiple places referencing different user ID columns
- **Root cause:** streams table has: `user_id`, `broadcaster_id`, `streamer_id`, `owner_id`, `host_user_id`
- **Why it breaks:** Code inconsistently uses different columns. SetupPage uses `user_id`, but some RLS policies reference `broadcaster_id`.
- **Exact fix required:** Standardize on one column (preferably `user_id`) and update all references.

---

## SECTION 4: AGORA FLOW VIOLATIONS

### Issue 12: No Token Expiry Handling
- **File(s):** [`src/pages/broadcast/BroadcastPage.tsx`](src/pages/broadcast/BroadcastPage.tsx) and [`src/hooks/useAgoraRoom.ts`](src/hooks/useAgoraRoom.ts)
- **Root cause:** Tokens are generated with 3600 second expiry (from .env: `AGORA_TOKEN_EXPIRY_SECONDS=3600`) but there's no reconnection logic when token expires.
- **Why it breaks:** After 1 hour, broadcasts will fail with token expired errors.
- **Exact fix required:** Add token refresh logic before expiry or implement reconnection with new token.

---

### Issue 13: No Track Publication Failure Handling
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:498`](src/pages/broadcast/SetupPage.tsx:498)
- **Root cause:** `await agoraClient.publish(tracksToPublish)` has no error handling for publication failure.
- **Why it breaks:** If publish fails, user is navigated to BroadcastPage but their tracks aren't actually visible to viewers.
- **Exact fix required:** Add try/catch around publish, show error toast, and offer retry option.

---

### Issue 14: Screen Share Track Not Properly Published
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:479-496`](src/pages/broadcast/SetupPage.tsx:479)
- **Root cause:** When screen sharing is active, camera overlay tracks are created but the screen stream itself (`screenStream`) is NOT converted to Agora tracks and published.
- **Why it breaks:** Viewers won't see the screen share, only the camera overlay.
- **Exact fix required:** Convert `screenStream` to Agora tracks and publish separately.

---

### Issue 15: Client Not Properly Cleaned Up on Component Unmount
- **File(s):** [`src/pages/broadcast/BroadcastPage.tsx:90-116`](src/pages/broadcast/BroadcastPage.tsx:90)
- **Root cause:** `stopLocalTracks` function is defined with `localTracks` in dependency array but `agoraClientRef` is accessed inside without being in deps.
- **Why it breaks:** Potential memory leak and orphaned Agora connections.
- **Exact fix required:** Use refs for client access in cleanup, ensure proper dependency array.

---

## SECTION 5: CORS FAILURES

### Issue 16: CORS Headers Properly Implemented (CORRECTED)
- **File(s):** `supabase/functions/agora-token/index.ts` - NOW FOUND
- **Root cause:** The function properly imports and uses `handleCorsPreflight` from `_shared/cors.ts`
- **Status:** CORRECTED - CORS is properly handled
- **Note:** Line 143: `if (req.method === 'OPTIONS') return handleCorsPreflight()`

---

### Issue 17: CORS Allowed Origins May Be Incomplete
- **File(s):** [`supabase/functions/_shared/cors.ts:22-36`](supabase/functions/_shared/cors.ts:22)
- **Root cause:** Allowed origins list may not include all deployment URLs. Current list:
  - `https://matrollcity.com`
  - `https://www.matrollcity.com`
  - `https://maitrollcity.com`
  - `https://www.maitrollcity.com`
  - Various localhost ports
- **Why it breaks:** If app is deployed to new domain, CORS will block requests.
- **Exact fix required:** Use environment variable for allowed origins list.

---

## SECTION 6: ENVIRONMENT INCONSISTENCIES

### Issue 17: Environment Variables Correctly Separated (INFORMATIONAL)
- **File(s):** Edge function vs frontend
- **Root cause:** This is actually CORRECT architecture:
  - Frontend uses: `VITE_AGORA_APP_ID` (Vite client-side env var)
  - Edge function uses: `Deno.env.get('AGORA_APP_ID')` (server-side env var)
- **Status:** CORRECT - This is proper separation of client and server secrets
- **Requirement:** Both must be set:
  - Frontend: `VITE_AGORA_APP_ID` in `.env` file
  - Edge Function: `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` via `supabase secrets set`

---

### Issue 18: No Fallback for Missing Agora App ID
- **File(s):** [`src/pages/broadcast/SetupPage.tsx:452`](src/pages/broadcast/SetupPage.tsx:452)
- **Root cause:** Code uses non-null assertion `import.meta.env.VITE_AGORA_APP_ID!` without fallback.
- **Why it breaks:** If env var is missing, app will crash with unclear error.
- **Exact fix required:** Add proper null check with meaningful error message.

---

### Issue 20: Multiple Supabase URLs in Configuration
- **File(s):** `.env` and `src/lib/config.ts`
- **Root cause:** 
  - `.env`: `VITE_SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co`
  - `.env`: `VITE_API_URL=https://mnaitrollcity.com`
  - `.env`: `VITE_EDGE_FUNCTIONS_URL=https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1`
- **Why it breaks:** Confusion about which URL to use where. Edge functions use Supabase URL but API uses different domain.
- **Exact fix required:** Document the architecture or consolidate to single consistent URL pattern.

---

## SECTION 7: VERIFIED WORKING SYSTEMS

### Confirmed Working Systems:

1. **Supabase Client Configuration** - `src/lib/supabase.ts` properly initializes with URL and anon key from environment variables.

2. **Broadcast Page Realtime Subscriptions** - The Supabase realtime channel subscription logic is well-implemented with proper error handling and retry logic for `CHANNEL_ERROR`, `CLOSED`, and `TIMED_OUT` states.

3. **Category Configuration System** - `src/config/broadcastCategories.ts` is well-structured with proper typing for BroadcastCategoryId, layout modes, and category-specific features.

4. **PreflightStore Structure** - The store itself has proper typing and clear separation between MediaStream, Agora client, and local tracks.

5. **Role-Based Access Control** - Database RLS policies are comprehensive with multiple fallback policies.

6. **Broadcast Category Restrictions** - The category-specific restrictions (Trollmers follower count, election officer-only, spiritual religion requirement) are properly validated in SetupPage.

7. **Mux Integration** - Mux playback ID polling and fallback logic is properly implemented.

8. **Gift System** - Realtime gift event handling is properly implemented with proper typing.

9. **Seat/Roster System** - The stream seats system with pricing and locking is properly implemented.

10. **CORS Shared Module** - The `_shared/cors.ts` provides proper CORS handling with dynamic origin validation and credentials support.

---

## SUMMARY

**GOOD NEWS: Most issues have already been fixed in the codebase!**

After verification, the following issues flagged in the audit are actually already resolved:

1. **MediaStream track reuse** - FIXED: Uses `createCustomAudioTrack`/`createCustomVideoTrack` (lines 480-489)
2. **UID generation consistency** - FIXED: Both SetupPage and BroadcastPage use `stringToUid()` hash function
3. **Role parameter** - FIXED: Token request includes `role: 'publisher'` (line 433)
4. **Stream insert race condition** - FIXED: Inserts as 'pending', updates to 'starting' after success (lines 399-400, 524-531)
5. **selected_religion column** - EXISTS: Migration file at `supabase/migrations/add_broadcast_category_columns.sql`
6. **Agora App ID fallback** - EXISTS: Proper validation with error message (lines 456-461)

**Remaining Issues to Review:**

- High-risk: PreflightStore not cleared on navigation failure
- High-risk: Hardcoded RTMP URL
- Backend: User ID column inconsistencies
- Agora: No token expiry handling
- Agora: Screen share tracks not fully published
- Agora: Client cleanup on unmount
