# Agora Broadcast Flow: From Sidebar Click to End Broadcast

This document explains the complete flow of a user initiating a broadcast from the sidebar, through the Agora setup, and ending the broadcast.

## 1. Sidebar "Go Live" Click

**Location:** `src/components/Sidebar.tsx` (lines 246-262)

```tsx
<div className={`px-4 mb-2 mt-2 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
  <Link
    to="/broadcast/setup"
    className={`
      relative group flex items-center justify-center gap-2
      bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600
      hover:from-yellow-500 hover:via-yellow-300 hover:to-yellow-500
      text-black font-bold rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.5)]
      transition-all duration-300 hover:scale-[1.02] border border-yellow-200/50
      ${isSidebarCollapsed ? 'w-10 h-10 p-0' : 'w-full py-3 px-4'}
    `}
  >
    <Video size={isSidebarCollapsed ? 20 : 20} className="text-black" />
    {!isSidebarCollapsed && (
      <span className="uppercase tracking-wide text-sm">Go Live</span>
    )}
  </Link>
</div>
```

When clicked, this navigates to `/broadcast/setup`.

## 2. Broadcast Setup Page

The user arrives at the broadcast setup page (not shown in provided files, but implied to exist). Here they configure their stream (title, category, etc.) and click "Start Broadcast".

## 3. Broadcast Page Initialization

**Location:** `src/pages/broadcast/BroadcastPage.tsx`

When the user navigates to a broadcast page (e.g., `/broadcast/123`), the `BroadcastPage` component mounts and begins the Agora initialization process.

### Key State Variables:
- `stream`: Contains stream data from Supabase
- `user`: Current authenticated user
- `localTracks`: Agora local audio/video tracks
- `remoteUsers`: Remote users in the channel
- `isJoining`: Boolean indicating if joining Agora
- `hasJoinedRef`: Ref tracking if user has already joined Agora
- `agoraClientRef`: Ref to Agora RTC client
- `userIdToAgoraUid`: Mapping of user IDs to Agora UIDs

### 3.1 Stream Fetching
```tsx
useEffect(() => {
  if (!streamId) {
    setError('No stream ID provided.')
    setIsLoading(false)
    return
  }

  const fetchStream = async () => {
    const { data, error } = await supabase
      .from('streams')
      .select('*, total_likes, hls_url')
      .eq('id', streamId)
      .maybeSingle()

    // ... error handling

    setStream(data)
    // Fetch broadcaster profile
    setIsLoading(false)
  }

  fetchStream()
}, [streamId, navigate])
```

### 3.2 Agora Initialization
The core Agora logic is in the `useEffect` that runs when `stream?.id` and `user?.id` change:

```tsx
useEffect(() => {
  // ... validation checks

  const initAgora = async () => {
    // Determine if user should publish (host/guest with seat) or just subscribe (viewer)
    const shouldPublish = isHost || !!userSeat;

    if (shouldPublish) {
      // HOST/GUEST PATH: Initialize Agora as publisher
      // 1. Request token from Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channel: stream.id,
          uid: agoraUid, // numeric UID
          role: 'publisher'
        }
      });

      // 2. Join Agora channel with token
      await client.join(appId, stream.id, data.token, agoraUid);

      // 3. Create local tracks (camera/microphone)
      const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
        { AEC: true, AGC: true, ANS: true }, // audio config
        { video: videoConfig } // video config
      );

      // 4. Publish tracks
      await client.publish(tracks);
      setLocalTracks(tracks);

      // 5. Add self to remoteUsers for local display
      const hostAsRemoteUser = {
        uid: agoraUid,
        hasVideo: true,
        hasAudio: true,
        videoTrack: tracks[1] as any,
        audioTrack: tracks[0] as any
      };
      setRemoteUsers(prev => [...prev, hostAsRemoteUser]);

      // 6. Mark stream as live in database
      await supabase
        .from('streams')
        .update({ is_live: true, status: 'live' })
        .eq('id', stream.id);
    } else {
      // VIEWER PATH: Join as audience to subscribe
      // Similar process but with role: 'audience' and no track publishing
    }
  };

  initAgora();

  // Cleanup function
  return () => {
    // Leave channel, close tracks
  };
}, [stream?.id, user?.id, isHost, !!userSeat, hostMicMutedByOfficer]);
```

### 3.3 Token Fetching Process

The app uses TWO token endpoints for redundancy:

#### Primary: Supabase Edge Function
**Location:** `supabase/functions/agora-token/index.ts`
- Uses Deno-based implementation
- Implements Agora's AccessToken2 specification directly
- No external dependencies
- Returns token plus metadata (appId, channel, uid, etc.)

#### Fallback: Node.js API
**Location:** `server/api/agora-token.js`
- Uses `agora-token` npm package
- Simpler implementation
- Used when edge function is unavailable

Both endpoints:
- Accept `channel` (stream ID), `uid` (numeric), and `role` ('publisher' or 'audience')
- Validate required parameters
- Retrieve Agora credentials from environment variables
- Generate token with 1-hour expiration
- Return JSON with token

### 3.4 UID Generation
```tsx
// Helper function to convert UUID string to numeric UID for Agora
const stringToUid = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

// Usage:
const numericUid = stringToUid(user.id);
```

### 3.5 Event Handling
The Agora client sets up event handlers for:
- `user-published`: When a remote user publishes tracks
- `user-joined`: When a remote user joins the channel
- `user-unpublished`: When a remote user unpublishes tracks

These handlers update the `remoteUsers` state which is used by `BroadcastGrid` to display video.

## 4. Broadcast Controls

**Location:** `src/components/broadcast/BroadcastControls.tsx` (referenced in BroadcastPage)

The controls include:
- **End Broadcast Button**: Calls `handleStreamEnd` function
- **Camera/Mic Toggle**: Calls `toggleCamera`/`toggleMicrophone`
- **Gift Button**: Opens gift modal
- **Seat Management**: For guests to join/leave seats
- **Like Button**: For viewers to like the stream

### 4.1 End Broadcast Flow
**Location:** `src/pages/broadcast/BroadcastPage.tsx` (handleStreamEnd function)

```tsx
const handleStreamEnd = async () => {
  // 1. Stop local tracks (camera/mic)
  stopLocalTracks();

  // 2. Handle battle forfeit if applicable
  if (stream?.battle_id && isHost) {
    // Forfeit battle, credit opponent as winner
  }

  // 3. Mark stream as ended in database
  const { error: updateError } = await supabase
    .from('streams')
    .update({
      is_live: false,
      status: 'ended',
      ended_at: new Date().toISOString()
    })
    .eq('id', stream.id);

  // 4. Update local state
  setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null);

  // 5. Navigate to summary page
  navigate(`/broadcast/summary/${stream?.id}`);
};
```

### 4.2 stopLocalTracks Function
```tsx
const stopLocalTracks = useCallback(() => {
  // 1. Stop and close local tracks
  if (localTracks) {
    localTracks.forEach((track, index) => {
      if (track) {
        try {
          track.stop();
          track.close();
        } catch (e) {
          console.warn('[BroadcastPage] Error stopping track:', e);
        }
      }
    });
    setLocalTracks(null);
  }

  // 2. Leave Agora channel
  const client = agoraClientRef.current;
  if (client) {
    console.log('[BroadcastPage] Leaving Agora channel');
    client.leave().catch(console.error);
  }

  // 3. Clear stores
  PreflightStore.clear();
  clearTracks(); // from useStreamStore
}, [localTracks, clearTracks]);
```

## 5. BroadcastGrid - Displaying Video

**Location:** `src/components/broadcast/BroadcastGrid.tsx`

The `BroadcastGrid` component renders the video feeds:

### 5.1 Local User Display
For the host/guest with seat:
```tsx
{(() => {
  const shouldShowVideo = videoTrack && isCamOn;
  return shouldShowVideo;
})() ? (
  <AgoraVideoPlayer
    videoTrack={videoTrack}
    isLocal={isLocal}
  />
) : /* ... placeholder UI when camera off ... */}
```

### 5.2 Remote User Display
For viewers and other participants:
```tsx
{userId && participant ? (
  <AgoraVideoPlayer
    videoTrack={videoTrack}
    isLocal={isLocal}
  />
) : /* ... connecting/waiting UI ... */}
```

### 5.3 Audio Handling
```tsx
{audioTrack && !isLocal && <AgoraAudioPlayer audioTrack={audioTrack} />}
```

## 6. Real-time Updates

The page maintains real-time connections for:
- **Viewer Count**: Via Supabase presence channel
- **Stream Updates**: Via Supabase postgres_changes on streams table
- **Box Count Updates**: Via custom broadcast events
- **Gifts/Likes**: Via custom broadcast events

These ensure all viewers see live updates without polling.

## 7. Environment Configuration

Required environment variables:
- `VITE_AGORA_APP_ID`: Agora App ID (frontend)
- `AGORA_APP_ID`: Agora App ID (backend)
- `AGORA_APP_CERTIFICATE`: Agora App Certificate (backend)
- `VITE_EDGE_FUNCTIONS_URL`: Edge functions URL
- Supabase URL and anon key

## Troubleshooting Common Issues

1. **No Video Display**:
   - Check Agora token generation (network tab in dev tools)
   - Verify user has granted camera/mic permissions
   - Check if `localTracks` is set correctly
   - Ensure `isCamOn` is true when camera should be on

2. **Token Errors**:
   - Verify Agora credentials are set in `.env` files
   - Check that edge function is deployed (`supabase functions deploy`)
   - Ensure UID is being converted to number correctly

3. **Connection Issues**:
   - Check firewall/port restrictions (Agora uses specific ports)
   - Verify areaCode is set correctly ('NORTH_AMERICA')
   - Try different Agora server regions if needed

4. **Stream Not Ending Properly**:
   - Ensure `handleStreamEnd` is called when leaving broadcast
   - Check that `stopLocalTracks` properly cleans up resources
   - Verify database update succeeds

## Data Flow Summary

1. User clicks "Go Live" in sidebar → `/broadcast/setup`
2. User configures stream and clicks "Start Broadcast" → `/broadcast/:streamId`
3. BroadcastPage fetches stream data from Supabase
4. BroadcastPage initializes Agora:
   - Determines if user should publish or subscribe
   - Fetches token from Supabase Edge Function (or Node.js fallback)
   - Joins Agora channel with token and numeric UID
   - Creates and publishes local tracks (if publishing)
   - Sets up event handlers for remote users
5. BroadcastGrid renders video tracks from local and remote users
6. User interacts with controls (toggle camera/mic, send gifts, etc.)
7. User clicks "End Broadcast":
   - Local tracks stopped and closed
   - Leaves Agora channel
   - Stream marked as ended in database
   - Navigates to broadcast summary page