/**
 * ENTRANCE EFFECTS - MAIN OVERLAY COMPONENT
 * Production-grade entrance effects overlay
 * 
 * STRICT RULES:
 * - Only renders in broadcast, battle, trollpod contexts
 * - NEVER renders in Court or TCNN
 * - Uses Three.js for particles
 * - Web Audio API for sound
 * - Automatic cleanup on unmount
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  EntranceContext,
  AllowedEntranceContext,
  ActiveEntranceEffect,
  AnimationPhase,
} from '../types';
import {
  validateContext,
  subscribeToEffects,
  cancelEntranceEffect,
  registerThreeObject,
  getActiveEffect,
} from '../engine/queue';
import {
  initThreeEngine,
  cleanupThreeEngine,
  createParticleSystem,
  removeParticleSystem,
  addLights,
  removeLights,
  triggerScreenShake,
  isThreeReady,
} from '../engine/threeEngine';
import {
  initSoundEngine,
  playEffectSounds,
  stopEffectSounds,
  setMuted,
  getMuted,
} from '../engine/sound';
import { getEntranceEffect } from '../types/config';

// ==========================================
// PROPS
// ==========================================

interface EntranceEffectsOverlayProps {
  /** The context this overlay is rendered in */
  context: EntranceContext;
  
  /** Stream/Battle/Trollpod ID */
  contentId: string;
  
  /** Optional className for styling */
  className?: string;
  
  /** Quality preset */
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  
  /** Initial mute state */
  muted?: boolean;
}

// ==========================================
// COMPONENT
// ==========================================

export default function EntranceEffectsOverlay({
  context,
  contentId,
  className = '',
  quality = 'high',
  muted = false,
}: EntranceEffectsOverlayProps) {
  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isAllowed, setIsAllowed] = useState(false);
  const [activeEffect, setActiveEffect] = useState<ActiveEntranceEffect | null>(null);
  const [effectPhase, setEffectPhase] = useState<AnimationPhase | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Refs for cleanup
  const effectSubscriptionRef = useRef<(() => void) | null>(null);
  const activeLightsRef = useRef<string[]>([]);
  const activeParticleSystemsRef = useRef<string[]>([]);
  const currentEffectIdRef = useRef<string | null>(null);
  
  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  // Check context and initialize
  useEffect(() => {
    // STRICT: Validate context
    const allowed = validateContext(context);
    setIsAllowed(allowed);
    
    if (!allowed) {
      console.log(`[EntranceOverlay] BLOCKED in ${context} context`);
      return;
    }
    
    console.log(`[EntranceOverlay] INITIALIZED in ${context} context`);
    
    // Initialize engines
    const init = async () => {
      // Sound engine
      initSoundEngine();
      setMuted(muted);
      
      // Three.js engine (after container is mounted)
      if (threeContainerRef.current) {
        const success = initThreeEngine(threeContainerRef.current, quality);
        if (success) {
          setIsReady(true);
        }
      }
    };
    
    init();
    
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, quality, muted]);
  
  // ==========================================
  // EFFECT SUBSCRIPTION
  // ==========================================
  
  useEffect(() => {
    if (!isAllowed || !isReady) {
      return;
    }
    
    // Subscribe to effect events
    const unsubscribe = subscribeToEffects((event) => {
      switch (event.type) {
        case 'started':
          handleEffectStarted(event.effect);
          break;
        case 'phase':
          handleEffectPhase(event.effect, event.phase);
          break;
        case 'completed':
        case 'cancelled':
          if (event.effectId === currentEffectIdRef.current) {
            handleEffectEnded();
          }
          break;
        case 'cleanup':
          // Handled by queue system
          break;
      }
    });
    
    effectSubscriptionRef.current = unsubscribe;
    
    return () => {
      unsubscribe();
    };
  }, [isAllowed, isReady]);
  
  // ==========================================
  // EFFECT HANDLERS
  // ==========================================
  
  const handleEffectStarted = useCallback((effect: ActiveEntranceEffect) => {
    console.log(`[EntranceOverlay] Effect started: ${effect.queueItem.effect.name}`);
    
    currentEffectIdRef.current = effect.id;
    setActiveEffect(effect);
    setEffectPhase('intro');
    
    // Initialize Three.js scene
    initializeScene(effect);
    
    // Play sounds
    playEffectSounds(effect.queueItem.effect.sounds, effect.id);
    
    // Screen shake
    const shakeIntensity = effect.queueItem.effect.threeConfig.shakeIntensity || 0;
    if (shakeIntensity > 0) {
      triggerScreenShake(shakeIntensity, effect.queueItem.effect.duration);
    }
  }, []);
  
  const handleEffectPhase = useCallback((effect: ActiveEntranceEffect, phase: AnimationPhase) => {
    setEffectPhase(phase);
    
    // Phase-specific visual updates
    switch (phase) {
      case 'main':
        // Peak effects
        break;
      case 'outro':
        // Fade out particles
        break;
      case 'complete':
        handleEffectEnded();
        break;
    }
  }, []);
  
  const handleEffectEnded = useCallback(() => {
    // Stop sounds
    if (currentEffectIdRef.current) {
      stopEffectSounds(currentEffectIdRef.current, 500);
    }
    
    // Cleanup scene
    cleanupScene();
    
    // Clear state
    setActiveEffect(null);
    setEffectPhase(null);
    currentEffectIdRef.current = null;
  }, []);
  
  // ==========================================
  // SCENE MANAGEMENT
  // ==========================================
  
  const initializeScene = (effect: ActiveEntranceEffect) => {
    if (!isThreeReady()) {
      return;
    }
    
    const config = effect.queueItem.effect.threeConfig;
    
    // Add lights
    const lightIds = addLights(config);
    activeLightsRef.current = lightIds;
    
    // Create particle systems
    config.particleSystems?.forEach((particleConfig, index) => {
      const systemId = `${effect.id}_particles_${index}`;
      createParticleSystem(particleConfig, systemId);
      activeParticleSystemsRef.current.push(systemId);
      registerThreeObject(effect.id, systemId);
    });
  };
  
  const cleanupScene = () => {
    // Remove particle systems
    activeParticleSystemsRef.current.forEach(id => {
      removeParticleSystem(id);
    });
    activeParticleSystemsRef.current = [];
    
    // Remove lights
    removeLights(activeLightsRef.current);
    activeLightsRef.current = [];
  };
  
  const cleanup = () => {
    // Cancel any active effect
    if (currentEffectIdRef.current) {
      cancelEntranceEffect(currentEffectIdRef.current);
    }
    
    // Cleanup scene
    cleanupScene();
    
    // Unsubscribe
    effectSubscriptionRef.current?.();
    effectSubscriptionRef.current = null;
    
    // Cleanup engines
    cleanupThreeEngine();
  };
  
  // ==========================================
  // RENDER
  // ==========================================
  
  // STRICT: Don't render if context is blocked
  if (!isAllowed) {
    return null;
  }
  
  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden z-50 ${className}`}
    >
      {/* Three.js Canvas Container */}
      <div
        ref={threeContainerRef}
        className="absolute inset-0"
        style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.5s' }}
      />
      
      {/* Username Display */}
      <AnimatePresence>
        {activeEffect && effectPhase !== 'complete' && (
          <UsernameDisplay
            username={activeEffect.queueItem.user.username}
            effectName={activeEffect.queueItem.effect.name}
            rarity={activeEffect.queueItem.effect.rarity}
            config={activeEffect.queueItem.effect.usernameDisplay}
            phase={effectPhase}
          />
        )}
      </AnimatePresence>
      
      {/* Context Label (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 text-xs text-white/50 bg-black/30 px-2 py-1 rounded">
          {context} | {contentId}
        </div>
      )}
    </div>
  );
}

// ==========================================
// USERNAME DISPLAY SUBCOMPONENT
// ==========================================

interface UsernameDisplayProps {
  username: string;
  effectName: string;
  rarity: string;
  config: {
    position: 'top' | 'center' | 'bottom';
    animation: 'fade' | 'slide' | 'bounce' | 'typewriter';
    style: 'classic' | 'neon' | 'royal' | 'minimal';
  };
  phase: AnimationPhase | null;
}

function UsernameDisplay({
  username,
  effectName,
  rarity,
  config,
  phase,
}: UsernameDisplayProps) {
  // Position styles
  const positionClasses = {
    top: 'top-16',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-32',
  };
  
  // Animation variants
  const animationVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slide: {
      initial: { opacity: 0, x: -50 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 50 },
    },
    bounce: {
      initial: { opacity: 0, scale: 0.5, y: 50 },
      animate: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: { type: 'spring', damping: 12 }
      },
      exit: { opacity: 0, scale: 1.5, y: -50 },
    },
    typewriter: {
      initial: { opacity: 0, width: 0 },
      animate: { opacity: 1, width: 'auto' },
      exit: { opacity: 0 },
    },
  };
  
  // Style classes
  const styleClasses = {
    classic: 'bg-black/60 backdrop-blur-md border-white/20',
    neon: 'bg-black/80 backdrop-blur-lg border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.5)]',
    royal: 'bg-gradient-to-r from-purple-900/80 to-amber-900/80 backdrop-blur-lg border-amber-400/50',
    minimal: 'bg-transparent',
  };
  
  // Rarity colors
  const rarityColors: Record<string, string> = {
    common: 'text-zinc-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
    mythic: 'text-pink-400',
    exclusive: 'text-red-400',
  };
  
  const variants = animationVariants[config.animation];
  const positionClass = positionClasses[config.position];
  const styleClass = styleClasses[config.style];
  const rarityColor = rarityColors[rarity] || 'text-white';
  
  return (
    <motion.div
      className={`absolute left-1/2 -translate-x-1/2 ${positionClass} flex flex-col items-center`}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{ duration: 0.5 }}
    >
      {/* Main container */}
      <div
        className={`px-8 py-4 rounded-2xl border-2 ${styleClass}`}
      >
        {/* Username */}
        <motion.h2
          className="text-4xl font-black text-white text-center tracking-tight"
          style={{
            textShadow: config.style === 'neon' 
              ? '0 0 20px rgba(6,182,212,0.8)' 
              : '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {username}
        </motion.h2>
        
        {/* Effect name */}
        <motion.p
          className={`text-sm font-bold uppercase tracking-widest text-center mt-1 ${rarityColor}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {effectName}
        </motion.p>
        
        {/* Rarity badge */}
        <motion.div
          className="flex justify-center mt-2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${rarityColor} font-semibold`}>
            {rarity}
          </span>
        </motion.div>
      </div>
      
      {/* Phase indicator (for main phase) */}
      {phase === 'main' && (
        <motion.div
          className="mt-2 w-32 h-1 bg-white/20 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className={`h-full ${rarityColor.replace('text-', 'bg-')}`}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
