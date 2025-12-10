import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import TrollTractBadge from '../components/TrollTractBadge';
import { TrollTractBadge } from '../components/TrollTractBadge';
import { 
  Crown, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  BarChart3,
  Star,
  Zap,
  Gift,
  Eye,
  Award,
  Target,
  Clock
} from 'lucide-react';

interface TrollTractAnalytics {
  date: string;
  total_gifts: number;
  trolltract_bonus: number;
  total_earnings: number;
  unique_gifters: number;
}

interface TrollTractBonusLog {
  id: string;
  base_amount: number;
  bonus_amount: number;
  total_amount: number;
  created_at: string;
  gift_id?: string;
  stream_id?: string;
  sender_id?: string;
}

export default function TrollTractCreatorDashboard() {
  const { profile, user } = useAuthStore();
  const [analytics, setAnalytics] = useState<TrollTractAnalytics[]>([]);
  const [bonusLogs, setBonusLogs] = useState<TrollTractBonusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Redirect if not TrollTract creator
  if (!profile?.is_trolltract) {
    return (
      <div className="min-h-screen bg-[#0A0A14] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 text-center">
            <Crown className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">TrollTract Required</h2>
            <p className="text-gray-300 mb-4">
              The Creator Dashboard is only available to activated TrollTract creators.
            </p>
            <button 
              onClick={() => window.location.href = '/creator-contract'}
              className="bg-gradient-to-r from-purple-600 to-gold-600 hover:from-purple-700 hover:to-gold-700 px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Activate TrollTract
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadTrollTractData();
  }, [timeRange]);

  const loadTrollTractData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Calculate date range
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      // Load analytics data
      const { data: analyticsData } = await supabase
        .from('trolltract_analytics')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      setAnalytics(analyticsData || []);

      // Load recent bonus logs
      const { data: bonusData } = await supabase
        .from('trolltract_bonus_log')
        .select('*')
        .eq('user_id', user.id)
        .gt('bonus_amount', 0)
        .order('created_at', { ascending: false })
        .limit(50);

      setBonusLogs(bonusData || []);

    } catch (error) {
      console.error('Error loading TrollTract data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalEarnings = analytics.reduce((sum, day) => sum + day.total_earnings, 0);
  const totalBonus = analytics.reduce((sum, day) => sum + day.trolltract_bonus, 0);
  const totalGifts = analytics.reduce((sum, day) => sum + day.total_gifts, 0);
  const totalGifters = new Set(analytics.map(day => day.unique_gifters)).size;

  // Calculate growth rates (mock data for demo)
  const earningsGrowth = 15.3;
  const bonusGrowth = 22.7;

  const benefits = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "10% Bonus Earnings",
      description: `You've earned ${totalBonus.toLocaleString()} bonus coins from TrollTract`,
      value: `${totalBonus.toLocaleString()} bonus coins`,
      growth: `+${bonusGrowth}%`
    },
    {
      icon: <Crown className="w-5 h-5" />,
      title: "Priority Ranking",
      description: "25% boost in discovery and recommendations",
      value: "Active",
      growth: "+25% boost"
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: "Featured Eligibility",
      description: "Qualify for Featured Shows and special events",
      value: "Unlocked",
      growth: "Priority access"
    },
    {
      icon: <Award className="w-5 h-5" />,
      title: "Official Badge",
      description: "TrollTract Creator badge on your profile",
      value: "Active",
      growth: "Visible to all"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-gold-600 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                Creator Dashboard
                <TrollTractBadge profile={profile} size="lg" />
              </h1>
              <p className="text-gray-400">
                Welcome back, TrollTract Creator! Track your earnings and performance.
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-400">Activated</p>
            <p className="font-semibold">
              {new Date(profile?.trolltract_activated_at || '').toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-400" />
              <span className="text-green-400 text-sm font-semibold">+{earningsGrowth}%</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {totalEarnings.toLocaleString()}
            </h3>
            <p className="text-gray-400 text-sm">Total Earnings</p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-8 h-8 text-gold-400" />
              <span className="text-gold-400 text-sm font-semibold">+{bonusGrowth}%</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {totalBonus.toLocaleString()}
            </h3>
            <p className="text-gray-400 text-sm">TrollTract Bonus</p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Gift className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {totalGifts.toLocaleString()}
            </h3>
            <p className="text-gray-400 text-sm">Total Gifts</p>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {totalGifters.toLocaleString()}
            </h3>
            <p className="text-gray-400 text-sm">Unique Gifters</p>
          </div>
        </div>

        {/* TrollTract Benefits */}
        <div className="bg-gradient-to-r from-purple-900/20 to-gold-900/20 rounded-xl p-6 border border-purple-500/30">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold-400" />
            TrollTract Benefits
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-start gap-3">
                  <div className="text-gold-400 mt-1">
                    {benefit.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-white">{benefit.title}</h4>
                      <span className="text-xs text-gold-400 bg-gold-900/30 px-2 py-1 rounded">
                        {benefit.growth}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2">{benefit.description}</p>
                    <p className="text-sm font-semibold text-gold-300">{benefit.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Chart Placeholder */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Earnings Analytics
            </h2>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center border border-gray-700">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">Earnings chart will be displayed here</p>
              <p className="text-sm text-gray-500">Real-time data from your TrollTract analytics</p>
            </div>
          </div>
        </div>

        {/* Recent Bonus Transactions */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-gold-400" />
            Recent TrollTract Bonus Earnings
          </h2>
          
          {bonusLogs.length > 0 ? (
            <div className="space-y-3">
              {bonusLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-gold-600 rounded-full flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">+{log.bonus_amount.toLocaleString()} TrollTract Bonus</p>
                      <p className="text-sm text-gray-400">
                        {new Date(log.created_at).toLocaleDateString()} • Base: {log.base_amount.toLocaleString()} • Total: {log.total_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-gold-400 font-semibold">
                    +10% bonus
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">No bonus earnings yet</p>
              <p className="text-sm text-gray-500">Start receiving gifts to earn TrollTract bonuses!</p>
            </div>
          )}
        </div>

        {/* Special Features */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              Creator Tools
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg hover:bg-purple-900/50 transition-colors">
                <div className="font-semibold text-white">Shadow Mode</div>
                <div className="text-sm text-gray-400">Hide viewer count until 20+ viewers</div>
              </button>
              <button className="w-full text-left p-3 bg-gold-900/30 border border-gold-500/30 rounded-lg hover:bg-gold-900/50 transition-colors">
                <div className="font-semibold text-white">Featured Show Application</div>
                <div className="text-sm text-gray-400">Apply for Featured Show slots</div>
              </button>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Average per gift:</span>
                <span className="font-semibold text-white">
                  {totalGifts > 0 ? Math.round(totalEarnings / totalGifts).toLocaleString() : 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bonus rate:</span>
                <span className="font-semibold text-gold-400">10%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ranking boost:</span>
                <span className="font-semibold text-purple-400">+25%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Creator since:</span>
                <span className="font-semibold text-white">
                  {Math.floor((Date.now() - new Date(profile?.trolltract_activated_at || '').getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}