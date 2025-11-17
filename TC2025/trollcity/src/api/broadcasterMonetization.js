import { supabase } from './supabaseClient';

/**
 * Get high-paying broadcasters who spend $1000+ per month
 */
export async function getHighPayingBroadcasters() {
  try {
    const { data, error } = await supabase.rpc('get_current_high_paying_broadcasters');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map((r) => ({
      id: r.user_id || r.id,
      username: r.username,
      avatar: r.avatar_url || r.avatar,
      monthly_spending: Math.round(((r.total_spent ?? 0) / 100)),
    }));
  } catch (error) {
    console.error('Error getting high-paying broadcasters:', error);
    return [];
  }
}

/**
 * Update broadcaster monthly spending
 */
export async function updateBroadcasterSpending(userId, amount) {
  try {
    const { data, error } = await supabase
      .rpc('update_broadcaster_spending', {
        p_user_id: userId,
        p_amount: amount
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating broadcaster spending:', error);
    throw error;
  }
}

/**
 * Purchase YouTube Music feature for live streams (3000 coins)
 */
export async function purchaseYouTubeMusic(userId, streamId) {
  try {
    // Check if user has enough paid coins
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('paid_coins')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    if (profile.paid_coins < 3000) {
      throw new Error('Insufficient paid coins. You need 3000 paid coins for YouTube Music feature.');
    }

    // Deduct coins and create purchase record
    const { error: transactionError } = await supabase.rpc('purchase_youtube_music', {
      p_user_id: userId,
      p_stream_id: streamId,
      p_cost: 3000
    });

    if (transactionError) throw transactionError;

    return {
      success: true,
      message: 'YouTube Music feature purchased successfully!',
      cost: 3000
    };
  } catch (error) {
    console.error('Error purchasing YouTube Music:', error);
    throw error;
  }
}

/**
 * Check if user has YouTube Music feature for a stream
 */
export async function hasYouTubeMusicFeature(userId, streamId) {
  try {
    const { data, error } = await supabase
      .from('youtube_music_purchases')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('stream_id', streamId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found

    if (!data) return false;

    // Check if purchase has expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    return now < expiresAt;
  } catch (error) {
    console.error('Error checking YouTube Music feature:', error);
    return false;
  }
}

/**
 * Get broadcaster box assignments (admin function)
 */
export async function getBroadcasterBoxes() {
  try {
    const { data, error } = await supabase
      .from('broadcaster_boxes')
      .select(`
        *,
        assigned_user:profiles!broadcaster_boxes_assigned_user_id_fkey(
          id,
          username,
          avatar_url
        )
      `)
      .order('box_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting broadcaster boxes:', error);
    return [];
  }
}

/**
 * Assign broadcaster to a box (admin function)
 */
export async function assignBroadcasterBox(boxId, userId, description) {
  try {
    const { data, error } = await supabase
      .from('broadcaster_boxes')
      .update({
        assigned_user_id: userId,
        description: description,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', boxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error assigning broadcaster box:', error);
    throw error;
  }
}

/**
 * Clear broadcaster box assignment (admin function)
 */
export async function clearBroadcasterBox(boxId) {
  try {
    const { data, error } = await supabase
      .from('broadcaster_boxes')
      .update({
        assigned_user_id: null,
        description: null,
        assigned_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', boxId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error clearing broadcaster box:', error);
    throw error;
  }
}
