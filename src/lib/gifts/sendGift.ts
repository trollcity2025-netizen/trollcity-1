import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { GiftSendResult, GiftCatalogItem } from '@/types/gifts';

/**
 * Send a gift to a user
 * - Verifies sender has enough coins
 * - Deducts coins
 * - Creates transaction record
 * - Returns result
 */
export async function sendGift(
  receiverId: string,
  giftId: string,
  sessionId?: string
): Promise<GiftSendResult> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) {
    return { success: false, message: 'You must be logged in to send gifts' };
  }
  
  if (profile.id === receiverId) {
    return { success: false, message: 'You cannot send gifts to yourself' };
  }
  
  try {
    // Call the database function to process the gift
    const { data, error } = await supabase.rpc('send_gift', {
      p_sender_id: profile.id,
      p_receiver_id: receiverId,
      p_gift_id: giftId,
      p_session_id: sessionId || null,
    });
    
    if (error) {
      console.error('Error sending gift:', error);
      return { success: false, message: error.message || 'Failed to send gift' };
    }
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        success: result.success,
        message: result.message,
        transaction_id: result.transaction_id,
      };
    }
    
    return { success: false, message: 'Unknown error occurred' };
  } catch (err) {
    console.error('Exception sending gift:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Fetch the gift catalog from the database
 */
export async function fetchGiftCatalog(): Promise<GiftCatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from('gifts_catalog')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    
    if (error) {
      console.error('Error fetching gift catalog:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception fetching gift catalog:', err);
    return [];
  }
}

/**
 * Check if user has enough coins for a gift
 */
export async function hasEnoughCoins(giftPrice: number): Promise<boolean> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) return false;
  
  return profile.coins >= giftPrice;
}

/**
 * Get user's current coin balance
 */
export async function getCoinBalance(): Promise<number> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) return 0;
  
  // Try to get fresh balance from profile
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('coins')
      .eq('id', profile.id)
      .single();
    
    if (error) {
      console.error('Error fetching coin balance:', error);
      return profile.coins || 0;
    }
    
    return data?.coins || 0;
  } catch {
    return profile.coins || 0;
  }
}
