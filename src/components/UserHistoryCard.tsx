import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../lib/supabase';
import { AlertTriangle, Clock, Gavel, Ban, MessageSquare, Eye } from 'lucide-react';

interface UserHistory {
  id: string;
  user_id: string;
  incident_type: 'warning' | 'fine' | 'timeout' | 'ban' | 'court_case';
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  description: string;
  officer_id: string;
  created_at: string;
}

interface UserHistoryCardProps {
  targetUserId: string;
  onClose: () => void;
}

const UserHistoryCard: React.FC<UserHistoryCardProps> = ({ targetUserId, onClose }) => {
  const [history, setHistory] = useState<UserHistory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserHistory();
  }, [targetUserId]);

  const loadUserHistory = async () => {
    try {
      setLoading(true);

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;
      setUserProfile(profile);

      // Mock history data - in real app this would come from database
      const mockHistory: UserHistory[] = [
        {
          id: '1',
          user_id: targetUserId,
          incident_type: 'warning',
          severity: 'minor',
          description: 'Stream disruption complaint',
          officer_id: 'officer-1',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          user_id: targetUserId,
          incident_type: 'fine',
          severity: 'moderate',
          description: 'Coin transaction dispute',
          officer_id: 'officer-2',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      setHistory(mockHistory);
    } catch (error) {
      console.error('Error loading user history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'fine': return <Gavel className="w-4 h-4 text-orange-400" />;
      case 'timeout': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'ban': return <Ban className="w-4 h-4 text-red-400" />;
      case 'court_case': return <MessageSquare className="w-4 h-4 text-purple-400" />;
      default: return <Eye className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'text-green-400 bg-green-900/20';
      case 'moderate': return 'text-yellow-400 bg-yellow-900/20';
      case 'severe': return 'text-orange-400 bg-orange-900/20';
      case 'critical': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const calculateReputationScore = () => {
    if (!history.length) return 100;

    const severityWeights = { minor: 1, moderate: 2, severe: 3, critical: 4 };
    const totalWeight = history.reduce((sum, incident) =>
      sum + (severityWeights[incident.severity as keyof typeof severityWeights] || 1), 0
    );

    // Start at 100, lose points based on incidents
    return Math.max(0, 100 - (totalWeight * 5));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">User History</h3>
            <p className="text-gray-400 text-sm">{userProfile?.username}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="text-gray-400 text-xl">×</span>
          </button>
        </div>

        {/* Reputation Score */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">Reputation Score</span>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                calculateReputationScore() >= 80 ? 'bg-green-600 text-white' :
                calculateReputationScore() >= 60 ? 'bg-yellow-600 text-white' :
                calculateReputationScore() >= 40 ? 'bg-orange-600 text-white' :
                'bg-red-600 text-white'
              }`}>
                {calculateReputationScore()}/100
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Based on {history.length} incident{history.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Incident History */}
        <div className="space-y-3">
          <h4 className="text-white font-semibold">Incident History</h4>

          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-sm">No incidents on record</div>
              <div className="text-xs mt-1">Clean record maintained</div>
            </div>
          ) : (
            history.map((incident) => (
              <div
                key={incident.id}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-start gap-3">
                  {getIncidentIcon(incident.incident_type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium capitalize">
                        {incident.incident_type.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                        {incident.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{incident.description}</p>
                    <div className="text-xs text-gray-500">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Officer Use Only • Confidential Information
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserHistoryCard;