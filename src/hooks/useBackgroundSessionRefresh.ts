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
          return
        }
      }
      
      // Also refresh the user profile
      await refreshProfile()
      
      // Dispatch event to notify other components (like realtime) that we're active
      window.dispatchEvent(new CustomEvent('supabase-realtime-activity'))
      
      console.log('[BackgroundSession] Session and profile refreshed successfully')
    } catch (err) {
      console.error('[BackgroundSession] Unexpected error during refresh:', err)
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

    // Refresh session every 3 minutes (more frequent to prevent issues)
    const SESSION_REFRESH_INTERVAL = 3 * 60 * 1000 // 3 minutes
    
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
