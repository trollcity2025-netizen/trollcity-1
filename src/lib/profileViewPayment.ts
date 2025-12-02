// Profile View Payment Logic
import { supabase } from './supabase'
import { toast } from 'sonner'
import { NavigateFunction } from 'react-router-dom'

/**
 * Check if user has enough coins to view a profile
 * @param viewerId - The user trying to view the profile
 * @param profileOwnerId - The profile owner's ID
 * @param profileViewPrice - The price to view the profile
 * @returns true if user can view, false if they need more coins
 */
export async function checkProfileViewPayment(
  viewerId: string,
  profileOwnerId: string,
  profileViewPrice: number | null
): Promise<{ canView: boolean; requiredCoins?: number }> {
  // No price set, free to view
  if (!profileViewPrice || profileViewPrice <= 0) {
    return { canView: true }
  }

  // Can't charge yourself
  if (viewerId === profileOwnerId) {
    return { canView: true }
  }

  // Get viewer's balance
  const { data: viewerProfile, error } = await supabase
    .from('user_profiles')
    .select('paid_coin_balance, role, is_troll_officer, is_troller')
    .eq('id', viewerId)
    .single()

  if (error || !viewerProfile) {
    console.error('Error checking viewer balance:', error)
    return { canView: false, requiredCoins: profileViewPrice }
  }

  // Admins, officers, and trollers view for free
  if (
    viewerProfile.role === 'admin' ||
    viewerProfile.is_troll_officer ||
    viewerProfile.is_troller
  ) {
    return { canView: true }
  }

  // Check balance
  const balance = viewerProfile.paid_coin_balance || 0
  if (balance < profileViewPrice) {
    return { canView: false, requiredCoins: profileViewPrice }
  }

  return { canView: true }
}

/**
 * Charge user for viewing a profile
 * @param viewerId - The user viewing the profile
 * @param profileOwnerId - The profile owner's ID
 * @param profileViewPrice - The price to view the profile
 * @returns success status and transaction ID
 */
export async function chargeProfileView(
  viewerId: string,
  profileOwnerId: string,
  profileViewPrice: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    // Deduct from viewer
    const { data: viewerProfile, error: viewerError } = await supabase
      .from('user_profiles')
      .select('paid_coin_balance')
      .eq('id', viewerId)
      .single()

    if (viewerError || !viewerProfile) {
      return { success: false, error: 'Failed to load viewer balance' }
    }

    const newBalance = (viewerProfile.paid_coin_balance || 0) - profileViewPrice

    if (newBalance < 0) {
      return { success: false, error: 'Insufficient balance' }
    }

    // Update viewer balance
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ paid_coin_balance: newBalance })
      .eq('id', viewerId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Add to profile owner's earned coins
    const { error: ownerError } = await supabase.rpc('add_paid_coins', {
      p_user_id: profileOwnerId,
      p_amount: profileViewPrice
    })

    if (ownerError) {
      console.error('Error adding coins to owner:', ownerError)
      // Don't fail the transaction, just log it
    }

    // Record transaction
    const { data: transaction, error: txError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: viewerId,
        coins: -profileViewPrice,
        type: 'profile_view',
        source: 'profile_view_payment',
        payment_status: 'completed',
        metadata: {
          profile_owner_id: profileOwnerId,
          profile_view_price: profileViewPrice
        }
      })
      .select()
      .single()

    if (txError) {
      console.error('Error recording transaction:', txError)
      // Transaction still succeeded, just logging failed
    }

    return { success: true, transactionId: transaction?.id }
  } catch (error: any) {
    console.error('Error charging profile view:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Redirect user to store with message
 */
export function redirectToStore(
  navigate: NavigateFunction,
  requiredCoins: number,
  message?: string
) {
  const defaultMessage = `You need ${requiredCoins.toLocaleString()} coins to continue. Please purchase coins.`
  toast.error(message || defaultMessage)
  navigate('/store', { state: { requiredCoins, message: message || defaultMessage } })
}

