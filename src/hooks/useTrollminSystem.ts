import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface TrollminInfo {
  id: string;
  user_id: string;
  username: string;
  started_at: string;
  term_days: number;
  ends_at: string;
  is_active: boolean;
  approval_rating: number;
  actions_count: number;
  days_remaining: number;
}

export interface QueueItem {
  id: string;
  user_id: string;
  username: string;
  coins_spent: number;
  bid_amount: number;
  joined_at: string;
  position: number;
  status: string;
}

export interface CityLaw {
  id: string;
  title: string;
  description: string;
  effect_type: string;
  effect_value: Record<string, any>;
  duration_hours: number;
  created_at: string;
  expires_at: string;
  created_by_username: string;
}

export interface ActivityItem {
  id: string;
  trollmin_username: string;
  action_type: string;
  target_username: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface TrollminStats {
  terms_served: number;
  total_actions: number;
  average_approval: number;
  highest_rank: number;
  total_rewards: number;
  badge_earned: boolean;
}

export interface DailyLimits {
  bans_used: number;
  bans_max: number;
  mutes_used: number;
  mutes_max: number;
  events_used: number;
  events_max: number;
  court_overrides_used: number;
}

const ENTRY_COST = 100000;

export function useTrollminSystem() {
  const { user, profile } = useAuthStore();
  const [currentTrollmin, setCurrentTrollmin] = useState<TrollminInfo | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeLaws, setActiveLaws] = useState<CityLaw[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(null);
  const [userStats, setUserStats] = useState<TrollminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrollmin, setIsTrollmin] = useState(false);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCurrentTrollmin(),
        fetchQueue(),
        fetchActiveLaws(),
        fetchActivityFeed(),
        fetchDailyLimits()
      ]);
      
      if (user) {
        fetchUserStats(user.id);
        checkUserVote();
      }
    } catch (error) {
      console.error('Error fetching Trollmin data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();

    // Set up real-time subscriptions
    const activityChannel = supabase
      .channel('trollmin-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trollmin_actions_log' },
        () => {
          fetchActivityFeed();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trollmin_current' },
        () => {
          fetchCurrentTrollmin();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trollmin_laws' },
        () => {
          fetchActiveLaws();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
    };
  }, [fetchData]);

  // Check if current user is the Trollmin
  useEffect(() => {
    if (currentTrollmin && user) {
      setIsTrollmin(currentTrollmin.user_id === user.id);
    } else {
      setIsTrollmin(false);
    }
  }, [currentTrollmin, user]);

  const fetchCurrentTrollmin = async () => {
    const { data, error } = await supabase.rpc('get_current_trollmin');
    if (!error && data && data.length > 0) {
      setCurrentTrollmin(data[0]);
    } else {
      setCurrentTrollmin(null);
    }
  };

  const fetchQueue = async () => {
    const { data, error } = await supabase.rpc('get_trollmin_queue');
    if (!error && data) {
      setQueue(data);
    }
  };

  const fetchActiveLaws = async () => {
    const { data, error } = await supabase.rpc('get_active_city_laws');
    if (!error && data) {
      setActiveLaws(data);
    }
  };

  const fetchActivityFeed = async () => {
    const { data, error } = await supabase.rpc('get_trollmin_activity_feed', { p_limit: 50 });
    if (!error && data) {
      setActivityFeed(data);
    }
  };

  const fetchDailyLimits = async () => {
    if (!currentTrollmin) {
      setDailyLimits(null);
      return;
    }

    const { data, error } = await supabase.rpc('check_trollmin_daily_limit', {
      p_trollmin_id: currentTrollmin.id,
      p_action_type: 'ban'
    });

    if (!error && data) {
      setDailyLimits({
        bans_used: data.current || 0,
        bans_max: data.max || 3,
        mutes_used: 0,
        mutes_max: 5,
        events_used: 0,
        events_max: 1,
        court_overrides_used: 0
      });
    }
  };

  const fetchUserStats = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_trollmin_stats', { p_user_id: userId });
    if (!error && data && data.length > 0) {
      setUserStats(data[0]);
    }
  };

  const checkUserVote = async () => {
    if (!currentTrollmin || !user) return;

    const { data } = await supabase
      .from('trollmin_approvals')
      .select('vote')
      .eq('voter_user_id', user.id)
      .eq('trollmin_id', currentTrollmin.id)
      .gte('voted_at', new Date().toISOString().split('T')[0])
      .single();

    if (data) {
      setUserVote(data.vote);
    } else {
      setUserVote(null);
    }
  };

  // Join the Power Queue
  const joinQueue = async () => {
    if (!user || !profile) {
      toast.error('Please log in to join the queue');
      return;
    }

    if (profile.troll_coins < ENTRY_COST) {
      toast.error(`Not enough coins. Need ${ENTRY_COST.toLocaleString()} coins.`);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('join_trollmin_queue', {
        p_user_id: user.id,
        p_username: profile.username,
        p_coins: profile.troll_coins
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error);
      }

      toast.success(`Joined Power Queue! Position: #${data.position}`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join queue');
    }
  };

  // Vote for Trollmin
  const vote = async (voteType: 'up' | 'down') => {
    if (!user || !currentTrollmin) return;

    try {
      const { data, error } = await supabase.rpc('vote_trollmin_approval', {
        p_voter_user_id: user.id,
        p_trollmin_id: currentTrollmin.id,
        p_vote: voteType
      });

      if (error) throw error;

      setUserVote(voteType);
      await fetchCurrentTrollmin();
      toast.success(voteType === 'up' ? 'Voted 👍' : 'Voted 👎');
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    }
  };

  // Create a city law
  const createLaw = async (
    title: string,
    description: string,
    effectType: string,
    effectValue: Record<string, any>,
    durationHours: number
  ) => {
    if (!currentTrollmin || !isTrollmin) {
      toast.error('Only the Trollmin can create laws');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_trollmin_law', {
        p_trollmin_id: currentTrollmin.id,
        p_title: title,
        p_description: description,
        p_effect_type: effectType,
        p_effect_value: effectValue,
        p_duration_hours: durationHours,
        p_username: currentTrollmin.username
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error);
      }

      toast.success(`Law created: ${title}`);
      await fetchActiveLaws();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create law');
    }
  };

  // Ban a user (Trollmin power)
  const banUser = async (targetUserId: string, targetUsername: string, reason: string, duration: number) => {
    if (!currentTrollmin || !isTrollmin) {
      toast.error('Only the Trollmin can ban users');
      return;
    }

    try {
      // Check limits first
      const { data: limitData } = await supabase.rpc('check_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'ban'
      });

      if (limitData && !limitData.success) {
        throw new Error(`Daily ban limit reached (${limitData.current}/${limitData.max})`);
      }

      // Log the action
      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'ban',
        p_target_user_id: targetUserId,
        p_target_username: targetUsername,
        p_details: { reason, duration_hours: duration }
      });

      // Use daily limit
      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'ban'
      });

      // Actually ban the user (24h max for Trollmin)
      const { error: banError } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: currentTrollmin.user_id,
          reported_user_id: targetUserId,
          reason: `[TROLLMIN BAN] ${reason}`,
          status: 'banned'
        });

      if (banError) {
        console.error('Ban error:', banError);
      }

      toast.success(`Banned ${targetUsername} for ${duration} hours`);
      await fetchActivityFeed();
      await fetchDailyLimits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to ban user');
    }
  };

  // Mute a user (Trollmin power)
  const muteUser = async (targetUserId: string, targetUsername: string, reason: string, duration: number) => {
    if (!currentTrollmin || !isTrollmin) {
      toast.error('Only the Trollmin can mute users');
      return;
    }

    try {
      const { data: limitData } = await supabase.rpc('check_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'mute'
      });

      if (limitData && !limitData.success) {
        throw new Error(`Daily mute limit reached (${limitData.current}/${limitData.max})`);
      }

      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'mute',
        p_target_user_id: targetUserId,
        p_target_username: targetUsername,
        p_details: { reason, duration_hours: duration }
      });

      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'mute'
      });

      toast.success(`Muted ${targetUsername} for ${duration} hours`);
      await fetchActivityFeed();
      await fetchDailyLimits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mute user');
    }
  };

  // Grant pardon (Trollmin power)
  const grantPardon = async (targetUserId: string, targetUsername: string, reason?: string) => {
    if (!currentTrollmin || !isTrollmin) {
      toast.error('Only the Trollmin can grant pardons');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('trollmin_grant_pardon', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_target_user_id: targetUserId,
        p_target_username: targetUsername,
        p_reason: reason
      });

      if (error) throw error;

      toast.success(`Pardoned ${targetUsername}`);
      await fetchActivityFeed();
    } catch (err: any) {
      toast.error(err.message || 'Failed to grant pardon');
    }
  };

  // Trigger event (Trollmin power)
  const triggerEvent = async (eventType: string, eventValue: Record<string, any>) => {
    if (!currentTrollmin || !isTrollmin) {
      toast.error('Only the Trollmin can trigger events');
      return;
    }

    try {
      const { data: limitData } = await supabase.rpc('check_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'event'
      });

      if (limitData && !limitData.success) {
        throw new Error(`Daily event limit reached`);
      }

      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'event_triggered',
        p_target_user_id: null,
        p_target_username: null,
        p_details: { event_type: eventType, ...eventValue }
      });

      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'event'
      });

      toast.success(`Event triggered: ${eventType}`);
      await fetchActivityFeed();
      await fetchDailyLimits();
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger event');
    }
  };

  // Leave queue
  const leaveQueue = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('trollmin_queue')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'waiting');

      if (error) throw error;

      toast.success('Left the Power Queue');
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave queue');
    }
  };

  return {
    // Data
    currentTrollmin,
    queue,
    activeLaws,
    activityFeed,
    dailyLimits,
    userStats,
    loading,
    isTrollmin,
    userVote,
    
    // Actions
    joinQueue,
    leaveQueue,
    vote,
    createLaw,
    banUser,
    muteUser,
    grantPardon,
    triggerEvent,
    refreshData: fetchData
  };
}
