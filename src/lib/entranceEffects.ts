// Entrance Effects System
// Permanent purchases with activation/deactivation and stream entrance animations

import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

export interface EntranceEffect {
  id: string
  name: string
  icon: string
  description: string
  coin_cost: number
  rarity: string
  animation_type: string
  image_url: string
}

export const ENTRANCE_EFFECTS_DATA: EntranceEffect[] = [
  { id: 'e1', name: 'Troll Entrance (Classic)', icon: '🧌', description: 'Classic troll entrance', coin_cost: 10, rarity: 'EXCLUSIVE', animation_type: 'troll_classic', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=classic%20troll%20entrance%20neon%20aura&image_size=square' },
  { id: 'e2', name: 'Royal Sparkle Crown', icon: '👑', description: 'Royal crown sparkles', coin_cost: 5000, rarity: 'EPIC', animation_type: 'sparkle_crown', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20sparkle%20crown%20neon%20gold&image_size=square' },
  { id: 'e3', name: 'Neon Meteor Shower', icon: '☄️', description: 'Neon meteor shower', coin_cost: 10000, rarity: 'MYTHIC', animation_type: 'meteor_shower', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20meteor%20shower%20cosmic&image_size=square' },
  { id: 'e4', name: 'Lightning Strike Arrival', icon: '⚡', description: 'Lightning strike arrival', coin_cost: 7500, rarity: 'EPIC', animation_type: 'lightning_arrival', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lightning%20strike%20arrival%20neon&image_size=square' },
  { id: 'e5', name: 'Chaos Portal Arrival', icon: '🌀', description: 'Chaos portal arrival', coin_cost: 15000, rarity: 'LEGENDARY', animation_type: 'chaos_portal', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=chaos%20portal%20arrival%20neon%20warp&image_size=square' },
  { id: 'e6', name: 'Galactic Warp Beam', icon: '🛸', description: 'Galactic warp beam', coin_cost: 25000, rarity: 'ULTRA', animation_type: 'warp_beam', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=galactic%20warp%20beam%20neon&image_size=square' },
  { id: 'e7', name: 'Troll City VIP Flames', icon: '🔥', description: 'VIP flames', coin_cost: 35000, rarity: 'LEGENDARY+', animation_type: 'vip_flames', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=vip%20flames%20neon%20crown&image_size=square' },
  { id: 'e8', name: 'Flaming Gold Crown Drop', icon: '👑', description: 'Flaming gold crown drop', coin_cost: 50000, rarity: 'EXOTIC', animation_type: 'gold_crown_drop', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=flaming%20gold%20crown%20drop&image_size=square' },
  { id: 'e9', name: 'Aurora Storm Entrance', icon: '🌌', description: 'Aurora storm entrance', coin_cost: 75000, rarity: 'MYTHIC', animation_type: 'aurora_storm', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=aurora%20storm%20entrance&image_size=square' },
  { id: 'e10', name: 'Black Hole Vortex', icon: '🕳️', description: 'Black hole vortex', coin_cost: 100000, rarity: 'ULTRA', animation_type: 'black_hole', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=black%20hole%20vortex%20neon&image_size=square' },
  { id: 'e11', name: 'Money Shower Madness', icon: '💸', description: 'Money shower madness', coin_cost: 125000, rarity: 'RARE+', animation_type: 'money_shower', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=money%20shower%20madness%20neon&image_size=square' },
  { id: 'e12', name: 'Floating Royal Throne', icon: '👑', description: 'Floating royal throne', coin_cost: 150000, rarity: 'MYTHIC', animation_type: 'royal_throne', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20royal%20throne%20neon&image_size=square' },
  { id: 'e13', name: 'Platinum Fire Tornado', icon: '🔥', description: 'Platinum fire tornado', coin_cost: 200000, rarity: 'LEGENDARY++', animation_type: 'fire_tornado', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=platinum%20fire%20tornado%20neon&image_size=square' },
  { id: 'e14', name: 'Cosmic Crown Meteor Fall', icon: '☄️', description: 'Cosmic crown meteor fall', coin_cost: 250000, rarity: 'ULTRA', animation_type: 'crown_meteor', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cosmic%20crown%20meteor%20fall&image_size=square' },
  { id: 'e15', name: 'Royal Diamond Explosion', icon: '💎', description: 'Royal diamond explosion', coin_cost: 300000, rarity: 'EXOTIC', animation_type: 'diamond_explosion', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20diamond%20explosion%20neon&image_size=square' },
  { id: 'e16', name: 'Neon Chaos Warp', icon: '🌀', description: 'Neon chaos warp', coin_cost: 400000, rarity: 'MYTHIC', animation_type: 'chaos_warp', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20chaos%20warp&image_size=square' },
  { id: 'e17', name: 'Supreme Emerald Storm', icon: '💚', description: 'Supreme emerald storm', coin_cost: 500000, rarity: 'LEGENDARY++', animation_type: 'emerald_storm', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=supreme%20emerald%20storm%20neon&image_size=square' },
  { id: 'e18', name: 'Millionaire Troller Arrival', icon: '🤑', description: 'Millionaire troller arrival', coin_cost: 1000000, rarity: 'EXOTIC GOLD', animation_type: 'millionaire_arrival', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=millionaire%20troller%20arrival%20neon&image_size=square' },
  { id: 'e19', name: 'Troll God Ascension', icon: '🧌', description: 'Troll god ascension', coin_cost: 2500000, rarity: 'DIVINE', animation_type: 'god_ascension', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=troll%20god%20ascension%20neon&image_size=square' },
  { id: 'e20', name: 'Troll City World Domination', icon: '🌍', description: 'World domination', coin_cost: 5000000, rarity: 'UNOBTAINABLE', animation_type: 'world_domination', image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=world%20domination%20neon&image_size=square' },
];

export const ENTRANCE_EFFECTS_MAP = ENTRANCE_EFFECTS_DATA.reduce((acc, effect) => {
  acc[effect.id] = effect;
  return acc;
}, {} as Record<string, EntranceEffect>);

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
    name: 'Troll City CEO',
    description: 'Troll City CEO storms the screen with trolls and city lights',
    animationType: 'troll_city_ceo',
    soundEffect: 'city_siren',
    durationSeconds: 8,
    priority: 100
  },
  'secretary': {
    name: 'Cash Flow Entrance',
    description: 'Make it rain!',
    animationType: 'secretary_money',
    soundEffect: 'coins',
    durationSeconds: 5,
    priority: 85
  },
  'lead_troll_officer': {
    name: 'Presidential Salute',
    description: 'Hail to the Chief',
    animationType: 'lead_officer_presidential',
    soundEffect: 'elite_command',
    durationSeconds: 6,
    priority: 90
  },
  'troll_officer': {
    name: 'Police Raid',
    description: 'Freeze! Troll Police!',
    animationType: 'officer_police',
    soundEffect: 'elite_command',
    durationSeconds: 4,
    priority: 80
  }
};

/**
 * User-specific entrance effects - overrides everything else
 */
export const USER_SPECIFIC_ENTRANCE_EFFECTS: Record<string, EffectConfig> = {
  'JustK': {
    name: 'The Matrix Architect',
    description: 'Welcome to the real world.',
    animationType: 'matrix_theme',
    soundEffect: 'divine_bass',
    durationSeconds: 8,
    priority: 200
  },
  'Mitzie': {
    name: 'Feline Queen Arrival',
    description: 'Purr-fect entrance!',
    animationType: 'cat_theme',
    soundEffect: 'magical',
    durationSeconds: 6,
    priority: 200
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
      .select('troll_coins')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return { success: false, error: 'User profile not found' };
    }

    if ((userProfile.troll_coins || 0) < effectConfig.cost) {
      return { success: false, error: 'Not enough Troll Coins' };
    }

    const purchasedAt = new Date().toISOString();

    const flowResult = await runStandardPurchaseFlow({
      userId,
      amount: effectConfig.cost,
      transactionType: 'entrance_effect',
      description: `Purchased ${effectConfig.name} entrance effect`,
      metadata: {
        effect_id: effectKey,
        effect_name: effectConfig.name
      },
      ensureOwnership: async (client) => {
        const { error: insertError } = await client
          .from('user_entrance_effects')
          .insert({
            user_id: userId,
            effect_id: effectKey,
            purchased_at: purchasedAt
          });

        if (insertError) {
          console.error('Effect ownership error:', insertError);
          await client.rpc('add_coins', {
            p_user_id: userId,
            p_amount: effectConfig.cost,
            p_coin_type: 'paid'
          });
          return { success: false, error: 'Failed to add effect ownership' };
        }

        return { success: true };
      }
    });

    if (!flowResult.success) {
      return { success: false, error: flowResult.error || 'Purchase failed' };
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

    // Update active effect using RPC to ensure consistency across all tables
    const { error } = await supabase.rpc('set_active_entrance_effect', {
      p_effect_id: effectKey,
      p_item_type: 'effect'
    });

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

export async function toggleEntranceEffectByUuid(userId: string, itemUuid: string, active: boolean): Promise<{success: boolean, error?: string}> {
  try {
    const { error } = await supabase.rpc('toggle_entrance_effect', {
      p_user_id: userId,
      p_item_id: itemUuid,
      p_active: active
    })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle effect' }
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
      .select('troll_coins')
      .eq('id', userId)
      .single();

    return (userProfile?.troll_coins || 0) >= effectConfig.cost;
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
