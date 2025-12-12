// Entrance Effects System
// Permanent purchases with activation/deactivation and stream entrance animations

import { supabase } from './supabase';

// Entrance Effects Configuration - Static data for all available effects
export const ENTRANCE_EFFECTS_CONFIG = {
  'effect_flame_burst': {
    name: 'Flame Burst',
    cost: 500,
    rarity: 'Rare',
    description: 'Enter with a burst of flames',
    animationType: 'flame',
    soundEffect: 'flame',
    durationSeconds: 3
  },
  'effect_money_shower': {
    name: 'Money Shower',
    cost: 1500,
    rarity: 'Epic',
    description: 'Rain money when you arrive',
    animationType: 'money_shower',
    soundEffect: 'coins',
    durationSeconds: 4
  },
  'effect_electric_flash': {
    name: 'Electric Flash',
    cost: 2800,
    rarity: 'Epic',
    description: 'Electric lightning entrance',
    animationType: 'electric',
    soundEffect: 'lightning',
    durationSeconds: 2
  },
  'effect_royal_throne': {
    name: 'Royal Throne',
    cost: 5200,
    rarity: 'Legendary',
    description: 'Descend on a royal throne',
    animationType: 'throne',
    soundEffect: 'fanfare',
    durationSeconds: 5
  },
  'effect_rainbow_descent': {
    name: 'Rainbow Descent',
    cost: 8500,
    rarity: 'Legendary',
    description: 'Arrive on a rainbow',
    animationType: 'rainbow',
    soundEffect: 'magical',
    durationSeconds: 4
  },
  'effect_troll_rollup': {
    name: 'Troll Roll-Up',
    cost: 12000,
    rarity: 'Mythic',
    description: 'Drive in with style',
    animationType: 'car',
    soundEffect: 'engine',
    durationSeconds: 6
  },
  'effect_vip_siren': {
    name: 'VIP Siren Rush',
    cost: 25000,
    rarity: 'Mythic',
    description: 'VIP siren announcement',
    animationType: 'siren',
    soundEffect: 'police',
    durationSeconds: 5
  },
  'effect_firework': {
    name: 'Firework Explosion',
    cost: 50000,
    rarity: 'Mythic',
    description: 'Explode onto the scene',
    animationType: 'firework',
    soundEffect: 'explosion',
    durationSeconds: 4
  },
  'effect_troll_king': {
    name: 'Troll King Arrival',
    cost: 100000,
    rarity: 'Exclusive',
    description: 'Ultimate king entrance',
    animationType: 'king',
    soundEffect: 'royal_fanfare',
    durationSeconds: 8
  }
} as const;

export type EntranceEffectKey = keyof typeof ENTRANCE_EFFECTS_CONFIG;

/**
 * Unified effect configuration type
 */
export interface EffectConfig {
  name: string;
  description: string;
  animationType: string;
  soundEffect: string;
  durationSeconds: number;
  priority?: number;
  cost?: number;
  rarity?: string;
}

/**
 * Role-based entrance effects - automatically triggered based on user role
 * These are not purchasable and override any purchased effects
 */
export const ROLE_BASED_ENTRANCE_EFFECTS: Record<string, EffectConfig> = {
  'admin': {
    name: 'Divine Arrival',
    description: 'God-tier entrance with overwhelming power',
    animationType: 'admin_divine',
    soundEffect: 'divine_bass',
    durationSeconds: 6,
    priority: 100 // Highest priority
  },
  'lead_troll_officer': {
    name: 'Elite Command',
    description: 'Prestigious entrance for lead officers',
    animationType: 'lead_officer_elite',
    soundEffect: 'elite_command',
    durationSeconds: 4,
    priority: 90
  },
  'troll_officer': {
    name: 'Authority Enforcement',
    description: 'Police-style entrance for officers',
    animationType: 'officer_authority',
    soundEffect: 'police_siren',
    durationSeconds: 3,
    priority: 80
  }
};

export type RoleBasedEffectKey = keyof typeof ROLE_BASED_ENTRANCE_EFFECTS;

/**
 * Check if user owns a specific entrance effect
 */
export async function userOwnsEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_entrance_effects')
      .select('id')
      .eq('user_id', userId)
      .eq('effect_id', effectKey)
      .maybeSingle();

    if (error) {
      console.error('Error checking effect ownership:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error checking entrance effect ownership:', err);
    return false;
  }
}

/**
 * Get all entrance effects owned by a user
 */
export async function getUserOwnedEffects(userId: string): Promise<EntranceEffectKey[]> {
  try {
    const { data, error } = await supabase
      .from('user_entrance_effects')
      .select('effect_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching owned effects:', error);
      return [];
    }

    return data?.map(item => item.effect_id as EntranceEffectKey) || [];
  } catch (err) {
    console.error('Error getting user owned effects:', err);
    return [];
  }
}

/**
 * Get user's active entrance effect
 */
export async function getUserActiveEffect(userId: string): Promise<EntranceEffectKey | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('active_entrance_effect')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active effect:', error);
      return null;
    }

    return data?.active_entrance_effect as EntranceEffectKey || null;
  } catch (err) {
    console.error('Error getting user active effect:', err);
    return null;
  }
}

/**
 * Purchase an entrance effect
 */
export async function purchaseEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<{success: boolean, error?: string}> {
  try {
    const effectConfig = ENTRANCE_EFFECTS_CONFIG[effectKey];
    if (!effectConfig) {
      return { success: false, error: 'Invalid entrance effect' };
    }

    // Check if user already owns it
    const alreadyOwns = await userOwnsEntranceEffect(userId, effectKey);
    if (alreadyOwns) {
      return { success: true, error: 'Already owned' };
    }

    // Check if user has enough coins
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return { success: false, error: 'User profile not found' };
    }

    if ((userProfile.paid_coin_balance || 0) < effectConfig.cost) {
      return { success: false, error: 'Not enough Troll Coins' };
    }

    // Deduct coins
    const { error: deductError } = await supabase.rpc('deduct_coins', {
      p_user_id: userId,
      p_amount: effectConfig.cost,
      p_coin_type: 'paid'
    });

    if (deductError) {
      console.error('Coin deduction error:', deductError);
      return { success: false, error: 'Failed to deduct coins' };
    }

    // Add ownership
    const { error: insertError } = await supabase
      .from('user_entrance_effects')
      .insert({
        user_id: userId,
        effect_id: effectKey,
        purchased_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Effect ownership error:', insertError);
      // Try to refund coins if ownership failed
      await supabase.rpc('add_coins', {
        p_user_id: userId,
        p_amount: effectConfig.cost,
        p_coin_type: 'paid'
      });
      return { success: false, error: 'Failed to add effect ownership' };
    }

    return { success: true };

  } catch (err) {
    console.error('Entrance effect purchase error:', err);
    return { success: false, error: 'Purchase failed' };
  }
}

/**
 * Set active entrance effect for a user
 */
export async function setActiveEntranceEffect(userId: string, effectKey: EntranceEffectKey | null): Promise<{success: boolean, error?: string}> {
  try {
    // If setting an effect, verify ownership
    if (effectKey) {
      const ownsEffect = await userOwnsEntranceEffect(userId, effectKey);
      if (!ownsEffect) {
        return { success: false, error: 'Effect not owned' };
      }
    }

    // Update active effect
    const { error } = await supabase
      .from('user_profiles')
      .update({
        active_entrance_effect: effectKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error setting active effect:', error);
      return { success: false, error: 'Failed to set active effect' };
    }

    return { success: true };

  } catch (err) {
    console.error('Error setting active entrance effect:', err);
    return { success: false, error: 'Failed to update active effect' };
  }
}

/**
 * Get entrance effect configuration
 */
export function getEntranceEffectConfig(effectKey: EntranceEffectKey): EffectConfig {
  return ENTRANCE_EFFECTS_CONFIG[effectKey] as EffectConfig;
}

/**
 * Get role-based entrance effect configuration
 */
export function getRoleBasedEffectConfig(role: string): EffectConfig | null {
  return ROLE_BASED_ENTRANCE_EFFECTS[role] || null;
}

/**
 * Determine which entrance effect to play for a user
 * Priority: Role-based effects > Purchased active effects > None
 */
export async function getUserEntranceEffect(userId: string): Promise<{
  effectKey: EntranceEffectKey | RoleBasedEffectKey | null;
  isRoleBased: boolean;
  config: any;
}> {
  try {
    // First check user's role for role-based effects
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (userProfile?.role && ROLE_BASED_ENTRANCE_EFFECTS[userProfile.role as RoleBasedEffectKey]) {
      const roleEffect = ROLE_BASED_ENTRANCE_EFFECTS[userProfile.role as RoleBasedEffectKey];
      return {
        effectKey: userProfile.role as RoleBasedEffectKey,
        isRoleBased: true,
        config: roleEffect
      };
    }

    // Fall back to purchased active effect
    const activeEffect = await getUserActiveEffect(userId);
    if (activeEffect) {
      return {
        effectKey: activeEffect,
        isRoleBased: false,
        config: getEntranceEffectConfig(activeEffect)
      };
    }

    return { effectKey: null, isRoleBased: false, config: null };
  } catch (err) {
    console.error('Error determining user entrance effect:', err);
    return { effectKey: null, isRoleBased: false, config: null };
  }
}

/**
 * Get all available entrance effects
 */
export function getAllEntranceEffects() {
  return Object.entries(ENTRANCE_EFFECTS_CONFIG).map(([key, config]) => ({
    key: key as EntranceEffectKey,
    ...config
  }));
}

/**
 * Check if user can afford an entrance effect
 */
export async function canAffordEntranceEffect(userId: string, effectKey: EntranceEffectKey): Promise<boolean> {
  try {
    const effectConfig = ENTRANCE_EFFECTS_CONFIG[effectKey];
    if (!effectConfig) return false;

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', userId)
      .single();

    return (userProfile?.paid_coin_balance || 0) >= effectConfig.cost;
  } catch (err) {
    console.error('Error checking affordability:', err);
    return false;
  }
}

/**
 * Trigger entrance effect for user entering a room/stream
 * Automatically determines the appropriate effect based on role hierarchy
 */
export async function triggerUserEntranceEffect(userId: string, targetElement?: HTMLElement): Promise<void> {
  try {
    const { effectKey, isRoleBased } = await getUserEntranceEffect(userId);

    if (effectKey) {
      // Import the animation function dynamically to avoid circular imports
      const { playEntranceAnimation } = await import('./entranceAnimations');
      await playEntranceAnimation(userId, effectKey, targetElement);

      console.log(`🎪 Triggered ${isRoleBased ? 'role-based' : 'purchased'} entrance effect: ${effectKey} for user ${userId}`);
    }
  } catch (err) {
    console.error('Error triggering entrance effect:', err);
  }
}