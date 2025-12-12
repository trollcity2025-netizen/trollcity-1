import React, { useState, useEffect } from 'react';
import { User, AlertTriangle, Shield, ShoppingBag, Clock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserRecordProps {
  userId: string;
  isVisible: boolean;
}

interface UserHistoryItem {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  created_at: string;
  points: number;
  officer?: { username: string };
}

interface StreamIncident {
  id: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  created_at: string;
  resolution_status: string;
}

interface OfficerAction {
  id: string;
  action_type: string;
  action_subtype?: string;
  title: string;
  description: string;
  created_at: string;
  outcome: string;
  points_earned: number;
}

interface SellerHistory {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  created_at: string;
  resolution_status: string;
}

export default function UserRecord({ userId, isVisible }: UserRecordProps) {
  const [userHistory, setUserHistory] = useState<UserHistoryItem[]>([]);
  const [streamIncidents, setStreamIncidents] = useState<StreamIncident[]>([]);
  const [officerActions, setOfficerActions] = useState<OfficerAction[]>([]);
  const [sellerHistory, setSellerHistory] = useState<SellerHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('violations');

  useEffect(() => {
    if (isVisible && userId) {
      loadUserRecord();
    }
  }, [isVisible, userId]);

  const loadUserRecord = async () => {
    try {
      setLoading(true);

      // Load user history (violations, court outcomes, etc.)
      const { data: historyData } = await supabase
        .from('user_history')
        .select(`
          *,
          officer:user_profiles(username)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Load stream incidents for this user
      const { data: incidentData } = await supabase
        .from('stream_incidents')
        .select('*')
        .eq('broadcaster_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Load officer actions taken against this user
      const { data: actionData } = await supabase
        .from('officer_actions')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      // Load seller history if user is a seller
      const { data: sellerData } = await supabase
        .from('seller_history')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      setUserHistory(historyData || []);
      setStreamIncidents(incidentData || []);
      setOfficerActions(actionData || []);
      setSellerHistory(sellerData || []);
    } catch (error) {
      console.error('Error loading user record:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-900/20';
      case 'high': return 'border-l-orange-500 bg-orange-900/20';
      case 'medium': return 'border-l-yellow-500 bg-yellow-900/20';
      default: return 'border-l-blue-500 bg-blue-900/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-green-400';
      case 'escalated': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-lg p-6">
        <div className="animate-pulse">Loading user record...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'violations', name: 'Violations & Court', icon: AlertTriangle, count: userHistory.length },
    { id: 'streams', name: 'Stream Incidents', icon: Shield, count: streamIncidents.length },
    { id: 'officer_actions', name: 'Officer Actions', icon: User, count: officerActions.length },
    { id: 'seller', name: 'Seller History', icon: ShoppingBag, count: sellerHistory.length },
  ];

  return (
    <div className="bg-zinc-900/50 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Eye className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-bold">User Record</h2>
        <span className="text-sm text-gray-400">(Internal Admin View)</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
            {tab.count > 0 && (
              <span className="bg-zinc-600 text-xs px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'violations' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Violations & Court History</h3>
            {userHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No violations or court history found.
              </div>
            ) : (
              <div className="space-y-3">
                {userHistory.map((item) => (
                  <div key={item.id} className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(item.severity)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{item.title}</span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.points > 0 ? 'bg-green-600' :
                          item.points < 0 ? 'bg-red-600' : 'bg-gray-600'
                        }`}>
                          {item.points > 0 ? '+' : ''}{item.points} pts
                        </span>
                        <span className="text-gray-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-300 mb-2">{item.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="px-2 py-1 bg-gray-700 rounded capitalize">{item.event_type}</span>
                      {item.officer?.username && (
                        <span>Handled by {item.officer.username}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'streams' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Stream Incidents</h3>
            {streamIncidents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No stream incidents found.
              </div>
            ) : (
              <div className="space-y-3">
                {streamIncidents.map((incident) => (
                  <div key={incident.id} className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(incident.severity)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{incident.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getStatusColor(incident.resolution_status)}`}>
                          {incident.resolution_status}
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(incident.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {incident.description && (
                      <p className="text-sm text-gray-300 mb-2">{incident.description}</p>
                    )}
                    <div className="text-xs text-gray-400">
                      Type: {incident.incident_type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'officer_actions' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Officer Actions Taken</h3>
            {officerActions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No officer actions found for this user.
              </div>
            ) : (
              <div className="space-y-3">
                {officerActions.map((action) => (
                  <div key={action.id} className="border-l-4 border-l-blue-500 bg-blue-900/20 p-4 rounded-r-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{action.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          action.outcome === 'successful' ? 'bg-green-600' :
                          action.outcome === 'unsuccessful' ? 'bg-red-600' :
                          action.outcome === 'escalated' ? 'bg-orange-600' : 'bg-yellow-600'
                        }`}>
                          {action.outcome || 'pending'}
                        </span>
                        {action.points_earned > 0 && (
                          <span className="text-sm text-green-400">
                            +{action.points_earned} OWC
                          </span>
                        )}
                        <span className="text-sm text-gray-400">
                          {new Date(action.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {action.description && (
                      <p className="text-sm text-gray-300 mb-2">{action.description}</p>
                    )}
                    <div className="text-xs text-gray-400">
                      Action: {action.action_type}
                      {action.action_subtype && ` → ${action.action_subtype}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'seller' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Seller History</h3>
            {sellerHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No seller history found.
              </div>
            ) : (
              <div className="space-y-3">
                {sellerHistory.map((item) => (
                  <div key={item.id} className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(item.severity)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{item.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getStatusColor(item.resolution_status)}`}>
                          {item.resolution_status}
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-300 mb-2">{item.description}</p>
                    )}
                    <div className="text-xs text-gray-400">
                      Event: {item.event_type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}