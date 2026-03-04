# Battle System Update Summary

## Overview
Comprehensive updates to the Troll City battle system including crown/streak mechanics, troll arena background, Three.js animations, and enhanced battle mechanics.

## Files Created/Modified

### 1. Database Migration
**File:** `supabase/migrations/20270304000000_battle_crown_streak_system.sql`

**Features:**
- Added `battle_crowns` column to track total crowns earned
- Added `battle_crown_streak` column for consecutive wins
- Added `last_battle_win_at` timestamp
- Added `total_battle_wins` and `total_battles` counters
- Created `update_battle_crowns_and_streak()` function
- Created `has_crown_streak()` function
- Created `get_crown_display_info()` function
- Created `troll_opponent()` function for 1% coin deduction during sudden death
- Created `handle_battle_guest_leave()` function with auto box adjustment
- Created `battle_events` table for tracking trolls, joins, leaves

### 2. Battle View Component
**File:** `src/components/broadcast/BattleView.tsx`

**Updates:**
- Full-screen battle arena with hidden sidebar
- Back button navigation to home page
- Crown and streak display on broadcaster tiles
- Troll button during sudden death (skull icon, deducts 1% coins)
- 3-minute timer with 10-second sudden death
- Enhanced visual design with gradient borders
- Support for up to 12 boxes (6 per side)
- Instant return to broadcast stream (no reload)
- Winner crown display with streak indicators

### 3. Troll Battle Arena Background
**File:** `src/components/broadcast/TrollBattleArena.tsx`

**Features:**
- Animated troll characters walking and jumping in background
- Three types of trolls: walkers, jumpers, runners
- Dynamic intensity levels (low, medium, high)
- Troll characters in various colors
- Floating particles and arena effects
- Ground texture and ambient lighting
- Fully responsive animation loop

### 4. Three.js Battle Animations
**File:** `src/components/broadcast/BattleThreeAnimations.tsx`

**Animation Types:**
- `timer`: 3D countdown with glowing ring
- `sudden_death`: Lightning bolts and electric aura
- `box_added`: Golden 3D box with sparkles
- `crown_earned`: 3D golden crown animation
- `streak_achieved`: Fire particle effects

**Usage:**
```tsx
<BattleThreeAnimations
  containerRef={containerRef}
  type="sudden_death"
  isActive={isSuddenDeath}
  onComplete={() => console.log('Animation complete')}
/>
```

### 5. Battle Management Hook
**File:** `src/hooks/useBattleManagement.ts`

**Features:**
- Track battle guests in real-time
- Handle guest leave with auto box adjustment
- Allow guest join with box count increase
- Auto-adjust boxes when guests leave
- Supabase realtime subscriptions

### 6. Broadcast Grid
**File:** `src/components/broadcast/BroadcastGrid.tsx`

**Existing Features (Already Supported):**
- Dynamic box count based on occupied seats
- Support for up to 6 boxes per stream
- Auto-fit layout for guest boxes
- Guest leave handling

## Battle Mechanics

### Crown System
- Winner earns 1 crown per battle
- 3 consecutive wins = streak (visual indicator)
- Loser loses 1 crown (minimum 0)
- Streak resets on loss
- Crowns display on profile and battle tiles

### Sudden Death
- Last 10 seconds of battle
- Troll button appears on opponent's tile
- Deducts 1% of opponent's coins
- Added to troller's score
- Visual lightning effects

### Timer
- 3 minutes standard battle time
- 10 seconds sudden death extension
- Visual countdown in center
- Color changes (white → amber → red)

### Guest Box Management
- Up to 5 guests + 1 host = 6 boxes per side
- Total 12 boxes (6 per side)
- Auto-delete boxes when guests leave
- Auto-fit remaining boxes
- Host can manually add boxes
- Dynamic grid layout

### Gift Distribution
- All gifts go to all users and guest boxes
- Non-broadcasters can gift
- Gifts contribute to winner's score
- Real-time score updates

### Return to Stream
- Instant return without page reload
- Media cleanup on exit
- State preservation
- Callback support for custom navigation

## Visual Enhancements

### Arena Design
- Full-screen immersive experience
- Troll characters as background distraction
- Gradient borders for each team
- Crown and streak badges
- Animated timer
- Progress bar for scores

### Three.js Integration
- Hardware-accelerated 3D animations
- WebGL renderer with alpha channel
- Particle systems for effects
- Real-time lighting and shadows
- Smooth 60fps animations

## Usage Example

```tsx
import BattleView from './components/broadcast/BattleView';

function BattlePage() {
  return (
    <BattleView
      battleId="uuid-here"
      currentStreamId="stream-uuid"
      onReturnToStream={() => {
        // Custom return logic
        console.log('Returning to stream');
      }}
    />
  );
}
```

## Database Functions

### Update Crowns After Battle
```sql
SELECT update_battle_crowns_and_streak(
  p_winner_id := 'uuid',
  p_loser_id := 'uuid'
);
```

### Troll Opponent
```sql
SELECT troll_opponent(
  p_battle_id := 'uuid',
  p_troller_id := 'uuid',
  p_target_stream_id := 'uuid'
);
```

### Handle Guest Leave
```sql
SELECT handle_battle_guest_leave(
  p_battle_id := 'uuid',
  p_guest_user_id := 'uuid'
);
```

## Future Enhancements

1. **More Three.js Animations:**
   - Explosion effects for big gifts
   - Weather effects for battle themes
   - 3D avatar integration

2. **Advanced Crown Features:**
   - Crown leaderboards
   - Crown shop for perks
   - Seasonal crown themes

3. **Battle Statistics:**
   - Detailed battle history
   - Win rate tracking
   - Favorite opponents

4. **Social Features:**
   - Battle rematch requests
   - Team battles (2v2, 3v3)
   - Battle tournaments

## Performance Considerations

- Three.js animations use requestAnimationFrame
- Automatic cleanup on unmount
- Particle limits for performance
- Lazy loading for non-critical animations
- Mobile-optimized fallback animations

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (WebGL 2.0)
- Mobile: Optimized touch interactions

## Dependencies

```json
{
  "three": "^0.160.0",
  "@types/three": "^0.160.0",
  "framer-motion": "^11.0.0"
}
```

## Migration Steps

1. Run database migration:
   ```bash
   supabase migration up
   ```

2. Install dependencies:
   ```bash
   npm install three @types/three
   ```

3. Build and deploy:
   ```bash
   npm run build
   ```

## Notes

- All existing battle functionality preserved
- New features are additive only
- Backward compatible with existing battles
- Real-time updates via Supabase subscriptions
- Type-safe with TypeScript