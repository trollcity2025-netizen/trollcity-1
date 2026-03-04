/**
 * ENTRANCE EFFECTS - PUBLIC API
 * Main exports for the entrance effects system
 */

// ==========================================
// TYPES
// ==========================================
export type {
  EntranceContext,
  AllowedEntranceContext,
  BlockedEntranceContext,
  EntranceEffectRarity,
  SoundEvent,
  ParticleType,
  AnimationPhase,
  EffectQuality,
  EntranceUser,
  EntranceQueueItem,
  ActiveEntranceEffect,
  SoundConfig,
  ParticleConfig,
  ThreeEffectConfig,
  EntranceEffectConfig,
  QualityPreset,
  EntranceEffectsConfig,
  QueueState,
  PerformanceMetrics,
  DebugInfo,
} from './types';

// ==========================================
// CONFIG
// ==========================================
export {
  ENTRANCE_EFFECTS,
  QUALITY_PRESETS,
  DEFAULT_ENTRANCE_CONFIG,
  BLOCKED_CONTEXTS,
  getEntranceEffect,
  getAllEntranceEffects,
  getEntranceEffectsByRarity,
} from './types/config';

// ==========================================
// QUEUE ENGINE
// ==========================================
export {
  validateContext,
  queueEntranceEffect,
  cancelEntranceEffect,
  clearAllEffects,
  registerThreeObject,
  subscribeToEffects,
  getQueueState,
  getActiveEffect,
  getQueueLength,
  isEffectActive,
} from './engine/queue';

// ==========================================
// SOUND ENGINE
// ==========================================
export {
  initSoundEngine,
  isAudioReady,
  resumeAudio,
  preloadSound,
  preloadSounds,
  playSound,
  playEffectSounds,
  stopSound,
  stopEffectSounds,
  setVolume,
  getVolume,
  setMuted,
  getMuted,
  toggleMute,
  cleanupAllSounds,
  suspendAudio,
  closeAudio,
} from './engine/sound';

// ==========================================
// THREE.JS ENGINE
// ==========================================
export {
  initThreeEngine,
  createParticleSystem,
  removeParticleSystem,
  addLights,
  removeLights,
  triggerScreenShake,
  adjustQuality,
  setQuality,
  cleanupThreeEngine,
  isThreeReady,
  getRenderer,
  getScene,
  getFPS,
} from './engine/threeEngine';

// ==========================================
// COMPONENTS
// ==========================================
export { default as EntranceEffectsOverlay } from './components/EntranceEffectsOverlay';
export type { default as EntranceEffectsOverlayProps } from './components/EntranceEffectsOverlay';

// ==========================================
// HOOKS
// ==========================================
export {
  useEntranceEffects,
  useUserEntranceEffect,
  useTriggerEntrance,
} from './hooks/useEntranceEffects';

// ==========================================
// DEBUG (Development only)
// ==========================================
export { default as EntranceEffectsDebugPanel } from './debug/DebugPanel';
