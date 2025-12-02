import { useEffect, useRef } from 'react'
import { loadSettings, subscribeToRealtime, useSetting } from '../lib/appSettingsStore'

/**
 * React hook to access live app settings with automatic loading and realtime subscription
 * 
 * This hook:
 * - Loads all settings from the database on mount
 * - Subscribes to realtime updates for instant changes
 * - Returns the current value for the specified key
 * - Automatically updates when the setting changes in the database
 * 
 * @param key - The setting key to retrieve
 * @returns The setting value, or undefined if not found
 * 
 * @example
 * ```tsx
 * const trollFrequency = useLiveSettings('live_troll_frequency') || 10
 * // Value updates automatically when changed in database
 * ```
 */
export const useLiveSettings = (key: string): any => {
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Only initialize once per component instance
    if (hasInitialized.current) return

    hasInitialized.current = true

    // Load settings when component mounts
    loadSettings().catch((error) => {
      console.error('Failed to load settings in useLiveSettings:', error)
    })

    // Subscribe to realtime changes (safe to call multiple times)
    const unsubscribe = subscribeToRealtime()

    // Cleanup: unsubscribe when component unmounts
    return () => {
      unsubscribe()
      hasInitialized.current = false
    }
  }, [])

  // Return the setting value using useSetting hook
  // This will automatically re-render when the setting changes
  return useSetting(key)
}
