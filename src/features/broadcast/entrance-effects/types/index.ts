/**
 * ENTRANCE EFFECTS - TYPES
 * Production-grade type definitions for the entrance effects system
 * 
 * STRICT: Every entrance effect MUST have a defined context type.
 * BLOCKED contexts: Court, TCNN - never render entrance effects here.
 */

/** Valid contexts where entrance effects CAN be rendered */
export type AllowedEntranceContext = 'broadcast' | 'battle' | 'trollpod';

/** Blocked contexts - entrance effects will NEVER render here */
export type BlockedEntranceContext = 'court' | 'tcnn';

/** All possible contexts for validation */
export type EntranceContext = AllowedEntranceContext | BlockedEntranceContext;

/** Rarity tiers for entrance effects */
export type EntranceEffectRarity = 
  | 'common' 
  | 'uncommon' 
  | 'rare' 
  | 'epic' 
  | 'legendary' 
  | 'mythic' 
  | 'exclusive';

/** Sound event types */
export type SoundEvent = 
  | 'intro'      // Start of effect
  | 'peak'       // Peak moment
  | 'outro'      // End of effect
  | 'ambient';   // Background loop

/** Particle type for effects */
export type ParticleType =
  | 'sparkle'
  | 'fire'
  | 'smoke'
  | 'confetti'
  | 'money'
  | 'magic'
  | 'lightning'
  | 'star'
  | 'bubble'
  | 'shard';

/** Animation phases */
export type AnimationPhase = 'intro' | 'main' | 'outro' | 'complete';

/** Quality settings */
export type EffectQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * User entering with an effect
 */
export interface EntranceUser {
  id: string;
  username: string;
  avatarUrl?: string;
  role?: string;
  level?: number;
  entranceEffectId: string;
  joinedAt: number;
}

/**
 * Queue item for entrance effects
 */
export interface EntranceQueueItem {
  id: string;
  user: EntranceUser;
  effect: EntranceEffectConfig;
  priority: number;
  queuedAt: number;
  context: AllowedEntranceContext;
  metadata?: {
    battleId?: string;
    trollpodId?: string;
  };
}

/**
 * Active entrance effect instance
 */
export interface ActiveEntranceEffect {
  id: string;
  queueItem: EntranceQueueItem;
  phase: AnimationPhase;
  startedAt: number;
  estimatedEndAt: number;
  threeObjects?: Set<string>; // Track Three.js objects for cleanup
}

/**
 * Sound configuration for an effect
 */
export interface SoundConfig {
  type: SoundEvent;
  src: string;
  volume: number;      // 0-1
  delay?: number;      // ms before playing
  fadeIn?: number;     // ms
  fadeOut?: number;    // ms
  loop?: boolean;
}

/**
 * Particle configuration
 */
export interface ParticleConfig {
  type: ParticleType;
  count: number;
  color: string | string[];
  size: { min: number; max: number };
  velocity: { min: number; max: number };
  lifetime: { min: number; max: number }; // ms
  gravity?: number;
  spread: number;
}

/**
 * Three.js effect configuration
 */
export interface ThreeEffectConfig {
  cameraPosition?: { x: number; y: number; z: number };
  lookAt?: { x: number; y: number; z: number };
  fog?: {
    color: string;
    near: number;
    far: number;
  };
  lights?: Array<{
    type: 'ambient' | 'point' | 'spot' | 'directional';
    color: string;
    intensity: number;
    position?: { x: number; y: number; z: number };
  }>;
  particleSystems?: ParticleConfig[];
  shakeIntensity?: number; // Screen shake amount
  postProcessing?: {
    bloom?: boolean;
    motionBlur?: boolean;
    chromaticAberration?: boolean;
  };
}

/**
 * Complete entrance effect configuration
 */
export interface EntranceEffectConfig {
  id: string;
  name: string;
  description: string;
  rarity: EntranceEffectRarity;
  
  // Timing
  duration: number; // Total duration in ms
  phaseTimings: {
    intro: number;  // ms
    main: number;   // ms
    outro: number;  // ms
  };
  
  // Visual
  threeConfig: ThreeEffectConfig;
  
  // Audio
  sounds: SoundConfig[];
  
  // Display
  usernameDisplay: {
    position: 'top' | 'center' | 'bottom';
    animation: 'fade' | 'slide' | 'bounce' | 'typewriter';
    style: 'classic' | 'neon' | 'royal' | 'minimal';
  };
  
  // Metadata
  category: string;
  coinCost: number;
  exclusive?: boolean;
  levelRequirement?: number;
  roleRequirement?: string;
}

/**
 * Quality preset configurations
 */
export interface QualityPreset {
  maxParticles: number;
  enablePostProcessing: boolean;
  enableShadows: boolean;
  antialias: boolean;
  targetFPS: number;
  scale: number;
}

/**
 * System configuration
 */
export interface EntranceEffectsConfig {
  quality: EffectQuality;
  maxQueueSize: number;
  maxConcurrentEffects: number;
  minGapBetweenEffects: number; // ms
  autoAdjustQuality: boolean;
  muted: boolean;
  volume: number;
}

/**
 * Queue state
 */
export interface QueueState {
  items: EntranceQueueItem[];
  active: ActiveEntranceEffect | null;
  lastEffectEndTime: number;
  isProcessing: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  particleCount: number;
  drawCalls: number;
  memoryUsage: number;
}

/**
 * Debug info for dev mode
 */
export interface DebugInfo {
  queueState: QueueState;
  performance: PerformanceMetrics;
  config: EntranceEffectsConfig;
  recentEffects: string[];
  errors: string[];
}
