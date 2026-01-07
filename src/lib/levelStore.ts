import { create } from 'zustand'
import { supabase } from './supabase'
import { XP_RATES, calculateNextLevelXp, getLevelUpReward } from '../config/levelSystem'
import { toast } from 'sonner'

interface DailyLog {
  date: string
  chat_xp: number
  watch_xp: number
}

interface LevelState {
  currentLevel: number
  currentXp: number
  totalXp: number
  nextLevelXp: number
  prestigeCount: number
  perkTokens: number
  unlockedPerks: string[]
  dailyLog: DailyLog
  loading: boolean
  
  // Actions
  fetchLevelData: (userId: string) => Promise<void>
  addXp: (userId: string, amount: number, source: 'chat' | 'watch' | 'gift' | 'stream' | 'other') => Promise<void>
  checkDailyLogin: (userId: string) => Promise<void>
}

export const useLevelStore = create<LevelState>((set, get) => ({
  currentLevel: 1,
  currentXp: 0,
  totalXp: 0,
  nextLevelXp: 100,
  prestigeCount: 0,
  perkTokens: 0,
  unlockedPerks: [],
  dailyLog: { date: new Date().toISOString().split('T')[0], chat_xp: 0, watch_xp: 0 },
  loading: false,

  fetchLevelData: async (userId: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching levels:', error)
        return
      }

      if (!data) {
        // Initialize if not exists
        const initialData = {
          user_id: userId,
          level: 1,
          xp: 0,
          total_xp: 0,
          next_level_xp: 100
        }
        await supabase.from('user_levels').insert(initialData)
        set({
          currentLevel: 1,
          currentXp: 0,
          totalXp: 0,
          nextLevelXp: 100
        })
      } else {
        set({
          currentLevel: data.level || data.current_level || 1,
          currentXp: data.xp || data.current_xp || 0,
          totalXp: data.total_xp || 0,
          nextLevelXp: data.next_level_xp || 100,
          prestigeCount: data.prestige_count || 0,
          perkTokens: data.perk_tokens || 0,
          unlockedPerks: data.unlocked_perks || [],
          dailyLog: (data.daily_xp_log as DailyLog) || { date: new Date().toISOString().split('T')[0], chat_xp: 0, watch_xp: 0 }
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      set({ loading: false })
    }
  },

  addXp: async (userId, amount, source) => {
    const state = get()
    const today = new Date().toISOString().split('T')[0]
    let newDailyLog = { ...state.dailyLog }

    // Reset daily log if new day
    if (newDailyLog.date !== today) {
      newDailyLog = { date: today, chat_xp: 0, watch_xp: 0 }
    }

    // Check Caps
    if (source === 'chat') {
      if (newDailyLog.chat_xp >= XP_RATES.DAILY_CHAT_XP_CAP) return
      newDailyLog.chat_xp += amount
    } else if (source === 'watch') {
      if (newDailyLog.watch_xp >= XP_RATES.DAILY_WATCH_XP_CAP) return
      newDailyLog.watch_xp += amount
    }

    // Calculate new XP
    let newCurrentXp = state.currentXp + amount
    const newTotalXp = state.totalXp + amount
    let newLevel = state.currentLevel
    let newNextLevelXp = state.nextLevelXp

    // Level Up Logic
    let leveledUp = false
    while (newCurrentXp >= newNextLevelXp) {
      leveledUp = true
      newCurrentXp -= newNextLevelXp
      newLevel++
      newNextLevelXp = calculateNextLevelXp(newLevel)
      
      // Toast Reward
      const reward = getLevelUpReward(newLevel)
      toast.success(`Leveled Up to ${newLevel}! +${reward.coins} Coins`, {
        duration: 5000,
        icon: '🎉'
      })
      
      // Note: We should actually add the coins to user_profiles here or via RPC
      // For now, we'll assume a separate trigger or we do it here:
      await supabase.rpc('add_troll_coins', { user_id: userId, amount: reward.coins })
    }

    // Optimistic Update
    set({
      currentLevel: newLevel,
      currentXp: newCurrentXp,
      totalXp: newTotalXp,
      nextLevelXp: newNextLevelXp,
      dailyLog: newDailyLog
    })

    // DB Update
    // Using upsert or update
    const { error } = await supabase
      .from('user_levels')
      .update({
        level: newLevel,
        xp: newCurrentXp,
        total_xp: newTotalXp,
        next_level_xp: newNextLevelXp,
        daily_xp_log: newDailyLog,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to sync XP:', error)
      // Revert? For now, just log.
    }
  },

  checkDailyLogin: async (userId) => {
    // This should be called on app mount
    const state = get()
    const today = new Date().toISOString().split('T')[0]
    
    // We need to fetch the last_daily_login from DB if not in state
    // But assuming fetchLevelData was called...
    
    // Implementation simplified: just add XP if we haven't already today
    // We'd need a last_login field in the store state or DB check
    // For now, let's assume fetchLevelData handles the initial load and we do logic there or separately
  }
}))
