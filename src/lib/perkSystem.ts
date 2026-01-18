// Perk System Configuration and Logic
// Framework-agnostic but structured for React + Supabase

import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

// Perk configuration - static data describing all available perks
export const PERK_CONFIG = {
  'perk_disappear_chat': {
    name: 'Disappearing Chats (30m)',
    duration_minutes: 30,
    cost: 200,
    description: 'Your chats auto-hide after 10s for 30 minutes',
    type: 'visibility'
  },
  'perk_ghost_mode': {
    name: 'Ghost Mode (30m)',
    duration_minutes: 30,
    cost: 500,
    description: 'View streams in stealth without status indicators',
    type: 'visibility'
  },
  'perk_message_admin': {
    name: 'Message Admin (Officer Only)',
    duration_minutes: 10080, // 1 week
    cost: 300,
    description: 'Unlock DM to Admin',
    type: 'chat'
  },
  'perk_global_highlight': {
    name: 'Glowing Username (1h)',
    duration_minutes: 60,
    cost: 3000,
    description: 'Your username glows neon in all chats & gift animations',
    type: 'cosmetic'
  },
  'perk_rgb_username': {
    name: 'RGB Username (24h)',
    duration_minutes: 1440,
    cost: 5000,
    description: 'Rainbow username everywhere (24h)',
    type: 'cosmetic'
  },
  'perk_slowmo_chat': {
    name: 'Slow-Motion Chat Control (5hrs)',
    duration_minutes: 300,
    cost: 4000,
    description: 'Activate chat slow-mode in any live stream',
    type: 'chat'
  },
  'perk_troll_alarm': {
    name: 'Troll Alarm Arrival (100hrs)',
    duration_minutes: 6000,
    cost: 2500,
    description: 'Sound + flash announces your arrival',
    type: 'cosmetic'
  },
  'perk_ban_shield': {
    name: 'Ban Shield (2hrs)',
    duration_minutes: 120,
    cost: 1500,
    description: 'Immunity from kick, mute, or ban for 2 hours',
    type: 'protection'
  },
  'perk_double_xp': {
    name: 'Double XP Mode (1h)',
    duration_minutes: 60,
    cost: 800,
    description: 'Earn 2x XP for the next hour',
    type: 'boost'
  },
  'perk_flex_banner': {
    name: 'Golden Flex Banner (100h)',
    duration_minutes: 6000,
    cost: 3000,
    description: 'Golden crown banner on all your messages',
    type: 'cosmetic'
  },
  'perk_troll_spell': {
    name: 'Troll Spell (1h)',
    duration_minutes: 60,
    cost: 2000,
    description: 'Randomly change another user\'s username style & emoji for 100 hour',
    type: 'cosmetic'
  }
} as const;

export type PerkKey = keyof typeof PERK_CONFIG;

/**
 * Check if a perk is currently active for a user
 */
export async function isPerkActive(userId: string, perkKey: PerkKey): Promise<boolean> {
  try {
    const { data: perk, error } = await supabase
      .from('user_perks')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('perk_id', perkKey)
      .eq('is_active', true)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !perk) {
      return false;
    }

    return new Date(perk.expires_at) > new Date();
  } catch (err) {
    console.error('Error checking perk status:', err);
    return false;
  }
}

/**
 * Get all active perks for a user
 */
export async function getActivePerks(userId: string): Promise<Array<{perk_id: PerkKey, expires_at: string}>> {
  try {
    const { data: perks, error } = await supabase
      .from('user_perks')
      .select('perk_id, expires_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching active perks:', error);
      return [];
    }

    return perks || [];
  } catch (err) {
    console.error('Error getting active perks:', err);
    return [];
  }
}

/**
 * Purchase a perk for a user
 */
export async function purchasePerk(userId: string, perkKey: PerkKey, customOptions?: { glowColor?: string }): Promise<{success: boolean, error?: string, expiresAt?: string}> {
  try {
    const perkConfig = PERK_CONFIG[perkKey];
    if (!perkConfig) {
      return { success: false, error: 'Invalid perk' };
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

    if ((userProfile.troll_coins || 0) < perkConfig.cost) {
      return { success: false, error: 'Not enough Troll Coins' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + perkConfig.duration_minutes * 60 * 1000);

    const metadata: any = {
      perk_name: perkConfig.name,
      duration_minutes: perkConfig.duration_minutes
    };

    if (customOptions?.glowColor) {
      metadata.glowColor = customOptions.glowColor;
    }

    const flowResult = await runStandardPurchaseFlow({
      userId,
      amount: perkConfig.cost,
      transactionType: 'perk_purchase',
      description: `Purchased ${perkConfig.name} perk`,
      metadata: {
        perk_id: perkKey,
        perk_name: perkConfig.name,
        duration_minutes: perkConfig.duration_minutes
      },
      ensureOwnership: async (client) => {
        const { error: insertError } = await client
          .from('user_perks')
          .insert({
            user_id: userId,
            perk_id: perkKey,
            purchased_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            metadata: metadata
          });

        if (insertError) {
          console.error('Perk activation error:', insertError);
          await client.rpc('add_coins', {
            p_user_id: userId,
            p_amount: perkConfig.cost,
            p_coin_type: 'paid'
          });
          return { success: false, error: 'Failed to activate perk' };
        }

        if (perkKey === 'perk_rgb_username') {
          const { error: profileUpdateError } = await client
            .from('user_profiles')
            .update({ rgb_username_expires_at: expiresAt.toISOString() })
            .eq('id', userId);

          if (profileUpdateError) {
            console.error('Failed to update RGB username expiration in profile:', profileUpdateError);
          }
        }

        return { success: true };
      }
    });

    if (!flowResult.success) {
      return { success: false, error: flowResult.error || 'Purchase failed' };
    }

    return {
      success: true,
      expiresAt: expiresAt.toISOString()
    };

  } catch (err) {
    console.error('Perk purchase error:', err);
    return { success: false, error: 'Purchase failed' };
  }
}

/**
 * Get perk configuration by key
 */
export function getPerkConfig(perkKey: PerkKey) {
  return PERK_CONFIG[perkKey];
}

/**
 * Get all available perks
 */
export function getAllPerks() {
  return Object.entries(PERK_CONFIG).map(([key, config]) => ({
    key: key as PerkKey,
    ...config
  }));
}

/**
 * Format perk duration for display
 */
export function formatPerkDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) { // less than 24 hours
    return `${Math.round(minutes / 60)}h`;
  } else {
    return `${Math.round(minutes / 1440)}d`;
  }
}

/**
 * Check if user can afford a perk
 */
export async function canAffordPerk(userId: string, perkKey: PerkKey): Promise<boolean> {
  try {
    const perkConfig = PERK_CONFIG[perkKey];
    if (!perkConfig) return false;

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single();

    return (userProfile?.troll_coins || 0) >= perkConfig.cost;
  } catch (err) {
    console.error('Error checking affordability:', err);
    return false;
  }
}
