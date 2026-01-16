import { create } from 'zustand'
import { supabase } from '../supabaseClient'

interface XPState {
  xpTotal: number
  level: number
  xpToNext: number
  progress: number
  isLoading: boolean
  fetchXP: (userId: string) => Promise<void>
  subscribeToXP: (userId: string) => void
  unsubscribe: () => void
}

export const useXPStore = create<XPState>((set) => {
  let channel: any = null;

  return {
    xpTotal: 0,
    level: 1,
    xpToNext: 100,
    progress: 0,
    isLoading: false,

    fetchXP: async (userId: string) => {
      set({ isLoading: true })
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        
        if (error && error.code !== 'PGRST116') throw error
        
        if (data) {
          set({
            xpTotal: data.xp_total,
            level: data.level,
            xpToNext: data.xp_to_next_level,
            progress: data.xp_progress,
            isLoading: false
          })
        } else {
          set({ isLoading: false })
        }
      } catch (err) {
        console.error('Error fetching XP stats:', err)
        set({ isLoading: false })
      }
    },

    subscribeToXP: (userId: string) => {
      if (channel) return;

      channel = supabase
        .channel('xp_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_stats',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const newData = payload.new
            if (newData) {
              set({
                xpTotal: newData.xp_total,
                level: newData.level,
                xpToNext: newData.xp_to_next_level,
                progress: newData.xp_progress
              })
            }
          }
        )
        .subscribe()
    },

    unsubscribe: () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }
})
