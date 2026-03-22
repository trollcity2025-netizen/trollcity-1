import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { X, Users, Clock, Radio, RefreshCw, Monitor, TrendingUp } from 'lucide-react';

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

interface RTCStats {
  totalMinutes: number;
  activeSessions: number;
  liveStreams: number;
  liveStreamDetails: { id: string; title: string; startedAt: string; viewers: number }[];
}

export default function RTCAdminMonitor() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<RTCStats>({
    totalMinutes: 0,
    activeSessions: 0,
    liveStreams: 0,
    liveStreamDetails: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchRTCStats = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      // Get all live streams with more details
      const { data: streams, error: streamsError } = await supabase
        .from('streams')
        .select('id, broadcaster_id, user_id, title, is_live, status, started_at')
        .eq('is_live', true)
        .order('started_at', { ascending: false });

      if (streamsError) {
        console.error('[RTC Monitor] Error fetching streams:', streamsError);
        setIsLoading(false);
        return;
      }

      const liveStreams = (streams as LiveStream[]) || [];
      
      // Get viewer counts for each stream
      const streamDetails = await Promise.all(
        liveStreams.slice(0, 10).map(async (stream) => {
          const { count } = await supabase
            .from('stream_seats')
            .select('id', { count: 'exact', head: true })
            .eq('stream_id', stream.id);

          return {
            id: stream.id.slice(0, 8),
            title: stream.title?.slice(0, 20) || 'Untitled',
            startedAt: stream.started_at || new Date().toISOString(),
            viewers: count || 0
          };
        })
      );

      // Get all RTC sessions for total stats
      const { data: sessions, error: sessionsError } = await supabase
        .from('rtc_sessions')
        .select('id, user_id, room_name, started_at, ended_at, duration_seconds, is_active');

      if (sessionsError) {
        console.error('[RTC Monitor] Error fetching sessions:', sessionsError);
      }

      const rtcSessions = sessions as RTSSession[] || [];
      const totalSeconds = rtcSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const activeCount = rtcSessions.filter(s => s.is_active).length;

      setStats({
        totalMinutes,
        activeSessions: activeCount,
        liveStreams: liveStreams.length,
        liveStreamDetails: streamDetails
      });

      setLastRefresh(new Date());
    } catch (err) {
      console.error('[RTC Monitor] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    fetchRTCStats();
    const statsInterval = setInterval(fetchRTCStats, 10000);
    
    return () => clearInterval(statsInterval);
  }, [isAdmin, fetchRTCStats]);

  if (!isAdmin) return null;

  const totalViewers = stats.liveStreamDetails.reduce((sum, s) => sum + s.viewers, 0);

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
              onClick={fetchRTCStats}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-blue-400 text-xs transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Live Streams */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-red-400 uppercase">Live Streams</span>
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

              {/* Active Sessions */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] text-yellow-400 uppercase">Active Sessions</span>
                </div>
                <div className="text-xl font-bold text-white">{stats.activeSessions}</div>
              </div>

              {/* Total RTC Usage */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-purple-400 uppercase">Total Min</span>
                </div>
                <div className="text-xl font-bold text-white">{stats.totalMinutes.toLocaleString()}</div>
              </div>
            </div>

            {/* Live Stream List */}
            {stats.liveStreamDetails.length > 0 && (
              <div className="pt-3 border-t border-white/10">
                <span className="text-gray-500 text-xs">Active Streams</span>
                <div className="mt-2 space-y-1 max-h-[140px] overflow-y-auto">
                  {stats.liveStreamDetails.map((stream, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-300 truncate max-w-[140px]" title={stream.title}>
                          {stream.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400">{stream.viewers}</span>
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
    </>
  );
}
