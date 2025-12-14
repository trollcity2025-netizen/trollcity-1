import { create } from 'zustand'
import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface AppSettingsState {
  settings: { [key: string]: any }
  isLoading: boolean
  error: Error | null
  setSetting: (key: string, value: any) => void
  setSettings: (settings: { [key: string]: any }) => void
  setLoading: (loading: boolean) => void
  setError: (error: Error | null) => void
}

const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: {},
  isLoading: false,
  error: null,
  setSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
  setSettings: (newSettings) =>
    set({ settings: newSettings, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))

let realtimeChannel: RealtimeChannel | null = null
let isSubscribed = false

/**
 * Load all settings from the app_settings table
 * @throws {Error} If the database query fails
 */
export const loadSettings = async (): Promise<void> => {
  try {
    useAppSettingsStore.getState().setLoading(true)
    useAppSettingsStore.getState().setError(null)

    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')

    if (error) {
      const err = new Error(`Failed to load app settings: ${error.message}`)
      useAppSettingsStore.getState().setError(err)
      throw err
    }

    if (data) {
      const settingsMap: { [key: string]: any } = {}
      data.forEach((row) => {
        settingsMap[row.setting_key] = row.setting_value
      })
      useAppSettingsStore.getState().setSettings(settingsMap)
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error loading settings')
    useAppSettingsStore.getState().setError(err)
    throw err
  } finally {
    useAppSettingsStore.getState().setLoading(false)
  }
}

/**
 * Update a setting in the database
 * @param key - The setting key to update
 * @param value - The new setting value (will be stored as JSONB)
 * @throws {Error} If the database update fails
 */
export const updateSetting = async (key: string, value: any): Promise<void> => {
  try {
    // Try update first (most common case) - use single() to avoid body consumption issues
    const { data: updated, error: updateError } = await supabase
      .from('app_settings')
      .update({
        setting_value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', key)
      .select('setting_key')
      .maybeSingle()

    // If update didn't find a row, insert instead
    if (updateError || !updated) {
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        })

      // If insert fails due to unique constraint (race condition), update succeeded elsewhere
      if (insertError) {
        if (insertError.message?.includes('unique constraint')) {
          // Another process inserted it, try update one more time
          const { error: finalUpdateError } = await supabase
            .from('app_settings')
            .update({
              setting_value: value,
              updated_at: new Date().toISOString(),
            })
            .eq('setting_key', key)

          if (finalUpdateError) {
            const err = new Error(`Failed to update setting "${key}": ${finalUpdateError.message}`)
            useAppSettingsStore.getState().setError(err)
            throw err
          }
        } else {
          const err = new Error(`Failed to update setting "${key}": ${insertError.message}`)
          useAppSettingsStore.getState().setError(err)
          throw err
        }
      }
    }

    // Note: The store will be updated automatically via realtime subscription
    // But we can also update it optimistically here
    useAppSettingsStore.getState().setSetting(key, value)
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error updating setting')
    useAppSettingsStore.getState().setError(err)
    throw err
  }
}

/**
 * Hook to access a specific setting by key
 * @param key - The setting key to retrieve
 * @returns The setting value, or undefined if not found
 */
export const useSetting = (key: string): any => {
  const settings = useAppSettingsStore((state) => state.settings)
  return settings[key]
}

/**
 * Hook to access the loading state
 */
export const useSettingsLoading = (): boolean => {
  return useAppSettingsStore((state) => state.isLoading)
}

/**
 * Hook to access the error state
 */
export const useSettingsError = (): Error | null => {
  return useAppSettingsStore((state) => state.error)
}

/**
 * Subscribe to realtime changes on the app_settings table
 * Updates the store when INSERT or UPDATE events occur
 * Safe to call multiple times - will reuse existing subscription
 * @returns A cleanup function to unsubscribe
 */
export const subscribeToRealtime = (): (() => void) => {
  // If already subscribed, return a no-op cleanup function
  if (isSubscribed && realtimeChannel) {
    return () => {
      // No-op - subscription is shared
    }
  }

  // Unsubscribe from existing channel if any (shouldn't happen, but safety check)
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  realtimeChannel = supabase
    .channel('app-settings-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'app_settings',
      },
      (payload) => {
        const newRow = payload.new as { setting_key: string; setting_value: any }
        useAppSettingsStore.getState().setSetting(newRow.setting_key, newRow.setting_value)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_settings',
      },
      (payload) => {
        const updatedRow = payload.new as { setting_key: string; setting_value: any }
        useAppSettingsStore.getState().setSetting(updatedRow.setting_key, updatedRow.setting_value)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true
      } else if (status === 'CHANNEL_ERROR') {
        isSubscribed = false
        realtimeChannel = null
      } else if (status === 'TIMED_OUT') {
        isSubscribed = false
        realtimeChannel = null
      } else if (status === 'CLOSED') {
        isSubscribed = false
        realtimeChannel = null
      }
    })

  // Return cleanup function
  return () => {
    if (realtimeChannel && isSubscribed) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
      isSubscribed = false
    }
  }
}
