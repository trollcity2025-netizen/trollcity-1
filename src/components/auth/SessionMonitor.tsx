import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

export default function SessionMonitor() {
  const { user, logout } = useAuthStore()

  useEffect(() => {
    if (!user) return

    const sessionId = localStorage.getItem('current_device_session_id')
    if (!sessionId) {
      // If no session ID is found (e.g. legacy login), we could optionally
      // force a logout or just ignore it. 
      // For strict enforcement, we should probably ignore it until next login 
      // or generate one. But generating one now implies calling register_session
      // which might kick other devices.
      // Let's just monitor if we have one.
      return
    }

    // Initial check
    const checkSession = async () => {
      // Validate sessionId is a proper UUID to avoid 400 errors
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!sessionId || sessionId === 'undefined' || !uuidRegex.test(sessionId)) {
        console.log('[SessionMonitor] Invalid or missing session ID:', sessionId);
        return;
      }

      const { data, error } = await supabase
        .from('active_sessions')
        .select('is_active')
        .eq('session_id', sessionId)
        .maybeSingle()

      // If no session found (error or null data), session doesn't exist or was deleted
      // This can happen if session was cleaned up or is a stale localStorage value
      if (error || !data) {
        console.log('[SessionMonitor] Session not found or error:', error?.message)
        // Optionally force logout or just ignore
        return
      }

      if (data.is_active === false) {
        console.log('[SessionMonitor] Session is marked inactive. Logging out.')
        toast.error('Session expired. You have logged in on another device.')
        logout()
      }
    }
    
    checkSession()

    // Only subscribe if we have a valid session ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sessionId || sessionId === 'undefined' || !uuidRegex.test(sessionId)) {
      return;
    }

    // Subscribe to changes
    const channel = supabase
      .channel(`session_monitor_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_sessions',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new && payload.new.is_active === false) {
            console.log('[SessionMonitor] Session deactivated via realtime. Logging out.')
            toast.error('Session expired. You have logged in on another device.')
            logout()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, logout])

  return null
}
