/**
 * ENTRANCE EFFECTS - QUEUE SYSTEM
 * Production-grade entrance effect queue with context validation
 * 
 * STRICT RULES:
 * - Court and TCNN contexts are EXPLICITLY BLOCKED
 * - Queue processes one effect at a time
 * - Minimum 500ms gap between effects
 * - Auto-cleanup of completed effects
 * - Memory leak prevention via Set tracking
 */

import type {
  EntranceQueueItem,
  ActiveEntranceEffect,
  AnimationPhase,
  AllowedEntranceContext,
  QueueState,
  EntranceEffectConfig,
} from '../types';
import { isContextBlocked, getEntranceEffect } from '../types/config';

// ==========================================
// QUEUE STATE
// ==========================================

const queueState: QueueState = {
  items: [],
  active: null,
  lastEffectEndTime: 0,
  isProcessing: false,
};

// Track cleanup functions to prevent memory leaks
const cleanupRegistry = new Map<string, () => void>();

// Track Three.js object references for disposal
const threeObjectRegistry = new Map<string, Set<string>>();

// ==========================================
// CONTEXT VALIDATION
// ==========================================

/**
 * Validates if entrance effects are allowed in the given context
 * STRICT: Court and TCNN are NEVER allowed
 */
export function validateContext(context: string): context is AllowedEntranceContext {
  if (isContextBlocked(context)) {
    console.warn(`[EntranceEffects] BLOCKED: Effects are not allowed in '${context}' context`);
    return false;
  }
  
  const allowed = ['broadcast', 'battle', 'trollpod'];
  if (!allowed.includes(context)) {
    console.warn(`[EntranceEffects] INVALID: Unknown context '${context}'`);
    return false;
  }
  
  return true;
}

/**
 * Validates an entrance effect configuration
 */
function validateEffectConfig(config: EntranceEffectConfig | null): boolean {
  if (!config) {
    console.error('[EntranceEffects] Invalid effect configuration: null');
    return false;
  }
  
  // Check required fields
  if (!config.id || !config.name || !config.duration) {
    console.error(`[EntranceEffects] Invalid effect configuration: missing required fields for ${config.id}`);
    return false;
  }
  
  // Validate phase timings sum to duration
  const phaseSum = config.phaseTimings.intro + config.phaseTimings.main + config.phaseTimings.outro;
  if (Math.abs(phaseSum - config.duration) > 100) {
    console.warn(`[EntranceEffects] Phase timings (${phaseSum}ms) don't match duration (${config.duration}ms) for ${config.id}`);
  }
  
  return true;
}

// ==========================================
// QUEUE OPERATIONS
// ==========================================

/**
 * Add an entrance effect to the queue
 * Returns true if added successfully, false if blocked
 */
export function queueEntranceEffect(
  userId: string,
  username: string,
  entranceEffectId: string,
  context: AllowedEntranceContext,
  metadata?: { battleId?: string; trollpodId?: string }
): boolean {
  // Validate context FIRST
  if (!validateContext(context)) {
    return false;
  }
  
  // Get effect configuration
  const effect = getEntranceEffect(entranceEffectId);
  if (!validateEffectConfig(effect)) {
    console.error(`[EntranceEffects] Cannot queue: Invalid effect ID '${entranceEffectId}'`);
    return false;
  }
  
  // Check queue size limit
  const MAX_QUEUE_SIZE = 5;
  if (queueState.items.length >= MAX_QUEUE_SIZE) {
    console.warn(`[EntranceEffects] Queue full (${MAX_QUEUE_SIZE}), dropping entrance for ${username}`);
    return false;
  }
  
  // Check if user already has an effect queued
  const existingIndex = queueState.items.findIndex(item => item.user.id === userId);
  if (existingIndex !== -1) {
    // Update with new effect if priority is higher
    const existing = queueState.items[existingIndex];
    const newPriority = getEffectPriority(effect);
    const oldPriority = getEffectPriority(existing.effect);
    
    if (newPriority > oldPriority) {
      // Replace with higher priority effect
      queueState.items.splice(existingIndex, 1);
      console.log(`[EntranceEffects] Replaced lower priority effect for ${username}`);
    } else {
      console.log(`[EntranceEffects] Duplicate entrance ignored for ${username}`);
      return false;
    }
  }
  
  // Create queue item
  const queueItem: EntranceQueueItem = {
    id: `entrance_${userId}_${Date.now()}`,
    user: {
      id: userId,
      username,
      entranceEffectId,
      joinedAt: Date.now(),
    },
    effect: effect!,
    priority: getEffectPriority(effect!),
    queuedAt: Date.now(),
    context,
    metadata,
  };
  
  // Add to queue sorted by priority (highest first)
  queueState.items.push(queueItem);
  queueState.items.sort((a, b) => b.priority - a.priority);
  
  console.log(`[EntranceEffects] Queued: ${effect!.name} for ${username} in ${context}`);
  
  // Try to process immediately
  processQueue();
  
  return true;
}

/**
 * Calculate effect priority based on rarity
 */
function getEffectPriority(effect: EntranceEffectConfig): number {
  const rarityWeights: Record<string, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
    exclusive: 7,
  };
  
  const basePriority = rarityWeights[effect.rarity] || 1;
  const ageBonus = effect.exclusive ? 10 : 0;
  
  return basePriority + ageBonus;
}

/**
 * Process the queue
 */
function processQueue(): void {
  if (queueState.isProcessing) {
    return;
  }
  
  if (queueState.items.length === 0) {
    return;
  }
  
  // Check gap between effects
  const now = Date.now();
  const gapNeeded = 500; // ms
  const timeSinceLastEffect = now - queueState.lastEffectEndTime;
  
  if (timeSinceLastEffect < gapNeeded) {
    // Schedule processing after gap
    setTimeout(processQueue, gapNeeded - timeSinceLastEffect);
    return;
  }
  
  // Get next item
  const nextItem = queueState.items.shift();
  if (!nextItem) {
    return;
  }
  
  // Validate context again (safety check)
  if (!validateContext(nextItem.context)) {
    // Re-add to queue with lower priority (will be processed later if context changes)
    nextItem.priority -= 1;
    queueState.items.push(nextItem);
    queueState.items.sort((a, b) => b.priority - a.priority);
    
    // Try next item
    processQueue();
    return;
  }
  
  // Start the effect
  startEffect(nextItem);
}

/**
 * Start an entrance effect
 */
function startEffect(queueItem: EntranceQueueItem): void {
  queueState.isProcessing = true;
  
  const effectId = queueItem.id;
  const duration = queueItem.effect.duration;
  
  // Initialize Three.js object tracking
  threeObjectRegistry.set(effectId, new Set());
  
  // Create active effect record
  const activeEffect: ActiveEntranceEffect = {
    id: effectId,
    queueItem,
    phase: 'intro',
    startedAt: Date.now(),
    estimatedEndAt: Date.now() + duration,
    threeObjects: threeObjectRegistry.get(effectId),
  };
  
  queueState.active = activeEffect;
  
  console.log(`[EntranceEffects] START: ${queueItem.effect.name} for ${queueItem.user.username}`);
  
  // Setup phase transitions
  setupPhaseTransitions(activeEffect);
  
  // Notify listeners
  notifyEffectStarted(activeEffect);
}

/**
 * Setup phase timing transitions
 */
function setupPhaseTransitions(activeEffect: ActiveEntranceEffect): void {
  const { intro, main } = activeEffect.queueItem.effect.phaseTimings;
  
  // Intro -> Main phase
  const introTimeout = setTimeout(() => {
    activeEffect.phase = 'main';
    notifyPhaseChanged(activeEffect, 'main');
  }, intro);
  
  // Main -> Outro phase
  const mainTimeout = setTimeout(() => {
    activeEffect.phase = 'outro';
    notifyPhaseChanged(activeEffect, 'outro');
  }, intro + main);
  
  // Complete effect
  const completeTimeout = setTimeout(() => {
    completeEffect(activeEffect.id);
  }, activeEffect.queueItem.effect.duration);
  
  // Register cleanup
  cleanupRegistry.set(activeEffect.id, () => {
    clearTimeout(introTimeout);
    clearTimeout(mainTimeout);
    clearTimeout(completeTimeout);
  });
}

/**
 * Complete an entrance effect
 */
function completeEffect(effectId: string): void {
  const active = queueState.active;
  if (!active || active.id !== effectId) {
    return;
  }
  
  active.phase = 'complete';
  notifyPhaseChanged(active, 'complete');
  
  console.log(`[EntranceEffects] COMPLETE: ${active.queueItem.effect.name} for ${active.queueItem.user.username}`);
  
  // Run cleanup
  runCleanup(effectId);
  
  // Update state
  queueState.active = null;
  queueState.lastEffectEndTime = Date.now();
  queueState.isProcessing = false;
  
  // Process next item
  setTimeout(processQueue, 0);
}

/**
 * Cancel an active effect
 */
export function cancelEntranceEffect(effectId?: string): void {
  const targetId = effectId || queueState.active?.id;
  if (!targetId) {
    return;
  }
  
  console.log(`[EntranceEffects] CANCEL: ${targetId}`);
  
  // Run cleanup
  runCleanup(targetId);
  
  // Remove from queue if pending
  queueState.items = queueState.items.filter(item => item.id !== targetId);
  
  // Clear active if matches
  if (queueState.active?.id === targetId) {
    queueState.active = null;
    queueState.isProcessing = false;
    queueState.lastEffectEndTime = Date.now();
  }
  
  // Notify
  notifyEffectCancelled(targetId);
  
  // Process next
  setTimeout(processQueue, 0);
}

/**
 * Run cleanup for an effect
 */
function runCleanup(effectId: string): void {
  // Run registered cleanup
  const cleanup = cleanupRegistry.get(effectId);
  if (cleanup) {
    cleanup();
    cleanupRegistry.delete(effectId);
  }
  
  // Cleanup Three.js objects
  const threeObjects = threeObjectRegistry.get(effectId);
  if (threeObjects) {
    // Notify engine to dispose objects
    notifyThreeCleanup(effectId, threeObjects);
    threeObjectRegistry.delete(effectId);
  }
}

/**
 * Register a Three.js object for cleanup
 */
export function registerThreeObject(effectId: string, objectId: string): void {
  const objects = threeObjectRegistry.get(effectId);
  if (objects) {
    objects.add(objectId);
  }
}

/**
 * Force clear all effects (emergency)
 */
export function clearAllEffects(): void {
  console.log('[EntranceEffects] EMERGENCY CLEAR: All effects cancelled');
  
  // Cancel active
  if (queueState.active) {
    cancelEntranceEffect(queueState.active.id);
  }
  
  // Clear queue
  queueState.items.forEach(item => {
    runCleanup(item.id);
  });
  queueState.items = [];
  
  // Reset state
  queueState.lastEffectEndTime = Date.now();
  queueState.isProcessing = false;
}

// ==========================================
// OBSERVER PATTERN
// ==========================================

type EffectEvent = 
  | { type: 'started'; effect: ActiveEntranceEffect }
  | { type: 'phase'; effect: ActiveEntranceEffect; phase: AnimationPhase }
  | { type: 'completed'; effectId: string }
  | { type: 'cancelled'; effectId: string }
  | { type: 'cleanup'; effectId: string; objects: Set<string> };

type EffectListener = (event: EffectEvent) => void;

const listeners: EffectListener[] = [];

export function subscribeToEffects(listener: EffectListener): () => void {
  listeners.push(listener);
  
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

function notifyEffectStarted(effect: ActiveEntranceEffect): void {
  const event: EffectEvent = { type: 'started', effect };
  listeners.forEach(l => l(event));
}

function notifyPhaseChanged(effect: ActiveEntranceEffect, phase: AnimationPhase): void {
  const event: EffectEvent = { type: 'phase', effect, phase };
  listeners.forEach(l => l(event));
}

function notifyEffectCancelled(effectId: string): void {
  const event: EffectEvent = { type: 'cancelled', effectId };
  listeners.forEach(l => l(event));
}

function notifyThreeCleanup(effectId: string, objects: Set<string>): void {
  const event: EffectEvent = { type: 'cleanup', effectId, objects };
  listeners.forEach(l => l(event));
}

// ==========================================
// GETTERS
// ==========================================

export function getQueueState(): QueueState {
  return { ...queueState };
}

export function getActiveEffect(): ActiveEntranceEffect | null {
  return queueState.active;
}

export function getQueueLength(): number {
  return queueState.items.length;
}

export function isEffectActive(): boolean {
  return queueState.isProcessing;
}