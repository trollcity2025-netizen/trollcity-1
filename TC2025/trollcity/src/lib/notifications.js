import { supabase } from '@/api/supabaseClient';

/**
 * Create a notification for a user
 */
export async function createNotification(userId, type, title, message, relatedUserId = null, linkUrl = null) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_user_id: relatedUserId,
        link_url: linkUrl,
        is_read: false,
        created_date: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating notification:', err);
    throw err;
  }
}

/**
 * Notify when someone goes live
 */
export async function notifyStreamLive(streamerId, streamerName, streamTitle) {
  try {
    // Get all followers of the streamer
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', streamerId);
    
    if (!followers || followers.length === 0) return;
    
    // Create notifications for each follower
    const notifications = followers.map(follower => ({
      user_id: follower.follower_id,
      type: 'stream_live',
      title: `${streamerName} is now live!`,
      message: streamTitle || `${streamerName} started streaming`,
      related_user_id: streamerId,
      link_url: `/#/stream/${streamerId}`,
      is_read: false,
      created_date: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (error) throw error;
  } catch (err) {
    console.error('Error notifying stream live:', err);
  }
}

/**
 * Notify when someone gets a new follower
 */
export async function notifyNewFollower(userId, followerName, followerId) {
  try {
    return await createNotification(
      userId,
      'new_follower',
      `${followerName} started following you!`,
      `${followerName} is now following your content`,
      followerId,
      `/#/profile/${followerId}`
    );
  } catch (err) {
    console.error('Error notifying new follower:', err);
    throw err;
  }
}

/**
 * Notify when someone receives a gift
 */
export async function notifyGiftReceived(recipientId, senderName, senderId, giftName, giftEmoji, giftValue) {
  try {
    return await createNotification(
      recipientId,
      'gift_received',
      `${senderName} sent you ${giftEmoji} ${giftName}!`,
      `You received ${giftValue} coins from ${senderName}`,
      senderId,
      `/#/profile/${senderId}`
    );
  } catch (err) {
    console.error('Error notifying gift received:', err);
    throw err;
  }
}

/**
 * Notify when someone receives a tip
 */
export async function notifyTipReceived(recipientId, senderName, senderId, amount) {
  try {
    return await createNotification(
      recipientId,
      'tip_received',
      `${senderName} tipped you ${amount} coins!`,
      `You received a tip from ${senderName}`,
      senderId,
      `/#/profile/${senderId}`
    );
  } catch (err) {
    console.error('Error notifying tip received:', err);
    throw err;
  }
}

/**
 * Notify when someone receives a payout
 */
export async function notifyPayoutReceived(userId, amount, tierName) {
  try {
    return await createNotification(
      userId,
      'payout_received',
      `💰 You received a $${amount.toFixed(2)} payout!`,
      `Your ${tierName} tier payout has been processed`,
      null,
      '/#/earnings'
    );
  } catch (err) {
    console.error('Error notifying payout received:', err);
    throw err;
  }
}

/**
 * Notify when someone levels up
 */
export async function notifyLevelUp(userId, oldLevel, newLevel) {
  try {
    return await createNotification(
      userId,
      'level_up',
      `🎉 You reached level ${newLevel}!`,
      `Congratulations! You advanced from level ${oldLevel} to ${newLevel}`,
      null,
      '/#/profile'
    );
  } catch (err) {
    console.error('Error notifying level up:', err);
    throw err;
  }
}

/**
 * Notify when someone unlocks something
 */
export async function notifyUnlock(userId, unlockType, itemName, itemDescription) {
  try {
    const titles = {
      'entrance_effect': `✨ New entrance effect unlocked!`,
      'badge': `🏆 New badge unlocked!`,
      'tier': `🎯 New tier unlocked!`,
      'feature': `🔓 New feature unlocked!`
    };
    
    const title = titles[unlockType] || `🎁 New ${unlockType} unlocked!`;
    
    return await createNotification(
      userId,
      'unlock',
      title,
      itemDescription || `You unlocked: ${itemName}`,
      null,
      '/#/profile'
    );
  } catch (err) {
    console.error('Error notifying unlock:', err);
    throw err;
  }
}

/**
 * Notify when someone gets a message (if message charging is enabled)
 */
export async function notifyMessageReceived(userId, senderName, senderId, messageText, coinsEarned) {
  try {
    const message = coinsEarned > 0 
      ? `${senderName} sent you a message and paid ${coinsEarned} coins`
      : `${senderName} sent you a message`;
    
    return await createNotification(
      userId,
      'message',
      `💬 New message from ${senderName}`,
      message,
      senderId,
      '/#/messages'
    );
  } catch (err) {
    console.error('Error notifying message received:', err);
    throw err;
  }
}

/**
 * Get user's unread notification count
 */
export async function getUnreadNotificationCount(userId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
    return data.length;
  } catch (err) {
    console.error('Error getting unread notification count:', err);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return false;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting notification:', err);
    return false;
  }
}