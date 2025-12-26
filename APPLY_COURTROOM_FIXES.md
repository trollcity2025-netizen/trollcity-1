# How to Apply Troll Court UUID Flicker Fixes

## Quick Fix (Minimal Changes)

### Change 1: Import memo and useRef
**File**: `src/pages/CourtRoom.tsx`  
**Line 1**: Replace:
```typescript
import React, { useEffect, useState, useMemo } from "react";
```
With:
```typescript
import React, { useEffect, useState, useMemo, memo, useRef } from "react";
```

---

### Change 2: Extract Video Grid Component (Before the `export default function CourtRoom()`)
**File**: `src/pages/CourtRoom.tsx`  
**Location**: After line 14 (after imports), before line 16 (before `export default function CourtRoom()`)  

**ADD THIS CODE**:
```typescript
// Memoized Court Video Grid - Prevents remounting
const CourtVideoGrid = memo(({ maxTiles }: { maxTiles: number }) => {
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
        const participantSid = t.participant?.sid || `participant-${index}`;
        const stableKey = `${participantSid}-${index}`;
        
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

// Memoized Track Counter
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

---

### Change 3: Remove Duplicate Component Functions Inside CourtRoom
**File**: `src/pages/CourtRoom.tsx`  
**Lines 317-376**: DELETE the old `CourtVideoGrid` and `CourtTrackCounter` function definitions that are currently INSIDE the CourtRoom component.

**Find and DELETE**:
```typescript
  const CourtVideoGrid = ({ maxTiles }) => {
    // ... entire function ...
  };

  const CourtTrackCounter = ({ onCount }) => {
    // ... entire function ...
  };
```

---

### Change 4: Add Room ID Stabilization  
**File**: `src/pages/CourtRoom.tsx`  
**Location**: Inside CourtRoom function, after state declarations (around line 28-29)  

**ADD THIS CODE**:
```typescript
  // Stabilize room ID once at mount
  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (courtId && !roomIdRef.current) {
      roomIdRef.current = courtId;
      console.log('[CourtRoom] Room ID stabilized:', courtId);
    }
  }, [courtId]);
  const roomId = roomIdRef.current || courtId;
```

---

### Change 5: Debounce BoxCount Updates
**File**: `src/pages/CourtRoom.tsx`  
**Lines 96-117** (the `useEffect` that polls court_sessions):

**REPLACE**:
```typescript
  useEffect(() => {
    if (!courtId) return;
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
        if (typeof data.max_boxes === 'number') setBoxCount(Math.min(6, Math.max(2, data.max_boxes)));
      } catch {}
    }, 5000);

    return () => window.clearInterval(id);
  }, [courtId]);
```

**WITH**:
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
          if (newBoxCount !== lastBoxCount) {
            lastBoxCount = newBoxCount;
            setBoxCount(newBoxCount);
            console.log('[CourtRoom] BoxCount updated:', newBoxCount);
          }
        }
      } catch (err) {
        console.error('Court session polling error:', err);
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, [courtId, navigate]);
```

---

### Change 6: Add Mount/Unmount Logging
**File**: `src/pages/CourtRoom.tsx`  
**Location**: After the boxCount polling useEffect, add:

```typescript
  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);
```

---

## Verification After Applying Fixes

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Navigate to Troll Court**
4. **Look for these logs**:
   - `[CourtRoom] Room ID stabilized: <uuid>`
   - `[CourtRoom] Component mounted with courtId: <uuid>`
   - BoxCount updates should be infrequent

5. **Should NOT see**:
   - Repeated `[CourtVideoGrid]` mount/unmount logs
   - Continuous re-renders

6. **Test**:
   - UUID should NOT flicker in video boxes
   - Click on broadcast boxes should work
   - Placeholder text "Waiting for participant..." should not block clicks

---

## If Edits Fail

If the file is too large to edit in your editor:
1. Download the patched version from this repo
2. Or use a command-line tool: `patch < COURTROOM_FIXES.patch`

---

## What These Changes Fix

✅ **UUID Flickering**: Memoized components prevent remounting  
✅ **Click Blocking**: `pointerEvents: 'none'` on overlays  
✅ **Unnecessary Re-renders**: Debounced state updates  
✅ **Component Stability**: Stable keys using participant SID  
✅ **Debugging**: Console logs show component lifecycle

---

## Files Modified

- `src/pages/CourtRoom.tsx` - 6 changes total

---

## Rollback

If something breaks, just undo the changes by reverting the file to git:
```bash
git checkout src/pages/CourtRoom.tsx
```
