import { supabase } from './supabase'
import { toast } from 'sonner'

// Track if we've already checked for concurrent login this session
let concurrentLoginCheckDone = false

export interface ConcurrentLoginResult {
  hasConcurrentLogin: boolean
  originalSessionId: string | null
  originalDeviceInfo: string | null
  originalLastActive: string | null
}

/**
 * Check if a user has an active session from another device
 * Returns details about the original session if found
 */
export async function checkConcurrentLogin(userId: string, sessionId: string): Promise<ConcurrentLoginResult> {
  // DISABLED: This check is too aggressive and causing false positives
  // Returning false to skip concurrent login check entirely
  console.log('[ConcurrentLogin] Check disabled - returning false')
  return { hasConcurrentLogin: false, originalSessionId: null, originalDeviceInfo: null, originalLastActive: null }
}

/**
 * Check if user has admin or CEO role
 */
export async function isUserAdminOrCEO(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking user role:', error)
      return false
    }

    // Check if user is admin or has admin privileges
    return data?.role === 'admin' || data?.is_admin === true
  } catch (err) {
    console.error('Failed to check user role:', err)
    return false
  }
}

/**
 * Summon a user to court for fraud (concurrent login violation)
 */
export async function summonUserForFraud(defendantId: string, reason: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('summon_user_to_court', {
      p_defendant_id: defendantId,
      p_reason: reason,
      p_users_involved: [],
      p_docket_id: null
    })

    if (error) {
      console.error('Error summoning user to court:', error)
      return false
    }

    return data?.success ?? true
  } catch (err) {
    console.error('Failed to summon user for fraud:', err)
    return false
  }
}

/**
 * Handle concurrent login detection
 * - If user is admin/CEO, allow concurrent sessions
 * - If non-admin/CEO has concurrent login, log them out and summon original account to court
 */
export async function handleConcurrentLogin(
  userId: string, 
  currentSessionId: string,
  onLogout: () => void
): Promise<boolean> {
  // Skip if we've already handled this session
  if (concurrentLoginCheckDone) {
    return false
  }
  concurrentLoginCheckDone = true

  try {
    // First check if user is admin/CEO - they are allowed to have concurrent sessions
    const isAdminOrCEO = await isUserAdminOrCEO(userId)
    if (isAdminOrCEO) {
      console.log('[ConcurrentLogin] User is admin/CEO, allowing concurrent sessions')
      return false
    }

    // Check for concurrent login
    const result = await checkConcurrentLogin(userId, currentSessionId)
    
    if (!result.hasConcurrentLogin) {
      console.log('[ConcurrentLogin] No concurrent login detected')
      return false
    }

    console.log('[ConcurrentLogin] Concurrent login detected!', result)

    // Show warning toast
    toast.error(
      '⚠️ FRAUD ALERT: You have been logged out because your account was accessed from another device. This incident has been reported.',
      { duration: 10000 }
    )

    // Summon the original account to court for fraud
    const fraudReason = `AUTOMATIC SUMMONS: Concurrent login fraud detected. Account was accessed from multiple devices simultaneously. Original session was active on: ${result.originalLastActive || 'unknown date'}. Device: ${result.originalDeviceInfo || 'unknown device'}.`
    
    await summonUserForFraud(userId, fraudReason)
    
    console.log('[ConcurrentLogin] User summoned to court for fraud investigation')

    // Log the user out
    setTimeout(() => {
      onLogout()
      // Redirect to auth page after logout
      window.location.href = '/auth?message=fraud_logout'
    }, 3000) // Give user 3 seconds to see the warning

    return true
  } catch (err) {
    console.error('[ConcurrentLogin] Error handling concurrent login:', err)
    return false
  }
}

/**
 * Reset the concurrent login check flag (for testing or re-login)
 */
export function resetConcurrentLoginCheck() {
  concurrentLoginCheckDone = false
}
