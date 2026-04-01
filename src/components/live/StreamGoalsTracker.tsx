import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import {
  Users,
  Gift,
  Coins,
  MessageCircle,
  Target,
  Check,
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  ChevronDown,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type GoalType = 'viewers' | 'gifts' | 'coins' | 'chat'

interface StreamGoal {
  id: string
  stream_id: string
  title: string
  goal_type: GoalType
  target_value: number
  current_value: number
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface StreamGoalsTrackerProps {
  streamId: string
  className?: string
  compact?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GOAL_TYPE_CONFIG: Record<
  GoalType,
  {
    icon: React.ReactNode
    label: string
    gradient: string
    glow: string
    barGradient: string
    textColor: string
    bgAccent: string
    particleColor: string
  }
> = {
  viewers: {
    icon: <Users className="w-4 h-4" />,
    label: 'Viewers',
    gradient: 'from-blue-500 to-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
    barGradient: 'from-blue-600 via-blue-400 to-cyan-400',
    textColor: 'text-blue-400',
    bgAccent: 'bg-blue-500/20',
    particleColor: '#3b82f6',
  },
  gifts: {
    icon: <Gift className="w-4 h-4" />,
    label: 'Gifts',
    gradient: 'from-purple-500 to-pink-400',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
    barGradient: 'from-purple-600 via-purple-400 to-pink-400',
    textColor: 'text-purple-400',
    bgAccent: 'bg-purple-500/20',
    particleColor: '#a855f7',
  },
  coins: {
    icon: <Coins className="w-4 h-4" />,
    label: 'Coins',
    gradient: 'from-yellow-500 to-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    barGradient: 'from-yellow-600 via-yellow-400 to-amber-300',
    textColor: 'text-yellow-400',
    bgAccent: 'bg-yellow-500/20',
    particleColor: '#eab308',
  },
  chat: {
    icon: <MessageCircle className="w-4 h-4" />,
    label: 'Chat',
    gradient: 'from-green-500 to-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]',
    barGradient: 'from-green-600 via-green-400 to-emerald-400',
    textColor: 'text-green-400',
    bgAccent: 'bg-green-500/20',
    particleColor: '#22c55e',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, (current / target) * 100)
}

function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '--'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── Animated Counter ───────────────────────────────────────────────────────

function AnimatedCounter({
  value,
  duration = 0.8,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = prevRef.current
    const diff = value - start
    const startTime = performance.now()
    const durationMs = duration * 1000

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    prevRef.current = value
  }, [value, duration])

  return <span className={className}>{display.toLocaleString()}</span>
}

// ─── Percentage Counter ─────────────────────────────────────────────────────

function PercentageCounter({
  percent,
  className,
}: {
  percent: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = prevRef.current
    const diff = percent - start
    const startTime = performance.now()
    const durationMs = 800

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round((start + diff * eased) * 10) / 10)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    prevRef.current = percent
  }, [percent])

  return <span className={className}>{Math.round(display)}%</span>
}

// ─── Particle Burst ─────────────────────────────────────────────────────────

function ParticleBurst({ color, isActive }: { color: string; isActive: boolean }) {
  if (!isActive) return null

  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360
    const distance = 40 + Math.random() * 60
    const x = Math.cos((angle * Math.PI) / 180) * distance
    const y = Math.sin((angle * Math.PI) / 180) * distance
    const size = 3 + Math.random() * 5
    const delay = Math.random() * 0.15
    const duration = 0.5 + Math.random() * 0.4

    return (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: `0 0 ${size * 2}px ${color}`,
          left: '50%',
          top: '50%',
        }}
        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
        animate={{ x, y, opacity: 0, scale: 0 }}
        transition={{ duration, delay, ease: 'easeOut' }}
      />
    )
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
      {particles}
    </div>
  )
}

// ─── Confetti Burst ─────────────────────────────────────────────────────────

function ConfettiBurst({ isActive }: { isActive: boolean }) {
  if (!isActive) return null

  const colors = ['#3b82f6', '#a855f7', '#eab308', '#22c55e', '#ef4444', '#f97316', '#ec4899']
  const confetti = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * 360 + Math.random() * 20
    const distance = 60 + Math.random() * 100
    const x = Math.cos((angle * Math.PI) / 180) * distance
    const y = Math.sin((angle * Math.PI) / 180) * distance - 20
    const w = 4 + Math.random() * 6
    const h = 2 + Math.random() * 3
    const rotation = Math.random() * 720 - 360
    const delay = Math.random() * 0.2

    return (
      <motion.div
        key={i}
        className="absolute rounded-sm"
        style={{
          width: w,
          height: h,
          backgroundColor: colors[i % colors.length],
          left: '50%',
          top: '50%',
        }}
        initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
        animate={{ x, y, opacity: 0, rotate: rotation }}
        transition={{ duration: 0.9 + Math.random() * 0.4, delay, ease: 'easeOut' }}
      />
    )
  })

  return <div className="absolute inset-0 pointer-events-none overflow-visible z-20">{confetti}</div>
}

// ─── Shimmer Progress Bar ───────────────────────────────────────────────────

function ShimmerProgressBar({
  current,
  target,
  goalType,
  isCompleted,
  compact,
}: {
  current: number
  target: number
  goalType: GoalType
  isCompleted: boolean
  compact?: boolean
}) {
  const percent = getProgressPercent(current, target)
  const config = GOAL_TYPE_CONFIG[goalType]

  const barHeight = compact ? 'h-2.5' : 'h-3.5'

  return (
    <div
      className={cn(
        'relative w-full rounded-full overflow-hidden border border-white/10',
        barHeight,
        'bg-white/[0.06]',
      )}
    >
      {/* Fill */}
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
          config.barGradient,
        )}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      {/* Shimmer overlay - always active */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.0) 30%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.0) 70%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />

      {/* Completion glow */}
      {isCompleted && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            boxShadow: `inset 0 0 12px ${config.particleColor}80`,
          }}
        />
      )}

      {/* Value text overlay */}
      {!compact && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            <AnimatedCounter value={current} /> / {target.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── ETA Calculator ─────────────────────────────────────────────────────────

function useEstimatedETA(current: number, target: number): string | null {
  const [eta, setEta] = useState<string | null>(null)
  const historyRef = useRef<{ time: number; value: number }[]>([])

  useEffect(() => {
    const now = Date.now()
    historyRef.current.push({ time: now, value: current })

    // Keep last 30 seconds of data
    const cutoff = now - 30_000
    historyRef.current = historyRef.current.filter((h) => h.time >= cutoff)

    if (historyRef.current.length < 2) {
      setEta(null)
      return
    }

    const first = historyRef.current[0]
    const last = historyRef.current[historyRef.current.length - 1]
    const elapsed = (last.time - first.time) / 1000
    const gained = last.value - first.value

    if (elapsed <= 0 || gained <= 0) {
      setEta(null)
      return
    }

    const rate = gained / elapsed
    const remaining = target - current
    const seconds = remaining / rate

    setEta(formatETA(seconds))
  }, [current, target])

  return eta
}

// ─── Goal Card ──────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  index,
  compact,
}: {
  goal: StreamGoal
  index: number
  compact?: boolean
}) {
  const config = GOAL_TYPE_CONFIG[goal.goal_type]
  const percent = getProgressPercent(goal.current_value, goal.target_value)
  const eta = useEstimatedETA(goal.current_value, goal.target_value)

  const [justCompleted, setJustCompleted] = useState(false)
  const prevCompletedRef = useRef(goal.is_completed)

  useEffect(() => {
    if (goal.is_completed && !prevCompletedRef.current) {
      setJustCompleted(true)
      const timer = setTimeout(() => setJustCompleted(false), 2500)
      return () => clearTimeout(timer)
    }
    prevCompletedRef.current = goal.is_completed
  }, [goal.is_completed])

  // Trigger celebration sound
  useEffect(() => {
    if (justCompleted) {
      try {
        const audio = new Audio('/sounds/goal-complete.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch {}
    }
  }, [justCompleted])

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20, scale: 0.9 }}
        transition={{ duration: 0.3, delay: index * 0.06 }}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-300',
          goal.is_completed
            ? 'bg-green-950/20 border-green-500/20'
            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15',
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br',
            config.gradient,
            'shadow-lg',
          )}
        >
          <motion.div
            animate={goal.is_completed ? { rotate: [0, 360] } : {}}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {goal.is_completed ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> : config.icon}
          </motion.div>
        </div>

        {/* Title + Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span
              className={cn(
                'text-[11px] font-semibold truncate',
                goal.is_completed ? 'text-green-300' : 'text-white/90',
              )}
            >
              {goal.title}
            </span>
            <PercentageCounter percent={percent} className={cn('text-[10px] font-bold ml-2 flex-shrink-0', config.textColor)} />
          </div>
          <ShimmerProgressBar
            current={goal.current_value}
            target={goal.target_value}
            goalType={goal.goal_type}
            isCompleted={goal.is_completed}
            compact
          />
        </div>

        {/* Particle effects */}
        <ParticleBurst color={config.particleColor} isActive={justCompleted} />
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -10 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative rounded-xl border p-4 overflow-visible transition-all duration-500',
        goal.is_completed
          ? cn('bg-green-950/20 border-green-500/20', goal.is_completed && 'ring-1 ring-green-500/30')
          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15 hover:bg-white/[0.05]',
      )}
    >
      {/* Completion glow */}
      {goal.is_completed && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            boxShadow: `inset 0 0 30px ${config.particleColor}15, 0 0 20px ${config.particleColor}10`,
          }}
        />
      )}

      {/* Particle effects */}
      <ParticleBurst color={config.particleColor} isActive={justCompleted} />
      <ConfettiBurst isActive={justCompleted} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br',
              config.gradient,
              'shadow-lg',
              !goal.is_completed && 'ring-1 ring-white/10',
            )}
          >
            <motion.div
              animate={justCompleted ? { rotate: [0, 360], scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            >
              {goal.is_completed ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </motion.div>
              ) : (
                config.icon
              )}
            </motion.div>
          </div>
          <div className="min-w-0">
            <h4
              className={cn(
                'text-sm font-bold truncate',
                goal.is_completed ? 'text-green-300' : 'text-white',
              )}
            >
              {goal.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', config.textColor)}>
                {config.label}
              </span>
              {!goal.is_completed && eta && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="w-2.5 h-2.5" />
                  ~{eta}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <PercentageCounter
            percent={percent}
            className={cn(
              'text-sm font-black tabular-nums',
              goal.is_completed ? 'text-green-400' : config.textColor,
            )}
          />
          {!goal.is_completed && (
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <TrendingUp className="w-2.5 h-2.5" />
              <AnimatedCounter value={goal.current_value} className="font-semibold" />
              <span>/</span>
              <span>{goal.target_value.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10">
        <ShimmerProgressBar
          current={goal.current_value}
          target={goal.target_value}
          goalType={goal.goal_type}
          isCompleted={goal.is_completed}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 relative z-10">
        {goal.is_completed ? (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-[11px] text-green-400 font-semibold"
          >
            <Sparkles className="w-3 h-3" />
            Goal Complete!
            {goal.completed_at && (
              <span className="text-green-400/50 font-normal ml-1">
                {new Date(goal.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Zap className="w-2.5 h-2.5" />
            <span>
              {goal.target_value - goal.current_value > 0
                ? `${(goal.target_value - goal.current_value).toLocaleString()} remaining`
                : 'Almost there!'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StreamGoalsTracker({ streamId, className, compact = false }: StreamGoalsTrackerProps) {
  const [goals, setGoals] = useState<StreamGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[StreamGoalsTracker] Error fetching goals:', error)
      return
    }

    setGoals((data || []) as StreamGoal[])
    setLoading(false)
  }, [streamId])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream_goals:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_goals',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const eventType = payload.eventType
          const newRow = payload.new as StreamGoal | null
          const oldRow = payload.old as StreamGoal | null

          setGoals((prev) => {
            if (eventType === 'INSERT' && newRow) {
              if (prev.some((g) => g.id === newRow.id)) return prev
              return [...prev, newRow]
            }
            if (eventType === 'UPDATE' && newRow) {
              return prev.map((g) => (g.id === newRow.id ? newRow : g))
            }
            if (eventType === 'DELETE' && oldRow) {
              return prev.filter((g) => g.id !== oldRow.id)
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

  const activeGoals = useMemo(() => goals.filter((g) => !g.is_completed), [goals])
  const completedGoals = useMemo(() => goals.filter((g) => g.is_completed), [goals])
  const totalCompleted = completedGoals.length
  const totalGoals = goals.length
  const overallPercent = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0

  // ── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className={cn(
          'relative rounded-2xl border border-white/10 overflow-hidden',
          'bg-black/80 backdrop-blur-xl',
          className,
        )}
      >
        <div className={cn('p-4', compact && 'p-3')}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 animate-pulse" />
            <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
          </div>
          <div className={cn('space-y-3', compact && 'space-y-2')}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('bg-white/5 rounded-xl animate-pulse', compact ? 'h-10' : 'h-20')} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Compact Mode ────────────────────────────────────────────────────────

  if (compact) {
    return (
      <div
        className={cn(
          'relative rounded-xl border border-white/10 overflow-hidden',
          'bg-black/80 backdrop-blur-xl',
          className,
        )}
      >
        {/* Compact header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-white">Goals</span>
            <span className="text-[10px] font-semibold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full">
              {totalCompleted}/{totalGoals}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold', GOAL_TYPE_CONFIG.viewers.textColor)}>
              {overallPercent}%
            </span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2">
                <AnimatePresence mode="popLayout">
                  {[...activeGoals, ...completedGoals].map((goal, idx) => (
                    <GoalCard key={goal.id} goal={goal} index={idx} compact />
                  ))}
                </AnimatePresence>
                {goals.length === 0 && (
                  <p className="text-[11px] text-white/25 text-center py-3">No goals set</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </div>
    )
  }

  // ── Full Mode ───────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/10 overflow-hidden',
        'bg-black/80 backdrop-blur-xl',
        className,
      )}
    >
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-gradient-to-r from-blue-900/15 via-purple-900/10 to-yellow-900/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.06),transparent_50%)]" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.35)]">
                <Target className="w-5 h-5 text-white" />
              </div>
              {totalGoals > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[9px] font-black text-white shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                >
                  {totalGoals}
                </motion.div>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Stream Goals</h3>
              <p className="text-[11px] text-white/40">
                {activeGoals.length} active &middot; {totalCompleted} completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Overall progress ring */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3"
                />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${overallPercent * 0.942} 100`}
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${overallPercent * 0.942} 100` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-black text-white">{overallPercent}%</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
              <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goals list */}
      <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="w-10 h-10 text-white/15 mb-3" />
            <p className="text-sm text-white/40 font-semibold">No goals set</p>
            <p className="text-xs text-white/20 mt-1">Goals will appear when the streamer sets them</p>
          </div>
        ) : (
          <>
            {/* Active goals */}
            {activeGoals.length > 0 && (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {activeGoals.map((goal, idx) => (
                    <GoalCard key={goal.id} goal={goal} index={idx} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Completed goals */}
            {completedGoals.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-bold text-green-300">Completed</span>
                  <span className="text-[10px] font-semibold text-green-400/50 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                    {completedGoals.length}
                  </span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {completedGoals.map((goal, idx) => (
                      <GoalCard key={goal.id} goal={goal} index={idx} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer glow */}
      <div className="h-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-yellow-500/20" />
    </div>
  )
}
