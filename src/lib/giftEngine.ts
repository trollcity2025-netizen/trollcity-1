import { supabase } from './supabase';
import { UserProfile } from './supabase';
import { deductCoins, addCoins } from './coinTransactions';
import giftCatalog, { giftCategories, tierPriority } from './giftCatalog';

const BROADCASTER_SHARE = 0.95;
const PLATFORM_SHARE = 1 - BROADCASTER_SHARE;
const INVENTORY_TABLE = 'gifts_owned';
const TRANSACTION_TABLE = 'gift_transactions';

export interface GiftProcessingResult {
  creatorId: string;
  baseAmount: number;
  bonusAmount: number;
  totalAmount: number;
  isTrollTractCreator: boolean;
  giftId?: string;
  streamId?: string;
  senderId?: string;
}

export function getGiftCatalog() {
  return giftCatalog;
}

export function getGiftCategories() {
  return giftCategories;
}

export function getTierPriority() {
  return tierPriority;
}

export function findGiftBySlug(giftSlug: string) {
  return giftCatalog.find((gift) => gift.gift_slug === giftSlug) || null;
}

async function upsertInventory(userId: string, giftSlug: string, quantityDelta: number) {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TABLE)
      .select('quantity')
      .eq('user_id', userId)
      .eq('gift_slug', giftSlug)
      .maybeSingle();

    if (error) {
      console.warn('Gift inventory select failed', error);
      return null;
    }

    if (data) {
      const updatedQuantity = Math.max(0, data.quantity + quantityDelta);
      if (updatedQuantity <= 0) {
        await supabase
          .from(INVENTORY_TABLE)
          .delete()
          .eq('user_id', userId)
          .eq('gift_slug', giftSlug);
      } else {
        await supabase
          .from(INVENTORY_TABLE)
          .update({
            quantity: updatedQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('gift_slug', giftSlug);
      }

      return updatedQuantity;
    }

    if (quantityDelta > 0) {
      const timestamp = new Date().toISOString();
      const { error: insertError } = await supabase
        .from(INVENTORY_TABLE)
        .insert({
          user_id: userId,
          gift_slug: giftSlug,
          quantity: quantityDelta,
          created_at: timestamp,
          updated_at: timestamp
        });

      if (insertError) {
        console.warn('Failed to seed gift inventory', insertError);
        return null;
      }

      return quantityDelta;
    }

    return 0;
  } catch (err) {
    console.warn('Inventory table unavailable', err);
    return null;
  }
}

async function logGiftLedger(rows: any[]) {
  if (!rows.length) return;

  try {
    await supabase.from(TRANSACTION_TABLE).insert(rows);
  } catch (err) {
    console.warn('Gift ledger unavailable', err);
  }
}

export async function purchaseGift({ userId, giftSlug, quantity = 1 }: { userId: string; giftSlug: string; quantity?: number }) {
  const gift = findGiftBySlug(giftSlug);
  if (!gift) {
    return { success: false, error: 'Gift not found' };
  }

  const totalCost = gift.coinCost * quantity;
  const deduction = await deductCoins({
    userId,
    amount: totalCost,
    type: 'purchase',
    description: `Troll Gift: ${gift.name}`,
    metadata: { giftSlug, quantity }
  });

  if (!deduction.success) {
    return { success: false, error: deduction.error || 'Unable to deduct coins' };
  }

  // Revenue Sync: Log purchase to ledger
  try {
    const { data: dbItem } = await supabase
      .from('purchasable_items')
      .select('id')
      .eq('item_key', giftSlug)
      .maybeSingle();

    if (dbItem) {
      await supabase.from('purchase_ledger').insert({
        user_id: userId,
        item_id: dbItem.id,
        coin_amount: totalCost,
        payment_method: 'coins',
        source_context: 'purchaseGift',
        metadata: { giftSlug, quantity }
      });
    }
  } catch (err) {
    console.warn('Failed to log purchase ledger', err);
  }

  const newQuantity = await upsertInventory(userId, giftSlug, quantity);

  return {
    success: true,
    gift,
    purchasedQuantity: quantity,
    inventoryQuantity: newQuantity ?? null,
    remainingBalance: deduction.newBalance
  };
}

export async function getUserInventory(userId: string) {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TABLE)
      .select('gift_slug,quantity')
      .eq('user_id', userId);

    if (error) {
      console.warn('Gift inventory load error', error);
      return [];
    }

    if (!Array.isArray(data)) return [];

    return data.map((row) => ({
      giftSlug: row.gift_slug,
      quantity: row.quantity,
      gift: findGiftBySlug(row.gift_slug)
    }));
  } catch (err) {
    console.warn('Gift inventory missing table', err);
    return [];
  }
}

export async function sendGiftFromInventory({
  senderId,
  giftSlug,
  quantity = 1,
  receiverId,
  streamId = null,
  context = 'gift_tray'
}: {
  senderId: string;
  giftSlug: string;
  quantity?: number;
  receiverId: string;
  streamId?: string | null;
  context?: string;
}) {
  if (quantity <= 0) {
    return { success: false, error: 'Quantity must be positive' };
  }

  const gift = findGiftBySlug(giftSlug);
  if (!gift) {
    return { success: false, error: 'Gift not found' };
  }

  if (!senderId || !receiverId) {
    return { success: false, error: 'Sender or receiver missing' };
  }

  const { data: inventory } = await supabase
    .from(INVENTORY_TABLE)
    .select('quantity')
    .eq('user_id', senderId)
    .eq('gift_slug', giftSlug)
    .maybeSingle();

  const available = inventory?.quantity || 0;
  if (available < quantity) {
    return { success: false, error: 'Not enough gifts' };
  }

  await upsertInventory(senderId, giftSlug, -quantity);

  const sentValue = gift.coinCost * quantity;
  let trollPassBonus = 0;
  
  // Calculate broadcaster share
  let broadcasterEarnings = Math.floor(sentValue * BROADCASTER_SHARE);
  const platformPortion = sentValue - broadcasterEarnings;

  // Apply TrollTract bonus if applicable
  const trollTractResult = await processGiftWithTrollTractBonus(
    receiverId,
    broadcasterEarnings,
    undefined, // giftId will be assigned after ledger log
    streamId || undefined,
    senderId
  );

  if (trollTractResult.isTrollTractCreator) {
    broadcasterEarnings = trollTractResult.totalAmount;
  }

  const ledgerRows = [
    {
      from_user_id: senderId,
      to_user_id: receiverId,
      gift_slug: giftSlug,
      type: 'sent',
      quantity,
      coins: sentValue,
      stream_id: streamId,
      description: gift.name,
      metadata: {
        giftSlug,
        context,
        animation: gift.animationType,
        tier: gift.tier,
        platform_share_percentage: PLATFORM_SHARE,
        broadcaster_share_percentage: BROADCASTER_SHARE,
        platform_coins: platformPortion,
        broadcaster_coins: broadcasterEarnings,
        trolltract_bonus: trollTractResult.bonusAmount,
        sender_id: senderId
      }
    }
  ];

  if (receiverId) {
    ledgerRows.push({
      from_user_id: senderId,
      to_user_id: receiverId,
      gift_slug: giftSlug,
      type: 'received',
      quantity,
      coins: broadcasterEarnings,
      stream_id: streamId,
      description: `Received ${gift.name}`,
      metadata: {
        giftSlug,
        context,
        animation: gift.animationType,
        tier: gift.tier,
        platform_share_percentage: PLATFORM_SHARE,
        broadcaster_share_percentage: BROADCASTER_SHARE,
        platform_coins: platformPortion,
        broadcaster_coins: broadcasterEarnings,
        trolltract_bonus: trollTractResult.bonusAmount,
        sender_id: senderId
      }
    });
  }

  await logGiftLedger(ledgerRows);

  if (broadcasterEarnings > 0) {
    try {
      await addCoins({
        userId: receiverId,
        amount: broadcasterEarnings,
        type: 'gift_received',
        coinType: 'troll_coins',
        description: `Gift earnings: ${gift.name}${trollTractResult.isTrollTractCreator ? ' (+10% TrollTract Bonus)' : ''}`,
        metadata: {
          giftSlug,
          senderId,
          quantity,
          streamId,
          context,
          trolltract_bonus: trollTractResult.bonusAmount
        }
      });
    } catch (err) {
      console.warn('Failed to credit broadcaster', err);
    }
  }
 
  try {
    const { data: senderProfile } = await supabase
      .from('user_profiles')
      .select('troll_pass_expires_at')
      .eq('id', senderId)
      .single();
    const tpExpire = senderProfile?.troll_pass_expires_at;
    const isTrollPassActive = tpExpire && new Date(tpExpire) > new Date();
    if (isTrollPassActive) {
      const bonusAmount = Math.floor(sentValue * 0.05);
      if (bonusAmount > 0) {
        const { success } = await addCoins({
          userId: senderId,
          amount: bonusAmount,
          type: 'reward',
          coinType: 'troll_coins',
          description: 'Troll Pass 5% gift bonus',
          metadata: {
            giftSlug,
            quantity,
            streamId,
            bonus_pct: 5,
            source: 'troll_pass'
          }
        });
        if (success) {
          trollPassBonus = bonusAmount;
        }
      }
    }
  } catch {}

  return {
    success: true,
    gift,
    quantity,
    broadcasterEarnings,
    totalValue: sentValue,
    trollTractBonus: trollTractResult.bonusAmount,
    trollPassBonus
  };
}

/**
 * Process a gift with TrollTract bonus calculation
 * This function should be called whenever a gift is processed in your system
 * 
 * @param creatorId - The broadcaster/creator's user ID
 * @param giftAmount - The base gift amount in coins
 * @param giftId - Optional gift transaction ID
 * @param streamId - Optional stream ID
 * @param senderId - Optional sender's user ID
 * @returns GiftProcessingResult with bonus details
 */
export async function processGiftWithTrollTractBonus(
  creatorId: string,
  giftAmount: number,
  giftId?: string,
  streamId?: string,
  senderId?: string
): Promise<GiftProcessingResult> {
  
  const result: GiftProcessingResult = {
    creatorId,
    baseAmount: giftAmount,
    bonusAmount: 0,
    totalAmount: giftAmount,
    isTrollTractCreator: false,
    giftId,
    streamId,
    senderId
  };

  try {
    // Get creator profile to check TrollTract status
    const { data: creatorProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_trolltract')
      .eq('id', creatorId)
      .single();

    if (profileError) {
      console.error('Error fetching creator profile:', profileError);
      return result;
    }

    // Check if creator has TrollTract activated
    if (!creatorProfile?.is_trolltract) {
      return result;
    }

    result.isTrollTractCreator = true;

    // Calculate 10% bonus
    const bonusAmount = Math.floor(giftAmount * 0.10);
    result.bonusAmount = bonusAmount;
    result.totalAmount = giftAmount + bonusAmount;

    // Log the bonus to trolltract_bonus_log table
    const { error: logError } = await supabase
      .from('trolltract_bonus_log')
      .insert({
        user_id: creatorId,
        gift_id: giftId || null,
        stream_id: streamId || null,
        base_amount: giftAmount,
        bonus_amount: bonusAmount,
        total_amount: result.totalAmount,
        sender_id: senderId || null
      });

    if (logError) {
      console.error('Error logging TrollTract bonus:', logError);
      // Don't fail the whole process for logging errors
    }

    return result;

  } catch (error) {
    console.error('Error processing gift with TrollTract bonus:', error);
    return result;
  }
}

/**
 * Apply TrollTract ranking boost to a creator's score
 * Use this in your ranking/discovery algorithms
 * 
 * @param baseScore - The base ranking score
 * @param creatorId - The creator's user ID
 * @returns Boosted score with TrollTract multiplier
 */
export async function applyTrollTractRankingBoost(
  baseScore: number,
  creatorId: string
): Promise<number> {
  
  try {
    // Get creator profile to check TrollTract status
    const { data: creatorProfile } = await supabase
      .from('user_profiles')
      .select('is_trolltract')
      .eq('id', creatorId)
      .single();

    // If creator has TrollTract, apply 25% boost
    if (creatorProfile?.is_trolltract) {
      const boostedScore = Math.round(baseScore * 1.25);
      return boostedScore;
    }

    return baseScore;

  } catch (error) {
    console.error('Error applying TrollTract ranking boost:', error);
    return baseScore;
  }
}

/**
 * Get TrollTract statistics for a creator
 * Useful for dashboards and analytics
 * 
 * @param creatorId - The creator's user ID
 * @returns Object with TrollTract statistics
 */
export async function getTrollTractCreatorStats(creatorId: string) {
  try {
    // Get basic profile info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_trolltract, trolltract_activated_at')
      .eq('id', creatorId)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get bonus statistics
    const { data: bonusData } = await supabase
      .from('trolltract_bonus_log')
      .select('bonus_amount, total_amount, created_at')
      .eq('user_id', creatorId)
      .gt('bonus_amount', 0)
      .order('created_at', { ascending: false });

    const totalBonus = bonusData?.reduce((sum, log) => sum + log.bonus_amount, 0) || 0;
    const totalEarnings = bonusData?.reduce((sum, log) => sum + log.total_amount, 0) || 0;
    const bonusCount = bonusData?.length || 0;

    // Calculate days active
    const activatedAt = profile.trolltract_activated_at 
      ? new Date(profile.trolltract_activated_at) 
      : null;
    
    const daysActive = activatedAt 
      ? Math.floor((Date.now() - activatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      isTrollTractCreator: profile.is_trolltract,
      activatedAt: profile.trolltract_activated_at,
      daysActive,
      totalBonus,
      totalEarnings,
      bonusCount,
      averageBonusPerDay: daysActive > 0 ? Math.round(totalBonus / daysActive) : 0,
      averageBonusPerGift: bonusCount > 0 ? Math.round(totalBonus / bonusCount) : 0
    };

  } catch (error) {
    console.error('Error getting TrollTract stats:', error);
    return {
      isTrollTractCreator: false,
      activatedAt: null,
      daysActive: 0,
      totalBonus: 0,
      totalEarnings: 0,
      bonusCount: 0,
      averageBonusPerDay: 0,
      averageBonusPerGift: 0
    };
  }
}

/**
 * Check if a user has access to TrollTract features
 * Utility function for feature gating
 * 
 * @param profile - User profile object
 * @returns Object with feature access status
 */
export function getTrollTractFeatureAccess(profile: UserProfile) {
  const hasTrollTract = profile.is_trolltract;
  
  return {
    hasTrollTract,
    canAccessCreatorDashboard: hasTrollTract,
    getsBonusEarnings: hasTrollTract,
    getsRankingBoost: hasTrollTract,
    canApplyForFeatured: hasTrollTract,
    hasCreatorBadge: hasTrollTract,
    bonusPercentage: hasTrollTract ? 10 : 0,
    rankingBoostPercentage: hasTrollTract ? 25 : 0
  };
}
