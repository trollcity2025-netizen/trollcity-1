/**
 * Admin Economy Management
 * Handles admin-specific coin operations
 */

import { supabase } from './supabase'

/**
 * Reset admin coins to 0
 */
export async function resetAdminEconomy(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'No authenticated user' }
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { success: false, error: 'Profile not found' }
    }

    const isAdmin = profile.role === 'admin' || profile.is_admin === true
    if (!isAdmin) {
      return { success: false, error: 'Only admins can perform this action' }
    }

    // Reset coins to 0
    // Update user profile coins
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({
        troll_coins: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError)
      return { success: false, error: 'Failed to update profile' }
    }

    // Log the transaction
    const { error: txError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        type: 'admin_reset',
        amount: 0,
        coin_type: 'paid',
        description: 'Admin economy reset - coins set to 0',
        metadata: {
          action: 'admin_economy_reset',
          reset_coins: true,
          reset_at: new Date().toISOString()
        },
        balance_after: 0,
        status: 'completed',
        created_at: new Date().toISOString()
      })

    if (txError) {
      console.warn('Could not log transaction:', txError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Admin economy reset error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Check if user has access to a specific route based on their role
 */
export function hasRouteAccess(userRole: string, isLeadOfficer: boolean, route: string): boolean {
  // Admin can access everything
  if (userRole === 'admin') {
    return true
  }

  // Lead officers can access everything except admin routes
  if (isLeadOfficer) {
    const adminRoutes = ['/admin', '/rfc', '/changelog', '/admin/']
    return !adminRoutes.some(adminRoute => route.startsWith(adminRoute))
  }

  // Regular users and troll officers have restricted access
  const allowedRoutes = [
    '/', '/messages', '/following', '/store', '/transactions',
    '/shop-partner', '/sell', '/creator-contract',
    '/leaderboard', '/wall', '/go-live',
    '/tromody', '/battles', '/empire-partner', '/trollifications',
    '/apply', '/earnings', '/support', '/safety'
  ]

  return allowedRoutes.some(allowedRoute => route.startsWith(allowedRoute))
}

/**
 * Get the appropriate access level for a user
 */
export function getUserAccessLevel(userRole: string, isLeadOfficer: boolean): 'admin' | 'lead_officer' | 'user' {
  if (userRole === 'admin') {
    return 'admin'
  }
  if (isLeadOfficer) {
    return 'lead_officer'
  }
  return 'user'
}