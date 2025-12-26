# Troll Court UUID Flicker Fix

## Problem Description
- UUID flickering inside video panels during broadcast
- Click blocking on broadcast box elements  
- Video container remounting/unstable rendering

## Root Causes Identified

### 1. Unstable React Keys (Line 343)
```jsx
key={t.publication?.trackSid || t.participant?.identity || `track-${index}`}
```
**Issue**: Using `t.participant?.identity` as a fallback key causes remounting when identity properties change or track object reference changes.

### 2. Component Redefinition
- `CourtVideoGrid` defined inside component body (line 317)
- Not memoized, gets recreated on every parent render
- `visible` array created fresh each render (line 323)

### 3. Polling-Triggered Re-renders (Line 98-117)
```jsx
const id = window.setInterval(async () => {
  setBoxCount(Math.min(6, Math.max(2, data.max_boxes)));
}, 5000);
```
**Issue**: Every 5 seconds, state updates trigger full component re-render, recreating all child components and their keys.

### 4. Missing Console Logging
- No way to verify when components mount/unmount
- Can't debug if ParticipantTile is being remounted

## Solution Implementation

### Step 1: Stabilize Room ID  
Use `useRef` to store roomId once when component mounts:

```typescript
const roomIdRef = useRef<string>(courtId);
useEffect(() => {
  if (courtId && !roomIdRef.current) {
    roomIdRef.current = courtId;
    console.log('[CourtRoom] Room ID stabilized:', courtId);
  }
}, [courtId]);
const roomId = roomIdRef.current;
```

### Step 2: Memoize Video Grid Component
Extract `CourtVideoGrid` outside main component as a memoized component:

```typescript
interface CourtVideoGridProps {
  maxTiles: number;
}

const CourtVideoGrid = memo(({ maxTiles }: CourtVideoGridProps) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const visible = useMemo(() => 
    (tracks || []).slice(0, Math.max(2, maxTiles || 2)),
    [tracks, maxTiles]
  );
  
  const placeholders = Math.max(2, maxTiles || 2) - visible.length;

  const getCols = () => {
    const cols = Math.max(2, maxTiles || 2);
    if (cols <= 2) return 2;
    if (cols <= 3) return 3;
    return Math.min(cols, 4);
  };

  return (
    <div
      className="w-full h-[60vh] gap-2 p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`
      }}
    >
      {visible.map((t, index) => {
        // Use stable key: combination of participant SID + index
        // SID is stable across renders for same participant
        const participantSid = t.participant?.sid || `participant-${index}`;
        const stableKey = `${participantSid}-${index}`;
        
        console.log('[CourtVideoGrid] Rendering tile:', stableKey);
        
        return (
          <div
            key={stableKey}
            className="tc-neon-frame"
          >
            <ParticipantTile trackRef={t} />
          </div>
        );
      })}
      {Array.from({ length: placeholders }).map((_, i) => (
        <div 
          key={`ph-${i}`} 
          className="tc-neon-frame flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-gray-400 text-sm">Waiting for participant…</div>
        </div>
      ))}
    </div>
  );
});

CourtVideoGrid.displayName = 'CourtVideoGrid';
```

### Step 3: Memoize Track Counter
```typescript
const CourtTrackCounter = memo(({ onCount }: { onCount: (count: number) => void }) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const activeCount = useMemo(() => {
    const identities = new Set(
      (tracks || []).map((t) => t.participant?.sid || t.participant?.identity)
    );
    return identities.size;
  }, [tracks]);

  useEffect(() => {
    onCount(activeCount);
  }, [activeCount, onCount]);

  return null;
});

CourtTrackCounter.displayName = 'CourtTrackCounter';
```

### Step 4: Debounce BoxCount Updates
Only update box count if value actually changes:

```typescript
useEffect(() => {
  if (!courtId) return;
  
  let lastBoxCount = boxCount;
  
  const id = window.setInterval(async () => {
    try {
      const { data } = await supabase
        .from('court_sessions')
        .select('max_boxes,status')
        .eq('id', courtId)
        .maybeSingle();

      if (!data) return;
      if (data.status && data.status !== 'active') {
        toast.info('Court session ended');
        navigate('/troll-court');
        return;
      }
      
      if (typeof data.max_boxes === 'number') {
        const newBoxCount = Math.min(6, Math.max(2, data.max_boxes));
        // Only update state if value actually changed
        if (newBoxCount !== lastBoxCount) {
          lastBoxCount = newBoxCount;
          setBoxCount(newBoxCount);
          console.log('[CourtRoom] BoxCount updated:', newBoxCount);
        }
      }
    } catch (err) {
      console.error('Error polling court session:', err);
    }
  }, 5000);

  return () => window.clearInterval(id);
}, [courtId, navigate]);
```

### Step 5: Fix Click Blocking
Add pointer-events handling to overlay elements:

```jsx
{/* Placeholder boxes */}
{Array.from({ length: placeholders }).map((_, i) => (
  <div 
    key={`ph-${i}`} 
    className="tc-neon-frame flex items-center justify-center"
    style={{ pointerEvents: 'none' }}  // Allow clicks to pass through
  >
    <div className="text-gray-400 text-sm">Waiting for participant…</div>
  </div>
))}
```

### Step 6: Add Mount/Unmount Logging
```typescript
useEffect(() => {
  console.log('[CourtRoom] Component mounted with courtId:', courtId);
  return () => {
    console.log('[CourtRoom] Component unmounting');
  };
}, [courtId]);

useEffect(() => {
  const videoGridId = roomIdRef.current;
  console.log('[CourtVideoGrid] Grid component mounted');
  return () => {
    console.log('[CourtVideoGrid] Grid component unmounting - This should NOT happen during session!');
  };
}, []);
```

## Verification Steps

1. **Console Logs**: Open browser DevTools → Console
   - Should see "Room ID stabilized" once at mount
   - Should NOT see "Grid component unmounting" during session
   - Should NOT see repeated "BoxCount updated" messages

2. **Video Panel**: 
   - UUID should not flicker
   - Clicking on video panels should work
   - "Waiting for participant" boxes should not block clicks

3. **Performance**:
   - Monitor CPU/memory - should be stable
   - No excessive re-renders

## Testing Checklist

- [ ] Room enters without UUID flickering
- [ ] Can click on broadcast boxes
- [ ] Participants can join boxes without UI instability
- [ ] BoxCount changes don't cause remounting
- [ ] Console shows mount logs only once
- [ ] No "Grid component unmounting" logs during session
- [ ] Placeholder "Waiting" boxes don't interfere with clicks
