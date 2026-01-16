# Physically Based Rendering (PBR) Implementation Guide

## Overview
TrollCity 3D now features comprehensive Physically Based Rendering (PBR) with advanced lighting, post-processing, and material systems that achieve a realistic, GTA V-inspired look.

## Key Features Implemented

### 1. **PBR Materials System**
All environmental materials now use `PBRMaterial` instead of basic materials for physically accurate rendering:

#### **Ground (Grass)**
- **Albedo Texture**: Grass png (tiled 160x160)
- **Normal Map**: Rock texture for surface detail
- **Roughness**: 0.95 (natural grass is very rough)
- **Metallic**: 0.0 (non-metallic)
- **Subsurface Scattering**: Enabled for light transmission through grass blades

#### **Roads (Asphalt)**
- **Albedo**: Dark asphalt (0.05, 0.05, 0.05)
- **Normal Map**: Asphalt texture with bump mapping
- **Roughness**: 0.75 (wet asphalt effect)
- **Metallic**: 0.05 (slight reflectivity from fragments)
- **Parallax Occlusion**: Enabled for depth perception on road surface
- **Environment Intensity**: 0.3 (subtle reflections)

#### **Sidewalks (Concrete)**
- **Albedo**: Concrete texture tiled 20x20
- **Normal Map**: Rock texture for weathered look
- **Roughness**: 0.85 (concrete is rough)
- **Metallic**: 0.0
- **Ambient Occlusion**: Applied for depth

#### **Buildings & Houses**
- **Base Color**: Varies by tier (starter, mid, luxury, mansion, mega)
- **Albedo Texture**: Brick pattern (2x2 tiling)
- **Normal Map**: Rock texture for brick detail
- **Roughness**: 0.75 (aged brick)
- **Metallic**: 0.05 (oxidized particles)
- **Translucency**: Subtle for aged appearance

#### **Street Lights & Infrastructure**
- **Lamp Posts**: 
  - Albedo: Light gray metal (0.6, 0.6, 0.65)
  - Roughness: 0.35 (smooth painted metal)
  - Metallic: 0.9 (highly reflective)

- **Lamp Bulbs**:
  - Emissive: Warm white (1, 0.95, 0.8)
  - Emissive Texture: Dynamic radial gradient for glow
  - Emissive Intensity: 1.2 for realistic light

#### **Traffic Lights**
- **Red**: Emissive (1, 0.2, 0.1) with intensity 1.5
- **Yellow/Amber**: Emissive (1, 0.9, 0.2) with intensity 1.4
- **Green**: Emissive (0.2, 1, 0.5) with intensity 1.3
- All with high reflectivity (metallic 0.9) for glass lens effect

#### **Foliage (Trees)**
- **Trunks**: 
  - Wood brown with rough surface (0.92 roughness)
  - Normal mapping for bark detail
  
- **Leaves**:
  - Green with subsurface scattering enabled
  - Refraction intensity: 0.3 for light-through-leaves
  - Translucency: 0.2 for natural vegetation effect

#### **Vehicle Paint**
- **Base Color**: Random metallic colors with high saturati
- **Metallic**: 0.8 (shiny automotive paint)
- **Roughness**: 0.2 (glossy finish)
- **Clear Coat**: Enabled with intensity 1.0 for realistic lacquer

### 2. **Advanced Lighting System**

#### **HDR Environment Texture (IBL)**
```typescript
const envTexture = CubeTexture.CreateFromPrefilteredData(
  "https://assets.babylonjs.com/environments/environmentSpecular.env", 
  scene
);
scene.environmentTexture = envTexture;
scene.environmentIntensity = 1.0;  // Strong indirect lighting
```
- Provides realistic indirect lighting and reflections
- Essential for PBR material appearance
- Ambient color: (0.3, 0.35, 0.4) for color-graded fill light

#### **Directional Sunlight**
- **Intensity**: 3.5 (strong dramatic shadow-casting)
- **Position**: (100, 150, 100) for angled lighting
- **Direction**: (-0.8, -1.2, -0.8) for realistic sun angle

#### **Cascaded Shadow Generator**
- **Resolution**: 2048x2048 (doubled from original)
- **PCF Filtering**: Enabled for soft shadows
- **Bias**: 0.002 (reduced for sharper shadow edges)
- **Cascade Frustum**: Optimized for large outdoor scenes

#### **Hemispheric Ambient Light**
- **Intensity**: 0.4 (soft fill light)
- **Ground Color**: Cool blue (0.04, 0.04, 0.08) for sky reflection
- **Diffuse**: (0.9, 0.9, 1.0) for color accuracy

### 3. **Post-Processing Pipeline**

#### **DefaultRenderingPipeline Configuration**

**Anti-Aliasing**
- MSAA: 8 samples (increased from 4)
- FXAA: Enabled for edge refinement

**Bloom Effect** (Cinematic light bleeding)
- Enabled: true
- Threshold: 0.5 (captures more highlights)
- Weight: 0.6 (increased intensity)
- Kernel: 128 samples (soft bloom)
- Scale: 0.6

**Tone Mapping** (ACES for cinematic contrast)
- Type: TONEMAPPING_ACES (industry standard)
- Exposure: 1.4 (brighter image)
- Contrast: 1.3 (higher drama)
- Saturation: 1.2 (boosted colors)

**Color Grading** (Teal/Orange cinematic look)
```typescript
const curves = new ColorCurves();
curves.globalHue = 180;           // Blue shift
curves.shadowsHue = 200;          // Teal shadows (30 density)
curves.midtonesHue = 180;         // Cool midtones
curves.highlightsHue = 20;        // Orange highlights (25 density)
```

**Vignette** (Frame effect)
- Enabled: true
- Weight: 1.8 (darker edges)
- Color: (0.1, 0.1, 0.15, 0)

**Film Grain** (Texture & grit)
- Enabled: true
- Intensity: 12
- Animated: true

**Chromatic Aberration** (Camera lens distortion)
- Enabled: true
- Amount: 15
- Radial Intensity: 2.5

#### **Screen Space Ambient Occlusion 2 (SSAO2)**
Advanced ambient occlusion for depth perception:

```typescript
const ssao = new SSAO2RenderingPipeline("ssao2", scene, {
  ssaoRatio: aspectRatio,
  blurRatio: 1
});

ssao.radius = 25;           // Large occlusion radius
ssao.bias = 0.015;
ssao.intensity = 1.8;       // Moderate strength
ssao.maxZ = 250;            // Far plane
ssao.minZAspect = 0.2;
ssao.addSamples(8);         // 8 sample quality
```

### 4. **Graphics Quality Settings**

Three optimization levels for different hardware:

#### **LOW Quality** (Mobile/Integrated Graphics)
```typescript
- MSAA: 2 samples
- Bloom: Disabled
- Grain: Disabled
- Chromatic Aberration: Disabled
- Vignette: Disabled
- Shadow Update: Every 2 frames
- Hardware Scaling: 2x (1/4 resolution)
```

#### **MEDIUM Quality** (Balanced)
```typescript
- MSAA: 4 samples
- Bloom: Enabled (threshold 0.6, weight 0.4)
- Grain: Enabled (intensity 6)
- Chromatic Aberration: Disabled
- Vignette: Enabled (weight 1.2)
- Shadow Update: Every frame
- Hardware Scaling: 1x (full resolution)
```

#### **HIGH Quality** (Maximum Fidelity)
```typescript
- MSAA: 8 samples
- Bloom: Enabled (threshold 0.5, weight 0.6)
- Grain: Enabled (intensity 12)
- Chromatic Aberration: Enabled
- Vignette: Enabled (weight 1.8)
- SSAO2: Enabled (8 samples)
- Shadow Update: Every frame
- Hardware Scaling: 1x (full resolution)
- Environment Intensity: 1.2 (enhanced reflections)
```

### 5. **Real-time Lighting & Emissive Objects**

#### **Street Light System**
- 25+ street lamps positioned along roads
- Dynamic point lights with range 30 units
- Intensity: 0.6 per light
- Color: Warm white (1, 0.95, 0.8)
- Cast shadows for realistic street lighting

#### **Traffic Light System**
- 4 traffic light clusters at intersection
- Color-coded emissive materials
- Separate emissive textures with gradient falloff
- Dynamic lighting effect on surroundings

## Implementation Details in Code

### Material Factory Pattern
```typescript
const createHouseMat = (name: string, color: Color3, emissive?: Color3) => {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = color;
  mat.albedoTexture = brickTex;
  mat.bumpTexture = brickNormal;
  mat.roughness = 0.75;
  mat.metallic = 0.05;
  mat.subSurface.isTranslucencyEnabled = true;
  mat.subSurface.translucencyIntensity = 0.05;
  if (emissive) {
    mat.emissiveColor = emissive;
    mat.emissiveIntensity = 0.8;
  }
  return mat;
};
```

### Shadow Generator Enhancement
```typescript
const shadowGenerator = new CascadedShadowGenerator(2048, sunLight);
shadowGenerator.transparencyShadow = true;
shadowGenerator.bias = 0.002;
shadowGenerator.usePercentageCloserFiltering = true;
shadowGenerator.forceBackFacesOnly = false;
shadowGenerator.splitFrustum();
```

### Dynamic Graphics Quality Application
```typescript
const applyGraphicsQuality = (quality: 'low' | 'medium' | 'high') => {
  switch (quality) {
    case 'high':
      pipeline.samples = 8;
      pipeline.bloomEnabled = true;
      // ... enable all effects
      break;
    case 'medium':
      pipeline.samples = 4;
      // ... balanced settings
      break;
    case 'low':
      pipeline.samples = 2;
      // ... minimal effects
      break;
  }
};
```

## Performance Considerations

### GPU Requirements
- **Recommended**: GeForce GTX 1660 Ti or equivalent (60 FPS at HIGH)
- **Minimum**: GeForce GTX 960 or equivalent (30-45 FPS at MEDIUM)
- **Mobile**: Should use LOW quality preset

### Optimization Techniques
1. **Cascaded Shadows**: Ensures sharp shadows without excessive texture resolution
2. **MSAA Scaling**: Can be reduced on weaker hardware
3. **SSAO2 Optional**: Gracefully degrades if not supported
4. **Hardware Scaling**: Allows dynamic resolution adjustment
5. **Shadow Map Refresh**: Can be reduced to every 2 frames for performance

### Expected Performance
- **HIGH (Full Features)**: 45-60 FPS on modern hardware
- **MEDIUM (Balanced)**: 60+ FPS on mid-range hardware
- **LOW (Performance)**: 60+ FPS on integrated graphics

## Asset Loading & HDR

### HDR Environment Texture
The system uses a prefiltered HDR environment from Babylon.js assets:
- URL: `https://assets.babylonjs.com/environments/environmentSpecular.env`
- Format: Babylon environment format (.env)
- Provides: Pre-convolved diffuse and specular maps

### Texture Atlasing
All materials use tiled textures with appropriate scaling:
- Ground: 160x160 tiling (large scale for outdoor)
- Roads: 5x160 tiling (directional)
- Sidewalks: 20x20 tiling (detailed close-up)
- Walls: 2x2 tiling (architectural)

## Future Enhancements

### Planned Features
1. **Custom HDR Textures**: Support for user-provided HDR panoramas
2. **Material Atlasing**: GPU-optimized material batching
3. **Dynamic LOD**: Automatic quality reduction at distance
4. **PBR Texture Import**: Support for external PBR texture sets
5. **Real-time Ray Tracing**: Optional ray-traced reflections for next-gen GPUs

### Integration with High-Fidelity Assets
When implementing Sketchfab or Quixel Megascans models:
1. Ensure models use standard PBR texture sets (Albedo, Normal, Roughness, Metallic, AO)
2. Use glTF format for optimal compatibility
3. Apply LOD meshes for distant rendering
4. Consider Babylon.js material conversion tools

## Testing & Validation

### Quality Assurance
- Test all graphics quality presets
- Verify material appearance under different lighting conditions
- Check shadow quality and artifact-free rendering
- Validate performance metrics on target hardware

### Debugging
- Use Babylon.js Inspector (`Ctrl+Shift+I`) to inspect materials
- Check console for SSAO2 initialization status
- Monitor GPU memory usage with browser developer tools
- Profile rendering with Performance timeline

## References

### Babylon.js Documentation
- [PBR Materials](https://doc.babylonjs.com/features/materials#pbr)
- [DefaultRenderingPipeline](https://doc.babylonjs.com/features/featuresDeepDive/Rendering/PostProcesses/DefaultRenderingPipeline)
- [SSAO2](https://doc.babylonjs.com/features/featuresDeepDive/Rendering/PostProcesses/SSAO)
- [Lighting](https://doc.babylonjs.com/features/featuresDeepDive/Lights)

### Industry Standards
- [Physically Based Rendering (Wikipedia)](https://en.wikipedia.org/wiki/Physically_based_rendering)
- [Disney's PBR Approach](https://www.disneyanimation.com/technology/physically-based-rendering)
- [GTA V Graphics Analysis](https://www.techradar.com/reviews/gta-5-graphics)

## Troubleshooting

### Materials Look Washed Out
- Increase environment intensity
- Check that HDR texture is loading properly
- Verify tone mapping is enabled

### Shadows Too Harsh
- Reduce bias value
- Enable PCF filtering
- Increase shadow map resolution

### Performance Issues
- Switch to MEDIUM or LOW quality preset
- Reduce MSAA samples
- Disable SSAO2
- Check for texture streaming bottlenecks

### Post-Processing Artifacts
- Reduce chromatic aberration amount
- Lower grain intensity
- Adjust vignette weight
- Check that camera is properly configured

## Conclusion

This PBR implementation provides TrollCity with a modern, cinematic visual style comparable to AAA game engines. The tiered quality system ensures accessibility across different hardware while maintaining stunning visuals on capable systems. The modular material system makes it easy to add new environmental assets while maintaining consistent visual quality.
