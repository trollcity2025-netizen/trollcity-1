# Mux Functions Status Report

## Created but NOT Used (Frontend never calls them)

### 1. rtmp-relay/ 
- **Location:** `supabase/functions/rtmp-relay/`
- **Status:** EMPTY - No index.ts file exists
- **Purpose:** Was supposed to relay Agora video to Mux RTMP ingest
- **Issue:** Never implemented - folder exists but contains only config files

## Created and NOW Being Used (After recent fix)

### 2. create-mux-stream
- **Location:** `supabase/functions/create-mux-stream/index.ts`
- **Status:** NOW CALLED from `BroadcastPage.tsx` when host goes live
- **Purpose:** Creates Mux live stream, returns playback_id

## Created but Waiting for External Trigger

### 3. mux-webhook
- **Location:** `supabase/functions/mux-webhook/index.ts`
- **Status:** Deployed, waiting for Mux to send webhook events
- **Purpose:** Receives Mux stream status updates (active/idle/disconnected)
- **Trigger:** Mux Dashboard → Webhook configuration needed

## Summary

| Function | Called From Frontend | Status |
|----------|---------------------|--------|
| create-mux-stream | ✅ Yes (new) | Working |
| mux-webhook | ❌ No (external) | Waiting for Mux |
| rtmp-relay | ❌ No | Not implemented |

## What's Missing

The **RTMP relay** is the critical missing piece. Current flow:
- Host → Agora ✅
- Viewers → Mux (if playback_id exists) ✅

But there's no relay from:
- Agora → Mux RTMP ingest ❌

This means Mux streams are created but never receive video content!
