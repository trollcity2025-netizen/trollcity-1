import { useEffect, useRef } from 'react'
import { supabase, isAdminEmail } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

/**
 * Hook to track when officers join/leave streams
 * Automatically calls Edge Functions to update officer_live_assignments
 * Also calls touch-activity on user interactions
 */
export function useOfficerStreamTracking(streamId: string | undefined) {
  const { profile, user } = useAuthStore()
  const hasTrackedRef = useRef(false)
  const isOfficerRef = useRef(false)
  const activityIntervalRef = useRef<number | null>(null)

  // Check if user is an officer or admin
  useEffect(() => {
    if (profile && user) {
      const isAdmin = profile.is_admin || profile.role === 'admin' || isAdminEmail(user.email)
      const isOfficer = profile.role === 'troll_officer' || profile.is_troll_officer === true
      isOfficerRef.current = isOfficer || isAdmin
    }
  }, [profile, user])

  // Track officer join
  useEffect(() => {
    if (!streamId || !user || !isOfficerRef.current || hasTrackedRef.current) {
      return
    }

    const trackJoin = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token

        if (!token) {
          console.warn('No auth token for officer tracking')
          return
        }

        const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
          'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

        const response = await fetch(`${edgeFunctionsUrl}/officer-join-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ streamId })
        })

        if (response.ok) {
          hasTrackedRef.current = true
          console.log('Officer join tracked successfully')
        } else {
          console.error('Failed to track officer join:', await response.text())
        }
      } catch (error) {
        console.error('Error tracking officer join:', error)
      }
    }

    trackJoin()

    // Set up periodic activity tracking (every 5 minutes)
    if (isOfficerRef.current && streamId) {
      activityIntervalRef.current = window.setInterval(() => {
        trackActivity()
      }, 5 * 60 * 1000) // 5 minutes
    }

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current)
      }
    }
  }, [streamId, user, profile])

  const trackActivity = async () => {
    if (!streamId || !user || !isOfficerRef.current) return

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      await fetch(`${edgeFunctionsUrl}/officer-touch-activity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ streamId })
      })
    } catch (error) {
      console.error('Error tracking activity:', error)
    }
  }

  // Track officer leave on unmount or stream change
  useEffect(() => {
    return () => {
      if (!streamId || !user || !isOfficerRef.current || !hasTrackedRef.current) {
        return
      }

      const trackLeave = async () => {
        try {
          const { data: session } = await supabase.auth.getSession()
          const token = session.session?.access_token

          if (!token) return

          const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
            'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

          await fetch(`${edgeFunctionsUrl}/officer-leave-stream`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ streamId })
          })

          console.log('Officer leave tracked')
        } catch (error) {
          console.error('Error tracking officer leave:', error)
        }
      }

      // Use sendBeacon for more reliable tracking on page unload
      if (navigator.sendBeacon) {
        (async () => {
          try {
            const { data: session } = await supabase.auth.getSession()
            const token = session.session?.access_token
            if (token) {
              const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
                'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'
              const blob = new Blob([JSON.stringify({ streamId })], { type: 'application/json' })
              // Note: sendBeacon doesn't support custom headers, so we'll use a fallback
              // For now, just call trackLeave which uses fetch with headers
            }
          } catch (err) {
            console.error('Error getting session for sendBeacon:', err)
          }
        })()
      }

      trackLeave()
    }
  }, [streamId, user])

  // Also track leave on beforeunload
  useEffect(() => {
    if (!streamId || !user || !isOfficerRef.current) {
      return
    }

    const handleBeforeUnload = () => {
      (async () => {
        try {
          const { data: session } = await supabase.auth.getSession()
          const token = session.session?.access_token

          if (!token) return

          const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
            'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

          // Use sendBeacon for reliability during page unload
          const blob = new Blob([JSON.stringify({ streamId })], { type: 'application/json' })
          
          // Fallback: try to send synchronously
          if (navigator.sendBeacon) {
            navigator.sendBeacon(
              `${edgeFunctionsUrl}/officer-leave-stream`,
              blob
            )
          } else {
            await fetch(`${edgeFunctionsUrl}/officer-leave-stream`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ streamId }),
              keepalive: true // Important for page unload
            })
          }
        } catch (error) {
          console.error('Error tracking officer leave on unload:', error)
        }
      })()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [streamId, user])
}

