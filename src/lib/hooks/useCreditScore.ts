import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/supabaseClient'
import { useAuthStore } from '@/lib/store'

export interface CreditScoreData {
  user_id: string
  score: number
  tier?: string
  trend_7d?: number
  updated_at?: string
}

export function useCreditScore(targetUserId?: string) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CreditScoreData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCredit = useCallback(async () => {
    const userId = targetUserId || user?.id
    if (!userId) return

    setLoading(true)
    setError(null)
    try {
      // Fetch credit_score from user_profiles
      const { data: row, error: err } = await supabase
        .from('user_profiles')
        .select('id, credit_score')
        .eq('id', userId)
        .maybeSingle()

      if (err && err.code !== 'PGRST116') throw err
      
      // PGRST116 means no rows found - that's ok
      if (row) {
        setData({
          user_id: row.id,
          score: row.credit_score ?? 400,
          updated_at: new Date().toISOString()
        } as CreditScoreData)
      } else {
        setData(null)
      }
    } catch (e: any) {
      console.error('Credit score fetch error:', e)
      setError(e?.message || 'Failed to load credit score')
    } finally {
      setLoading(false)
    }
  }, [targetUserId, user?.id])

  useEffect(() => {
    fetchCredit()
  }, [fetchCredit])

  return { data, loading, error, refresh: fetchCredit }
}
