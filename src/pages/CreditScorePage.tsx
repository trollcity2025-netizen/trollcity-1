import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CreditUser {
  user_id: string;
  score: number;
  tier: string;
  trend_7d: number;
  updated_at: string;
  username?: string;
}

interface CreditEvent {
  id: string;
  user_id: string;
  event_type: string;
  delta: number;
  created_at: string;
  metadata: any;
  source_table?: string;
}

export default function CreditScorePage() {
  const [creditUsers, setCreditUsers] = useState<CreditUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CreditUser | null>(null);
  const [creditEvents, setCreditEvents] = useState<CreditEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);

  const TIERS = ['Untrusted', 'Shaky', 'Building', 'Reliable', 'Trusted', 'Elite'];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
      case 'Trusted': return 'text-green-400 bg-green-400/10 border-green-500/30';
      case 'Reliable': return 'text-blue-400 bg-blue-400/10 border-blue-500/30';
      case 'Building': return 'text-purple-400 bg-purple-400/10 border-purple-500/30';
      case 'Shaky': return 'text-orange-400 bg-orange-400/10 border-orange-500/30';
      case 'Untrusted': return 'text-red-400 bg-red-400/10 border-red-500/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-500/30';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp size={16} className="text-green-400" />;
    if (trend < 0) return <TrendingDown size={16} className="text-red-400" />;
    return null;
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('repossess')) return 'text-red-400';
    if (eventType.includes('default')) return 'text-red-400';
    if (eventType.includes('late')) return 'text-orange-400';
    if (eventType.includes('payment')) return 'text-green-400';
    if (eventType.includes('loan_approval')) return 'text-green-400';
    return 'text-blue-400';
  };

  useEffect(() => {
    fetchAllCreditScores();
  }, []);

  const fetchAllCreditScores = async () => {
    setLoading(true);
    try {
      // 1. Fetch all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, created_at');

      if (profilesError) throw profilesError;

      // 2. Fetch all existing credit scores
      const { data: creditData, error: creditError } = await supabase
        .from('user_credit')
        .select('user_id, score, tier, trend_7d, updated_at');

      if (creditError) throw creditError;

      // 3. Merge data
      const creditMap = new Map(creditData?.map(d => [d.user_id, d]) || []);
      
      const combinedData: CreditUser[] = (profiles || []).map(profile => {
        const credit = creditMap.get(profile.id);
        return {
          user_id: profile.id,
          username: profile.username || 'Unknown',
          score: credit?.score ?? 400,
          tier: credit?.tier ?? 'Building',
          trend_7d: credit?.trend_7d ?? 0,
          updated_at: credit?.updated_at ?? profile.created_at ?? new Date().toISOString()
        };
      });

      // 4. Sort by score descending
      combinedData.sort((a, b) => b.score - a.score);

      setCreditUsers(combinedData);
    } catch (err) {
      console.error('Failed to fetch credit scores:', err);
      toast.error('Failed to load credit scores');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCreditEvents = async (userId: string) => {
    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCreditEvents(data || []);
    } catch (err) {
      console.error('Failed to fetch credit events:', err);
      toast.error('Failed to load credit history');
    } finally {
      setEventsLoading(false);
    }
  };

  const handleSelectUser = async (user: CreditUser) => {
    setSelectedUser(user);
    await fetchUserCreditEvents(user.user_id);
  };

  const filteredUsers = creditUsers.filter(user => {
    const matchesSearch = user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = filterTier === 'all' || user.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Credit Scores</h1>
            <p className="text-gray-300">Public credit report for Troll City residents</p>
          </div>
          <AlertCircle size={32} className="text-blue-400 opacity-75" />
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Tiers</option>
            {TIERS.map(tier => (
              <option key={tier} value={tier}>{tier}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Credit Scores List */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Residents ({filteredUsers.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p>No residents found matching your search</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filteredUsers.map(user => (
                  <button
                    key={user.user_id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full px-6 py-4 text-left hover:bg-slate-700/50 transition ${
                      selectedUser?.user_id === user.user_id ? 'bg-slate-700 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-white">{user.username}</p>
                        <p className="text-sm text-gray-400">{user.user_id.slice(0, 8)}...</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">{user.score}</div>
                          <div className="text-xs text-gray-400">/ 800</div>
                        </div>

                        <div className={`px-3 py-1 rounded-full border ${getTierColor(user.tier)}`}>
                          <p className="text-sm font-semibold">{user.tier}</p>
                        </div>

                        {user.trend_7d !== 0 && (
                          <div className="flex items-center gap-1">
                            {getTrendIcon(user.trend_7d)}
                            <span className={user.trend_7d > 0 ? 'text-green-400' : 'text-red-400'}>
                              {user.trend_7d > 0 ? '+' : ''}{user.trend_7d}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Credit Report Details */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <div className="space-y-6">
              {/* Credit Summary */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Credit Report</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400">Resident</p>
                    <p className="text-white font-semibold">{selectedUser.username}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">Credit Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">{selectedUser.score}</span>
                      <span className="text-gray-400">/ 800</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">Credit Tier</p>
                    <div className={`inline-block px-4 py-2 rounded-lg border font-semibold ${getTierColor(selectedUser.tier)}`}>
                      {selectedUser.tier}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">7-Day Trend</p>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(selectedUser.trend_7d)}
                      <span className={selectedUser.trend_7d > 0 ? 'text-green-400' : selectedUser.trend_7d < 0 ? 'text-red-400' : 'text-gray-400'}>
                        {selectedUser.trend_7d > 0 ? '+' : ''}{selectedUser.trend_7d} points
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">Last Updated</p>
                    <p className="text-white">
                      {new Date(selectedUser.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Scale */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase">Score Scale</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-yellow-400">800+</span>
                    <span className="text-gray-400">Elite</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-400">700-799</span>
                    <span className="text-gray-400">Trusted</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-400">600-699</span>
                    <span className="text-gray-400">Reliable</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-purple-400">450-599</span>
                    <span className="text-gray-400">Building</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-400">300-449</span>
                    <span className="text-gray-400">Shaky</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-400">Below 300</span>
                    <span className="text-gray-400">Untrusted</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
              <p className="text-gray-400">Select a resident to view their credit report</p>
            </div>
          )}
        </div>
      </div>

      {/* Credit Events / History */}
      {selectedUser && (
        <div className="max-w-7xl mx-auto mt-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Credit History</h3>
            </div>

            {eventsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : creditEvents.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p>No credit events recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {creditEvents.map(event => (
                  <div key={event.id} className="px-6 py-4 hover:bg-slate-700/50 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className={`font-semibold ${getEventColor(event.event_type)}`}>
                          {event.event_type.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(event.created_at).toLocaleDateString()} at {new Date(event.created_at).toLocaleTimeString()}
                        </p>
                        {event.metadata?.reason && (
                          <p className="text-sm text-gray-300 mt-2">{event.metadata.reason}</p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className={`text-lg font-bold ${event.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {event.delta > 0 ? '+' : ''}{event.delta}
                        </div>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
