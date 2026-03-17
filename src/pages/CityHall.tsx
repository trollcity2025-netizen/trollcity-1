import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Building2, Crown, Users, Clock, ArrowRight, Gavel, 
  BookOpen, Activity, ThumbsUp, ThumbsDown, Zap, 
  Shield, Ban, VolumeX, Gift, Star, Timer, AlertTriangle,
  ChevronRight, X, Plus, Play, Trash2, UserMinus
} from 'lucide-react';
import { trollCityTheme } from '../styles/trollCityTheme';

interface QueueItem {
  id: string;
  user_id: string;
  username: string;
  coins_spent: number;
  bid_amount: number;
  joined_at: string;
  position: number;
  status: string;
}

interface CurrentTrollmin {
  id: string;
  user_id: string;
  username: string;
  started_at: string;
  term_days: number;
  ends_at: string;
  is_active: boolean;
  approval_rating: number;
  actions_count: number;
  bans_count: number;
  mutes_count: number;
  pardons_count: number;
  laws_created: number;
  days_remaining: number;
}

interface CityLaw {
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

interface ActivityItem {
  id: string;
  trollmin_username: string;
  action_type: string;
  target_username: string | null;
  details: Record<string, any>;
  created_at: string;
}

interface DailyLimits {
  bans_used: number;
  bans_max: number;
  mutes_used: number;
  mutes_max: number;
  events_used: number;
  events_max: number;
}

const ENTRY_COST = 5000;

export default function CityHall() {
  const { user, profile } = useAuthStore();
  const [currentTrollmin, setCurrentTrollmin] = useState<CurrentTrollmin | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeLaws, setActiveLaws] = useState<CityLaw[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isTrollmin, setIsTrollmin] = useState(false);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modals
  const [showCreateLaw, setShowCreateLaw] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Form states
  const [lawTitle, setLawTitle] = useState('');
  const [lawDescription, setLawDescription] = useState('');
  const [lawEffect, setLawEffect] = useState('xp_boost');
  const [lawDuration, setLawDuration] = useState(24);
  const [targetUsername, setTargetUsername] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionDuration, setActionDuration] = useState(24);
  const [eventType, setEventType] = useState('xp_hour');
  const [eventValue, setEventValue] = useState(2);

  useEffect(() => {
    fetchData();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    setIsAdmin(!!data?.is_admin);
  };

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('trollmin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trollmin_current' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trollmin_actions_log' }, fetchActivityFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trollmin_laws' }, fetchActiveLaws)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trollmin_queue' }, fetchQueue)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCurrentTrollmin(),
      fetchQueue(),
      fetchActiveLaws(),
      fetchActivityFeed()
    ]);
    setLoading(false);
  };

  const fetchCurrentTrollmin = async () => {
    const { data } = await supabase.rpc('get_current_trollmin');
    if (data && data.length > 0) {
      setCurrentTrollmin(data[0]);
      if (user) {
        setIsTrollmin(data[0].user_id === user.id);
        checkUserVote(data[0].id);
        fetchDailyLimits(data[0].id);
      }
    } else {
      setCurrentTrollmin(null);
      setIsTrollmin(false);
    }
  };

  const fetchQueue = async () => {
    const { data } = await supabase.rpc('get_trollmin_queue');
    if (data) {
      setQueue(data);
    }
  };

  const fetchActiveLaws = async () => {
    const { data } = await supabase.rpc('get_active_city_laws');
    if (data) {
      setActiveLaws(data);
    }
  };

  const fetchActivityFeed = async () => {
    const { data } = await supabase.rpc('get_trollmin_activity_feed', { p_limit: 30 });
    if (data) {
      setActivityFeed(data);
    }
  };

  const fetchDailyLimits = async (trollminId: string) => {
    const { data: banData } = await supabase.rpc('check_trollmin_daily_limit', {
      p_trollmin_id: trollminId,
      p_action_type: 'ban'
    });
    const { data: muteData } = await supabase.rpc('check_trollmin_daily_limit', {
      p_trollmin_id: trollminId,
      p_action_type: 'mute'
    });
    const { data: eventData } = await supabase.rpc('check_trollmin_daily_limit', {
      p_trollmin_id: trollminId,
      p_action_type: 'event'
    });

    setDailyLimits({
      bans_used: banData?.current || 0,
      bans_max: banData?.max || 3,
      mutes_used: muteData?.current || 0,
      mutes_max: muteData?.max || 5,
      events_used: eventData?.current || 0,
      events_max: eventData?.max || 1
    });
  };

  const checkUserVote = async (trollminId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('trollmin_approvals')
      .select('vote')
      .eq('voter_user_id', user.id)
      .eq('trollmin_id', trollminId)
      .gte('voted_at', new Date().toISOString().split('T')[0])
      .single();
    setUserVote(data?.vote || null);
  };

  const handleJoinQueue = async () => {
    if (!user || !profile) {
      toast.error('Please log in first');
      return;
    }
    if (!confirm(`Join the Power Queue for ${ENTRY_COST.toLocaleString()} coins?`)) return;

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_trollmin_queue', {
        p_user_id: user.id,
        p_username: profile.username,
        p_coins: profile.troll_coins
      });
      
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to join queue');
      }

      toast.success(`Joined Power Queue! Position: #${data.position}`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user || !currentTrollmin) return;

    try {
      const { error } = await supabase.rpc('vote_trollmin_approval', {
        p_voter_user_id: user.id,
        p_trollmin_id: currentTrollmin.id,
        p_vote: voteType
      });

      if (error) throw error;
      setUserVote(voteType);
      fetchCurrentTrollmin();
      toast.success(voteType === 'up' ? 'Voted 👍' : 'Voted 👎');
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    }
  };

  const handleCreateLaw = async () => {
    if (!currentTrollmin) {
      toast.error('No Trollmin is currently active');
      return;
    }
    if (!isTrollmin) {
      toast.error('Only the Trollmin can create laws');
      return;
    }
    if (!lawTitle.trim()) {
      toast.error('Please enter a law title');
      return;
    }

    try {
      const effectValue: Record<string, any> = {};
      if (lawEffect === 'xp_boost' || lawEffect === 'battle_bonus') {
        effectValue.multiplier = eventValue;
      }

      const { data, error } = await supabase.rpc('create_trollmin_law', {
        p_trollmin_id: currentTrollmin.id,
        p_title: lawTitle,
        p_description: lawDescription,
        p_effect_type: lawEffect,
        p_effect_value: effectValue,
        p_duration_hours: lawDuration,
        p_username: currentTrollmin.username
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success(`Law created: ${lawTitle}`);
      setShowCreateLaw(false);
      setLawTitle('');
      setLawDescription('');
      fetchActiveLaws();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBanUser = async () => {
    if (!currentTrollmin) {
      toast.error('No Trollmin is currently active');
      return;
    }
    if (!isTrollmin) {
      toast.error('Only the Trollmin can ban users');
      return;
    }
    if (!targetUsername.trim()) {
      toast.error('Please enter a username');
      return;
    }

    try {
      // Check limits
      const { data: limitData } = await supabase.rpc('check_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'ban'
      });

      if (limitData && !limitData.success) {
        throw new Error(`Daily ban limit reached (${limitData.current}/${limitData.max})`);
      }

      // Get target user ID
      const { data: targetUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', targetUsername)
        .single();

      if (!targetUser) {
        throw new Error('User not found');
      }

      // Log action
      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'ban',
        p_target_user_id: targetUser.id,
        p_target_username: targetUsername,
        p_details: { reason: actionReason, duration_hours: actionDuration }
      });

      // Use daily limit
      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'ban'
      });

      toast.success(`Banned ${targetUsername} for ${actionDuration} hours`);
      setShowBanModal(false);
      setTargetUsername('');
      setActionReason('');
      fetchActivityFeed();
      fetchDailyLimits(currentTrollmin.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMuteUser = async () => {
    if (!currentTrollmin) {
      toast.error('No Trollmin is currently active');
      return;
    }
    if (!isTrollmin) {
      toast.error('Only the Trollmin can mute users');
      return;
    }
    if (!targetUsername.trim()) {
      toast.error('Please enter a username');
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

      const { data: targetUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', targetUsername)
        .single();

      if (!targetUser) {
        throw new Error('User not found');
      }

      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'mute',
        p_target_user_id: targetUser.id,
        p_target_username: targetUsername,
        p_details: { reason: actionReason, duration_hours: actionDuration }
      });

      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'mute'
      });

      toast.success(`Muted ${targetUsername} for ${actionDuration} hours`);
      setShowMuteModal(false);
      setTargetUsername('');
      setActionReason('');
      fetchActivityFeed();
      fetchDailyLimits(currentTrollmin.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTriggerEvent = async () => {
    if (!currentTrollmin) {
      toast.error('No Trollmin is currently active');
      return;
    }
    if (!isTrollmin) {
      toast.error('Only the Trollmin can trigger events');
      return;
    }

    try {
      const { data: limitData } = await supabase.rpc('check_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'event'
      });

      if (limitData && !limitData.success) {
        throw new Error('Daily event limit reached');
      }

      const eventDetails: Record<string, any> = {};
      if (eventType === 'xp_hour' || eventType === 'battle_bonus') {
        eventDetails.multiplier = eventValue;
        eventDetails.duration_hours = 1;
      }

      await supabase.rpc('log_trollmin_action', {
        p_trollmin_id: currentTrollmin.id,
        p_trollmin_username: currentTrollmin.username,
        p_action_type: 'event_triggered',
        p_target_user_id: null,
        p_target_username: null,
        p_details: { event_type: eventType, ...eventDetails }
      });

      await supabase.rpc('use_trollmin_daily_limit', {
        p_trollmin_id: currentTrollmin.id,
        p_action_type: 'event'
      });

      toast.success(`Event triggered: ${eventType}`);
      setShowEventModal(false);
      fetchActivityFeed();
      fetchDailyLimits(currentTrollmin.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin functions for queue management
  const handlePromoteNext = async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase.rpc('promote_next_trollmin');
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to promote');
      }
      toast.success(`Promoted ${data.username} as new Trollmin!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to promote');
    }
  };

  const handleRemoveFromQueue = async (userId: string, username: string) => {
    if (!isAdmin) return;
    if (!confirm(`Remove ${username} from queue?`)) return;
    try {
      const { error } = await supabase
        .from('trollmin_queue')
        .update({ status: 'removed', is_banned_from_queue: true })
        .eq('user_id', userId);
      if (error) throw error;
      toast.success(`Removed ${username} from queue`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'ban': return <Ban className="w-4 h-4 text-red-400" />;
      case 'mute': return <VolumeX className="w-4 h-4 text-yellow-400" />;
      case 'pardon': return <Star className="w-4 h-4 text-green-400" />;
      case 'law_created': return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'event_triggered': return <Zap className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionText = (item: ActivityItem) => {
    switch (item.action_type) {
      case 'ban': return <><span className="text-red-400 font-bold">{item.trollmin_username}</span> banned <span className="text-white">{item.target_username}</span></>;
      case 'mute': return <><span className="text-yellow-400 font-bold">{item.trollmin_username}</span> muted <span className="text-white">{item.target_username}</span></>;
      case 'pardon': return <><span className="text-green-400 font-bold">{item.trollmin_username}</span> pardoned <span className="text-white">{item.target_username}</span></>;
      case 'law_created': return <><span className="text-purple-400 font-bold">{item.trollmin_username}</span> created law: <span className="text-white">{item.details?.title}</span></>;
      case 'event_triggered': return <><span className="text-blue-400 font-bold">{item.trollmin_username}</span> triggered <span className="text-white">{item.details?.event_type}</span></>;
      default: return <><span className="font-bold">{item.trollmin_username}</span> {item.action_type}</>;
    }
  };

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-4 pb-20 md:pb-4 md:ml-64`}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`flex items-center gap-4 border-b ${trollCityTheme.borders.glass} pb-6`}>
          <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-2xl border ${trollCityTheme.borders.glass}`}>
            <Building2 className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Troll City Hall
            </h1>
            <p className={`${trollCityTheme.text.muted} mt-1`}>
              Home of the Trollmin — The temporary ruler of Troll City
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Current Trollmin Panel */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Crown className="w-40 h-40" />
                </div>
                
                <div className="relative z-10">
                  <h2 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                    <Crown className="w-4 h-4" /> Current Trollmin
                  </h2>
                  
                  {currentTrollmin ? (
                    <div className="space-y-6">
                      {/* Trollmin Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-purple-500/30">
                          {currentTrollmin.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-3xl font-bold text-white">{currentTrollmin.username}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full border border-purple-500/30 font-bold">
                              TROLLMIN
                            </span>
                            <span className="flex items-center gap-1 text-sm text-yellow-500">
                              <Timer className="w-4 h-4" />
                              {currentTrollmin.days_remaining} days remaining
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 ${trollCityTheme.backgrounds.input} rounded-xl`}>
                          <div className="text-2xl font-bold text-white">{currentTrollmin.actions_count}</div>
                          <div className="text-xs text-gray-400">Actions Taken</div>
                        </div>
                        <div className={`p-4 ${trollCityTheme.backgrounds.input} rounded-xl`}>
                          <div className="text-2xl font-bold text-red-400">{currentTrollmin.bans_count}</div>
                          <div className="text-xs text-gray-400">Bans Issued</div>
                        </div>
                        <div className={`p-4 ${trollCityTheme.backgrounds.input} rounded-xl`}>
                          <div className="text-2xl font-bold text-yellow-400">{currentTrollmin.mutes_count}</div>
                          <div className="text-xs text-gray-400">Mutes Issued</div>
                        </div>
                        <div className={`p-4 ${trollCityTheme.backgrounds.input} rounded-xl`}>
                          <div className="text-2xl font-bold text-green-400">{currentTrollmin.pardons_count}</div>
                          <div className="text-xs text-gray-400">Pardons Granted</div>
                        </div>
                      </div>

                      {/* Approval Rating */}
                      <div className={`p-4 ${trollCityTheme.backgrounds.input} rounded-xl`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Approval Rating</span>
                          <span className={`font-bold ${currentTrollmin.approval_rating >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {currentTrollmin.approval_rating}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${currentTrollmin.approval_rating >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${currentTrollmin.approval_rating}%` }}
                          />
                        </div>
                        {user && !isTrollmin && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleVote('up')}
                              disabled={userVote !== null}
                              className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                                userVote === 'up' 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-gray-700 text-gray-300 hover:bg-green-600/20'
                              } disabled:opacity-50`}
                            >
                              <ThumbsUp className="w-4 h-4" /> Approve
                            </button>
                            <button
                              onClick={() => handleVote('down')}
                              disabled={userVote !== null}
                              className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                                userVote === 'down' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-gray-700 text-gray-300 hover:bg-red-600/20'
                              } disabled:opacity-50`}
                            >
                              <ThumbsDown className="w-4 h-4" /> Disapprove
                            </button>
                          </div>
                        )}
                        {userVote !== null && (
                          <p className="text-xs text-gray-500 mt-2 text-center">Vote recorded for today</p>
                        )}
                      </div>

                      {/* Trollmin Actions Panel */}
                      {isTrollmin && dailyLimits && (
                        <div className={`p-4 border ${trollCityTheme.borders.glass} rounded-xl mt-4`}>
                          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-400" /> Trollmin Powers
                          </h3>
                          
                          {/* Daily Limits */}
                          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold mb-2">
                              <AlertTriangle className="w-4 h-4" /> Daily Limits
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-gray-400">Bans: {dailyLimits.bans_used}/{dailyLimits.bans_max}</div>
                              <div className="text-gray-400">Mutes: {dailyLimits.mutes_used}/{dailyLimits.mutes_max}</div>
                              <div className="text-gray-400">Events: {dailyLimits.events_used}/{dailyLimits.events_max}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <button
                              onClick={() => setShowBanModal(true)}
                              disabled={dailyLimits.bans_used >= dailyLimits.bans_max}
                              className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Ban className="w-5 h-5 mx-auto mb-1" />
                              Ban User
                            </button>
                            <button
                              onClick={() => setShowMuteModal(true)}
                              disabled={dailyLimits.mutes_used >= dailyLimits.mutes_max}
                              className="p-3 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-400 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <VolumeX className="w-5 h-5 mx-auto mb-1" />
                              Mute User
                            </button>
                            <button
                              onClick={() => setShowCreateLaw(true)}
                              disabled={activeLaws.length >= 3}
                              className="p-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 font-bold text-sm disabled:opacity-50"
                            >
                              <BookOpen className="w-5 h-5 mx-auto mb-1" />
                              Create Law
                            </button>
                            <button
                              onClick={() => setShowEventModal(true)}
                              disabled={dailyLimits.events_used >= dailyLimits.events_max}
                              className="p-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Zap className="w-5 h-5 mx-auto mb-1" />
                              Trigger Event
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Crown className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg">No Trollmin currently ruling Troll City</p>
                      <p className="text-sm mt-2">Be the first to join the Power Queue!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Active City Laws */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${trollCityTheme.borders.glass} flex items-center justify-between`}>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 text-purple-400`} /> Active City Laws
                  </h3>
                  <span className={`text-xs ${trollCityTheme.text.muted}`}>{activeLaws.length}/3 active</span>
                </div>

                <div className="divide-y divide-gray-800">
                  {activeLaws.length === 0 ? (
                    <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>
                      No active laws. The city is free!
                    </div>
                  ) : (
                    activeLaws.map((law) => (
                      <div key={law.id} className="p-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-white">{law.title}</h4>
                            {law.description && (
                              <p className={`text-sm ${trollCityTheme.text.muted} mt-1`}>{law.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                                {law.effect_type.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-500">
                                Expires: {new Date(law.expires_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activity Feed */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${trollCityTheme.borders.glass} flex items-center justify-between`}>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Activity className={`w-4 h-4 text-blue-400`} /> City Activity Feed
                  </h3>
                </div>

                <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
                  {activityFeed.length === 0 ? (
                    <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>
                      No recent activity
                    </div>
                  ) : (
                    activityFeed.slice(0, 20).map((item) => (
                      <div key={item.id} className="p-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getActionIcon(item.action_type)}</div>
                          <div className="flex-1">
                            <p className="text-sm">{getActionText(item)}</p>
                            <span className="text-xs text-gray-600">
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Column - Queue */}
            <div className="space-y-6">
              
              {/* Join Queue CTA */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 flex flex-col justify-between rounded-2xl`}>
                <div>
                  <h2 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Power Queue
                  </h2>
                  <p className={`${trollCityTheme.text.muted} text-sm mb-4`}>
                    Become the next Trollmin. Rule Troll City for 30 days!
                  </p>
                  <div className="text-3xl font-bold text-white mb-1">
                    {ENTRY_COST.toLocaleString()} <span className="text-sm text-purple-400 font-normal">Coins</span>
                  </div>
                </div>

                <button 
                  onClick={handleJoinQueue}
                  disabled={joining || loading || isTrollmin || !!currentTrollmin}
                  className={`w-full mt-4 ${trollCityTheme.buttons.primary} py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTrollmin ? 'You are Trollmin' : joining ? 'Processing...' : 'Join Queue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Queue List */}
              <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${trollCityTheme.borders.glass} flex items-center justify-between`}>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${trollCityTheme.text.muted}`} /> Waiting List
                  </h3>
                  <span className={`text-xs ${trollCityTheme.text.muted}`}>{queue.length} in line</span>
                </div>

                {/* Admin Controls */}
                {isAdmin && queue.length > 0 && !currentTrollmin && (
                  <div className="p-3 bg-red-500/10 border-b border-red-500/20">
                    <button
                      onClick={handlePromoteNext}
                      className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Crown className="w-4 h-4" /> Promote Next Trollmin
                    </button>
                  </div>
                )}

                <div className={`divide-y ${trollCityTheme.borders.glass}`}>
                  {queue.length === 0 ? (
                    <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>
                      The queue is empty. Be the first!
                    </div>
                  ) : (
                    queue.slice(0, 10).map((item) => (
                      <div key={item.user_id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 ${trollCityTheme.backgrounds.input} rounded-full flex items-center justify-center text-xs font-bold ${trollCityTheme.text.muted}`}>
                            #{item.position}
                          </div>
                          <div>
                            <div className="font-medium text-white">{item.username}</div>
                            <div className={`text-xs ${trollCityTheme.text.muted}`}>
                              {item.coins_spent.toLocaleString()} coins
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.user_id === user?.id && (
                            <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
                              YOU
                            </div>
                          )}
                          {isAdmin && item.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemoveFromQueue(item.user_id, item.username)}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded"
                              title="Remove from queue"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Info Cards */}
              <div className={`space-y-3 text-sm ${trollCityTheme.text.muted}`}>
                <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-purple-400" /> Term Duration
                  </h4>
                  <p>Each Trollmin term lasts exactly 30 days. If removed early, the next user in queue takes over.</p>
                </div>
                <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" /> Trollmin Powers
                  </h4>
                  <p>Ban (3/day), Mute (5/day), Create Laws (max 3), Trigger Events (1/day), Grant Pardons</p>
                </div>
                <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-xl border ${trollCityTheme.borders.glass}`}>
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-yellow-400" /> President Rules
                  </h4>
                  <p>All Trollmin actions must follow President Rules. Violations = immediate removal + permanent queue ban.</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* CREATE LAW MODAL */}
        {showCreateLaw && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl max-w-md w-full`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Create City Law</h3>
                <button onClick={() => setShowCreateLaw(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Law Title</label>
                  <input
                    type="text"
                    value={lawTitle}
                    onChange={(e) => setLawTitle(e.target.value)}
                    placeholder="e.g., 2x XP Hour"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Description</label>
                  <textarea
                    value={lawDescription}
                    onChange={(e) => setLawDescription(e.target.value)}
                    placeholder="What does this law do?"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg h-20`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Effect Type</label>
                  <select
                    value={lawEffect}
                    onChange={(e) => setLawEffect(e.target.value)}
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  >
                    <option value="xp_boost">XP Boost</option>
                    <option value="mute_enforcement">Mute Enforcement</option>
                    <option value="battle_bonus">Battle Bonus</option>
                    <option value="coin_bonus">Coin Bonus</option>
                  </select>
                </div>
                {lawEffect === 'xp_boost' || lawEffect === 'battle_bonus' ? (
                  <div>
                    <label className="text-sm text-gray-400">Multiplier</label>
                    <input
                      type="number"
                      value={eventValue}
                      onChange={(e) => setEventValue(Number(e.target.value))}
                      min={1}
                      max={10}
                      className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                    />
                  </div>
                ) : null}
                <div>
                  <label className="text-sm text-gray-400">Duration (hours)</label>
                  <select
                    value={lawDuration}
                    onChange={(e) => setLawDuration(Number(e.target.value))}
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                  </select>
                </div>
                <button
                  onClick={handleCreateLaw}
                  className={`w-full ${trollCityTheme.buttons.primary} py-3 rounded-lg font-bold`}
                >
                  Create Law
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BAN MODAL */}
        {showBanModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl max-w-md w-full`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-400" /> Ban User
                </h3>
                <button onClick={() => setShowBanModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Username</label>
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    placeholder="Enter username to ban"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Reason</label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Reason for ban"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Duration (hours, max 24)</label>
                  <select
                    value={actionDuration}
                    onChange={(e) => setActionDuration(Number(e.target.value))}
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                  </select>
                </div>
                <button
                  onClick={handleBanUser}
                  className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-white"
                >
                  Ban User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MUTE MODAL */}
        {showMuteModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl max-w-md w-full`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <VolumeX className="w-5 h-5 text-yellow-400" /> Mute User
                </h3>
                <button onClick={() => setShowMuteModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Username</label>
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    placeholder="Enter username to mute"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Reason</label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Reason for mute"
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Duration (hours)</label>
                  <select
                    value={actionDuration}
                    onChange={(e) => setActionDuration(Number(e.target.value))}
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                  </select>
                </div>
                <button
                  onClick={handleMuteUser}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-lg font-bold text-white"
                >
                  Mute User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EVENT MODAL */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl max-w-md w-full`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" /> Trigger City Event
                </h3>
                <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                  >
                    <option value="xp_hour">XP Hour</option>
                    <option value="battle_bonus">Battle Bonus</option>
                    <option value="coin_rain">Coin Rain</option>
                    <option value="gift_splash">Gift Splash</option>
                  </select>
                </div>
                {(eventType === 'xp_hour' || eventType === 'battle_bonus') && (
                  <div>
                    <label className="text-sm text-gray-400">Multiplier</label>
                    <input
                      type="number"
                      value={eventValue}
                      onChange={(e) => setEventValue(Number(e.target.value))}
                      min={1}
                      max={10}
                      className={`w-full mt-1 ${trollCityTheme.inputs.default} px-4 py-2 rounded-lg`}
                    />
                  </div>
                )}
                <button
                  onClick={handleTriggerEvent}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Trigger Event
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
