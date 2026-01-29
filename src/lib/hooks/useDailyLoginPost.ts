import { useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { useCoins } from './useCoins'
import { toast } from 'sonner'

interface DailyLoginPostReward {
  success: boolean
  coinsEarned: number
  message: string
  canPostToday: boolean
  lastPostDate?: string
}

/**
 * Hook for managing daily login wall posts with coin rewards
 * Users can post once per day to earn random coins (0-100)
 */
export function useDailyLoginPost() {
  const { user } = useAuthStore()
  const { refreshCoins } = useCoins()
  const [loading, setLoading] = useState(false)
  const [canPostToday, setCanPostToday] = useState(true)
  const [lastPostDate, setLastPostDate] = useState<string | null>(null)

  // Check if user has already posted today
  const checkDailyPostStatus = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('daily_login_posts')
        .select('posted_at')
        .eq('user_id', user.id)
        .gte('posted_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lte('posted_at', new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking daily post status:', error)
        return
      }

      // If there's a record from today, user cannot post
      if (data) {
        setCanPostToday(false)
        setLastPostDate(data.posted_at)
      } else {
        setCanPostToday(true)
        setLastPostDate(null)
      }
    } catch (err) {
      console.error('Error checking daily post status:', err)
      setCanPostToday(true)
    }
  }, [user?.id])

  // Generate random coin reward (0-100)
  const generateRandomReward = useCallback(() => {
    return Math.floor(Math.random() * 101) // 0-100 inclusive
  }, [])


  // No-op for submitDailyPost, just for compatibility
  const submitDailyPost = useCallback(async (postId: string) => ({
    success: true,
    coinsEarned: 0,
    message: 'Posted',
    canPostToday: false,
    lastPostDate: new Date().toISOString(),
  }), [])

  return {
    loading,
    canPostToday,
    lastPostDate,
    checkDailyPostStatus,
    submitDailyPost,
    generateRandomReward,
  }
}
