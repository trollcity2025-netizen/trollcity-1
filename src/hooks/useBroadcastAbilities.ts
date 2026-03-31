// useBroadcastAbilities - Hook for managing broadcast ability inventory, activation, and effects
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import {
  AbilityId,
  UserAbility,
  BroadcastActiveEffect,
  AbilityLog,
  getAbilityById,
  BROADCAST_ABILITIES,
} from '../types/broadcastAbilities';

export function useBroadcastAbilities(streamId: string | undefined) {
  const { profile } = useAuthStore();
  const [abilities, setAbilities] = useState<UserAbility[]>([]);
  const [activeEffects, setActiveEffects] = useState<BroadcastActiveEffect[]>([]);
  const [recentLogs, setRecentLogs] = useState<AbilityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);

  // Load user's ability inventory
  const loadAbilities = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('user_abilities')
        .select('*')
        .eq('user_id', profile.id)
        .gt('quantity', 0)
        .order('won_at', { ascending: false });
      if (data) setAbilities(data);
    } catch (e) {
      console.warn('[Abilities] Failed to load:', e);
    }
  }, [profile?.id]);

  // Load active effects for this stream
  const loadActiveEffects = useCallback(async () => {
    if (!streamId) return;
    try {
      const { data } = await supabase
        .from('broadcast_active_effects')
        .select('*')
        .eq('stream_id', streamId)
        .gt('expires_at', new Date().toISOString())
        .order('started_at', { ascending: false });
      if (data) setActiveEffects(data);
    } catch (e) {
      console.warn('[Abilities] Failed to load effects:', e);
    }
  }, [streamId]);

  // Load recent ability logs for this stream
  const loadRecentLogs = useCallback(async () => {
    if (!streamId) return;
    try {
      const { data } = await supabase
        .from('broadcast_ability_logs')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setRecentLogs(data);
    } catch (e) {
      console.warn('[Abilities] Failed to load logs:', e);
    }
  }, [streamId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!streamId) return;

    loadAbilities();
    loadActiveEffects();
    loadRecentLogs();

    const channel = supabase.channel(`abilities:${streamId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'ability_activated' }, (payload: any) => {
        const effect = payload.effect as BroadcastActiveEffect;
        if (effect) {
          setActiveEffects(prev => [...prev.filter(e => e.ability_id !== effect.ability_id || e.activator_id !== effect.activator_id), effect]);
        }
      })
      .on('broadcast', { event: 'ability_ended' }, (payload: any) => {
        const { effectId } = payload;
        setActiveEffects(prev => prev.filter(e => e.id !== effectId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, loadAbilities, loadActiveEffects, loadRecentLogs]);

  // Add ability to inventory (for wheel wins)
  const addAbility = useCallback(async (abilityId: AbilityId) => {
    if (!profile?.id) return;
    try {
      await supabase.rpc('add_ability_to_inventory', {
        p_user_id: profile.id,
        p_ability_id: abilityId,
      });
      await loadAbilities();
    } catch (e) {
      console.warn('[Abilities] Failed to add:', e);
    }
  }, [profile?.id, loadAbilities]);

  // Use an ability
  const useAbility = useCallback(async (
    abilityId: AbilityId,
    targetUserId?: string,
    targetUsername?: string,
    extraData?: Record<string, any>
  ) => {
    if (!profile?.id || !streamId) {
      toast.error('Must be in a broadcast to use abilities');
      return false;
    }

    const abilityDef = getAbilityById(abilityId);
    if (!abilityDef) {
      toast.error('Unknown ability');
      return false;
    }

    // Check ownership
    const userAbility = abilities.find(a => a.ability_id === abilityId);
    if (!userAbility || userAbility.quantity <= 0) {
      toast.error(`You don't have ${abilityDef.name}`);
      return false;
    }

    // Check cooldown
    if (userAbility.cooldown_until && new Date(userAbility.cooldown_until) > new Date()) {
      const remaining = Math.ceil((new Date(userAbility.cooldown_until).getTime() - Date.now()) / 1000);
      toast.error(`${abilityDef.name} on cooldown (${remaining}s remaining)`);
      return false;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('use_broadcast_ability', {
        p_user_id: profile.id,
        p_ability_id: abilityId,
        p_stream_id: streamId,
        p_target_user_id: targetUserId || null,
        p_target_username: targetUsername || null,
        p_amount: extraData?.amount || null,
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || 'Failed to use ability');
        return false;
      }

      // Log the activation
      const logEntry = {
        stream_id: streamId,
        ability_id: abilityId,
        activator_id: profile.id,
        activator_username: profile.username || 'Unknown',
        target_user_id: targetUserId || null,
        target_username: targetUsername || null,
        amount: extraData?.amount || null,
      };
      await supabase.from('broadcast_ability_logs').insert(logEntry);

      // Create active effect
      const abilityDef2 = getAbilityById(abilityId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (abilityDef2?.durationSeconds || 30) * 1000);

      const effect: Omit<BroadcastActiveEffect, 'id'> = {
        stream_id: streamId,
        ability_id: abilityId,
        activator_id: profile.id,
        activator_username: profile.username || 'Unknown',
        target_user_id: targetUserId || null,
        target_username: targetUsername || null,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        data: extraData || {},
      };

      const { data: effectData } = await supabase
        .from('broadcast_active_effects')
        .insert(effect)
        .select()
        .single();

      if (effectData) {
        setActiveEffects(prev => [...prev, effectData]);

        // Broadcast to other viewers
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ability_activated',
            payload: { effect: effectData },
          });
        }
      }

      // Show system message
      const systemMsg = buildSystemMessage(abilityId, profile.username || 'Unknown', targetUsername, extraData);
      toast.success(systemMsg, { duration: 5000 });

      // Update local state
      await loadAbilities();
      await loadRecentLogs();

      return true;
    } catch (e: any) {
      console.error('[Abilities] Failed to use:', e);
      toast.error(e.message || 'Failed to use ability');
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile, streamId, abilities, loadAbilities, loadRecentLogs]);

  // Check if a specific effect is active
  const isEffectActive = useCallback((abilityId: AbilityId) => {
    return activeEffects.some(e => e.ability_id === abilityId && new Date(e.expires_at) > new Date());
  }, [activeEffects]);

  // Get remaining time for an effect
  const getEffectRemaining = useCallback((abilityId: AbilityId) => {
    const effect = activeEffects.find(e => e.ability_id === abilityId && new Date(e.expires_at) > new Date());
    if (!effect) return 0;
    return Math.max(0, Math.ceil((new Date(effect.expires_at).getTime() - Date.now()) / 1000));
  }, [activeEffects]);

  // Check cooldown for an ability
  const getCooldownRemaining = useCallback((abilityId: AbilityId) => {
    const userAbility = abilities.find(a => a.ability_id === abilityId);
    if (!userAbility?.cooldown_until) return 0;
    return Math.max(0, Math.ceil((new Date(userAbility.cooldown_until).getTime() - Date.now()) / 1000));
  }, [abilities]);

  return {
    abilities,
    activeEffects,
    recentLogs,
    loading,
    addAbility,
    useAbility,
    isEffectActive,
    getEffectRemaining,
    getCooldownRemaining,
    loadAbilities,
    loadActiveEffects,
  };
}

function buildSystemMessage(
  abilityId: AbilityId,
  activator: string,
  target?: string,
  extra?: Record<string, any>
): string {
  const at = `@${activator}`;
  const targetAt = target ? `@${target}` : '';
  switch (abilityId) {
    case 'mute_hammer': return `🔨 ${at} used Mute Hammer on ${targetAt}!`;
    case 'truth_serum': return `🧪 ${at} used Truth Serum on ${targetAt}!`;
    case 'fake_system_alert': return `🚨 ${at} triggered Fake System Alert on ${targetAt}!`;
    case 'gold_frame_broadcast': return `🖼️ ${at} activated Gold Frame Broadcast!`;
    case 'coin_drop_event': return `🪙 ${at} triggered a Coin Drop Event!`;
    case 'vip_chat_only': return `🔒 ${at} activated VIP Chat Only!`;
    case 'raid_another_stream': return `⚔️ ${at} is raiding another stream!`;
    case 'citywide_broadcast': return `🏙️ CITYWIDE ALERT: ${at} is now live!`;
    case 'troll_foot': return `🦶 ${at} activated Troll Foot! Cashback time!`;
    default: return `${at} activated an ability!`;
  }
}
