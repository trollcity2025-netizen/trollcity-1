/**
 * ENTRANCE EFFECTS - DEBUG PANEL
 * Development-only debug interface for testing entrance effects
 *
 * Features:
 * - Trigger any effect manually
 * - Monitor queue state
 * - View performance metrics
 * - Context override for testing
 * - Run CoinStore purchase tests
 * - Only renders in development mode
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Activity, Settings, Play, Square, Volume2, VolumeX, X, TestTube } from 'lucide-react';
import type {
  EntranceEffectConfig,
  QueueState,
  PerformanceMetrics,
  EntranceContext,
} from '../types';
import { ENTRANCE_EFFECTS } from '../types/config';
import {
  queueEntranceEffect,
  cancelEntranceEffect,
  clearAllEffects,
  getQueueState,
  getActiveEffect,
  subscribeToEffects,
} from '../engine/queue';
import {
  getVolume,
  setVolume,
  getMuted,
  toggleMute,
  preloadSound,
} from '../engine/sound';

// ==========================================
// DEBUG PANEL COMPONENT
// ==========================================

interface DebugPanelProps {
  /** Current context (for testing blocked contexts) */
  currentContext: EntranceContext;
  /** Callback to change context for testing */
  onContextChange?: (context: EntranceContext) => void;
}

export default function EntranceEffectsDebugPanel({
  currentContext,
  onContextChange,
}: DebugPanelProps) {
  // State - must be called unconditionally
  const [isOpen, setIsOpen] = useState(false);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16,
    particleCount: 0,
    drawCalls: 0,
    memoryUsage: 0,
  });
  const [isMuted, setIsMuted] = useState(getMuted());
  const [volume, setVolumeState] = useState(getVolume());
  const [selectedUser, setSelectedUser] = useState('TestUser');
  const [testContext, setTestContext] = useState<EntranceContext>(currentContext);
  
  // Update queue state
  useEffect(() => {
    const updateState = () => {
      setQueueState(getQueueState());
    };
    
    updateState();
    
    // Subscribe to effect events
    const unsubscribe = subscribeToEffects((event) => {
      if (['started', 'completed', 'cancelled'].includes(event.type)) {
        updateState();
      }
    });
    
    // Polling for queue updates
    const interval = setInterval(updateState, 500);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);
  
  // FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const updateFPS = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastTime >= 1000) {
        const fps = frameCount;
        const frameTime = 1000 / fps;
        
        setMetrics(prev => ({
          ...prev,
          fps,
          frameTime,
        }));
        
        frameCount = 0;
        lastTime = now;
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    const rafId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);
  
  // Memory tracking
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1048576),
        }));
      }
    };
    
    const interval = setInterval(updateMemory, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Handlers
  const handleTriggerEffect = useCallback((effect: EntranceEffectConfig) => {
    const userId = `test_${Date.now()}`;
    
    queueEntranceEffect(
      userId,
      selectedUser,
      effect.id,
      testContext as any,
      { battleId: testContext === 'battle' ? 'test-battle' : undefined }
    );
  }, [selectedUser, testContext]);
  
  const handleCancelAll = useCallback(() => {
    clearAllEffects();
  }, []);
  
  const handleToggleMute = useCallback(() => {
    const muted = toggleMute();
    setIsMuted(muted);
  }, []);
  
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolumeState(vol);
    setVolume(vol);
  }, []);
  
  const handleContextChange = useCallback((context: EntranceContext) => {
    setTestContext(context);
    onContextChange?.(context);
  }, [onContextChange]);
  
  // Group effects by rarity
  const effectsByRarity = Object.values(ENTRANCE_EFFECTS).reduce((acc, effect) => {
    if (!acc[effect.rarity]) {
      acc[effect.rarity] = [];
    }
    acc[effect.rarity].push(effect);
    return acc;
  }, {} as Record<string, EntranceEffectConfig[]>);
  
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'exclusive'];
  
  // Only render in development - moved after all hooks
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const activeEffect = getActiveEffect();
  const isBlocked = testContext === 'court' || testContext === 'tcnn';
  
  return (
    <>
      {/* Toggle Button */}
      <motion.button
        className="fixed bottom-4 right-4 z-[100] bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>
      
      {/* Debug Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-20 right-4 z-[100] w-96 max-h-[80vh] bg-slate-900/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <h2 className="text-white font-bold">Entrance Effects Debug</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-60px)] p-4 space-y-4">
              
              {/* Context Selector */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Test Context</label>
                <div className="flex gap-2 flex-wrap">
                  {(['broadcast', 'battle', 'trollpod', 'court', 'tcnn'] as EntranceContext[]).map(ctx => (
                    <button
                      key={ctx}
                      onClick={() => handleContextChange(ctx)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        testContext === ctx
                          ? ctx === 'court' || ctx === 'tcnn'
                            ? 'bg-red-600 text-white'
                            : 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {ctx}
                    </button>
                  ))}
                </div>
                {isBlocked && (
                  <p className="text-red-400 text-xs">
                    ⚠️ Effects are BLOCKED in this context
                  </p>
                )}
              </div>
              
              {/* User Input */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Test Username</label>
                <input
                  type="text"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              
              {/* Audio Controls */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm flex items-center gap-2">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  Volume
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1"
                  />
                  <button
                    onClick={handleToggleMute}
                    className={`px-3 py-1 rounded text-xs ${
                      isMuted ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isMuted ? 'Muted' : 'On'}
                  </button>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-800 rounded p-2">
                  <p className="text-2xl font-bold text-green-400">{metrics.fps}</p>
                  <p className="text-xs text-slate-400">FPS</p>
                </div>
                <div className="bg-slate-800 rounded p-2">
                  <p className="text-2xl font-bold text-blue-400">{queueState?.items.length || 0}</p>
                  <p className="text-xs text-slate-400">Queue</p>
                </div>
                <div className="bg-slate-800 rounded p-2">
                  <p className="text-2xl font-bold text-purple-400">{metrics.memoryUsage}</p>
                  <p className="text-xs text-slate-400">MB</p>
                </div>
              </div>
              
              {/* Queue State */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 text-sm">Queue Status</label>
                  <button
                    onClick={handleCancelAll}
                    className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Square className="w-3 h-3" />
                    Cancel All
                  </button>
                </div>
                
                {activeEffect ? (
                  <div className="bg-purple-900/50 border border-purple-500/30 rounded p-3">
                    <p className="text-white font-medium">
                      {activeEffect.queueItem.user.username}
                    </p>
                    <p className="text-purple-300 text-sm">
                      {activeEffect.queueItem.effect.name}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Phase: {activeEffect.phase}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">No active effect</p>
                )}
                
                {queueState && queueState.items.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-slate-400 text-xs">Queued ({queueState.items.length}):</p>
                    {queueState.items.map((item, i) => (
                      <div
                        key={item.id}
                        className="bg-slate-800 rounded px-2 py-1 text-xs text-slate-300 flex items-center justify-between"
                      >
                        <span>{item.user.username} - {item.effect.name}</span>
                        <span className="text-slate-500">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Effect Triggers */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Trigger Effects
                </label>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {rarityOrder.map(rarity => {
                    const effects = effectsByRarity[rarity];
                    if (!effects || effects.length === 0) return null;
                    
                    return (
                      <div key={rarity} className="space-y-1">
                        <p className={`text-xs font-bold uppercase ${getRarityColor(rarity)}`}>
                          {rarity}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {effects.map(effect => (
                            <button
                              key={effect.id}
                              onClick={() => handleTriggerEffect(effect)}
                              disabled={isBlocked}
                              className={`text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                                isBlocked
                                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              <span>{effect.name}</span>
                              <span className="text-slate-500">{effect.duration}ms</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* CoinStore Purchase Tests */}
              <div className="pt-2 border-t border-slate-700">
                <label className="text-slate-400 text-sm flex items-center gap-2 mb-2">
                  <TestTube className="w-4 h-4" />
                  Purchase System Tests
                </label>
                <button
                  onClick={async () => {
                    try {
                      const { runAllPurchaseTests, validatePurchaseSystem } = await import('../test/CoinStorePurchaseTest');
                      
                      // First validate the system
                      const validation = await validatePurchaseSystem();
                      if (!validation.valid) {
                        console.warn('Purchase system validation issues:', validation.issues);
                      }
                      
                      // Run all tests
                      const results = await runAllPurchaseTests();
                      
                      // Show results in console and alert
                      console.log(results.report);
                      alert(`Purchase Tests Complete!\n\nPassed: ${results.summary.passed}\nFailed: ${results.summary.failed}\n\nCheck console for detailed report.`);
                    } catch (err: any) {
                      console.error('Test runner error:', err);
                      alert('Error running tests: ' + err.message);
                    }
                  }}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm flex items-center justify-center gap-2"
                >
                  <TestTube className="w-4 h-4" />
                  Run Purchase Tests
                </button>
              </div>

              {/* Preload Sounds */}
              <div className="pt-2 border-t border-slate-700">
                <button
                  onClick={async () => {
                    const allSounds = Object.values(ENTRANCE_EFFECTS)
                      .flatMap(e => e.sounds.map(s => s.src));
                    const unique = [...new Set(allSounds)];
                    await preloadSounds(unique);
                    alert(`Preloaded ${unique.length} sounds`);
                  }}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm"
                >
                  Preload All Sounds
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// HELPERS
// ==========================================

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'text-zinc-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
    mythic: 'text-pink-400',
    exclusive: 'text-red-400',
  };
  return colors[rarity] || 'text-slate-400';
}

async function preloadSounds(sources: string[]): Promise<void> {
  const { preloadSound } = await import('../engine/sound');
  await Promise.all(sources.map(src => preloadSound(src)));
}
