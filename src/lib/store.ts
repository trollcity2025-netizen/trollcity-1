import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { UserProfile, Stream } from './supabase'
import { supabase } from './supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  setAuth: (user: User | null, session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  setIsAdmin: (isAdmin: boolean) => void
  logout: () => void
}

interface StreamState {
  currentStream: Stream | null
  isLive: boolean
  viewerCount: number
  totalGifts: number
  setCurrentStream: (stream: Stream | null) => void
  setIsLive: (isLive: boolean) => void
  setViewerCount: (count: number) => void
  setTotalGifts: (gifts: number) => void
}

interface CoinState {
  paidCoins: number
  freeCoins: number
  totalEarned: number
  totalSpent: number
  setCoins: (paid: number, free: number) => void
  setTotals: (earned: number, spent: number) => void
  addCoins: (type: 'paid' | 'free', amount: number) => void
  subtractCoins: (type: 'paid' | 'free', amount: number) => void
}

interface UIState {
  sidebarOpen: boolean
  theme: 'dark' | 'light'
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'info'
    message: string
    timestamp: number
  }>
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void
  removeNotification: (id: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: true,
      setAuth: (user, session) => {
        console.log('Setting auth state:', { user: !!user, session: !!session, userEmail: user?.email })
        set({ user, session })
        // Persist to localStorage immediately
        if (user && session) {
          try {
            localStorage.setItem('troll-city-auth-user', JSON.stringify(user))
            localStorage.setItem('troll-city-auth-session', JSON.stringify(session))
          } catch (e) {
            console.error('Failed to persist auth to localStorage:', e)
          }
        }
      },
      setProfile: (profile) => {
        // FORCE ADMIN ROLE FOR ADMIN EMAIL
        const adminEmail = 'trollcity2025@gmail.com'
        if (profile && profile.email?.toLowerCase() === adminEmail.toLowerCase()) {
          profile.role = 'admin'
        }
        
        console.log('Setting profile:', profile ? profile.username : 'null', profile ? { id: profile.id, username: profile.username, role: profile.role } : 'null')
        set({ profile })
        // Persist to localStorage immediately
        if (profile) {
          try {
            const user = get().user
            if (user) {
              const base = {
                id: profile.id,
                username: profile.username,
                role: profile.role,
                tier: profile.tier,
                paid_coin_balance: profile.paid_coin_balance,
                free_coin_balance: profile.free_coin_balance,
              }
              const payloadFull = JSON.stringify({ data: profile, timestamp: Date.now() })
              const payloadCompact = JSON.stringify({ data: base, timestamp: Date.now() })
              const dataToStore = payloadFull.length <= 50000 ? payloadFull : payloadCompact
              localStorage.setItem(`tc-profile-${user.id}`, dataToStore)
            }
          } catch (e) {
            console.error('Failed to persist profile to localStorage:', e)
          }
        }
      },
      setLoading: (loading) => {
        console.log('Setting loading state:', loading)
        set({ isLoading: loading })
      },
      setIsAdmin: (isAdmin: boolean) => {
        const current = get().profile
        if (isAdmin) {
          const updated = { ...(current || {}), role: 'admin' } as any
          set({ profile: updated })
        } else {
          if (current) {
            const updated = { ...current, role: current.role === 'admin' ? 'user' : current.role } as any
            set({ profile: updated })
          }
        }
      },
      logout: () => {
        console.log('Logging out user')
        set({ user: null, session: null, profile: null })
        // Clear from localStorage
        try {
          localStorage.removeItem('troll-city-auth-user')
          localStorage.removeItem('troll-city-auth-session')
          const keys = Object.keys(localStorage)
          keys.forEach(key => {
            if (key.startsWith('tc-profile-')) {
              localStorage.removeItem(key)
            }
          })
        } catch (e) {
          console.error('Failed to clear auth from localStorage:', e)
        }
      },
    }),
    {
      name: 'troll-city-auth',
      partialize: (state) => {
        // Persist auth user/session always, but only persist profile when it's an admin
        const base: any = {
          user: state.user,
          session: state.session,
        }
        if (state.profile && (state.profile as any).role === 'admin') {
          base.profile = state.profile
        }
        return base
      },
      merge: (persistedState: any, currentState) => {
        // Merge persisted values but avoid leaking stale non-admin profiles.
        const merged = {
          ...currentState,
          ...persistedState,
          isLoading: true, // Force loading state on initialization
        }

        // If persisted profile exists (we only stored admin profiles), restore it.
        if (persistedState?.profile) {
          merged.profile = persistedState.profile
        } else {
          merged.profile = null
        }

        return merged
      },
    }
  )
)

// Session refresh utility
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Session refresh error:', error)
      return null
    }
    return session
  } catch (error) {
    console.error('Session refresh exception:', error)
    return null
  }
}

export const useStreamStore = create<StreamState>()((set) => ({
  currentStream: null,
  isLive: false,
  viewerCount: 0,
  totalGifts: 0,
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setIsLive: (isLive) => set({ isLive }),
  setViewerCount: (count) => set({ viewerCount: count }),
  setTotalGifts: (gifts) => set({ totalGifts: gifts }),
}))

export const useCoinStore = create<CoinState>()(
  persist(
    (set) => ({
      paidCoins: 0,
      freeCoins: 0,
      totalEarned: 0,
      totalSpent: 0,
      setCoins: (paid, free) => set({ paidCoins: paid, freeCoins: free }),
      setTotals: (earned, spent) => set({ totalEarned: earned, totalSpent: spent }),
      addCoins: (type, amount) =>
        set((state) => ({
          [type === 'paid' ? 'paidCoins' : 'freeCoins']: 
            (type === 'paid' ? state.paidCoins : state.freeCoins) + amount,
          totalEarned: state.totalEarned + amount,
        })),
      subtractCoins: (type, amount) =>
        set((state) => ({
          [type === 'paid' ? 'paidCoins' : 'freeCoins']: 
            Math.max(0, (type === 'paid' ? state.paidCoins : state.freeCoins) - amount),
          totalSpent: state.totalSpent + amount,
        })),
    }),
    {
      name: 'troll-city-coins',
    }
  )
)

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      notifications: [],
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),
      addNotification: (type, message) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: Date.now().toString(),
              type,
              message,
              timestamp: Date.now(),
            },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: 'troll-city-ui',
    }
  )
)
