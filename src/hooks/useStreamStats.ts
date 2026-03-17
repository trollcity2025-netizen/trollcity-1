import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'

export function useStreamStats(streamerId: string | null) {
  const [viewerCount, setViewerCount] = useState(1)
  const [duration, setDuration] = useState('00:00:00')
  const [streamerStats, setStreamerStats] = useState<any>(null)

  // Live timer
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const diff = Date.now() - start
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDuration(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])



  // Fetch streamer stats (coins, level, badge)
  useEffect(() => {
    if (!streamerId) return

    const fetchStreamerStats = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('username, level, total_earned_coins, troll_coins, troll_coins')
          .eq('id', streamerId)
          .single()

        if (data) {
          setStreamerStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch streamer stats:', error)
      }
    }

    fetchStreamerStats()
    
    // Polling for streamer stats (coins/level) instead of Realtime
    // This reduces DB load when many viewers are watching one streamer
    // Reduced from 30s to 60s to reduce disk I/O
    const interval = setInterval(() => {
        fetchStreamerStats();
    }, 60000); // Poll every 60s

    return () => {
      clearInterval(interval);
    }
  }, [streamerId])

  return { viewerCount, duration, streamerStats }
}

