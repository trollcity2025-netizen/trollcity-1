// src/lib/familyTasks.ts
// Family task progress tracking utilities

import { supabase } from './supabase'

export type TaskMetric =
  | 'coins_earned'
  | 'xp_earned'
  | 'streams_started'
  | 'gifts_sent'
  | 'family_members_recruited'
  | 'wars_declared'
  | 'wars_won'

/**
 * Increment family task progress based on member activity
 */
export async function incrementFamilyTaskProgress(
  userId: string,
  metric: TaskMetric,
  amount: number = 1
) {
  try {
    // Get user's family
    const { data: familyMember } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .single()

    if (!familyMember?.family_id) {
      return { success: false, error: 'User not in family' }
    }

    // Get active tasks for this family and metric
    const { data: tasks } = await supabase
      .from('family_tasks')
      .select('id, current_value, goal_value, status')
      .eq('family_id', familyMember.family_id)
      .eq('metric', metric)
      .eq('status', 'active')

    if (!tasks || tasks.length === 0) {
      return { success: true, message: 'No active tasks for this metric' }
    }

    // Update each matching task
    for (const task of tasks) {
      const newValue = Math.min(task.current_value + amount, task.goal_value)

      const { error: updateError } = await supabase
        .from('family_tasks')
        .update({
          current_value: newValue,
          status: newValue >= task.goal_value ? 'completed' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      if (updateError) {
        console.error('Failed to update task progress:', updateError)
      } else {
        // Log activity if task completed
        if (newValue >= task.goal_value) {
          await supabase
            .from('family_activity_log')
            .insert({
              family_id: familyMember.family_id,
              user_id: userId,
              event_type: 'task_completed',
              event_message: `Family task completed: ${task.id}`
            })
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('incrementFamilyTaskProgress error:', error)
    return { success: false, error: 'Failed to update task progress' }
  }
}

/**
 * Hook to track coin earnings for family tasks
 */
export async function trackCoinEarning(userId: string, coinsEarned: number) {
  return await incrementFamilyTaskProgress(userId, 'coins_earned', coinsEarned)
}

/**
 * Update family_goals current_value when coins are earned.
 * This keeps the family_goals table (used by TrollFamilyHome) in sync.
 */
export async function updateFamilyGoalProgress(userId: string, coinsEarned: number) {
  try {
    const { data: familyMember } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!familyMember?.family_id) return

    // Fetch active activity-type goals for this family
    const { data: activeGoals } = await supabase
      .from('family_goals')
      .select('id, current_value, target_value, status')
      .eq('family_id', familyMember.family_id)
      .eq('status', 'active')
      .eq('goal_type', 'activity')
      .gt('expires_at', new Date().toISOString())

    if (!activeGoals || activeGoals.length === 0) return

    for (const goal of activeGoals) {
      const newValue = Math.min(goal.current_value + coinsEarned, goal.target_value)
      const newStatus = newValue >= goal.target_value ? 'completed' : 'active'

      await supabase
        .from('family_goals')
        .update({
          current_value: newValue,
          status: newStatus,
          ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', goal.id)
    }
  } catch (error) {
    console.warn('updateFamilyGoalProgress error:', error)
  }
}

/**
 * Hook to track XP earnings for family tasks
 */
export async function trackXpEarning(userId: string, xpEarned: number) {
  return await incrementFamilyTaskProgress(userId, 'xp_earned', xpEarned)
}

/**
 * Hook to track stream starts for family tasks
 */
export async function trackStreamStart(userId: string) {
  return await incrementFamilyTaskProgress(userId, 'streams_started', 1)
}

/**
 * Hook to track gifts sent for family tasks
 */
export async function trackGiftSent(userId: string) {
  return await incrementFamilyTaskProgress(userId, 'gifts_sent', 1)
}

/**
 * Hook to track family member recruitment
 */
export async function trackMemberRecruitment(familyId: string, recruiterId: string) {
  return await incrementFamilyTaskProgress(recruiterId, 'family_members_recruited', 1)
}

/**
 * Hook to track war declarations
 */
export async function trackWarDeclared(familyId: string, declarerId: string) {
  return await incrementFamilyTaskProgress(declarerId, 'wars_declared', 1)
}

/**
 * Hook to track war wins
 */
export async function trackWarWon(familyId: string, winnerUserId: string) {
  return await incrementFamilyTaskProgress(winnerUserId, 'wars_won', 1)
}