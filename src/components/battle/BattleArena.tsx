import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Trophy, Timer, Coins, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

interface BattleArenaProps {
  battleId: string
  broadcaster1Id: string
  broadcaster2Id: string
  stream1Id: string | null
  stream2Id: string | null
  onBattleEnd: (winnerId: string | null) => void
}

type BattleParticipant = {
  user_id: string
  username?: string
  avatar_url?: string
  role?: string
  joined_at?: string
}

interface BattleStats {
  hostTrollCoins: number
  challengerTrollCoins: number
  timeRemaining: number
  status: string
}

export default function BattleArena({
  battleId,
  broadcaster1Id,
  broadcaster2Id,
  stream1Id,
  stream2Id,
  onBattleEnd,
}: BattleArenaProps) {
  const { profile } = useAuthStore()
  const [battleStats, setBattleStats] = useState<BattleStats>({
    hostTrollCoins: 0,
    challengerTrollCoins: 0,
    timeRemaining: 120, // 2 minutes
    status: 'countdown',
  })
  const [countdown, setCountdown] = useState(5)
  const [broadcaster1, setBroadcaster1] = useState<any>(null)
  const [broadcaster2, setBroadcaster2] = useState<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const [battleGuests, setBattleGuests] = useState<{
    hostGuests: BattleParticipant[]
    challengerGuests: BattleParticipant[]
  }>({
    hostGuests: [],
    challengerGuests: [],
  })

  // Load broadcaster profiles
  useEffect(() => {
    const loadBroadcasters = async () => {
      const { data: b1 } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('id', broadcaster1Id)
        .single()
      
      const { data: b2 } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('id', broadcaster2Id)
        .single()
      
      if (b1) setBroadcaster1(b1)
      if (b2) setBroadcaster2(b2)
    }
    loadBroadcasters()
  }, [broadcaster1Id, broadcaster2Id])

  const loadBattleArenaView = useCallback(async () => {
    const { data, error } = await supabase
      .from('battle_arena_view')
      .select('host_guests, challenger_guests')
      .eq('id', battleId)
      .maybeSingle()

    if (error) {
      console.error('Failed to load battle guests:', error)
      return
    }

    if (data) {
      setBattleGuests({
        hostGuests: data.host_guests || [],
        challengerGuests: data.challenger_guests || [],
      })
    }
  }, [battleId])

  // Countdown before battle starts
  useEffect(() => {
    if (battleStats.status === 'countdown') {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Start battle
            supabase
              .from('troll_battles')
              .update({ status: 'active', started_at: new Date().toISOString() })
              .eq('id', battleId)
            setBattleStats((s) => ({ ...s, status: 'active' }))
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [battleStats.status, battleId])

  // Battle timer
  useEffect(() => {
    if (battleStats.status === 'active') {
      timerRef.current = setInterval(() => {
        setBattleStats((s) => {
          const newTime = s.timeRemaining - 1
          if (newTime <= 0) {
            // End battle
            endBattle()
            return { ...s, timeRemaining: 0, status: 'completed' }
          }
          return { ...s, timeRemaining: newTime }
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [battleStats.status])

  // Subscribe to battle updates
  useEffect(() => {
    const channel = supabase
      .channel(`battle-${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'troll_battles',
          filter: `id=eq.${battleId}`,
        },
        (payload) => {
          const updated = payload.new as any
          setBattleStats((prev) => ({
            ...prev,
            hostTrollCoins: updated.host_troll_coins || 0,
            challengerTrollCoins: updated.challenger_troll_coins || 0,
            status: updated.status,
          }))
          loadBattleArenaView().catch(console.error)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [battleId, loadBattleArenaView])

  // Load initial battle stats
  useEffect(() => {
    const loadBattleStats = async () => {
      const { data, error } = await supabase
        .from('troll_battles')
        .select('*')
        .eq('id', battleId)
        .single()

      if (data && !error) {
        const started = data.started_at ? new Date(data.started_at) : null
        const now = new Date()
        const elapsed = started ? Math.floor((now.getTime() - started.getTime()) / 1000) : 0
        const remaining = Math.max(0, 120 - elapsed)

        setBattleStats({
          hostTrollCoins: data.host_troll_coins || 0,
          challengerTrollCoins: data.challenger_troll_coins || 0,
          timeRemaining: remaining,
          status: data.status,
        })
        loadBattleArenaView().catch(console.error)
      }
    }
    loadBattleStats()
  }, [battleId, loadBattleArenaView])

  const endBattle = async () => {
    const { data, error } = await supabase.rpc('end_battle_and_declare_winner', {
      p_battle_id: battleId,
    })

    if (error) {
      console.error('Error ending battle:', error)
      toast.error('Failed to end battle')
      return
    }

    if (data?.success) {
      onBattleEnd(data.winner_id)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getLeadingBroadcaster = () => {
    if (battleStats.hostTrollCoins > battleStats.challengerTrollCoins) return 1
    if (battleStats.challengerTrollCoins > battleStats.hostTrollCoins) return 2
    return null
  }

  const leading = getLeadingBroadcaster()

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0A0814] via-[#1a0a2e] to-[#0A0814]">
      {/* Battle Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/60 backdrop-blur-sm border-b-2 border-troll-neon-blue">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-troll-gold animate-pulse" />
            <h1 className="text-2xl font-bold text-white">Troll Battle Arena</h1>
          </div>
          
          {battleStats.status === 'countdown' && (
            <div className="flex items-center gap-2 text-3xl font-bold text-troll-neon-green">
              <Timer className="w-8 h-8" />
              <span className="animate-pulse">{countdown}</span>
            </div>
          )}
          
          {battleStats.status === 'active' && (
            <div className="flex items-center gap-2 text-2xl font-bold text-troll-neon-blue">
              <Timer className="w-6 h-6" />
              <span className={battleStats.timeRemaining <= 30 ? 'text-red-500 animate-pulse' : ''}>
                {formatTime(battleStats.timeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Battle Arena - Side by Side */}
      <div className="flex h-full pt-20">
        {/* Broadcaster 1 */}
        <div className={`flex-1 relative border-r-4 ${leading === 1 ? 'border-troll-gold' : 'border-troll-neon-blue'}`}>
          <div className="absolute top-4 left-4 z-20 bg-black/80 rounded-lg px-4 py-2 border-2 border-troll-neon-blue">
            <div className="flex items-center gap-2">
              {broadcaster1?.avatar_url && (
                <img src={broadcaster1.avatar_url} alt={broadcaster1.username} className="w-8 h-8 rounded-full" />
              )}
              <span className="font-bold text-white">@{broadcaster1?.username || 'Loading...'}</span>
              {leading === 1 && <Trophy className="w-5 h-5 text-troll-gold" />}
            </div>
          </div>
          
          {/* Video Stream Placeholder */}
          <div className="w-full h-full bg-black flex items-center justify-center">
            {stream1Id ? (
              <div className="text-white">Stream 1 Video Feed</div>
            ) : (
              <div className="text-gray-500">No stream</div>
            )}
          </div>

          {/* Coin Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 border-t-2 border-troll-neon-blue">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-troll-gold" />
            <span className="text-sm text-gray-400">Troll Coins (Winning)</span>
            <span className="text-xl font-bold text-troll-gold">
              {battleStats.hostTrollCoins.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Only Troll Coins earned during the battle determine victory.
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">
            Guests (max 4)
          </div>
          {battleGuests.hostGuests.length === 0 ? (
            <div className="text-xs text-gray-500 mt-1">No guests yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {battleGuests.hostGuests.map((guest) => (
                <span
                  key={`${guest.user_id}-host`}
                  className="px-2 py-1 rounded-full bg-white/10 text-[10px] text-white border border-white/10"
                >
                  {guest.username || guest.user_id}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* VS Divider */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="bg-black/90 rounded-full p-6 border-4 border-troll-gold animate-pulse">
            <span className="text-4xl font-bold text-troll-gold">VS</span>
          </div>
        </div>

        {/* Broadcaster 2 */}
        <div className={`flex-1 relative border-l-4 ${leading === 2 ? 'border-troll-gold' : 'border-troll-neon-blue'}`}>
          <div className="absolute top-4 right-4 z-20 bg-black/80 rounded-lg px-4 py-2 border-2 border-troll-neon-blue">
            <div className="flex items-center gap-2">
              {broadcaster2?.avatar_url && (
                <img src={broadcaster2.avatar_url} alt={broadcaster2.username} className="w-8 h-8 rounded-full" />
              )}
              <span className="font-bold text-white">@{broadcaster2?.username || 'Loading...'}</span>
              {leading === 2 && <Trophy className="w-5 h-5 text-troll-gold" />}
            </div>
          </div>
          
          {/* Video Stream Placeholder */}
          <div className="w-full h-full bg-black flex items-center justify-center">
            {stream2Id ? (
              <div className="text-white">Stream 2 Video Feed</div>
            ) : (
              <div className="text-gray-500">No stream</div>
            )}
          </div>

          {/* Coin Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 border-t-2 border-troll-neon-blue">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-troll-gold" />
            <span className="text-sm text-gray-400">Troll Coins (Winning)</span>
            <span className="text-xl font-bold text-troll-gold">
              {battleStats.challengerTrollCoins.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Only Troll Coins earned during the battle determine victory.
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">
            Guests (max 4)
          </div>
          {battleGuests.challengerGuests.length === 0 ? (
            <div className="text-xs text-gray-500 mt-1">No guests yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {battleGuests.challengerGuests.map((guest) => (
                <span
                  key={`${guest.user_id}-challenger`}
                  className="px-2 py-1 rounded-full bg-white/10 text-[10px] text-white border border-white/10"
                >
                  {guest.username || guest.user_id}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Chat Area (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-black/90 border-t-2 border-troll-neon-blue">
        <div className="p-4 text-white">
          <p className="text-sm text-gray-400">Battle Chat - Send gifts to support your favorite broadcaster!</p>
          <p className="text-xs text-gray-500 mt-1">
            Only paid coins count toward winning. Free coins create effects and animations.
          </p>
        </div>
      </div>
    </div>
  )
}

