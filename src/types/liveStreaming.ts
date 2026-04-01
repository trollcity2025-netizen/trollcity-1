// ============================================================
// NEXT-GENERATION LIVE STREAMING SYSTEM - TYPE DEFINITIONS
// ============================================================

// =====================
// 1. MISSION SYSTEM
// =====================

export type MissionType = 'solo' | 'community' | 'competitive' | 'timed';
export type MissionDifficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'legendary';
export type MissionStatus = 'active' | 'completed' | 'failed' | 'expired' | 'chained';
export type MissionMetric = 'gifts_sent' | 'chat_messages' | 'watch_minutes' | 'coins_earned' | 'follows' | 'shares' | 'viewer_count' | 'likes';

export interface MissionTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  mission_type: MissionType;
  category: string;
  target_metric: MissionMetric;
  target_value: number;
  duration_minutes: number | null;
  chain_order: number;
  chain_group: string | null;
  difficulty: MissionDifficulty;
  xp_reward: number;
  coin_reward: number;
  badge_reward: string | null;
  icon: string;
  is_active: boolean;
}

export interface StreamMission {
  id: string;
  stream_id: string;
  mission_template_id: string | null;
  name: string;
  description: string;
  mission_type: MissionType;
  target_metric: MissionMetric;
  target_value: number;
  current_value: number;
  difficulty: MissionDifficulty;
  status: MissionStatus;
  chain_group: string | null;
  chain_order: number;
  starts_at: string;
  expires_at: string | null;
  completed_at: string | null;
  xp_reward: number;
  coin_reward: number;
  icon: string;
  metadata: Record<string, any>;
}

export interface UserMissionProgress {
  id: string;
  user_id: string;
  mission_id: string;
  stream_id: string;
  progress_value: number;
  completed_at: string | null;
}

// =====================
// 2. PROFILE FRAME SYSTEM
// =====================

export type FrameStyle = 'flat' | 'beveled' | 'glowing' | 'animated' | 'premium';
export type AnimationType = 'pulse' | 'rotate' | 'shimmer' | 'fire' | 'electric' | 'cosmic' | null;
export type FrameRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'exclusive' | 'ultimate';

export interface ProfileFrameTier {
  id: string;
  tier_name: string;
  min_level: number;
  max_level: number;
  frame_style: FrameStyle;
  border_color: string;
  border_gradient: string | null;
  glow_color: string | null;
  glow_intensity: number;
  animation_type: AnimationType;
  animation_speed: 'slow' | 'normal' | 'fast';
  has_particles: boolean;
  particle_color: string | null;
  css_class: string;
  rarity: FrameRarity;
}

export const PROFILE_FRAME_TIERS: ProfileFrameTier[] = [
  { id: '1', tier_name: 'Novice', min_level: 1, max_level: 10, frame_style: 'flat', border_color: '#4a5568', border_gradient: null, glow_color: null, glow_intensity: 0, animation_type: null, animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-novice', rarity: 'common' },
  { id: '2', tier_name: 'Apprentice', min_level: 11, max_level: 25, frame_style: 'flat', border_color: '#6366f1', border_gradient: null, glow_color: '#6366f1', glow_intensity: 0.2, animation_type: null, animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-apprentice', rarity: 'common' },
  { id: '3', tier_name: 'Journeyman', min_level: 26, max_level: 50, frame_style: 'beveled', border_color: '#8b5cf6', border_gradient: null, glow_color: '#8b5cf6', glow_intensity: 0.3, animation_type: null, animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-journeyman', rarity: 'uncommon' },
  { id: '4', tier_name: 'Adept', min_level: 51, max_level: 100, frame_style: 'beveled', border_color: '#a855f7', border_gradient: null, glow_color: '#a855f7', glow_intensity: 0.4, animation_type: 'pulse', animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-adept', rarity: 'uncommon' },
  { id: '5', tier_name: 'Expert', min_level: 101, max_level: 200, frame_style: 'glowing', border_color: '#ec4899', border_gradient: null, glow_color: '#ec4899', glow_intensity: 0.5, animation_type: 'pulse', animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-expert', rarity: 'rare' },
  { id: '6', tier_name: 'Master', min_level: 201, max_level: 350, frame_style: 'glowing', border_color: '#f43f5e', border_gradient: null, glow_color: '#f43f5e', glow_intensity: 0.6, animation_type: 'shimmer', animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-master', rarity: 'rare' },
  { id: '7', tier_name: 'Grandmaster', min_level: 351, max_level: 500, frame_style: 'animated', border_color: '#f97316', border_gradient: null, glow_color: '#f97316', glow_intensity: 0.7, animation_type: 'shimmer', animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-grandmaster', rarity: 'epic' },
  { id: '8', tier_name: 'Champion', min_level: 501, max_level: 700, frame_style: 'animated', border_color: '#eab308', border_gradient: null, glow_color: '#eab308', glow_intensity: 0.8, animation_type: 'rotate', animation_speed: 'normal', has_particles: false, particle_color: null, css_class: 'frame-champion', rarity: 'epic' },
  { id: '9', tier_name: 'Titan', min_level: 701, max_level: 900, frame_style: 'premium', border_color: '#facc15', border_gradient: null, glow_color: '#facc15', glow_intensity: 0.9, animation_type: 'fire', animation_speed: 'fast', has_particles: true, particle_color: '#facc15', css_class: 'frame-titan', rarity: 'legendary' },
  { id: '10', tier_name: 'Immortal', min_level: 901, max_level: 1100, frame_style: 'premium', border_color: '#ffd700', border_gradient: null, glow_color: '#ffd700', glow_intensity: 1.0, animation_type: 'fire', animation_speed: 'fast', has_particles: true, particle_color: '#ffd700', css_class: 'frame-immortal', rarity: 'legendary' },
  { id: '11', tier_name: 'Divine', min_level: 1101, max_level: 1300, frame_style: 'premium', border_color: '#ffd700', border_gradient: 'linear-gradient(135deg, #ffd700, #ff6b35)', glow_color: '#ff6b35', glow_intensity: 1.1, animation_type: 'electric', animation_speed: 'fast', has_particles: true, particle_color: '#ff6b35', css_class: 'frame-divine', rarity: 'mythic' },
  { id: '12', tier_name: 'Celestial', min_level: 1301, max_level: 1500, frame_style: 'premium', border_color: '#ff6b35', border_gradient: 'linear-gradient(135deg, #ff6b35, #00d4ff)', glow_color: '#00d4ff', glow_intensity: 1.2, animation_type: 'cosmic', animation_speed: 'fast', has_particles: true, particle_color: '#00d4ff', css_class: 'frame-celestial', rarity: 'mythic' },
  { id: '13', tier_name: 'Cosmic', min_level: 1501, max_level: 1700, frame_style: 'premium', border_color: '#00d4ff', border_gradient: 'linear-gradient(135deg, #00d4ff, #a855f7)', glow_color: '#a855f7', glow_intensity: 1.3, animation_type: 'cosmic', animation_speed: 'fast', has_particles: true, particle_color: '#a855f7', css_class: 'frame-cosmic', rarity: 'exclusive' },
  { id: '14', tier_name: 'Eternal', min_level: 1701, max_level: 1900, frame_style: 'premium', border_color: '#a855f7', border_gradient: 'linear-gradient(135deg, #a855f7, #ffd700)', glow_color: '#ffd700', glow_intensity: 1.4, animation_type: 'cosmic', animation_speed: 'fast', has_particles: true, particle_color: '#ffd700', css_class: 'frame-eternal', rarity: 'exclusive' },
  { id: '15', tier_name: 'Transcendent', min_level: 1901, max_level: 2000, frame_style: 'premium', border_color: '#ffd700', border_gradient: 'linear-gradient(135deg, #ffd700, #ff3366, #00d4ff)', glow_color: '#ff3366', glow_intensity: 1.5, animation_type: 'cosmic', animation_speed: 'fast', has_particles: true, particle_color: '#ffd700', css_class: 'frame-transcendent', rarity: 'ultimate' },
];

export function getFrameForLevel(level: number): ProfileFrameTier {
  return PROFILE_FRAME_TIERS.find(f => level >= f.min_level && level <= f.max_level) || PROFILE_FRAME_TIERS[0];
}

// =====================
// 3. DIAMOND AVATAR SYSTEM
// =====================

export type DiamondStyle = 'flat' | 'beveled' | 'glowing' | 'crystal' | 'artifact';

export interface DiamondTier {
  id: string;
  tier_name: string;
  min_level: number;
  max_level: number;
  diamond_style: DiamondStyle;
  border_color: string;
  border_gradient: string | null;
  glow_color: string | null;
  glow_intensity: number;
  has_sparkle: boolean;
  sparkle_color: string | null;
  animation: string | null;
  animation_speed: 'slow' | 'normal' | 'fast';
  css_class: string;
}

export const DIAMOND_TIERS: DiamondTier[] = [
  { id: '1', tier_name: 'Flat Diamond', min_level: 1, max_level: 50, diamond_style: 'flat', border_color: '#4a5568', border_gradient: null, glow_color: null, glow_intensity: 0, has_sparkle: false, sparkle_color: null, animation: null, animation_speed: 'normal', css_class: 'diamond-flat' },
  { id: '2', tier_name: 'Beveled Diamond', min_level: 51, max_level: 200, diamond_style: 'beveled', border_color: '#8b5cf6', border_gradient: null, glow_color: '#8b5cf6', glow_intensity: 0.3, has_sparkle: false, sparkle_color: null, animation: null, animation_speed: 'normal', css_class: 'diamond-beveled' },
  { id: '3', tier_name: 'Glowing Crystal', min_level: 201, max_level: 500, diamond_style: 'glowing', border_color: '#a855f7', border_gradient: null, glow_color: '#a855f7', glow_intensity: 0.5, has_sparkle: true, sparkle_color: '#a855f7', animation: 'pulse', animation_speed: 'normal', css_class: 'diamond-glowing' },
  { id: '4', tier_name: 'Crystal Gem', min_level: 501, max_level: 1000, diamond_style: 'crystal', border_color: '#ec4899', border_gradient: null, glow_color: '#ec4899', glow_intensity: 0.7, has_sparkle: true, sparkle_color: '#ec4899', animation: 'shimmer', animation_speed: 'normal', css_class: 'diamond-crystal' },
  { id: '5', tier_name: 'Animated Gemstone', min_level: 1001, max_level: 1500, diamond_style: 'crystal', border_color: '#eab308', border_gradient: 'linear-gradient(135deg, #eab308, #ffd700)', glow_color: '#ffd700', glow_intensity: 0.9, has_sparkle: true, sparkle_color: '#ffd700', animation: 'fire', animation_speed: 'fast', css_class: 'diamond-animated' },
  { id: '6', tier_name: 'Ultimate Artifact', min_level: 1501, max_level: 2000, diamond_style: 'artifact', border_color: '#ffd700', border_gradient: 'linear-gradient(135deg, #ffd700, #ff3366, #00d4ff)', glow_color: '#ff3366', glow_intensity: 1.2, has_sparkle: true, sparkle_color: '#ffd700', animation: 'artifact_pulse', animation_speed: 'fast', css_class: 'diamond-artifact' },
];

export function getDiamondForLevel(level: number): DiamondTier {
  return DIAMOND_TIERS.find(d => level >= d.min_level && level <= d.max_level) || DIAMOND_TIERS[0];
}

// =====================
// 4. AUDIO & VOICE SYSTEM
// =====================

export type AudioType = 'custom' | 'voice_over' | 'system';
export type AudioQueueStatus = 'queued' | 'playing' | 'played' | 'skipped' | 'dropped';
export type StreamAudioMode = 'silent' | 'standard' | 'premium' | 'hype';
export type EntranceJoinType = 'audio' | 'voice' | 'effect' | 'none';

export interface UserEntranceAudio {
  id: string;
  user_id: string;
  audio_url: string;
  audio_name: string;
  duration_seconds: number;
  file_size_bytes: number | null;
  is_active: boolean;
  is_approved: boolean;
}

export interface AudioQueueItem {
  id: string;
  stream_id: string;
  user_id: string;
  audio_type: AudioType;
  audio_url: string | null;
  voice_text: string | null;
  priority: number;
  status: AudioQueueStatus;
}

export interface BroadcastAudioSettings {
  stream_id: string;
  voice_enabled: boolean;
  custom_audio_enabled: boolean;
  min_level_for_voice: number;
  min_level_for_custom: number;
  cooldown_seconds: number;
  max_queue_size: number;
  stream_mode: StreamAudioMode;
  muted_users: string[];
}

export interface VoiceAnnouncementStyle {
  id: string;
  slug: string;
  name: string;
  voice_type: string;
  sample_url: string | null;
  is_active: boolean;
}

export const AUDIO_PRIORITY = {
  EVENT_WINNER: 1000,
  TOP_BROADCASTER: 900,
  TOP_BUYER: 800,
  LEVEL_1000_PLUS: 700,
  LEVEL_200_CUSTOM: 600,
  LEVEL_200_VOICE: 500,
  DEFAULT: 100,
} as const;

// =====================
// 5. RECOGNITION SYSTEM
// =====================

export type FanTierType = 'viewer' | 'supporter' | 'fan' | 'superfan' | 'legend' | 'icon';
export type ViewerRole = 'hype_leader' | 'judge' | 'co_host' | 'moderator' | null;
export type AwardType = 'mvp' | 'top_gifter' | 'most_active' | 'hype_king' | 'loyal_viewer' | 'rising_star';

export interface StreamFanTier {
  id: string;
  stream_id: string;
  user_id: string;
  tier: FanTierType;
  total_coins_gifted: number;
  total_messages: number;
  watch_minutes: number;
  hype_score: number;
  role: ViewerRole;
  contract_active: boolean;
  contract_started_at: string | null;
}

export interface StreamEnergyMeter {
  stream_id: string;
  energy_level: number;
  hype_multiplier: number;
  last_boost_at: string | null;
  total_boosts: number;
  peak_energy: number;
}

export interface StreamAward {
  id: string;
  stream_id: string;
  award_type: AwardType;
  user_id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  coin_reward: number;
  badge_awarded: string | null;
}

export interface FanMemory {
  id: string;
  broadcaster_id: string;
  fan_id: string;
  total_streams_watched: number;
  total_coins_gifted: number;
  total_messages_sent: number;
  first_seen_at: string;
  last_seen_at: string;
  loyalty_score: number;
  best_tier: FanTierType;
}

export interface FanContract {
  id: string;
  broadcaster_id: string;
  fan_id: string;
  stream_id: string | null;
  contract_type: 'standard' | 'premium' | 'exclusive';
  perks: Record<string, any>;
  is_active: boolean;
  started_at: string;
  expires_at: string | null;
}

// =====================
// 6. BROADCASTER COMMAND CENTER
// =====================

export type CommandModuleType = 'identity' | 'goals' | 'missions' | 'top_fans' | 'milestones' | 'polls' | 'interactions' | 'recognition' | 'energy_meter' | 'ticker';
export type GoalType = 'coins' | 'followers' | 'shares' | 'subscriptions' | 'gifts' | 'viewers';

export interface BroadcastCommandModule {
  id: string;
  broadcaster_id: string;
  stream_id: string | null;
  module_type: CommandModuleType;
  is_enabled: boolean;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  settings: Record<string, any>;
}

export interface StreamGoal {
  id: string;
  stream_id: string;
  goal_type: GoalType;
  title: string;
  target_value: number;
  current_value: number;
  is_active: boolean;
  completed_at: string | null;
  reward_description: string | null;
}

export interface StreamMilestone {
  id: string;
  stream_id: string;
  milestone_type: string;
  title: string;
  description: string | null;
  threshold: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
  icon: string;
}

export interface StreamPoll {
  id: string;
  stream_id: string;
  question: string;
  options: { label: string; votes: number }[];
  is_active: boolean;
  total_votes: number;
  expires_at: string | null;
}

// =====================
// 7. BADGE ENHANCEMENTS
// =====================

export interface BadgeTierProgress {
  id: string;
  user_id: string;
  badge_slug: string;
  current_tier: number;
  progress_value: number;
}

export interface BadgePerk {
  type: string;
  value: any;
  tier_required: number;
}
