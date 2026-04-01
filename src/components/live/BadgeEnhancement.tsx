import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Star, Crown, Shield, Zap, ChevronRight, Lock, TrendingUp, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BadgeTierProgress, BadgePerk } from '../../types/liveStreaming';
import { cn } from '../../lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BadgeEnhancementProps {
  userId: string;
  compact?: boolean;
}

// ─── Local types ──────────────────────────────────────────────────────────────

type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
type BadgeCategory = 'all' | 'social' | 'gifting' | 'streaming' | 'engagement' | 'special';
type SortMode = 'rarity' | 'tier' | 'recent';
type PerkType = 'chat_priority' | 'visual_highlight' | 'special_permissions' | 'coin_boost' | 'xp_boost';

interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  icon_name: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  tier_thresholds: number[];
  perks: BadgePerk[];
}

interface UserBadge extends BadgeDefinition {
  current_tier: number;
  progress_value: number;
  is_locked: boolean;
  earned_at: string | null;
  is_showcased: boolean;
  showcase_position: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<BadgeRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
  mythic: '#ff3366',
};

const RARITY_GLOW: Record<BadgeRarity, string> = {
  common: 'rgba(156,163,175,0.15)',
  uncommon: 'rgba(34,197,94,0.2)',
  rare: 'rgba(59,130,246,0.25)',
  epic: 'rgba(168,85,247,0.3)',
  legendary: 'rgba(234,179,8,0.35)',
  mythic: 'rgba(255,51,102,0.4)',
};

const RARITY_BG: Record<BadgeRarity, string> = {
  common: 'from-gray-500/10 to-gray-600/5',
  uncommon: 'from-green-500/10 to-green-600/5',
  rare: 'from-blue-500/10 to-blue-600/5',
  epic: 'from-purple-500/10 to-purple-600/5',
  legendary: 'from-yellow-500/10 to-yellow-600/5',
  mythic: 'from-pink-500/10 to-pink-600/5',
};

const RARITY_ORDER: Record<BadgeRarity, number> = {
  mythic: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
};

const TIER_LABELS = ['I', 'II', 'III', 'IV', 'V'];

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  all: 'All',
  social: 'Social',
  gifting: 'Gifting',
  streaming: 'Streaming',
  engagement: 'Engagement',
  special: 'Special',
};

const PERK_CONFIG: Record<PerkType, { icon: React.ReactNode; label: string; color: string }> = {
  chat_priority: { icon: <ChevronRight className="w-3 h-3" />, label: 'Chat Priority', color: 'text-cyan-400 bg-cyan-500/20' },
  visual_highlight: { icon: <Sparkles className="w-3 h-3" />, label: 'Visual Highlight', color: 'text-yellow-400 bg-yellow-500/20' },
  special_permissions: { icon: <Shield className="w-3 h-3" />, label: 'Special Access', color: 'text-purple-400 bg-purple-500/20' },
  coin_boost: { icon: <TrendingUp className="w-3 h-3" />, label: 'Coin Boost', color: 'text-green-400 bg-green-500/20' },
  xp_boost: { icon: <Zap className="w-3 h-3" />, label: 'XP Boost', color: 'text-orange-400 bg-orange-500/20' },
};

const BADGE_ICONS: Record<string, React.ReactNode> = {
  gift_master: <Gift className="w-5 h-5" />,
  chat_champion: <Star className="w-5 h-5" />,
  loyal_viewer: <Shield className="w-5 h-5" />,
  hype_beast: <Zap className="w-5 h-5" />,
  crown_collector: <Crown className="w-5 h-5" />,
  stream_starter: <Award className="w-5 h-5" />,
  social_butterfly: <Sparkles className="w-5 h-5" />,
  top_supporter: <TrendingUp className="w-5 h-5" />,
};

// Gift icon since lucide-react Gift is used above
function Gift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

// ─── Demo badge definitions ──────────────────────────────────────────────────

const DEMO_BADGES: BadgeDefinition[] = [
  { slug: 'gift_master', name: 'Gift Master', description: 'Send gifts to streamers', icon_name: 'gift_master', category: 'gifting', rarity: 'legendary', tier_thresholds: [50, 200, 500, 1000, 2500], perks: [{ type: 'coin_boost', value: 10, tier_required: 1 }, { type: 'visual_highlight', value: true, tier_required: 3 }, { type: 'coin_boost', value: 25, tier_required: 5 }] },
  { slug: 'chat_champion', name: 'Chat Champion', description: 'Send chat messages in streams', icon_name: 'chat_champion', category: 'engagement', rarity: 'epic', tier_thresholds: [100, 500, 1500, 3000, 5000], perks: [{ type: 'chat_priority', value: true, tier_required: 2 }, { type: 'xp_boost', value: 5, tier_required: 3 }] },
  { slug: 'loyal_viewer', name: 'Loyal Viewer', description: 'Watch streams consistently', icon_name: 'loyal_viewer', category: 'streaming', rarity: 'rare', tier_thresholds: [10, 50, 100, 250, 500], perks: [{ type: 'xp_boost', value: 5, tier_required: 1 }, { type: 'special_permissions', value: 'early_access', tier_required: 4 }] },
  { slug: 'hype_beast', name: 'Hype Beast', description: 'Boost stream energy', icon_name: 'hype_beast', category: 'engagement', rarity: 'uncommon', tier_thresholds: [25, 100, 300, 600, 1000], perks: [{ type: 'chat_priority', value: true, tier_required: 3 }] },
  { slug: 'crown_collector', name: 'Crown Collector', description: 'Earn awards from streamers', icon_name: 'crown_collector', category: 'special', rarity: 'mythic', tier_thresholds: [1, 5, 15, 30, 50], perks: [{ type: 'visual_highlight', value: true, tier_required: 1 }, { type: 'special_permissions', value: 'vip_lounge', tier_required: 3 }, { type: 'coin_boost', value: 50, tier_required: 5 }] },
  { slug: 'stream_starter', name: 'Stream Starter', description: 'Start your own broadcasts', icon_name: 'stream_starter', category: 'streaming', rarity: 'common', tier_thresholds: [1, 10, 25, 50, 100], perks: [{ type: 'xp_boost', value: 3, tier_required: 1 }] },
  { slug: 'social_butterfly', name: 'Social Butterfly', description: 'Follow and interact with users', icon_name: 'social_butterfly', category: 'social', rarity: 'uncommon', tier_thresholds: [5, 20, 50, 100, 200], perks: [{ type: 'xp_boost', value: 2, tier_required: 1 }, { type: 'visual_highlight', value: true, tier_required: 4 }] },
  { slug: 'top_supporter', name: 'Top Supporter', description: 'Support creators with coins', icon_name: 'top_supporter', category: 'gifting', rarity: 'legendary', tier_thresholds: [500, 2000, 5000, 10000, 25000], perks: [{ type: 'coin_boost', value: 15, tier_required: 1 }, { type: 'special_permissions', value: 'supporter_badge', tier_required: 2 }, { type: 'visual_highlight', value: true, tier_required: 4 }] },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function getBadgeIcon(iconName: string) {
  return BADGE_ICONS[iconName] || <Award className="w-5 h-5" />;
}

function getProgressPercent(progress: number, thresholds: number[], tier: number): number {
  if (tier >= 5) return 100;
  const currentThreshold = tier > 0 ? thresholds[tier - 1] : 0;
  const nextThreshold = thresholds[tier];
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 100;
  return Math.min(100, ((progress - currentThreshold) / range) * 100);
}

function getNextTierThreshold(thresholds: number[], tier: number): number | null {
  if (tier >= 5) return null;
  return thresholds[tier];
}

// ─── Badge Card ───────────────────────────────────────────────────────────────

function BadgeCard({ badge, onToggleShowcase, isCompact }: {
  badge: UserBadge;
  onToggleShowcase: (slug: string) => void;
  isCompact: boolean;
}) {
  const rarityColor = RARITY_COLORS[badge.rarity];
  const progressPercent = getProgressPercent(badge.progress_value, badge.tier_thresholds, badge.current_tier);
  const nextThreshold = getNextTierThreshold(badge.tier_thresholds, badge.current_tier);
  const activePerks = badge.perks.filter(p => p.tier_required <= badge.current_tier);
  const lockedPerks = badge.perks.filter(p => p.tier_required > badge.current_tier);

  if (isCompact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: badge.is_locked ? 0.4 : 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => !badge.is_locked && onToggleShowcase(badge.slug)}
        className={cn(
          'relative rounded-xl p-3 border-2 cursor-pointer transition-all',
          badge.is_locked ? 'border-zinc-700/50 bg-zinc-800/30' : 'bg-gradient-to-br',
          RARITY_BG[badge.rarity]
        )}
        style={{ borderColor: badge.is_locked ? undefined : rarityColor }}
      >
        {badge.is_locked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 z-10">
            <Lock className="w-5 h-5 text-zinc-500" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${rarityColor}20`, color: rarityColor }}
          >
            {getBadgeIcon(badge.icon_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{badge.name}</div>
            {badge.current_tier > 0 && (
              <div className="text-[10px] font-bold" style={{ color: rarityColor }}>
                Tier {TIER_LABELS[badge.current_tier - 1]}
              </div>
            )}
          </div>
          {badge.is_showcased && (
            <Check className="w-3 h-3 text-green-400 shrink-0" />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: badge.is_locked ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={badge.is_locked ? {} : { scale: 1.02, boxShadow: `0 0 20px ${RARITY_GLOW[badge.rarity]}` }}
      onClick={() => !badge.is_locked && onToggleShowcase(badge.slug)}
      className={cn(
        'relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all',
        badge.is_locked ? 'border-zinc-700/50 bg-zinc-800/30' : 'bg-gradient-to-br',
        RARITY_BG[badge.rarity]
      )}
      style={{ borderColor: badge.is_locked ? undefined : rarityColor }}
    >
      {/* Locked overlay */}
      {badge.is_locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/50 z-10">
          <Lock className="w-8 h-8 text-zinc-500 mb-1" />
          <span className="text-xs text-zinc-500">Locked</span>
        </div>
      )}

      {/* Showcased indicator */}
      {badge.is_showcased && (
        <div className="absolute top-2 right-2 z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center"
          >
            <Check className="w-3 h-3 text-green-400" />
          </motion.div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header: Icon + Name + Tier */}
        <div className="flex items-start gap-3">
          <motion.div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
              badge.current_tier >= 4 && 'animate-pulse'
            )}
            style={{
              backgroundColor: `${rarityColor}20`,
              color: rarityColor,
              boxShadow: badge.current_tier >= 3 ? `0 0 12px ${RARITY_GLOW[badge.rarity]}` : undefined,
            }}
            animate={badge.current_tier >= 5 ? {
              boxShadow: [`0 0 12px ${RARITY_GLOW[badge.rarity]}`, `0 0 24px ${RARITY_GLOW[badge.rarity]}`, `0 0 12px ${RARITY_GLOW[badge.rarity]}`],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {getBadgeIcon(badge.icon_name)}
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">{badge.name}</span>
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${rarityColor}25`, color: rarityColor }}
              >
                {badge.rarity}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{badge.description}</p>

            {/* Tier indicators */}
            <div className="flex items-center gap-1 mt-1.5">
              {TIER_LABELS.map((label, idx) => (
                <div
                  key={label}
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold border transition-all',
                    idx < badge.current_tier
                      ? 'border-transparent text-white'
                      : 'border-zinc-700/50 text-zinc-600 bg-zinc-800/50'
                  )}
                  style={idx < badge.current_tier ? { backgroundColor: `${rarityColor}40`, borderColor: rarityColor, color: rarityColor } : undefined}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar to next tier */}
        {nextThreshold !== null && !badge.is_locked && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">
                Tier {TIER_LABELS[badge.current_tier]}: {badge.progress_value.toLocaleString()}/{nextThreshold.toLocaleString()}
              </span>
              <span className="font-semibold" style={{ color: rarityColor }}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden relative">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{ backgroundColor: rarityColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
              </motion.div>
            </div>
          </div>
        )}

        {badge.current_tier >= 5 && !badge.is_locked && (
          <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: rarityColor }}>
            <Crown className="w-3 h-3" />
            MAX TIER
          </div>
        )}

        {/* Perks */}
        {!badge.is_locked && badge.perks.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-700/30">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Perks</div>
            <div className="flex flex-wrap gap-1.5">
              {badge.perks.map((perk, idx) => {
                const isActive = perk.tier_required <= badge.current_tier;
                const perkConfig = PERK_CONFIG[perk.type as PerkType];
                if (!perkConfig) return null;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                      isActive ? perkConfig.color : 'text-zinc-600 bg-zinc-800/50 border-zinc-700/30'
                    )}
                  >
                    {perkConfig.icon}
                    <span>{perkConfig.label}</span>
                    {typeof perk.value === 'number' && isActive && (
                      <span className="font-bold">+{perk.value}%</span>
                    )}
                    {!isActive && (
                      <Lock className="w-2.5 h-2.5" />
                    )}
                    <span className="text-[8px] opacity-60">T{perk.tier_required}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Badge Showcase Slot ──────────────────────────────────────────────────────

function ShowcaseSlot({ badge, index, onRemove }: {
  badge: UserBadge | null;
  index: number;
  onRemove: (slug: string) => void;
}) {
  return (
    <motion.div
      layout
      className={cn(
        'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all',
        badge
          ? 'border-solid bg-gradient-to-br'
          : 'border-zinc-700/50 bg-zinc-800/20'
      )}
      style={badge ? { borderColor: RARITY_COLORS[badge.rarity], backgroundColor: `${RARITY_COLORS[badge.rarity]}10` } : undefined}
    >
      {badge ? (
        <div className="flex flex-col items-center gap-1 p-2 text-center w-full">
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${RARITY_COLORS[badge.rarity]}25`, color: RARITY_COLORS[badge.rarity] }}
            whileHover={{ scale: 1.1 }}
          >
            {getBadgeIcon(badge.icon_name)}
          </motion.div>
          <span className="text-[9px] font-semibold text-white truncate w-full">{badge.name}</span>
          <span className="text-[8px] font-bold" style={{ color: RARITY_COLORS[badge.rarity] }}>
            {TIER_LABELS[badge.current_tier - 1]}
          </span>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onRemove(badge.slug); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/80 border border-red-400 flex items-center justify-center text-white text-[10px] font-bold"
          >
            x
          </motion.button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-700/30 flex items-center justify-center">
            <Award className="w-4 h-4 text-zinc-600" />
          </div>
          <span className="text-[9px] text-zinc-600">Slot {index + 1}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BadgeEnhancement({ userId, compact = false }: BadgeEnhancementProps) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BadgeCategory>('all');
  const [sortMode, setSortMode] = useState<SortMode>('rarity');
  const [showShowcase, setShowShowcase] = useState(false);
  const showcaseSlots = useRef<(string | null)[]>([null, null, null, null, null, null]);

  // ── Fetch user badge progress ──
  const fetchBadges = useCallback(async () => {
    setLoading(true);
    try {
      const { data: progressData } = await supabase
        .from('badge_tier_progress')
        .select('*')
        .eq('user_id', userId);

      const progressMap: Record<string, BadgeTierProgress> = {};
      (progressData || []).forEach((p: any) => {
        progressMap[p.badge_slug] = p;
      });

      const { data: showcaseData } = await supabase
        .from('user_badge_showcase')
        .select('badge_slug, position')
        .eq('user_id', userId)
        .order('position', { ascending: true });

      const showcaseMap: Record<string, number> = {};
      const slots: (string | null)[] = [null, null, null, null, null, null];
      (showcaseData || []).forEach((s: any) => {
        showcaseMap[s.badge_slug] = s.position;
        if (s.position >= 0 && s.position < 6) {
          slots[s.position] = s.badge_slug;
        }
      });
      showcaseSlots.current = slots;

      const merged: UserBadge[] = DEMO_BADGES.map(def => {
        const progress = progressMap[def.slug];
        return {
          ...def,
          current_tier: progress?.current_tier ?? 0,
          progress_value: progress?.progress_value ?? 0,
          is_locked: !progress,
          earned_at: progress ? new Date().toISOString() : null,
          is_showcased: def.slug in showcaseMap,
          showcase_position: showcaseMap[def.slug] ?? null,
        };
      });

      setBadges(merged);
    } catch {
      // Fallback to demo data with simulated progress
      const fallback: UserBadge[] = DEMO_BADGES.map((def, i) => ({
        ...def,
        current_tier: i < 4 ? Math.min(i + 1, 5) : 0,
        progress_value: i < 4 ? def.tier_thresholds[Math.min(i, 4)] * 0.6 : 0,
        is_locked: i >= 4,
        earned_at: i < 4 ? new Date().toISOString() : null,
        is_showcased: i < 3,
        showcase_position: i < 3 ? i : null,
      }));
      setBadges(fallback);
      const slots: (string | null)[] = [null, null, null, null, null, null];
      fallback.filter(b => b.is_showcased).forEach(b => {
        if (b.showcase_position !== null && b.showcase_position < 6) {
          slots[b.showcase_position] = b.slug;
        }
      });
      showcaseSlots.current = slots;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  // ── Toggle showcase ──
  const handleToggleShowcase = useCallback(async (slug: string) => {
    const badge = badges.find(b => b.slug === slug);
    if (!badge || badge.is_locked) return;

    setBadges(prev => prev.map(b => {
      if (b.slug !== slug) return b;
      if (b.is_showcased) {
        const pos = b.showcase_position;
        if (pos !== null && pos >= 0 && pos < 6) {
          showcaseSlots.current[pos] = null;
        }
        return { ...b, is_showcased: false, showcase_position: null };
      }
      const emptySlot = showcaseSlots.current.indexOf(null);
      if (emptySlot === -1) return b;
      showcaseSlots.current[emptySlot] = slug;
      return { ...b, is_showcased: true, showcase_position: emptySlot };
    }));

    try {
      const existing = badges.find(b => b.slug === slug);
      if (existing?.is_showcased) {
        await supabase
          .from('user_badge_showcase')
          .delete()
          .eq('user_id', userId)
          .eq('badge_slug', slug);
      } else {
        const emptySlot = showcaseSlots.current.indexOf(null);
        if (emptySlot !== -1) {
          await supabase
            .from('user_badge_showcase')
            .upsert({ user_id: userId, badge_slug: slug, position: emptySlot });
        }
      }
    } catch {
      // Silent fail - UI already updated optimistically
    }
  }, [badges, userId]);

  // ── Remove from showcase ──
  const handleRemoveShowcase = useCallback(async (slug: string) => {
    const badge = badges.find(b => b.slug === slug);
    if (!badge) return;

    setBadges(prev => prev.map(b => {
      if (b.slug !== slug) return b;
      const pos = b.showcase_position;
      if (pos !== null && pos >= 0 && pos < 6) {
        showcaseSlots.current[pos] = null;
      }
      return { ...b, is_showcased: false, showcase_position: null };
    }));

    try {
      await supabase
        .from('user_badge_showcase')
        .delete()
        .eq('user_id', userId)
        .eq('badge_slug', slug);
    } catch {
      // Silent fail
    }
  }, [badges, userId]);

  // ── Filter + sort ──
  const filteredBadges = badges
    .filter(b => activeCategory === 'all' || b.category === activeCategory)
    .sort((a, b) => {
      if (sortMode === 'rarity') {
        return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      }
      if (sortMode === 'tier') {
        return b.current_tier - a.current_tier;
      }
      // recent: earned first, then by rarity
      if (a.is_locked !== b.is_locked) return a.is_locked ? 1 : -1;
      return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
    });

  const showcasedBadges = badges.filter(b => b.is_showcased).sort((a, b) =>
    (a.showcase_position ?? 0) - (b.showcase_position ?? 0)
  );

  const showcaseArray: (UserBadge | null)[] = Array.from({ length: 6 }, (_, i) => {
    return showcasedBadges.find(b => b.showcase_position === i) || null;
  });

  const earnedCount = badges.filter(b => !b.is_locked).length;
  const maxTierCount = badges.filter(b => b.current_tier >= 5).length;

  // ── Render ──

  if (compact) {
    return (
      <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-bold text-white">Badges</span>
            <span className="text-[10px] text-zinc-400">{earnedCount}/{badges.length}</span>
          </div>
          {maxTierCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-yellow-400">
              <Crown className="w-3 h-3" />
              {maxTierCount} Max
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {badges.slice(0, 8).map(badge => (
            <BadgeCard
              key={badge.slug}
              badge={badge}
              onToggleShowcase={handleToggleShowcase}
              isCompact
            />
          ))}
        </div>

        {badges.length > 8 && (
          <div className="text-center text-[10px] text-zinc-500">
            +{badges.length - 8} more badges
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            <span className="text-base font-bold text-white">Badge Collection</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>{earnedCount}/{badges.length} earned</span>
            {maxTierCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Crown className="w-3 h-3" />
                {maxTierCount} maxed
              </span>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(CATEGORY_LABELS) as BadgeCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                activeCategory === cat
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Sort + Showcase toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 mr-1">Sort:</span>
            {(['rarity', 'tier', 'recent'] as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all',
                  sortMode === mode
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowShowcase(!showShowcase)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold transition-all',
              showShowcase
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-zinc-400 hover:text-zinc-300 border border-zinc-700/50'
            )}
          >
            <Sparkles className="w-3 h-3" />
            Showcase
          </button>
        </div>
      </div>

      {/* Showcase section */}
      <AnimatePresence>
        {showShowcase && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  Profile Showcase
                </div>
                <span className="text-[10px] text-zinc-500">
                  {showcasedBadges.length}/6 slots used
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {showcaseArray.map((badge, idx) => (
                  <ShowcaseSlot
                    key={idx}
                    badge={badge}
                    index={idx}
                    onRemove={handleRemoveShowcase}
                  />
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 text-center">
                Click a badge below to add it to your showcase
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Award className="w-8 h-8 text-zinc-600" />
            </motion.div>
          </div>
        ) : filteredBadges.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            <Award className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
            No badges in this category
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredBadges.map(badge => (
                <BadgeCard
                  key={badge.slug}
                  badge={badge}
                  onToggleShowcase={handleToggleShowcase}
                  isCompact={false}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
