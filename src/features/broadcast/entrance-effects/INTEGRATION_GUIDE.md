# Entrance Effects Integration Guide

## Overview

This guide explains how to integrate the production-grade entrance effects system into Broadcast, Battle, and TrollPod layouts.

## Installation

The entrance effects system is located at:
```
src/features/broadcast/entrance-effects/
```

No additional dependencies required - uses existing Three.js and Framer Motion.

## Step-by-Step Integration

### 1. Broadcast Integration

**File:** `src/components/broadcast/BroadcastLayout.tsx` (or similar)

```tsx
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';
// Add in development only:
import { EntranceEffectsDebugPanel } from '../../features/broadcast/entrance-effects/debug';

function BroadcastLayout({ streamId, ...props }) {
  return (
    <div className="relative w-full h-full">
      {/* Existing broadcast content */}
      <VideoPlayer streamId={streamId} />
      <ChatComponent streamId={streamId} />
      
      {/* Add entrance effects overlay */}
      <EntranceEffectsOverlay
        context="broadcast"
        contentId={streamId}
        quality="high"
      />
      
      {/* Development only - debug panel */}
      {process.env.NODE_ENV === 'development' && (
        <EntranceEffectsDebugPanel
          currentContext="broadcast"
          contentId={streamId}
        />
      )}
    </div>
  );
}
```

### 2. Battle Integration

**File:** `src/components/battle/BattleLayout.tsx` (or similar)

```tsx
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';

function BattleLayout({ battleId, ...props }) {
  return (
    <div className="relative w-full h-full">
      {/* Battle components */}
      <BattleVideoFeed battleId={battleId} />
      <BattleScoreboard battleId={battleId} />
      
      {/* Entrance effects */}
      <EntranceEffectsOverlay
        context="battle"
        contentId={battleId}
        quality="high"
      />
    </div>
  );
}
```

### 3. TrollPod Integration

**File:** `src/components/trollpod/TrollPodLayout.tsx` (or similar)

```tsx
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';

function TrollPodLayout({ podId, ...props }) {
  return (
    <div className="relative w-full h-full">
      {/* TrollPod components */}
      <TrollPodVideo podId={podId} />
      <TrollPodChat podId={podId} />
      
      {/* Entrance effects */}
      <EntranceEffectsOverlay
        context="trollpod"
        contentId={podId}
        quality="high"
      />
    </div>
  );
}
```

### 4. Court Integration (BLOCKED)

**IMPORTANT:** Entrance effects are **EXPLICITLY BLOCKED** in Court context.

```tsx
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';

function CourtroomLayout({ sessionId, ...props }) {
  return (
    <div className="relative w-full h-full">
      {/* Court components */}
      <CourtVideo sessionId={sessionId} />
      <CourtChat sessionId={sessionId} />
      
      {/* This will return null - effects blocked in court */}
      <EntranceEffectsOverlay
        context="court"  // BLOCKED - no effects will render
        contentId={sessionId}
      />
    </div>
  );
}
```

The overlay will:
1. Validate the context
2. Detect "court" is blocked
3. Return `null` (no rendering)
4. Log to console: "[EntranceOverlay] BLOCKED in court context"

### 5. TCNN Integration (BLOCKED)

**IMPORTANT:** Entrance effects are **EXPLICITLY BLOCKED** in TCNN context.

```tsx
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';

function TCNNLayout({ broadcastId, ...props }) {
  return (
    <div className="relative w-full h-full">
      {/* TCNN components */}
      <TCNNVideo broadcastId={broadcastId} />
      
      {/* This will return null - effects blocked in tcnn */}
      <EntranceEffectsOverlay
        context="tcnn"  // BLOCKED - no effects will render
        contentId={broadcastId}
      />
    </div>
  );
}
```

## Using the Hook (Advanced)

For more control, use the `useEntranceEffects` hook:

```tsx
import { useEntranceEffects, useTriggerEntrance } from '../../features/broadcast/entrance-effects';

function CustomBroadcastComponent({ streamId }) {
  const { 
    queueUserEntrance,  // Manually queue a user
    isSupported,        // Check if context is valid
    activeEffect,       // Currently playing effect
    queueLength,        // Number of queued effects
    isEffectActive,     // Boolean if any effect playing
    error               // Any error message
  } = useEntranceEffects('broadcast', streamId);
  
  const { trigger, isTriggering } = useTriggerEntrance('broadcast', streamId);
  
  // Example: Manually trigger effect
  const handleButtonClick = () => {
    trigger('user-123', 'TestUser', 'dragon_arrival');
  };
  
  return (
    <div>
      {isEffectActive && <div className="banner">Entrance Effect Playing!</div>}
      <button onClick={handleButtonClick} disabled={isTriggering}>
        Trigger Effect
      </button>
      <div>Queue Length: {queueLength}</div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

## Configuration Options

### Quality Presets

```tsx
<EntranceEffectsOverlay
  context="broadcast"
  contentId={streamId}
  quality="ultra"  // Options: low, medium, high, ultra
/>
```

| Quality | Particles | Post-Processing | FPS Target |
|---------|-----------|-----------------|------------|
| low     | 50        | Off             | 30         |
| medium  | 150       | Bloom only      | 45         |
| high    | 300       | Full            | 60         |
| ultra   | 500       | Full + Extra    | 60         |

### Muted Mode

```tsx
<EntranceEffectsOverlay
  context="broadcast"
  contentId={streamId}
  muted={true}  // Start with sound off
/>
```

## Testing with Debug Panel

In development mode, a floating debug panel appears at the bottom-right:

1. **Context Testing** - Switch between contexts to see blocking behavior
2. **Effect Triggers** - Manually trigger any effect
3. **Metrics** - View FPS, queue length, memory usage
4. **Audio Controls** - Adjust volume and mute

## Common Patterns

### Pattern 1: Auto-detect user joins

```tsx
function BroadcastPage({ streamId }) {
  const { queueUserEntrance, isSupported } = useEntranceEffects('broadcast', streamId);
  
  useEffect(() => {
    if (!isSupported) return;
    
    // Subscribe to presence
    const channel = supabase.channel(`room:${streamId}`);
    
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const user = newPresences[0];
      if (user.entrance_effect) {
        queueUserEntrance({
          id: user.user_id,
          username: user.username,
          entranceEffectId: user.entrance_effect,
          joinedAt: Date.now(),
        });
      }
    }).subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [isSupported, streamId, queueUserEntrance]);
  
  return (
    <div>
      <EntranceEffectsOverlay context="broadcast" contentId={streamId} />
    </div>
  );
}
```

### Pattern 2: Gift purchase trigger

```tsx
function GiftShop({ streamId }) {
  const { trigger } = useTriggerEntrance('broadcast', streamId);
  
  const handlePurchase = async (effectId: string) => {
    // Purchase logic...
    
    // Preview the effect immediately
    await trigger(currentUser.id, currentUser.username, effectId);
  };
  
  return <EffectCatalog onPurchase={handlePurchase} />;
}
```

### Pattern 3: Staff command

```tsx
function AdminPanel({ streamId }) {
  const { trigger } = useTriggerEntrance('broadcast', streamId);
  
  const grantEffect = async (userId: string, effectId: string) => {
    await trigger(userId, 'StaffGrant', effectId);
  };
  
  return (
    <div>
      <button onClick={() => grantEffect('user-123', 'admin_divine')}>
        Grant Divine Effect
      </button>
    </div>
  );
}
```

## Troubleshooting

### Effects not showing

1. Check context: Must be 'broadcast', 'battle', or 'trollpod'
2. Check contentId: Must be valid and unique
3. Check dev tools: Console should show "[EntranceOverlay] INITIALIZED"
4. Check debug panel: Verify queue state

### Sound not playing

1. User interaction required first (click somewhere)
2. Check mute state in debug panel
3. Verify sound files exist in `/public/sounds/entrance/`
4. Check browser autoplay policies

### Performance issues

1. Lower quality preset: `quality="medium"` or `quality="low"`
2. Check FPS in debug panel
3. Reduce concurrent effects (system limits to 1)
4. Clear queue if stuck: Debug panel "Cancel All"

### Memory leaks

System has built-in safeguards:
- Automatic cleanup on effect completion
- Three.js object disposal
- Sound buffer management
- Emergency clear: `clearAllEffects()`

## Migration from Old System

If you're replacing the old `BroadcastEffectsLayer`:

```tsx
// OLD (remove this)
import BroadcastEffectsLayer from './BroadcastEffectsLayer';

// NEW (use this)
import { EntranceEffectsOverlay } from '../../features/broadcast/entrance-effects';

// Replace:
<BroadcastEffectsLayer streamId={streamId} />

// With:
<EntranceEffectsOverlay context="broadcast" contentId={streamId} />
```

## Support

For issues or questions:
1. Check debug panel metrics
2. Review console logs
3. Verify context isn't blocked
4. Test with manual trigger in debug panel
