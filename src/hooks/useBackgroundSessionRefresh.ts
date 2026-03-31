import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

/**
 * Background session refresh hook
 * Periodically refreshes the Supabase session and user profile to prevent
 * staleness issues that occur after ~10 minutes of inactivity.
 * 
 * This addresses the issue where the site becomes stale until refresh.
 */
export function useBackgroundSessionRefresh() {
  const { user, refreshProfile } = useAuthStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(false)
  const lastRefreshTimeRef = useRef<number>(Date.now())
  
  // Attempt session refresh with retry logic
  const attemptRefresh = async (retries = 2): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data?.session?.access_token) {
          return true
        }
        // If refresh returned but no token, check if we still have a valid session
        const { data: checkSession } = await supabase.auth.getSession()
        if (checkSession.session?.access_token) {
          return true
        }
      } catch (err) {
        console.warn(`[BackgroundSession] Refresh attempt ${attempt + 1} failed:`, err)
      }
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
    return false
  }

  // Function to refresh session and profile
  const doRefresh = useCallback(async () => {
    if (!user) return
    
    // Prevent multiple concurrent refreshes
    const refreshKey = 'tc_session_refresh_active'
    if (sessionStorage.getItem(refreshKey)) {
      console.log('[BackgroundSession] Refresh already in progress, skipping')
      return
    }
    sessionStorage.setItem(refreshKey, '1')
    
    try {
      const refreshSucceeded = await attemptRefresh(2)
      
      if (!refreshSucceeded) {
        console.warn('[BackgroundSession] All refresh attempts failed, checking session state')
        // Final check - maybe Supabase auto-refresh already handled it
        const { data: finalCheck } = await supabase.auth.getSession()
        if (!finalCheck.session?.access_token) {
          console.warn('[BackgroundSession] No valid session after all attempts, logging out')
          useAuthStore.getState().logout()
          return
        }
      }

      // Force a soft refresh periodically to ensure UI stays in sync
      // This prevents the "stale until refresh" issue by proactively updating the state
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current
      if (timeSinceLastRefresh > 5 * 60 * 1000) { // Every 5 minutes, trigger full profile refresh
        console.log('[BackgroundSession] Performing periodic full refresh to prevent staleness')
        await refreshProfile()
        lastRefreshTimeRef.current = Date.now()
      }
      
      // Dispatch event to notify other components (like realtime) that we're active
      window.dispatchEvent(new CustomEvent('supabase-realtime-activity'))
      
      console.log('[BackgroundSession] Session and profile refreshed successfully')
    } catch (err) {
      console.error('[BackgroundSession] Unexpected error during refresh:', err)
      // On unexpected errors, don't reload - just log the error
      // This prevents infinite reload loops
    } finally {
      sessionStorage.removeItem(refreshKey)
    }
  }, [user, refreshProfile])

  useEffect(() => {
    // Only run if user is logged in
    if (!user) {
      return
    }

    // Prevent multiple intervals from being created
    if (isActiveRef.current) {
      return
    }
    isActiveRef.current = true

    // Refresh session every 10 minutes to prevent staleness
    // Reduced frequency to avoid rate limiting with Supabase's built-in autoRefreshToken
    const SESSION_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
    
    // Initial refresh
    doRefresh()

    // Set up periodic refresh with logging
    intervalRef.current = setInterval(() => {
      console.log('[BackgroundSession] Periodic refresh triggered at', new Date().toISOString())
      doRefresh()
    }, SESSION_REFRESH_INTERVAL)

    // Refresh immediately when tab becomes visible again (fixes backgrounded tab logout)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[BackgroundSession] Tab became visible, refreshing session')
        doRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActiveRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id, doRefresh]) // Only re-run when user ID changes
}
