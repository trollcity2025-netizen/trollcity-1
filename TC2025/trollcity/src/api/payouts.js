import { supabase } from './supabaseClient';
import { notifyPayoutReceived } from '@/lib/notifications';

/**
 * Get user's payout configuration
 */
export async function getUserPayoutConfig(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('payout_method, square_customer_id, cashapp_tag, apple_pay_id, google_wallet_id, chime_id, last_payout_date, payout_approval_level')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching user payout config:', err);
    throw err;
  }
}

/**
 * Get payout approval levels
 */
export async function getPayoutApprovalLevels() {
  try {
    const { data, error } = await supabase
      .from('payout_approval_levels')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching payout approval levels:', err);
    throw err;
  }
}

/**
 * Get user's approval level based on their level
 */
export async function getUserApprovalLevel(userLevel) {
  try {
    const { data, error } = await supabase
      .from('payout_approval_levels')
      .select('*')
      .lte('level', userLevel)
      .order('level', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching user approval level:', err);
    throw err;
  }
}

/**
 * Create a new payout request
 */
export async function createPayoutRequest(userId, amount, payoutMethod, details) {
  try {
    // Get user's approval level
    const userProfile = await supabase
      .from('profiles')
      .select('level, payout_approval_level')
      .eq('id', userId)
      .single();
    
    if (userProfile.error) throw userProfile.error;
    
    const approvalLevel = await getUserApprovalLevel(userProfile.data.level);
    
    // Create payout request
    const { data, error } = await supabase
      .from('payouts')
      .insert({
        user_id: userId,
        amount,
        payout_method: payoutMethod,
        details,
        approval_level: approvalLevel.level,
        approved_by_admin: !approvalLevel.approval_required, // Auto-approve if not required
        status: approvalLevel.approval_required ? 'pending' : 'approved'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // If auto-approved, process the payout
    if (!approvalLevel.approval_required) {
      await processApprovedPayout(data.id);
    }
    
    return data;
  } catch (err) {
    console.error('Error creating payout request:', err);
    throw err;
  }
}

/**
 * Process an approved payout
 */
export async function processApprovedPayout(payoutId) {
  try {
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .select('*')
      .eq('id', payoutId)
      .single();
    
    if (payoutError) throw payoutError;
    
    // Get user's payout configuration
    const payoutConfig = await getUserPayoutConfig(payout.user_id);
    
    if (!payoutConfig.payout_method) {
      throw new Error('User has no payout method configured');
    }
    
    // Process based on payout method
    let result;
    switch (payoutConfig.payout_method) {
      case 'square':
        result = await processSquarePayout(payout, payoutConfig);
        break;
      case 'cashapp':
        result = await processCashAppPayout(payout, payoutConfig);
        break;
      case 'apple_pay':
        result = await processApplePayPayout(payout, payoutConfig);
        break;
      case 'google_wallet':
        result = await processGoogleWalletPayout(payout, payoutConfig);
        break;
      case 'chime':
        result = await processChimePayout(payout, payoutConfig);
        break;
      default:
        throw new Error('Unsupported payout method');
    }
    
    // Update payout status
    await supabase
      .from('payouts')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        transaction_id: result.transactionId
      })
      .eq('id', payoutId);
    
    // Update user's last payout date
    await supabase
      .from('profiles')
      .update({ last_payout_date: new Date().toISOString() })
      .eq('id', payout.user_id);
    
    // Send payout notification
    try {
      await notifyPayoutReceived(payout.user_id, payout.amount);
    } catch (notificationError) {
      console.error('Failed to send payout notification:', notificationError);
      // Don't throw here - payout was successfully processed even if notification failed
    }
    
    return result;
  } catch (err) {
    console.error('Error processing approved payout:', err);
    
    // Update payout status to failed
    await supabase
      .from('payouts')
      .update({
        status: 'failed',
        error_message: err.message
      })
      .eq('id', payoutId);
    
    throw err;
  }
}

/**
 * Process Square payout
 */
async function processSquarePayout(payout, payoutConfig) {
  try {
    // This would integrate with Square's payout API
    // For now, we'll create a placeholder transaction
    const { data, error } = await supabase
      .from('square_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        square_customer_id: payoutConfig.square_customer_id,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      transactionId: data.id,
      method: 'square'
    };
  } catch (err) {
    console.error('Error processing Square payout:', err);
    throw err;
  }
}

/**
 * Process CashApp payout
 */
async function processCashAppPayout(payout, payoutConfig) {
  try {
    // This would integrate with CashApp's API
    // For now, we'll create a placeholder transaction
    const { data, error } = await supabase
      .from('cashapp_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        cashapp_tag: payoutConfig.cashapp_tag,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      transactionId: data.id,
      method: 'cashapp'
    };
  } catch (err) {
    console.error('Error processing CashApp payout:', err);
    throw err;
  }
}

/**
 * Process Apple Pay payout
 */
async function processApplePayPayout(payout, payoutConfig) {
  try {
    // This would integrate with Apple Pay's API
    // For now, we'll create a placeholder transaction
    const { data, error } = await supabase
      .from('apple_pay_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        apple_pay_id: payoutConfig.apple_pay_id,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      transactionId: data.id,
      method: 'apple_pay'
    };
  } catch (err) {
    console.error('Error processing Apple Pay payout:', err);
    throw err;
  }
}

/**
 * Process Google Wallet payout
 */
async function processGoogleWalletPayout(payout, payoutConfig) {
  try {
    // This would integrate with Google Wallet's API
    // For now, we'll create a placeholder transaction
    const { data, error } = await supabase
      .from('google_wallet_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        google_wallet_id: payoutConfig.google_wallet_id,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      transactionId: data.id,
      method: 'google_wallet'
    };
  } catch (err) {
    console.error('Error processing Google Wallet payout:', err);
    throw err;
  }
}

/**
 * Process Chime payout
 */
async function processChimePayout(payout, payoutConfig) {
  try {
    // This would integrate with Chime's API
    // For now, we'll create a placeholder transaction
    const { data, error } = await supabase
      .from('chime_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        chime_id: payoutConfig.chime_id,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      transactionId: data.id,
      method: 'chime'
    };
  } catch (err) {
    console.error('Error processing Chime payout:', err);
    throw err;
  }
}

/**
 * Admin approve payout
 */
export async function approvePayout(payoutId, adminNotes = '') {
  try {
    // Update payout status
    const { data, error } = await supabase
      .from('payouts')
      .update({
        approved_by_admin: true,
        approved_at: new Date().toISOString(),
        approval_notes: adminNotes,
        status: 'approved'
      })
      .eq('id', payoutId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Process the approved payout
    await processApprovedPayout(payoutId);
    
    return data;
  } catch (err) {
    console.error('Error approving payout:', err);
    throw err;
  }
}

/**
 * Admin reject payout
 */
export async function rejectPayout(payoutId, adminNotes = '') {
  try {
    const { error } = await supabase
      .from('payouts')
      .update({
        approved_by_admin: false,
        approved_at: new Date().toISOString(),
        approval_notes: adminNotes,
        status: 'rejected'
      })
      .eq('id', payoutId);
    
    if (error) throw error;
    
    return true;
  } catch (err) {
    console.error('Error rejecting payout:', err);
    throw err;
  }
}

/**
 * Get pending payouts for admin review
 */
export async function getPendingPayouts() {
  try {
    const { data, error } = await supabase
      .from('payouts')
      .select(`
        *,
        profiles!inner(username, full_name, level, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching pending payouts:', err);
    throw err;
  }
}

/**
 * Get user's payout history
 */
export async function getUserPayoutHistory(userId) {
  try {
    const { data, error } = await supabase
      .from('payouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching user payout history:', err);
    throw err;
  }
}