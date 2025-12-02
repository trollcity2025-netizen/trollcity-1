/**
 * Admin Coin Grant System
 * Allows admins to grant coins to themselves without payment processing
 */

import { supabase } from './supabase'
import { ADMIN_EMAIL, isAdminEmail } from './supabase'
import { useAuthStore } from './store'

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
export async function grantAdminCoins(
  userId: string,
  coinAmount: number,
  packageId?: string,
  packageName?: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, is_admin, paid_coin_balance')
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

    // Get current balance
    const currentBalance = profile.paid_coin_balance || 0
    const newBalance = currentBalance + coinAmount

    // Update user balance
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        paid_coin_balance: newBalance,
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
        coin_type: 'paid',
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
        .update({ paid_coin_balance: currentBalance })
        .eq('id', userId)
      return { success: false, error: 'Failed to create transaction record' }
    }

    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Error granting admin coins:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

