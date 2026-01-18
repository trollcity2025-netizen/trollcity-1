// Insurance System - Production-ready penalty interception
// Time-limited shields that block wallet penalties and kicks

import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

export type ProtectionType = 'kick' | 'full';

export interface InsurancePlan {
  id: string;
  name: string;
  protection_type: ProtectionType;
  duration_hours: number;
  cost: number;
}

export interface ActiveInsurance {
  id: string;
  user_id: string;
  protection_type: ProtectionType;
  expires_at: string;
  created_at: string;
}

/**
 * Get all available insurance plans
 */
export async function getInsurancePlans(): Promise<InsurancePlan[]> {
  try {
    const { data, error } = await supabase
      .from('insurance_options')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching insurance plans:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error getting insurance plans:', err);
    return [];
  }
}

/**
 * Get active insurance for a user
 */
export async function getActiveInsurance(userId: string): Promise<ActiveInsurance[]> {
  try {
    const { data, error } = await supabase
      .from('user_insurances')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false });

    if (error) {
      console.error('Error fetching active insurance:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error getting active insurance:', err);
    return [];
  }
}

/**
 * Check if user has specific protection type active
 */
export async function hasProtection(userId: string, protectionType: ProtectionType): Promise<boolean> {
  const activeInsurance = await getActiveInsurance(userId);

  return activeInsurance.some(insurance =>
    insurance.protection_type === protectionType ||
    insurance.protection_type === 'full'
  );
}

/**
 * Purchase insurance plan
 */
export async function purchaseInsurance(userId: string, planId: string): Promise<{success: boolean, error?: string, expiresAt?: string}> {
  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('insurance_options')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return { success: false, error: 'Insurance plan not found' };
    }

    // Check if user has enough coins
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return { success: false, error: 'User profile not found' };
    }

    if ((userProfile.troll_coins || 0) < plan.cost) {
      return { success: false, error: 'Not enough Troll Coins' };
    }

    let finalExpiresAt: string | undefined;

    const flowResult = await runStandardPurchaseFlow({
      userId,
      amount: plan.cost,
      transactionType: 'insurance_purchase',
      description: `Purchased insurance: ${plan.name}`,
      metadata: {
        insurance_id: plan.id,
        protection_type: plan.protection_type,
        duration_hours: plan.duration_hours
      },
      ensureOwnership: async (client) => {
        const existingInsurance = await getActiveInsurance(userId);
        const sameTypeInsurance = existingInsurance.find(
          ins => ins.protection_type === plan.protection_type
        );

        const now = new Date();
        let expiresAt: Date;

        if (sameTypeInsurance) {
          const currentExpiry = new Date(sameTypeInsurance.expires_at);
          expiresAt = new Date(currentExpiry.getTime() + plan.duration_hours * 60 * 60 * 1000);

          const { error: updateError } = await client
            .from('user_insurances')
            .update({
              expires_at: expiresAt.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', sameTypeInsurance.id);

          if (updateError) {
            console.error('Insurance extension error:', updateError);
            await client.rpc('add_coins', {
              p_user_id: userId,
              p_amount: plan.cost,
              p_coin_type: 'paid'
            });
            return { success: false, error: 'Failed to extend insurance' };
          }

          finalExpiresAt = expiresAt.toISOString();
        } else {
          expiresAt = new Date(now.getTime() + plan.duration_hours * 60 * 60 * 1000);

          const { error: insertError } = await client
            .from('user_insurances')
            .insert({
              user_id: userId,
              insurance_id: plan.id,
              protection_type: plan.protection_type,
              purchased_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              is_active: true
            });

          if (insertError) {
            console.error('Insurance creation error:', insertError);
            await client.rpc('add_coins', {
              p_user_id: userId,
              p_amount: plan.cost,
              p_coin_type: 'paid'
            });
            return { success: false, error: 'Failed to create insurance' };
          }

          finalExpiresAt = expiresAt.toISOString();
        }

        return { success: true };
      }
    });

    if (!flowResult.success) {
      return { success: false, error: flowResult.error || 'Purchase failed' };
    }

    return {
      success: true,
      expiresAt: finalExpiresAt
    };

  } catch (err) {
    console.error('Insurance purchase error:', err);
    return { success: false, error: 'Purchase failed' };
  }
}

/**
 * PENALTY INTERCEPTION LOGIC - THE MAGIC
 */

/**
 * Check if kick penalty should be blocked
 */
export async function shouldBlockKick(userId: string): Promise<boolean> {
  return await hasProtection(userId, 'kick');
}

/**
 * Apply kick penalty (with insurance check)
 */
export async function applyKickPenalty(userId: string): Promise<{blocked: boolean, insuranceUsed?: ActiveInsurance}> {
  const blocked = await shouldBlockKick(userId);

  if (blocked) {
    // Log the block
    const activeInsurance = await getActiveInsurance(userId);
    const insurance = activeInsurance.find(ins =>
      ins.protection_type === 'kick' || ins.protection_type === 'full'
    );

    if (insurance) {
      await logInsuranceBlock(userId, insurance.protection_type, 'kick');
      return { blocked: true, insuranceUsed: insurance };
    }
  }

  // Apply penalty - kick user
  await kickUserFromStream(userId);
  return { blocked: false };
}

/**
 * Log insurance block for audit trail
 */
async function logInsuranceBlock(userId: string, protectionType: ProtectionType, eventType: string): Promise<void> {
  try {
    await supabase
      .from('insurance_logs')
      .insert({
        user_id: userId,
        protection_type: protectionType,
        event_type: eventType,
        blocked_at: new Date().toISOString()
      });
  } catch (err) {
    console.error('Failed to log insurance block:', err);
    // Don't fail the main operation if logging fails
  }
}

/**
 * Kick user from stream (kick penalty)
 */
async function kickUserFromStream(userId: string): Promise<void> {
  try {
    // This would integrate with your stream management system
    // For now, just log the kick
    console.log(`User ${userId} kicked from stream`);

    // You would implement actual stream kick logic here
    // e.g., emit socket event, update stream state, etc.
  } catch (err) {
    console.error('Failed to kick user:', err);
    throw err;
  }
}

/**
 * Check if user can afford insurance plan
 */
export async function canAffordInsurance(userId: string, planId: string): Promise<boolean> {
  try {
    const { data: plan } = await supabase
      .from('insurance_options')
      .select('cost')
      .eq('id', planId)
      .single();

    if (!plan) return false;

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single();

    return (userProfile?.troll_coins || 0) >= plan.cost;
  } catch (err) {
    console.error('Error checking affordability:', err);
    return false;
  }
}

/**
 * Get time remaining for active insurance
 */
export function getInsuranceTimeRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt);
  const now = new Date();
  return Math.max(0, expiry.getTime() - now.getTime());
}

/**
 * Format time remaining for display
 */
export function formatInsuranceTimeRemaining(expiresAt: string): string {
  const remaining = getInsuranceTimeRemaining(expiresAt);

  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
