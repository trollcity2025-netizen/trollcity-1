# TrollsTown 3D - Complete Improvement Roadmap

## Phase 1: Critical Bug Fixes ✅ (COMPLETED)
- [x] **WASD Movement** - Fixed keyboard detection with arrow key support + capture phase listeners
- [x] **Coin Balance Sync** - Improved Supabase real-time subscription with error handling
- [x] **Character Stuck in Buildings** - Enhanced collision detection with sliding collision response
- [ ] **Green Ball Spawn** - Remove debug/test objects, verify traffic light sphere positioning

## Phase 2: Gameplay Systems (IN PROGRESS)

### 2.1 Expand Map Size
**Current:** 400x400 units
**Target:** 600x600+ units
**Changes:**
```
- Ground: 800x800
- Roads: Extend to ±300
- Sidewalks: Proportional extension
- Traffic spawns: Wider lane generation
- Building placement: More distributed
```

### 2.2 Location Interactions
- [ ] Each location (`TOWN_LOCATIONS`) must have full interaction flow
- [ ] TrollMart: Buy items, sell items
- [ ] Trollgers: Buy food
- [ ] Gas Station: Refuel (working partially)
- [ ] Church: Service attendance (working)
- [ ] Car Dealership: Buy/sell vehicles
- [ ] Mechanic: Repair vehicles
- [ ] Marketplace: Trade items
- [ ] Auctions: Bid on vehicles/items
- [ ] Coin Store: Buy coins with real money

### 2.3 Property System
**Missing:** Buy/sell houses, own property, upgrades
```
Features needed:
- Property listing UI
- Purchase flow
- Ownership tracking
- Mortgage/payment system
- Property upgrades
- Rental income
- Property taxes
```

### 2.4 Vehicle System
**Missing:** Buy/sell cars from dealership
```
Features needed:
- Dealership inventory sync
- Purchase flow
- Garage management
- Vehicle storage
- Insurance purchase
- Fuel costs tracking
- Repair costs
```

### 2.5 Raid System
**Status:** Partially working
```
Fixes needed:
- Correct loot calculation
- Better difficulty scaling
- Defense stat system
- Insurance protection
```

## Phase 3: Multiplayer Infrastructure

### 3.1 Real-Time Player Sync
**Current:** Players sync every 2 seconds
**Target:** 100ms - 500ms updates
```
Improvements:
- Websocket instead of HTTP polling
- Compress position data
- Client-side prediction
- Smooth interpolation
- Bandwidth optimization
```

### 3.2 Expanded Map for Multiplayer
- Increase render distance
- Implement chunk loading/unloading
- Add more spawn points
- Distribute players better
- Prevent player overlap

### 3.3 Voice Chat
**Status:** Socket.io + SimplePeer setup (needs testing)
```
Fixes needed:
- Proximity-based audio
- Volume control
- Noise suppression
- Fallback for browsers without mic
- Push-to-talk mode
```

### 3.4 Xbox Controller Support
**Status:** Partially implemented
```
Missing:
- Full button remapping
- Vibration feedback
- Analog stick smoothing
- Trigger sensitivity
- Menu navigation
```

## Phase 4: Visual Improvements

### 4.1 Replace Box Models
**Priority 1 - Character:**
- Box avatar → Rigged humanoid model
- Use Mixamo Free Characters
- Animation support for running/walking/driving
- Color customization overlay

**Priority 2 - Vehicles:**
- Box cars → Detailed 3D models
- Use Sketchfab cars or custom models
- Proper wheel animation
- Door open/close animations
- Interior details

### 4.2 Environment Details
- [ ] Add trees (3D models with LOD)
- [ ] Street signs (road markers)
- [ ] Fire hydrants
- [ ] Trash cans (already rendering)
- [ ] Benches (already rendering)
- [ ] Power lines/poles (already rendering)
- [ ] Light posts with proper glow (already rendering)

### 4.3 Building Placement - City Layout
**Current:** Scattered randomly
**Target:** GTA-style city blocks
```
Layout:
- Main street down center (done)
- Side streets perpendicular
- Buildings on edges of streets
- Clear downtown district
- Residential zones
- Commercial zones
```

### 4.4 Post-Processing Effects
- [x] Bloom (enabled)
- [ ] SSAO (Screen Space Ambient Occlusion)
- [ ] Motion Blur (for movement)
- [ ] Chromatic Aberration
- [ ] Depth of Field
- [ ] Film Grain
- [ ] LUT Color Grading

### 4.5 Textures & Materials
- [ ] Better road asphalt
- [ ] Realistic sidewalk concrete
- [ ] Building brick/stone
- [ ] Window reflections
- [ ] Normal maps everywhere
- [ ] Parallax mapping
- [ ] PBR material consistency

## Implementation Timeline

**Day 1 (Tonight):**
- ✅ Phase 1 Bug Fixes
- ⏳ Phase 2.1 Map Expansion
- ⏳ Phase 2.2 Location Interactions (partial)

**Day 2:**
- ⏳ Phase 2.2 Location Interactions (complete)
- ⏳ Phase 2.3 Property System (basic)
- ⏳ Phase 2.4 Vehicle System (basic)

**Day 3-4:**
- ⏳ Phase 3 Multiplayer Infrastructure
- ⏳ Phase 4.1 Replace Box Models (character)

**Day 5-7:**
- ⏳ Phase 4.2-4.5 Visual Polish
- ⏳ Phase 4.1 Replace Box Models (vehicles)

## File Changes Required

### TrollsTown3DPage.tsx
- Expand map constants
- Add location interaction handlers
- Property system integration
- Vehicle system integration
- Enhanced multiplayer sync
- Better collision system
- Asset loaders for Mixamo/Sketchfab models

### New Files Needed
- `PropertySystem.ts` - Handle property transactions
- `VehicleSystem.ts` - Handle car dealership
- `LocationInteractions.ts` - All location-specific logic
- `MultiplayerSync.ts` - Real-time player updates
- `AssetLoader.ts` - Load external 3D models

### API Changes
- Property endpoints (buy, sell, upgrade, list)
- Vehicle endpoints (buy, sell, list inventory)
- Location interaction handlers
- Enhanced multiplayer position sync

## Current Issues Blocking Progress

1. **Asset Loading** - Need Mixamo/Sketchfab integration
2. **Database Schema** - Properties, vehicles might need new tables
3. **Real-time Performance** - 2-second sync too slow for 100+ players
4. **Map Size** - Current 400x400 limits player distribution
5. **Collision System** - Box collisions insufficient for detailed city

## Success Criteria

✅ Game is fully playable (drive everywhere, raid houses, buy/sell)
✅ Multiple users visible in real-time
✅ Voice chat functional
✅ Xbox controller full support
✅ Looks like GTA-inspired city (60-70% visual parity)
✅ 60 FPS on modern hardware
✅ Map large enough for 100+ concurrent players

---

**Start Date:** January 15, 2026
**Target Completion:** January 17-18, 2026
**Developer:** GitHub Copilot
