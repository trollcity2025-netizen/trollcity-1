/**
 * Troll City Officer Dashboard - Safety Alerts Panel
 * 
 * This component displays safety alerts for officers to review and take action on.
 * Only accessible to users with officer, moderator, or admin roles.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { 
  SafetyAlertWithDetails, 
  SafetyAction, 
  SafetyTriggerType,
  AlertLevel,
  AlertStats 
} from '@/types/safety';
import { SAFETY_ACTIONS } from '@/types/safety';
import { supabase } from '@/lib/supabase';
import { 
  AlertTriangle, 
  Eye, 
  CheckCircle, 
  User,
  Video,
  Shield,
  Gavel,
  Lock,
  Search,
  Filter,
  RefreshCw,
  StopCircle
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface SafetyAlertsPanelProps {
  officerId: string;
  officerRole: string;
}

interface AlertActionModalProps {
  alert: SafetyAlertWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (alertId: string, action: SafetyAction, notes?: string) => void;
}

// ============================================================
// ALERT ACTION MODAL
// ============================================================

const AlertActionModal: React.FC<AlertActionModalProps> = ({ 
  alert, 
  isOpen, 
  onClose, 
  onAction 
}) => {
  const [selectedAction, setSelectedAction] = useState<SafetyAction | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !alert) return null;

  const handleSubmit = async () => {
    if (!selectedAction) return;
    
    setIsSubmitting(true);
    await onAction(alert.id, selectedAction, notes);
    setIsSubmitting(false);
    onClose();
    setSelectedAction(null);
    setNotes('');
  };

  const getActionIcon = (action: SafetyAction) => {
    switch (action) {
      case 'JOIN_STREAM': return <Eye className="w-5 h-5" />;
      case 'REVIEW_STREAM': return <Search className="w-5 h-5" />;
      case 'ISSUE_WARNING': return <AlertTriangle className="w-5 h-5" />;
      case 'END_BROADCAST': return <StopCircle className="w-5 h-5" />;
      case 'SEND_TO_TROLL_COURT': return <Gavel className="w-5 h-5" />;
      case 'PLACE_IN_TROLL_JAIL': return <Lock className="w-5 h-5" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Review Safety Alert</h3>
        
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <p className="text-sm text-gray-400">Stream: <span className="text-white">{alert.stream_title || 'Unknown'}</span></p>
          <p className="text-sm text-gray-400">User: <span className="text-white">@{alert.user_username}</span></p>
          <p className="text-sm text-gray-400">Trigger: <span className="text-red-400">{alert.trigger_type}</span></p>
          <p className="text-sm text-gray-400">Phrase: <span className="text-yellow-400 font-mono">{alert.trigger_phrase}</span></p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-300 mb-2 block">Select Action:</label>
          <div className="grid grid-cols-2 gap-2">
            {SAFETY_ACTIONS.map((action) => (
              <button
                key={action.value}
                onClick={() => setSelectedAction(action.value)}
                className={`p-3 rounded border text-left transition-colors ${
                  selectedAction === action.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getActionIcon(action.value)}
                  <span className="font-medium">{action.label}</span>
                </div>
                <p className="text-xs mt-1 opacity-80">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-300 mb-2 block">Notes (optional):</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            rows={3}
            placeholder="Add any notes about this action..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedAction || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing...' : 'Take Action'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const SafetyAlertsPanel: React.FC<SafetyAlertsPanelProps> = ({ 
  officerId: _officerId, 
  officerRole: _officerRole 
}) => {
  const [alerts, setAlerts] = useState<SafetyAlertWithDetails[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SafetyAlertWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<SafetyTriggerType | 'ALL'>('ALL');
  const [filterLevel, setFilterLevel] = useState<AlertLevel | 0>(0);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      let query = supabase
        .from('active_safety_alerts_view')
        .select('*')
        .order('alert_level', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterType !== 'ALL') {
        query = query.eq('trigger_type', filterType);
      }

      if (filterLevel > 0) {
        query = query.eq('alert_level', filterLevel);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch alerts:', error);
        return;
      }

      setAlerts(data as SafetyAlertWithDetails[] || []);

      // Calculate stats
      const newStats: AlertStats = {
        total_alerts_today: data?.length || 0,
        unreviewed_alerts: data?.filter((a: SafetyAlertWithDetails) => !a.reviewed_by).length || 0,
        high_priority_alerts: data?.filter((a: SafetyAlertWithDetails) => a.alert_level === 3).length || 0,
        alerts_by_type: {
          SELF_HARM: data?.filter((a: SafetyAlertWithDetails) => a.trigger_type === 'SELF_HARM').length || 0,
          THREAT: data?.filter((a: SafetyAlertWithDetails) => a.trigger_type === 'THREAT').length || 0,
          VIOLENCE: data?.filter((a: SafetyAlertWithDetails) => a.trigger_type === 'VIOLENCE').length || 0,
          ABUSE: data?.filter((a: SafetyAlertWithDetails) => a.trigger_type === 'ABUSE').length || 0
        }
      };
      setStats(newStats);

    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [filterType, filterLevel]);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
    setIsLoading(false);
  }, [fetchAlerts]);

  // Realtime subscription
  useEffect(() => {
    if (!isRealtimeEnabled) return;

    const subscription = supabase
      .channel('safety_alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'safety_alerts'
      }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAlerts, isRealtimeEnabled]);

  // Handle alert action
  const handleAlertAction = async (alertId: string, action: SafetyAction, _notes?: string) => {
    try {
      const { error } = await supabase.rpc('review_safety_alert', {
        p_alert_id: alertId,
        p_action_taken: action
      });

      if (error) {
        console.error('Failed to review alert:', error);
        alert('Failed to process action. Please try again.');
        return;
      }

      // Refresh alerts
      fetchAlerts();

      // Perform additional actions based on selection
      switch (action) {
        case 'END_BROADCAST': {
          // Call function to end stream
          const alert = alerts.find(a => a.id === alertId);
          if (alert) {
            await supabase.rpc('end_stream', { p_stream_id: alert.stream_id });
          }
          break;
        }
        case 'SEND_TO_TROLL_COURT':
          // Navigate to court or open court modal
          break;
        case 'PLACE_IN_TROLL_JAIL': {
          // Call jail function
          const jailAlert = alerts.find(a => a.id === alertId);
          if (jailAlert) {
            await supabase.rpc('ban_user', {
              target: jailAlert.user_id,
              minutes: 60,
              reason: `Safety alert: ${jailAlert.trigger_type}`
            });
          }
          break;
        }
      }

    } catch (error) {
      console.error('Error handling alert action:', error);
    }
  };

  // Get alert level badge
  const getAlertLevelBadge = (level: AlertLevel) => {
    switch (level) {
      case 3:
        return (
          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
            HIGH PRIORITY
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded">
            FLAGGED
          </span>
        );
      case 1:
        return (
          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
            NOTIFICATION
          </span>
        );
    }
  };

  // Get trigger type badge
  const getTriggerTypeBadge = (type: SafetyTriggerType) => {
    const colors = {
      SELF_HARM: 'bg-purple-600',
      THREAT: 'bg-red-600',
      VIOLENCE: 'bg-orange-600',
      ABUSE: 'bg-pink-600'
    };

    return (
      <span className={`px-2 py-1 ${colors[type]} text-white text-xs font-bold rounded`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Safety Alerts</h2>
            <p className="text-gray-400 text-sm">Monitor and respond to safety concerns</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Stats */}
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.unreviewed_alerts}</p>
                <p className="text-gray-400">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{stats.high_priority_alerts}</p>
                <p className="text-gray-400">High Priority</p>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setIsRealtimeEnabled(!isRealtimeEnabled)}
            className={`p-2 rounded ${isRealtimeEnabled ? 'text-green-500' : 'text-gray-500'}`}
            title={isRealtimeEnabled ? 'Realtime updates enabled' : 'Realtime updates disabled'}
          >
            <RefreshCw className={`w-5 h-5 ${isRealtimeEnabled ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as SafetyTriggerType | 'ALL')}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2"
          >
            <option value="ALL">All Types</option>
            <option value="SELF_HARM">Self Harm</option>
            <option value="THREAT">Threat</option>
            <option value="VIOLENCE">Violence</option>
            <option value="ABUSE">Abuse</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(Number(e.target.value) as AlertLevel | 0)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2"
          >
            <option value={0}>All Levels</option>
            <option value={3}>High Priority</option>
            <option value={2}>Flagged</option>
            <option value={1}>Notification</option>
          </select>
        </div>

        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alerts Table */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No pending safety alerts</p>
          <p className="text-sm">All alerts have been reviewed</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-3 font-medium">Level</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Stream</th>
                <th className="pb-3 font-medium">Trigger Phrase</th>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr 
                  key={alert.id} 
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="py-4">
                    {getAlertLevelBadge(alert.alert_level)}
                  </td>
                  <td className="py-4">
                    {getTriggerTypeBadge(alert.trigger_type)}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-white">@{alert.user_username}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-gray-400" />
                      <span className="text-white truncate max-w-[150px]">
                        {alert.stream_title || 'Untitled'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-yellow-400 font-mono text-sm">
                      {alert.trigger_phrase}
                    </span>
                  </td>
                  <td className="py-4 text-gray-400 text-sm">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-white font-bold">{alert.total_triggers || 1}</span>
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedAlert(alert);
                          setIsModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Take Action
                      </button>
                      <button
                        onClick={() => handleAlertAction(alert.id, 'DISMISSED')}
                        className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Modal */}
      <AlertActionModal
        alert={selectedAlert}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAlert(null);
        }}
        onAction={handleAlertAction}
      />
    </div>
  );
};

export default SafetyAlertsPanel;
