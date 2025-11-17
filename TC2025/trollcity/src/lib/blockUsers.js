import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

/**
 * Block a user
 * @param {string} userIdToBlock - The ID of the user to block
 * @param {string} reason - Optional reason for blocking
 * @returns {Promise<boolean>} - Success status
 */
export async function blockUser(userIdToBlock, reason = 'User blocked') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in to block users');
      return false;
    }

    // Prevent blocking yourself
    if (user.id === userIdToBlock) {
      toast.error('You cannot block yourself');
      return false;
    }

    // Check if already blocked
    const { data: existingBlock } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userIdToBlock)
      .single();

    if (existingBlock) {
      toast.info('User is already blocked');
      return true;
    }

    // Create the block
    const { error } = await supabase
      .from('blocked_users')
      .insert({
        blocker_id: user.id,
        blocked_id: userIdToBlock,
        reason: reason
      });

    if (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
      return false;
    }

    toast.success('User blocked successfully');
    return true;
  } catch (error) {
    console.error('Unexpected error blocking user:', error);
    toast.error('An error occurred while blocking the user');
    return false;
  }
}

/**
 * Unblock a user
 * @param {string} userIdToUnblock - The ID of the user to unblock
 * @returns {Promise<boolean>} - Success status
 */
export async function unblockUser(userIdToUnblock) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in to unblock users');
      return false;
    }

    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', userIdToUnblock);

    if (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
      return false;
    }

    toast.success('User unblocked successfully');
    return true;
  } catch (error) {
    console.error('Unexpected error unblocking user:', error);
    toast.error('An error occurred while unblocking the user');
    return false;
  }
}

/**
 * Check if a user is blocked
 * @param {string} userId - The ID of the user to check
 * @returns {Promise<boolean>} - True if blocked, false otherwise
 */
export async function isUserBlocked(userId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking if user is blocked:', error);
    }

    return !!data;
  } catch (error) {
    console.error('Unexpected error checking blocked status:', error);
    return false;
  }
}

/**
 * Get list of blocked users
 * @returns {Promise<Array>} - Array of blocked user objects
 */
export async function getBlockedUsers() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        blocked_id,
        created_at,
        reason,
        blocked_user:profiles!blocked_id(id, username, full_name, avatar_url)
      `)
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.blocked_id,
      username: item.blocked_user?.username || 'Unknown User',
      fullName: item.blocked_user?.full_name || 'Unknown User',
      avatarUrl: item.blocked_user?.avatar_url,
      blockedAt: item.created_at,
      reason: item.reason
    }));
  } catch (error) {
    console.error('Unexpected error fetching blocked users:', error);
    return [];
  }
}