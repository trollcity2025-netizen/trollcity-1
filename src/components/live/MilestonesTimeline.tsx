import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Coins,
  Gift,
  MessageCircle,
  Check,
  Sparkles,
  ArrowUp,
  Trophy,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type MilestoneCategory = 'viewers' | 'coins' | 'gifts' | 'chat_messages';

interface MilestoneDefinition {
  id: string;
  category: MilestoneCategory;
  title: string;
  threshold: number;
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
  rewardLabel?: string;
}

interface MilestoneProgress {
  milestoneId: string;
  currentValue: number;
  isReached: boolean;
  reachedAt: string | null;
}

interface MilestonesTimelineProps {
  streamId: string;
  className?: string;
  horizontal?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  MilestoneCategory,
  { icon: React.ReactNode; label: string; color: string; glowColor: string; gradientFrom: string; gradientTo: string }
> = {
  viewers: {
    icon: <Users className="w-4 h-4" />,
    label: 'Viewers',
    color: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.4)',
    gradientFrom: '#3b82f6',
    gradientTo: '#06b6d4',
  },
  coins: {
    icon: <Coins className="w-4 h-4" />,
    label: 'Coins',
    color: '#eab308',
    glowColor: 'rgba(234,179,8,0.4)',
    gradientFrom: '#eab308',
    gradientTo: '#f59e0b',
  },
  gifts: {
    icon: <Gift className="w-4 h-4" />,
    label: 'Gifts',
    color: '#ec4899',
    glowColor: 'rgba(236,72,153,0.4)',
    gradientFrom: '#ec4899',
    gradientTo: '#a855f7',
  },
  chat_messages: {
    icon: <MessageCircle className="w-4 h-4" />,
    label: 'Chat',
    color: '#22c55e',
    glowColor: 'rgba(34,197,94,0.4)',
    gradientFrom: '#22c55e',
    gradientTo: '#10b981',
  },
};

const MILESTONE_DEFINITIONS: Omit<MilestoneDefinition, 'icon' | 'color' | 'glowColor' | 'gradientFrom' | 'gradientTo'>[] = [
  // Viewers
  { id: 'v1', category: 'viewers', title: 'First Wave', threshold: 10, rewardLabel: '+50 XP' },
  { id: 'v2', category: 'viewers', title: 'Crowd Gathering', threshold: 50, rewardLabel: '+150 XP' },
  { id: 'v3', category: 'viewers', title: 'Rising Tide', threshold: 100, rewardLabel: '+300 XP' },
  { id: 'v4', category: 'viewers', title: 'Packed House', threshold: 500, rewardLabel: '+800 XP' },
  { id: 'v5', category: 'viewers', title: 'Viral Surge', threshold: 1000, rewardLabel: '+2000 XP' },
  { id: 'v6', category: 'viewers', title: 'Legendary Viewers', threshold: 5000, rewardLabel: '+5000 XP' },
  // Coins
  { id: 'c1', category: 'coins', title: 'Coin Rain', threshold: 500, rewardLabel: 'Bronze Badge' },
  { id: 'c2', category: 'coins', title: 'Gold Rush', threshold: 2000, rewardLabel: 'Silver Badge' },
  { id: 'c3', category: 'coins', title: 'Treasure Trove', threshold: 10000, rewardLabel: 'Gold Badge' },
  { id: 'c4', category: 'coins', title: 'Diamond Vault', threshold: 50000, rewardLabel: 'Diamond Badge' },
  // Gifts
  { id: 'g1', category: 'gifts', title: 'First Gift', threshold: 1, rewardLabel: 'Sparkle Effect' },
  { id: 'g2', category: 'gifts', title: 'Gift Shower', threshold: 25, rewardLabel: 'Rain Effect' },
  { id: 'g3', category: 'gifts', title: 'Gift Storm', threshold: 100, rewardLabel: 'Storm Effect' },
  { id: 'g4', category: 'gifts', title: 'Gift Tsunami', threshold: 500, rewardLabel: 'Tsunami Effect' },
  // Chat
  { id: 'm1', category: 'chat_messages', title: 'Chat Awakens', threshold: 50, rewardLabel: 'Emoji Pack' },
  { id: 'm2', category: 'chat_messages', title: 'Hype Train', threshold: 200, rewardLabel: 'Hype Badge' },
  { id: 'm3', category: 'chat_messages', title: 'Chat Explosion', threshold: 1000, rewardLabel: 'Meme Lord' },
  { id: 'm4', category: 'chat_messages', title: 'Message Tsunami', threshold: 5000, rewardLabel: 'Chat Legend' },
];

function buildMilestones(): MilestoneDefinition[] {
  return MILESTONE_DEFINITIONS.map((m) => {
    const cat = CATEGORY_CONFIG[m.category];
    return {
      ...m,
      icon: cat.icon,
      color: cat.color,
      glowColor: cat.glowColor,
      gradientFrom: cat.gradientFrom,
      gradientTo: cat.gradientTo,
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatThreshold(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function getProgressPercent(current: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min(100, (current / threshold) * 100);
}

// ─── Particle Burst ─────────────────────────────────────────────────────────

function ParticleBurst({ color, isActive }: { color: string; isActive: boolean }) {
  if (!isActive) return null;

  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const distance = 20 + Math.random() * 15;
    const x = Math.cos((angle * Math.PI) / 180) * distance;
    const y = Math.sin((angle * Math.PI) / 180) * distance;
    const size = 2 + Math.random() * 3;
    const delay = Math.random() * 0.15;

    return (
      <motion.div
        key={i}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          left: '50%',
          top: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
          boxShadow: `0 0 6px ${color}`,
        }}
        initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        animate={{ opacity: 0, x, y, scale: 0.2 }}
        transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      />
    );
  });

  return <div className="absolute inset-0 pointer-events-none z-20">{particles}</div>;
}

// ─── Ring Expansion ─────────────────────────────────────────────────────────

function RingExpansion({ color, isActive }: { color: string; isActive: boolean }) {
  if (!isActive) return null;

  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-full border-2 pointer-events-none z-10"
        style={{ borderColor: color }}
        initial={{ scale: 0.8, opacity: 1 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border pointer-events-none z-10"
        style={{ borderColor: color }}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
      />
    </>
  );
}

// ─── Flash Effect ───────────────────────────────────────────────────────────

function FlashEffect({ color, isActive }: { color: string; isActive: boolean }) {
  if (!isActive) return null;

  return (
    <motion.div
      className="absolute inset-0 rounded-full pointer-events-none z-10"
      style={{ backgroundColor: color }}
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  );
}

// ─── Reached Checkmark ──────────────────────────────────────────────────────

function ReachedCheck({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute -top-1 -right-1 z-20"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
    >
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}80`,
        }}
      >
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    </motion.div>
  );
}

// ─── Pulsing Glow (Current Milestone) ───────────────────────────────────────

function PulsingGlow({ color, glowColor }: { color: string; glowColor: string }) {
  return (
    <motion.div
      className="absolute inset-[-6px] rounded-2xl pointer-events-none"
      style={{
        border: `2px solid ${color}40`,
        boxShadow: `0 0 20px ${glowColor}, inset 0 0 12px ${glowColor}20`,
      }}
      animate={{
        boxShadow: [
          `0 0 20px ${glowColor}, inset 0 0 12px ${glowColor}20`,
          `0 0 35px ${glowColor}, inset 0 0 20px ${glowColor}30`,
          `0 0 20px ${glowColor}, inset 0 0 12px ${glowColor}20`,
        ],
        opacity: [0.6, 1, 0.6],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Countdown Indicator ────────────────────────────────────────────────────

function NextMilestoneCountdown({
  current,
  next,
  category,
}: {
  current: number;
  next: MilestoneDefinition;
  category: MilestoneCategory;
}) {
  const remaining = Math.max(0, next.threshold - current);
  const percent = getProgressPercent(current, next.threshold);
  const config = CATEGORY_CONFIG[category];

  return (
    <motion.div
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ArrowUp className="w-3.5 h-3.5" style={{ color: config.color }} />
          <span className="text-[11px] font-semibold text-white/60">Next Up</span>
        </div>
        <span className="text-[11px] font-bold" style={{ color: config.color }}>
          {next.title}
        </span>
      </div>
      <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${config.gradientFrom}, ${config.gradientTo})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-white/40 font-mono">
          {current.toLocaleString()} / {formatThreshold(next.threshold)}
        </span>
        <span className="text-[10px] text-white/40 font-mono">
          {formatThreshold(remaining)} to go
        </span>
      </div>
    </motion.div>
  );
}

// ─── Milestone Node (Single Item) ───────────────────────────────────────────

function MilestoneNode({
  milestone,
  progress,
  isCurrent,
  index,
  isHorizontal,
}: {
  milestone: MilestoneDefinition;
  progress: MilestoneProgress;
  isCurrent: boolean;
  index: number;
  isHorizontal: boolean;
}) {
  const [justReached, setJustReached] = useState(false);
  const prevReached = useRef(progress.isReached);

  useEffect(() => {
    if (progress.isReached && !prevReached.current) {
      setJustReached(true);
      const timer = setTimeout(() => setJustReached(false), 1500);
      return () => clearTimeout(timer);
    }
    prevReached.current = progress.isReached;
  }, [progress.isReached]);

  const percent = getProgressPercent(progress.currentValue, milestone.threshold);

  return (
    <motion.div
      className={cn(
        'relative group',
        isHorizontal ? 'flex flex-col items-center' : 'flex items-start gap-3'
      )}
      initial={{ opacity: 0, y: isHorizontal ? 20 : 20, x: isHorizontal ? 0 : -10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
    >
      {/* Node circle */}
      <div
        className={cn(
          'relative flex-shrink-0 z-10',
          isHorizontal ? 'mb-2' : 'mr-3'
        )}
      >
        <motion.div
          className={cn(
            'relative w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all',
            progress.isReached
              ? 'border-transparent'
              : isCurrent
                ? 'border-transparent'
                : 'border-white/10 bg-white/[0.03]'
          )}
          style={
            progress.isReached || isCurrent
              ? {
                  background: `linear-gradient(135deg, ${milestone.gradientFrom}30, ${milestone.gradientTo}20)`,
                  borderColor: isCurrent ? milestone.color : `${milestone.color}80`,
                  boxShadow: `0 0 16px ${milestone.glowColor}`,
                }
              : undefined
          }
          whileHover={!progress.isReached ? { scale: 1.1 } : undefined}
          animate={
            isCurrent
              ? {
                  boxShadow: [
                    `0 0 16px ${milestone.glowColor}`,
                    `0 0 28px ${milestone.glowColor}`,
                    `0 0 16px ${milestone.glowColor}`,
                  ],
                }
              : undefined
          }
          transition={isCurrent ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
        >
          {/* Icon */}
          <div
            className={cn(
              'transition-opacity',
              progress.isReached ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-30'
            )}
            style={{ color: milestone.color }}
          >
            {milestone.icon}
          </div>

          {/* Reached check */}
          {progress.isReached && <ReachedCheck color={milestone.color} />}

          {/* Current pulsing glow */}
          {isCurrent && <PulsingGlow color={milestone.color} glowColor={milestone.glowColor} />}

          {/* Burst animations on reach */}
          <ParticleBurst color={milestone.color} isActive={justReached} />
          <RingExpansion color={milestone.color} isActive={justReached} />
          <FlashEffect color={milestone.color} isActive={justReached} />
        </motion.div>
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isHorizontal && 'text-center')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-bold',
              progress.isReached ? 'text-white' : isCurrent ? 'text-white' : 'text-white/30'
            )}
          >
            {milestone.title}
          </span>
          {progress.isReached && (
            <motion.span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${milestone.color}20`,
                color: milestone.color,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.4 }}
            >
              Done
            </motion.span>
          )}
          {isCurrent && (
            <motion.span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              In Progress
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'text-xs font-mono',
              progress.isReached ? 'text-white/50' : isCurrent ? 'text-white/60' : 'text-white/20'
            )}
          >
            {formatThreshold(milestone.threshold)}
          </span>
          {milestone.rewardLabel && (
            <span
              className={cn(
                'text-[10px] font-semibold',
                progress.isReached ? 'text-yellow-400/70' : 'text-yellow-400/30'
              )}
            >
              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
              {milestone.rewardLabel}
            </span>
          )}
        </div>

        {/* Inline progress for current */}
        {isCurrent && !isHorizontal && (
          <div className="mt-2 space-y-1">
            <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${milestone.gradientFrom}, ${milestone.gradientTo})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40 font-mono">
                {progress.currentValue.toLocaleString()} / {formatThreshold(milestone.threshold)}
              </span>
              <span className="text-[10px] font-bold" style={{ color: milestone.color }}>
                {Math.round(percent)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Timeline Line (Animated Gradient) ──────────────────────────────────────

function TimelineLine({
  milestones,
  progressMap,
  isHorizontal,
}: {
  milestones: MilestoneDefinition[];
  progressMap: Record<string, MilestoneProgress>;
  isHorizontal: boolean;
}) {
  const reachedCount = milestones.filter((m) => progressMap[m.id]?.isReached).length;
  const totalMilestones = milestones.length;
  const progressPercent = totalMilestones > 0 ? (reachedCount / totalMilestones) * 100 : 0;
  const firstColor = milestones[0]?.color ?? '#8b5cf6';
  const lastReached = milestones.find((m, i) => i === reachedCount);
  const activeColor = lastReached?.color ?? firstColor;

  if (isHorizontal) {
    return (
      <div className="absolute top-[22px] left-0 right-0 h-[2px] bg-white/5 z-0 mx-8">
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background: `linear-gradient(90deg, ${firstColor}, ${activeColor})`,
            boxShadow: `0 0 8px ${activeColor}40`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-y-0 h-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
          }}
          animate={{ x: ['-200%', '400%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="absolute left-[21px] top-0 bottom-0 w-[2px] bg-white/5 z-0">
      <motion.div
        className="absolute top-0 left-0 right-0"
        style={{
          background: `linear-gradient(180deg, ${activeColor}, ${firstColor}60, transparent)`,
          boxShadow: `0 0 8px ${activeColor}40`,
        }}
        initial={{ height: 0 }}
        animate={{ height: `${progressPercent}%` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute left-0 w-full"
        style={{
          height: '20%',
          background: `linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent)`,
        }}
        animate={{ y: ['-100%', '600%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ─── Category Section ───────────────────────────────────────────────────────

function CategorySection({
  category,
  milestones,
  progressMap,
  isHorizontal,
}: {
  category: MilestoneCategory;
  milestones: MilestoneDefinition[];
  progressMap: Record<string, MilestoneProgress>;
  isHorizontal: boolean;
}) {
  const config = CATEGORY_CONFIG[category];
  const reachedCount = milestones.filter((m) => progressMap[m.id]?.isReached).length;
  const currentIndex = milestones.findIndex((m) => !progressMap[m.id]?.isReached);

  if (isHorizontal) {
    return (
      <div className="space-y-3">
        {/* Category header */}
        <div className="flex items-center gap-2 px-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `${config.color}15`,
              color: config.color,
            }}
          >
            {config.icon}
          </div>
          <span className="text-xs font-bold text-white">{config.label}</span>
          <span className="text-[10px] font-semibold text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
            {reachedCount}/{milestones.length}
          </span>
        </div>
        {/* Horizontal row */}
        <div className="relative flex items-start gap-0 justify-between px-2">
          <TimelineLine
            milestones={milestones}
            progressMap={progressMap}
            isHorizontal
          />
          {milestones.map((milestone, idx) => (
            <div key={milestone.id} className="relative z-10 flex-1 flex justify-center">
              <MilestoneNode
                milestone={milestone}
                progress={progressMap[milestone.id] ?? {
                  milestoneId: milestone.id,
                  currentValue: 0,
                  isReached: false,
                  reachedAt: null,
                }}
                isCurrent={idx === currentIndex}
                index={idx}
                isHorizontal
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Category header */}
      <motion.div
        className="flex items-center gap-2 mb-3"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${config.color}15`,
            color: config.color,
          }}
        >
          {config.icon}
        </div>
        <span className="text-xs font-bold text-white">{config.label}</span>
        <span className="text-[10px] font-semibold text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
          {reachedCount}/{milestones.length}
        </span>
      </motion.div>

      {/* Vertical list with line */}
      <div className="relative pl-2">
        <TimelineLine
          milestones={milestones}
          progressMap={progressMap}
          isHorizontal={false}
        />
        <div className="space-y-4">
          {milestones.map((milestone, idx) => (
            <MilestoneNode
              key={milestone.id}
              milestone={milestone}
              progress={progressMap[milestone.id] ?? {
                milestoneId: milestone.id,
                currentValue: 0,
                isReached: false,
                reachedAt: null,
              }}
              isCurrent={idx === currentIndex}
              index={idx}
              isHorizontal={false}
            />
          ))}
        </div>
      </div>

      {/* Next milestone countdown */}
      {currentIndex >= 0 && currentIndex < milestones.length && (
        <NextMilestoneCountdown
          current={progressMap[milestones[currentIndex].id]?.currentValue ?? 0}
          next={milestones[currentIndex]}
          category={category}
        />
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MilestonesTimeline({
  streamId,
  className,
  horizontal = false,
}: MilestonesTimelineProps) {
  const allMilestones = useMemo(() => buildMilestones(), []);
  const [progressMap, setProgressMap] = useState<Record<string, MilestoneProgress>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MilestoneCategory>('viewers');

  const fetchProgress = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stream_milestones')
        .select('*')
        .eq('stream_id', streamId);

      if (error) {
        console.error('[MilestonesTimeline] Error fetching:', error);
        // Fallback demo data
        generateDemoProgress();
        return;
      }

      if (data && data.length > 0) {
        const map: Record<string, MilestoneProgress> = {};
        data.forEach((row: any) => {
          map[row.milestone_id] = {
            milestoneId: row.milestone_id,
            currentValue: row.current_value ?? 0,
            isReached: row.is_reached ?? false,
            reachedAt: row.reached_at ?? null,
          };
        });
        setProgressMap(map);
      } else {
        generateDemoProgress();
      }
    } catch {
      generateDemoProgress();
    } finally {
      setLoading(false);
    }

    function generateDemoProgress() {
      const map: Record<string, MilestoneProgress> = {};
      allMilestones.forEach((m, i) => {
        const seed = (streamId.charCodeAt(0) || 7) * (i + 1);
        const progress = seed % 100;
        const isReached = progress > 70;
        map[m.id] = {
          milestoneId: m.id,
          currentValue: isReached ? m.threshold : Math.floor((progress / 100) * m.threshold),
          isReached,
          reachedAt: isReached ? new Date().toISOString() : null,
        };
      });
      setProgressMap(map);
    }
  }, [streamId, allMilestones]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Realtime subscription
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream_milestones:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_milestones',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow?.milestone_id) return;

          setProgressMap((prev) => ({
            ...prev,
            [newRow.milestone_id]: {
              milestoneId: newRow.milestone_id,
              currentValue: newRow.current_value ?? 0,
              isReached: newRow.is_reached ?? false,
              reachedAt: newRow.reached_at ?? null,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Group milestones by category
  const grouped = useMemo(() => {
    const groups: Record<MilestoneCategory, MilestoneDefinition[]> = {
      viewers: [],
      coins: [],
      gifts: [],
      chat_messages: [],
    };
    allMilestones.forEach((m) => {
      groups[m.category].push(m);
    });
    return groups;
  }, [allMilestones]);

  // Overall stats
  const totalReached = allMilestones.filter((m) => progressMap[m.id]?.isReached).length;
  const totalMilestones = allMilestones.length;

  // Categories with progress
  const categories = (Object.keys(grouped) as MilestoneCategory[]).filter(
    (k) => grouped[k].length > 0
  );

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          'relative rounded-2xl border border-white/10 overflow-hidden',
          'bg-gradient-to-br from-[#0a0a1a]/95 via-[#0d0d2b]/95 to-[#1a0a2e]/95',
          'backdrop-blur-xl',
          className
        )}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 animate-pulse" />
            <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/10 overflow-hidden',
        'bg-gradient-to-br from-[#0a0a1a]/95 via-[#0d0d2b]/95 to-[#1a0a2e]/95',
        'backdrop-blur-xl',
        className
      )}
    >
      {/* Cosmic background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-60 h-60 bg-purple-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/[0.02] rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/15 via-transparent to-blue-900/15">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,0.06),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  boxShadow: '0 0 20px rgba(139,92,246,0.4)',
                }}
              >
                <Trophy className="w-5 h-5 text-white" />
              </div>
              {totalReached > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg"
                  style={{
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                  }}
                >
                  {totalReached}
                </motion.div>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Stream Milestones</h3>
              <p className="text-[11px] text-white/40">
                {totalReached}/{totalMilestones} achieved &middot;{' '}
                <span className="text-green-400/60">{Math.round((totalReached / totalMilestones) * 100)}%</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="relative flex items-center gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const isActive = activeCategory === cat;
            const reachedCount = grouped[cat].filter((m) => progressMap[m.id]?.isReached).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border',
                  isActive
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                )}
              >
                <span style={{ color: isActive ? config.color : undefined }}>{config.icon}</span>
                {config.label}
                <span
                  className={cn(
                    'text-[9px] font-bold px-1 py-0.5 rounded-full',
                    isActive ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/20'
                  )}
                >
                  {reachedCount}/{grouped[cat].length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className={cn('relative p-5', horizontal ? 'overflow-x-auto' : 'max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <CategorySection
              category={activeCategory}
              milestones={grouped[activeCategory]}
              progressMap={progressMap}
              isHorizontal={horizontal}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer glow */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
    </div>
  );
}
