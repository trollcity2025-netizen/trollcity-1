import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Radio,
  Shield,
  Settings,
  Power,
  MessageSquare,
  DollarSign,
  Eye,
  Zap,
  Server,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Lock,
  Unlock,
  StopCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';

interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  responseTime?: number;
  error?: string;
}

interface LiveActivity {
  activeStreams: number;
  activeCourtSessions: number;
  onlineOfficers: number;
  totalUsers: number;
  pendingApplications: number;
  pendingPayouts: number;
}

interface EventLog {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  created_at: string;
  user?: { username: string };
}

interface SystemSetting {
  setting_key: string;
  setting_value: any;
  description: string;
  is_emergency_control: boolean;
}

export default function CityControlCenter() {
  const { profile } = useAuthStore();
  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([]);
  const [liveActivity, setLiveActivity] = useState<LiveActivity>({
    activeStreams: 0,
    activeCourtSessions: 0,
    onlineOfficers: 0,
    totalUsers: 0,
    pendingApplications: 0,
    pendingPayouts: 0
  });
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadSystemHealth(),
        loadLiveActivity(),
        loadEventLogs(),
        loadSystemSettings()
      ]);
    } catch (error) {
      console.error('Error loading control center data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSystemHealth = async () => {
    try {
      // Test services and update health status
      const services = ['paypal', 'supabase', 'livekit', 'database', 'api'];
      const healthChecks = await Promise.allSettled(
        services.map(async (service) => {
          const startTime = Date.now();
          try {
            let status: 'healthy' | 'degraded' | 'down' = 'healthy';
            let error: string | undefined;

            switch (service) {
              case 'supabase': {
                const { error: dbError } = await supabase.from('user_profiles').select('count').limit(1);
                if (dbError) {
                  status = 'down';
                  error = dbError.message;
                }
                break;
              }
              case 'paypal': {
                // Test PayPal connectivity
                const paypalResponse = await fetch('/api/paypal/test', { method: 'GET' });
                if (!paypalResponse.ok) {
                  status = 'degraded';
                  error = 'PayPal service check failed';
                }
                break;
              }
              case 'livekit': {
                // Test LiveKit connectivity
                const livekitResponse = await fetch('/api/livekit/test', { method: 'GET' });
                if (!livekitResponse.ok) {
                  status = 'degraded';
                  error = 'LiveKit service check failed';
                }
                break;
              }
              case 'api': {
                // Test general API health
                const apiResponse = await fetch('/api/health', { method: 'GET' });
                if (!apiResponse.ok) {
                  status = 'down';
                  error = 'API health check failed';
                }
                break;
              }
            }

            const responseTime = Date.now() - startTime;

            // Update system_health table
            await supabase.rpc('update_system_health', {
              p_service_name: service,
              p_status: status,
              p_response_time_ms: responseTime,
              p_error_message: error
            });

            return {
              service,
              status,
              lastCheck: new Date().toISOString(),
              responseTime,
              error
            };
          } catch (err: any) {
            return {
              service,
              status: 'down' as const,
              lastCheck: new Date().toISOString(),
              responseTime: Date.now() - startTime,
              error: err.message
            };
          }
        })
      );

      const healthData = healthChecks.map(result =>
        result.status === 'fulfilled' ? result.value : {
          service: 'unknown',
          status: 'down' as const,
          lastCheck: new Date().toISOString(),
          error: 'Health check failed'
        }
      );

      setSystemHealth(healthData);
    } catch (error) {
      console.error('Error loading system health:', error);
    }
  };

  const loadLiveActivity = async () => {
    try {
      const [
        streamsResult,
        courtResult,
        officersResult,
        usersResult,
        appsResult,
        payoutsResult
      ] = await Promise.all([
        supabase.from('streams').select('id').eq('is_live', true),
        supabase.from('court_sessions').select('id').eq('status', 'active'),
        supabase.from('user_profiles').select('id').eq('is_officer_active', true),
        supabase.from('user_profiles').select('id'),
        supabase.from('applications').select('id').eq('status', 'pending'),
        supabase.from('payout_requests').select('id').eq('status', 'pending')
      ]);

      setLiveActivity({
        activeStreams: streamsResult.data?.length || 0,
        activeCourtSessions: courtResult.data?.length || 0,
        onlineOfficers: officersResult.data?.length || 0,
        totalUsers: usersResult.data?.length || 0,
        pendingApplications: appsResult.data?.length || 0,
        pendingPayouts: payoutsResult.data?.length || 0
      });
    } catch (error) {
      console.error('Error loading live activity:', error);
    }
  };

  const loadEventLogs = async () => {
    try {
      const { data } = await supabase
        .from('event_log')
        .select(`
          *,
          user:user_profiles(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      setEventLogs(data || []);
    } catch (error) {
      console.error('Error loading event logs:', error);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .order('setting_key');

      setSystemSettings(data || []);
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const toggleSystemSetting = async (settingKey: string, currentValue: any) => {
    try {
      const newValue = { ...currentValue };
      if (newValue.enabled !== undefined) {
        newValue.enabled = !newValue.enabled;
      } else if (newValue.active !== undefined) {
        newValue.active = !newValue.active;
      }

      await supabase.rpc('update_system_setting', {
        p_setting_key: settingKey,
        p_setting_value: newValue,
        p_admin_id: profile?.id
      });

      await loadSystemSettings();

      // Log the action
      await supabase.rpc('log_system_event', {
        p_event_type: 'system',
        p_event_subtype: 'control_toggle',
        p_severity: 'warning',
        p_title: `System control toggled: ${settingKey}`,
        p_description: `${settingKey} ${newValue.enabled !== undefined ? (newValue.enabled ? 'enabled' : 'disabled') : (newValue.active ? 'activated' : 'deactivated')}`,
        p_metadata: { setting_key: settingKey, new_value: newValue },
        p_user_id: profile?.id
      });

    } catch (error) {
      console.error('Error toggling system setting:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'down': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-900/20';
      case 'error': return 'border-l-red-400 bg-red-900/10';
      case 'warning': return 'border-l-yellow-400 bg-yellow-900/10';
      default: return 'border-l-blue-400 bg-blue-900/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading City Control Center...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">City Control Center</h1>
                <p className="text-gray-400">Global system monitoring and emergency controls</p>
              </div>
            </div>
            <button
              onClick={loadAllData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* System Health */}
          <div className="bg-zinc-900/50 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemHealth.map((health) => (
                <div key={health.service} className="bg-zinc-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold capitalize">{health.service}</span>
                    {getStatusIcon(health.status)}
                  </div>
                  <div className={`text-sm ${getStatusColor(health.status)}`}>
                    Status: {health.status}
                  </div>
                  {health.responseTime && (
                    <div className="text-xs text-gray-400">
                      Response: {health.responseTime}ms
                    </div>
                  )}
                  {health.error && (
                    <div className="text-xs text-red-400 mt-1">
                      Error: {health.error}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Last check: {new Date(health.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity */}
          <div className="bg-zinc-900/50 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5" />
              Live Activity
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <Play className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-pink-400">{liveActivity.activeStreams}</div>
                <div className="text-sm text-gray-400">Active Streams</div>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400">{liveActivity.activeCourtSessions}</div>
                <div className="text-sm text-gray-400">Court Sessions</div>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <Users className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{liveActivity.onlineOfficers}</div>
                <div className="text-sm text-gray-400">Online Officers</div>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-400">{liveActivity.totalUsers}</div>
                <div className="text-sm text-gray-400">Total Users</div>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <FileText className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-400">{liveActivity.pendingApplications}</div>
                <div className="text-sm text-gray-400">Pending Apps</div>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg text-center">
                <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">{liveActivity.pendingPayouts}</div>
                <div className="text-sm text-gray-400">Pending Payouts</div>
              </div>
            </div>
          </div>

          {/* Emergency Controls */}
          <div className="bg-zinc-900/50 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Emergency Controls
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemSettings.filter(s => s.is_emergency_control).map((setting) => (
                <div key={setting.setting_key} className="bg-zinc-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{setting.setting_key.replace(/_/g, ' ')}</span>
                    <button
                      onClick={() => toggleSystemSetting(setting.setting_key, setting.setting_value)}
                      className={`p-1 rounded ${
                        (setting.setting_value?.enabled || setting.setting_value?.active)
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {(setting.setting_value?.enabled || setting.setting_value?.active) ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{setting.description}</p>
                  <div className={`text-sm ${
                    (setting.setting_value?.enabled || setting.setting_value?.active)
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {(setting.setting_value?.enabled || setting.setting_value?.active) ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Timeline */}
          <div className="bg-zinc-900/50 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Event Timeline
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {eventLogs.map((event) => (
                <div key={event.id} className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(event.severity)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{event.title}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-300 mb-1">{event.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="px-2 py-1 bg-gray-700 rounded capitalize">{event.event_type}</span>
                    {event.user?.username && (
                      <span>by {event.user.username}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}