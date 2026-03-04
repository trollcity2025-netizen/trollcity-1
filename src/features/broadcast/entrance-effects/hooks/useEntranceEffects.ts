/**
 * ENTRANCE EFFECTS - HOOK
 * React hook for integrating entrance effects into components
 * 
 * Usage:
 * const { queueUserEntrance, isEffectActive, activeEffect } = useEntranceEffects('broadcast', streamId);
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import type {
  EntranceContext,
  AllowedEntranceContext,
  ActiveEntranceEffect,
  EntranceUser,
} from '../types';
import {
  queueEntranceEffect,
  subscribeToEffects,
  getActiveEffect,
  getQueueState,
  validateContext,
} from '../engine/queue';
import { getEntranceEffect } from '../types/config';

// ==========================================
// HOOK INTERFACE
// ==========================================

interface UseEntranceEffectsReturn {
  /** Queue a user's entrance effect */
  queueUserEntrance: (user: EntranceUser) => boolean;
  /** Check if entrance effects are supported in this context */
  isSupported: boolean;
  /** Currently active effect */
  activeEffect: ActiveEntranceEffect | null;
  /** Number of effects in queue */
  queueLength: number;
  /** Whether any effect is currently playing */
  isEffectActive: boolean;
  /** Error message if any */
  error: string | null;
}

// ==========================================
// HOOK IMPLEMENTATION
// ==========================================

export function useEntranceEffects(
  context: EntranceContext,
  contentId: string
): UseEntranceEffectsReturn {
  // Validate context on mount
  const isSupported = validateContext(context);
  
  // State
  const [activeEffect, setActiveEffect] = useState<ActiveEntranceEffect | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const subscriptionRef = useRef<(() => void) | null>(null);
  const processedUsersRef = useRef<Set<string>>(new Set());
  
  // ==========================================
  // EFFECT SUBSCRIPTION
  // ==========================================
  
  useEffect(() => {
    if (!isSupported) {
      return;
    }
    
    // Subscribe to effect events
    const unsubscribe = subscribeToEffects((event) => {
      switch (event.type) {
        case 'started':
          setActiveEffect(event.effect);
          break;
        case 'completed':
        case 'cancelled':
          setActiveEffect(current => 
            current?.id === event.effectId ? null : current
          );
          break;
      }
      
      // Update queue length
      setQueueLength(getQueueState().items.length);
    });
    
    subscriptionRef.current = unsubscribe;
    
    return () => {
      unsubscribe();
    };
  }, [isSupported]);
  
  // ==========================================
  // PRESENCE TRACKING
  // ==========================================
  
  useEffect(() => {
    if (!isSupported || !contentId) {
      return;
    }
    
    // Subscribe to presence for real-time entrance detection
    const channel = supabase.channel(`entrance:${context}:${contentId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const currentUserIds = new Set<string>();
        
        // Collect current users
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) {
              currentUserIds.add(p.user_id);
              
              // New user joined with entrance effect
              if (!processedUsersRef.current.has(p.user_id) && p.entrance_effect) {
                const user: EntranceUser = {
                  id: p.user_id,
                  username: p.username || 'Unknown',
                  avatarUrl: p.avatar_url,
                  role: p.role,
                  level: p.level,
                  entranceEffectId: p.entrance_effect,
                  joinedAt: Date.now(),
                };
                
                // Queue their entrance
                queueUserEntrance(user);
                processedUsersRef.current.add(p.user_id);
              }
            }
          });
        });
        
        // Clean up left users
        processedUsersRef.current.forEach(userId => {
          if (!currentUserIds.has(userId)) {
            processedUsersRef.current.delete(userId);
          }
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupported, context, contentId]);
  
  // ==========================================
  // QUEUE FUNCTION
  // ==========================================
  
  const queueUserEntrance = useCallback((user: EntranceUser): boolean => {
    if (!isSupported) {
      setError(`Entrance effects not supported in ${context} context`);
      return false;
    }
    
    // Validate effect exists
    const effect = getEntranceEffect(user.entranceEffectId);
    if (!effect) {
      console.warn(`[useEntranceEffects] Effect not found: ${user.entranceEffectId}`);
      return false;
    }
    
    // Queue the entrance
    const success = queueEntranceEffect(
      user.id,
      user.username,
      user.entranceEffectId,
      context as AllowedEntranceContext,
      {
        battleId: context === 'battle' ? contentId : undefined,
        trollpodId: context === 'trollpod' ? contentId : undefined,
      }
    );
    
    if (!success) {
      setError('Failed to queue entrance effect');
    } else {
      setError(null);
    }
    
    return success;
  }, [isSupported, context, contentId]);
  
  // ==========================================
  // RETURN
  // ==========================================
  
  return {
    queueUserEntrance,
    isSupported,
    activeEffect,
    queueLength,
    isEffectActive: !!activeEffect,
    error,
  };
}

// ==========================================
// HELPER HOOKS
// ==========================================

/**
 * Hook for getting a user's active entrance effect
 */
export function useUserEntranceEffect(userId: string | null): {
  effectId: string | null;
  loading: boolean;
  error: string | null;
} {
  const [effectId, setEffectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const fetchEffect = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('active_entrance_effect')
          .eq('id', userId)
          .single();
        
        if (error) {
          throw error;
        }
        
        setEffectId(data?.active_entrance_effect || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEffect();
  }, [userId]);
  
  return { effectId, loading, error };
}

/**
 * Hook for triggering an entrance effect manually
 */
export function useTriggerEntrance(context: EntranceContext, contentId: string) {
  const [isTriggering, setIsTriggering] = useState(false);
  
  const trigger = useCallback(async (
    userId: string,
    username: string,
    effectId: string
  ): Promise<boolean> => {
    setIsTriggering(true);
    
    const user: EntranceUser = {
      id: userId,
      username,
      entranceEffectId: effectId,
      joinedAt: Date.now(),
    };
    
    const success = queueEntranceEffect(
      user.id,
      user.username,
      user.entranceEffectId,
      context as AllowedEntranceContext,
      {
        battleId: context === 'battle' ? contentId : undefined,
        trollpodId: context === 'trollpod' ? contentId : undefined,
      }
    );
    
    setIsTriggering(false);
    return success;
  }, [context, contentId]);
  
  return { trigger, isTriggering };
}