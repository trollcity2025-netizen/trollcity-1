import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { UserRole } from '@/lib/supabase'

export function useBroadcastLockdown() {
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const profile = useAuthStore((state) => state.profile)

  // Check if user is admin
  const isAdmin = profile?.role === UserRole.ADMIN || 
    profile?.troll_role === UserRole.ADMIN || 
    profile?.role === UserRole.HR_ADMIN || 
    profile?.is_admin ||
    profile?.role === UserRole.OWNER ||
    profile?.role === UserRole.PRESIDENT ||
    profile?.role === UserRole.VICE_PRESIDENT ||
    profile?.role === UserRole.TEMP_CITY_ADMIN ||
    profile?.role === UserRole.TEMP_ADMIN

  useEffect(() => {
    const fetchLockdownStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'broadcast_lockdown_enabled')
          .maybeSingle()

        if (error) {
          console.error('Error fetching broadcast lockdown status:', error)
          setLoading(false)
          return
        }

        if (data && data.setting_value) {
          // Handle both JSONB and text types
          const settingValue = data.setting_value
          if (typeof settingValue === 'object' && settingValue !== null) {
            setIsLocked(settingValue.enabled === true)
          } else if (typeof settingValue === 'string') {
            try {
              const parsed = JSON.parse(settingValue)
              setIsLocked(parsed.enabled === true)
            } catch {
              setIsLocked(settingValue.includes('enabled') && settingValue.includes('true'))
            }
          }
        } else {
          // Setting doesn't exist yet - create it with default value (not locked)
          console.log('Broadcast lockdown setting not found, creating with default value...')
          const { error: insertError } = await supabase
            .from('admin_settings')
            .insert({
              setting_key: 'broadcast_lockdown_enabled',
              setting_value: { enabled: false },
              description: 'Controls whether broadcasting is disabled for all users',
              key: 'broadcast_lockdown_enabled'
            })
            .select()
            .maybeSingle()
          
          if (insertError) {
            console.error('Error creating default broadcast lockdown setting:', insertError)
          }
        }
      } catch (err) {
        console.error('Error fetching broadcast lockdown status:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLockdownStatus()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('broadcast_lockdown_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings',
          filter: "setting_key=eq.broadcast_lockdown_enabled"
        },
        (payload) => {
          if (payload.new && (payload.new as any).setting_value) {
            const settingValue = (payload.new as any).setting_value
            if (typeof settingValue === 'object' && settingValue !== null) {
              setIsLocked(settingValue.enabled === true)
            } else if (typeof settingValue === 'string') {
              try {
                const parsed = JSON.parse(settingValue)
                setIsLocked(parsed.enabled === true)
              } catch {
                setIsLocked(settingValue.includes('enabled') && settingValue.includes('true'))
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Check if user can broadcast
  // When lockdown is active, NO ONE can broadcast (not even admins)
  const canBroadcast = useCallback(() => {
    // If not locked, everyone can broadcast
    if (!isLocked) return true
    // If locked, NO ONE can broadcast (admins included per new rule)
    return false
  }, [isLocked])

  // Function to toggle lockdown (for admin use - can be called from BroadcastLockdownControl)
  const toggleLockdown = useCallback(async (newState: boolean) => {
    try {
      // First try to update existing record
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: { enabled: newState },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'broadcast_lockdown_enabled')

      if (updateError) {
        // If update fails (record doesn't exist), try insert
        console.log('Update failed, trying insert:', updateError)
        const { error: insertError } = await supabase
          .from('admin_settings')
          .insert({
            setting_key: 'broadcast_lockdown_enabled',
            setting_value: { enabled: newState },
            description: 'Controls whether broadcasting is disabled for all users',
            key: 'broadcast_lockdown_enabled'
          })

        if (insertError) throw insertError
      }

      setIsLocked(newState)
      return true
    } catch (err) {
      console.error('Error toggling lockdown:', err)
      return false
    }
  }, [])

  return {
    isLocked,
    loading,
    isAdmin,
    canBroadcast,
    toggleLockdown
  }
}
