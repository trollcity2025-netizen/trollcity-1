import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Activity, AlertTriangle, CheckCircle, Video } from 'lucide-react';
import { format } from 'date-fns';

interface StreamSession {
  id: string;
  created_at: string;
  ended_at: string | null;
  broadcaster_id: string;
  title: string;
  broadcaster?: {
    username: string;
  };
}

export default function LiveKitUsageTab() {
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [launchUsageMinutes, setLaunchUsageMinutes] = useState(0);
  const [participantSnapshot, setParticipantSnapshot] = useState<{
    snapshot_at: string;
    total_participants: number;
    total_live_streams: number;
  } | null>(null);
  
  // Configurable quota (could be moved to system settings later)
  const MONTHLY_QUOTA_MINUTES = 10000; // Example: 10,000 minutes (~166 hours)
  const LAUNCH_QUOTA_MINUTES = 5000;
  const LAUNCH_BUFFER_LIMIT = 4700;
  
  useEffect(() => {
    fetchUsage();
    fetchLaunchUsage();
    fetchParticipantSnapshot();

    const interval = setInterval(() => {
      fetchLaunchUsage();
      fetchParticipantSnapshot();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch streams starting from beginning of month
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          created_at,
          ended_at,
          broadcaster_id,
          title,
          broadcaster:user_profiles!broadcaster_id(username)
        `)
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sessions: StreamSession[] = (data || []).map(s => ({
        ...s,
        broadcaster: s.broadcaster as any
      }));

      setStreams(sessions);

      // Calculate total duration
      let totalMs = 0;
      const now = new Date().getTime();

      sessions.forEach(s => {
        const start = new Date(s.created_at).getTime();
        const end = s.ended_at ? new Date(s.ended_at).getTime() : now; // If live, count until now
        const duration = Math.max(0, end - start);
        totalMs += duration;
      });

      setTotalMinutes(Math.floor(totalMs / 1000 / 60));

    } catch (err) {
      console.error('Error fetching LiveKit usage:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaunchUsage = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase.rpc('get_launch_usage_snapshot', {
      p_since: startOfDay.toISOString()
    });

    if (!error) {
      const rawMinutes = Array.isArray(data) ? data[0]?.minutes_used : data?.minutes_used ?? data;
      setLaunchUsageMinutes(Number(rawMinutes || 0));
    }
  };

  const fetchParticipantSnapshot = async () => {
    const { data, error } = await supabase.rpc('get_livekit_participant_snapshot', { p_log: true });
    if (error) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setParticipantSnapshot(row as any);
    }
  };

  const usagePercent = Math.min(100, (totalMinutes / MONTHLY_QUOTA_MINUTES) * 100);
  const isOverQuota = totalMinutes > MONTHLY_QUOTA_MINUTES;
  const overage = Math.max(0, totalMinutes - MONTHLY_QUOTA_MINUTES);

  const launchRemaining = Math.max(0, LAUNCH_QUOTA_MINUTES - launchUsageMinutes);
  const launchRemainingWithBuffer = Math.max(0, LAUNCH_BUFFER_LIMIT - launchUsageMinutes);
  const launchUsagePercent = Math.min(100, (launchUsageMinutes / LAUNCH_QUOTA_MINUTES) * 100);
  const launchComplete = launchUsageMinutes >= LAUNCH_BUFFER_LIMIT;
  const participantWarning = (participantSnapshot?.total_participants || 0) >= 95;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-purple-400" />
          LiveKit Broadcast Usage
        </h2>
        <div className="text-sm text-gray-400">
          Current Month: {format(new Date(), 'MMMM yyyy')}
        </div>
      </div>

      {/* Launch Session Usage */}
      <div className="bg-zinc-900 p-6 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white font-semibold">Launch Session (5,000 minutes)</div>
          <div className={`text-xs font-bold ${launchComplete ? 'text-red-400' : 'text-emerald-400'}`}>
            {launchComplete ? 'LOCKED' : 'ACTIVE'}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Minutes Used</div>
            <div className="text-2xl font-bold text-white">{launchUsageMinutes.toLocaleString()}</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Remaining</div>
            <div className="text-2xl font-bold text-emerald-300">{launchRemaining.toLocaleString()}</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Buffer Remaining</div>
            <div className={`text-2xl font-bold ${launchRemainingWithBuffer === 0 ? 'text-red-300' : 'text-yellow-300'}`}>
              {launchRemainingWithBuffer.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${launchComplete ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${launchUsagePercent}%` }}
          />
        </div>
        {launchComplete && (
          <div className="mt-4 flex items-start gap-3 text-sm text-red-300 bg-red-900/20 p-4 rounded-lg border border-red-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Launch phase complete — next upgrade unlocking soon.</p>
              <p className="opacity-80">New broadcasts are disabled to protect the 5,000 minute cap.</p>
            </div>
          </div>
        )}
      </div>

      {/* Participant Monitor */}
      <div className="bg-zinc-900 p-6 rounded-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Concurrent Participants</div>
            <div className="text-3xl font-bold text-white">
              {participantSnapshot?.total_participants?.toLocaleString() || 0}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Live Streams: {participantSnapshot?.total_live_streams || 0}</div>
            <div>Snapshot: {participantSnapshot?.snapshot_at ? format(new Date(participantSnapshot.snapshot_at), 'HH:mm:ss') : '--'}</div>
          </div>
        </div>
        {participantWarning && (
          <div className="mt-4 flex items-start gap-3 text-sm text-yellow-300 bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Capacity warning</p>
              <p className="opacity-80">System is near the join limit. New viewers are being blocked.</p>
            </div>
          </div>
        )}
      </div>

      {/* Usage Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-6 rounded-xl border border-white/10">
          <div className="text-gray-400 text-sm mb-1">Total Broadcast Time</div>
          <div className="text-3xl font-bold text-white flex items-baseline gap-2">
            {totalMinutes.toLocaleString()} <span className="text-sm font-normal text-gray-500">min</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Across {streams.length} streams
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-white/10">
          <div className="text-gray-400 text-sm mb-1">Monthly Quota</div>
          <div className="text-3xl font-bold text-white flex items-baseline gap-2">
            {MONTHLY_QUOTA_MINUTES.toLocaleString()} <span className="text-sm font-normal text-gray-500">min</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {Math.floor(MONTHLY_QUOTA_MINUTES / 60)} hours limit
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${isOverQuota ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'}`}>
          <div className="text-gray-400 text-sm mb-1">Status</div>
          <div className={`text-3xl font-bold flex items-baseline gap-2 ${isOverQuota ? 'text-red-400' : 'text-green-400'}`}>
            {isOverQuota ? 'OVER QUOTA' : 'WITHIN LIMITS'}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {isOverQuota 
              ? `${overage.toLocaleString()} min overage (No restrictions applied)` 
              : `${(MONTHLY_QUOTA_MINUTES - totalMinutes).toLocaleString()} min remaining`
            }
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-zinc-900 p-6 rounded-xl border border-white/10">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Usage Progress</span>
          <span className={isOverQuota ? 'text-red-400' : 'text-purple-400'}>
            {usagePercent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${isOverQuota ? 'bg-red-500' : 'bg-purple-500'}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {isOverQuota && (
          <div className="mt-4 flex items-start gap-3 text-sm text-yellow-400 bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Quota Exceeded</p>
              <p className="opacity-80">
                You have exceeded the monthly broadcast quota. Per your settings, streams will <strong>NOT</strong> be restricted. 
                Please monitor usage to avoid excess overage charges from LiveKit.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Streams List */}
      <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-gray-400" />
            Recent Broadcasts
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="bg-white/5 text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Broadcaster</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center">Loading stream data...</td></tr>
              ) : streams.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center">No streams found this month</td></tr>
              ) : (
                streams.slice(0, 10).map((stream) => {
                  const start = new Date(stream.created_at);
                  const end = stream.ended_at ? new Date(stream.ended_at) : null;
                  const durationMs = (end ? end.getTime() : new Date().getTime()) - start.getTime();
                  const durationMin = Math.floor(durationMs / 1000 / 60);

                  return (
                    <tr key={stream.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">
                        {stream.broadcaster?.username || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 truncate max-w-xs" title={stream.title}>
                        {stream.title || 'Untitled Stream'}
                      </td>
                      <td className="px-6 py-4">
                        {format(start, 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4 font-mono text-purple-300">
                        {durationMin} min
                      </td>
                      <td className="px-6 py-4">
                        {stream.ended_at ? (
                          <span className="flex items-center gap-1 text-gray-500">
                            <CheckCircle className="w-3 h-3" /> Ended
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-400 animate-pulse">
                            <Video className="w-3 h-3" /> Live
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
