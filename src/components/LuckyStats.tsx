import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, Zap, Trophy, Target } from 'lucide-react';

interface LuckyStatsData {
  total_spent: number;
  total_trollmonds_won: number;
  total_wins: number;
  win_rate: number;
  biggest_win: number;
  last_win_at: string | null;
  multiplier_counts: {
    x100: number;
    x200: number;
    x500: number;
    x1000: number;
    x10000: number;
  };
}

interface LuckyStatsProps {
  userId?: string;
  compact?: boolean;
}

const LuckyStats: React.FC<LuckyStatsProps> = ({ userId, compact = false }) => {
  const [stats, setStats] = useState<LuckyStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_lucky_stats', {
        p_user_id: userId
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching lucky stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded mb-2"></div>
        <div className="h-8 bg-gray-700 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No lucky events yet</p>
        <p className="text-sm">Send gifts to start winning Trollmonds!</p>
      </div>
    );
  }

  const formatNumber = (num: number) => num.toLocaleString();
  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-white">Lucky Stats</span>
          </div>
          <span className="text-xs text-gray-400">
            {stats.total_wins} wins
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-gray-400">Spent</div>
            <div className="text-white font-medium">{formatNumber(stats.total_spent)}</div>
          </div>
          <div>
            <div className="text-gray-400">Won</div>
            <div className="text-yellow-400 font-medium">{formatNumber(stats.total_trollmonds_won)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-yellow-500/20 rounded-lg">
          <Zap className="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Lucky Statistics</h3>
          <p className="text-sm text-gray-400">Your Trollmond journey</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Spent</span>
          </div>
          <div className="text-xl font-bold text-white">{formatNumber(stats.total_spent)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Trollmonds Won</span>
          </div>
          <div className="text-xl font-bold text-yellow-400">{formatNumber(stats.total_trollmonds_won)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Total Wins</span>
          </div>
          <div className="text-xl font-bold text-white">{formatNumber(stats.total_wins)}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Win Rate</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.win_rate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Multiplier Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-white mb-3">Multiplier Breakdown</h4>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(stats.multiplier_counts).map(([mult, count]) => {
            const multiplier = parseInt(mult.replace('x', ''));
            const colors = {
              100: 'bg-yellow-500',
              200: 'bg-orange-500',
              500: 'bg-pink-500',
              1000: 'bg-cyan-500',
              10000: 'bg-red-500'
            };

            return (
              <div key={mult} className="text-center">
                <div className={`h-12 ${colors[multiplier as keyof typeof colors]} rounded flex items-end justify-center pb-1`}>
                  <span className="text-xs font-bold text-white">{count}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{mult}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Biggest Win</div>
          <div className="text-lg font-bold text-yellow-400">
            {formatNumber(stats.biggest_win)} 💎
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Last Win</div>
          <div className="text-sm font-medium text-white">
            {formatDate(stats.last_win_at)}
          </div>
        </div>
      </div>

      {/* ROI Calculation */}
      {stats.total_spent > 0 && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Return on Investment</div>
          <div className="text-lg font-bold text-green-400">
            {((stats.total_trollmonds_won / stats.total_spent) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">
            Trollmonds earned per coin spent
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckyStats;