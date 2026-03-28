import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

/**
 * Hook to track user presence/visibility for online status
 * - User is "active" when viewing a page (document is visible)
 * - User is "inactive" when app is background/closed
 * - This does NOT log out the user, just updates their presence status
 */
export function useUserPresence() {
  const { user, session } = useAuthStore()
  const intervalRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const isVisibleRef = useRef<boolean>(true)

  // Update presence in the database
  const updatePresence = useCallback(async (isActive: boolean) => {
    if (!user?.id || !session?.access_token) return

    const now = Date.now()
    // Debounce updates - only update every 10 seconds max
    if (now - lastUpdateRef.current < 10000 && isActive === isVisibleRef.current) return
    
    lastUpdateRef.current = now
    isVisibleRef.current = isActive

    try {
      // Use the session ID from localStorage (set during login)
      const sessionId = localStorage.getItem('current_device_session_id')
      
      if (sessionId) {
        // Update the active_sessions table
        await supabase
          .from('active_sessions')
          .update({
            is_active: isActive,
            last_active: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
      }

      // Also update the user_profiles table for is_online status
      await supabase
        .from('user_profiles')
        .update({
          is_online: isActive,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id)
    } catch (error) {
      console.error('[useUserPresence] Failed to update presence:', error)
    }
  }, [user?.id, session?.access_token])

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden
    console.log('[useUserPresence] Visibility changed:', isVisible ? 'visible' : 'hidden')
    updatePresence(isVisible)
  }, [updatePresence])

  // Handle beforeunload - mark as inactive (but don't logout)
  const handleBeforeUnload = useCallback(() => {
    // Use sendBeacon for reliable async update on page close
    const sessionId = localStorage.getItem('current_device_session_id')
    if (user?.id && sessionId) {
      const payload = JSON.stringify({
        user_id: user.id,
        session_id: sessionId,
        is_active: false,
        last_active: new Date().toISOString()
      })
      
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/active_sessions?user_id=eq.${user.id}&session_id=eq.${sessionId}`,
        payload
      )
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    // Initial presence - user is active when they log in
    updatePresence(true)

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for page close
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Periodic heartbeat to keep presence updated (every 30 seconds)
    intervalRef.current = window.setInterval(() => {
      if (!document.hidden) {
        updatePresence(true)
      }
    }, 30000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Mark as inactive on cleanup
      updatePresence(false)
    }
  }, [user?.id, handleVisibilityChange, handleBeforeUnload, updatePresence])
}

/**
 * Hook to get the current user's online status
 */
export function useMyOnlineStatus() {
  const { user } = useAuthStore()
  
  useEffect(() => {
    if (!user?.id) return
    
    // Set initial online status
    const setOnline = async () => {
      await supabase
        .from('user_profiles')
        .update({
          is_online: true,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id)
    }
    
    setOnline()
    
    // Cleanup on unmount - mark offline
    return () => {
      supabase
        .from('user_profiles')
        .update({
          is_online: false,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id)
    }
  }, [user?.id])
}

/**
 * Hook to subscribe to another user's online status
 */
export function useUserOnlineStatus(userId: string | undefined) {
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [lastActive, setLastActive] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    // Fetch initial status
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_online, last_active')
        .eq('id', userId)
        .single()

      if (data) {
        setIsOnline(data.is_online || false)
        setLastActive(data.last_active)
      }
    }

    fetchStatus()

    // Subscribe to changes
    const channel = supabase
      .channel(`user-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          setIsOnline(payload.new.is_online || false)
          setLastActive(payload.new.last_active)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { isOnline, lastActive }
}