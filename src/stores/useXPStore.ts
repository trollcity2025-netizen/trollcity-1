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
    level?: number; xp?: number; total_xp?: number; next_level_xp?: number; xp_total?: number; xp_to_next_level?: number;
    current_level?: number; current_xp?: number; buyer_level?: number; buyer_xp?: number; stream_level?: number; stream_xp?: number;
    [key: string]: any;
  }) => {
    // Use xp_total from user_stats table (as calculated by SQL migration)
    const absoluteXp = data.xp_total || data.total_xp || data.xp || 0;
    
    // Calculate level based on the same thresholds as the SQL migration
    let levelValue = 1;
    let xpNeededThisLevel = 100;  // XP needed to reach next level
    let prevLevelAbsolute = 0;    // XP at start of current level
    let nextLevelAbsolute = 100;  // XP needed to reach next level
    
    if (absoluteXp < 100) {
      levelValue = 1;
      xpNeededThisLevel = 100;
      prevLevelAbsolute = 0;
      nextLevelAbsolute = 100;
    } else if (absoluteXp < 250) {
      levelValue = 2;
      xpNeededThisLevel = 150;
      prevLevelAbsolute = 100;
      nextLevelAbsolute = 250;
    } else if (absoluteXp < 500) {
      levelValue = 3;
      xpNeededThisLevel = 250;
      prevLevelAbsolute = 250;
      nextLevelAbsolute = 500;
    } else if (absoluteXp < 800) {
      levelValue = 4;
      xpNeededThisLevel = 300;
      prevLevelAbsolute = 500;
      nextLevelAbsolute = 800;
    } else if (absoluteXp < 1200) {
      levelValue = 5;
      xpNeededThisLevel = 400;
      prevLevelAbsolute = 800;
      nextLevelAbsolute = 1200;
    } else if (absoluteXp < 1700) {
      levelValue = 6;
      xpNeededThisLevel = 500;
      prevLevelAbsolute = 1200;
      nextLevelAbsolute = 1700;
    } else if (absoluteXp < 2300) {
      levelValue = 7;
      xpNeededThisLevel = 600;
      prevLevelAbsolute = 1700;
      nextLevelAbsolute = 2300;
    } else if (absoluteXp < 3000) {
      levelValue = 8;
      xpNeededThisLevel = 700;
      prevLevelAbsolute = 2300;
      nextLevelAbsolute = 3000;
    } else if (absoluteXp < 4000) {
      levelValue = 9;
      xpNeededThisLevel = 1000;
      prevLevelAbsolute = 3000;
      nextLevelAbsolute = 4000;
    } else {
      // Level 10+: Each level requires 1000 more XP
      levelValue = 10 + Math.floor((absoluteXp - 4000) / 1000);
      xpNeededThisLevel = 1000;
      prevLevelAbsolute = 4000 + ((levelValue - 10) * 1000);
      nextLevelAbsolute = prevLevelAbsolute + 1000;
    }

    const xpIntoLevel = Math.max(0, absoluteXp - prevLevelAbsolute);
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
      // Unsubscribe from any existing channel first
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }

      // Skip guest users
      if (!userId || userId.startsWith('TC-')) {
        console.log('[XP Store] Guest user, skipping subscription')
        return
      }

      console.log('[XP Store] Subscribing to user_stats for user:', userId)

      // Create a unique channel name for this user
      const channelName = `user_stats_changes_${userId}_${Date.now()}`
      
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'user_stats',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('[XP Store] Realtime update received:', payload)
            
            if (payload.eventType === 'DELETE') {
              console.log('[XP Store] User stats deleted, resetting')
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
              return
            }
            
            if (payload.new) {
              const data = payload.new as any;
              console.log('[XP Store] Processing new data:', data)
              
              const { levelValue, totalXp, xpToNext, progressValue, nextLevelAbsolute } = _computeXpState(data);

              console.log('[XP Store] Computed state:', { levelValue, totalXp, xpToNext, progressValue })

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
            }
          }
        )
        .subscribe((status) => {
          console.log('[XP Store] Subscription status:', status)
          if (status === 'CHANNEL_ERROR') {
            console.error('[XP Store] Channel error, will retry in 5s')
            // Retry subscription after delay
            setTimeout(() => {
              if (channel) {
                supabase.removeChannel(channel)
                channel = null
              }
              useXPStore.getState().subscribeToXP(userId)
            }, 5000)
          }
        })
    },

    unsubscribe: () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }
})
