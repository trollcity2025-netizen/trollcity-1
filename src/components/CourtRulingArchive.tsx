import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Scale, Gavel, Clock, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';

interface CourtRuling {
  id: string;
  case_type: 'stream_disruption' | 'coin_dispute' | 'marketplace_violation' | 'harassment' | 'spam' | 'other';
  ruling: 'warning' | 'fine' | 'timeout' | 'ban' | 'dismissed';
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  created_at: string;
  // Anonymized - no user IDs or names
}

const CourtRulingArchive: React.FC = () => {
  const [rulings, setRulings] = useState<CourtRuling[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'recent' | 'severe'>('recent');

  useEffect(() => {
    loadRulings();
  }, [filter]);

  const loadRulings = async () => {
    try {
      setLoading(true);

      // Mock data for now - in real app this would come from database
      const mockRulings: CourtRuling[] = [
        {
          id: '1',
          case_type: 'stream_disruption',
          ruling: 'warning',
          severity: 'minor',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        },
        {
          id: '2',
          case_type: 'coin_dispute',
          ruling: 'fine',
          severity: 'moderate',
          created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
        },
        {
          id: '3',
          case_type: 'harassment',
          ruling: 'timeout',
          severity: 'severe',
          created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
        },
        {
          id: '4',
          case_type: 'marketplace_violation',
          ruling: 'ban',
          severity: 'critical',
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
        },
        {
          id: '5',
          case_type: 'spam',
          ruling: 'warning',
          severity: 'minor',
          created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() // 1.5 days ago
        }
      ];

      // Filter based on selection
      let filteredRulings = mockRulings;
      if (filter === 'recent') {
        filteredRulings = mockRulings.filter(r =>
          new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );
      } else if (filter === 'severe') {
        filteredRulings = mockRulings.filter(r =>
          r.severity === 'severe' || r.severity === 'critical'
        );
      }

      setRulings(filteredRulings);
    } catch (error) {
      console.error('Error loading court rulings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCaseTypeLabel = (type: string) => {
    const labels = {
      stream_disruption: 'Stream Disruption',
      coin_dispute: 'Coin Dispute',
      marketplace_violation: 'Marketplace Violation',
      harassment: 'Harassment',
      spam: 'Spam',
      other: 'Other'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getRulingLabel = (ruling: string) => {
    const labels = {
      warning: 'Warning Issued',
      fine: 'Fine Imposed',
      timeout: 'Timeout Applied',
      ban: 'Account Banned',
      dismissed: 'Case Dismissed'
    };
    return labels[ruling as keyof typeof labels] || ruling;
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

  const getRulingIcon = (ruling: string) => {
    switch (ruling) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'fine': return <Gavel className="w-4 h-4 text-orange-400" />;
      case 'timeout': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'ban': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'dismissed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      default: return <Scale className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Court Ruling Archive</h3>
            <p className="text-sm text-gray-400">Justice served, order maintained</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('recent')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'recent'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setFilter('severe')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'severe'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Severe
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rulings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No rulings found for the selected filter</p>
          </div>
        ) : (
          rulings.map((ruling) => (
            <div
              key={ruling.id}
              className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getRulingIcon(ruling.ruling)}
                  <span className="font-semibold text-white">
                    {getRulingLabel(ruling.ruling)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(ruling.severity)}`}>
                    {ruling.severity.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(ruling.created_at)}
                </div>
              </div>

              <div className="text-sm text-gray-300">
                Case: <span className="text-purple-300">{getCaseTypeLabel(ruling.case_type)}</span>
              </div>

              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Ruling enforced by Troll Court
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          This archive proves: <span className="text-purple-400 font-semibold">Chaos has rules. Justice is served.</span>
        </p>
      </div>
    </div>
  );
};

export default CourtRulingArchive;