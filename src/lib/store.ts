import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile, UserRole, validateProfile, ensureSupabaseSession } from '../lib/supabase'
import { handleConcurrentLogin, resetConcurrentLoginCheck } from './sessionUtils'
import { generateUUID } from './uuid'

// Module-level debounce tracking
let lastProfileUpdateTime = 0
let lastRefreshProfileTime = 0
const PROFILE_UPDATE_DEBOUNCE_MS = 2000 // 2 seconds
const REFRESH_PROFILE_DEBOUNCE_MS = 3000 // 3 seconds - prevents multiple full refreshes

interface AuthState {
  user: User | null
  session: Session | null
  sessionId: string | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean | null
  showLegacySidebar: boolean
  isRefreshing: boolean
  setAuth: (user: User | null, session: Session | null, sessionId?: string | null) => void
  setProfile: (profile: UserProfile | null) => void

  setLoading: (loading: boolean) => void
  setAdmin: (isAdmin: boolean | null) => void
  setShowLegacySidebar: (value: boolean) => void
  refreshProfile: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      sessionId: null,
      profile: null,
      isLoading: false,
      isAdmin: null,
      showLegacySidebar: true,
      isRefreshing: false,

      // Called when Supabase auth changes
      setAuth: (user, session, sessionId = null) => {
        try {
          const prev = get()
          const sameUser = (!!prev.user && !!user && prev.user.id === user.id) || (!prev.user && !user)
          const prevToken = (prev.session as any)?.access_token
          const newToken = (session as any)?.access_token
          if (sameUser && prevToken === newToken) {
            // No meaningful change — skip update
            return
          }
        } catch {
          // ignore and continue
        }
        if ((import.meta as any).env?.DEV) {
          console.log('Auth updated', { user: !!user });
        }
        set({ user, session, sessionId, isLoading: false, isAdmin: user ? null : null });
      },

      // Sets profile AND applies admin overrides with production validation
      setProfile: (profile) => {
        const prevProfile = get().profile;

        // Debounce: prevent multiple updates within 2 seconds
        const now = Date.now()
        if (now - lastProfileUpdateTime < PROFILE_UPDATE_DEBOUNCE_MS) {
          // Too soon - skip this update
          return
        }

        if (!profile) {
          lastProfileUpdateTime = now
          set({ profile: null, isAdmin: null })
          return
        }

        // Announce login when profile is first loaded
        if (!prevProfile && profile.username) {
          supabase.from('global_events').insert([
            { title: `${profile.username} just logged in!`, icon: 'login', priority: 1 },
          ]).then();
        }

        // Avoid unnecessary updates: compare with current profile
        try {
          const prev = get().profile
          if (prev) {
            const sameId = prev.id === (profile as any).id
            const prevStr = JSON.stringify(prev)
            const newStr = JSON.stringify(profile)
            if (sameId && prevStr === newStr) {
              // No changes — skip state update to prevent re-renders
              return
            }
          }
        } catch {
          // If comparison fails, continue with update
        }

        // Ensure profile has email (fallback to auth/session)
        const authEmail = get().user?.email || get().session?.user?.email
        if (!profile.email && authEmail) {
          profile = { ...profile, email: authEmail }
        }

        // Import admin email from environment
        const adminEmail = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
        const adminEmailLower = adminEmail.toLowerCase()
        const profileEmailLower = profile.email?.toLowerCase()

        // Auto-admin if email matches (with validation)
        if (profileEmailLower && profileEmailLower === adminEmailLower) {
          profile = {
            ...profile,
            role: UserRole.ADMIN,
            is_admin: true,
            troll_role: 'admin'
          }
        }

        // Enhanced admin role handling
        const hasAdminFlag = profile.role === UserRole.ADMIN || profile.is_admin
        if (hasAdminFlag) {
          profile = {
            ...profile,
            is_troll_officer: true,
            is_officer_active: true,
            is_lead_officer: true,
            troll_role: 'admin',
            // Ensure admin has highest officer level
            officer_level: Math.max(profile.officer_level || 0, 5)
          }
        }

        // Production logging with validation
        try {
          const validation = validateProfile(profile)
          if (!validation.isValid) {
            console.warn('Profile validation warnings:', validation.warnings)
          }
        } catch {
          // Silent fail if validation not available
        }

        if ((import.meta as any).env?.DEV) {
          console.log('Profile updated:', profile?.username, profile?.role)
        }
        lastProfileUpdateTime = now
        set({ profile, isAdmin: hasAdminFlag })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setAdmin: (adminState) => set({ isAdmin: adminState }),

      setShowLegacySidebar: (value) => set({ showLegacySidebar: value }),

      // Reload profile from DB - NON-BLOCKING & FAIL-SAFE
      refreshProfile: async () => {
        const state = get()
        const u = state.user
        if (!u) return

        // Global debounce: prevent multiple refreshes within 3 seconds
        const now = Date.now()
        if (now - lastRefreshProfileTime < REFRESH_PROFILE_DEBOUNCE_MS) {
          console.log('[refreshProfile] Skipping - refreshed too recently')
          return
        }
        lastRefreshProfileTime = now

        // Prevent concurrent refreshes
        if (state.isRefreshing) {
             return
        }
        
        // Set refreshing lock
        set({ isRefreshing: true })

        try {
          await ensureSupabaseSession(supabase)

          // 1. Core Profile Fetch (Awaited)
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', u.id)
            .maybeSingle()

          if (error) {
            console.error('refreshProfile error:', error)
            // Do not throw, just return. 
            return
          }

          if (data) {
            let profileData = data as any
            
            // Update state immediately with core data
            get().setProfile(profileData as UserProfile)

            // 2. Secondary Data (Fire-and-Forget)
            // We do NOT await this. We let it run in background.
            // If it succeeds, it will call setProfile again with merged data.
            ;(async () => {
              try {
                // A. Level/XP Sync
                const { data: levelRow } = await supabase
                  .from('user_stats')
                  .select('level, xp_total, xp_to_next_level')
                  .eq('user_id', u.id)
                  .maybeSingle()

                if (levelRow) {
                  const currentProfile = get().profile || profileData
                  const updatedProfile = {
                    ...currentProfile,
                    level: levelRow.level ?? currentProfile.level ?? 1,
                    xp: levelRow.xp_total ?? currentProfile.xp ?? 0,
                    total_xp: levelRow.xp_total ?? currentProfile.total_xp,
                    next_level_xp: levelRow.xp_to_next_level ?? currentProfile.next_level_xp,
                  }
                  // Update with level data
                  get().setProfile(updatedProfile as UserProfile)
                  
                  // Update local ref for next steps
                  profileData = updatedProfile as any
                }

                // B. RGB Perk Sync - only update if there's an actual change
                // and avoid DB updates that would trigger postgres_changes cascade
                const nowIso = new Date().toISOString()
                const { data: rgbPerk } = await supabase
                  .from('user_perks')
                  .select('expires_at')
                  .eq('user_id', u.id)
                  .eq('perk_id', 'perk_rgb_username')
                  .eq('is_active', true)
                  .gt('expires_at', nowIso)
                  .order('expires_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()

                const desiredRgb = rgbPerk?.expires_at || null
                const currentRgb = profileData?.rgb_username_expires_at || null

                // Only update state locally without DB write if the value differs
                // This prevents triggering postgres_changes events that cause refresh loops
                if (desiredRgb !== currentRgb) {
                  // Check if we've recently updated this field to avoid rapid re-updates
                  const lastRgbUpdate = (profileData as any)?._lastRgbUpdate || 0
                  const now = Date.now()
                  const RGB_UPDATE_COOLDOWN_MS = 60000 // 1 minute cooldown
                  
                  if (now - lastRgbUpdate > RGB_UPDATE_COOLDOWN_MS) {
                    // Update DB only if enough time has passed
                    const { error: rgbUpdateError } = await supabase
                      .from('user_profiles')
                      .update({ rgb_username_expires_at: desiredRgb })
                      .eq('id', u.id)

                    if (!rgbUpdateError) {
                       const currentProfile = get().profile || profileData
                       const updatedProfile = {
                         ...currentProfile,
                         rgb_username_expires_at: desiredRgb,
                         _lastRgbUpdate: now // Track when we last updated
                       }
                       get().setProfile(updatedProfile as UserProfile)
                    }
                  } else {
                    // Just update local state without DB write
                    const currentProfile = get().profile || profileData
                    const updatedProfile = {
                      ...currentProfile,
                      rgb_username_expires_at: desiredRgb
                    }
                    get().setProfile(updatedProfile as UserProfile)
                  }
                }
              } catch (secondaryErr) {
                // Silently fail secondary updates
                console.warn('Secondary profile refresh failed:', secondaryErr)
              }
            })()
          }
        } catch (err) {
          console.error('refreshProfile failed:', err)
          // Ensure loading state is cleared
          get().setLoading(false)
        } finally {
            // Always release the lock
            set({ isRefreshing: false })
        }
      },

      logout: async () => {
        // Cleanup realtime profile subscription
        cleanupProfileRealtime()
        
        console.log('Logging out');
        const currentState = get();

        if (currentState.profile?.username) {
          supabase.from('global_events').insert([
            { title: `${currentState.profile.username} just logged out!`, icon: 'logout', priority: 1 },
          ]).then();
        }
         
        const userId = currentState.user?.id
        const sessionId = currentState.sessionId
         
        try {
          // Check if we have a valid session before attempting to sign out
          const { data: { session }, error } = await supabase.auth.getSession()
           
          // Only attempt signOut if we have a valid session
          if (session && !error) {
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) {
              // Handle specific auth errors gracefully
              if (signOutError.message.includes('Auth session missing') ||
                  signOutError.message.includes('Invalid JWT') ||
                  signOutError.message.includes('expired')) {
                console.log('Session already expired or invalid, proceeding with local logout')
              } else {
                console.warn('Sign out error:', signOutError.message)
              }
            }
          } else {
            console.log('No valid session found, proceeding with local logout')
          }
        } catch (error) {
          // If getSession fails, it's likely already logged out
          console.log('Session check failed, proceeding with local logout:', error)
        }
         
        // Mark session as inactive in our tracking system
        if (userId && sessionId) {
          try {
            await supabase
              .from('active_sessions')
              .update({ is_active: false, last_active: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('session_id', sessionId)
          } catch (error) {
            console.error('Error updating session status:', error)
          }
        }
         
        // Always clear local state regardless of server sign out result
        set({ user: null, session: null, profile: null, isLoading: false, isAdmin: null })
         
        // Clear any persisted auth data
        try {
          localStorage.removeItem('troll-city-auth')
        } catch (e) {
          console.warn('Failed to clear local storage:', e)
        }
      }
    }),

    {
      name: 'troll-city-auth', // localStorage key
      version: 1,

      // Persist ALL user, session, and profile safely
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        profile: state.profile,
        isAdmin: state.isAdmin
      })
    }
  )
)

let initDone = false
let initialAuthHandled = false
let profileChannel: any = null

// Setup realtime subscription for profile changes
export function setupProfileRealtime(userId: string) {
  // Remove existing subscription if any
  if (profileChannel) {
    supabase.removeChannel(profileChannel)
    profileChannel = null
  }

  // Subscribe to profile changes for real-time balance updates
  profileChannel = supabase
    .channel(`profile-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${userId}`
      },
      (payload) => {
        console.log('[ProfileRealtime] Profile updated:', payload.new)
        // Update the profile in store immediately - bypass debounce for realtime updates
        const currentProfile = useAuthStore.getState().profile
        if (currentProfile && currentProfile.id === userId) {
          // Force bypass debounce by resetting the debounce timer
          lastProfileUpdateTime = 0
          useAuthStore.getState().setProfile({
            ...currentProfile,
            ...payload.new
          } as UserProfile)
        }
      }
    )
    .subscribe()

  console.log('[ProfileRealtime] Subscribed to profile changes for user:', userId)
}

// Cleanup realtime subscription
export function cleanupProfileRealtime() {
  if (profileChannel) {
    supabase.removeChannel(profileChannel)
    profileChannel = null
    console.log('[ProfileRealtime] Cleaned up profile subscription')
  }
}

export async function initAuthAndData() {
  if (initDone) return
  initDone = true

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) {
      useAuthStore.getState().setAuth(session.user, session, generateUUID())
    
    // Setup realtime profile subscription for real-time balance updates
    setupProfileRealtime(session.user.id)
    
    // Check for concurrent login from other devices
    const storedSessionId = useAuthStore.getState().sessionId
    if (storedSessionId) {
      // Reset the check flag for fresh login
      resetConcurrentLoginCheck()

      // Handle concurrent login - this will log out if fraud detected
      await handleConcurrentLogin(
        session.user.id,
        storedSessionId,
        () => useAuthStore.getState().logout()
      )
    }
    
    await useAuthStore.getState().refreshProfile()
  } else {
    // Clear stale state if Supabase has no session but store does
    const state = useAuthStore.getState()
    if (state.user || state.session) {
      console.log('Clearing stale auth state (no active Supabase session)')
      state.setAuth(null, null)
      state.setProfile(null)
      state.setAdmin(null)
    }
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    // Skip the initial state change event to prevent duplicate profile refresh
    if (!initialAuthHandled) {
      initialAuthHandled = true
      return
    }
    
    try {
      const prev = useAuthStore.getState()
      const sameUser = (!!prev.user && !!session?.user && prev.user.id === session.user.id) || (!prev.user && !session?.user)
      const prevToken = (prev.session as any)?.access_token
      const newToken = (session as any)?.access_token
      if (sameUser && prevToken === newToken) {
        return
      }
    } catch {
      // continue
    }

    if (session?.user) {
    useAuthStore.getState().setAuth(session.user, session, generateUUID())
      
      // Setup realtime profile subscription for real-time balance updates
      setupProfileRealtime(session.user.id)
      
      // Check for concurrent login when session changes
      const sessionId = (session as any)?.access_token
      if (sessionId) {
        resetConcurrentLoginCheck()
        await handleConcurrentLogin(
          session.user.id,
          sessionId,
          () => useAuthStore.getState().logout()
        )
      }
      
      await useAuthStore.getState().refreshProfile()
    } else {
      // Cleanup realtime subscription on logout
      cleanupProfileRealtime()
      useAuthStore.getState().setAuth(null, null)
      useAuthStore.getState().setProfile(null)
      useAuthStore.getState().setAdmin(null)
    }
  })
}
