import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface MobileError {
  id: string
  message: string
  stack?: string
  component?: string
  timestamp: string
  userId?: string
  deviceInfo?: {
    userAgent: string
    viewportWidth: number
    viewportHeight: number
    platform: string
  }
}

interface MobileErrorState {
  errors: MobileError[]
  addError: (error: Omit<MobileError, 'id' | 'timestamp'>) => void
  clearErrors: () => void
  getErrors: () => MobileError[]
}

export const useMobileErrorStore = create<MobileErrorState>()(
  persist(
    (set, get) => ({
      errors: [],

      addError: (errorData) => {
        const newError: MobileError = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          ...errorData,
        }
        set((state) => ({
          errors: [newError, ...state.errors].slice(0, 100), // Keep last 100 errors
        }))
      },

      clearErrors: () => set({ errors: [] }),

      getErrors: () => get().errors,
    }),
    {
      name: 'mobile-error-store',
    }
  )
)

// Export the store for direct access (for use in error boundaries)
export const mobileErrorStore = useMobileErrorStore

// For use in class components or error boundaries - direct store access
export const trackMobileError = (error: Error, component?: string, userId?: string) => {
  useMobileErrorStore.getState().addError({
    message: error.message,
    stack: error.stack,
    component,
    userId,
    deviceInfo: typeof window !== 'undefined' ? {
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      platform: navigator.platform,
    } : undefined,
  })
  
  // Also save to database for admin viewing
  saveErrorToDatabase(error.message, error.stack, component, userId)
}

// Save error to database for admin to view
async function saveErrorToDatabase(
  message: string,
  stack: string | undefined,
  component: string | undefined,
  userId: string | undefined
) {
  try {
    const deviceInfo = typeof window !== 'undefined' ? {
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      platform: navigator.platform,
    } : {}
    
    await supabase.from('mobile_errors').insert({
      message,
      stack,
      component,
      user_id: userId,
      device_info: deviceInfo,
    })
  } catch (e) {
    // Silently fail - don't block the main flow
    console.warn('[MobileErrorTracking] Failed to save to database:', e)
  }
}

// Hook to track errors in functional components
export function useTrackMobileError() {
  const addError = useMobileErrorStore((state) => state.addError)

  const trackError = (error: Error, component?: string, userId?: string) => {
    addError({
      message: error.message,
      stack: error.stack,
      component,
      userId,
      deviceInfo: typeof window !== 'undefined' ? {
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        platform: navigator.platform,
      } : undefined,
    })
  }

  return { trackError }
}
