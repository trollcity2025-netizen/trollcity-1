import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Crown, Trophy, Gem, ChevronUp, ChevronDown, Minus, Sparkles, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FanTierType, ViewerRole } from '../../types/liveStreaming';
import DiamondAvatar from './DiamondAvatar';
import { cn } from '../../lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopFansLeaderboardProps {
  streamId: string;
  className?: string;
  compact?: boolean;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface FanEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: FanTierType;
  level: number;
  coinsGifted: number;
  role: ViewerRole;
  contractActive: boolean;
  prevRank: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<FanTierType, { color: string; bgColor: string; borderColor: string; icon: string; label: string }> = {
  icon:    { color: '#FFD700', bgColor: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.25)', icon: '👑', label: 'Icon' },
  legend:  { color: '#A855F7', bgColor: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)', icon: '⚡', label: 'Legend' },
  superfan:{ color: '#EC4899', bgColor: 'rgba(236,72,153,0.08)', borderColor: 'rgba(236,72,153,0.25)', icon: '💖', label: 'Superfan' },
  fan:     { color: '#3B82F6', bgColor: 'rgba(59,130,246,0.08)',  borderColor: 'rgba(59,130,246,0.25)',  icon: '⭐', label: 'Fan' },
  supporter:{ color: '#22C55E', bgColor: 'rgba(34,197,94,0.08)',  borderColor: 'rgba(34,197,94,0.25)',  icon: '🛡️', label: 'Supporter' },
  viewer:  { color: '#9CA3AF', bgColor: 'rgba(156,163,175,0.08)', borderColor: 'rgba(156,163,175,0.25)', icon: '👤', label: 'Viewer' },
};

const RANK_MEDAL_COLORS: Record<number, { color: string; glow: string; gradient: string; label: string }> = {
  1: {
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.5)',
    gradient: 'from-yellow-500/20 via-amber-400/10 to-transparent',
    label: 'GOLD',
  },
  2: {
    color: '#C0C0C0',
    glow: 'rgba(192,192,192,0.4)',
    gradient: 'from-gray-300/20 via-gray-400/10 to-transparent',
    label: 'SILVER',
  },
  3: {
    color: '#CD7F32',
    glow: 'rgba(205,127,50,0.4)',
    gradient: 'from-amber-700/20 via-orange-600/10 to-transparent',
    label: 'BRONZE',
  },
};

const FAN_TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
  legendary: '#FF6B35',
};

function getContributorTier(coins: number): { name: string; color: string } {
  if (coins >= 500000) return { name: 'Legendary', color: FAN_TIER_COLORS.legendary };
  if (coins >= 100000) return { name: 'Diamond', color: FAN_TIER_COLORS.diamond };
  if (coins >= 50000)  return { name: 'Platinum', color: FAN_TIER_COLORS.platinum };
  if (coins >= 10000)  return { name: 'Gold', color: FAN_TIER_COLORS.gold };
  if (coins >= 5000)   return { name: 'Silver', color: FAN_TIER_COLORS.silver };
  return { name: 'Bronze', color: FAN_TIER_COLORS.bronze };
}

// ─── Crown animation for #1 ──────────────────────────────────────────────────

function CrownAnimation() {
  return (
    <motion.div
      className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      animate={{
        y: [0, -4, 0],
        rotate: [0, 3, -3, 0],
        filter: [
          'drop-shadow(0 0 6px rgba(255,215,0,0.6))',
          'drop-shadow(0 0 12px rgba(255,215,0,0.9))',
          'drop-shadow(0 0 6px rgba(255,215,0,0.6))',
        ],
      }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Crown className="w-5 h-5 text-yellow-400" fill="#FFD700" />
    </motion.div>
  );
}

// ─── Rank change indicator ────────────────────────────────────────────────────

function RankChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0 || current === previous) {
    return <Minus className="w-3 h-3 text-zinc-600" />;
  }
  if (current < previous) {
    return <ChevronUp className="w-3 h-3 text-emerald-400" />;
  }
  return <ChevronDown className="w-3 h-3 text-red-400" />;
}

// ─── Progress bar to next rank ────────────────────────────────────────────────

function RankProgressBar({ currentCoins, nextCoins, tierColor }: { currentCoins: number; nextCoins: number | null; tierColor: string }) {
  if (!nextCoins || nextCoins <= currentCoins) return null;

  const progress = Math.min((currentCoins / nextCoins) * 100, 100);
  const gap = nextCoins - currentCoins;

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-zinc-500">to next rank</span>
        <span className="text-[9px] font-medium" style={{ color: tierColor }}>
          {gap.toLocaleString()} coins
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-zinc-800/80 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: tierColor }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Single fan row ───────────────────────────────────────────────────────────

function FanRow({
  entry,
  rank,
  nextCoins,
  isCompact,
  index,
}: {
  entry: FanEntry;
  rank: number;
  nextCoins: number | null;
  isCompact: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const medal = RANK_MEDAL_COLORS[rank];
  const tierCfg = TIER_CONFIG[entry.tier];
  const contributorTier = getContributorTier(entry.coinsGifted);
  const isTopThree = rank <= 3;
  const isNumberOne = rank === 1;

  return (
    <motion.div
      layout
      layoutId={`fan-${entry.userId}`}
      initial={{ opacity: 0, x: -60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 30 },
        opacity: { duration: 0.3, delay: index * 0.06 },
        x: { type: 'spring', stiffness: 200, damping: 22, delay: index * 0.06 },
        scale: { type: 'spring', stiffness: 300, damping: 25, delay: index * 0.06 },
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative rounded-xl border transition-all duration-200 cursor-default group',
        isCompact ? 'p-2' : 'p-3',
        isTopThree
          ? `bg-gradient-to-r ${medal?.gradient}`
          : 'bg-zinc-900/40',
        isTopThree
          ? 'border-zinc-700/60'
          : 'border-zinc-800/60',
      )}
      style={{
        boxShadow: hovered && isTopThree
          ? `0 0 20px ${medal?.glow}, 0 0 40px ${medal?.glow}`
          : hovered
            ? '0 0 12px rgba(255,255,255,0.06)'
            : 'none',
      }}
      whileHover={{ scale: 1.015 }}
    >
      {/* Top 3 glow border overlay */}
      {isTopThree && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: `1px solid ${medal?.color}30`,
            boxShadow: `inset 0 0 20px ${medal?.glow}`,
          }}
          animate={{
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className={cn('relative flex items-center gap-3', isCompact && 'gap-2')}>
        {/* Rank number */}
        <div className="flex flex-col items-center w-8 shrink-0">
          {isTopThree ? (
            <motion.div
              className="relative flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm"
              style={{
                color: medal?.color,
                textShadow: `0 0 8px ${medal?.glow}`,
              }}
              animate={
                isNumberOne
                  ? { scale: [1, 1.08, 1] }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {rank === 1 && <Trophy className="w-4 h-4" style={{ color: medal?.color }} />}
              {rank === 2 && <span className="text-base">2</span>}
              {rank === 3 && <span className="text-base">3</span>}
            </motion.div>
          ) : (
            <span className="text-sm font-bold text-zinc-500">{rank}</span>
          )}
          <div className="mt-0.5">
            <RankChangeIndicator current={rank} previous={entry.prevRank} />
          </div>
        </div>

        {/* Diamond avatar */}
        <div className="relative shrink-0">
          {isNumberOne && <CrownAnimation />}
          <DiamondAvatar
            level={entry.level}
            avatarUrl={entry.avatarUrl || ''}
            username={entry.username}
            size="sm"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-semibold truncate',
                isCompact ? 'text-xs' : 'text-sm',
                isTopThree ? 'text-white' : 'text-zinc-200',
              )}
              style={
                isTopThree
                  ? { textShadow: `0 0 6px ${medal?.glow}` }
                  : undefined
              }
            >
              {entry.username}
            </span>
            {entry.contractActive && (
              <span className="text-[8px] text-purple-400">💎</span>
            )}
          </div>

          {/* Tier badge + contributor badge */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{
                color: tierCfg.color,
                backgroundColor: tierCfg.bgColor,
                borderColor: tierCfg.borderColor,
              }}
            >
              {tierCfg.icon} {tierCfg.label}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                color: contributorTier.color,
                backgroundColor: `${contributorTier.color}15`,
                border: `1px solid ${contributorTier.color}30`,
              }}
            >
              {contributorTier.name}
            </span>
          </div>

          {/* Progress bar to next rank */}
          {!isCompact && (
            <RankProgressBar
              currentCoins={entry.coinsGifted}
              nextCoins={nextCoins}
              tierColor={contributorTier.color}
            />
          )}
        </div>

        {/* Coins */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span
              className={cn(
                'font-bold tabular-nums',
                isCompact ? 'text-xs' : 'text-sm',
                isTopThree ? 'text-yellow-300' : 'text-yellow-400',
              )}
              style={
                isTopThree
                  ? { textShadow: `0 0 6px rgba(255,215,0,0.4)` }
                  : undefined
              }
            >
              {entry.coinsGifted.toLocaleString()}
            </span>
          </div>
          <div className="text-[9px] text-zinc-500 mt-0.5">spent</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TopFansLeaderboard({
  streamId,
  className,
  compact = false,
}: TopFansLeaderboardProps) {
  const [fans, setFans] = useState<FanEntry[]>([]);
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('stream_fan_tiers')
      .select('user_id, tier, total_coins_gifted, role, contract_active')
      .eq('stream_id', streamId)
      .order('total_coins_gifted', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    const userIds = data.map((d: any) => d.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, level')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => {
      profileMap[p.id] = p;
    });

    setPrevRanks((prev) => {
      const next: Record<string, number> = {};
      data.forEach((d: any, i: number) => {
        next[d.user_id] = prev[d.user_id] ?? (i + 1);
      });
      return next;
    });

    const entries: FanEntry[] = data.map((d: any, i: number) => ({
      userId: d.user_id,
      username: profileMap[d.user_id]?.username || 'Unknown',
      avatarUrl: profileMap[d.user_id]?.avatar_url || null,
      tier: d.tier as FanTierType,
      level: profileMap[d.user_id]?.level || 1,
      coinsGifted: d.total_coins_gifted || 0,
      role: d.role as ViewerRole,
      contractActive: d.contract_active || false,
      prevRank: prevRanks[d.user_id] ?? (i + 1),
    }));

    setFans(entries);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const totalCoins = useMemo(
    () => fans.reduce((sum, f) => sum + f.coinsGifted, 0),
    [fans],
  );

  const avgCoins = useMemo(
    () => (fans.length > 0 ? Math.round(totalCoins / fans.length) : 0),
    [totalCoins, fans.length],
  );

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden border border-zinc-800/60',
        className,
      )}
    >
      {/* Aurora glass background */}
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xl" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(139,92,246,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 20%, rgba(59,130,246,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 70% 30% at 50% 90%, rgba(236,72,153,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 10% 80%, rgba(34,197,94,0.1) 0%, transparent 50%)
          `,
        }}
      />

      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, transparent 50%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative">
        {/* Header */}
        <div className={cn('flex items-center justify-between', compact ? 'px-3 pt-3 pb-2' : 'px-4 pt-4 pb-3')}>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Trophy className="w-5 h-5 text-yellow-400" />
            </motion.div>
            <h3 className={cn('font-bold text-white', compact ? 'text-sm' : 'text-base')}>
              Top Fans
            </h3>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
            Live
          </span>
        </div>

        {/* Leaderboard list */}
        <div className={cn('space-y-1.5', compact ? 'px-3 pb-2' : 'px-4 pb-3')}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Gem className="w-6 h-6 text-zinc-600" />
              </motion.div>
              <span className="text-xs text-zinc-600">Loading leaderboard...</span>
            </div>
          ) : fans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Trophy className="w-8 h-8 text-zinc-700" />
              <span className="text-xs text-zinc-600">No fans yet — be the first!</span>
            </div>
          ) : (
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                {fans.map((entry, i) => (
                  <FanRow
                    key={entry.userId}
                    entry={entry}
                    rank={i + 1}
                    nextCoins={i < fans.length - 1 ? fans[i + 1].coinsGifted : null}
                    isCompact={compact}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </LayoutGroup>
          )}
        </div>

        {/* Total summary footer */}
        {fans.length > 0 && (
          <div
            className={cn(
              'border-t border-zinc-800/60',
              compact ? 'px-3 py-2.5' : 'px-4 py-3',
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                  Total Contributions
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500">
                    {totalCoins.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                  Avg / Fan
                </div>
                <div className="text-sm font-bold text-zinc-300 mt-0.5 tabular-nums">
                  {avgCoins.toLocaleString()}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                  Top {fans.length}
                </div>
                <div className="flex items-center gap-0.5 mt-1 justify-end">
                  {fans.slice(0, 5).map((f, i) => (
                    <div
                      key={f.userId}
                      className="w-5 h-5 rounded-full border overflow-hidden -ml-1 first:ml-0"
                      style={{
                        borderColor: TIER_CONFIG[f.tier].color,
                        zIndex: 5 - i,
                      }}
                    >
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-700" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
