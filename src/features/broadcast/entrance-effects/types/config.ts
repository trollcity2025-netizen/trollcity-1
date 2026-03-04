/**
 * ENTRANCE EFFECTS - CONFIGURATION
 * All defined entrance effects with rarity-based configurations
 *
 * STRICT RULES:
 * - Court and TCNN contexts are EXPLICITLY BLOCKED
 * - Each effect has clear phase timings
 * - Particle counts scale with rarity
 * - Sound configs use Web Audio API
 *
 * COMPATIBILITY:
 * - Effect IDs must match the database table `entrance_effects` IDs
 * - The IDs defined here are for the NEW Three.js based system
 * - Legacy effects remain in src/lib/entranceEffects.ts
 */

import type {
  EntranceEffectConfig,
  QualityPreset,
  EntranceEffectsConfig,
  AllowedEntranceContext,
} from './index';

// ==========================================
// QUALITY PRESETS
// ==========================================

export const QUALITY_PRESETS: Record<string, QualityPreset> = {
  low: {
    maxParticles: 50,
    enablePostProcessing: false,
    enableShadows: false,
    antialias: false,
    targetFPS: 30,
    scale: 0.5,
  },
  medium: {
    maxParticles: 150,
    enablePostProcessing: true,
    enableShadows: false,
    antialias: false,
    targetFPS: 45,
    scale: 0.75,
  },
  high: {
    maxParticles: 300,
    enablePostProcessing: true,
    enableShadows: true,
    antialias: true,
    targetFPS: 60,
    scale: 1,
  },
  ultra: {
    maxParticles: 500,
    enablePostProcessing: true,
    enableShadows: true,
    antialias: true,
    targetFPS: 60,
    scale: 1.2,
  },
};

// ==========================================
// DEFAULT SYSTEM CONFIG
// ==========================================

export const DEFAULT_ENTRANCE_CONFIG: EntranceEffectsConfig = {
  quality: 'high',
  maxQueueSize: 5,
  maxConcurrentEffects: 1, // Only one at a time for maximum impact
  minGapBetweenEffects: 500, // 500ms minimum gap
  autoAdjustQuality: true,
  muted: false,
  volume: 0.7,
};

// ==========================================
// BLOCKED CONTEXTS (Non-negotiable)
// ==========================================

export const BLOCKED_CONTEXTS: AllowedEntranceContext[] = ['court', 'tcnn'] as any;

export function isContextBlocked(context: string): boolean {
  return context === 'court' || context === 'tcnn';
}

// ==========================================
// ENTRANCE EFFECTS DATA
// ==========================================

export const ENTRANCE_EFFECTS: Record<string, EntranceEffectConfig> = {
  // ==========================================
  // COMMON EFFECTS (Simple, quick)
  // ==========================================
  'soft_glow': {
    id: 'soft_glow',
    name: 'Soft Glow',
    description: 'A gentle pink aura that welcomes you in',
    rarity: 'common',
    duration: 2000,
    phaseTimings: { intro: 500, main: 1000, outro: 500 },
    threeConfig: {
      fog: { color: '#ffb6c1', near: 1, far: 10 },
      lights: [
        { type: 'ambient', color: '#ffb6c1', intensity: 0.5 },
        { type: 'point', color: '#ff69b4', intensity: 1, position: { x: 0, y: 2, z: 3 } },
      ],
      particleSystems: [{
        type: 'sparkle',
        count: 20,
        color: '#ffb6c1',
        size: { min: 0.05, max: 0.15 },
        velocity: { min: 0.5, max: 1.5 },
        lifetime: { min: 1000, max: 2000 },
        gravity: -0.2,
        spread: 2,
      }],
      shakeIntensity: 0,
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/soft_chime.mp3', volume: 0.4, fadeIn: 200 },
    ],
    usernameDisplay: {
      position: 'bottom',
      animation: 'fade',
      style: 'minimal',
    },
    category: 'starter',
    coinCost: 100,
  },

  'shadow_step': {
    id: 'shadow_step',
    name: 'Shadow Step',
    description: 'Emerging from the shadows',
    rarity: 'common',
    duration: 1800,
    phaseTimings: { intro: 400, main: 900, outro: 500 },
    threeConfig: {
      fog: { color: '#1a1a2e', near: 0.5, far: 8 },
      lights: [
        { type: 'ambient', color: '#16213e', intensity: 0.3 },
      ],
      particleSystems: [{
        type: 'smoke',
        count: 15,
        color: '#0f0f23',
        size: { min: 0.1, max: 0.3 },
        velocity: { min: 0.3, max: 0.8 },
        lifetime: { min: 800, max: 1500 },
        gravity: 0.1,
        spread: 3,
      }],
      shakeIntensity: 0,
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/dark_whoosh.mp3', volume: 0.3 },
    ],
    usernameDisplay: {
      position: 'bottom',
      animation: 'slide',
      style: 'minimal',
    },
    category: 'starter',
    coinCost: 100,
  },

  // ==========================================
  // UNCOMMON EFFECTS (More particles, sounds)
  // ==========================================
  'heart_drift': {
    id: 'heart_drift',
    name: 'Heart Drift',
    description: 'Floating hearts dissolve upward',
    rarity: 'uncommon',
    duration: 2500,
    phaseTimings: { intro: 600, main: 1300, outro: 600 },
    threeConfig: {
      fog: { color: '#ffe4e1', near: 1, far: 12 },
      lights: [
        { type: 'ambient', color: '#ffb6c1', intensity: 0.4 },
        { type: 'point', color: '#ff1493', intensity: 1.2, position: { x: 0, y: 3, z: 4 } },
      ],
      particleSystems: [{
        type: 'sparkle',
        count: 40,
        color: ['#ff69b4', '#ffb6c1', '#ff1493'],
        size: { min: 0.08, max: 0.2 },
        velocity: { min: 1, max: 2.5 },
        lifetime: { min: 1500, max: 2500 },
        gravity: -0.5,
        spread: 3,
      }],
      shakeIntensity: 0.2,
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/heart_beat.mp3', volume: 0.5 },
      { type: 'ambient', src: '/sounds/entrance/magic_wind.mp3', volume: 0.3, loop: true },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'bounce',
      style: 'neon',
    },
    category: 'romance',
    coinCost: 250,
  },

  'bass_thump': {
    id: 'bass_thump',
    name: 'Bass Thump',
    description: 'Low frequency energy pulse',
    rarity: 'uncommon',
    duration: 2200,
    phaseTimings: { intro: 300, main: 1600, outro: 300 },
    threeConfig: {
      fog: { color: '#2d0a31', near: 1, far: 15 },
      lights: [
        { type: 'ambient', color: '#4a0e4e', intensity: 0.5 },
        { type: 'point', color: '#9d00ff', intensity: 1.5, position: { x: 0, y: 0, z: 3 } },
      ],
      particleSystems: [{
        type: 'magic',
        count: 30,
        color: '#9d00ff',
        size: { min: 0.1, max: 0.25 },
        velocity: { min: 2, max: 5 },
        lifetime: { min: 500, max: 1200 },
        gravity: 0,
        spread: 4,
      }],
      shakeIntensity: 0.5,
      postProcessing: {
        bloom: true,
        motionBlur: false,
        chromaticAberration: false,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/bass_hit.mp3', volume: 0.6 },
      { type: 'peak', src: '/sounds/entrance/sub_drop.mp3', volume: 0.8, delay: 300 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'slide',
      style: 'neon',
    },
    category: 'club',
    coinCost: 300,
  },

  // ==========================================
  // RARE EFFECTS (Dramatic, multi-sound)
  // ==========================================
  'ember_sparks': {
    id: 'ember_sparks',
    name: 'Ember Sparks',
    description: 'Red embers float upward from below',
    rarity: 'rare',
    duration: 3000,
    phaseTimings: { intro: 800, main: 1800, outro: 400 },
    threeConfig: {
      fog: { color: '#1a0a00', near: 0.8, far: 15 },
      lights: [
        { type: 'ambient', color: '#331100', intensity: 0.4 },
        { type: 'point', color: '#ff4500', intensity: 2, position: { x: 0, y: 0, z: 4 } },
        { type: 'point', color: '#ff8c00', intensity: 1, position: { x: 2, y: 1, z: 2 } },
      ],
      particleSystems: [
        {
          type: 'fire',
          count: 50,
          color: ['#ff4500', '#ff8c00', '#ffd700'],
          size: { min: 0.05, max: 0.2 },
          velocity: { min: 1, max: 3 },
          lifetime: { min: 1500, max: 3000 },
          gravity: -0.8,
          spread: 4,
        },
        {
          type: 'sparkle',
          count: 30,
          color: '#ffd700',
          size: { min: 0.02, max: 0.1 },
          velocity: { min: 0.5, max: 2 },
          lifetime: { min: 1000, max: 2000 },
          gravity: -0.3,
          spread: 3,
        },
      ],
      shakeIntensity: 0.3,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: false,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/fire_crackle.mp3', volume: 0.5, fadeIn: 300 },
      { type: 'peak', src: '/sounds/entrance/fire_burst.mp3', volume: 0.7, delay: 800 },
      { type: 'outro', src: '/sounds/entrance/ember_fade.mp3', volume: 0.3, fadeOut: 500 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'fade',
      style: 'classic',
    },
    category: 'fire',
    coinCost: 800,
  },

  'neon_outline': {
    id: 'neon_outline',
    name: 'Neon Outline',
    description: 'Cyberpunk energy frame materializes',
    rarity: 'rare',
    duration: 2800,
    phaseTimings: { intro: 500, main: 1800, outro: 500 },
    threeConfig: {
      fog: { color: '#0a0a1a', near: 1, far: 20 },
      lights: [
        { type: 'ambient', color: '#1a1a3e', intensity: 0.3 },
        { type: 'point', color: '#00ffff', intensity: 2, position: { x: -2, y: 2, z: 3 } },
        { type: 'point', color: '#ff00ff', intensity: 2, position: { x: 2, y: 2, z: 3 } },
      ],
      particleSystems: [{
        type: 'sparkle',
        count: 60,
        color: ['#00ffff', '#ff00ff', '#00ff00'],
        size: { min: 0.03, max: 0.15 },
        velocity: { min: 2, max: 6 },
        lifetime: { min: 800, max: 2000 },
        gravity: 0,
        spread: 5,
      }],
      shakeIntensity: 0,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: true,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/neon_hum.mp3', volume: 0.4 },
      { type: 'peak', src: '/sounds/entrance/cyber_burst.mp3', volume: 0.6, delay: 500 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'typewriter',
      style: 'neon',
    },
    category: 'cyberpunk',
    coinCost: 1000,
  },

  // ==========================================
  // EPIC EFFECTS (Grand, multi-phase, particles)
  // ==========================================
  'thunder_crack': {
    id: 'thunder_crack',
    name: 'Thunder Crack',
    description: 'Lightning announces your arrival',
    rarity: 'epic',
    duration: 3500,
    phaseTimings: { intro: 400, main: 2500, outro: 600 },
    threeConfig: {
      fog: { color: '#0a0a0a', near: 0.5, far: 25 },
      lights: [
        { type: 'ambient', color: '#1a1a1a', intensity: 0.2 },
        { type: 'point', color: '#ffffff', intensity: 5, position: { x: 0, y: 10, z: 0 } },
        { type: 'point', color: '#9370db', intensity: 1.5, position: { x: 0, y: 0, z: 5 } },
      ],
      particleSystems: [
        {
          type: 'lightning',
          count: 80,
          color: ['#ffffff', '#e6e6fa', '#9370db'],
          size: { min: 0.02, max: 0.15 },
          velocity: { min: 10, max: 30 },
          lifetime: { min: 100, max: 400 },
          gravity: 0,
          spread: 8,
        },
        {
          type: 'sparkle',
          count: 40,
          color: '#9370db',
          size: { min: 0.05, max: 0.2 },
          velocity: { min: 1, max: 4 },
          lifetime: { min: 500, max: 1500 },
          gravity: 0.2,
          spread: 6,
        },
      ],
      shakeIntensity: 1.5,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: false,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/thunder_build.mp3', volume: 0.5 },
      { type: 'peak', src: '/sounds/entrance/thunder_crack.mp3', volume: 1, delay: 400 },
      { type: 'ambient', src: '/sounds/entrance/storm_rumble.mp3', volume: 0.4, loop: true, fadeIn: 200, fadeOut: 500 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'bounce',
      style: 'royal',
    },
    category: 'storm',
    coinCost: 2000,
  },

  'money_shower': {
    id: 'money_shower',
    name: 'Money Shower',
    description: 'Make it rain when you arrive',
    rarity: 'epic',
    duration: 4000,
    phaseTimings: { intro: 600, main: 2800, outro: 600 },
    threeConfig: {
      fog: { color: '#0d3328', near: 1, far: 30 },
      lights: [
        { type: 'ambient', color: '#1a4a3a', intensity: 0.5 },
        { type: 'spot', color: '#ffd700', intensity: 2, position: { x: 0, y: 15, z: 0 } },
      ],
      particleSystems: [
        {
          type: 'money',
          count: 100,
          color: ['#85bb65', '#3d8b37', '#1a5f1a'],
          size: { min: 0.15, max: 0.4 },
          velocity: { min: 3, max: 8 },
          lifetime: { min: 2000, max: 4000 },
          gravity: 2,
          spread: 10,
        },
        {
          type: 'confetti',
          count: 60,
          color: ['#ffd700', '#ff69b4', '#00ffff', '#ff4500'],
          size: { min: 0.05, max: 0.15 },
          velocity: { min: 2, max: 6 },
          lifetime: { min: 1500, max: 3000 },
          gravity: 1.5,
          spread: 8,
        },
      ],
      shakeIntensity: 0.8,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: false,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/cash_register.mp3', volume: 0.5 },
      { type: 'peak', src: '/sounds/entrance/money_rain.mp3', volume: 0.8, delay: 600 },
      { type: 'ambient', src: '/sounds/entrance/coins_falling.mp3', volume: 0.6, loop: true, fadeIn: 200 },
      { type: 'outro', src: '/sounds/entrance/coins_settle.mp3', volume: 0.4, fadeOut: 400 },
    ],
    usernameDisplay: {
      position: 'top',
      animation: 'slide',
      style: 'royal',
    },
    category: 'wealth',
    coinCost: 2500,
  },

  // ==========================================
  // LEGENDARY EFFECTS (Cinematic, wow factor)
  // ==========================================
  'diamond_cascade': {
    id: 'diamond_cascade',
    name: 'Diamond Cascade',
    description: 'Precious gems rain from above',
    rarity: 'legendary',
    duration: 5000,
    phaseTimings: { intro: 1000, main: 3200, outro: 800 },
    threeConfig: {
      fog: { color: '#1a1a3a', near: 1, far: 35 },
      lights: [
        { type: 'ambient', color: '#2a2a4a', intensity: 0.4 },
        { type: 'point', color: '#ffffff', intensity: 3, position: { x: 0, y: 5, z: 5 } },
        { type: 'point', color: '#00ffff', intensity: 1.5, position: { x: -3, y: 3, z: 3 } },
        { type: 'point', color: '#ff00ff', intensity: 1.5, position: { x: 3, y: 3, z: 3 } },
      ],
      particleSystems: [
        {
          type: 'shard',
          count: 120,
          color: ['#ffffff', '#e6e6fa', '#b0e0e6', '#ff69b4'],
          size: { min: 0.1, max: 0.5 },
          velocity: { min: 4, max: 10 },
          lifetime: { min: 2500, max: 4500 },
          gravity: 1.5,
          spread: 12,
        },
        {
          type: 'sparkle',
          count: 80,
          color: '#ffffff',
          size: { min: 0.02, max: 0.15 },
          velocity: { min: 1, max: 5 },
          lifetime: { min: 1000, max: 2500 },
          gravity: -0.5,
          spread: 8,
        },
        {
          type: 'bubble',
          count: 30,
          color: 'rgba(255,255,255,0.3)',
          size: { min: 0.2, max: 0.8 },
          velocity: { min: 0.5, max: 2 },
          lifetime: { min: 2000, max: 4000 },
          gravity: -0.3,
          spread: 6,
        },
      ],
      shakeIntensity: 1,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: true,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/chime_cascade.mp3', volume: 0.5, fadeIn: 500 },
      { type: 'peak', src: '/sounds/entrance/diamond_shatter.mp3', volume: 0.9, delay: 1000 },
      { type: 'ambient', src: '/sounds/entrance/sparkle_loop.mp3', volume: 0.5, loop: true, fadeIn: 300 },
      { type: 'outro', src: '/sounds/entrance/glass_harmony.mp3', volume: 0.4, fadeOut: 600 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'bounce',
      style: 'royal',
    },
    category: 'luxury',
    coinCost: 5000,
  },

  'vip_siren': {
    id: 'vip_siren',
    name: 'VIP Siren Rush',
    description: 'Police escort to the VIP section',
    rarity: 'legendary',
    duration: 4500,
    phaseTimings: { intro: 500, main: 3500, outro: 500 },
    threeConfig: {
      fog: { color: '#1a0a0a', near: 0.5, far: 40 },
      lights: [
        { type: 'ambient', color: '#2a1a1a', intensity: 0.3 },
        { type: 'point', color: '#ff0000', intensity: 4, position: { x: -5, y: 2, z: 0 } },
        { type: 'point', color: '#0000ff', intensity: 4, position: { x: 5, y: 2, z: 0 } },
      ],
      particleSystems: [
        {
          type: 'lightning',
          count: 100,
          color: ['#ff0000', '#0000ff', '#ffffff'],
          size: { min: 0.05, max: 0.25 },
          velocity: { min: 8, max: 20 },
          lifetime: { min: 200, max: 600 },
          gravity: 0,
          spread: 10,
        },
        {
          type: 'sparkle',
          count: 50,
          color: '#ffd700',
          size: { min: 0.1, max: 0.3 },
          velocity: { min: 2, max: 6 },
          lifetime: { min: 800, max: 2000 },
          gravity: 0.5,
          spread: 8,
        },
      ],
      shakeIntensity: 2,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: false,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/siren_start.mp3', volume: 0.6 },
      { type: 'peak', src: '/sounds/entrance/siren_loop.mp3', volume: 0.8, delay: 500, loop: true },
      { type: 'outro', src: '/sounds/entrance/siren_fade.mp3', volume: 0.5, fadeOut: 400 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'slide',
      style: 'royal',
    },
    category: 'vip',
    coinCost: 7500,
  },

  // ==========================================
  // MYTHIC EFFECTS (Ultimate, one-of-a-kind)
  // ==========================================
  'dragon_arrival': {
    id: 'dragon_arrival',
    name: 'Dragon Arrival',
    description: 'Ancient beast materializes from the void',
    rarity: 'mythic',
    duration: 6000,
    phaseTimings: { intro: 1500, main: 3500, outro: 1000 },
    threeConfig: {
      fog: { color: '#0a0a0a', near: 0.3, far: 50 },
      lights: [
        { type: 'ambient', color: '#1a0a05', intensity: 0.2 },
        { type: 'point', color: '#ff4500', intensity: 5, position: { x: 0, y: 3, z: 8 } },
        { type: 'point', color: '#ff8c00', intensity: 3, position: { x: -4, y: 2, z: 5 } },
        { type: 'point', color: '#8b0000', intensity: 2, position: { x: 4, y: 1, z: 6 } },
      ],
      particleSystems: [
        {
          type: 'fire',
          count: 200,
          color: ['#ff4500', '#ff8c00', '#ffd700', '#dc143c'],
          size: { min: 0.1, max: 0.8 },
          velocity: { min: 5, max: 15 },
          lifetime: { min: 1000, max: 3000 },
          gravity: -0.5,
          spread: 15,
        },
        {
          type: 'smoke',
          count: 100,
          color: ['#2f2f2f', '#1a1a1a', '#0a0a0a'],
          size: { min: 0.3, max: 1.5 },
          velocity: { min: 1, max: 4 },
          lifetime: { min: 2000, max: 5000 },
          gravity: 0.2,
          spread: 12,
        },
        {
          type: 'shard',
          count: 60,
          color: ['#ffd700', '#ff8c00', '#ff4500'],
          size: { min: 0.15, max: 0.6 },
          velocity: { min: 3, max: 12 },
          lifetime: { min: 1500, max: 3500 },
          gravity: 1,
          spread: 10,
        },
      ],
      shakeIntensity: 3,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: true,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/dragon_wing.mp3', volume: 0.7, fadeIn: 300 },
      { type: 'intro', src: '/sounds/entrance/dragon_roar.mp3', volume: 1, delay: 1200 },
      { type: 'peak', src: '/sounds/entrance/fire_breath.mp3', volume: 0.9, delay: 2500 },
      { type: 'ambient', src: '/sounds/entrance/dragon_hover.mp3', volume: 0.5, loop: true, fadeIn: 400 },
      { type: 'outro', src: '/sounds/entrance/dragon_flyaway.mp3', volume: 0.6, fadeOut: 800 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'bounce',
      style: 'royal',
    },
    category: 'mythical',
    coinCost: 15000,
  },

  // ==========================================
  // EXCLUSIVE EFFECTS (CEO/Admin only)
  // ==========================================
  'troll_city_ceo': {
    id: 'troll_city_ceo',
    name: 'Troll City CEO',
    description: 'The ultimate authority arrives',
    rarity: 'exclusive',
    duration: 8000,
    phaseTimings: { intro: 2000, main: 4500, outro: 1500 },
    threeConfig: {
      fog: { color: '#000000', near: 0.2, far: 60 },
      lights: [
        { type: 'ambient', color: '#0a0a0a', intensity: 0.1 },
        { type: 'spot', color: '#ffffff', intensity: 5, position: { x: 0, y: 20, z: 0 } },
        { type: 'point', color: '#dc2626', intensity: 4, position: { x: -6, y: 3, z: 8 } },
        { type: 'point', color: '#000000', intensity: 2, position: { x: 6, y: 2, z: 8 } },
        { type: 'point', color: '#ffd700', intensity: 3, position: { x: 0, y: 5, z: 12 } },
      ],
      particleSystems: [
        {
          type: 'money',
          count: 250,
          color: ['#dc2626', '#000000', '#333333', '#ff0000'],
          size: { min: 0.2, max: 0.6 },
          velocity: { min: 5, max: 12 },
          lifetime: { min: 3000, max: 6000 },
          gravity: 2,
          spread: 20,
        },
        {
          type: 'confetti',
          count: 150,
          color: ['#dc2626', '#000000', '#ffd700', '#ffffff'],
          size: { min: 0.1, max: 0.4 },
          velocity: { min: 3, max: 8 },
          lifetime: { min: 2000, max: 4000 },
          gravity: 1,
          spread: 15,
        },
        {
          type: 'sparkle',
          count: 100,
          color: '#ffd700',
          size: { min: 0.1, max: 0.5 },
          velocity: { min: 2, max: 8 },
          lifetime: { min: 1500, max: 3500 },
          gravity: -0.3,
          spread: 18,
        },
        {
          type: 'shard',
          count: 80,
          color: ['#dc2626', '#000000'],
          size: { min: 0.15, max: 0.5 },
          velocity: { min: 4, max: 15 },
          lifetime: { min: 2000, max: 4500 },
          gravity: 1.5,
          spread: 14,
        },
      ],
      shakeIntensity: 4,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: true,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/ceo_horn.mp3', volume: 0.8, fadeIn: 500 },
      { type: 'intro', src: '/sounds/entrance/authority_chant.mp3', volume: 0.6, delay: 1500 },
      { type: 'peak', src: '/sounds/entrance/stomp_boom.mp3', volume: 1, delay: 2000 },
      { type: 'ambient', src: '/sounds/entrance/ceo_theme.mp3', volume: 0.7, loop: true, fadeIn: 400 },
      { type: 'outro', src: '/sounds/entrance/fade_respect.mp3', volume: 0.5, fadeOut: 1000 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'typewriter',
      style: 'royal',
    },
    category: 'authority',
    coinCost: 100000,
    exclusive: true,
    roleRequirement: 'admin',
  },

  'admin_divine': {
    id: 'admin_divine',
    name: 'Divine Authority',
    description: 'God-tier admin entrance with void and lightning',
    rarity: 'exclusive',
    duration: 7000,
    phaseTimings: { intro: 2500, main: 3500, outro: 1000 },
    threeConfig: {
      fog: { color: '#000000', near: 0.1, far: 80 },
      lights: [
        { type: 'ambient', color: '#050505', intensity: 0.05 },
        { type: 'point', color: '#ffd700', intensity: 6, position: { x: 0, y: 0, z: 10 } },
        { type: 'point', color: '#9932cc', intensity: 4, position: { x: -8, y: 4, z: 6 } },
        { type: 'point', color: '#9932cc', intensity: 4, position: { x: 8, y: 4, z: 6 } },
      ],
      particleSystems: [
        {
          type: 'lightning',
          count: 180,
          color: ['#ffd700', '#ffffff', '#9932cc'],
          size: { min: 0.05, max: 0.3 },
          velocity: { min: 10, max: 40 },
          lifetime: { min: 100, max: 500 },
          gravity: 0,
          spread: 25,
        },
        {
          type: 'star',
          count: 120,
          color: ['#ffd700', '#ffffff'],
          size: { min: 0.1, max: 0.6 },
          velocity: { min: 3, max: 12 },
          lifetime: { min: 2000, max: 5000 },
          gravity: -0.2,
          spread: 20,
        },
        {
          type: 'sparkle',
          count: 150,
          color: ['#ffd700', '#9932cc', '#ffffff'],
          size: { min: 0.05, max: 0.3 },
          velocity: { min: 2, max: 10 },
          lifetime: { min: 1500, max: 4000 },
          gravity: -0.1,
          spread: 22,
        },
      ],
      shakeIntensity: 5,
      postProcessing: {
        bloom: true,
        motionBlur: true,
        chromaticAberration: true,
      },
    },
    sounds: [
      { type: 'intro', src: '/sounds/entrance/void_hum.mp3', volume: 0.5, fadeIn: 800 },
      { type: 'intro', src: '/sounds/entrance/lightning_build.mp3', volume: 0.7, delay: 1000 },
      { type: 'peak', src: '/sounds/entrance/thunder_crack_god.mp3', volume: 1, delay: 2500 },
      { type: 'peak', src: '/sounds/entrance/shockwave.mp3', volume: 0.9, delay: 3500 },
      { type: 'ambient', src: '/sounds/entrance/divine_presence.mp3', volume: 0.6, loop: true, fadeIn: 500 },
      { type: 'outro', src: '/sounds/entrance/ascend_harmony.mp3', volume: 0.5, fadeOut: 800 },
    ],
    usernameDisplay: {
      position: 'center',
      animation: 'bounce',
      style: 'royal',
    },
    category: 'divine',
    coinCost: 100000,
    exclusive: true,
    roleRequirement: 'admin',
  },
};

// Helper function to get effect by ID
export function getEntranceEffect(id: string): EntranceEffectConfig | null {
  return ENTRANCE_EFFECTS[id] || null;
}

// Helper to get all effects
export function getAllEntranceEffects(): EntranceEffectConfig[] {
  return Object.values(ENTRANCE_EFFECTS);
}

// Helper to get effects by rarity
export function getEntranceEffectsByRarity(rarity: string): EntranceEffectConfig[] {
  return Object.values(ENTRANCE_EFFECTS).filter(e => e.rarity === rarity);
}
