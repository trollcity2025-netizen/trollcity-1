import { supabase } from './supabase';
import { UserProfile } from './supabase';

// TrollTract utility functions for managing creator benefits

export interface GiftCalculationResult {
  baseAmount: number;
  bonusAmount: number;
  totalAmount: number;
  isTrollTractCreator: boolean;
  bonusPercentage: number;
}

/**
 * Calculate TrollTract bonus for a gift transaction
 * @param giftAmount - The base gift amount
 * @param recipientProfile - The recipient's profile
 * @returns GiftCalculationResult with bonus details
 */
export async function calculateTrollTractGiftBonus(
  giftAmount: number,
  recipientProfile: UserProfile
): Promise<GiftCalculationResult> {
  
  const result: GiftCalculationResult = {
    baseAmount: giftAmount,
    bonusAmount: 0,
    totalAmount: giftAmount,
    isTrollTractCreator: false,
    bonusPercentage: 0
  };

  // Check if recipient has TrollTract activated
  if (!recipientProfile.is_trolltract) {
    return result;
  }

  result.isTrollTractCreator = true;
  result.bonusPercentage = 10;

  // Calculate 10% bonus
  result.bonusAmount = Math.floor(giftAmount * 0.10);
  result.totalAmount = giftAmount + result.bonusAmount;

  return result;
}

/**
 * Log TrollTract bonus transaction to database
 * @param userId - The TrollTract creator's user ID
 * @param giftAmount - Base gift amount
 * @param bonusAmount - Calculated bonus amount
 * @param totalAmount - Total amount (base + bonus)
 * @param giftId - Optional gift ID
 * @param streamId - Optional stream ID
 * @param senderId - Optional sender ID
 */
export async function logTrollTractBonus(
  userId: string,
  giftAmount: number,
  bonusAmount: number,
  totalAmount: number,
  giftId?: string,
  streamId?: string,
  senderId?: string
): Promise<void> {
  
  try {
    const { error } = await supabase
      .from('trolltract_bonus_log')
      .insert({
        user_id: userId,
        base_amount: giftAmount,
        bonus_amount: bonusAmount,
        total_amount: totalAmount,
        gift_id: giftId || null,
        stream_id: streamId || null,
        sender_id: senderId || null
      });

    if (error) {
      console.error('Error logging TrollTract bonus:', error);
      // Don't throw error - logging failure shouldn't break gift processing
    }
  } catch (error) {
    console.error('Failed to log TrollTract bonus:', error);
  }
}

/**
 * Apply TrollTract bonus to a creator's earnings
 * This function should be called after successful gift processing
 * @param recipientId - The TrollTract creator's user ID
 * @param giftAmount - Base gift amount
 * @param giftId - Optional gift ID
 * @param streamId - Optional stream ID
 * @param senderId - Optional sender ID
 */
export async function applyTrollTractBonus(
  recipientId: string,
  giftAmount: number,
  giftId?: string,
  streamId?: string,
  senderId?: string
): Promise<GiftCalculationResult> {
  
  try {
    // Get recipient profile
    const { data: recipientProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', recipientId)
      .single();

    if (!recipientProfile) {
      throw new Error('Recipient profile not found');
    }

    // Calculate bonus
    const calculation = await calculateTrollTractGiftBonus(giftAmount, recipientProfile);

    // Log the bonus if creator has TrollTract
    if (calculation.isTrollTractCreator && calculation.bonusAmount > 0) {
      await logTrollTractBonus(
        recipientId,
        calculation.baseAmount,
        calculation.bonusAmount,
        calculation.totalAmount,
        giftId,
        streamId,
        senderId
      );
    }

    return calculation;

  } catch (error) {
    console.error('Error applying TrollTract bonus:', error);
    
    // Return basic calculation without bonus on error
    return {
      baseAmount: giftAmount,
      bonusAmount: 0,
      totalAmount: giftAmount,
      isTrollTractCreator: false,
      bonusPercentage: 0
    };
  }
}

/**
 * Calculate ranking boost for TrollTract creators
 * @param baseScore - The base ranking score
 * @param creatorProfile - The creator's profile
 * @returns Boosted score with TrollTract multiplier
 */
export function calculateTrollTractRankingBoost(
  baseScore: number,
  creatorProfile: UserProfile
): number {
  
  if (!creatorProfile.is_trolltract) {
    return baseScore;
  }

  // Apply 25% boost for TrollTract creators
  const boostedScore = baseScore * 1.25;
  
  return Math.round(boostedScore);
}

/**
 * Check if user has access to TrollTract features
 * @param profile - User profile to check
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
    hasShadowMode: hasTrollTract,
    hasCreatorBadge: hasTrollTract,
    bonusPercentage: hasTrollTract ? 10 : 0,
    rankingBoostPercentage: hasTrollTract ? 25 : 0
  };
}

/**
 * Get TrollTract statistics for a creator
 * @param userId - Creator's user ID
 * @returns Object with TrollTract stats
 */
export async function getTrollTractStats(userId: string) {
  try {
    // Get total bonus earned
    const { data: bonusData } = await supabase
      .from('trolltract_bonus_log')
      .select('bonus_amount, total_amount, created_at')
      .eq('user_id', userId)
      .gt('bonus_amount', 0);

    // Get activation date
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('trolltract_activated_at')
      .eq('id', userId)
      .single();

    const totalBonus = bonusData?.reduce((sum, log) => sum + log.bonus_amount, 0) || 0;
    const totalEarnings = bonusData?.reduce((sum, log) => sum + log.total_amount, 0) || 0;
    const bonusCount = bonusData?.length || 0;
    
    const activatedAt = profileData?.trolltract_activated_at 
      ? new Date(profileData.trolltract_activated_at) 
      : null;
    
    const daysActive = activatedAt 
      ? Math.floor((Date.now() - activatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalBonus,
      totalEarnings,
      bonusCount,
      daysActive,
      activatedAt,
      averageBonusPerDay: daysActive > 0 ? Math.round(totalBonus / daysActive) : 0
    };

  } catch (error) {
    console.error('Error getting TrollTract stats:', error);
    return {
      totalBonus: 0,
      totalEarnings: 0,
      bonusCount: 0,
      daysActive: 0,
      activatedAt: null,
      averageBonusPerDay: 0
    };
  }
}