# Entrance Effects System

Production-grade entrance effects system for Troll City with Three.js animations and Web Audio API sound.

## Features

- **Three.js based** - Hardware-accelerated particle effects
- **Web Audio API** - Professional sound mixing with fade in/out
- **Context-aware** - Only renders in supported contexts (broadcast, battle, trollpod)
- **BLOCKED contexts** - Explicitly blocked in Court and TCNN (non-negotiable)
- **Queue system** - Sequential playback with priority-based ordering
- **Rarity-based** - Effects scale in quality with rarity (common to exclusive)
- **Memory safe** - Automatic cleanup, no memory leaks
- **Performance** - Auto-adjusts quality based on FPS

## Quick Start

```tsx
import { EntranceEffectsOverlay } from './entrance-effects';

// In your broadcast component:
function BroadcastPage({ streamId }) {
  return (
    <div className="relative">
      {/* Your broadcast content */}
      
      {/* Entrance effects overlay - only renders in valid contexts */}
      <EntranceEffectsOverlay
        context="broadcast"
        contentId={streamId}
        quality="high"
      />
    </div>
  );
}
```

## Supported Contexts

| Context | Status |
|---------|--------|
| broadcast | ✅ Allowed |
| battle | ✅ Allowed |
| trollpod | ✅ Allowed |
| court | ❌ **BLOCKED** |
| tcnn | ❌ **BLOCKED** |

## Rarity Levels

Effects are configured with increasing quality:

| Rarity | Particles | Sounds | Post-Processing |
|--------|-----------|--------|-----------------|
| Common | 20 | 1 | None |
| Uncommon | 40 | 2 | Bloom |
| Rare | 60 | 2-3 | Bloom + Motion Blur |
| Epic | 100 | 3-4 | Full |
| Legendary | 120+ | 4+ | Full + Chromatic |
| Mythic | 200+ | 5+ | Full + Screen Shake |
| Exclusive | 250+ | 6+ | Everything + Custom |

## Available Effects

### Common
- `soft_glow` - Gentle pink aura
- `shadow_step` - Dark emergence

### Uncommon
- `heart_drift` - Floating hearts
- `bass_thump` - Low frequency pulse

### Rare
- `ember_sparks` - Rising red embers
- `neon_outline` - Cyberpunk frame

### Epic
- `thunder_crack` - Lightning announcement
- `money_shower` - Make it rain

### Legendary
- `diamond_cascade` - Gem rain
- `vip_siren` - Police escort

### Mythic
- `dragon_arrival` - Ancient beast materializes

### Exclusive (CEO/Admin only)
- `troll_city_ceo` - Red/black money rain with stomp
- `admin_divine` - God-tier with void and lightning

## Development

### Debug Panel

In development mode, a debug panel is available for testing effects:

```tsx
import { EntranceEffectsDebugPanel } from './entrance-effects/debug';

function YourComponent() {
  return (
    <>
      <YourContent />
      <EntranceEffectsDebugPanel
        currentContext="broadcast"
        contentId="stream-123"
      />
    </>
  );
}
```

### Trigger Effects Manually

```tsx
import { useTriggerEntrance } from './entrance-effects';

function YourComponent() {
  const { trigger, isTriggering } = useTriggerEntrance('broadcast', streamId);
  
  const handleClick = () => {
    trigger('user-123', 'Username', 'dragon_arrival');
  };
  
  return <button onClick={handleClick}>Trigger Dragon</button>;
}
```

### Using the Hook

```tsx
import { useEntranceEffects } from './entrance-effects';

function BroadcastPage({ streamId }) {
  const { 
    queueUserEntrance, 
    isSupported, 
    activeEffect, 
    queueLength,
    isEffectActive 
  } = useEntranceEffects('broadcast', streamId);
  
  useEffect(() => {
    // Automatically queue when user joins
    const user = {
      id: 'user-123',
      username: 'JohnDoe',
      entranceEffectId: 'thunder_crack',
      joinedAt: Date.now(),
    };
    
    queueUserEntrance(user);
  }, [queueUserEntrance]);
  
  return (
    <div>
      {isEffectActive && <div>Effect playing!</div>}
      <div>Queue: {queueLength}</div>
    </div>
  );
}
```

## Architecture

```
entrance-effects/
├── types/
│   ├── index.ts          # All type definitions
│   └── config.ts         # Effect configurations
├── engine/
│   ├── queue.ts          # Queue management & context validation
│   ├── sound.ts          # Web Audio API engine
│   └── threeEngine.ts    # Three.js rendering
├── components/
│   └── EntranceEffectsOverlay.tsx  # Main overlay
├── hooks/
│   └── useEntranceEffects.ts        # React hook
├── debug/
│   └── DebugPanel.tsx    # Dev tools
└── README.md
```

## Performance Guidelines

1. **Quality auto-adjusts** - Drops scale if FPS drops below target
2. **Max concurrent** - Only 1 effect at a time
3. **Max queue size** - 5 items (new ones dropped if full)
4. **Min gap** - 500ms between effects
5. **Particle limits** - 50 (low) to 500 (ultra) per system

## Memory Management

- All Three.js objects tracked via IDs
- Automatic disposal on effect end
- Cleanup registry for timeouts
- Sound buffers cached but limited
- Emergency clear function available

## Adding New Effects

1. Add to `types/config.ts`:

```typescript
'my_new_effect': {
  id: 'my_new_effect',
  name: 'My Effect',
  rarity: 'epic',
  duration: 3000,
  phaseTimings: { intro: 500, main: 2000, outro: 500 },
  threeConfig: {
    lights: [...],
    particleSystems: [...],
    shakeIntensity: 1,
  },
  sounds: [
    { type: 'intro', src: '/sounds/...', volume: 0.7 },
  ],
  usernameDisplay: {
    position: 'center',
    animation: 'bounce',
    style: 'neon',
  },
  category: 'custom',
  coinCost: 5000,
}
```

2. Add sound files to `/public/sounds/entrance/`

3. Test with debug panel

## Roadmap

- [ ] GPU particle systems for ultra quality
- [ ] Custom shader effects
- [ ] 3D model integration
- [ ] Dynamic lighting shadows
- [ ] VR support
- [ ] Mobile optimization

## License

Troll City Internal - Do not distribute
