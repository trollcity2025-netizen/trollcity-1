// =============================================================================
// TROLL FAMILIES TYPE DEFINITIONS
// =============================================================================
// Inline UserProfile type (imported from lib/supabase.ts)
interface UserProfile {
  id: string;
  username?: string;
  avatar_url?: string;
  display_name?: string;
  // Add other fields as needed
}

// =============================================================================
// ENUMS
// =============================================================================

// Family Roles
export type FamilyRole = 'leader' | 'co_leader' | 'scout' | 'recruiter' | 'mentor' | 'member' | 'rising_star';

// Recruitment Stage
export type RecruitmentStage = 'prospect' | 'new_blood' | 'verified_member' | 'active_contributor' | 'rising_star';

// Goal Categories
export type GoalCategory = 'daily' | 'weekly' | 'monthly';

// Goal Difficulty
export type GoalDifficulty = 'easy' | 'medium' | 'hard' | 'elite';

// Goal Types
export type GoalType = 'activity' | 'recruitment' | 'support' | 'broadcast' | 'competition' | 'streak';

// Goal Status
export type GoalStatus = 'active' | 'completed' | 'expired' | 'failed';

// Achievement Rarity
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Notification Types
export type NotificationType = 
  | 'member_slipping' 
  | 'inactivity_warning' 
  | 'goal_alert' 
  | 'support_needed'
  | 'streak_at_risk' 
  | 'reward_pending' 
  | 'achievement_unlocked' 
  | 'member_recovered';

// Notification Severity
export type NotificationSeverity = 'info' | 'warning' | 'urgent' | 'success';

// Action Types for notifications
export type ActionType = 'send_encouragement' | 'assign_mentor' | 'nudge_member' | 'review_goals';

// Reward Source Types
export type RewardSourceType = 'goal' | 'achievement' | 'streak' | 'bonus' | 'support' | 'competition';

// Family Health Status
export type FamilyHealthStatus = 'thriving' | 'stable' | 'struggling';

// =============================================================================
// CORE TABLE TYPES
// =============================================================================

export interface FamilyGoal {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  difficulty: GoalDifficulty;
  target_value: number;
  current_value: number;
  status: GoalStatus;
  reward_coins: number;
  bonus_coins: number;
  reward_xp: number;
  goal_type: GoalType;
  generated_at: string;
  expires_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyGoalProgress {
  id: string;
  goal_id: string;
  user_id: string;
  family_id: string;
  contribution_value: number;
  last_activity_at: string;
  supported_member_id?: string;
  is_support_action: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyAchievement {
  id: string;
  family_id: string;
  achievement_key: string;
  title: string;
  description?: string;
  icon?: string;
  rarity: AchievementRarity;
  reward_coins: number;
  reward_xp: number;
  achievement_points: number;
  unlocked_at?: string;
  is_visible: boolean;
  created_at: string;
}

export interface FamilyRewardLedger {
  id: string;
  family_id: string;
  source_type: RewardSourceType;
  source_id?: string;
  coinsAwarded: number;
  xp_awarded: number;
  week_start: string;
  week_end: string;
  description?: string;
  awarded_at: string;
}

export interface FamilyStreak {
  id: string;
  family_id: string;
  current_daily_streak: number;
  longest_daily_streak: number;
  last_activity_date?: string;
  current_weekly_streak: number;
  longest_weekly_streak: number;
  last_weekly_completion?: string;
  streak_bonus_earned: number;
  created_at: string;
  updated_at: string;
}

export interface FamilyNotification {
  id: string;
  family_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  related_user_id?: string;
  related_goal_id?: string;
  is_read: boolean;
  is_dismissed: boolean;
  action_required: boolean;
  action_type?: ActionType;
  action_target_id?: string;
  created_at: string;
  read_at?: string;
}

export interface FamilyParticipation {
  id: string;
  family_id: string;
  user_id: string;
  activity_date: string;
  messages_sent: number;
  goals_completed: number;
  points_earned: number;
  support_actions: number;
  is_active: boolean;
  is_at_risk: boolean;
  risk_reason?: string;
  daily_goal_progress: number;
  weekly_goal_progress: number;
  created_at: string;
  updated_at: string;
}

export interface FamilyGoalTemplate {
  id: string;
  template_key: string;
  title: string;
  description?: string;
  category: GoalCategory;
  goal_type: GoalType;
  difficulty: GoalDifficulty;
  base_target: number;
  target_multiplier: number;
  base_reward_coins: number;
  base_bonus_coins: number;
  base_reward_xp: number;
  min_family_size?: number;
  max_family_size?: number;
  min_family_level?: number;
  required_activity_level?: string;
  selection_weight: number;
  is_active: boolean;
  created_at: string;
}

export interface FamilyGoalGenerationRun {
  id: string;
  family_id: string;
  generation_type: GoalCategory | 'manual';
  goals_generated: number;
  generated_at: string;
}

export interface FamilyVault {
  id: string;
  family_id: string;
  total_coins: number;
  total_xp: number;
  weekly_contribution: number;
  last_week_reset?: string;
  streak_bonus: number;
  competition_bonus: number;
  support_bonus: number;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberExtended {
  id: string;
  family_id: string;
  user_id: string;
  family_role: FamilyRole;
  recruitment_stage: RecruitmentStage;
  mentor_id?: string;
  contribution_points: number;
  support_points: number;
  streak_days: number;
  is_active: boolean;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FamilySong {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  audio_url?: string;
  created_by: string;
  plays: number;
  likes: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// COMPOSED TYPES
// =============================================================================

export interface FamilyHeartbeat {
  family_id: string;
  health: FamilyHealthStatus;
  total_members: number;
  active_members: number;
  at_risk_members: number;
  goals_active: number;
  goals_completed: number;
  current_streak: number;
  unread_notifications: number;
  timestamp: string;
}

export interface FamilyWithDetails extends TrollFamily {
  member_count?: number;
  active_members?: number;
  streak?: FamilyStreak;
  vault?: FamilyVault;
  heartbeat?: FamilyHeartbeat;
}

export interface TrollFamily {
  id: string;
  name: string;
  tag: string;
  description?: string;
  slogan?: string;
  crest_url?: string;
  banner_url?: string;
  creation_cost: number;
  owner_id: string;
  level: number;
  xp: number;
  legacy_score: number;
  family_rank: number;
  reputation: number;
  created_at: string;
  updated_at?: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  rank_name?: string;
  is_royal_troll: boolean;
  joined_at: string;
  // Extended profile info
  user?: UserProfile;
  extended?: FamilyMemberExtended;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface CreateFamilyResponse {
  success: boolean;
  family_id?: string;
  family_name?: string;
  cost_deducted?: number;
  message?: string;
  error?: string;
}

export interface GoalCompletionResponse {
  success: boolean;
  goal_id: string;
  coins_awarded: number;
  xp_awarded: number;
  early_bonus: boolean;
  error?: string;
}

export interface WeeklyRewardResponse {
  success: boolean;
  awarded: number;
  requested: number;
  current_total: number;
  capped: boolean;
  reason?: string;
}

export interface FamilyGoalsResponse {
  daily: FamilyGoal[];
  weekly: FamilyGoal[];
  monthly: FamilyGoal[];
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface FamilyCreationForm {
  name: string;
  tag: string;
  description: string;
  slogan: string;
  crestUrl: string;
  bannerUrl: string;
}

export interface FamilyGoalWithProgress extends FamilyGoal {
  memberProgress?: FamilyGoalProgress[];
  myContribution?: number;
  percentComplete?: number;
}

export interface AchievementWithStatus extends FamilyAchievement {
  isUnlocked: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Weekly reward cap as per requirements
export const MAX_WEEKLY_FAMILY_REWARDS = 500;

// Family creation cost
export const FAMILY_CREATION_COST = 1000;

// Difficulty reward tiers (coins)
export const DIFFICULTY_REWARDS = {
  daily: {
    easy: { base: 50, bonus: 25 },
    medium: { base: 100, bonus: 50 },
    hard: { base: 200, bonus: 100 },
    elite: { base: 350, bonus: 175 }
  },
  weekly: {
    easy: { base: 300, bonus: 150 },
    medium: { base: 500, bonus: 250 },
    hard: { base: 900, bonus: 450 },
    elite: { base: 1500, bonus: 750 }
  },
  monthly: {
    easy: { base: 1000, bonus: 500 },
    medium: { base: 2000, bonus: 1000 },
    hard: { base: 4000, bonus: 2000 },
    elite: { base: 7000, bonus: 3500 }
  }
} as const;

// Achievement reward tiers (coins)
export const ACHIEVEMENT_REWARDS = {
  common: { base: 100, bonus: 50 },
  uncommon: { base: 250, bonus: 125 },
  rare: { base: 500, bonus: 250 },
  epic: { base: 1200, bonus: 600 },
  legendary: { base: 3000, bonus: 1500 }
} as const;

// Role hierarchy
export const ROLE_HIERARCHY: Record<FamilyRole, number> = {
  leader: 7,
  co_leader: 6,
  scout: 5,
  recruiter: 4,
  mentor: 3,
  member: 2,
  rising_star: 1
};

// Recruitment stage progression
export const RECRUITMENT_STAGES: RecruitmentStage[] = [
  'prospect',
  'new_blood',
  'verified_member',
  'active_contributor',
  'rising_star'
];

// Health status colors
export const HEALTH_STATUS_COLORS: Record<FamilyHealthStatus, string> = {
  thriving: 'text-green-400',
  stable: 'text-yellow-400',
  struggling: 'text-red-400'
};

// Difficulty colors
export const DIFFICULTY_COLORS: Record<GoalDifficulty, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  elite: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
};

// Rarity colors
export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  uncommon: 'bg-green-500/20 text-green-400 border-green-500/30',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legendary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
};
