// =============================================================================
// TROLL FAMILIES UTILITY FUNCTIONS
// =============================================================================
import { supabase } from './supabase';
import type {
  FamilyGoal,
  FamilyAchievement,
  FamilyStreak,
  FamilyVault,
  FamilyNotification,
  FamilyHeartbeat,
  TrollFamily,
  FamilyMember,
  CreateFamilyResponse,
  GoalCompletionResponse,
  FamilyGoalsResponse,
  FamilyParticipation,
  FamilySong,
  FamilyMemberExtended,
} from '../types/trollFamilies';

// =============================================================================
// FAMILY CRUD OPERATIONS
// =============================================================================

/**
 * Create a new Troll Family (costs 1000 Troll Coins)
 */
export async function createTrollFamily(
  name: string,
  tag: string,
  description?: string,
  slogan?: string,
  crestUrl?: string,
  bannerUrl?: string
): Promise<CreateFamilyResponse> {
  const { data, error } = await supabase.rpc('create_troll_family', {
    p_name: name,
    p_tag: tag,
    p_description: description,
    p_slogan: slogan,
    p_crest_url: crestUrl,
    p_banner_url: bannerUrl,
  });

  if (error) {
    console.error('Error creating family:', error);
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Get user's current family
 */
export async function getUserFamily(): Promise<TrollFamily | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member, error: memberError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !member?.family_id) return null;

  const { data: family, error: familyError } = await supabase
    .from('troll_families')
    .select('*')
    .eq('id', member.family_id)
    .maybeSingle();

  return family || null;
}

/**
 * Get family details by ID
 */
export async function getFamilyById(familyId: string): Promise<TrollFamily | null> {
  const { data, error } = await supabase
    .from('troll_families')
    .select('*')
    .eq('id', familyId)
    .maybeSingle();

  return data || null;
}

/**
 * Get all family members with user details
 */
export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select(`
      *,
      user:user_profiles(id, username, avatar_url, display_name)
    `)
    .eq('family_id', familyId)
    .order('role', { ascending: false });

  if (error) {
    console.error('Error fetching family members:', error);
    return [];
  }

  return data || [];
}

/**
 * Get user's family membership details
 */
export async function getUserFamilyMembership(): Promise<FamilyMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('family_members')
    .select(`
      *,
      user:user_profiles(id, username, avatar_url, display_name)
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  return data || null;
}

// =============================================================================
// FAMILY GOALS OPERATIONS
// =============================================================================

/**
 * Get all family goals grouped by category
 */
export async function getFamilyGoals(familyId: string): Promise<FamilyGoalsResponse> {
  const { data, error } = await supabase
    .from('family_goals')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching family goals:', error);
    return { daily: [], weekly: [], monthly: [] };
  }

  const goals = data || [];
  return {
    daily: goals.filter((g) => g.category === 'daily'),
    weekly: goals.filter((g) => g.category === 'weekly'),
    monthly: goals.filter((g) => g.category === 'monthly'),
  };
}

/**
 * Get active family goals
 */
export async function getActiveFamilyGoals(familyId: string): Promise<FamilyGoal[]> {
  const { data, error } = await supabase
    .from('family_goals')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'active')
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('Error fetching active goals:', error);
    return [];
  }

  return data || [];
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  goalId: string,
  userId: string,
  increment: number
): Promise<boolean> {
  // First check if progress record exists
  const { data: existing } = await supabase
    .from('family_goal_progress')
    .select('id, contribution_value')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('family_goal_progress')
      .update({
        contribution_value: existing.contribution_value + increment,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return !error;
  } else {
    // Get family_id from goal
    const { data: goal } = await supabase
      .from('family_goals')
      .select('family_id')
      .eq('id', goalId)
      .maybeSingle();

    const { error } = await supabase
      .from('family_goal_progress')
      .insert({
        goal_id: goalId,
        user_id: userId,
        family_id: goal?.family_id,
        contribution_value: increment,
      });
    return !error;
  }
}

/**
 * Complete a family goal
 */
export async function completeFamilyGoal(
  goalId: string,
  userId: string
): Promise<GoalCompletionResponse> {
  const { data, error } = await supabase.rpc('complete_family_goal', {
    p_goal_id: goalId,
    p_user_id: userId,
  });

  if (error) {
    console.error('Error completing goal:', error);
    return { success: false, goal_id: goalId, coins_awarded: 0, xp_awarded: 0, early_bonus: false, error: error.message };
  }

  return data;
}

/**
 * Generate goals for a family
 */
export async function generateFamilyGoals(
  familyId: string,
  generationType: 'daily' | 'weekly' | 'monthly'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('generate_family_goals', {
    p_family_id: familyId,
    p_generation_type: generationType,
  });

  return !error && data?.success;
}

// =============================================================================
// FAMILY ACHIEVEMENTS OPERATIONS
// =============================================================================

/**
 * Get family achievements
 */
export async function getFamilyAchievements(familyId: string): Promise<FamilyAchievement[]> {
  const { data, error } = await supabase
    .from('family_achievements')
    .select('*')
    .eq('family_id', familyId)
    .order('unlocked_at', { ascending: false });

  if (error) {
    console.error('Error fetching achievements:', error);
    return [];
  }

  return data || [];
}

/**
 * Check and unlock achievements for a family
 */
export async function checkAndUnlockAchievements(
  familyId: string,
  achievementKeys: string[]
): Promise<FamilyAchievement[]> {
  const unlocked: FamilyAchievement[] = [];

  for (const key of achievementKeys) {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('family_achievements')
      .select('id')
      .eq('family_id', familyId)
      .eq('achievement_key', key)
      .maybeSingle();

    if (existing) continue;

    // Get template and create achievement
    const { data: template } = await supabase
      .from('family_achievements')
      .select('*')
      .eq('achievement_key', key)
      .maybeSingle();

    if (!template) continue;

    const { data: newAchievement, error } = await supabase
      .from('family_achievements')
      .insert({
        family_id: familyId,
        achievement_key: key,
        title: template.title,
        description: template.description,
        icon: template.icon,
        rarity: template.rarity,
        reward_coins: template.reward_coins,
        reward_xp: template.reward_xp,
        achievement_points: template.achievement_points,
        unlocked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && newAchievement) {
      unlocked.push(newAchievement);
    }
  }

  return unlocked;
}

// =============================================================================
// FAMILY STREAKS & VAULT
// =============================================================================

/**
 * Get family streaks
 */
export async function getFamilyStreaks(familyId: string): Promise<FamilyStreak | null> {
  const { data, error } = await supabase
    .from('family_streaks')
    .select('*')
    .eq('family_id', familyId)
    .maybeSingle();

  return data || null;
}

/**
 * Get family vault
 */
export async function getFamilyVault(familyId: string): Promise<FamilyVault | null> {
  const { data, error } = await supabase
    .from('family_vault')
    .select('*')
    .eq('family_id', familyId)
    .maybeSingle();

  return data || null;
}

/**
 * Get family's weekly reward total (for cap enforcement)
 */
export async function getFamilyWeeklyRewardTotal(familyId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_family_weekly_reward_total', {
    p_family_id: familyId,
  });

  return data || 0;
}

// =============================================================================
// FAMILY HEARTBEAT
// =============================================================================

/**
 * Get family heartbeat/summary
 */
export async function getFamilyHeartbeat(familyId: string): Promise<FamilyHeartbeat | null> {
  const { data, error } = await supabase.rpc('get_family_heartbeat', {
    p_family_id: familyId,
  });

  if (error) {
    console.error('Error fetching heartbeat:', error);
    return null;
  }

  return data;
}

// =============================================================================
// FAMILY NOTIFICATIONS
// =============================================================================

/**
 * Get family notifications
 */
export async function getFamilyNotifications(
  familyId: string,
  unreadOnly = false
): Promise<FamilyNotification[]> {
  let query = supabase
    .from('family_notifications')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('family_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  return !error;
}

/**
 * Dismiss notification
 */
export async function dismissNotification(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('family_notifications')
    .update({ is_dismissed: true })
    .eq('id', notificationId);

  return !error;
}

/**
 * Create a family notification
 */
export async function createFamilyNotification(
  familyId: string,
  notificationType: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'urgent' | 'success' = 'info',
  relatedUserId?: string,
  relatedGoalId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('family_notifications')
    .insert({
      family_id: familyId,
      notification_type: notificationType,
      title,
      message,
      severity,
      related_user_id: relatedUserId,
      related_goal_id: relatedGoalId,
    });

  return !error;
}

// =============================================================================
// FAMILY PARTICIPATION
// =============================================================================

/**
 * Get today's participation for a family
 */
export async function getFamilyParticipation(familyId: string): Promise<FamilyParticipation[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('family_participation_tracking')
    .select(`
      *,
      user:user_profiles(id, username, avatar_url, display_name)
    `)
    .eq('family_id', familyId)
    .eq('activity_date', today);

  if (error) {
    console.error('Error fetching participation:', error);
    return [];
  }

  return data || [];
}

/**
 * Get at-risk members in a family
 */
export async function getAtRiskMembers(familyId: string): Promise<FamilyParticipation[]> {
  const { data, error } = await supabase
    .from('family_participation_tracking')
    .select(`
      *,
      user:user_profiles(id, username, avatar_url, display_name)
    `)
    .eq('family_id', familyId)
    .eq('is_at_risk', true);

  if (error) {
    console.error('Error fetching at-risk members:', error);
    return [];
  }

  return data || [];
}

/**
 * Update family participation (called by activities)
 */
export async function updateFamilyParticipation(
  activityType: 'message' | 'goal_complete' | 'points' | 'support',
  value = 1
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.rpc('update_family_participation', {
    p_user_id: user.id,
    p_activity_type: activityType,
    p_value: value,
  });

  return !error;
}

// =============================================================================
// FAMILY SONGS (Broadcasting/Pods Integration)
// =============================================================================

/**
 * Get family songs
 */
export async function getFamilySongs(familyId: string): Promise<FamilySong[]> {
  const { data, error } = await supabase
    .from('family_songs')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .order('plays', { ascending: false });

  if (error) {
    console.error('Error fetching family songs:', error);
    return [];
  }

  return data || [];
}

/**
 * Get featured family song
 */
export async function getFeaturedFamilySong(familyId: string): Promise<FamilySong | null> {
  const { data, error } = await supabase
    .from('family_songs')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_featured', true)
    .eq('is_active', true)
    .maybeSingle();

  return data || null;
}

/**
 * Create a family song
 */
export async function createFamilySong(
  familyId: string,
  title: string,
  description?: string,
  audioUrl?: string
): Promise<FamilySong | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('family_songs')
    .insert({
      family_id: familyId,
      title,
      description,
      audio_url: audioUrl,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating family song:', error);
    return null;
  }

  return data;
}

/**
 * Increment song plays
 */
export async function incrementSongPlays(songId: string): Promise<boolean> {
  const { error } = await supabase
    .from('family_songs')
    .update({ plays: +1 })
    .eq('id', songId);

  return !error;
}

// =============================================================================
// FAMILY MEMBER EXTENDED INFO
// =============================================================================

/**
 * Get extended member info
 */
export async function getFamilyMemberExtended(
  familyId: string,
  userId: string
): Promise<FamilyMemberExtended | null> {
  const { data, error } = await supabase
    .from('family_members_extended')
    .select('*')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle();

  return data || null;
}

/**
 * Update member role
 */
export async function updateMemberRole(
  familyId: string,
  userId: string,
  role: string
): Promise<boolean> {
  const { error } = await supabase
    .from('family_members')
    .update({ role })
    .eq('family_id', familyId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Assign mentor to member
 */
export async function assignMentor(
  familyId: string,
  memberUserId: string,
  mentorUserId: string
): Promise<boolean> {
  // Check if extended record exists
  const { data: existing } = await supabase
    .from('family_members_extended')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', memberUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('family_members_extended')
      .update({ mentor_id: mentorUserId })
      .eq('id', existing.id);
    return !error;
  } else {
    const { error } = await supabase
      .from('family_members_extended')
      .insert({
        family_id: familyId,
        user_id: memberUserId,
        mentor_id: mentorUserId,
      });
    return !error;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate goal progress percentage
 */
export function calculateGoalProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

/**
 * Check if goal is about to expire (within 25% of time)
 */
export function isGoalExpiringSoon(goal: FamilyGoal): boolean {
  const now = new Date();
  const expires = new Date(goal.expires_at);
  const generated = new Date(goal.generated_at);
  
  const totalTime = expires.getTime() - generated.getTime();
  const elapsedTime = now.getTime() - generated.getTime();
  const remainingPercent = 1 - (elapsedTime / totalTime);
  
  return remainingPercent <= 0.25 && remainingPercent > 0;
}

/**
 * Get time remaining display string
 */
export function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}

/**
 * Get difficulty label
 */
export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    elite: 'Elite',
  };
  return labels[difficulty] || difficulty;
}

/**
 * Get rarity label
 */
export function getRarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
  };
  return labels[rarity] || rarity;
}

/**
 * Format coins with abbreviation
 */
export function formatCoins(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}
