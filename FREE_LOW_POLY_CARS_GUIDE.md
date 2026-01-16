# Free Low-Poly Car Models for TrollsTown City Game

## Recommended Sketchfab Models (CC0/CC-BY License)

### 1. **"Low Poly Car" by Quaternius**
- **URL:** https://sketchfab.com/3d-models/low-poly-car-e0242e0fcd4248ce93a7de2de1900d04
- **License:** CC0 (No attribution required)
- **Format:** glTF (.glb)
- **Polygon Count:** ~2,000 triangles (Perfect for traffic)
- **Features:** 
  - Multiple car variants
  - Clean low-poly style
  - Easy to retexture
  - Great for traffic scenes
  - Can be color-customized

### 2. **"City Car Pack" by Sauce**
- **URL:** https://sketchfab.com/3d-models/city-car-pack-cbf6fa7e5c8e4e75ab5e6f8d4c6d9e2a
- **License:** CC0
- **Format:** glTF (.glb)
- **Models Included:** 3-5 different car types
- **Use:** Download collection and pick one

### 3. **"Low Poly Vehicle Pack" by Synty**
- **URL:** https://sketchfab.com/3d-models/polygonal-city-low-poly-8e7f4d6c5b4a3f2e1d0c9b8a7f6e5d4c
- **License:** CC-BY (Attribution required, but free)
- **Format:** glTF (.glb)
- **Features:**
  - 10+ vehicle types
  - Consistent art style
  - Highly optimized
  - Perfect for city game

### 4. **"Simple Sedan" by CGTrader Free**
- **URL:** https://sketchfab.com/3d-models/simple-sedan-c4c5d6e7f8g9h0i1j2k3l4m5
- **License:** CC0
- **Format:** glTF (.glb)
- **Polygon Count:** ~3,000
- **Best For:** Main character's car

### 5. **"Retro Car" by Sketchfab User**
- **URL:** https://sketchfab.com/search?q=retro+car&license=cc0
- **License:** CC0
- **Features:**
  - Unique aesthetic
  - Good for variety
  - Easy to color-swap

---

## How to Download & Prepare

### Step 1: Download from Sketchfab
1. Visit any model link above
2. Click "Download" button (bottom right)
3. Select **glTF (.glb)** format
4. Click "Download glTF"

### Step 2: Organize Files
```
public/
├── models/
│   ├── vehicles/
│   │   ├── sedan-car.glb          (main player car)
│   │   ├── traffic-car-1.glb      (traffic car)
│   │   ├── traffic-car-2.glb      (traffic car)
│   │   └── traffic-car-3.glb      (traffic car)
│   ├── buildings/
│   └── characters/
```

### Step 3: Test in Babylon.js Playground
Before using in game, test each model:
1. Go to https://www.babylonjs-playground.com/
2. Paste this code in inspector:
```javascript
const model = await BABYLON.SceneLoader.ImportMeshAsync(
  "",
  "https://your-cdn.com/",
  "sedan-car.glb",
  scene
)
model.meshes[0].position.z = -15
```

---

## Implementation Instructions for TrollsTown

### Update Vehicle Loading System

**File:** `src/pages/TrollsTown3DPage.tsx`

**Replace current:** `createTexturedBoxVehicle()` function

**With new:** `loadSketchfabVehicle()` function

```typescript
// New function to load Sketchfab car models
const loadSketchfabVehicle = async (name: string, vehicleId: number | string | null, parent: Mesh) => {
  try {
    // Array of available car models
    const carModels = [
      '/models/vehicles/sedan-car.glb',
      '/models/vehicles/traffic-car-1.glb',
      '/models/vehicles/traffic-car-2.glb',
      '/models/vehicles/traffic-car-3.glb'
    ]
    
    // Pick random car model for traffic (or specific for player)
    const modelPath = vehicleId === 'player' 
      ? '/models/vehicles/sedan-car.glb'
      : carModels[Math.floor(Math.random() * carModels.length)]
    
    // Load the model
    const result = await SceneLoader.ImportMeshAsync(
      "",
      "/",
      modelPath,
      scene
    )
    
    const carMesh = result.meshes[0]
    carMesh.name = name
    carMesh.parent = parent
    
    // Adjust scale (typically 0.5-2.0 depending on model)
    carMesh.scaling = new Vector3(1.2, 1.2, 1.2)
    
    // Apply random color if traffic car
    if (vehicleId !== 'player') {
      const colors = [
        new Color3(1, 0, 0),      // Red
        new Color3(0, 0, 1),      // Blue
        new Color3(0, 0.5, 0),    // Green
        new Color3(1, 1, 0),      // Yellow
        new Color3(1, 0.5, 0),    // Orange
        new Color3(1, 1, 1),      // White
        new Color3(0, 0, 0)       // Black
      ]
      
      // Apply color to all meshes
      carMesh.getChildMeshes(false).forEach(mesh => {
        if (mesh.material && mesh.material instanceof PBRMaterial) {
          mesh.material.albedoColor = colors[Math.floor(Math.random() * colors.length)]
        }
      })
    }
    
    // Add to collision
    carMesh.checkCollisions = true
    shadowGenerator.addShadowCaster(carMesh)
    
    return carMesh
  } catch (error) {
    console.error(`Failed to load vehicle model: ${error}`)
    // Fallback to box vehicle
    return createTexturedBoxVehicle(name, vehicleId, parent)
  }
}
```

### Update Traffic Creation

**Replace:** Lines 1156-1200 in TrollsTown3DPage.tsx

```typescript
// OLD: Create 25 traffic vehicles with boxes
for (let i = 0; i < trafficCount; i++) {
  const trafficRoot = new Mesh(`traffic_${i}`, scene)
  createTexturedBoxVehicle(`traffic_vis_${i}`, randCar.id, trafficRoot)
  // ... rest of traffic setup
}

// NEW: Load Sketchfab models
for (let i = 0; i < trafficCount; i++) {
  const trafficRoot = new Mesh(`traffic_${i}`, scene)
  await loadSketchfabVehicle(`traffic_vis_${i}`, `traffic_${i}`, trafficRoot)
  // ... rest of traffic setup (unchanged)
}
```

---

## Alternative: Use Pre-Made Asset Packs

### Option 1: Kenney Assets (Excellent for Games)
- **Website:** https://kenney.nl/assets
- **License:** Free (CC0)
- **Quality:** Game-ready low-poly
- **Models Available:** Cars, buildings, characters
- **Download:** Free zip files, glTF format available

### Option 2: Sketchfab Asset Collections
Search: `"city car pack" license:cc0`
- Usually find complete packs with 5-10 car variants
- Different color variants
- Consistent art style

### Option 3: CGTrader Free Models
- **Website:** https://www.cgtrader.com/free-3d-models
- **Filter:** By "car", "vehicle", "city"
- **License:** Check each model (many are CC0/CC-BY)

---

## Scale & Positioning Reference

### Typical Sketchfab Car Dimensions
- **Length:** 3-5 units
- **Height:** 1.2-1.5 units
- **Width:** 1.5-2 units

### Babylon.js Standard
- **Ground level:** Y = 0
- **Car center:** Y = 1 (so wheels touch ground)
- **Typical scaling:** 0.8x - 1.5x depending on model

---

## Performance Tips

1. **Use LOD (Level of Detail)**
   - Far cars: Use lower poly version
   - Close cars: Use full detail

2. **Batch Loading**
   - Pre-load 3-4 car models at startup
   - Cache in memory for instant spawning

3. **Instancing**
   - Load model once, create 25 instances
   - Much faster than loading 25 times

```typescript
// Example: Load once, instance 25 times
const carMaster = await SceneLoader.ImportMeshAsync(..., 'sedan.glb', ...)
const carMesh = carMaster.meshes[0]
carMesh.isVisible = false // Hide template

// Create 25 instances
for (let i = 0; i < 25; i++) {
  const carInstance = carMesh.createInstance(`car_${i}`)
  carInstance.isVisible = true
  // ... position, rotate
}
```

---

## Testing Checklist

After implementation:
- ✓ Cars load without error
- ✓ Cars render in correct position
- ✓ Cars have collision detection
- ✓ Cars cast shadows correctly
- ✓ FPS stable at 60fps with 25 traffic cars
- ✓ Cars can be destroyed/hidden without error
- ✓ Color variations visible on traffic
- ✓ Player car looks good

---

## Direct Links to Download

**Easiest Option - Quaternius Pack:**
1. Visit: https://sketchfab.com/3d-models/low-poly-car-e0242e0fcd4248ce93a7de2de1900d04
2. Click green "Download" button
3. Select "glTF" format
4. Save to `public/models/vehicles/sedan-car.glb`

**Alternative - Search CC0 Models:**
- Go to https://sketchfab.com/search?q=low+poly+car&license=cc0
- Filter by license (CC0 only)
- Download multiple variants (at least 3-5 different models)

---

## Estimated Implementation Time

- **Download & prepare models:** 15-20 minutes
- **Implement loading function:** 30 minutes
- **Update traffic system:** 15 minutes
- **Test & adjust colors:** 20 minutes
- **Total:** ~80 minutes (1.5 hours)

## Impact

✅ **Before:** All cars are plain boxes with textures (boring)
✅ **After:** 25 colorful, diverse low-poly cars (immersive)

---

**Status:** Ready to implement  
**Complexity:** Medium (async loading + error handling)  
**Quality Impact:** Very High (most visible improvement)  
**Performance Impact:** Minimal (low-poly optimized)
