/**
 * Admin Coin and Level Grant System
 * Allows admins to grant/deduct coins and levels to any user
 */

import { supabase } from './supabase'
import { ADMIN_EMAIL, isAdminEmail } from './supabase'
import { recordCoinTransaction } from './coinTransactions'

/**
 * Checks if a user is an admin
 */
export function isAdmin(user: { email?: string; role?: string } | null, profile: { role?: string; is_admin?: boolean } | null): boolean {
  if (!user && !profile) return false
  
  const email = user?.email
  const role = profile?.role || user?.role
  const isAdminFlag = profile?.is_admin

  return (
    role === 'admin' ||
    isAdminFlag === true ||
    (email && isAdminEmail(email))
  )
}

/**
 * Grants coins to an admin user without payment processing
 * @param userId - The admin user's ID
 * @param coinAmount - Number of coins to grant
 * @param packageId - Optional package ID for tracking
 * @param packageName - Optional package name for description
 * @returns Success status and new balance
 */
export type AdminGrantCoinType = 'troll_coins' | 'trollmonds'

export async function grantAdminCoins(
  userId: string,
  coinAmount: number,
  packageId?: string,
  packageName?: string,
  coinType: AdminGrantCoinType = 'troll_coins'
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, is_admin, troll_coins, trollmonds')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return { success: false, error: 'User not found' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    if (!isAdmin(user, profile)) {
      return { success: false, error: 'Only admins can grant coins' }
    }

    const targetField = coinType === 'troll_coins' ? 'troll_coins' : 'trollmonds'
    const currentBalance = profile[targetField] || 0
    const newBalance = currentBalance + coinAmount

    // Update user balance
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        [targetField]: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating balance:', updateError)
      return { success: false, error: 'Failed to update balance' }
    }

    // Insert coin transaction with admin_grant type
    const { error: txError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        type: 'admin_grant',
        amount: coinAmount,
        coin_type: coinType,
        description: packageName 
          ? `Admin grant: ${packageName} (${coinAmount.toLocaleString()} coins)`
          : `Admin grant: ${coinAmount.toLocaleString()} coins`,
        metadata: {
          package_id: packageId || null,
          package_name: packageName || null,
          granted_by: userId,
          granted_at: new Date().toISOString()
        },
        balance_after: newBalance,
        status: 'completed',
        created_at: new Date().toISOString()
      })

    if (txError) {
      console.error('Error creating transaction:', txError)
      // Rollback balance update
      await supabase
        .from('user_profiles')
        .update({ [targetField]: currentBalance })
        .eq('id', userId)
      return { success: false, error: 'Failed to create transaction record' }
    }

    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Error granting admin coins:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Deducts coins from a user (admin action)
 */
export async function deductAdminCoins(
  targetUserId: string,
  coinAmount: number,
  reason?: string,
  coinType: AdminGrantCoinType = 'troll_coins'
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, email')
      .eq('id', user?.id || '')
      .single()

    if (!isAdmin(user, adminProfile)) {
      return { success: false, error: 'Only admins can deduct coins' }
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, troll_coins, trollmonds')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      return { success: false, error: 'User not found' }
    }

    const targetField = coinType === 'troll_coins' ? 'troll_coins' : 'trollmonds'
    const currentBalance = targetProfile[targetField] || 0
    const newBalance = Math.max(0, currentBalance - coinAmount)

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        [targetField]: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)

    if (updateError) {
      return { success: false, error: 'Failed to update balance' }
    }

    const description = reason ? `Admin deduct: ${reason}` : `Admin deduct: ${coinAmount.toLocaleString()} ${coinType}`
    
    await recordCoinTransaction({
      userId: targetUserId,
      amount: -coinAmount,
      type: 'admin_deduct',
      coinType,
      description,
      metadata: {
        deducted_by: user?.id,
        reason: reason || null,
      },
      balanceAfter: newBalance,
    })

    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Error deducting admin coins:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Grants levels to a user (admin action)
 */
export async function grantAdminLevels(
  targetUserId: string,
  levelAmount: number,
  reason?: string
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, email')
      .eq('id', user?.id || '')
      .single()

    if (!isAdmin(user, adminProfile)) {
      return { success: false, error: 'Only admins can grant levels' }
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, level')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      return { success: false, error: 'User not found' }
    }

    const currentLevel = targetProfile.level || 1
    const newLevel = Math.max(1, currentLevel + levelAmount)

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)

    if (updateError) {
      return { success: false, error: 'Failed to update level' }
    }

    return { success: true, newLevel }
  } catch (error: any) {
    console.error('Error granting admin levels:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Deducts levels from a user (admin action)
 */
export async function deductAdminLevels(
  targetUserId: string,
  levelAmount: number,
  reason?: string
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, email')
      .eq('id', user?.id || '')
      .single()

    if (!isAdmin(user, adminProfile)) {
      return { success: false, error: 'Only admins can deduct levels' }
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, level')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      return { success: false, error: 'User not found' }
    }

    const currentLevel = targetProfile.level || 1
    const newLevel = Math.max(1, currentLevel - levelAmount)

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)

    if (updateError) {
      return { success: false, error: 'Failed to update level' }
    }

    return { success: true, newLevel }
  } catch (error: any) {
    console.error('Error deducting admin levels:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

