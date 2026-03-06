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
  
  // Function to refresh session and profile
  const doRefresh = useCallback(async () => {
    if (!user) return
    
    try {
      // First, try to refresh the session
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession()
      
      if (sessionError) {
        console.warn('[BackgroundSession] Session refresh error:', sessionError.message)
        // If session refresh fails, try to get a new session
        const { data: newSession } = await supabase.auth.getSession()
        if (!newSession.session) {
          console.warn('[BackgroundSession] No active session after refresh failure')
          // Session might be completely expired - user will need to re-login
          // Force a page reload to re-initialize auth state
          window.location.reload()
          return
        }
      }
      
      // Verify we have a valid access token
      const { data: verifySession } = await supabase.auth.getSession()
      if (!verifySession.session?.access_token) {
        console.warn('[BackgroundSession] No valid access token, forcing re-authentication')
        // Force a page reload to re-initialize auth state - prevents stale data
        window.location.reload()
        return
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
      // On unexpected errors, try a page reload to recover
      window.location.reload()
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

    // Refresh session every 1 minute to prevent staleness
    // More frequent than default to ensure session stays valid
    const SESSION_REFRESH_INTERVAL = 60 * 1000 // 1 minute
    
    // Initial refresh
    doRefresh()

    // Set up periodic refresh with logging
    intervalRef.current = setInterval(() => {
      console.log('[BackgroundSession] Periodic refresh triggered at', new Date().toISOString())
      doRefresh()
    }, SESSION_REFRESH_INTERVAL)

    // Also refresh on window focus (when user comes back to the tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[BackgroundSession] Window visible, refreshing session...')
        doRefresh()
      }
    }
    
    // Handle window focus events as well
    const handleFocus = () => {
      console.log('[BackgroundSession] Window focused, refreshing session...')
      doRefresh()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      isActiveRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.id, doRefresh]) // Only re-run when user ID changes
}
