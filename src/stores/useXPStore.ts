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
    const levelValue = data.level || data.current_level || data.buyer_level || 1;
    const absoluteXp = data.total_xp || data.xp || 0;
    const nextLevelAbsolute = data.next_level_xp || (levelValue * 100) + 100;
    const prevLevelAbsolute = levelValue * 100;

    const xpIntoLevel = Math.max(0, absoluteXp - prevLevelAbsolute);
    const xpNeededThisLevel = Math.max(1, nextLevelAbsolute - prevLevelAbsolute);
    const progressValue = Math.min(100, (xpIntoLevel / xpNeededThisLevel) * 100);

    console.log('XP Store computed:', { levelValue, absoluteXp, xpIntoLevel, xpNeededThisLevel, progressValue });

    return {
      levelValue,
      totalXp: absoluteXp,
      xpToNext: Math.max(0, xpNeededThisLevel - xpIntoLevel),
      progressValue,
      nextLevelAbsolute,
    };
  };

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
        
        // Skip XP fetch for guest IDs (non-UUID format like TC-XXXX)
        if (!userId || userId.startsWith('TC-')) {
          console.log('Guest user detected, skipping XP fetch');
          set({
            xpTotal: 0,
            level: 1,
            buyerLevel: 1,
            streamLevel: 1,
            xpToNext: 100,
            progress: 0,
            isLoading: false
          });
          return;
        }
        
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .single()

        console.log('user_stats query result:', { data, error })
        
        if (error && error.code !== 'PGRST116') throw error
        
        if (data) {
          const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = _computeXpState(data);

          set({
            xpTotal: totalXp,
            level: levelValue,
            buyerLevel: levelValue,
            streamLevel: levelValue,
            xpToNext: xpToNext,
            progress: progressValue,
            isLoading: false
          });
          
          syncAuthProfile(levelValue, totalXp, nextLevelAbsolute);
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
              const data = payload.new as any;
              const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = _computeXpState(data);

              set({
                xpTotal: totalXp,
                level: levelValue,
                xpToNext: xpToNext,
                progress: progressValue
              });
              syncAuthProfile(levelValue, totalXp, nextLevelAbsolute);
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
