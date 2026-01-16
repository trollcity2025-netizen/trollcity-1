# Sketchfab Integration Guide for TrollsTown

## Overview
Sketchfab has thousands of free 3D models that can be integrated into Babylon.js. This document outlines how to replace the current box models (buildings, cars, roads, NPCs) with realistic Sketchfab models.

## Current Box Models in TrollsTown

### 1. **Buildings** (Various Locations)
- Current: Procedural boxes for each building type
- Files: `TrollsTown3DPage.tsx` lines 1750-2200
- Types: Church, Gas Station, Dealership, Marketplace, etc.

### 2. **Vehicles/Cars**
- Current: Box-based vehicle with texture planes
- Files: `TrollsTown3DPage.tsx` lines 899-980
- Issue: Using `createTexturedBoxVehicle` function

### 3. **Avatar/Player Character**
- Current: Box-based humanoid with colored shirt/pants
- Files: `TrollsTown3DPage.tsx` lines 1700-1800
- Issue: Not a realistic human model

### 4. **Roads/Streets**
- Current: Procedural boxes and planes for roads
- Files: `TrollsTown3DPage.tsx` lines 645-720
- Issue: Roads are flat boxes without detail

## Recommended Sketchfab Models

### Free Models with CC0/CC-BY License
(These can be used without attribution but attribution is appreciated)

#### Building Models
1. **Modern Office Building**
   - Creator: Many creators
   - Search: "city building" OR "office building"
   - License: CC0 preferred
   - Format: glTF/GLB

2. **Gas Station**
   - Creator: Various
   - Search: "gas station" OR "petrol station"
   - License: CC0/CC-BY
   
3. **Car Dealership**
   - Creator: Various
   - Search: "car showroom" OR "dealership"
   - License: CC0/CC-BY

#### Vehicle Models
1. **Sedan Car**
   - Creator: Many
   - Search: "car" OR "sedan" OR "vehicle"
   - License: CC0
   - Note: Find one with multiple color variants

2. **Sports Car**
   - Creator: Various
   - Search: "sports car" OR "racing car"
   - License: CC0/CC-BY

#### Character Models
1. **Humanoid Character**
   - Creator: Many (Sketchfab has excellent character models)
   - Search: "humanoid character" OR "rigged character"
   - License: CC0/CC-BY
   - Note: Rigged models best for animation

## Integration Steps

### Step 1: Download Models from Sketchfab
1. Visit https://sketchfab.com/
2. Search for desired model (e.g., "car", "building")
3. Filter by License: "CC0" or "CC-BY"
4. Download as glTF (.glb) format
5. Convert if needed using Babylon.js Sandbox

### Step 2: Host Models
Two options:

**Option A: Local Hosting (Recommended for Development)**
- Place downloaded .glb files in `public/models/` directory
- Example: `public/models/sedan-car.glb`
- Reference in code: `/models/sedan-car.glb`

**Option B: CDN Hosting**
- Upload to https://www.babylonjs-playground.com/
- Get CDN link
- Reference in code: Direct CDN URL

### Step 3: Load Models in Babylon.js

```typescript
// Import SceneLoader if not already imported
import { SceneLoader } from '@babylonjs/core'

// Load single model
const model = await SceneLoader.ImportMeshAsync(
  "",
  "/models/",
  "sedan-car.glb",
  scene
)

// Access meshes
const carMesh = model.meshes[0]
carMesh.position = new Vector3(0, 0, 0)
carMesh.scaling = new Vector3(2, 2, 2)
```

### Step 4: Replace Box Models with Sketchfab Models

**For Vehicles:**
```typescript
// OLD CODE:
const createTexturedBoxVehicle = (name, vehicleId, parent) => {
  const body = MeshBuilder.CreateBox(...)
  // ... build with boxes
}

// NEW CODE:
const createSketchfabVehicle = async (name, vehicleId, parent) => {
  const model = await SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    "sedan-car.glb",
    scene
  )
  const root = model.meshes[0]
  root.parent = parent
  root.scaling = new Vector3(0.5, 0.5, 0.5)
  return root
}
```

**For Buildings:**
```typescript
// OLD CODE:
const mainHall = MeshBuilder.CreateBox(`${loc.id}_main`, {...}, scene)
const steeple = MeshBuilder.CreateCylinder(...)

// NEW CODE:
const loadBuildingModel = async (buildingType) => {
  const modelFile = `${buildingType}-building.glb`
  const model = await SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    modelFile,
    scene
  )
  return model.meshes[0]
}
```

**For Avatar:**
```typescript
// OLD CODE:
const createMidPolyCharacter = (parent, appearance) => {
  const torso = MeshBuilder.CreateBox('torso', {...}, scene)
  // ... build with boxes

// NEW CODE:
const loadCharacterModel = async (appearance) => {
  const model = await SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    "humanoid-character.glb",
    scene
  )
  const avatar = model.meshes[0]
  // Apply appearance colors/materials
  avatar.parent = parent
  return avatar
}
```

## Performance Considerations

### LOD (Level of Detail)
- Sketchfab models may have high polygon counts
- Create simpler versions for distant objects
- Use Babylon.js LOD system

### Instancing
- For repeated models (trees, street lights), use instancing
- Current traffic cars: Use model instancing instead of loading 25x

### Optimization
```typescript
// Disable unnecessary features for distant models
carMesh.receiveShadows = false
carMesh.castShadow = false

// Set shadow casters only for nearby objects
if (distance < 50) {
  shadowGenerator.addShadowCaster(carMesh)
}
```

## Licensing & Attribution

### Required Attributions (for CC-BY)
- Creator name must be visible or in-game credits
- Link to Sketchfab profile appreciated
- License text in footer

### CC0 (No Attribution Required)
- Can use without attribution
- But attribution still appreciated

## Implementation Priority

1. **Phase 1 (High Impact):** 
   - Replace vehicle models (used 25+ times)
   - Single good car model impacts entire game

2. **Phase 2 (Medium Impact):**
   - Replace building models
   - Each location has 1-3 buildings

3. **Phase 3 (Polish):**
   - Replace avatar with humanoid
   - Add trees and environmental props

4. **Phase 4 (Advanced):**
   - Add road markings/details
   - Animated characters (pedestrians, workers)

## Recommended Specific Models

### Immediate (Ready to Download)
1. **Sedan Car** - Search "low poly car" on Sketchfab
2. **City Building** - Search "office building low poly"
3. **Gas Station** - Search "gas station architecture"
4. **Humanoid Character** - Search "free rigged character"

### Sources
- https://sketchfab.com/search?q=car&license=cc0
- https://sketchfab.com/search?q=building&license=cc0
- https://sketchfab.com/search?q=character&license=cc0

## Testing

After replacing first model:
```typescript
// In console:
1. Check if model loads
2. Verify collision detection still works
3. Check performance (FPS stable at 60?)
4. Test model rotation/scaling
5. Verify shadows render correctly
```

## Next Steps

1. Choose 3 models to download (car, building, character)
2. Download as .glb format
3. Test loading in Babylon.js Playground first
4. Implement one vehicle first (smallest scope)
5. Expand to buildings and characters

## Notes

- **Async Loading:** Model loading is async - need to handle promises properly
- **Materials:** Sketchfab models may have own materials - test appearance colors
- **Rigging:** Character models may be rigged - test with animations
- **Scale:** All models will need scale adjustments (different creators, different scales)
- **Collision:** Babylon.js can auto-generate collision from mesh geometry

## Code Locations to Modify

1. `src/pages/TrollsTown3DPage.tsx` - Main game file
   - Line 899: `createTexturedBoxVehicle` → Replace with `loadVehicleModel`
   - Line 1750: Church building generation → Replace with model loading
   - Line 1700: Character creation → Replace with humanoid model loading

2. Create `src/utils/ModelLoader.ts` - New utility file
   - Centralize all model loading logic
   - Handle async operations
   - Cache loaded models

3. `public/models/` - New directory
   - Store all downloaded .glb files
   - Organize by type: vehicles/, buildings/, characters/

---

**Status:** Plan created, ready for implementation  
**Complexity:** Medium (async operations, scale/rotation tuning)  
**Time Estimate:** 6-8 hours for full implementation
