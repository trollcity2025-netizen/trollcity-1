// =============================================================================
// FAMILY ACHIEVEMENT & PROGRESSION SYSTEM HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

// Types
export interface AchievementTier {
  id: string;
  tier_number: number;
  tier_name: string;
  tier_description: string;
  tier_color: string;
  tier_icon: string;
  base_messages: number;
  base_calls: number;
  base_coins: number;
  xp_reward: number;
  coin_reward: number;
}

export interface Achievement {
  id: string;
  achievement_key: string;
  tier_number: number;
  title: string;
  description: string;
  hint: string;
  secret: boolean;
  metric_type: string;
  base_requirement: number;
  xp_reward: number;
  coin_reward: number;
  icon: string;
  color: string;
  rarity: string;
}

export interface FamilyAchievement {
  id: string;
  family_id: string;
  achievement_key: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at: string | null;
}

export interface WeeklyGoal {
  id: string;
  family_id: string;
  goal_key: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  progress: number;
  target: number;
  xp_reward: number;
  coin_reward: number;
  week_number: number;
  year: number;
  expires_at: string;
  completed: boolean;
}

export interface FamilyStats {
  family_id: string;
  total_messages: number;
  total_calls: number;
  total_call_minutes: number;
  total_coins: number;
  total_gifts: number;
  total_gift_value: number;
  total_battle_wins: number;
  active_days: number;
  level: number;
  xp: number;
  xp_to_next_level: number;
  current_streak: number;
  longest_streak: number;
  current_tier: number;
}

export interface LevelUnlock {
  level: number;
  unlock_type: string;
  unlock_key: string;
  unlock_name: string;
  unlock_description: string;
  icon: string;
  color: string;
}

export interface HiddenAchievement {
  achievement_key: string;
  title: string;
  description: string;
  secret_hint: string;
  trigger_type: string;
  xp_reward: number;
  coin_reward: number;
  exclusive_badge: string;
  rarity: string;
}

// Family Earnings & Payout Types
export interface FamilyEarningsPool {
  family_id: string;
  total_earned: number;
  weekly_earned: number;
  monthly_earned: number;
  available_balance: number;
  pending_distribution: number;
  current_week_completed: boolean;
  current_week_goals: number;
  current_week_total_goals: number;
}

export interface MemberEarnings {
  user_id: string;
  total_earned: number;
  monthly_earned: number;
  pending_payout: number;
  leader_tax_collected: number;
}

export interface PayoutRecord {
  id: string;
  payout_type: string;
  total_amount: number;
  member_count: number;
  amount_per_member: number;
  leader_tax_amount: number;
  status: string;
  week_number: number;
  year: number;
  created_at: string;
}

// Hook: Fetch family stats
export function useFamilyStats(familyId: string | null) {
  const [stats, setStats] = useState<FamilyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) {
      setStats(null);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('family_stats_enhanced')
          .select('*')
          .eq('family_id', familyId)
          .single();

        if (error) throw error;
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [familyId]);

  return { stats, loading, error };
}

// Hook: Fetch achievement tiers
export function useAchievementTiers() {
  const [tiers, setTiers] = useState<AchievementTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      const { data, error } = await supabase
        .from('achievement_tiers')
        .select('*')
        .order('tier_number', { ascending: true })
        .eq('is_active', true);

      if (!error && data) {
        setTiers(data);
      }
      setLoading(false);
    };

    fetchTiers();
  }, []);

  return { tiers, loading };
}

// Hook: Fetch family achievements
export function useFamilyAchievements(familyId: string | null) {
  const [achievements, setAchievements] = useState<FamilyAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setAchievements([]);
      setLoading(false);
      return;
    }

    const fetchAchievements = async () => {
      const { data, error } = await supabase
        .from('family_achievements_new')
        .select('*')
        .eq('family_id', familyId);

      if (!error && data) {
        setAchievements(data);
      }
      setLoading(false);
    };

    fetchAchievements();
  }, [familyId]);

  return { achievements, loading };
}

// Hook: Fetch weekly goals
export function useWeeklyGoals(familyId: string | null) {
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from('weekly_family_goals_new')
        .select('*')
        .eq('family_id', familyId)
        .eq('week_number', getCurrentWeekNumber())
        .eq('year', new Date().getFullYear());

      if (!error && data) {
        setGoals(data);
      }
      setLoading(false);
    };

    fetchGoals();
  }, [familyId]);

  return { goals, loading };
}

// Hook: Fetch level unlocks
export function useLevelUnlocks(currentLevel: number) {
  const [unlocks, setUnlocks] = useState<LevelUnlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnlocks = async () => {
      const { data, error } = await supabase
        .from('family_level_unlocks')
        .select('*')
        .lte('level', currentLevel)
        .order('level', { ascending: true });

      if (!error && data) {
        setUnlocks(data);
      }
      setLoading(false);
    };

    if (currentLevel > 0) {
      fetchUnlocks();
    }
  }, [currentLevel]);

  return { unlocks, loading };
}

// Hook: Fetch hidden achievements
export function useHiddenAchievements() {
  const [achievements, setAchievements] = useState<HiddenAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHidden = async () => {
      const { data, error } = await supabase
        .from('hidden_achievements')
        .select('*')
        .eq('is_active', true);

      if (!error && data) {
        setAchievements(data);
      }
      setLoading(false);
    };

    fetchHidden();
  }, []);

  return { achievements, loading };
}

// Hook: Get family leaderboard
export function useFamilyLeaderboard(limit: number = 50) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .rpc('get_family_leaderboard', { p_limit: limit });

      if (!error && data) {
        setLeaderboard(data);
      }
      setLoading(false);
    };

    fetchLeaderboard();
  }, [limit]);

  return { leaderboard, loading };
}

// Hook: Award XP to family
export function useAwardFamilyXP() {
  const [loading, setLoading] = useState(false);

  const awardXP = useCallback(async (
    familyId: string,
    xpAmount: number,
    coinAmount: number = 0,
    source: string = 'achievement'
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('award_family_xp', {
        p_family_id: familyId,
        p_xp_amount: xpAmount,
        p_coin_amount: coinAmount,
        p_source: source
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error awarding family XP:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { awardXP, loading };
}

// Hook: Generate weekly goals
export function useGenerateWeeklyGoals() {
  const [loading, setLoading] = useState(false);

  const generateGoals = useCallback(async (familyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_weekly_goals', {
        p_family_id: familyId
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error generating weekly goals:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateGoals, loading };
}

// Hook: Check rate limit
export function useCheckRateLimit() {
  const checkLimit = useCallback(async (
    familyId: string,
    userId: string,
    eventType: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('check_family_rate_limit', {
        p_family_id: familyId,
        p_user_id: userId,
        p_event_type: eventType
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error checking rate limit:', err);
      return { allowed: true, count: 0 };
    }
  }, []);

  return { checkLimit };
}

// Helper: Get current week number
function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
}

// Hook: Subscribe to family updates (only when on family page)
export function useFamilyRealtime(familyId: string | null, enabled: boolean = true) {
  const [updates, setUpdates] = useState<any>(null);

  useEffect(() => {
    if (!familyId || !enabled) {
      return;
    }

    const channel = supabase
      .channel(`family:${familyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'family_stats_enhanced',
        filter: `family_id=eq.${familyId}`
      }, (payload) => {
        setUpdates(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, enabled]);

  return updates;
}

// =============================================================================
// FAMILY EARNINGS & PAYOUT HOOKS
// =============================================================================

// Hook: Fetch family earnings pool
export function useFamilyEarningsPool(familyId: string | null) {
  const [pool, setPool] = useState<FamilyEarningsPool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setPool(null);
      setLoading(false);
      return;
    }

    const fetchPool = async () => {
      const { data, error } = await supabase
        .from('family_earnings_pool')
        .select('*')
        .eq('family_id', familyId)
        .single();

      if (!error && data) {
        setPool(data);
      }
      setLoading(false);
    };

    fetchPool();
  }, [familyId]);

  return { pool, loading };
}

// Hook: Fetch member's earnings
export function useMemberEarnings(familyId: string | null, userId: string | null) {
  const [earnings, setEarnings] = useState<MemberEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!familyId || !userId) {
      setEarnings(null);
      setLoading(false);
      return;
    }

    const fetchEarnings = async () => {
      const { data, error } = await supabase
        .from('family_member_earnings')
        .select('*')
        .eq('family_id', familyId)
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      if (!error && data) {
        setEarnings(data);
      }
      setLoading(false);
    };

    fetchEarnings();
  }, [familyId, userId, currentMonth, currentYear]);

  return { earnings, loading };
}

// Hook: Fetch payout history
export function usePayoutHistory(familyId: string | null, limit: number = 10) {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setPayouts([]);
      setLoading(false);
      return;
    }

    const fetchPayouts = async () => {
      const { data, error } = await supabase
        .from('family_payout_records')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setPayouts(data);
      }
      setLoading(false);
    };

    fetchPayouts();
  }, [familyId, limit]);

  return { payouts, loading };
}

// Hook: Add earnings to family pool
export function useAddFamilyEarnings() {
  const [loading, setLoading] = useState(false);

  const addEarnings = useCallback(async (
    familyId: string,
    amount: number,
    source: string = 'task_reward'
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('add_family_earnings', {
        p_family_id: familyId,
        p_amount: amount,
        p_source: source
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding family earnings:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { addEarnings, loading };
}

// Hook: Distribute weekly earnings
export function useDistributeWeeklyEarnings() {
  const [loading, setLoading] = useState(false);

  const distribute = useCallback(async (familyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('distribute_weekly_earnings', {
        p_family_id: familyId
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error distributing weekly earnings:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { distribute, loading };
}

// Hook: Get member pending payout
export function useGetMemberPayout() {
  const getPayout = useCallback(async (familyId: string, userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_member_pending_payout', {
        p_family_id: familyId,
        p_user_id: userId
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error getting member payout:', err);
      return null;
    }
  }, []);

  return { getPayout };
}

// Hook: Setup leader tax
export function useSetupLeaderTax() {
  const [loading, setLoading] = useState(false);

  const setupTax = useCallback(async (
    familyId: string,
    leaderUserId: string,
    taxPercentage: number = 5.00,
    monthlyThreshold: number = 10000
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('setup_family_leader_tax', {
        p_family_id: familyId,
        p_leader_user_id: leaderUserId,
        p_tax_percentage: taxPercentage,
        p_monthly_threshold: monthlyThreshold
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error setting up leader tax:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { setupTax, loading };
}
