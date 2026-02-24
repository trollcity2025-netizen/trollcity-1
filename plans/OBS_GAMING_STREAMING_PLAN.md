# OBS Gaming Streaming Architecture Plan

## Current Situation

Troll City currently uses **Agora** for real-time streaming within the browser. The gaming broadcast category tries to show OBS setup instructions but:
- Uses Mux RTMP URL (wrong - user said they use Agora)
- Agora doesn't support standard RTMP ingest without additional configuration
- Users get "hostname not found" errors when trying to connect

## Problem

OBS streams via **RTMP** (Real-Time Messaging Protocol)
Troll City streams via **Agora WebRTC** (Real-Time Communication)

These are incompatible - OBS cannot directly stream to Agora without middleware.

---

## Available Solutions

### Option 1: Use Mux (Recommended for Quick Setup)
**Pros:**
- Already integrated in codebase
- Simple RTMP ingest
- Converts to HLS for playback

**Cons:**
- Costs money per stream hour
- Need to configure Mux properly

**RTMP URL:** `rtmp://global-live.mux.com:5222/app`
**Stream Key:** Generated per-stream from `create-mux-stream` edge function

### Option 2: Custom RTMP Server (Self-Hosted)
**Pros:**
- Full control
- No per-hour costs (once deployed)
- Can use NGINX with RTMP module

**Cons:**
- Requires server infrastructure
- More setup time

**Example:** NGINX with `rtmp` module:
```
rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        
        application live {
            live on;
            record off;
        }
    }
}
```

### Option 3: Agora Cloud Recording (If Enabled)
**Pros:**
- Uses existing Agora infrastructure

**Cons:**
- Requires Agora Cloud Recording be enabled in Agora Console
- May have additional costs
- Complex setup

---

## Recommended Approach

**Use Mux** since it's already integrated in the codebase.

### Implementation Steps:

1. **Update SetupPage to use Mux RTMP**
   - RTMP URL: `rtmp://global-live.mux.com:5222/app`
   - Stream Key: From `create-mux-stream` function

2. **Ensure stream creation works correctly**
   - When user selects "Gaming" category
   - Call `create-mux-stream` edge function
   - Get stream key and RTMP URL from response
   - Display in OBS panel

3. **Handle incoming RTMP stream**
   - Mux converts RTMP to HLS
   - Store playback ID in database
   - Viewers watch via HLS playback URL

---

## Files to Modify

1. `src/pages/broadcast/SetupPage.tsx`
   - Update OBS panel to use Mux RTMP URL
   - Get stream key from `create-mux-stream` response
   - Store mux_playback_id, mux_stream_key, mux_rtmp_url

2. Edge function `create-mux-stream`
   - Already exists, verify it returns correct format
   - Returns: stream_key, rtmp_url, playback_id

---

## Mux Integration Already Exists

The code at lines 353-386 in SetupPage.tsx already calls `create-mux-stream`:

```javascript
const { data: muxData, error: muxError } = await supabase.functions.invoke('create-mux-stream', {
  body: {
    type: 'broadcast',
    room_id: streamId,
    room_name: title,
    title: title
  }
});
```

The response contains:
- `stream_key` - Use as OBS stream key
- `rtmp_url` - RTMP ingest URL  
- `playback_id` - For viewers to watch

**Issue:** The OBS panel shows hardcoded Mux URL instead of using the one from the function response.

---

## Next Steps

1. **Confirm:** Should we use Mux for gaming OBS streaming?
2. **Update:** Fix SetupPage to use Mux RTMP from function response
3. **Test:** Verify OBS can connect and stream is viewable
