import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import {
  CommandModuleType,
  StreamGoal,
  StreamMission,
  StreamMilestone,
  StreamPoll,
  StreamEnergyMeter,
  StreamFanTier,
  BroadcastAudioSettings,
  StreamAward,
} from '../../types/liveStreaming'
import {
  User,
  Target,
  Flag,
  Star,
  Trophy,
  BarChart3,
  Zap,
  Radio,
  Award,
  Volume2,
  ChevronDown,
  Eye,
  Users,
  MessageSquare,
  Gift,
  TrendingUp,
  Clock,
  Coins,
  Heart,
  Shield,
} from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BroadcasterCommandCenterProps {
  streamId: string
  broadcasterId: string
  className?: string
}

// ─── Module Configuration ─────────────────────────────────────────────────────

interface ModuleConfig {
  type: CommandModuleType
  label: string
  icon: React.ReactNode
  color: string
  glowColor: string
  borderColor: string
  gradientFrom: string
  gradientTo: string
  neonClass: string
  span: string
}

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    type: 'identity',
    label: 'Identity',
    icon: <User className="w-4 h-4" />,
    color: 'text-purple-400',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
    gradientFrom: 'from-purple-500/10',
    gradientTo: 'to-purple-900/10',
    neonClass: 'neon-border-purple',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'goals',
    label: 'Goals',
    icon: <Target className="w-4 h-4" />,
    color: 'text-green-400',
    glowColor: 'rgba(34, 197, 94, 0.4)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
    gradientFrom: 'from-green-500/10',
    gradientTo: 'to-green-900/10',
    neonClass: 'neon-border-cyan',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'missions',
    label: 'Missions',
    icon: <Flag className="w-4 h-4" />,
    color: 'text-blue-400',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-blue-900/10',
    neonClass: 'neon-border-cyan',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'top_fans',
    label: 'Top Fans',
    icon: <Star className="w-4 h-4" />,
    color: 'text-yellow-400',
    glowColor: 'rgba(250, 204, 21, 0.4)',
    borderColor: 'rgba(250, 204, 21, 0.5)',
    gradientFrom: 'from-yellow-500/10',
    gradientTo: 'to-yellow-900/10',
    neonClass: 'neon-border-gold',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'milestones',
    label: 'Milestones',
    icon: <Trophy className="w-4 h-4" />,
    color: 'text-orange-400',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    borderColor: 'rgba(249, 115, 22, 0.5)',
    gradientFrom: 'from-orange-500/10',
    gradientTo: 'to-orange-900/10',
    neonClass: 'neon-border-gold',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'polls',
    label: 'Polls',
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'text-pink-400',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    borderColor: 'rgba(236, 72, 153, 0.5)',
    gradientFrom: 'from-pink-500/10',
    gradientTo: 'to-pink-900/10',
    neonClass: 'neon-border-pink',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'energy_meter',
    label: 'Energy Meter',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-red-400',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    gradientFrom: 'from-red-500/10',
    gradientTo: 'to-red-900/10',
    neonClass: 'neon-border-pink',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'ticker',
    label: 'Ticker Control',
    icon: <Radio className="w-4 h-4" />,
    color: 'text-cyan-400',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    borderColor: 'rgba(6, 182, 212, 0.5)',
    gradientFrom: 'from-cyan-500/10',
    gradientTo: 'to-cyan-900/10',
    neonClass: 'neon-border-cyan',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'recognition',
    label: 'Recognition',
    icon: <Award className="w-4 h-4" />,
    color: 'text-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
    gradientFrom: 'from-amber-500/10',
    gradientTo: 'to-amber-900/10',
    neonClass: 'neon-border-gold',
    span: 'col-span-1 row-span-1',
  },
  {
    type: 'interactions',
    label: 'Audio Controls',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'text-violet-400',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    gradientFrom: 'from-violet-500/10',
    gradientTo: 'to-violet-900/10',
    neonClass: 'neon-border-purple',
    span: 'col-span-1 row-span-1',
  },
]

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StreamIdentity {
  username: string
  avatar_url: string | null
  level: number
  stream_title: string
}

interface StreamStats {
  viewer_count: number
  total_coins: number
  chat_messages: number
  peak_viewers: number
  duration_minutes: number
  gifts_sent: number
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <motion.div
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            connected ? 'bg-green-500' : 'bg-red-500',
          )}
          animate={
            connected
              ? { boxShadow: ['0 0 4px rgba(34,197,94,0.4)', '0 0 12px rgba(34,197,94,0.8)', '0 0 4px rgba(34,197,94,0.4)'] }
              : { boxShadow: ['0 0 4px rgba(239,68,68,0.4)', '0 0 12px rgba(239,68,68,0.8)', '0 0 4px rgba(239,68,68,0.4)'] }
          }
          transition={{ duration: 2, repeat: Infinity }}
        />
        {connected && (
          <motion.div
            className="absolute inset-0 rounded-full bg-green-500"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      <span className={cn('text-[10px] font-bold uppercase tracking-wider', connected ? 'text-green-400' : 'text-red-400')}>
        {connected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        enabled ? 'bg-purple-600' : 'bg-white/10',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow', enabled ? 'ml-5' : 'ml-0.5')}
      />
    </button>
  )
}

// ─── Module Card ──────────────────────────────────────────────────────────────

function ModuleCard({
  config,
  enabled,
  expanded,
  onToggle,
  onExpand,
  children,
}: {
  config: ModuleConfig
  enabled: boolean
  expanded: boolean
  onToggle: (v: boolean) => void
  onExpand: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'glass-panel rounded-xl overflow-hidden transition-all duration-300',
        expanded && config.neonClass,
        !enabled && 'opacity-50',
      )}
      style={
        expanded
          ? { boxShadow: `0 0 20px ${config.glowColor}, inset 0 0 20px ${config.glowColor.replace('0.4', '0.1')}` }
          : undefined
      }
      whileHover={{
        boxShadow: `0 0 15px ${config.glowColor.replace('0.4', '0.25')}`,
        borderColor: config.borderColor,
      }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2.5 cursor-pointer select-none',
          'bg-gradient-to-r',
          config.gradientFrom,
          config.gradientTo,
          'border-b border-white/5',
        )}
        onClick={onExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(config.color, 'flex-shrink-0')}>{config.icon}</span>
          <span className="text-xs font-bold text-white truncate">{config.label}</span>
          {enabled && (
            <motion.div
              className={cn('w-1.5 h-1.5 rounded-full', config.color.replace('text-', 'bg-'))}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch enabled={enabled} onChange={onToggle} />
          </div>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {expanded && enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Identity Module ──────────────────────────────────────────────────────────

function IdentityModule({ identity }: { identity: StreamIdentity | null }) {
  if (!identity) return <SkeletonLines lines={2} />

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        {identity.avatar_url ? (
          <img src={identity.avatar_url} alt={identity.username} className="w-10 h-10 rounded-full object-cover border-2 border-purple-500/50" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-purple-500/50">
            <User className="w-5 h-5 text-purple-400" />
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[8px] font-black px-1 rounded">
          {identity.level}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate">{identity.username}</div>
        <div className="text-[10px] text-white/40 truncate">{identity.stream_title || 'Untitled Stream'}</div>
      </div>
    </div>
  )
}

// ─── Goals Module ─────────────────────────────────────────────────────────────

function GoalsModule({ goals }: { goals: StreamGoal[] }) {
  if (goals.length === 0) return <EmptyState text="No active goals" />

  return (
    <div className="space-y-2">
      {goals.map((goal) => {
        const pct = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
        return (
          <div key={goal.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 font-medium truncate">{goal.title}</span>
              <span className="text-[10px] text-green-400 font-bold">{pct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] text-white/30">
              <span>{goal.current_value.toLocaleString()}</span>
              <span>{goal.target_value.toLocaleString()}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Missions Module ──────────────────────────────────────────────────────────

function MissionsModule({ missions }: { missions: StreamMission[] }) {
  const active = missions.filter((m) => m.status === 'active')
  const completed = missions.filter((m) => m.status === 'completed')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-blue-400 font-bold">{active.length} active</span>
        <span className="text-green-400 font-bold">{completed.length} done</span>
      </div>
      {active.slice(0, 3).map((m) => {
        const pct = m.target_value > 0 ? Math.min(100, Math.round((m.current_value / m.target_value) * 100)) : 0
        return (
          <div key={m.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 font-medium truncate">{m.name}</span>
              <span className="text-[10px] text-blue-400 font-bold">{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        )
      })}
      {active.length === 0 && <div className="text-[10px] text-white/30 text-center py-2">No active missions</div>}
    </div>
  )
}

// ─── Top Fans Module ──────────────────────────────────────────────────────────

function TopFansModule({ fans }: { fans: StreamFanTier[] }) {
  if (fans.length === 0) return <EmptyState text="No fans yet" />

  const tierColors: Record<string, string> = {
    icon: 'text-yellow-400',
    legend: 'text-purple-400',
    superfan: 'text-pink-400',
    fan: 'text-blue-400',
    supporter: 'text-green-400',
    viewer: 'text-gray-400',
  }

  return (
    <div className="space-y-1.5">
      {fans.slice(0, 5).map((fan, idx) => (
        <div key={fan.id} className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 font-bold w-4">{idx + 1}</span>
          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-white/80 font-medium truncate block">{fan.user_id.slice(0, 8)}</span>
          </div>
          <span className={cn('text-[9px] font-bold uppercase', tierColors[fan.tier] || 'text-gray-400')}>{fan.tier}</span>
          <span className="text-[10px] text-yellow-400 font-bold">{fan.total_coins_gifted.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Milestones Module ────────────────────────────────────────────────────────

function MilestonesModule({ milestones }: { milestones: StreamMilestone[] }) {
  if (milestones.length === 0) return <EmptyState text="No milestones" />

  return (
    <div className="space-y-2">
      {milestones.slice(0, 4).map((m) => (
        <div key={m.id} className="flex items-center gap-2">
          {m.is_unlocked ? (
            <Trophy className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className={cn('text-[11px] font-medium truncate block', m.is_unlocked ? 'text-orange-300' : 'text-white/40')}>
              {m.title}
            </span>
          </div>
          {m.is_unlocked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-[9px] text-orange-400 font-bold"
            >
              UNLOCKED
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Polls Module ─────────────────────────────────────────────────────────────

function PollsModule({ polls }: { polls: StreamPoll[] }) {
  const activePoll = polls.find((p) => p.is_active)

  if (!activePoll) return <EmptyState text="No active poll" />

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-white/80 font-semibold">{activePoll.question}</div>
      {activePoll.options.map((opt, idx) => {
        const pct = activePoll.total_votes > 0 ? Math.round((opt.votes / activePoll.total_votes) * 100) : 0
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/60">{opt.label}</span>
              <span className="text-[10px] text-pink-400 font-bold">{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        )
      })}
      <div className="text-[9px] text-white/25">{activePoll.total_votes} total votes</div>
    </div>
  )
}

// ─── Energy Meter Module ──────────────────────────────────────────────────────

function EnergyMeterModule({ energy }: { energy: StreamEnergyMeter | null }) {
  if (!energy) return <EmptyState text="No energy data" />

  const level = energy.energy_level
  const gradient =
    level >= 75
      ? 'from-red-500 via-orange-500 to-yellow-500'
      : level >= 50
        ? 'from-yellow-400 via-yellow-500 to-orange-500'
        : level >= 25
          ? 'from-green-400 via-lime-400 to-yellow-400'
          : 'from-green-500 to-green-400'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <motion.div
          key={level}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
        >
          {level}
        </motion.div>
        <div className="text-right">
          <div className="text-[10px] text-white/40">Multiplier</div>
          <div className="text-sm font-bold text-orange-400">x{energy.hype_multiplier.toFixed(1)}</div>
        </div>
      </div>
      <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(level, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {level >= 75 && (
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r opacity-30 blur-sm"
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[9px] text-white/30">
        <span>{energy.total_boosts} boosts</span>
        <span>Peak: {energy.peak_energy}</span>
      </div>
    </div>
  )
}

// ─── Ticker Module ────────────────────────────────────────────────────────────

function TickerModule() {
  const [tickerText, setTickerText] = useState('')
  const [tickerEnabled, setTickerEnabled] = useState(true)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-cyan-400 font-semibold">Scrolling Ticker</span>
        <ToggleSwitch enabled={tickerEnabled} onChange={setTickerEnabled} />
      </div>
      <input
        type="text"
        value={tickerText}
        onChange={(e) => setTickerText(e.target.value)}
        placeholder="Enter ticker message..."
        className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
      />
      {tickerEnabled && tickerText && (
        <div className="overflow-hidden rounded bg-white/5 border border-white/5">
          <motion.div
            className="whitespace-nowrap py-1.5 px-2 text-[10px] text-cyan-300 font-medium"
            animate={{ x: ['100%', '-100%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            {tickerText}
          </motion.div>
        </div>
      )}
    </div>
  )
}

// ─── Recognition Module ───────────────────────────────────────────────────────

function RecognitionModule({ awards }: { awards: StreamAward[] }) {
  if (awards.length === 0) return <EmptyState text="No awards yet" />

  const awardIcons: Record<string, React.ReactNode> = {
    mvp: <Trophy className="w-3.5 h-3.5" />,
    top_gifter: <Heart className="w-3.5 h-3.5" />,
    most_active: <Zap className="w-3.5 h-3.5" />,
    hype_king: <Star className="w-3.5 h-3.5" />,
    loyal_viewer: <Shield className="w-3.5 h-3.5" />,
    rising_star: <TrendingUp className="w-3.5 h-3.5" />,
  }

  const awardColors: Record<string, string> = {
    mvp: 'text-yellow-400',
    top_gifter: 'text-pink-400',
    most_active: 'text-cyan-400',
    hype_king: 'text-orange-400',
    loyal_viewer: 'text-purple-400',
    rising_star: 'text-green-400',
  }

  return (
    <div className="space-y-1.5">
      {awards.slice(0, 4).map((award) => (
        <div key={award.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5">
          <span className={cn(awardColors[award.award_type] || 'text-white/60')}>{awardIcons[award.award_type] || <Award className="w-3.5 h-3.5" />}</span>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-white/80 font-medium truncate block">{award.title}</span>
          </div>
          {award.coin_reward > 0 && (
            <span className="text-[9px] text-yellow-400 font-bold">+{award.coin_reward}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Audio Controls Module ────────────────────────────────────────────────────

function AudioControlsModule({ settings }: { settings: BroadcastAudioSettings | null }) {
  const [voiceEnabled, setVoiceEnabled] = useState(settings?.voice_enabled ?? true)
  const [customAudioEnabled, setCustomAudioEnabled] = useState(settings?.custom_audio_enabled ?? true)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {voiceEnabled ? <MessageSquare className="w-3 h-3 text-green-400" /> : <MessageSquare className="w-3 h-3 text-white/20" />}
          <span className="text-[11px] text-white/70">Voice</span>
        </div>
        <ToggleSwitch enabled={voiceEnabled} onChange={setVoiceEnabled} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {customAudioEnabled ? <Volume2 className="w-3 h-3 text-pink-400" /> : <Volume2 className="w-3 h-3 text-white/20" />}
          <span className="text-[11px] text-white/70">Custom Audio</span>
        </div>
        <ToggleSwitch enabled={customAudioEnabled} onChange={setCustomAudioEnabled} />
      </div>
      {settings && (
        <div className="flex items-center justify-between text-[9px] text-white/30 pt-1 border-t border-white/5">
          <span>Cooldown: {settings.cooldown_seconds}s</span>
          <span>Queue: {settings.max_queue_size}</span>
        </div>
      )}
    </div>
  )
}

// ─── Shared Sub Components ────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return <div className="text-[10px] text-white/25 text-center py-3">{text}</div>
}

function SkeletonLines({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
      ))}
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: StreamStats }) {
  const items = [
    { icon: <Eye className="w-3 h-3" />, label: 'Viewers', value: stats.viewer_count.toLocaleString(), color: 'text-cyan-400' },
    { icon: <Users className="w-3 h-3" />, label: 'Peak', value: stats.peak_viewers.toLocaleString(), color: 'text-blue-400' },
    { icon: <Coins className="w-3 h-3" />, label: 'Coins', value: stats.total_coins.toLocaleString(), color: 'text-yellow-400' },
    { icon: <MessageSquare className="w-3 h-3" />, label: 'Chat', value: stats.chat_messages.toLocaleString(), color: 'text-green-400' },
    { icon: <Gift className="w-3 h-3" />, label: 'Gifts', value: stats.gifts_sent.toLocaleString(), color: 'text-pink-400' },
    { icon: <Clock className="w-3 h-3" />, label: 'Duration', value: `${stats.duration_minutes}m`, color: 'text-orange-400' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-panel rounded-xl px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className={cn(item.color, 'opacity-60')}>{item.icon}</span>
            <span className="text-[10px] text-white/40">{item.label}</span>
            <span className={cn('text-xs font-bold', item.color)}>{item.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BroadcasterCommandCenter({
  streamId,
  broadcasterId,
  className,
}: BroadcasterCommandCenterProps) {
  // ── Connection state ──
  const [connected, setConnected] = useState(false)

  // ── Data state ──
  const [identity, setIdentity] = useState<StreamIdentity | null>(null)
  const [goals, setGoals] = useState<StreamGoal[]>([])
  const [missions, setMissions] = useState<StreamMission[]>([])
  const [fans, setFans] = useState<StreamFanTier[]>([])
  const [milestones, setMilestones] = useState<StreamMilestone[]>([])
  const [polls, setPolls] = useState<StreamPoll[]>([])
  const [energy, setEnergy] = useState<StreamEnergyMeter | null>(null)
  const [awards, setAwards] = useState<StreamAward[]>([])
  const [audioSettings, setAudioSettings] = useState<BroadcastAudioSettings | null>(null)
  const [stats, setStats] = useState<StreamStats>({
    viewer_count: 0,
    total_coins: 0,
    chat_messages: 0,
    peak_viewers: 0,
    duration_minutes: 0,
    gifts_sent: 0,
  })

  // ── Module state ──
  const [moduleStates, setModuleStates] = useState<Record<string, { enabled: boolean; expanded: boolean }>>(() =>
    Object.fromEntries(MODULE_CONFIGS.map((c) => [c.type, { enabled: true, expanded: true }]))
  )

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Fetch identity ──
  const fetchIdentity = useCallback(async () => {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, avatar_url, level')
      .eq('id', broadcasterId)
      .maybeSingle()

    const { data: stream } = await supabase
      .from('streams')
      .select('title')
      .eq('id', streamId)
      .maybeSingle()

    if (profile) {
      setIdentity({
        username: profile.username || 'Broadcaster',
        avatar_url: profile.avatar_url,
        level: profile.level || 1,
        stream_title: stream?.title || '',
      })
    }
  }, [broadcasterId, streamId])

  // ── Fetch goals ──
  const fetchGoals = useCallback(async () => {
    const { data } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('stream_id', streamId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (data) setGoals(data as StreamGoal[])
  }, [streamId])

  // ── Fetch missions ──
  const fetchMissions = useCallback(async () => {
    const { data } = await supabase
      .from('stream_missions')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })

    if (data) setMissions(data as StreamMission[])
  }, [streamId])

  // ── Fetch fans ──
  const fetchFans = useCallback(async () => {
    const { data } = await supabase
      .from('stream_fan_tiers')
      .select('*')
      .eq('stream_id', streamId)
      .order('total_coins_gifted', { ascending: false })
      .limit(10)

    if (data) setFans(data as StreamFanTier[])
  }, [streamId])

  // ── Fetch milestones ──
  const fetchMilestones = useCallback(async () => {
    const { data } = await supabase
      .from('stream_milestones')
      .select('*')
      .eq('stream_id', streamId)
      .order('threshold', { ascending: true })

    if (data) setMilestones(data as StreamMilestone[])
  }, [streamId])

  // ── Fetch polls ──
  const fetchPolls = useCallback(async () => {
    const { data } = await supabase
      .from('stream_polls')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: false })

    if (data) setPolls(data as StreamPoll[])
  }, [streamId])

  // ── Fetch energy ──
  const fetchEnergy = useCallback(async () => {
    const { data } = await supabase
      .from('stream_energy_meters')
      .select('*')
      .eq('stream_id', streamId)
      .maybeSingle()

    if (data) setEnergy(data as StreamEnergyMeter)
  }, [streamId])

  // ── Fetch awards ──
  const fetchAwards = useCallback(async () => {
    const { data } = await supabase
      .from('stream_awards')
      .select('*')
      .eq('stream_id', streamId)

    if (data) setAwards(data as StreamAward[])
  }, [streamId])

  // ── Fetch audio settings ──
  const fetchAudioSettings = useCallback(async () => {
    const { data } = await supabase
      .from('broadcast_audio_settings')
      .select('*')
      .eq('stream_id', streamId)
      .maybeSingle()

    if (data) setAudioSettings(data as BroadcastAudioSettings)
  }, [streamId])

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    const { data: stream } = await supabase
      .from('streams')
      .select('viewer_count, peak_viewer_count, total_coins, chat_message_count, gift_count, started_at')
      .eq('id', streamId)
      .maybeSingle()

    if (stream) {
      const durationMs = Date.now() - new Date(stream.started_at).getTime()
      setStats({
        viewer_count: stream.viewer_count || 0,
        peak_viewers: stream.peak_viewer_count || 0,
        total_coins: stream.total_coins || 0,
        chat_messages: stream.chat_message_count || 0,
        gifts_sent: stream.gift_count || 0,
        duration_minutes: Math.floor(durationMs / 60000),
      })
    }
  }, [streamId])

  // ── Initial fetch + polling ──
  useEffect(() => {
    fetchIdentity()
    fetchGoals()
    fetchMissions()
    fetchFans()
    fetchMilestones()
    fetchPolls()
    fetchEnergy()
    fetchAwards()
    fetchAudioSettings()
    fetchStats()

    const energyInterval = setInterval(fetchEnergy, 5000)
    const statsInterval = setInterval(fetchStats, 10000)
    const fansInterval = setInterval(fetchFans, 15000)
    const pollsInterval = setInterval(fetchPolls, 10000)

    return () => {
      clearInterval(energyInterval)
      clearInterval(statsInterval)
      clearInterval(fansInterval)
      clearInterval(pollsInterval)
    }
  }, [fetchIdentity, fetchGoals, fetchMissions, fetchFans, fetchMilestones, fetchPolls, fetchEnergy, fetchAwards, fetchAudioSettings, fetchStats])

  // ── Realtime subscription ──
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`command_center:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_goals', filter: `stream_id=eq.${streamId}` }, () => fetchGoals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_missions', filter: `stream_id=eq.${streamId}` }, () => fetchMissions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_fan_tiers', filter: `stream_id=eq.${streamId}` }, () => fetchFans())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_milestones', filter: `stream_id=eq.${streamId}` }, () => fetchMilestones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_polls', filter: `stream_id=eq.${streamId}` }, () => fetchPolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_energy_meters', filter: `stream_id=eq.${streamId}` }, () => fetchEnergy())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_awards', filter: `stream_id=eq.${streamId}` }, () => fetchAwards())
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [streamId, fetchGoals, fetchMissions, fetchFans, fetchMilestones, fetchPolls, fetchEnergy, fetchAwards])

  // ── Module toggle/expand handlers ──
  const toggleModule = (type: string, enabled: boolean) => {
    setModuleStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], enabled },
    }))
  }

  const expandModule = (type: string) => {
    setModuleStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], expanded: !prev[type].expanded },
    }))
  }

  // ── Module content renderer ──
  const renderModuleContent = (type: CommandModuleType) => {
    switch (type) {
      case 'identity':
        return <IdentityModule identity={identity} />
      case 'goals':
        return <GoalsModule goals={goals} />
      case 'missions':
        return <MissionsModule missions={missions} />
      case 'top_fans':
        return <TopFansModule fans={fans} />
      case 'milestones':
        return <MilestonesModule milestones={milestones} />
      case 'polls':
        return <PollsModule polls={polls} />
      case 'energy_meter':
        return <EnergyMeterModule energy={energy} />
      case 'ticker':
        return <TickerModule />
      case 'recognition':
        return <RecognitionModule awards={awards} />
      case 'interactions':
        return <AudioControlsModule settings={audioSettings} />
      default:
        return <EmptyState text="Module not available" />
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      {/* Aurora background */}
      <div className="absolute inset-0 aurora-bg opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/90 to-black/95" />

      <div className="relative z-10">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative px-5 py-4 border-b border-white/5"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-transparent to-cyan-900/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative">
                {identity?.avatar_url ? (
                  <img
                    src={identity.avatar_url}
                    alt={identity.username}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-white/10 backdrop-blur-sm text-[8px] font-black text-white px-1 rounded border border-white/10">
                  Lv.{identity?.level || 1}
                </div>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-cyan-200">
                  Command Center
                </h2>
                <p className="text-[10px] text-white/30 truncate max-w-[200px]">
                  {identity?.stream_title || 'Loading...'}
                </p>
              </div>
            </div>

            {/* Connection status */}
            <StatusDot connected={connected} />
          </div>

          {/* Animated gradient underline */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5), rgba(6,182,212,0.5), transparent)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* ── Module Grid ── */}
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {MODULE_CONFIGS.map((config) => (
                <ModuleCard
                  key={config.type}
                  config={config}
                  enabled={moduleStates[config.type]?.enabled ?? true}
                  expanded={moduleStates[config.type]?.expanded ?? true}
                  onToggle={(v) => toggleModule(config.type, v)}
                  onExpand={() => expandModule(config.type)}
                >
                  {renderModuleContent(config.type)}
                </ModuleCard>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="px-4 pb-4">
          <StatsBar stats={stats} />
        </div>

        {/* Footer glow */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
      </div>
    </div>
  )
}
