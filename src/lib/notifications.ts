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
    .select('username, glowing_username_color')
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
      sender_username: sender?.username,
      sender_glowing_color: sender?.glowing_username_color,
      coins_spent: coinsSpent,
      stream_id: streamId,
      action_url: streamId ? `/live/${streamId}` : '/wallet'
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
      earned_at: new Date().toISOString(),
      action_url: '/profile?tab=badges'
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
      amount: cashAmount,
      action_url: '/wallet'
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
      reason,
      action_url: '/profile'
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
      coins_earned: coinsEarned,
      action_url: '/profile'
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
 * Create notification for all admins and officers
 */
export async function notifyAdmins(
  title: string,
  message: string,
  type: NotificationType,
  metadata?: NotificationMetadata
) {
  try {
    // Get all admin and officer IDs
    const { data: admins, error } = await supabase
      .from('user_profiles')
      .select('id')
      .or('role.eq.admin,is_admin.eq.true,is_troll_officer.eq.true,is_lead_officer.eq.true,role.eq.secretary,role.eq.troll_officer,role.eq.lead_troll_officer')

    if (error) throw error

    if (!admins || admins.length === 0) {
      return { success: true, count: 0 }
    }

    // Deduplicate
    const uniqueIds = [...new Set(admins.map(a => a.id))]

    // Create notifications for all admins/officers
    const notifications = uniqueIds.map(id => ({
      user_id: id,
      type,
      title,
      message,
      metadata: metadata || {}
    }))

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (insertError) throw insertError

    // Send push notification via Edge Function
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: uniqueIds,
          title,
          body: message,
          data: metadata,
          type
        }
      })
    } catch (pushError) {
      console.error('Failed to send push to admins:', pushError)
    }

    return { success: true, count: uniqueIds.length }
  } catch (err: any) {
    console.error('Error notifying admins:', err)
    return { success: false, error: err?.message || 'Unknown error', count: 0 }
  }
}

// ==========================================
// SELLER SYSTEM NOTIFICATIONS
// ==========================================

/**
 * Create notification for seller tier upgrade
 */
export async function notifySellerTierUpgraded(
  userId: string,
  oldTier: string,
  newTier: string
) {
  const tierEmojis: Record<string, string> = {
    standard: '',
    verified: '✓',
    verified_pro: '⭐',
    merchant: '🏪',
    enterprise: '🏢'
  };

  return createNotification(
    userId,
    'seller_tier_upgraded',
    `${tierEmojis[newTier] || '🎉'} Seller Tier Upgraded!`,
    `Congratulations! You've been upgraded from ${oldTier} to ${newTier}. Your seller badge has been updated!`,
    {
      old_tier: oldTier,
      new_tier: newTier,
      action_url: '/profile?tab=marketplace'
    }
  );
}

/**
 * Create notification for seller tier downgrade
 */
export async function notifySellerTierDowngraded(
  userId: string,
  oldTier: string,
  newTier: string,
  reason: string
) {
  return createNotification(
    userId,
    'seller_tier_downgraded',
    '⚠️ Seller Tier Downgraded',
    `Your seller tier has been downgraded from ${oldTier} to ${newTier}. Reason: ${reason}. Contact support if you believe this is an error.`,
    {
      old_tier: oldTier,
      new_tier: newTier,
      reason,
      action_url: '/support'
    }
  );
}

/**
 * Create notification for new review received
 */
export async function notifyNewReviewReceived(
  sellerId: string,
  rating: number,
  buyerUsername: string,
  orderId: string
) {
  const ratingStars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  
  return createNotification(
    sellerId,
    'new_review_received',
    '📝 New Review Received!',
    `${buyerUsername} left you a ${rating}-star review: ${ratingStars}`,
    {
      rating,
      buyer_username: buyerUsername,
      order_id: orderId,
      action_url: '/marketplace/reviews'
    }
  );
}

/**
 * Create notification for appeal submitted
 */
export async function notifyAppealSubmitted(
  userId: string,
  orderId: string,
  appealId: string
) {
  return createNotification(
    userId,
    'appeal_submitted',
    '📋 Appeal Submitted',
    `Your appeal for order ${orderId} has been submitted and is pending review.`,
    {
      order_id: orderId,
      appeal_id: appealId,
      action_url: '/support/appeals'
    }
  );
}

/**
 * Create notification for appeal decision
 */
export async function notifyAppealDecision(
  userId: string,
  orderId: string,
  appealId: string,
  decision: 'approved' | 'denied' | 'escalated'
) {
  const titles = {
    approved: '✅ Appeal Approved!',
    denied: '❌ Appeal Denied',
    escalated: '📤 Appeal Escalated'
  };

  const messages = {
    approved: `Great news! Your appeal for order ${orderId} has been approved.`,
    denied: `Your appeal for order ${orderId} has been denied. You can submit a new appeal with additional evidence.`,
    escalated: `Your appeal for order ${orderId} has been escalated to a senior reviewer.`
  };

  return createNotification(
    userId,
    'appeal_decision',
    titles[decision],
    messages[decision],
    {
      order_id: orderId,
      appeal_id: appealId,
      decision,
      action_url: '/support/appeals'
    }
  );
}
