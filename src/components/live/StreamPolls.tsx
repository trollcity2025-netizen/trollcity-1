import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import {
  BarChart3,
  Users,
  Crown,
  Sparkles,
  Check,
  Trophy,
  ChevronDown,
  Vote,
  Timer,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PollOption {
  id: string
  text: string
  votes: number
}

interface StreamPoll {
  id: string
  stream_id: string
  question: string
  options: PollOption[]
  total_votes: number
  is_active: boolean
  is_completed: boolean
  expires_at: string | null
  created_at: string
  completed_at: string | null
  winner_option_id: string | null
}

interface PollVote {
  poll_id: string
  user_id: string
  option_id: string
  created_at: string
}

interface StreamPollsProps {
  streamId: string
  className?: string
  compact?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const OPTION_COLORS = [
  { gradient: 'from-violet-500 to-purple-600', glow: 'shadow-[0_0_20px_rgba(139,92,246,0.5)]', bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30', hex: '#8b5cf6' },
  { gradient: 'from-cyan-500 to-blue-600', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', hex: '#06b6d4' },
  { gradient: 'from-emerald-500 to-green-600', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', hex: '#10b981' },
  { gradient: 'from-amber-500 to-orange-600', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', hex: '#f59e0b' },
  { gradient: 'from-rose-500 to-pink-600', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]', bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30', hex: '#f43f5e' },
  { gradient: 'from-sky-500 to-indigo-600', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.5)]', bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30', hex: '#0ea5e9' },
]

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

function getPercentage(votes: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((votes / total) * 100)
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

// ─── Animated Number Hook ───────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration: number = 0.6) {
  const [display, setDisplay] = useState(target)
  const motionValue = useMotionValue(target)

  useEffect(() => {
    const controls = animate(motionValue, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [target, duration, motionValue])

  return display
}

// ─── Particle Burst Component ──────────────────────────────────────────────

function ParticleBurst({ active, color }: { active: boolean; color: string }) {
  if (!active) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360
        const rad = (angle * Math.PI) / 180
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: '50%',
              top: '50%',
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(rad) * 80,
              y: Math.sin(rad) * 80,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.02 }}
          />
        )
      })}
    </div>
  )
}

// ─── Crown Winner Effect ────────────────────────────────────────────────────

function WinnerCrown({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
          className="absolute -top-4 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Crown className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Sparkle Effect ─────────────────────────────────────────────────────────

function SparkleEffect({ show, color }: { show: boolean; color: string }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: `${15 + Math.random() * 70}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1.2, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.2,
                delay: 0.3 + i * 0.15,
                repeat: 2,
                repeatDelay: 0.8,
              }}
            >
              <Sparkles className="w-3 h-3" style={{ color }} />
            </motion.div>
          ))}
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Poll Timer ─────────────────────────────────────────────────────────────

function PollTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const remaining = useCountdown(expiresAt)
  const isUrgent = remaining < 30000 && remaining > 0
  const isExpired = remaining <= 0

  useEffect(() => {
    if (isExpired && onExpire) onExpire()
  }, [isExpired, onExpire])

  return (
    <motion.div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold border',
        isExpired
          ? 'bg-red-500/20 text-red-400 border-red-500/30'
          : isUrgent
            ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
            : 'bg-white/5 text-white/80 border-white/10',
      )}
      animate={isUrgent && !isExpired ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <Timer className="w-3.5 h-3.5" />
      {isExpired ? 'ENDED' : formatCountdown(remaining)}
    </motion.div>
  )
}

// ─── Animated Percentage Text ───────────────────────────────────────────────

function AnimatedPercent({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, 0.5)
  return <span>{animated}%</span>
}

// ─── Animated Vote Count ────────────────────────────────────────────────────

function AnimatedVoteCount({ votes }: { votes: number }) {
  const animated = useAnimatedNumber(votes, 0.4)
  return <span>{animated.toLocaleString()}</span>
}

// ─── Vote Option Bar ────────────────────────────────────────────────────────

function VoteOptionBar({
  option,
  index,
  totalVotes,
  isWinner,
  showResults,
  colorIndex,
  onVote,
  hasVoted,
  isUserChoice,
  compact,
}: {
  option: PollOption
  index: number
  totalVotes: number
  isWinner: boolean
  showResults: boolean
  colorIndex: number
  onVote: () => void
  hasVoted: boolean
  isUserChoice: boolean
  compact: boolean
}) {
  const color = OPTION_COLORS[colorIndex % OPTION_COLORS.length]
  const percent = getPercentage(option.votes, totalVotes)
  const [showBurst, setShowBurst] = useState(false)

  useEffect(() => {
    if (isWinner && showResults) {
      setShowBurst(true)
      const t = setTimeout(() => setShowBurst(false), 2000)
      return () => clearTimeout(t)
    }
  }, [isWinner, showResults])

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative"
    >
      <WinnerCrown show={isWinner && showResults} />
      <SparkleEffect show={isWinner && showResults} color={color.hex} />

      <button
        onClick={onVote}
        disabled={hasVoted || !showResults === false}
        className={cn(
          'relative w-full rounded-xl border overflow-hidden transition-all duration-300 group',
          compact ? 'p-3' : 'p-4',
          hasVoted
            ? `${color.bg} ${color.border} cursor-default`
            : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06] cursor-pointer',
          isWinner && showResults && color.glow,
        )}
      >
        {/* Background progress bar */}
        {showResults && (
          <motion.div
            className={cn('absolute inset-y-0 left-0 bg-gradient-to-r opacity-20', color.gradient)}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        )}

        {/* Shimmer effect on winner */}
        {isWinner && showResults && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Particle burst on winner */}
        <ParticleBurst active={showBurst} color={color.hex} />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Option letter indicator */}
            <div
              className={cn(
                'flex-shrink-0 rounded-lg flex items-center justify-center font-black text-white',
                compact ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm',
                `bg-gradient-to-br ${color.gradient}`,
                'shadow-lg',
              )}
            >
              {String.fromCharCode(65 + index)}
            </div>

            <div className="min-w-0 flex-1">
              <p className={cn(
                'font-semibold truncate',
                compact ? 'text-xs' : 'text-sm',
                isUserChoice ? color.text : 'text-white',
              )}>
                {option.text}
              </p>
              {showResults && !compact && (
                <p className="text-[11px] text-white/40 mt-0.5">
                  <AnimatedVoteCount votes={option.votes} /> vote{option.votes !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isUserChoice && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                  color.bg, color.text, color.border, 'border',
                )}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
                Voted
              </motion.div>
            )}

            {isWinner && showResults && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.5 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
              >
                <Trophy className="w-3 h-3" />
                Winner
              </motion.div>
            )}

            {showResults && (
              <span className={cn(
                'font-black tabular-nums',
                compact ? 'text-base' : 'text-lg',
                isWinner ? color.text : 'text-white/80',
              )}>
                <AnimatedPercent value={percent} />
              </span>
            )}
          </div>
        </div>

        {/* Vote button haptic feedback ring */}
        {!hasVoted && (
          <motion.div
            className={cn(
              'absolute inset-0 rounded-xl border-2 opacity-0 pointer-events-none',
              color.border,
            )}
            whileHover={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </button>
    </motion.div>
  )
}

// ─── Total Votes Counter ────────────────────────────────────────────────────

function TotalVotesCounter({ total, compact }: { total: number; compact: boolean }) {
  const animated = useAnimatedNumber(total, 0.5)

  return (
    <motion.div
      className={cn(
        'flex items-center gap-2 rounded-lg border',
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
        'bg-white/[0.03] border-white/10',
      )}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="relative">
        <Users className={cn('text-purple-400', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <span className={cn('font-bold tabular-nums text-white', compact ? 'text-xs' : 'text-sm')}>
        {animated.toLocaleString()}
      </span>
      <span className={cn('text-white/40', compact ? 'text-[10px]' : 'text-xs')}>votes</span>
    </motion.div>
  )
}

// ─── Poll Card ──────────────────────────────────────────────────────────────

function PollCard({
  poll,
  userVote,
  onVote,
  compact,
}: {
  poll: StreamPoll
  userVote: string | null
  onVote: (optionId: string) => void
  compact: boolean
}) {
  const showResults = poll.is_completed || userVote !== null
  const sortedOptions = useMemo(() => {
    if (!showResults) return poll.options
    return [...poll.options].sort((a, b) => b.votes - a.votes)
  }, [poll.options, showResults])

  const _leadingOption = sortedOptions[0]
  const isPollExpired = poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="relative"
    >
      {/* Glow border for active poll */}
      {poll.is_active && !poll.is_completed && (
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-purple-500/30 via-cyan-500/30 to-purple-500/30 blur-sm" />
      )}

      <div className={cn(
        'relative rounded-2xl border overflow-hidden',
        poll.is_completed
          ? 'bg-green-950/20 border-green-500/20'
          : 'bg-white/[0.03] border-white/10',
      )}>
        {/* Completed overlay */}
        <AnimatePresence>
          {poll.is_completed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-green-500/5 pointer-events-none z-10"
            />
          )}
        </AnimatePresence>

        <div className={cn('relative', compact ? 'p-4' : 'p-5')}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={cn(
                'flex-shrink-0 rounded-xl flex items-center justify-center',
                compact ? 'w-8 h-8' : 'w-10 h-10',
                poll.is_completed
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-[0_0_16px_rgba(34,197,94,0.4)]'
                  : 'bg-gradient-to-br from-purple-500 to-blue-600 shadow-[0_0_16px_rgba(147,51,234,0.4)]',
              )}>
                {poll.is_completed ? (
                  <Trophy className={cn('text-white', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                ) : (
                  <Vote className={cn('text-white', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-semibold uppercase tracking-wider',
                    compact ? 'text-[9px]' : 'text-[10px]',
                    poll.is_completed ? 'text-green-400' : 'text-purple-400',
                  )}>
                    {poll.is_completed ? 'Poll Results' : 'Active Poll'}
                  </span>
                  {poll.is_active && !poll.is_completed && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[9px] text-green-400 font-semibold">LIVE</span>
                    </div>
                  )}
                </div>
                <h3 className={cn(
                  'font-bold text-white mt-0.5',
                  compact ? 'text-sm' : 'text-base',
                )}>
                  {poll.question}
                </h3>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {poll.expires_at && !poll.is_completed && (
                <PollTimer expiresAt={poll.expires_at} />
              )}
              {poll.is_completed && poll.completed_at && (
                <span className="text-[10px] text-green-400/60 font-semibold">
                  Completed
                </span>
              )}
            </div>
          </div>

          {/* Options */}
          <div className={cn('space-y-2.5', compact && 'space-y-2')}>
            {sortedOptions.map((option, idx) => (
              <VoteOptionBar
                key={option.id}
                option={option}
                index={idx}
                totalVotes={poll.total_votes}
                isWinner={poll.is_completed && poll.winner_option_id === option.id}
                showResults={showResults}
                colorIndex={idx}
                onVote={() => onVote(option.id)}
                hasVoted={userVote !== null}
                isUserChoice={userVote === option.id}
                compact={compact}
              />
            ))}
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-between',
            compact ? 'mt-3' : 'mt-4',
          )}>
            <TotalVotesCounter total={poll.total_votes} compact={compact} />

            {!showResults && !isPollExpired && (
              <motion.p
                className={cn(
                  'text-white/30 italic',
                  compact ? 'text-[10px]' : 'text-xs',
                )}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Cast your vote to see results
              </motion.p>
            )}
          </div>
        </div>

        {/* Bottom gradient line */}
        <div className={cn(
          'h-px',
          poll.is_completed
            ? 'bg-gradient-to-r from-transparent via-green-500/30 to-transparent'
            : 'bg-gradient-to-r from-transparent via-purple-500/30 to-transparent',
        )} />
      </div>
    </motion.div>
  )
}

// ─── Results Reveal Overlay ─────────────────────────────────────────────────

function ResultsReveal({
  show,
  poll,
  onDone,
}: {
  show: boolean
  poll: StreamPoll | null
  onDone: () => void
}) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onDone, 3000)
      return () => clearTimeout(t)
    }
  }, [show, onDone])

  if (!show || !poll) return null

  const winner = poll.options.find((o) => o.id === poll.winner_option_id)
  if (!winner) return null

  const percent = getPercentage(winner.votes, poll.total_votes)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <Crown className="w-12 h-12 text-yellow-400 mx-auto drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
        </motion.div>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-black text-white mt-3"
        >
          {winner.text}
        </motion.p>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-black text-yellow-400 mt-1"
        >
          {percent}%
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-white/40 mt-2"
        >
          {winner.votes.toLocaleString()} vote{winner.votes !== 1 ? 's' : ''}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StreamPolls({ streamId, className, compact = false }: StreamPollsProps) {
  const [polls, setPolls] = useState<StreamPoll[]>([])
  const [userVotes, setUserVotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [revealPollId, setRevealPollId] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id || null
    })
  }, [])

  // Fetch polls
  const fetchPolls = useCallback(async () => {
    const { data, error } = await supabase
      .from('stream_polls')
      .select('*')
      .eq('stream_id', streamId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('[StreamPolls] Error fetching polls:', error)
      return
    }

    setPolls((data || []) as StreamPoll[])
    setLoading(false)
  }, [streamId])

  // Fetch user votes
  const fetchUserVotes = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return

    const { data } = await supabase
      .from('poll_votes')
      .select('poll_id, option_id')
      .eq('user_id', userId)

    if (data) {
      const votes: Record<string, string> = {}
      data.forEach((v: any) => {
        votes[v.poll_id] = v.option_id
      })
      setUserVotes(votes)
    }
  }, [])

  useEffect(() => {
    fetchPolls()
    fetchUserVotes()
  }, [fetchPolls, fetchUserVotes])

  // Realtime subscriptions
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream_polls:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_polls',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const eventType = payload.eventType
          const newRow = payload.new as StreamPoll | null
          const oldRow = payload.old as StreamPoll | null

          setPolls((prev) => {
            if (eventType === 'INSERT' && newRow) {
              if (prev.some((p) => p.id === newRow.id)) return prev
              return [newRow, ...prev]
            }

            if (eventType === 'UPDATE' && newRow) {
              // Check if poll just completed
              const oldPoll = prev.find((p) => p.id === newRow.id)
              if (oldPoll && !oldPoll.is_completed && newRow.is_completed) {
                setRevealPollId(newRow.id)
              }
              return prev.map((p) => (p.id === newRow.id ? newRow : p))
            }

            if (eventType === 'DELETE' && oldRow) {
              return prev.filter((p) => p.id !== oldRow.id)
            }

            return prev
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
        },
        async (payload) => {
          const eventType = payload.eventType
          const newRow = payload.new as PollVote | null

          // Track user's own votes
          if (eventType === 'INSERT' && newRow && newRow.user_id === userIdRef.current) {
            setUserVotes((prev) => ({ ...prev, [newRow.poll_id]: newRow.option_id }))
          }

          // Refresh poll data when votes change to get updated counts
          if (eventType === 'INSERT') {
            const { data } = await supabase
              .from('stream_polls')
              .select('*')
              .eq('stream_id', streamId)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(5)

            if (data) {
              setPolls(data as StreamPoll[])
            }
          }
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [streamId])

  // Handle vote
  const handleVote = useCallback(async (pollId: string, optionId: string) => {
    const userId = userIdRef.current
    if (!userId) return

    // Optimistic update
    setUserVotes((prev) => ({ ...prev, [pollId]: optionId }))
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p
        return {
          ...p,
          options: p.options.map((o) =>
            o.id === optionId ? { ...o, votes: o.votes + 1 } : o,
          ),
          total_votes: p.total_votes + 1,
        }
      }),
    )

    const { error } = await supabase.from('poll_votes').insert({
      poll_id: pollId,
      user_id: userId,
      option_id: optionId,
    })

    if (error) {
      console.error('[StreamPolls] Error voting:', error)
      // Revert optimistic update
      setUserVotes((prev) => {
        const next = { ...prev }
        delete next[pollId]
        return next
      })
      fetchPolls()
    }
  }, [fetchPolls])

  // Handle reveal done
  const handleRevealDone = useCallback(() => {
    setRevealPollId(null)
  }, [])

  // Active polls (not completed)
  const activePolls = polls.filter((p) => !p.is_completed)
  const completedPolls = polls.filter((p) => p.is_completed)

  if (loading) {
    return (
      <div className={cn(
        'bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10',
        compact ? 'p-4' : 'p-6',
        className,
      )}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 animate-pulse" />
          <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden',
      className,
    )}>
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-transparent to-cyan-900/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.08),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              {activePolls.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                >
                  {activePolls.length}
                </motion.div>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Stream Polls</h3>
              <p className="text-[11px] text-white/40">
                {activePolls.length} active &middot; {completedPolls.length} completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activePolls.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-white/40" />
              </motion.div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'space-y-4',
              compact ? 'p-3' : 'p-5',
              'max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
            )}>
              {polls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Vote className="w-10 h-10 text-white/20 mb-3" />
                  <p className="text-sm text-white/40 font-semibold">No active polls</p>
                  <p className="text-xs text-white/20 mt-1">
                    Polls will appear here when the broadcaster starts them
                  </p>
                </div>
              ) : (
                <>
                  {/* Active Polls */}
                  {activePolls.length > 0 && (
                    <div className="space-y-4">
                      {activePolls.map((poll) => (
                        <div key={poll.id} className="relative">
                          <PollCard
                            poll={poll}
                            userVote={userVotes[poll.id] || null}
                            onVote={(optionId) => handleVote(poll.id, optionId)}
                            compact={compact}
                          />
                          <ResultsReveal
                            show={revealPollId === poll.id}
                            poll={poll}
                            onDone={handleRevealDone}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed Polls */}
                  {completedPolls.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pt-2">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                          Completed
                        </span>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <AnimatePresence>
                        {completedPolls.map((poll) => (
                          <PollCard
                            key={poll.id}
                            poll={poll}
                            userVote={userVotes[poll.id] || null}
                            onVote={() => {}}
                            compact={compact}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer glow */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
    </div>
  )
}
