# PBR Quick Reference - Common Patterns & Code Snippets

## Creating PBR Materials

### Basic PBR Material Template
```typescript
const material = new PBRMaterial("materialName", scene);

// Base color
material.albedoColor = new Color3(0.8, 0.6, 0.4);  // Brown

// Textures (optional)
const baseTexture = new Texture("path/to/texture.png", scene);
baseTexture.uScale = 2;  // Tiling
baseTexture.vScale = 2;
material.albedoTexture = baseTexture;

// Surface detail
const normalMap = new Texture("path/to/normal.png", scene);
normalMap.uScale = 2;
normalMap.vScale = 2;
material.bumpTexture = normalMap;

// Physical properties
material.roughness = 0.7;      // 0 = mirror-like, 1 = completely matte
material.metallic = 0.1;       // 0 = non-metallic, 1 = fully metallic
material.ambientColor = new Color3(0.2, 0.2, 0.2);

// Apply to mesh
mesh.material = material;
```

### Emissive Material (Light Source)
```typescript
const lightMaterial = new PBRMaterial("lightMat", scene);
lightMaterial.albedoColor = new Color3(0.3, 0.3, 0.2);
lightMaterial.emissiveColor = new Color3(1, 0.95, 0.8);  // Warm white
lightMaterial.emissiveIntensity = 1.5;  // Brightness multiplier
lightMaterial.roughness = 0.3;
lightMaterial.metallic = 0.1;

// Optional: emissive texture
const glowTex = new DynamicTexture('glowTex', 64, scene);
// ... draw radial gradient on glowTex ...
lightMaterial.emissiveTexture = glowTex;
```

### Metallic Material (Chrome/Steel)
```typescript
const metalMaterial = new PBRMaterial("metalMat", scene);
metalMaterial.albedoColor = new Color3(0.8, 0.8, 0.85);  // Light gray
metalMaterial.roughness = 0.2;    // Smooth, shiny
metalMaterial.metallic = 0.95;    // Highly reflective
metalMaterial.ambientColor = new Color3(0.3, 0.3, 0.35);

// Add subtle normal map for scratches
const scratchMap = new Texture("path/to/scratches.png", scene);
metalMaterial.bumpTexture = scratchMap;
```

### Translucent Material (Glass/Plastic)
```typescript
const glassMaterial = new PBRMaterial("glassMat", scene);
glassMaterial.albedoColor = new Color3(0.1, 0.2, 0.3);
glassMaterial.alpha = 0.5;  // Transparency
glassMaterial.roughness = 0.1;
glassMaterial.metallic = 0.9;  // Reflective
glassMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;

// Enable refraction for glass effect
glassMaterial.indexOfRefraction = 1.5;
```

### Subsurface Scattering (Leaves, Skin)
```typescript
const leafMaterial = new PBRMaterial("leafMat", scene);
leafMaterial.albedoColor = new Color3(0.1, 0.4, 0.1);  // Green
leafMaterial.roughness = 0.7;
leafMaterial.metallic = 0.0;

// Enable light transmission through surface
leafMaterial.subSurface.isRefractionEnabled = true;
leafMaterial.subSurface.refractionIntensity = 0.3;
leafMaterial.subSurface.translucencyIntensity = 0.2;
leafMaterial.subSurface.isScatteringEnabled = true;
```

## Quality Settings Application

### Apply Quality Preset
```typescript
const setGraphicsQuality = (quality: 'low' | 'medium' | 'high') => {
  switch (quality) {
    case 'high':
      engine.setHardwareScalingLevel(1);    // Full resolution
      pipeline.samples = 8;                  // 8x MSAA
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.5;
      pipeline.bloomWeight = 0.6;
      pipeline.grainEnabled = true;
      pipeline.grain.intensity = 12;
      pipeline.chromaticAberrationEnabled = true;
      break;
      
    case 'medium':
      engine.setHardwareScalingLevel(1);
      pipeline.samples = 4;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.6;
      pipeline.bloomWeight = 0.4;
      pipeline.grainEnabled = true;
      pipeline.grain.intensity = 6;
      pipeline.chromaticAberrationEnabled = false;
      break;
      
    case 'low':
      engine.setHardwareScalingLevel(2);    // 50% resolution (1/4 pixels)
      pipeline.samples = 2;
      pipeline.bloomEnabled = false;
      pipeline.grainEnabled = false;
      pipeline.chromaticAberrationEnabled = false;
      break;
  }
};
```

## Lighting Techniques

### HDR Environment Setup
```typescript
const envTexture = CubeTexture.CreateFromPrefilteredData(
  "https://assets.babylonjs.com/environments/environmentSpecular.env",
  scene
);
scene.environmentTexture = envTexture;
scene.environmentIntensity = 1.0;  // Adjust for brightness
```

### Directional Light (Sun)
```typescript
const sunLight = new DirectionalLight("sun", new Vector3(-0.8, -1.2, -0.8), scene);
sunLight.intensity = 3.5;
sunLight.position = new Vector3(100, 150, 100);
sunLight.range = 500;
```

### Cascaded Shadows
```typescript
const shadowGenerator = new CascadedShadowGenerator(2048, sunLight);
shadowGenerator.transparencyShadow = true;
shadowGenerator.bias = 0.002;
shadowGenerator.usePercentageCloserFiltering = true;
shadowGenerator.splitFrustum();

// Add mesh to shadow casters
shadowGenerator.addShadowCaster(mesh);
```

### Point Light (Streetlamp)
```typescript
const streetLight = new PointLight("streetLight", new Vector3(x, y, z), scene);
streetLight.intensity = 0.6;
streetLight.diffuse = new Color3(1, 0.95, 0.8);  // Warm white
streetLight.range = 30;  // Light reach distance
```

## Post-Processing Patterns

### Bloom Setup
```typescript
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.5;      // Pixels brighter than this glow
pipeline.bloomWeight = 0.6;         // Intensity of glow
pipeline.bloomKernel = 128;         // Softness (higher = softer)
pipeline.bloomScale = 0.6;          // Size of glow spread
```

### Color Grading (Teal/Orange)
```typescript
const curves = new ColorCurves();
curves.globalHue = 180;             // Overall blue shift
curves.globalDensity = 0;
curves.shadowsHue = 200;            // Teal shadows
curves.shadowsDensity = 30;
curves.midtonesHue = 180;
curves.midtonesDensity = 10;
curves.highlightsHue = 20;          // Orange highlights
curves.highlightsDensity = 25;

pipeline.imageProcessing.colorCurvesEnabled = true;
pipeline.imageProcessing.colorCurves = curves;
```

### Tone Mapping (ACES)
```typescript
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.exposure = 1.4;    // Brightness
pipeline.imageProcessing.contrast = 1.3;    // Drama
```

### Film Grain
```typescript
pipeline.grainEnabled = true;
pipeline.grain.intensity = 12;
pipeline.grain.animated = true;
```

### Vignette (Dark Edges)
```typescript
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.8;  // Darkness
pipeline.imageProcessing.vignetteColor = new Color4(0.1, 0.1, 0.15, 0);
```

### Chromatic Aberration (Lens Effect)
```typescript
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 15;
pipeline.chromaticAberration.radialIntensity = 2.5;
```

## SSAO2 (Ambient Occlusion)

### Setup with Error Handling
```typescript
try {
  const ssaoRatio = canvas.width / canvas.height;
  const ssao = new SSAO2RenderingPipeline(
    "ssao2",
    scene,
    { ssaoRatio: ssaoRatio, blurRatio: 1 }
  );
  
  (ssao as any).radius = 25;
  (ssao as any).bias = 0.015;
  (ssao as any).intensity = 1.8;
  (ssao as any).maxZ = 250;
  ssao.samples = 8;
  
  console.log("SSAO2 enabled");
} catch (err) {
  console.warn("SSAO2 not available", err);
}
```

## Texture Tiling Best Practices

```typescript
// Large outdoor surface (terrain, grass)
texture.uScale = 160;  // Tiled many times for detail
texture.vScale = 160;

// Road surface
roadTexture.uScale = 5;    // Width scale
roadTexture.vScale = 160;  // Length direction

// Building walls
wallTexture.uScale = 2;   // Normal scale
wallTexture.vScale = 2;

// Close-up details (concrete)
concreteTexture.uScale = 20;
concreteTexture.vScale = 20;
```

## Roughness & Metallic Value Guide

### Roughness Values (0 = Mirror, 1 = Matte)
| Surface | Roughness |
|---------|-----------|
| Polished Metal | 0.1-0.2 |
| Painted Surface | 0.3-0.4 |
| Wood | 0.6-0.8 |
| Concrete | 0.8-0.9 |
| Leaves/Fabric | 0.7-0.9 |
| Car Paint | 0.2-0.3 |
| Rust | 0.8-1.0 |

### Metallic Values (0 = Non-metal, 1 = Metal)
| Surface | Metallic |
|---------|----------|
| Iron/Steel | 0.9-1.0 |
| Chrome | 0.95-1.0 |
| Aluminum | 0.8-0.9 |
| Copper | 0.7-0.8 |
| Plastic | 0.0-0.1 |
| Fabric | 0.0 |
| Oxidized Metal | 0.3-0.5 |
| Glass | 0.8-0.9 |

## Common Issues & Solutions

### Material Looks Washed Out
```typescript
// Increase environment intensity
scene.environmentIntensity = 1.2;

// Increase ambient color brightness
light.groundColor = new Color3(0.08, 0.08, 0.12);

// Reduce roughness slightly
material.roughness = 0.6;  // Was 0.8
```

### Shadows Too Harsh
```typescript
// Reduce bias for softer shadows
shadowGenerator.bias = 0.001;  // Was 0.002

// Enable PCF filtering
shadowGenerator.usePercentageCloserFiltering = true;

// Increase shadow map resolution
const shadowGen = new CascadedShadowGenerator(4096, sunLight);  // 2x resolution
```

### Post-Processing Looks Fake
```typescript
// Reduce chromatic aberration
pipeline.chromaticAberration.aberrationAmount = 8;  // Was 15

// Lower grain intensity
pipeline.grain.intensity = 8;  // Was 12

// Adjust vignette
pipeline.imageProcessing.vignetteWeight = 1.2;  // Was 1.8
```

### Low Frame Rate
```typescript
// Switch to lower quality preset
setGraphicsQuality('low');

// Reduce shadow update frequency
shadowGenerator.getShadowMap().refreshRate = 2;  // Every 2 frames

// Disable expensive effects
pipeline.chromaticAberrationEnabled = false;
pipeline.bloomEnabled = false;
```

## Performance Optimization Tips

1. **Use Cascaded Shadows** - Better quality with less resolution needed
2. **Limit Light Count** - Use instanced point lights sparingly
3. **Texture Atlasing** - Share textures between similar materials
4. **LOD (Level of Detail)** - Use simpler materials for distant objects
5. **Hardware Scaling** - Let users reduce resolution on weaker hardware
6. **Lazy Material Creation** - Create materials only when needed
7. **Share Materials** - Reuse materials across multiple meshes

## References

- [Babylon.js PBR Documentation](https://doc.babylonjs.com/features/materials#pbr)
- [Material Properties Guide](https://doc.babylonjs.com/features/featuresDeepDive/Materials/Using/PBRMaterialIntro)
- [Lighting Best Practices](https://doc.babylonjs.com/features/featuresDeepDive/Lights)
