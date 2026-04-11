import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { usePresenceStore } from '@/lib/presenceStore';
import { toast } from 'sonner';
import {
  X, Users, Clock, Radio, RefreshCw, Monitor, TrendingUp,
  UserCheck, UserPlus, Search, Ban, VolumeX, Gavel, Coins,
  ShieldAlert, AlertTriangle, ChevronRight, Play, LogOut, ExternalLink
} from 'lucide-react';

interface LiveStream {
  id: string;
  broadcaster_id: string;
  user_id: string;
  title: string;
  is_live: boolean;
  status: string;
  started_at: string | null;
}

interface RTSSession {
  id: string;
  user_id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_active: boolean;
}

interface StreamDetail {
  id: string;
  title: string;
  startedAt: string;
  viewers: number;
  duration: number; // in seconds
  isLive: boolean;
  broadcasterId: string;
  userId: string;
}

interface StreamViewer {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface RTCStats {
  totalMinutes: number;
  activeSessions: number;
  liveStreams: number;
  liveStreamDetails: StreamDetail[];
  totalUsers: number;
}

interface UserListItem {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  last_seen_at?: string;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function RTCAdminMonitor() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const staffRoles = ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary'];
  const isStaff = profile?.is_admin === true || staffRoles.includes(profile?.role || '');
  const isFullAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const onlineCount = usePresenceStore(state => state.onlineCount);
  
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<RTCStats>({
    totalMinutes: 0,
    activeSessions: 0,
    liveStreams: 0,
    liveStreamDetails: [],
    totalUsers: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const [userListType, setUserListType] = useState<'online' | 'all' | null>(null);
  const [userList, setUserList] = useState<UserListItem[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [actionTarget, setActionTarget] = useState<UserListItem | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDuration, setActionDuration] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<StreamDetail | null>(null);
  const [streamViewers, setStreamViewers] = useState<StreamViewer[]>([]);
  const [streamModalLoading, setStreamModalLoading] = useState(false);
  const [streamAction, setStreamAction] = useState<string | null>(null);
  const [streamActionReason, setStreamActionReason] = useState('');
  const [streamActionLoading, setStreamActionLoading] = useState(false);

  const fetchRTCStats = useCallback(async () => {
    if (!isStaff) return;
    
    setIsLoading(true);
    try {
      // Get all streams with is_live = true OR status = 'live' to catch all active streams
      const { data: streams, error: streamsError } = await supabase
        .from('streams')
        .select('id, broadcaster_id, user_id, title, is_live, status, started_at')
        .or('is_live.eq.true,status.eq.live')
        .order('started_at', { ascending: false });

      if (streamsError) {
        console.error('[RTC Monitor] Error fetching streams:', streamsError);
        setIsLoading(false);
        return;
      }

      const liveStreams = (streams as LiveStream[]) || [];
      const currentTime = Date.now();
      
      // Get viewer counts for each stream
      const streamDetails = await Promise.all(
        liveStreams.slice(0, 10).map(async (stream) => {
          // Count viewers from stream_seat_sessions table
          const { count } = await supabase
            .from('stream_seat_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('stream_id', stream.id)
            .eq('status', 'active');

          const startedAt = stream.started_at ? new Date(stream.started_at).getTime() : currentTime;
          const durationSeconds = Math.floor((currentTime - startedAt) / 1000);

          return {
            id: stream.id,
            title: stream.title || 'Untitled',
            startedAt: stream.started_at || new Date().toISOString(),
            viewers: count || 0,
            duration: durationSeconds,
            isLive: stream.is_live || stream.status === 'live',
            broadcasterId: stream.broadcaster_id,
            userId: stream.user_id
          };
        })
      );

      // Filter to only truly live streams (either is_live is true or started within last hour)
      const activeStreams = streamDetails.filter(s => {
        const hourAgo = Date.now() - (60 * 60 * 1000);
        const streamStartTime = new Date(s.startedAt).getTime();
        return s.isLive || streamStartTime > hourAgo;
      });

      // Get all RTC sessions for total stats
      const { data: sessions, error: sessionsError } = await supabase
        .from('rtc_sessions')
        .select('id, user_id, room_name, started_at, ended_at, duration_seconds, is_active');

      if (sessionsError) {
        console.error('[RTC Monitor] Error fetching sessions:', sessionsError);
      }

      const rtcSessions = sessions as RTSSession[] || [];
      const now = Date.now();
      const totalSeconds = rtcSessions.reduce((sum, s) => {
        if (s.is_active && s.started_at) {
          const startedAt = new Date(s.started_at).getTime();
          const liveDuration = Math.floor((now - startedAt) / 1000);
          return sum + liveDuration;
        }
        return sum + (s.duration_seconds || 0);
      }, 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const activeCount = rtcSessions.filter(s => s.is_active).length;

      // Get total registered users count
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true });

      setStats({
        totalMinutes,
        activeSessions: activeCount,
        liveStreams: activeStreams.length,
        liveStreamDetails: activeStreams,
        totalUsers: totalUsers || 0
      });

      setLastRefresh(new Date());
      setNow(Date.now());
    } catch (err) {
      console.error('[RTC Monitor] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isStaff]);

  const openUserList = useCallback(async (type: 'online' | 'all') => {
    setUserListType(type);
    setUserList([]);
    setUserSearch('');
    setUserListLoading(true);
    try {
      if (type === 'online') {
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
        const { data } = await supabase
          .from('user_presence')
          .select('user_id, last_seen_at, user_profiles!inner(id, username, avatar_url, role)')
          .gt('last_seen_at', twoMinutesAgo)
          .order('last_seen_at', { ascending: false })
          .limit(200);
        if (data) {
          setUserList(data.map((row: any) => ({
            id: row.user_profiles.id,
            username: row.user_profiles.username,
            avatar_url: row.user_profiles.avatar_url,
            role: row.user_profiles.role,
            last_seen_at: row.last_seen_at
          })));
        }
      } else {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, role')
          .order('created_at', { ascending: false })
          .limit(200);
        if (data) {
          setUserList(data as UserListItem[]);
        }
      }
    } catch (err) {
      console.error('[RTC Monitor] Error fetching user list:', err);
    } finally {
      setUserListLoading(false);
    }
  }, []);

  const closeUserList = useCallback(() => {
    setUserListType(null);
    setUserList([]);
    setUserSearch('');
    setActionTarget(null);
    setActiveAction(null);
  }, []);

  const openAction = useCallback((user: UserListItem, action: string) => {
    setActionTarget(user);
    setActiveAction(action);
    setActionReason('');
    setActionDuration('');
    setActionAmount('');
  }, []);

  const closeAction = useCallback(() => {
    setActiveAction(null);
    setActionReason('');
    setActionDuration('');
    setActionAmount('');
  }, []);

  const executeAction = useCallback(async () => {
    if (!actionTarget || !activeAction) return;
    setActionLoading(true);
    try {
      switch (activeAction) {
        case 'ban': {
          const minutes = actionDuration ? parseInt(actionDuration) * 1440 : 525600; // default 1 year
          const { error } = await supabase.rpc('ban_user', {
            target: actionTarget.id,
            minutes,
            reason: actionReason || 'Admin ban via RTC Monitor',
            acting_admin_id: profile?.id
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} banned`);
          break;
        }
        case 'unban': {
          const { error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'unban_user_action', userId: actionTarget.id }
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} unbanned`);
          break;
        }
        case 'mute': {
          const minutes = actionDuration ? parseInt(actionDuration) : 60;
          const { error } = await supabase.rpc('mute_user', {
            target: actionTarget.id,
            minutes,
            reason: actionReason || 'Admin mute via RTC Monitor'
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} muted for ${minutes}m`);
          break;
        }
        case 'unmute': {
          const { error } = await supabase.rpc('mute_user', {
            target: actionTarget.id,
            minutes: 0,
            reason: 'Admin unmute via RTC Monitor'
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} unmuted`);
          break;
        }
        case 'kick': {
          const { error } = await supabase.rpc('ban_user', {
            target: actionTarget.id,
            minutes: 10,
            reason: actionReason || 'Admin kick (10min ban) via RTC Monitor',
            acting_admin_id: profile?.id
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} kicked (10min ban)`);
          break;
        }
        case 'warn': {
          const { error } = await supabase
            .from('notifications')
            .insert({
              user_id: actionTarget.id,
              type: 'moderation_alert',
              title: 'Warning from Admin',
              message: actionReason || 'You have received a warning from an admin.',
              metadata: { action_url: '/profile' }
            });
          if (error) throw error;
          toast.success(`@${actionTarget.username} warned`);
          break;
        }
        case 'deduct': {
          const amount = actionAmount ? parseInt(actionAmount) : 0;
          if (amount <= 0) { toast.error('Enter a valid amount'); return; }
          const { error } = await supabase.rpc('troll_bank_spend_coins_secure', {
            p_user_id: actionTarget.id,
            p_amount: amount,
            p_bucket: 'admin_deduct',
            p_source: 'admin_deduct',
            p_ref_id: null,
            p_metadata: { reason: actionReason || 'Admin deduction via RTC Monitor' }
          });
          if (error) throw error;
          toast.success(`Deducted ${amount.toLocaleString()} coins from @${actionTarget.username}`);
          break;
        }
        case 'grant': {
          const amount = actionAmount ? parseInt(actionAmount) : 0;
          if (amount <= 0) { toast.error('Enter a valid amount'); return; }
          const { error } = await supabase.rpc('admin_grant_coins', {
            p_user_id: actionTarget.id,
            p_amount: amount,
            p_reason: actionReason || 'Admin grant via RTC Monitor'
          });
          if (error) throw error;
          toast.success(`Granted ${amount.toLocaleString()} coins to @${actionTarget.username}`);
          break;
        }
        case 'summon': {
          const { error } = await supabase.rpc('summon_user_to_court', {
            p_defendant_id: actionTarget.id,
            p_reason: actionReason || 'Summoned by admin via RTC Monitor',
            p_users_involved: [],
            p_docket_id: null
          });
          if (error) throw error;
          toast.success(`@${actionTarget.username} summoned to court`);
          break;
        }
      }
      closeAction();
    } catch (err: any) {
      console.error('[RTC Monitor] Action error:', err);
      toast.error(err?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }, [actionTarget, activeAction, actionReason, actionDuration, actionAmount, profile?.id, closeAction]);

  const openStreamModal = useCallback(async (stream: StreamDetail) => {
    setSelectedStream(stream);
    setStreamAction(null);
    setStreamActionReason('');
    setStreamModalLoading(true);
    try {
      const { data } = await supabase
        .from('stream_seat_sessions')
        .select('user_id, user_profiles!inner(id, username, avatar_url)')
        .eq('stream_id', stream.id)
        .eq('status', 'active')
        .limit(100);
      if (data) {
        setStreamViewers(data.map((row: any) => ({
          user_id: row.user_id,
          username: row.user_profiles.username,
          avatar_url: row.user_profiles.avatar_url
        })));
      }
    } catch (err) {
      console.error('[RTC Monitor] Error fetching stream viewers:', err);
    } finally {
      setStreamModalLoading(false);
    }
  }, []);

  const closeStreamModal = useCallback(() => {
    setSelectedStream(null);
    setStreamViewers([]);
    setStreamAction(null);
    setStreamActionReason('');
  }, []);

  const endStream = useCallback(async () => {
    if (!selectedStream) return;
    setStreamActionLoading(true);
    try {
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false, status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', selectedStream.id);
      if (error) throw error;
      toast.success('Stream ended');
      closeStreamModal();
      fetchRTCStats();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to end stream');
    } finally {
      setStreamActionLoading(false);
    }
  }, [selectedStream, closeStreamModal, fetchRTCStats]);

  const kickUserFromStream = useCallback(async (userId: string, username: string) => {
    if (!selectedStream) return;
    try {
      const { error } = await supabase.rpc('ban_user', {
        target: userId,
        minutes: 30,
        reason: streamActionReason || 'Kicked from stream via RTC Monitor',
        acting_admin_id: profile?.id
      });
      if (error) throw error;
      setStreamViewers(prev => prev.filter(v => v.user_id !== userId));
      toast.success(`@${username} kicked (30min ban)`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to kick user');
    }
  }, [selectedStream, streamActionReason, profile?.id]);

  const summonFromStream = useCallback(async (userId: string, username: string) => {
    try {
      const { error } = await supabase.rpc('summon_user_to_court', {
        p_defendant_id: userId,
        p_reason: streamActionReason || 'Summoned from stream via RTC Monitor',
        p_users_involved: [],
        p_docket_id: null
      });
      if (error) throw error;
      toast.success(`@${username} summoned to court`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to summon user');
    }
  }, [streamActionReason]);

  // Update timer every second for live durations
  useEffect(() => {
    if (isOpen && isStaff) {
      timerRef.current = window.setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, isStaff]);

  useEffect(() => {
    if (!isStaff) return;

    fetchRTCStats();
    const statsInterval = setInterval(fetchRTCStats, 10000);
    
    return () => clearInterval(statsInterval);
  }, [isStaff, fetchRTCStats]);

  if (!isStaff) return null;

  // Calculate durations with current time
  const streamDetailsWithDuration = stats.liveStreamDetails.map(stream => {
    const startedAt = stream.startedAt ? new Date(stream.startedAt).getTime() : now;
    const durationSeconds = Math.floor((now - startedAt) / 1000);
    return {
      ...stream,
      duration: durationSeconds
    };
  });

  const totalViewers = streamDetailsWithDuration.reduce((sum, s) => sum + s.viewers, 0);
  
  // Calculate total minutes in real-time from all active streams
  const totalMinutes = Math.floor(
    streamDetailsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / 60
  );

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{
          backgroundColor: stats.liveStreams > 0 ? '#22c55e' : '#3b82f6',
          boxShadow: `0 4px 20px ${stats.liveStreams > 0 ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.4)'}`
        }}
        title={`RTC Monitor - ${stats.liveStreams} live streams`}
      >
        <Monitor className="w-6 h-6 text-white" />
      </button>

      {/* Admin Popup Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[320px] bg-[#111] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-white text-sm">RTC Monitor</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Refresh Button */}
            <button
              onClick={() => { setNow(Date.now()); fetchRTCStats(); }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-blue-400 text-xs transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Stats Grid */}
            <div className={`grid gap-2 ${isFullAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {/* Live Streams */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-red-400 uppercase">Streams</span>
                </div>
                <div className="text-xl font-bold text-white">{stats.liveStreams}</div>
              </div>

              {/* Total Viewers */}
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] text-cyan-400 uppercase">Viewers</span>
                </div>
                <div className="text-xl font-bold text-white">{totalViewers}</div>
              </div>

              {/* Active Sessions - Admin only */}
              {isFullAdmin && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] text-yellow-400 uppercase">Sessions</span>
                  </div>
                  <div className="text-xl font-bold text-white">{stats.activeSessions}</div>
                </div>
              )}

              {/* Total RTC Usage - Admin only */}
              {isFullAdmin && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-purple-400 uppercase">Total Min</span>
                  </div>
                  <div className="text-xl font-bold text-white">{totalMinutes.toLocaleString()}</div>
                </div>
              )}

              {/* Current Users (Online) */}
              <div
                onClick={() => openUserList('online')}
                className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 cursor-pointer hover:bg-green-500/20 hover:border-green-500/40 transition-all"
              >
                <div className="flex items-center gap-1 mb-1">
                  <UserCheck className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] text-green-400 uppercase">Online</span>
                </div>
                <div className="text-xl font-bold text-white">{onlineCount}</div>
              </div>

              {/* All Users (Total Registered) */}
              <div
                onClick={() => openUserList('all')}
                className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 cursor-pointer hover:bg-orange-500/20 hover:border-orange-500/40 transition-all"
              >
                <div className="flex items-center gap-1 mb-1">
                  <UserPlus className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] text-orange-400 uppercase">All Users</span>
                </div>
                <div className="text-xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
              </div>
            </div>

            {/* Live Stream List */}
            {streamDetailsWithDuration.length > 0 && (
              <div className="pt-3 border-t border-white/10">
                <span className="text-gray-500 text-xs">Active Streams</span>
                <div className="mt-2 space-y-1 max-h-[140px] overflow-y-auto">
                  {streamDetailsWithDuration.map((stream, idx) => (
                    <div
                      key={idx}
                      onClick={() => openStreamModal(stream)}
                      className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5 cursor-pointer hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-300 truncate max-w-[140px] group-hover:text-white" title={stream.title}>
                          {stream.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs">
                          <Users className="w-3 h-3 text-cyan-400" />
                          <span className="text-cyan-400">{stream.viewers}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(stream.duration)}</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Refresh */}
            <div className="text-center pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* User List Popup */}
      {userListType && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={closeUserList}
          />
          {/* Popup */}
          <div className="fixed bottom-20 right-6 z-[61] w-[360px] max-h-[70vh] bg-[#111] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 flex flex-col">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 ${
              userListType === 'online'
                ? 'bg-gradient-to-r from-green-900/50 to-emerald-900/50'
                : 'bg-gradient-to-r from-orange-900/50 to-amber-900/50'
            }`}>
              <div className="flex items-center gap-2">
                {userListType === 'online' ? (
                  <UserCheck className="w-4 h-4 text-green-400" />
                ) : (
                  <UserPlus className="w-4 h-4 text-orange-400" />
                )}
                <span className="font-bold text-white text-sm">
                  {userListType === 'online' ? 'Online Users' : 'All Users'}
                </span>
                <span className="text-xs text-gray-400">({userList.length})</span>
              </div>
              <button
                onClick={closeUserList}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-white/5">
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                <Search className="w-3 h-3 text-gray-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search username..."
                  className="bg-transparent text-xs text-white placeholder-gray-500 outline-none flex-1"
                />
              </div>
            </div>

            {/* User List */}
            <div className="overflow-y-auto flex-1 p-2">
              {userListLoading ? (
                <div className="text-center py-8 text-gray-500 text-xs animate-pulse">
                  Loading users...
                </div>
              ) : userList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No users found
                </div>
              ) : (
                <div className="space-y-0.5">
                  {userList
                    .filter(u => !userSearch || u.username?.toLowerCase().includes(userSearch.toLowerCase()))
                    .map((user) => (
                      <div key={user.id}>
                        <div
                          onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5 transition-colors"
                        >
                          {/* Avatar */}
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                              <Users className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white truncate">
                              @{user.username || 'unknown'}
                            </div>
                          </div>
                          {/* Role badge */}
                          {user.role && user.role !== 'user' && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium ${
                              user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                              user.role === 'moderator' ? 'bg-blue-500/20 text-blue-400' :
                              user.role === 'troll_officer' ? 'bg-yellow-500/20 text-yellow-400' :
                              user.role === 'secretary' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {user.role.replace('_', ' ')}
                            </span>
                          )}
                          {/* Online indicator */}
                          {userListType === 'online' && (
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          )}
                          <ChevronRight className={`w-3 h-3 text-gray-500 shrink-0 transition-transform ${expandedUserId === user.id ? 'rotate-90' : ''}`} />
                        </div>

                        {/* Expanded Actions */}
                        {expandedUserId === user.id && (
                          <div className="ml-8 mr-2 mb-1 p-2 bg-white/5 rounded-lg space-y-2">
                            {activeAction && actionTarget?.id === user.id ? (
                              /* Action Form */
                              <div className="space-y-2">
                                <div className="text-[10px] text-gray-400 uppercase font-medium">
                                  {activeAction === 'ban' ? 'Ban User' :
                                   activeAction === 'unban' ? 'Unban User' :
                                   activeAction === 'mute' ? 'Mute User' :
                                   activeAction === 'unmute' ? 'Unmute User' :
                                   activeAction === 'kick' ? 'Kick User' :
                                   activeAction === 'warn' ? 'Warn User' :
                                   activeAction === 'deduct' ? 'Deduct Coins' :
                                   activeAction === 'grant' ? 'Grant Coins' :
                                   activeAction === 'summon' ? 'Summon to Court' : activeAction}
                                </div>

                                {(activeAction === 'ban' || activeAction === 'mute') && (
                                  <input
                                    type="number"
                                    value={actionDuration}
                                    onChange={(e) => setActionDuration(e.target.value)}
                                    placeholder={activeAction === 'ban' ? 'Duration (days, blank = 1yr)' : 'Duration (minutes, default 60)'}
                                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-white/30"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}

                                {(activeAction === 'deduct' || activeAction === 'grant') && (
                                  <input
                                    type="number"
                                    value={actionAmount}
                                    onChange={(e) => setActionAmount(e.target.value)}
                                    placeholder="Amount of coins"
                                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-white/30"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}

                                <input
                                  type="text"
                                  value={actionReason}
                                  onChange={(e) => setActionReason(e.target.value)}
                                  placeholder="Reason (optional)"
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-white/30"
                                  onClick={(e) => e.stopPropagation()}
                                />

                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); executeAction(); }}
                                    disabled={actionLoading}
                                    className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      activeAction === 'ban' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                      activeAction === 'mute' ? 'bg-yellow-600 hover:bg-yellow-500 text-white' :
                                      activeAction === 'kick' ? 'bg-orange-600 hover:bg-orange-500 text-white' :
                                      activeAction === 'warn' ? 'bg-amber-600 hover:bg-amber-500 text-white' :
                                      activeAction === 'deduct' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                      activeAction === 'grant' ? 'bg-green-600 hover:bg-green-500 text-white' :
                                      activeAction === 'unban' ? 'bg-green-600 hover:bg-green-500 text-white' :
                                      activeAction === 'unmute' ? 'bg-green-600 hover:bg-green-500 text-white' :
                                      'bg-blue-600 hover:bg-blue-500 text-white'
                                    } ${actionLoading ? 'opacity-50' : ''}`}
                                  >
                                    {actionLoading ? 'Executing...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); closeAction(); }}
                                    className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Action Buttons */
                              <div className="grid grid-cols-3 gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'ban'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                >
                                  <Ban className="w-3 h-3" /> Ban
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'mute'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
                                >
                                  <VolumeX className="w-3 h-3" /> Mute
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'kick'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                                >
                                  <ShieldAlert className="w-3 h-3" /> Kick
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'warn'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                                >
                                  <AlertTriangle className="w-3 h-3" /> Warn
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'deduct'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                >
                                  <Coins className="w-3 h-3" /> Deduct
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'grant'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                                >
                                  <Coins className="w-3 h-3" /> Grant
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'unban'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-green-300 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                                >
                                  <Ban className="w-3 h-3 rotate-180" /> Unban
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'unmute'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-green-300 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                                >
                                  <VolumeX className="w-3 h-3 rotate-180" /> Unmute
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAction(user, 'summon'); }}
                                  className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                                >
                                  <Gavel className="w-3 h-3" /> Court
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center py-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">
                Showing {Math.min(userList.length, 200)} {userListType === 'online' ? 'online' : 'registered'} users
              </span>
            </div>
          </div>
        </>
      )}

      {/* Stream Action Modal */}
      {selectedStream && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={closeStreamModal}
          />
          {/* Modal */}
          <div className="fixed bottom-20 right-6 z-[61] w-[360px] max-h-[70vh] bg-[#111] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-900/50 to-orange-900/50 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-red-400" />
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate max-w-[220px]" title={selectedStream.title}>
                    {selectedStream.title}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {selectedStream.viewers} viewers · {formatDuration(selectedStream.duration)}
                  </div>
                </div>
              </div>
              <button
                onClick={closeStreamModal}
                className="text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {/* Quick Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => navigate(`/live/${selectedStream.id}`)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Go to Stream
                </button>
                <button
                  onClick={endStream}
                  disabled={streamActionLoading}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors ${streamActionLoading ? 'opacity-50' : ''}`}
                >
                  <LogOut className="w-3 h-3" /> {streamActionLoading ? 'Ending...' : 'End Stream'}
                </button>
              </div>

              {/* Reason input for kick/summon */}
              <input
                type="text"
                value={streamActionReason}
                onChange={(e) => setStreamActionReason(e.target.value)}
                placeholder="Reason for kick/summon (optional)"
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-white/30"
              />

              {/* Viewers List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-xs">Stream Viewers ({streamViewers.length})</span>
                </div>
                {streamModalLoading ? (
                  <div className="text-center py-6 text-gray-500 text-xs animate-pulse">
                    Loading viewers...
                  </div>
                ) : streamViewers.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No viewers found
                  </div>
                ) : (
                  <div className="space-y-0.5 max-h-[250px] overflow-y-auto">
                    {streamViewers.map((viewer) => (
                      <div
                        key={viewer.user_id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                      >
                        {/* Avatar */}
                        {viewer.avatar_url ? (
                          <img
                            src={viewer.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                            <Users className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        {/* Username */}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">
                            @{viewer.username || 'unknown'}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => kickUserFromStream(viewer.user_id, viewer.username)}
                            className="px-1.5 py-0.5 rounded text-[9px] text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
                            title="Kick (30min ban)"
                          >
                            <ShieldAlert className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => summonFromStream(viewer.user_id, viewer.username)}
                            className="px-1.5 py-0.5 rounded text-[9px] text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                            title="Summon to Court"
                          >
                            <Gavel className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center py-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">
                Click viewer icons to kick or summon
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
