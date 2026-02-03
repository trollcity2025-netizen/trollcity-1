import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, AlertTriangle, Shield, ShoppingBag, Search } from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';
import UserNameWithAge from '../../components/UserNameWithAge';

interface ReputationRecord {
  id: string;
  user_id: string;
  user?: { username: string; rgb_username_expires_at?: string; created_at?: string };
  current_score: number;
  lifetime_score: number;
  reputation_tier: string;
  violations_count: number;
  is_escalation_priority: boolean;
  updated_at: string;
}

interface OfficerRecord {
  id: string;
  officer_id: string;
  officer?: { username: string; rgb_username_expires_at?: string; created_at?: string };
  current_score: number;
  performance_rating: string;
  cases_handled: number;
  successful_resolutions: number;
  owc_points_earned: number;
}

interface SellerRecord {
  id: string;
  seller_id: string;
  seller?: { username: string; rgb_username_expires_at?: string; created_at?: string };
  current_score: number;
  reliability_tier: string;
  orders_fulfilled: number;
  orders_cancelled: number;
  is_high_risk: boolean;
}

export default function ReputationDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [userReputations, setUserReputations] = useState<ReputationRecord[]>([]);
  const [officerPerformances, setOfficerPerformances] = useState<OfficerRecord[]>([]);
  const [sellerReliabilities, setSellerReliabilities] = useState<SellerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const loadReputationData = React.useCallback(async () => {
    try {
      setLoading(true);

      if (activeTab === 'users') {
        const { data } = await supabase
          .from('user_reputation')
          .select(`
            *,
            user:user_profiles(username, rgb_username_expires_at, created_at)
          `)
          .order('current_score', { ascending: false });

        setUserReputations(data || []);
      } else if (activeTab === 'officers') {
        const { data } = await supabase
          .from('officer_performance')
          .select(`
            *,
            officer:user_profiles(username, rgb_username_expires_at, created_at)
          `)
          .order('current_score', { ascending: false });

        setOfficerPerformances(data || []);
      } else if (activeTab === 'sellers') {
        const { data } = await supabase
          .from('seller_reliability')
          .select(`
            *,
            seller:user_profiles(username, rgb_username_expires_at, created_at)
          `)
          .order('current_score', { ascending: false });

        setSellerReliabilities(data || []);
      }
    } catch (error) {
      console.error('Error loading reputation data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadReputationData();
  }, [loadReputationData]);

  const adjustReputationScore = async (userId: string, scoreChange: number, reason: string) => {
    try {
      const { error } = await supabase.rpc('update_user_reputation', {
        p_user_id: userId,
        p_score_change: scoreChange,
        p_event_type: 'manual_adjustment',
        p_reason: reason
      });

      if (error) throw error;
      await loadReputationData();
    } catch (error) {
      console.error('Error adjusting reputation:', error);
      alert('Error adjusting reputation score');
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'excellent':
      case 'elite':
      case 'platinum':
        return 'text-green-400 bg-green-900/20';
      case 'good':
      case 'gold':
        return 'text-blue-400 bg-blue-900/20';
      case 'standard':
      case 'silver':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'warning':
        return 'text-orange-400 bg-orange-900/20';
      case 'poor':
      case 'needs_improvement':
        return 'text-red-400 bg-red-900/20';
      case 'banned':
      case 'suspended':
        return 'text-red-600 bg-red-900/40';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 120) return 'text-green-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const filteredUsers = userReputations.filter(user => {
    const matchesSearch = user.user?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || user.reputation_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const filteredOfficers = officerPerformances.filter(officer => {
    const matchesSearch = officer.officer?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredSellers = sellerReliabilities.filter(seller => {
    const matchesSearch = seller.seller?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || seller.reliability_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading reputation data...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Reputation Engine</h1>
              <p className="text-gray-400">Internal scoring system for users, officers, and sellers</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg">
            {[
              { id: 'users', name: 'User Reputation', icon: AlertTriangle },
              { id: 'officers', name: 'Officer Performance', icon: Shield },
              { id: 'sellers', name: 'Seller Reliability', icon: ShoppingBag }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {(activeTab === 'users' || activeTab === 'sellers') && (
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tiers</option>
                {activeTab === 'users' ? (
                  <>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="warning">Warning</option>
                    <option value="poor">Poor</option>
                    <option value="banned">Banned</option>
                  </>
                ) : (
                  <>
                    <option value="platinum">Platinum</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="standard">Standard</option>
                    <option value="suspended">Suspended</option>
                  </>
                )}
              </select>
            )}
          </div>

          {/* Content */}
          {activeTab === 'users' && (
            <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Current Score</th>
                    <th className="px-4 py-3 text-left">Lifetime Score</th>
                    <th className="px-4 py-3 text-left">Tier</th>
                    <th className="px-4 py-3 text-left">Violations</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-zinc-700">
                      <td className="px-4 py-3">
                        <UserNameWithAge 
                          user={{
                            username: user.user?.username || 'Unknown',
                            id: user.user_id,
                            ...user.user
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getScoreColor(user.current_score)}`}>
                          {user.current_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{user.lifetime_score}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getTierColor(user.reputation_tier)}`}>
                          {user.reputation_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.violations_count}</td>
                      <td className="px-4 py-3">
                        {user.is_escalation_priority && (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => adjustReputationScore(user.user_id, 10, 'Manual positive adjustment')}
                            className="p-1 bg-green-600 hover:bg-green-700 rounded"
                            title="Increase Score"
                          >
                            <TrendingUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => adjustReputationScore(user.user_id, -10, 'Manual negative adjustment')}
                            className="p-1 bg-red-600 hover:bg-red-700 rounded"
                            title="Decrease Score"
                          >
                            <TrendingDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'officers' && (
            <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Officer</th>
                    <th className="px-4 py-3 text-left">Current Score</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                    <th className="px-4 py-3 text-left">Cases Handled</th>
                    <th className="px-4 py-3 text-left">Success Rate</th>
                    <th className="px-4 py-3 text-left">OWC Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOfficers.map((officer) => (
                    <tr key={officer.id} className="border-t border-zinc-700">
                      <td className="px-4 py-3">
                        <UserNameWithAge 
                          user={{
                            username: officer.officer?.username || 'Unknown',
                            id: officer.officer_id,
                            ...officer.officer
                          }}
                          showBadges={true}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getScoreColor(officer.current_score)}`}>
                          {officer.current_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getTierColor(officer.performance_rating)}`}>
                          {officer.performance_rating}
                        </span>
                      </td>
                      <td className="px-4 py-3">{officer.cases_handled}</td>
                      <td className="px-4 py-3">
                        {officer.cases_handled > 0
                          ? `${Math.round((officer.successful_resolutions / officer.cases_handled) * 100)}%`
                          : 'N/A'
                        }
                      </td>
                      <td className="px-4 py-3 text-green-400">{officer.owc_points_earned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'sellers' && (
            <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Seller</th>
                    <th className="px-4 py-3 text-left">Current Score</th>
                    <th className="px-4 py-3 text-left">Tier</th>
                    <th className="px-4 py-3 text-left">Orders Fulfilled</th>
                    <th className="px-4 py-3 text-left">Orders Cancelled</th>
                    <th className="px-4 py-3 text-left">Fulfillment Rate</th>
                    <th className="px-4 py-3 text-left">Risk Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSellers.map((seller) => (
                    <tr key={seller.id} className="border-t border-zinc-700">
                      <td className="px-4 py-3">
                        <UserNameWithAge 
                          user={{
                            username: seller.seller?.username || 'Unknown',
                            id: seller.seller_id,
                            ...seller.seller
                          }}
                          showBadges={true}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getScoreColor(seller.current_score)}`}>
                          {seller.current_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${getTierColor(seller.reliability_tier)}`}>
                          {seller.reliability_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400">{seller.orders_fulfilled}</td>
                      <td className="px-4 py-3 text-red-400">{seller.orders_cancelled}</td>
                      <td className="px-4 py-3">
                        {seller.orders_fulfilled + seller.orders_cancelled > 0
                          ? `${Math.round((seller.orders_fulfilled / (seller.orders_fulfilled + seller.orders_cancelled)) * 100)}%`
                          : 'N/A'
                        }
                      </td>
                      <td className="px-4 py-3">
                        {seller.is_high_risk && (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeTab === 'users' && (
              <>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {userReputations.filter(u => u.reputation_tier === 'excellent').length}
                  </div>
                  <div className="text-sm text-gray-400">Excellent Users</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {userReputations.filter(u => u.is_escalation_priority).length}
                  </div>
                  <div className="text-sm text-gray-400">High Priority</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {userReputations.filter(u => u.reputation_tier === 'banned').length}
                  </div>
                  <div className="text-sm text-gray-400">Banned Users</div>
                </div>
              </>
            )}

            {activeTab === 'officers' && (
              <>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {officerPerformances.filter(o => o.performance_rating === 'elite').length}
                  </div>
                  <div className="text-sm text-gray-400">Elite Officers</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {officerPerformances.reduce((sum, o) => sum + o.cases_handled, 0)}
                  </div>
                  <div className="text-sm text-gray-400">Total Cases</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {officerPerformances.reduce((sum, o) => sum + o.owc_points_earned, 0)}
                  </div>
                  <div className="text-sm text-gray-400">Total OWC Earned</div>
                </div>
              </>
            )}

            {activeTab === 'sellers' && (
              <>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {sellerReliabilities.filter(s => s.reliability_tier === 'platinum').length}
                  </div>
                  <div className="text-sm text-gray-400">Platinum Sellers</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {sellerReliabilities.reduce((sum, s) => sum + s.orders_fulfilled, 0)}
                  </div>
                  <div className="text-sm text-gray-400">Orders Fulfilled</div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {sellerReliabilities.filter(s => s.is_high_risk).length}
                  </div>
                  <div className="text-sm text-gray-400">High Risk Sellers</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </RequireRole>
  );
}