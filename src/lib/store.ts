import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile, UserRole, validateProfile, ensureSupabaseSession } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean | null
  showLegacySidebar: boolean
  isRefreshing: boolean
  setAuth: (user: User | null, session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void

  setLoading: (loading: boolean) => void
  setAdmin: (isAdmin: boolean | null) => void
  setShowLegacySidebar: (value: boolean) => void
  refreshProfile: () => Promise<void>
  logout: () => void
}

function deepEqual(a: any, b: any, seen = new Map()): boolean {
    if (a === b) return true;

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        if (seen.has(a) && seen.get(a) === b) return true; // Handle circular refs

        if (a.constructor !== b.constructor) return false;

        seen.set(a, b);

        let length, i;
        if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- > 0;)
                if (!deepEqual(a[i], b[i], seen)) return false;
            return true;
        }

        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

        const keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- > 0;) {
            const key = keys[i];
            if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key], seen)) return false;
        }

        return true;
    }

    // true if both NaN, false otherwise
    return a !== a && b !== b;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isAdmin: null,
      showLegacySidebar: true,
      isRefreshing: false,

      // Called when Supabase auth changes
      setAuth: (user, session) => {
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
          console.log('Auth updated', { user: !!user })
        }
        set({ user, session, isLoading: false, isAdmin: user ? null : null })
      },

      // Sets profile AND applies admin overrides with production validation
      setProfile: (profile) => {
        if (!profile) {
          set({ profile: null, isAdmin: null });
          return;
        }
        
        const currentProfile = get().profile;
        
        // Deduplication: Only apply the update if commit_timestamp or updated_at is newer
        if (currentProfile && profile.updated_at && currentProfile.updated_at) {
          const currentTimestamp = new Date(currentProfile.updated_at).getTime();
          const newTimestamp = new Date(profile.updated_at).getTime();
          if (newTimestamp < currentTimestamp) {
            console.log('Stale profile update ignored');
            return; // Do not apply stale updates
          }
        }

        // Avoid unnecessary updates: compare with current profile
        try {
          // If the incoming profile is from the XP store sync, it might be a new object
          // with the same data. We only care if the core XP/level values have changed.
          if (currentProfile && profile && 
              currentProfile.level === profile.level && 
              currentProfile.xp === profile.xp && 
              currentProfile.total_xp === profile.total_xp &&
              currentProfile.next_level_xp === profile.next_level_xp &&
              deepEqual(currentProfile, profile)) { // Also do a deep equal for other properties
            return;
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

                // B. RGB Perk Sync
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

                if (desiredRgb !== currentRgb) {
                  const { error: rgbUpdateError } = await supabase
                    .from('user_profiles')
                    .update({ rgb_username_expires_at: desiredRgb })
                    .eq('id', u.id)

                  if (!rgbUpdateError) {
                     const currentProfile = get().profile || profileData
                     const updatedProfile = { ...currentProfile, rgb_username_expires_at: desiredRgb }
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
        console.log('Logging out')
         
        const currentState = get()
        const userId = currentState.user?.id
        const sessionId = (currentState.session as any)?.access_token
         
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

export async function initAuthAndData() {
  if (initDone) return
  initDone = true

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) {
    useAuthStore.getState().setAuth(session.user, session)
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
      useAuthStore.getState().setAuth(session.user, session)
      await useAuthStore.getState().refreshProfile()
    } else {
      useAuthStore.getState().setAuth(null, null)
      useAuthStore.getState().setProfile(null)
      useAuthStore.getState().setAdmin(null)
    }
  })
}
