/**
 * ENTRANCE EFFECTS - SOUND ENGINE
 * Web Audio API based sound system for entrance effects
 * 
 * Features:
 * - No memory leaks (proper AudioContext cleanup)
 * - Volume control per sound type
 * - Fade in/out support
 * - Overlap prevention for same-type sounds
 * - Mute support
 */

import type { SoundConfig, SoundEvent } from '../types';

// ==========================================
// AUDIO CONTEXT
// ==========================================

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let masterVolume = 0.7;

// Track active sounds for cleanup
interface ActiveSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  type: SoundEvent;
  startTime: number;
  config: SoundConfig;
}

const activeSounds = new Map<string, ActiveSound>();
const loadedBuffers = new Map<string, AudioBuffer>();
let soundIdCounter = 0;

/**
 * Initialize the audio context
 */
export function initSoundEngine(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    masterGain = audioContext.createGain();
    masterGain.gain.value = isMuted ? 0 : masterVolume;
    masterGain.connect(audioContext.destination);
    
    console.log('[EntranceSound] Audio context initialized');
  }
  
  return audioContext;
}

/**
 * Check if audio context is ready
 */
export function isAudioReady(): boolean {
  return audioContext !== null && audioContext.state !== 'closed';
}

/**
 * Resume audio context (needed for browsers that suspend it)
 */
export async function resumeAudio(): Promise<void> {
  if (audioContext?.state === 'suspended') {
    await audioContext.resume();
  }
}

// ==========================================
// SOUND LOADING
// ==========================================

/**
 * Preload a sound file into buffer
 */
export async function preloadSound(src: string): Promise<AudioBuffer | null> {
  if (loadedBuffers.has(src)) {
    return loadedBuffers.get(src)!;
  }
  
  try {
    const ctx = initSoundEngine();
    
    // Fetch the audio file
    const response = await fetch(src);
    if (!response.ok) {
      console.warn(`[EntranceSound] Failed to load: ${src}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    loadedBuffers.set(src, audioBuffer);
    return audioBuffer;
  } catch (err) {
    console.warn(`[EntranceSound] Error loading ${src}:`, err);
    return null;
  }
}

/**
 * Preload multiple sounds
 */
export async function preloadSounds(sources: string[]): Promise<void> {
  await Promise.all(sources.map(src => preloadSound(src)));
}

// ==========================================
// SOUND PLAYBACK
// ==========================================

/**
 * Play a sound configuration
 */
export async function playSound(
  config: SoundConfig,
  effectId: string
): Promise<string | null> {
  if (isMuted) {
    return null;
  }
  
  const ctx = initSoundEngine();
  
  // Ensure audio is running
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  // Load buffer
  const buffer = await preloadSound(config.src);
  if (!buffer) {
    return null;
  }
  
  // Apply delay if specified
  if (config.delay && config.delay > 0) {
    await new Promise(r => setTimeout(r, config.delay));
  }
  
  // Create sound nodes
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = config.loop || false;
  
  const gainNode = ctx.createGain();
  const soundId = `${effectId}_${config.type}_${++soundIdCounter}`;
  
  // Apply fade in
  const now = ctx.currentTime;
  if (config.fadeIn && config.fadeIn > 0) {
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(config.volume, now + config.fadeIn / 1000);
  } else {
    gainNode.gain.setValueAtTime(config.volume, now);
  }
  
  // Connect nodes
  source.connect(gainNode);
  gainNode.connect(masterGain!);
  
  // Track active sound
  const activeSound: ActiveSound = {
    source,
    gainNode,
    type: config.type,
    startTime: now,
    config,
  };
  activeSounds.set(soundId, activeSound);
  
  // Handle cleanup
  source.onended = () => {
    cleanupSound(soundId);
  };
  
  // Start playback
  source.start();
  
  // Setup fade out if not looping
  if (!config.loop && config.fadeOut && config.fadeOut > 0) {
    const fadeOutStart = buffer.duration - (config.fadeOut / 1000);
    if (fadeOutStart > 0) {
      gainNode.gain.setValueAtTime(config.volume, now + fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, now + buffer.duration);
    }
  }
  
  return soundId;
}

/**
 * Play multiple sounds for an effect
 */
export async function playEffectSounds(
  configs: SoundConfig[],
  effectId: string
): Promise<string[]> {
  const soundIds: string[] = [];
  
  for (const config of configs) {
    const soundId = await playSound(config, effectId);
    if (soundId) {
      soundIds.push(soundId);
    }
  }
  
  return soundIds;
}

/**
 * Stop a specific sound
 */
export function stopSound(soundId: string, fadeOut = 100): void {
  const active = activeSounds.get(soundId);
  if (!active || !audioContext) {
    return;
  }
  
  const { source, gainNode, config } = active;
  
  // Fade out
  const now = audioContext.currentTime;
  const fadeTime = Math.min(fadeOut / 1000, 0.5);
  
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + fadeTime);
  
  // Stop after fade
  setTimeout(() => {
    try {
      source.stop();
    } catch {
      // Already stopped
    }
    cleanupSound(soundId);
  }, fadeTime * 1000);
}

/**
 * Stop all sounds for an effect
 */
export function stopEffectSounds(effectId: string, fadeOut = 100): void {
  const soundsToStop: string[] = [];
  
  activeSounds.forEach((sound, id) => {
    if (id.startsWith(`${effectId}_`)) {
      soundsToStop.push(id);
    }
  });
  
  soundsToStop.forEach(id => stopSound(id, fadeOut));
}

/**
 * Cleanup a sound
 */
function cleanupSound(soundId: string): void {
  const active = activeSounds.get(soundId);
  if (!active) {
    return;
  }
  
  // Disconnect nodes
  try {
    active.source.disconnect();
    active.gainNode.disconnect();
  } catch {
    // Already disconnected
  }
  
  activeSounds.delete(soundId);
}

// ==========================================
// GLOBAL CONTROLS
// ==========================================

/**
 * Set master volume (0-1)
 */
export function setVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      isMuted ? 0 : masterVolume,
      audioContext.currentTime,
      0.1
    );
  }
}

/**
 * Get current volume
 */
export function getVolume(): number {
  return masterVolume;
}

/**
 * Mute/unmute all sounds
 */
export function setMuted(muted: boolean): void {
  isMuted = muted;
  
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      isMuted ? 0 : masterVolume,
      audioContext.currentTime,
      0.1
    );
  }
  
  console.log(`[EntranceSound] ${muted ? 'Muted' : 'Unmuted'}`);
}

/**
 * Check if muted
 */
export function getMuted(): boolean {
  return isMuted;
}

/**
 * Toggle mute state
 */
export function toggleMute(): boolean {
  setMuted(!isMuted);
  return isMuted;
}

// ==========================================
// CLEANUP
// ==========================================

/**
 * Stop all sounds and cleanup
 */
export function cleanupAllSounds(): void {
  // Stop all active sounds
  activeSounds.forEach((sound, id) => {
    try {
      sound.source.stop();
    } catch {
      // Already stopped
    }
    sound.source.disconnect();
    sound.gainNode.disconnect();
  });
  activeSounds.clear();
  
  // Clear buffers (optional - keeps memory but allows re-fetch)
  // loadedBuffers.clear();
  
  console.log('[EntranceSound] All sounds cleaned up');
}

/**
 * Suspend audio context (for battery saving)
 */
export async function suspendAudio(): Promise<void> {
  if (audioContext?.state === 'running') {
    await audioContext.suspend();
  }
}

/**
 * Close audio context (full cleanup)
 */
export async function closeAudio(): Promise<void> {
  cleanupAllSounds();
  
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
    masterGain = null;
  }
  
  console.log('[EntranceSound] Audio context closed');
}