import { supabase } from './supabase';
import { UserProfile } from './supabase';

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

// Example usage in your existing gift processing code:
/*
// BEFORE (existing gift processing):
async function processGift(creatorId: string, giftAmount: number, senderId: string) {
  // Update creator's earnings
  await updateCreatorEarnings(creatorId, giftAmount);
  
  // Log the transaction
  await logGiftTransaction(creatorId, giftAmount, senderId);
}

// AFTER (with TrollTract integration):
async function processGift(creatorId: string, giftAmount: number, senderId: string) {
  // Process gift with TrollTract bonus
  const result = await processGiftWithTrollTractBonus(creatorId, giftAmount, undefined, undefined, senderId);
  
  // Update creator's earnings (use result.totalAmount which includes bonus)
  await updateCreatorEarnings(creatorId, result.totalAmount);
  
  // Log the transaction
  await logGiftTransaction(creatorId, giftAmount, senderId);
  
  if (result.isTrollTractCreator) {
    console.log(`TrollTract bonus applied: +${result.bonusAmount} coins`);
  }
}
*/