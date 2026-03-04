/**
 * ENTRANCE EFFECTS - THREE.JS ENGINE
 * Production-grade Three.js rendering for entrance effects
 * 
 * Features:
 * - Instanced particles for performance
 * - Automatic quality adjustment
 * - Proper disposal to prevent memory leaks
 * - Screen shake support
 * - Bloom and post-processing
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import type {
  ThreeEffectConfig,
  ParticleConfig,
  ParticleType,
  ActiveEntranceEffect,
  QualityPreset,
} from '../types';
import { QUALITY_PRESETS } from '../types/config';

// ==========================================
// ENGINE STATE
// ==========================================

interface EngineState {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  composer: EffectComposer | null;
  animationId: number | null;
  container: HTMLElement | null;
  quality: QualityPreset;
  particleSystems: Map<string, THREE.InstancedMesh>;
  lights: Set<THREE.Light>;
  frameCount: number;
  lastTime: number;
  targetFPS: number;
}

const state: EngineState = {
  renderer: null,
  scene: null,
  camera: null,
  composer: null,
  animationId: null,
  container: null,
  quality: QUALITY_PRESETS.high,
  particleSystems: new Map(),
  lights: new Set(),
  frameCount: 0,
  lastTime: 0,
  targetFPS: 60,
};

// Screen shake state
interface ShakeState {
  intensity: number;
  decay: number;
  duration: number;
  startTime: number;
  active: boolean;
}

let shakeState: ShakeState = {
  intensity: 0,
  decay: 0.9,
  duration: 0,
  startTime: 0,
  active: false,
};

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize the Three.js engine
 */
export function initThreeEngine(
  container: HTMLElement,
  quality: keyof typeof QUALITY_PRESETS = 'high'
): boolean {
  if (state.renderer) {
    console.warn('[ThreeEngine] Already initialized');
    return true;
  }
  
  try {
    state.quality = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
    state.container = container;
    
    // Create scene
    state.scene = new THREE.Scene();
    
    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    state.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    state.camera.position.set(0, 0, 5);
    
    // Create renderer
    state.renderer = new THREE.WebGLRenderer({
      antialias: state.quality.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, state.quality.scale)
    );
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.sortObjects = false; // Performance optimization
    
    container.appendChild(state.renderer.domElement);
    
    // Setup post-processing if enabled
    if (state.quality.enablePostProcessing) {
      setupPostProcessing();
    }
    
    // Start render loop
    state.lastTime = performance.now();
    animate();
    
    // Handle resize
    window.addEventListener('resize', handleResize);
    
    console.log('[ThreeEngine] Initialized with quality:', quality);
    return true;
  } catch (err) {
    console.error('[ThreeEngine] Initialization failed:', err);
    return false;
  }
}

/**
 * Setup post-processing effects
 */
function setupPostProcessing(): void {
  if (!state.renderer || !state.scene || !state.camera) {
    return;
  }
  
  state.composer = new EffectComposer(state.renderer);
  
  // Render pass
  const renderPass = new RenderPass(state.scene, state.camera);
  state.composer.addPass(renderPass);
  
  // Bloom pass
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(state.container!.clientWidth, state.container!.clientHeight),
    1.5,  // strength
    0.4,  // radius
    0.85  // threshold
  );
  state.composer.addPass(bloomPass);
}

// ==========================================
// RENDER LOOP
// ==========================================

function animate(): void {
  if (!state.renderer || !state.scene || !state.camera) {
    return;
  }
  
  state.animationId = requestAnimationFrame(animate);
  
  const now = performance.now();
  const delta = (now - state.lastTime) / 1000;
  state.lastTime = now;
  
  state.frameCount++;
  
  // Apply screen shake
  if (shakeState.active) {
    applyScreenShake(now);
  }
  
  // Update particle systems
  updateParticles(delta);
  
  // Render
  if (state.composer) {
    state.composer.render();
  } else {
    state.renderer.render(state.scene, state.camera);
  }
}

/**
 * Apply screen shake effect
 */
function applyScreenShake(now: number): void {
  if (!state.camera || !shakeState.active) {
    return;
  }
  
  const elapsed = now - shakeState.startTime;
  
  if (elapsed >= shakeState.duration) {
    shakeState.active = false;
    state.camera.position.set(0, 0, 5);
    return;
  }
  
  // Decay intensity
  const currentIntensity = shakeState.intensity * Math.pow(shakeState.decay, elapsed / 100);
  
  // Random offset
  const x = (Math.random() - 0.5) * currentIntensity;
  const y = (Math.random() - 0.5) * currentIntensity;
  
  state.camera.position.set(x, y, 5);
}

// ==========================================
// PARTICLE SYSTEMS
// ==========================================

/**
 * Create an instanced particle system
 */
export function createParticleSystem(
  config: ParticleConfig,
  systemId: string
): THREE.InstancedMesh | null {
  if (!state.scene) {
    return null;
  }
  
  // Check particle limit
  const currentParticles = Array.from(state.particleSystems.values())
    .reduce((sum, mesh) => sum + mesh.count, 0);
  
  if (currentParticles + config.count > state.quality.maxParticles) {
    console.warn(`[ThreeEngine] Particle limit reached: ${currentParticles}/${state.quality.maxParticles}`);
    return null;
  }
  
  // Geometry based on particle type
  const geometry = getParticleGeometry(config.type);
  
  // Material
  const material = new THREE.MeshBasicMaterial({
    color: typeof config.color === 'string' ? config.color : config.color[0],
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  // Create instanced mesh
  const mesh = new THREE.InstancedMesh(geometry, material, config.count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  
  // Initialize instances
  const dummy = new THREE.Object3D();
  const colors: number[] = [];
  
  for (let i = 0; i < config.count; i++) {
    // Random position
    dummy.position.set(
      (Math.random() - 0.5) * config.spread,
      (Math.random() - 0.5) * config.spread,
      (Math.random() - 0.5) * config.spread
    );
    
    // Random rotation
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    // Random scale
    const scale = config.size.min + Math.random() * (config.size.max - config.size.min);
    dummy.scale.set(scale, scale, scale);
    
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    
    // Color variation
    const color = getParticleColor(config.color, i, config.count);
    mesh.setColorAt(i, new THREE.Color(color));
  }
  
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  
  // Store metadata on mesh for updates
  (mesh as any).particleData = {
    config,
    velocities: Array(config.count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * config.velocity.max,
      y: (Math.random() - 0.5) * config.velocity.max,
      z: (Math.random() - 0.5) * config.velocity.max,
    })),
    lifetimes: Array(config.count).fill(0).map(() =>
      config.lifetime.min + Math.random() * (config.lifetime.max - config.lifetime.min)
    ),
    ages: Array(config.count).fill(0),
  };
  
  state.scene.add(mesh);
  state.particleSystems.set(systemId, mesh);
  
  return mesh;
}

/**
 * Get geometry for particle type
 */
function getParticleGeometry(type: ParticleType): THREE.BufferGeometry {
  switch (type) {
    case 'sparkle':
    case 'star':
      return new THREE.OctahedronGeometry(1, 0);
    case 'fire':
      return new THREE.SphereGeometry(1, 8, 8);
    case 'smoke':
      return new THREE.IcosahedronGeometry(1, 1);
    case 'confetti':
      return new THREE.PlaneGeometry(1, 1);
    case 'money':
      return new THREE.BoxGeometry(1.5, 0.8, 0.1);
    case 'magic':
      return new THREE.TorusGeometry(1, 0.3, 8, 16);
    case 'lightning':
      return new THREE.ConeGeometry(0.2, 2, 4);
    case 'bubble':
      return new THREE.SphereGeometry(1, 16, 16);
    case 'shard':
      return new THREE.ConeGeometry(0.3, 1.5, 3);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

/**
 * Get color for particle
 */
function getParticleColor(
  color: string | string[],
  index: number,
  total: number
): string {
  if (typeof color === 'string') {
    return color;
  }
  
  // Distribute colors evenly
  const colorIndex = Math.floor((index / total) * color.length);
  return color[Math.min(colorIndex, color.length - 1)];
}

/**
 * Update all particle systems
 */
function updateParticles(delta: number): void {
  const dummy = new THREE.Object3D();
  
  state.particleSystems.forEach((mesh, id) => {
    const data = (mesh as any).particleData;
    if (!data) {
      return;
    }
    
    const { config, velocities, lifetimes, ages } = data;
    let needsUpdate = false;
    let activeCount = 0;
    
    for (let i = 0; i < config.count; i++) {
      // Age particles
      ages[i] += delta * 1000;
      
      if (ages[i] >= lifetimes[i]) {
        // Reset particle
        ages[i] = 0;
        dummy.position.set(
          (Math.random() - 0.5) * config.spread,
          (Math.random() - 0.5) * config.spread,
          (Math.random() - 0.5) * config.spread
        );
      } else {
        // Update position
        mesh.getMatrixAt(i, dummy.matrix);
        dummy.position.setFromMatrixPosition(dummy.matrix);
        
        // Apply velocity
        dummy.position.x += velocities[i].x * delta;
        dummy.position.y += velocities[i].y * delta;
        dummy.position.z += velocities[i].z * delta;
        
        // Apply gravity
        if (config.gravity) {
          dummy.position.y -= config.gravity * delta;
        }
      }
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
      activeCount++;
    }
    
    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
}

/**
 * Remove a particle system
 */
export function removeParticleSystem(systemId: string): void {
  const mesh = state.particleSystems.get(systemId);
  if (!mesh) {
    return;
  }
  
  state.scene?.remove(mesh);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
  state.particleSystems.delete(systemId);
}

// ==========================================
// LIGHTING
// ==========================================

/**
 * Add lights from config
 */
export function addLights(config: ThreeEffectConfig): string[] {
  if (!state.scene) {
    return [];
  }
  
  const lightIds: string[] = [];
  
  config.lights?.forEach((lightConfig, index) => {
    const id = `light_${Date.now()}_${index}`;
    let light: THREE.Light;
    
    switch (lightConfig.type) {
      case 'ambient':
        light = new THREE.AmbientLight(
          lightConfig.color,
          lightConfig.intensity
        );
        break;
      case 'point':
        light = new THREE.PointLight(
          lightConfig.color,
          lightConfig.intensity,
          50
        );
        if (lightConfig.position) {
          light.position.set(
            lightConfig.position.x,
            lightConfig.position.y,
            lightConfig.position.z
          );
        }
        break;
      case 'spot':
        light = new THREE.SpotLight(
          lightConfig.color,
          lightConfig.intensity
        );
        if (lightConfig.position) {
          light.position.set(
            lightConfig.position.x,
            lightConfig.position.y,
            lightConfig.position.z
          );
        }
        (light as THREE.SpotLight).target.position.set(0, 0, 0);
        break;
      case 'directional':
        light = new THREE.DirectionalLight(
          lightConfig.color,
          lightConfig.intensity
        );
        if (lightConfig.position) {
          light.position.set(
            lightConfig.position.x,
            lightConfig.position.y,
            lightConfig.position.z
          );
        }
        break;
      default:
        return;
    }
    
    light.userData.id = id;
    state.scene.add(light);
    state.lights.add(light);
    lightIds.push(id);
  });
  
  // Add fog if configured
  if (config.fog && state.scene) {
    state.scene.fog = new THREE.Fog(
      config.fog.color,
      config.fog.near,
      config.fog.far
    );
  }
  
  return lightIds;
}

/**
 * Remove lights
 */
export function removeLights(ids: string[]): void {
  state.lights.forEach(light => {
    if (ids.includes(light.userData.id)) {
      state.scene?.remove(light);
      light.dispose();
      state.lights.delete(light);
    }
  });
  
  // Clear fog
  if (state.scene) {
    state.scene.fog = null;
  }
}

// ==========================================
// SCREEN SHAKE
// ==========================================

/**
 * Trigger screen shake
 */
export function triggerScreenShake(intensity: number, duration: number): void {
  shakeState = {
    intensity,
    decay: 0.9,
    duration,
    startTime: performance.now(),
    active: true,
  };
}

// ==========================================
// QUALITY ADJUSTMENT
// ==========================================

/**
 * Adjust quality based on FPS
 */
export function adjustQuality(fps: number): void {
  if (fps < state.targetFPS * 0.7) {
    // Performance is suffering, reduce quality
    if (state.quality.scale > 0.5) {
      state.quality.scale -= 0.25;
      state.renderer?.setPixelRatio(
        Math.min(window.devicePixelRatio, state.quality.scale)
      );
      console.log('[ThreeEngine] Reduced quality scale to:', state.quality.scale);
    }
  }
}

/**
 * Set explicit quality
 */
export function setQuality(quality: keyof typeof QUALITY_PRESETS): void {
  state.quality = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  
  if (state.renderer) {
    state.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, state.quality.scale)
    );
  }
}

// ==========================================
// RESIZE HANDLING
// ==========================================

function handleResize(): void {
  if (!state.container || !state.camera || !state.renderer) {
    return;
  }
  
  const width = state.container.clientWidth;
  const height = state.container.clientHeight;
  
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  
  state.renderer.setSize(width, height);
  
  if (state.composer) {
    state.composer.setSize(width, height);
  }
}

// ==========================================
// CLEANUP
// ==========================================

/**
 * Cleanup all resources
 */
export function cleanupThreeEngine(): void {
  // Stop animation
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
  
  // Remove event listener
  window.removeEventListener('resize', handleResize);
  
  // Cleanup particle systems
  state.particleSystems.forEach((mesh, id) => {
    removeParticleSystem(id);
  });
  state.particleSystems.clear();
  
  // Cleanup lights
  state.lights.forEach(light => {
    state.scene?.remove(light);
    light.dispose();
  });
  state.lights.clear();
  
  // Clear scene
  if (state.scene) {
    state.scene.fog = null;
    // Remove all objects
    while (state.scene.children.length > 0) {
      const object = state.scene.children[0];
      state.scene.remove(object);
      if ((object as any).geometry) {
        (object as any).geometry.dispose();
      }
      if ((object as any).material) {
        (object as any).material.dispose();
      }
    }
  }
  
  // Dispose renderer
  if (state.renderer) {
    state.renderer.dispose();
    state.renderer.domElement.remove();
  }
  
  // Reset state
  state.renderer = null;
  state.scene = null;
  state.camera = null;
  state.composer = null;
  state.container = null;
  
  console.log('[ThreeEngine] Cleaned up');
}

// ==========================================
// GETTERS
// ==========================================

export function isThreeReady(): boolean {
  return !!state.renderer && !!state.scene && !!state.camera;
}

export function getRenderer(): THREE.WebGLRenderer | null {
  return state.renderer;
}

export function getScene(): THREE.Scene | null {
  return state.scene;
}

export function getFPS(): number {
  return state.targetFPS;
}