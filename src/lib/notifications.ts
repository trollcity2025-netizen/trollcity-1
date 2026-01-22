// Helper functions for creating notifications
import { supabase } from './supabase'
import { NotificationType, NotificationMetadata } from '../types/notifications'
import { sendNotification } from './sendNotification'

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotificationMetadata
): Promise<{ success: boolean; error?: string }> {
  try {
    await sendNotification(userId, type, title, message, metadata || {})
    return { success: true }
  } catch (err: any) {
    console.error('Error creating notification:', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

/**
 * Create notification for gift received
 */
export async function notifyGiftReceived(
  receiverId: string,
  senderId: string,
  coinsSpent: number,
  streamId?: string
) {
  // Get sender username
  const { data: sender } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', senderId)
    .single()

  return createNotification(
    receiverId,
    'gift_received',
    '🎁 Gift Received!',
    `You received ${coinsSpent.toLocaleString()} coins from @${sender?.username || 'someone'}`,
    {
      gift_id: '', // Will be set by trigger
      sender_id: senderId,
      coins_spent: coinsSpent,
      stream_id: streamId
    }
  )
}

/**
 * Create notification for badge unlocked
 */
export async function notifyBadgeUnlocked(
  userId: string,
  badgeId: string,
  badgeName: string
) {
  return createNotification(
    userId,
    'badge_unlocked',
    '🏆 Badge Unlocked!',
    `You unlocked the "${badgeName}" badge!`,
    {
      badge_id: badgeId,
      earned_at: new Date().toISOString()
    }
  )
}

/**
 * Create notification for payout status change
 */
export async function notifyPayoutStatus(
  userId: string,
  status: 'approved' | 'paid' | 'rejected',
  cashAmount: number,
  payoutId: string
) {
  const titles = {
    approved: '✅ Payout Approved',
    paid: '💰 Payout Completed',
    rejected: '❌ Payout Rejected'
  }

  const messages = {
    approved: `Your payout request of $${cashAmount.toFixed(2)} has been approved and will be processed soon.`,
    paid: `Your payout of $${cashAmount.toFixed(2)} has been processed successfully.`,
    rejected: `Your payout request of $${cashAmount.toFixed(2)} was rejected. Please check your account for details.`
  }

  return createNotification(
    userId,
    'payout_status',
    titles[status],
    messages[status],
    {
      payout_id: payoutId,
      status,
      cash_amount: cashAmount
    }
  )
}

/**
 * Create notification for moderation action
 */
export async function notifyModerationAction(
  userId: string,
  actionType: 'warn' | 'ban_user' | 'suspend_stream' | 'unban_user',
  reason: string,
  actionId: string
) {
  const titles = {
    warn: '⚠️ Warning Issued',
    ban_user: '🚫 Account Banned',
    suspend_stream: '⏸️ Stream Suspended',
    unban_user: '✅ Account Unbanned'
  }

  const messages = {
    warn: `You have been issued a warning: ${reason}`,
    ban_user: `Your account has been banned. Reason: ${reason}`,
    suspend_stream: `Your stream has been suspended. Reason: ${reason}`,
    unban_user: 'Your account ban has been lifted.'
  }

  return createNotification(
    userId,
    'moderation_action',
    titles[actionType],
    messages[actionType],
    {
      action_id: actionId,
      action_type: actionType,
      reason
    }
  )
}

/**
 * Create notification for battle result
 */
export async function notifyBattleResult(
  userId: string,
  won: boolean,
  battleId: string,
  coinsEarned?: number
) {
  return createNotification(
    userId,
    'battle_result',
    won ? '⚔️ Battle Won!' : '⚔️ Battle Lost',
    won
      ? `Congratulations! You won the battle${coinsEarned ? ` and earned ${coinsEarned.toLocaleString()} coins` : ''}!`
      : 'Better luck next time!',
    {
      battle_id: battleId,
      winner_id: won ? userId : undefined,
      coins_earned: coinsEarned
    }
  )
}

/**
 * Create notification for officer update
 */
export async function notifyOfficerUpdate(
  userId: string,
  message: string,
  metadata?: NotificationMetadata
) {
  return createNotification(
    userId,
    'officer_update',
    '🛡️ Officer Update',
    message,
    metadata
  )
}

/**
 * Create system announcement notification for all users
 */
export async function notifySystemAnnouncement(
  title: string,
  message: string,
  metadata?: NotificationMetadata
) {
  try {
    // Get all user IDs
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id')

    if (error) throw error

    if (!users || users.length === 0) {
      return { success: true, count: 0 }
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'system_announcement' as NotificationType,
      title,
      message,
      metadata: metadata || {}
    }))

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (insertError) throw insertError

    return { success: true, count: users.length }
  } catch (err: any) {
    console.error('Error creating system announcement:', err)
    return { success: false, error: err?.message || 'Unknown error', count: 0 }
  }
}

/**
 * Create notification for all admins
 */
export async function notifyAdmins(
  title: string,
  message: string,
  type: NotificationType,
  metadata?: NotificationMetadata
) {
  try {
    // Get all admin IDs
    const { data: admins, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')

    if (error) throw error

    if (!admins || admins.length === 0) {
      return { success: true, count: 0 }
    }

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type,
      title,
      message,
      metadata: metadata || {}
    }))

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (insertError) throw insertError

    return { success: true, count: admins.length }
  } catch (err: any) {
    console.error('Error notifying admins:', err)
    return { success: false, error: err?.message || 'Unknown error', count: 0 }
  }
}
