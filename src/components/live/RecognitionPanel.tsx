import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Zap, Star, Trophy, Users, Heart, Shield, Award, Sparkles, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  FanTierType,
  ViewerRole,
  AwardType,
  StreamEnergyMeter,
  StreamAward,
  FanMemory,
  FanContract,
} from '../../types/liveStreaming';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cn } from '../../lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecognitionPanelProps {
  streamId: string;
  broadcasterId: string;
  currentUserId: string | null;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface SpotlightUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  actionCount: number;
  tier: FanTierType;
}

interface TierEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: FanTierType;
  coinsGifted: number;
  role: ViewerRole;
  contractActive: boolean;
}

interface RoleHolder {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: ViewerRole;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<FanTierType, string> = {
  icon: 'text-yellow-400',
  legend: 'text-purple-400',
  superfan: 'text-pink-400',
  fan: 'text-blue-400',
  supporter: 'text-green-400',
  viewer: 'text-gray-400',
};

const TIER_BG: Record<FanTierType, string> = {
  icon: 'bg-yellow-500/20 border-yellow-500/40',
  legend: 'bg-purple-500/20 border-purple-500/40',
  superfan: 'bg-pink-500/20 border-pink-500/40',
  fan: 'bg-blue-500/20 border-blue-500/40',
  supporter: 'bg-green-500/20 border-green-500/40',
  viewer: 'bg-gray-500/20 border-gray-500/40',
};

const TIER_ORDER: FanTierType[] = ['icon', 'legend', 'superfan', 'fan', 'supporter', 'viewer'];

const TIER_ICONS: Record<FanTierType, string> = {
  icon: '👑',
  legend: '⚡',
  superfan: '💖',
  fan: '⭐',
  supporter: '🛡️',
  viewer: '👤',
};

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  hype_leader: {
    icon: <Zap className="w-4 h-4" />,
    label: 'Hype Leader',
    description: 'Keeps the energy sky-high',
    color: 'text-yellow-400 bg-yellow-500/20',
  },
  judge: {
    icon: <Shield className="w-4 h-4" />,
    label: 'Judge',
    description: 'Calls the shots on battles',
    color: 'text-blue-400 bg-blue-500/20',
  },
  co_host: {
    icon: <Crown className="w-4 h-4" />,
    label: 'Co-Host',
    description: 'Shares the spotlight',
    color: 'text-purple-400 bg-purple-500/20',
  },
  moderator: {
    icon: <Shield className="w-4 h-4" />,
    label: 'Moderator',
    description: 'Keeps the chat clean',
    color: 'text-green-400 bg-green-500/20',
  },
};

const AWARD_CONFIG: Record<AwardType, { icon: React.ReactNode; label: string; gradient: string }> = {
  mvp: { icon: <Trophy className="w-6 h-6" />, label: 'MVP', gradient: 'from-yellow-400 to-orange-500' },
  top_gifter: { icon: <Heart className="w-6 h-6" />, label: 'Top Gifter', gradient: 'from-pink-500 to-red-500' },
  most_active: { icon: <Zap className="w-6 h-6" />, label: 'Most Active', gradient: 'from-cyan-400 to-blue-500' },
  hype_king: { icon: <Crown className="w-6 h-6" />, label: 'Hype King', gradient: 'from-yellow-500 to-red-500' },
  loyal_viewer: { icon: <Star className="w-6 h-6" />, label: 'Loyal Viewer', gradient: 'from-purple-400 to-pink-500' },
  rising_star: { icon: <Sparkles className="w-6 h-6" />, label: 'Rising Star', gradient: 'from-green-400 to-teal-500' },
};

// ─── Energy gradient helper ───────────────────────────────────────────────────

function getEnergyGradient(level: number): string {
  if (level >= 100) return 'from-purple-500 via-pink-500 to-purple-600';
  if (level >= 75) return 'from-red-500 via-orange-500 to-yellow-500';
  if (level >= 50) return 'from-yellow-400 via-yellow-500 to-orange-500';
  if (level >= 25) return 'from-green-400 via-lime-400 to-yellow-400';
  return 'from-green-500 to-green-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecognitionPanel({
  streamId,
  broadcasterId,
  currentUserId,
}: RecognitionPanelProps) {
  // ── State ──
  const [spotlight, setSpotlight] = useState<SpotlightUser | null>(null);
  const [energy, setEnergy] = useState<StreamEnergyMeter | null>(null);
  const [leaderboard, setLeaderboard] = useState<TierEntry[]>([]);
  const [roleHolders, setRoleHolders] = useState<RoleHolder[]>([]);
  const [awards, setAwards] = useState<StreamAward[]>([]);
  const [fanMemory, setFanMemory] = useState<FanMemory | null>(null);
  const [contracts, setContracts] = useState<FanContract[]>([]);
  const [boosting, setBoosting] = useState(false);

  // ── Fetch spotlight ──
  const fetchSpotlight = useCallback(async () => {
    const { data } = await supabase
      .from('stream_fan_tiers')
      .select('user_id, total_coins_gifted, total_messages, watch_minutes, tier')
      .eq('stream_id', streamId)
      .order('hype_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;

    const actionCount = (data.total_messages || 0) + (data.total_coins_gifted || 0);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, avatar_url')
      .eq('id', data.user_id)
      .maybeSingle();

    setSpotlight({
      userId: data.user_id,
      username: profile?.username || 'Unknown',
      avatarUrl: profile?.avatar_url || null,
      actionCount,
      tier: data.tier as FanTierType,
    });
  }, [streamId]);

  // ── Fetch energy ──
  const fetchEnergy = useCallback(async () => {
    const { data } = await supabase
      .from('stream_energy_meters')
      .select('*')
      .eq('stream_id', streamId)
      .maybeSingle();

    if (data) {
      setEnergy(data as StreamEnergyMeter);
    }
  }, [streamId]);

  // ── Fetch leaderboard ──
  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('stream_fan_tiers')
      .select('user_id, tier, total_coins_gifted, role, contract_active')
      .eq('stream_id', streamId)
      .order('total_coins_gifted', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) return;

    const userIds = data.map((d: any) => d.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => {
      profileMap[p.id] = p;
    });

    const entries: TierEntry[] = data.map((d: any) => ({
      userId: d.user_id,
      username: profileMap[d.user_id]?.username || 'Unknown',
      avatarUrl: profileMap[d.user_id]?.avatar_url || null,
      tier: d.tier as FanTierType,
      coinsGifted: d.total_coins_gifted || 0,
      role: d.role as ViewerRole,
      contractActive: d.contract_active || false,
    }));

    entries.sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
      if (tierDiff !== 0) return tierDiff;
      return b.coinsGifted - a.coinsGifted;
    });

    setLeaderboard(entries);
  }, [streamId]);

  // ── Fetch roles ──
  const fetchRoles = useCallback(async () => {
    const { data } = await supabase
      .from('stream_fan_tiers')
      .select('user_id, role')
      .eq('stream_id', streamId)
      .not('role', 'is', null);

    if (!data || data.length === 0) return;

    const userIds = data.map((d: any) => d.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => {
      profileMap[p.id] = p;
    });

    setRoleHolders(
      data.map((d: any) => ({
        userId: d.user_id,
        username: profileMap[d.user_id]?.username || 'Unknown',
        avatarUrl: profileMap[d.user_id]?.avatar_url || null,
        role: d.role as ViewerRole,
      }))
    );
  }, [streamId]);

  // ── Fetch awards ──
  const fetchAwards = useCallback(async () => {
    const { data } = await supabase
      .from('stream_awards')
      .select('*')
      .eq('stream_id', streamId);

    if (data) {
      setAwards(data as StreamAward[]);
    }
  }, [streamId]);

  // ── Fetch fan memory ──
  const fetchFanMemory = useCallback(async () => {
    if (!currentUserId) return;

    const { data } = await supabase
      .from('fan_memories')
      .select('*')
      .eq('broadcaster_id', broadcasterId)
      .eq('fan_id', currentUserId)
      .maybeSingle();

    if (data) {
      setFanMemory(data as FanMemory);
    }
  }, [currentUserId, broadcasterId]);

  // ── Fetch contracts ──
  const fetchContracts = useCallback(async () => {
    const query = supabase
      .from('fan_contracts')
      .select('*')
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true);

    if (currentUserId) {
      query.or(`fan_id.eq.${currentUserId},fan_id.eq.${broadcasterId}`);
    }

    const { data } = await query;

    if (data) {
      setContracts(data as FanContract[]);
    }
  }, [broadcasterId, currentUserId]);

  // ── Boost energy ──
  const handleBoost = async () => {
    if (!currentUserId || boosting) return;
    setBoosting(true);

    try {
      await supabase.rpc('boost_stream_energy', {
        p_stream_id: streamId,
        p_user_id: currentUserId,
      });
      await fetchEnergy();
    } catch {
      // silent fail
    } finally {
      setBoosting(false);
    }
  };

  // ── Polling ──
  useEffect(() => {
    fetchSpotlight();
    fetchEnergy();
    fetchLeaderboard();
    fetchRoles();
    fetchAwards();
    fetchFanMemory();
    fetchContracts();

    const spotlightInterval = setInterval(fetchSpotlight, 30000);
    const energyInterval = setInterval(fetchEnergy, 5000);
    const leaderboardInterval = setInterval(fetchLeaderboard, 15000);

    return () => {
      clearInterval(spotlightInterval);
      clearInterval(energyInterval);
      clearInterval(leaderboardInterval);
    };
  }, [
    fetchSpotlight,
    fetchEnergy,
    fetchLeaderboard,
    fetchRoles,
    fetchAwards,
    fetchFanMemory,
    fetchContracts,
  ]);

  // ── Render ──
  return (
    <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 overflow-hidden">
      <Tabs defaultValue="spotlight" className="w-full">
        {/* Tab nav */}
        <div className="border-b border-zinc-800 px-2 pt-2">
          <TabsList className="bg-zinc-800/50 w-full justify-start gap-1 h-auto p-1 flex-nowrap overflow-x-auto">
            <TabsTrigger value="spotlight" className="text-xs px-3 py-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
              <Sparkles className="w-3 h-3 mr-1" />
              Spotlight
            </TabsTrigger>
            <TabsTrigger value="energy" className="text-xs px-3 py-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
              <Zap className="w-3 h-3 mr-1" />
              Energy
            </TabsTrigger>
            <TabsTrigger value="top-fans" className="text-xs px-3 py-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
              <Users className="w-3 h-3 mr-1" />
              Top Fans
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs px-3 py-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
              <Shield className="w-3 h-3 mr-1" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="awards" className="text-xs px-3 py-1.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400">
              <Award className="w-3 h-3 mr-1" />
              Awards
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── A. Spotlight ─────────────────────────────────────────────────── */}
        <TabsContent value="spotlight" className="p-4 space-y-4">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Spotlight Moment
          </div>

          {spotlight ? (
            <motion.div
              key={spotlight.userId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-xl p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30"
            >
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-yellow-400/40"
                animate={{
                  boxShadow: [
                    '0 0 10px rgba(250,204,21,0.2)',
                    '0 0 25px rgba(250,204,21,0.4)',
                    '0 0 10px rgba(250,204,21,0.2)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              <div className="relative flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  {spotlight.avatarUrl ? (
                    <img
                      src={spotlight.avatarUrl}
                      alt={spotlight.username}
                      className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center border-2 border-yellow-400">
                      <Users className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 text-lg">👑</div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">{spotlight.username}</span>
                    <span className={cn('text-xs font-medium', TIER_COLORS[spotlight.tier])}>
                      {TIER_ICONS[spotlight.tier]} {spotlight.tier}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Most active right now
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-yellow-400 font-semibold">
                      <Target className="w-3 h-3 inline mr-1" />
                      {spotlight.actionCount.toLocaleString()} actions
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center text-zinc-500 text-sm py-8">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              Waiting for activity...
            </div>
          )}

          {/* Fan Memory */}
          {fanMemory && (
            <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-2">
              <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                <Heart className="w-3 h-3 text-pink-400" />
                Your History
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{fanMemory.total_streams_watched}</div>
                  <div className="text-[10px] text-zinc-400">Streams</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">{fanMemory.total_coins_gifted.toLocaleString()}</div>
                  <div className="text-[10px] text-zinc-400">Gifted</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-400">{fanMemory.loyalty_score}</div>
                  <div className="text-[10px] text-zinc-400">Loyalty</div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 text-center">
                First seen {new Date(fanMemory.first_seen_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── B. Energy Meter ──────────────────────────────────────────────── */}
        <TabsContent value="energy" className="p-4 space-y-4">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Energy Meter
          </div>

          <div className="space-y-3">
            {/* Level display */}
            <div className="text-center">
              <motion.div
                key={energy?.energy_level ?? 0}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
              >
                {energy?.energy_level ?? 0}
              </motion.div>
              <div className="text-xs text-zinc-400 mt-1">Energy Level</div>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="h-4 w-full rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r',
                    getEnergyGradient(energy?.energy_level ?? 0)
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(energy?.energy_level ?? 0, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              {/* Glow pulse at high levels */}
              {(energy?.energy_level ?? 0) >= 75 && (
                <motion.div
                  className={cn(
                    'absolute inset-0 rounded-full bg-gradient-to-r opacity-30 blur-md',
                    getEnergyGradient(energy?.energy_level ?? 0)
                  )}
                  animate={{ opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>

            {/* Multiplier */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Hype Multiplier</span>
              <span className="font-bold text-orange-400">
                x{(energy?.hype_multiplier ?? 1).toFixed(1)}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <div className="text-sm font-bold text-white">{energy?.total_boosts ?? 0}</div>
                <div className="text-[10px] text-zinc-400">Total Boosts</div>
              </div>
              <div className="rounded-lg bg-zinc-800/60 p-2">
                <div className="text-sm font-bold text-white">{energy?.peak_energy ?? 0}</div>
                <div className="text-[10px] text-zinc-400">Peak Energy</div>
              </div>
            </div>

            {/* Boost button */}
            {currentUserId && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={boosting}
                onClick={handleBoost}
                className={cn(
                  'w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors',
                  boosting
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400'
                )}
              >
                <Zap className={cn('w-4 h-4', boosting && 'animate-pulse')} />
                {boosting ? 'Boosting...' : 'BOOST'}
              </motion.button>
            )}
          </div>
        </TabsContent>

        {/* ─── C. Top Fans / Fan Tiers ─────────────────────────────────────── */}
        <TabsContent value="top-fans" className="p-4 space-y-3">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Fan Tiers
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm py-8">
              <Users className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              No fans yet
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.userId}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                      TIER_BG[entry.tier],
                      entry.userId === currentUserId && 'ring-1 ring-white/20'
                    )}
                  >
                    {/* Rank */}
                    <div className="w-6 text-center text-xs font-bold text-zinc-500">
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                        <Users className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}

                    {/* Name & tier */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">
                          {entry.username}
                        </span>
                        {entry.role && ROLE_CONFIG[entry.role] && (
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                            ROLE_CONFIG[entry.role].color
                          )}>
                            {entry.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={cn('text-[10px] font-medium', TIER_COLORS[entry.tier])}>
                          {TIER_ICONS[entry.tier]} {entry.tier}
                        </span>
                        {entry.contractActive && (
                          <span className="text-[9px] text-purple-400 ml-1">
                            <Heart className="w-2.5 h-2.5 inline" /> contract
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Coins */}
                    <div className="text-right">
                      <div className="text-xs font-bold text-yellow-400">
                        {entry.coinsGifted.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-zinc-500">coins</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Active contracts section */}
          {contracts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                <Heart className="w-3 h-3 text-purple-400" />
                Active Contracts
              </div>
              {contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-purple-300 font-medium capitalize">
                      {contract.contract_type} Contract
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {contract.expires_at
                        ? `Expires ${new Date(contract.expires_at).toLocaleDateString()}`
                        : 'No expiry'}
                    </span>
                  </div>
                  {contract.perks && Object.keys(contract.perks).length > 0 && (
                    <div className="text-[10px] text-zinc-400 mt-1">
                      {Object.entries(contract.perks).map(([k, v]) => (
                        <span key={k} className="mr-2">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── D. Roles ────────────────────────────────────────────────────── */}
        <TabsContent value="roles" className="p-4 space-y-3">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            Viewer Roles
          </div>

          {/* Role cards */}
          <div className="space-y-2">
            {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
              const holders = roleHolders.filter((r) => r.role === roleKey);
              return (
                <div
                  key={roleKey}
                  className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('p-1.5 rounded-md', config.color)}>
                      {config.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{config.label}</div>
                      <div className="text-[10px] text-zinc-400">{config.description}</div>
                    </div>
                  </div>
                  {holders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {holders.map((h) => (
                        <div
                          key={h.userId}
                          className="flex items-center gap-1.5 bg-zinc-700/50 rounded-full px-2 py-1"
                        >
                          {h.avatarUrl ? (
                            <img
                              src={h.avatarUrl}
                              alt={h.username}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-zinc-600" />
                          )}
                          <span className="text-xs text-zinc-300">{h.username}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 mt-1">No one assigned</div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── E & F. Awards ────────────────────────────────────────────────── */}
        <TabsContent value="awards" className="p-4 space-y-3">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-orange-400" />
            End-of-Stream Awards
          </div>

          {/* Award grid */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(AWARD_CONFIG) as [AwardType, typeof AWARD_CONFIG[AwardType]][]).map(
              ([awardType, config]) => {
                const award = awards.find((a) => a.award_type === awardType);
                return (
                  <motion.div
                    key={awardType}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'relative rounded-xl p-3 border transition-colors',
                      award
                        ? 'bg-gradient-to-br border-yellow-500/30'
                        : 'bg-zinc-800/40 border-zinc-700/30',
                      award && config.gradient
                    )}
                  >
                    {/* Animated trophy */}
                    <motion.div
                      className="text-center"
                      animate={
                        award
                          ? { rotate: [0, -5, 5, -5, 0], scale: [1, 1.1, 1] }
                          : {}
                      }
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <div className={cn(
                        'mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-1.5',
                        award ? 'bg-white/10' : 'bg-zinc-700/50'
                      )}>
                        <span className={cn(award ? 'text-white' : 'text-zinc-500')}>
                          {config.icon}
                        </span>
                      </div>
                      <div className={cn(
                        'text-xs font-semibold',
                        award ? 'text-white' : 'text-zinc-500'
                      )}>
                        {config.label}
                      </div>
                    </motion.div>

                    {award ? (
                      <div className="mt-1.5 text-center">
                        <div className="text-[10px] text-white/70 truncate">{award.title}</div>
                        {award.coin_reward > 0 && (
                          <div className="text-[10px] text-yellow-300 mt-0.5">
                            +{award.coin_reward} coins
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-center text-[10px] text-zinc-600">
                        Awaiting...
                      </div>
                    )}
                  </motion.div>
                );
              }
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
