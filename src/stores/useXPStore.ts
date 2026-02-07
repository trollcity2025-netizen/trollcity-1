import { create } from 'zustand'
import { supabase } from '../supabaseClient'
import { useAuthStore } from '../lib/store'

interface XPState {
  xpTotal: number
  level: number
  buyerLevel: number
  streamLevel: number
  xpToNext: number
  progress: number
  isLoading: boolean
  fetchXP: (userId: string) => Promise<void>
  subscribeToXP: (userId: string) => void
  unsubscribe: () => void
}

export const useXPStore = create<XPState>((set) => {
  let channel: any = null;

  const syncAuthProfile = (level: number, totalXp: number, nextLevelXp: number | null) => {
    const auth = useAuthStore.getState()
    if (!auth?.profile || !auth?.setProfile) return

    auth.setProfile({
      ...auth.profile,
      level: level || auth.profile.level || 1,
      xp: totalXp ?? auth.profile.xp ?? 0,
      total_xp: totalXp ?? auth.profile.total_xp,
      next_level_xp: nextLevelXp ?? auth.profile.next_level_xp,
    })
  }

  const _computeXpState = (data: {
    level?: number; xp?: number; total_xp?: number; next_level_xp?: number;
    current_level?: number; current_xp?: number; buyer_level?: number; buyer_xp?: number; stream_level?: number; stream_xp?: number;
    [key: string]: any;
  }) => {
    // Prefer primary level columns, but use buyer_level/stream_level from user_level table
    // For now, prioritize buyer_level as the main level
    const levelValue = data.level
      ?? data.current_level
      ?? data.buyer_level
      ?? data.stream_level
      ?? 1

    // Prefer buyer_xp from user_level table as main XP source
    const absoluteXp = data.total_xp
      ?? data.xp
      ?? data.current_xp
      ?? data.buyer_xp
      ?? data.stream_xp
      ?? 0

    const nextLevelAbsolute = data.next_level_xp ?? (levelValue + 1) * 100
    const prevLevelAbsolute = Math.max(0, levelValue * 100)

    // If absoluteXp already looks like within-level XP, don't subtract a base
    const looksLikeSegmentXp = absoluteXp <= nextLevelAbsolute && absoluteXp <= 100000 // guard against huge subtraction
    const xpIntoLevel = looksLikeSegmentXp ? Math.max(0, absoluteXp) : Math.max(0, absoluteXp - prevLevelAbsolute)
    const xpNeededThisLevel = Math.max(1, nextLevelAbsolute - prevLevelAbsolute)
    const progressValue = Math.min(1, xpIntoLevel / xpNeededThisLevel)

    console.log('XP Store computed:', { levelValue, absoluteXp, xpIntoLevel, xpNeededThisLevel, progressValue })

    return {
      levelValue,
      totalXp: absoluteXp,
      xpToNext: Math.max(0, xpNeededThisLevel - xpIntoLevel),
      progressValue,
      nextLevelAbsolute,
    }
  }

  return {
    xpTotal: 0,
    level: 1,
    buyerLevel: 1,
    streamLevel: 1,
    xpToNext: 100,
    progress: 0,
    isLoading: false,

    fetchXP: async (userId: string) => {
      set({ isLoading: true })
      try {
        console.log('Fetching XP for user:', userId)
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .single()

        console.log('user_stats query result:', { data, error })
        
        if (error && error.code !== 'PGRST116') throw error
        
        if (data) {
          const level = data.level || 1
          const xpTotal = data.xp_total || 0
          const progress = data.xp_progress || 0
          const nextLevelTotal = data.xp_to_next_level || 100
          
          const xpToNext = Math.max(0, nextLevelTotal - xpTotal)

          set({
            xpTotal,
            level,
            buyerLevel: level,
            streamLevel: level,
            xpToNext,
            progress,
            isLoading: false
          })
          
          syncAuthProfile(level, xpTotal, nextLevelTotal)
        } else {
            console.log('No user_stats found, initializing...')
             const { data: _newData, error: insertError } = await supabase
                .rpc('grant_xp', { 
                    p_user_id: userId, 
                    p_amount: 0, 
                    p_source: 'init', 
                    p_source_id: `init_${Date.now()}` 
                })
            
            if (!insertError) {
                 set({
                    xpTotal: 0,
                    level: 1,
                    buyerLevel: 1,
                    streamLevel: 1,
                    xpToNext: 100,
                    progress: 0,
                    isLoading: false
                 })
                 syncAuthProfile(1, 0, 100)
            } else {
                set({ isLoading: false })
            }
        }
      } catch (error) {
        console.error('Error fetching XP:', error)
        set({ isLoading: false })
      }
    },

    subscribeToXP: (userId: string) => {
      if (channel) return

      channel = supabase
        .channel(`public:user_stats:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_stats',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('XP Update received:', payload)
            if (payload.new) {
               const data = payload.new as any
               const level = data.level || 1
               const xpTotal = data.xp_total || 0
               const progress = data.xp_progress || 0
               const nextLevelTotal = data.xp_to_next_level || 100
               const xpToNext = Math.max(0, nextLevelTotal - xpTotal)

               set({
                 xpTotal,
                 level,
                 xpToNext,
                 progress
               })
               syncAuthProfile(level, xpTotal, nextLevelTotal)
            } else {
                set({
                    xpTotal: 0,
                    level: 1,
                    buyerLevel: 1,
                    streamLevel: 1,
                    xpToNext: 100,
                    progress: 0,
                    isLoading: false
                 })
                 syncAuthProfile(1, 0, 100)
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
