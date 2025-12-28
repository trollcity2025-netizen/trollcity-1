import { create } from "zustand"
import { supabase } from "./supabase"

export interface InfluencerEligibility {
  eligible: boolean
  followers: number
  coins_received: number
  needs_verified?: boolean
  needs_followers?: boolean
  needs_coins?: boolean
}

interface EligibilityState {
  influencer: InfluencerEligibility | null
  lastCheckedAt: string | null
  isLoading: boolean
  error: Error | null
  refresh: (userId?: string) => Promise<InfluencerEligibility | null>
}

export const useEligibilityStore = create<EligibilityState>((set) => ({
  influencer: null,
  lastCheckedAt: null,
  isLoading: false,
  error: null,
  refresh: async (userId) => {
    if (!userId) return null
    set({ isLoading: true, error: null })

    try {
      const { data, error } = await supabase.rpc("check_influencer_eligibility", {
        p_user_id: userId,
      })

      if (error) {
        throw error
      }

      const payload = (data ?? null) as InfluencerEligibility | null

      set({
        influencer: payload,
        lastCheckedAt: new Date().toISOString(),
      })

      return payload
    } catch (caught) {
      const normalized =
        caught instanceof Error ? caught : new Error("Failed to refresh eligibility")
      console.error("eligibilityRefresh", normalized)
      set({ error: normalized })
      return null
    } finally {
      set({ isLoading: false })
    }
  },
}))
