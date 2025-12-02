import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { UserProfile } from './supabase'
import { supabase } from './supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  setAuth: (user: User | null, session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  refreshProfile: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: true,

      // Called when Supabase auth changes
      setAuth: (user, session) => {
        console.log("Auth updated", { user: !!user })
        set({ user, session })
      },

      // Sets profile AND applies admin overrides
      setProfile: (profile) => {
        const adminEmail = "trollcity2025@gmail.com"

        // Auto-admin if email matches
        if (profile && profile.email?.toLowerCase() === adminEmail.toLowerCase()) {
          profile = { ...profile, role: "admin" }
        }

        // Admins = auto officer
        if (profile && profile.role === "admin") {
          profile = {
            ...profile,
            is_troll_officer: true,
            is_officer_active: true,
          }
        }

        console.log("Profile updated:", profile?.username, profile?.role)
        set({ profile })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      // Reload profile from DB
      refreshProfile: async () => {
        const u = get().user
        if (!u) return

        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", u.id)
          .single()

        if (error) {
          console.error("refreshProfile error:", error)
          return
        }

        if (data) {
          get().setProfile(data as UserProfile)
        }
      },

      logout: () => {
        console.log("Logging out")
        set({ user: null, session: null, profile: null })
        supabase.auth.signOut()
      }
    }),

    {
      name: "troll-city-auth", // localStorage key
      version: 1,

      // Persist ALL user, session, and profile safely
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        profile: state.profile,
      })
    }
  )
)
