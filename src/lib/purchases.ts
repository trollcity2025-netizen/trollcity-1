// Purchase and Activation System
// File: src/lib/purchases.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserPurchase, PurchaseActivationOptions } from '@/types/purchases';
import {
  deductCoins,
  type CoinTransactionType,
  type CoinTransactionMetadata,
  type CoinType,
} from '@/lib/coinTransactions';

export interface StandardPurchaseFlowParams {
  userId: string;
  amount: number;
  transactionType: CoinTransactionType;
  coinType?: CoinType;
  description?: string;
  metadata?: CoinTransactionMetadata;
  supabaseClient?: SupabaseClient;
  ensureOwnership: (client: SupabaseClient) => Promise<{ success: boolean; error?: string }>;
  activate?: (client: SupabaseClient) => Promise<{ success: boolean; error?: string }>;
}

export async function runStandardPurchaseFlow(
  params: StandardPurchaseFlowParams
): Promise<{ success: boolean; error?: string }> {
  const {
    userId,
    amount,
    transactionType,
    coinType,
    description,
    metadata,
    supabaseClient,
    ensureOwnership,
    activate,
  } = params;

  const client = supabaseClient || supabase;

  const deductResult = await deductCoins({
    userId,
    amount,
    type: transactionType,
    coinType,
    description,
    metadata,
    supabaseClient: client,
  });

  if (!deductResult.success) {
    return { success: false, error: deductResult.error || 'Failed to deduct coins' };
  }

  const ownershipResult = await ensureOwnership(client);
  if (!ownershipResult.success) {
    return { success: false, error: ownershipResult.error || 'Failed to grant ownership' };
  }

  if (activate) {
    const activationResult = await activate(client);
    if (!activationResult.success) {
      return { success: false, error: activationResult.error || 'Failed to activate item' };
    }
  }

  return { success: true };
}

/**
 * Create a purchase record when user buys an item
 */
export async function createPurchase(
  userId: string,
  itemType: string,
  itemId: string,
  itemName: string,
  purchasePrice: number,
  options?: PurchaseActivationOptions,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; purchaseId?: string; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_purchases')
      .insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId,
        item_name: itemName,
        purchase_price: purchasePrice,
        is_active: options?.autoActivate || false,
        expires_at: options?.expiresAt?.toISOString() || null,
        metadata: options?.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('Purchase creation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, purchaseId: data?.id };
  } catch (err) {
    console.error('Error creating purchase:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Activate an item (set is_active = true)
 */
export async function activateItem(
  userId: string,
  itemType: string,
  itemId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    // For exclusive items (like entrance effects), deactivate others
    const exclusiveCategories = ['effect', 'broadcast_theme'];
    if (exclusiveCategories.includes(itemType)) {
      await client
        .from('user_purchases')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .neq('item_id', itemId);
    }

    // Activate the selected item
    const { error: activateError } = await client
      .from('user_purchases')
      .update({ is_active: true })
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (activateError) {
      console.error('Activation error:', activateError);
      return { success: false, error: activateError.message };
    }

    // Update user_active_items
    const categoryMap: Record<string, string> = {
      effect: 'entrance_effect',
      perk: 'perk',
      insurance: 'insurance',
      ringtone: 'audio_ringtone',
      theme: 'broadcast_theme',
      clothing: 'avatar_clothing',
    };

    const category = categoryMap[itemType];
    if (category) {
      await client
        .from('user_active_items')
        .upsert(
          {
            user_id: userId,
            item_category: category,
            item_id: itemId,
            activated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,item_category' }
        );
    }

    return { success: true };
  } catch (err) {
    console.error('Error activating item:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Deactivate an item (set is_active = false)
 */
export async function deactivateItem(
  userId: string,
  itemType: string,
  itemId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    const { error } = await client
      .from('user_purchases')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (error) {
      console.error('Deactivation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error deactivating item:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get all purchases for a user
 */
export async function getUserPurchases(
  userId: string,
  itemType?: string,
  supabaseClient?: SupabaseClient
): Promise<UserPurchase[]> {
  const client = supabaseClient || supabase;

  try {
    let query = client
      .from('user_purchases')
      .select('*')
      .eq('user_id', userId);

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching purchases:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getUserPurchases:', err);
    return [];
  }
}

/**
 * Get active items for a user
 */
export async function getUserActiveItems(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<Record<string, string>> {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_active_items')
      .select('item_category, item_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching active items:', error);
      return {};
    }

    const activeMap: Record<string, string> = {};
    (data || []).forEach((item) => {
      activeMap[item.item_category] = item.item_id;
    });

    return activeMap;
  } catch (err) {
    console.error('Error in getUserActiveItems:', err);
    return {};
  }
}

/**
 * Check if user owns a specific item
 */
export async function userOwnsPurchase(
  userId: string,
  itemType: string,
  itemId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .single();

    if (error?.code === 'PGRST116') {
      // No rows found
      return false;
    }

    if (error) {
      console.error('Error checking purchase:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in userOwnsPurchase:', err);
    return false;
  }
}

/**
 * Delete a purchase (remove item from inventory)
 */
export async function deletePurchase(
  purchaseId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    const { error } = await client
      .from('user_purchases')
      .delete()
      .eq('id', purchaseId);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error deleting purchase:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get avatar customization for user
 */
export async function getUserAvatarConfig(
  userId: string,
  supabaseClient?: SupabaseClient
) {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_avatar_customization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching avatar config:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error in getUserAvatarConfig:', err);
    return null;
  }
}

/**
 * Update avatar customization for user
 */
export async function updateUserAvatarConfig(
  userId: string,
  config: Record<string, any>,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    // Check if config exists
    const existing = await getUserAvatarConfig(userId, client);

    if (existing) {
      // Update existing
      const { error } = await client
        .from('user_avatar_customization')
        .update({
          ...config,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Update error:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Insert new
      const { error } = await client
        .from('user_avatar_customization')
        .insert({
          user_id: userId,
          ...config,
        });

      if (error) {
        console.error('Insert error:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error updating avatar config:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get all Troll Mart clothing items
 */
export async function getTrollMartItems(
  category?: string,
  supabaseClient?: SupabaseClient
) {
  const client = supabaseClient || supabase;

  try {
    let query = client
      .from('troll_mart_clothing')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching Troll Mart items:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getTrollMartItems:', err);
    return [];
  }
}

/**
 * Get user's Troll Mart purchases
 */
export async function getUserTrollMartPurchases(
  userId: string,
  supabaseClient?: SupabaseClient
) {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_troll_mart_purchases')
      .select('clothing_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user Troll Mart purchases:', error);
      return [];
    }

    return (data || []).map((row) => row.clothing_id);
  } catch (err) {
    console.error('Error in getUserTrollMartPurchases:', err);
    return [];
  }
}

/**
 * Purchase a Troll Mart item
 */
export async function purchaseTrollMartItem(
  userId: string,
  clothingId: string,
  cost: number,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = supabaseClient || supabase;

  try {
    // Insert purchase record
    const { error: insertError } = await client
      .from('user_troll_mart_purchases')
      .insert({
        user_id: userId,
        clothing_id: clothingId,
      });

    if (insertError) {
      console.error('Purchase error:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error purchasing Troll Mart item:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Check if user has purchased a specific Troll Mart item
 */
export async function userOwnsTrollMartItem(
  userId: string,
  clothingId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const client = supabaseClient || supabase;

  try {
    const { data, error } = await client
      .from('user_troll_mart_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('clothing_id', clothingId)
      .maybeSingle();

    if (error) {
      console.error('Error checking Troll Mart purchase:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in userOwnsTrollMartItem:', err);
    return false;
  }
}
