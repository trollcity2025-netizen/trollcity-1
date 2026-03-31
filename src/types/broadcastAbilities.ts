// Broadcast Abilities System - Types and Definitions
// Troll Wheel rare rewards that grant special broadcast powers

export type AbilityRarity = 'rare' | 'epic' | 'legendary';
export type AbilityType = 'targeted' | 'broadcast_wide' | 'chat_control' | 'economy' | 'gifting_buff';
export type AbilityId =
  | 'mute_hammer'
  | 'truth_serum'
  | 'fake_system_alert'
  | 'gold_frame_broadcast'
  | 'coin_drop_event'
  | 'vip_chat_only'
  | 'raid_another_stream'
  | 'citywide_broadcast'
  | 'troll_foot'
  | 'team_freeze'
  | 'reverse'
  | 'double_xp';

export interface BroadcastAbility {
  id: AbilityId;
  name: string;
  icon: string;
  description: string;
  rarity: AbilityRarity;
  abilityType: AbilityType;
  cooldownSeconds: number;
  durationSeconds: number;
  requiresTarget: boolean;
  wheelWeight: number; // lower = rarer
  color: string;
  glowColor: string;
}

export interface UserAbility {
  id: string;
  user_id: string;
  ability_id: AbilityId;
  quantity: number;
  cooldown_until: string | null;
  won_at: string;
  last_used_at: string | null;
}

export interface BroadcastActiveEffect {
  id: string;
  stream_id: string;
  ability_id: AbilityId;
  activator_id: string;
  activator_username: string;
  target_user_id: string | null;
  target_username: string | null;
  started_at: string;
  expires_at: string;
  data: Record<string, any>;
}

export interface AbilityLog {
  id: string;
  stream_id: string;
  ability_id: AbilityId;
  activator_id: string;
  activator_username: string;
  target_user_id: string | null;
  target_username: string | null;
  amount: number | null;
  created_at: string;
}

export const BROADCAST_ABILITIES: BroadcastAbility[] = [
  {
    id: 'mute_hammer',
    name: 'Mute Hammer',
    icon: '🔨',
    description: 'Silence a user in the broadcast for 60 seconds with a mighty hammer slam.',
    rarity: 'rare',
    abilityType: 'targeted',
    cooldownSeconds: 300,
    durationSeconds: 60,
    requiresTarget: true,
    wheelWeight: 8,
    color: '#ef4444',
    glowColor: '#f87171',
  },
  {
    id: 'truth_serum',
    name: 'Truth Serum',
    icon: '🧪',
    description: 'Force a user to answer a question within 30 seconds or be publicly shamed.',
    rarity: 'epic',
    abilityType: 'targeted',
    cooldownSeconds: 600,
    durationSeconds: 30,
    requiresTarget: true,
    wheelWeight: 4,
    color: '#22c55e',
    glowColor: '#4ade80',
  },
  {
    id: 'fake_system_alert',
    name: 'Fake System Alert',
    icon: '🚨',
    description: 'Trigger a fake warning banner targeting a user. Purely for fun!',
    rarity: 'rare',
    abilityType: 'targeted',
    cooldownSeconds: 180,
    durationSeconds: 15,
    requiresTarget: true,
    wheelWeight: 8,
    color: '#f59e0b',
    glowColor: '#fbbf24',
  },
  {
    id: 'gold_frame_broadcast',
    name: 'Gold Frame Broadcast',
    icon: '🖼️',
    description: 'Wrap the stream in a glowing premium gold frame for 2 minutes.',
    rarity: 'rare',
    abilityType: 'broadcast_wide',
    cooldownSeconds: 600,
    durationSeconds: 120,
    requiresTarget: false,
    wheelWeight: 8,
    color: '#eab308',
    glowColor: '#facc15',
  },
  {
    id: 'coin_drop_event',
    name: 'Coin Drop Event',
    icon: '🪙',
    description: 'Drop your Trollmonds for viewers to collect! Green = reward, Red = danger.',
    rarity: 'epic',
    abilityType: 'economy',
    cooldownSeconds: 900,
    durationSeconds: 30,
    requiresTarget: false,
    wheelWeight: 4,
    color: '#3b82f6',
    glowColor: '#60a5fa',
  },
  {
    id: 'vip_chat_only',
    name: 'VIP Chat Only',
    icon: '🔒',
    description: 'Restrict chat to VIPs only for 90 seconds.',
    rarity: 'epic',
    abilityType: 'chat_control',
    cooldownSeconds: 600,
    durationSeconds: 90,
    requiresTarget: false,
    wheelWeight: 4,
    color: '#8b5cf6',
    glowColor: '#a78bfa',
  },
  {
    id: 'raid_another_stream',
    name: 'Raid Another Stream',
    icon: '⚔️',
    description: 'Raid another live stream and send your viewers there with a portal effect.',
    rarity: 'epic',
    abilityType: 'broadcast_wide',
    cooldownSeconds: 1800,
    durationSeconds: 10,
    requiresTarget: false,
    wheelWeight: 4,
    color: '#ec4899',
    glowColor: '#f472b6',
  },
  {
    id: 'citywide_broadcast',
    name: 'Citywide Broadcast',
    icon: '🏙️',
    description: 'Push your live to ALL online users across Troll City. LEGENDARY power!',
    rarity: 'legendary',
    abilityType: 'broadcast_wide',
    cooldownSeconds: 3600,
    durationSeconds: 60,
    requiresTarget: false,
    wheelWeight: 1,
    color: '#f97316',
    glowColor: '#fb923c',
  },
  {
    id: 'troll_foot',
    name: 'Troll Foot',
    icon: '🦶',
    description: 'For 30 seconds, all viewers get 0.5 Trollmonds back on every gift sent!',
    rarity: 'epic',
    abilityType: 'gifting_buff',
    cooldownSeconds: 900,
    durationSeconds: 30,
    requiresTarget: false,
    wheelWeight: 4,
    color: '#10b981',
    glowColor: '#34d399',
  },
  {
    id: 'team_freeze',
    name: 'Team Freeze',
    icon: '❄️',
    description: 'Freeze the opposing team for 5 seconds - they cannot earn points!',
    rarity: 'rare',
    abilityType: 'targeted',
    cooldownSeconds: 30,
    durationSeconds: 5,
    requiresTarget: false,
    wheelWeight: 10,
    color: '#06b6d4',
    glowColor: '#22d3ee',
  },
  {
    id: 'reverse',
    name: 'Reverse',
    icon: '🔄',
    description: 'Bounce any active freeze back to the opposing team!',
    rarity: 'rare',
    abilityType: 'targeted',
    cooldownSeconds: 20,
    durationSeconds: 0,
    requiresTarget: false,
    wheelWeight: 10,
    color: '#f97316',
    glowColor: '#fb923c',
  },
  {
    id: 'double_xp',
    name: 'Double XP',
    icon: '💰',
    description: 'Double your team\'s score from gifts for 10 seconds!',
    rarity: 'epic',
    abilityType: 'broadcast_wide',
    cooldownSeconds: 25,
    durationSeconds: 10,
    requiresTarget: false,
    wheelWeight: 6,
    color: '#eab308',
    glowColor: '#facc15',
  },
];

export function getAbilityById(id: AbilityId): BroadcastAbility | undefined {
  return BROADCAST_ABILITIES.find(a => a.id === id);
}

export function getAbilityWheelRewards() {
  return BROADCAST_ABILITIES.map(ability => ({
    id: `ability_${ability.id}`,
    type: 'broadcast_ability' as const,
    abilityId: ability.id,
    label: ability.icon,
    name: ability.name,
    description: ability.description,
    rarity: ability.rarity,
    color: ability.color,
    glowColor: ability.glowColor,
    icon: ability.icon,
    wheelWeight: ability.wheelWeight,
  }));
}

export function getRarityColor(rarity: AbilityRarity): string {
  switch (rarity) {
    case 'rare': return '#3b82f6';
    case 'epic': return '#8b5cf6';
    case 'legendary': return '#f97316';
  }
}

export function getRarityGlow(rarity: AbilityRarity): string {
  switch (rarity) {
    case 'rare': return 'rgba(59, 130, 246, 0.6)';
    case 'epic': return 'rgba(139, 92, 246, 0.6)';
    case 'legendary': return 'rgba(249, 115, 22, 0.6)';
  }
}
