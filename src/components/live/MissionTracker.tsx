import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import {
  Target,
  Clock,
  Zap,
  Trophy,
  Users,
  Swords,
  Timer,
  ChevronRight,
  Star,
  Gift,
  Check,
  ChevronDown,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type MissionType = 'solo' | 'community' | 'competitive' | 'timed'
type MissionDifficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'legendary'

interface StreamMission {
  id: string
  stream_id: string
  title: string
  description: string | null
  mission_type: MissionType
  difficulty: MissionDifficulty
  target_value: number
  current_value: number
  reward_coins: number
  reward_xp: number
  is_completed: boolean
  completed_at: string | null
  chain_id: string | null
  chain_order: number | null
  chain_unlocks_at: string | null
  timed_ends_at: string | null
  timed_started_at: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

interface MissionTrackerProps {
  streamId: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<MissionType, { icon: React.ReactNode; label: string; color: string; badge: string }> = {
  solo: {
    icon: <Target className="w-4 h-4" />,
    label: 'Solo',
    color: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  community: {
    icon: <Users className="w-4 h-4" />,
    label: 'Community',
    color: 'text-green-400',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
  },
  competitive: {
    icon: <Swords className="w-4 h-4" />,
    label: 'Competitive',
    color: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  timed: {
    icon: <Timer className="w-4 h-4" />,
    label: 'Timed',
    color: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
}

const DIFFICULTY_CONFIG: Record<MissionDifficulty, { color: string; glow: string; label: string }> = {
  easy: {
    color: 'from-green-500 to-green-400',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.4)]',
    label: 'Easy',
  },
  normal: {
    color: 'from-blue-500 to-blue-400',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]',
    label: 'Normal',
  },
  hard: {
    color: 'from-purple-500 to-purple-400',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.4)]',
    label: 'Hard',
  },
  extreme: {
    color: 'from-red-500 to-red-400',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
    label: 'Extreme',
  },
  legendary: {
    color: 'from-yellow-500 to-amber-400',
    glow: 'shadow-[0_0_16px_rgba(245,158,11,0.5)]',
    label: 'Legendary',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

// ─── Countdown Hook ─────────────────────────────────────────────────────────

function useCountdown(endTime: string | null): number {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!endTime) return

    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now()
      setRemaining(Math.max(0, diff))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  return remaining
}

// ─── Sub Components ─────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: MissionDifficulty }) {
  const config = DIFFICULTY_CONFIG[difficulty]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
        'bg-gradient-to-r',
        config.color,
        'text-white border-white/10',
      )}
    >
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: MissionType }) {
  const config = TYPE_CONFIG[type]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
        config.badge,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function AnimatedProgressBar({
  current,
  target,
  difficulty,
  isCompleted,
}: {
  current: number
  target: number
  difficulty: MissionDifficulty
  isCompleted: boolean
}) {
  const percent = getProgressPercent(current, target)
  const diffConfig = DIFFICULTY_CONFIG[difficulty]

  return (
    <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
          diffConfig.color,
          isCompleted && 'animate-pulse',
        )}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {isCompleted && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function TimedCountdown({ endsAt }: { endsAt: string }) {
  const remaining = useCountdown(endsAt)
  const isUrgent = remaining < 60000 && remaining > 0
  const isExpired = remaining <= 0

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-sm font-bold',
        isExpired
          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
          : isUrgent
            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-pulse'
            : 'bg-white/5 text-white/80 border border-white/10',
      )}
    >
      <Clock className="w-3.5 h-3.5" />
      {isExpired ? 'EXPIRED' : formatCountdown(remaining)}
    </div>
  )
}

function MissionCard({
  mission,
  index,
}: {
  mission: StreamMission
  index: number
}) {
  const typeConfig = TYPE_CONFIG[mission.mission_type]
  const diffConfig = DIFFICULTY_CONFIG[mission.difficulty]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-300',
        mission.is_completed
          ? 'bg-green-950/20 border-green-500/20'
          : 'bg-white/[0.03] border-white/10 hover:border-white/20',
        diffConfig.glow,
      )}
    >
      {mission.is_completed && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_12px_rgba(34,197,94,0.6)]"
        >
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </motion.div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
              'bg-gradient-to-br',
              diffConfig.color,
              'shadow-lg',
            )}
          >
            {typeConfig.icon}
          </div>
          <div className="min-w-0">
            <h4
              className={cn(
                'text-sm font-bold truncate',
                mission.is_completed ? 'text-green-300' : 'text-white',
              )}
            >
              {mission.title}
            </h4>
            {mission.description && (
              <p className="text-[11px] text-white/40 truncate">{mission.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <TypeBadge type={mission.mission_type} />
          <DifficultyBadge difficulty={mission.difficulty} />
        </div>
      </div>

      <AnimatedProgressBar
        current={mission.current_value}
        target={mission.target_value}
        difficulty={mission.difficulty}
        isCompleted={mission.is_completed}
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          {mission.mission_type === 'timed' && mission.timed_ends_at && (
            <TimedCountdown endsAt={mission.timed_ends_at} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {mission.reward_coins > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-400 font-semibold">
              <Gift className="w-3 h-3" />
              {mission.reward_coins.toLocaleString()}
            </span>
          )}
          {mission.reward_xp > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-purple-400 font-semibold">
              <Zap className="w-3 h-3" />
              {mission.reward_xp.toLocaleString()} XP
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ChainMissionList({ missions }: { missions: StreamMission[] }) {
  const sorted = [...missions].sort((a, b) => (a.chain_order ?? 0) - (b.chain_order ?? 0))

  return (
    <div className="relative pl-4">
      <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/40 via-blue-500/40 to-transparent" />
      <div className="space-y-3">
        {sorted.map((mission, idx) => {
          const isLocked = !mission.is_completed && idx > 0 && !sorted[idx - 1].is_completed
          return (
            <div key={mission.id} className="relative">
              <div
                className={cn(
                  'absolute -left-4 top-4 w-3 h-3 rounded-full border-2 z-10',
                  mission.is_completed
                    ? 'bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                    : isLocked
                      ? 'bg-zinc-700 border-zinc-600'
                      : 'bg-purple-500 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
                )}
              />
              {idx < sorted.length - 1 && !mission.is_completed && (
                <div className="absolute -left-3 top-7 text-zinc-600">
                  <ChevronRight className="w-3 h-3 rotate-90" />
                </div>
              )}
              <div className={cn(isLocked && 'opacity-50 pointer-events-none')}>
                <MissionCard mission={mission} index={idx} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MissionSection({
  title,
  icon,
  missions,
  defaultOpen = true,
  badgeColor,
}: {
  title: string
  icon: React.ReactNode
  missions: StreamMission[]
  defaultOpen?: boolean
  badgeColor: string
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (missions.length === 0) return null

  const completedCount = missions.filter((m) => m.is_completed).length

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={badgeColor}>{icon}</span>
          <span className="text-sm font-bold text-white">{title}</span>
          <span className="text-[10px] font-semibold text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
            {completedCount}/{missions.length}
          </span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {missions.map((mission, idx) => (
                <MissionCard key={mission.id} mission={mission} index={idx} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CompletedSection({ missions }: { missions: StreamMission[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (missions.length === 0) return null

  return (
    <div className="rounded-xl border border-green-500/20 bg-green-950/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-500/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold text-green-300">Completed</span>
          <span className="text-[10px] font-semibold text-green-400/60 bg-green-500/10 px-2 py-0.5 rounded-full">
            {missions.length}
          </span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-green-400/60" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {missions.map((mission, idx) => (
                <MissionCard key={mission.id} mission={mission} index={idx} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MissionTracker({ streamId }: MissionTrackerProps) {
  const [missions, setMissions] = useState<StreamMission[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchMissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('stream_missions')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[MissionTracker] Error fetching missions:', error)
      return
    }

    setMissions((data || []) as StreamMission[])
    setLoading(false)
  }, [streamId])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream_missions:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_missions',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const eventType = payload.eventType
          const newRow = payload.new as StreamMission | null
          const oldRow = payload.old as StreamMission | null

          setMissions((prev) => {
            if (eventType === 'INSERT' && newRow) {
              if (prev.some((m) => m.id === newRow.id)) return prev
              return [...prev, newRow]
            }

            if (eventType === 'UPDATE' && newRow) {
              return prev.map((m) => (m.id === newRow.id ? newRow : m))
            }

            if (eventType === 'DELETE' && oldRow) {
              return prev.filter((m) => m.id !== oldRow.id)
            }

            return prev
          })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [streamId])

  // ── Group missions ──────────────────────────────────────────────────────

  const activeMissions = missions.filter((m) => !m.is_completed)
  const completedMissions = missions.filter((m) => m.is_completed)

  // Chain missions: group by chain_id
  const chainGroups = new Map<string, StreamMission[]>()
  const nonChainActive: StreamMission[] = []

  activeMissions.forEach((m) => {
    if (m.chain_id) {
      const existing = chainGroups.get(m.chain_id) || []
      existing.push(m)
      chainGroups.set(m.chain_id, existing)
    } else {
      nonChainActive.push(m)
    }
  })

  // Non-chain active missions by type
  const soloMissions = nonChainActive.filter((m) => m.mission_type === 'solo')
  const communityMissions = nonChainActive.filter((m) => m.mission_type === 'community')
  const competitiveMissions = nonChainActive.filter((m) => m.mission_type === 'competitive')
  const timedMissions = nonChainActive.filter((m) => m.mission_type === 'timed')

  const totalActive = activeMissions.length
  const totalCompleted = completedMissions.length

  if (loading) {
    return (
      <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 animate-pulse" />
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-transparent to-blue-900/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,0.08),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.4)]">
                <Star className="w-5 h-5 text-white" />
              </div>
              {totalActive > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                >
                  {totalActive}
                </motion.div>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Stream Missions</h3>
              <p className="text-[11px] text-white/40">
                {totalActive} active &middot; {totalCompleted} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-sm text-white/40 font-semibold">No missions yet</p>
            <p className="text-xs text-white/20 mt-1">Missions will appear here when the broadcaster starts them</p>
          </div>
        ) : (
          <>
            {/* Timed Missions */}
            <MissionSection
              title="Timed Missions"
              icon={<Timer className="w-4 h-4" />}
              missions={timedMissions}
              defaultOpen={true}
              badgeColor="text-orange-400"
            />

            {/* Solo Missions */}
            <MissionSection
              title="Solo Missions"
              icon={<Target className="w-4 h-4" />}
              missions={soloMissions}
              defaultOpen={true}
              badgeColor="text-blue-400"
            />

            {/* Community Missions */}
            <MissionSection
              title="Community Missions"
              icon={<Users className="w-4 h-4" />}
              missions={communityMissions}
              defaultOpen={true}
              badgeColor="text-green-400"
            />

            {/* Competitive Missions */}
            <MissionSection
              title="Competitive Missions"
              icon={<Swords className="w-4 h-4" />}
              missions={competitiveMissions}
              defaultOpen={true}
              badgeColor="text-red-400"
            />

            {/* Chain Missions */}
            {Array.from(chainGroups.entries()).map(([chainId, chainMissions]) => {
              const sorted = [...chainMissions].sort(
                (a, b) => (a.chain_order ?? 0) - (b.chain_order ?? 0),
              )
              const chainTitle = sorted[0]?.chain_id
                ? `Chain: ${sorted[0].title.split(':')[0]?.trim() || 'Mission Chain'}`
                : 'Mission Chain'

              return (
                <div key={chainId} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-purple-400">
                        <Zap className="w-4 h-4" />
                        <ChevronRight className="w-3 h-3" />
                      </div>
                      <span className="text-sm font-bold text-white">{chainTitle}</span>
                      <span className="text-[10px] text-white/30 font-semibold">
                        {sorted.filter((m) => m.is_completed).length}/{sorted.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <ChainMissionList missions={sorted} />
                  </div>
                </div>
              )
            })}

            {/* Completed */}
            <CompletedSection missions={completedMissions} />
          </>
        )}
      </div>

      {/* Footer glow */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
    </div>
  )
}
