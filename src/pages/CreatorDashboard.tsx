import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
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

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const card = {
  padding: "18px",
  borderRadius: "12px",
  background: "#10141a",
  border: "1px solid #1f2733",
  marginBottom: "20px",
};

const COLORS = ["#7CFC00", "#ff2e92", "#ffd54f", "#42a5f5"];

interface EarningsOverview {
  total_coins_earned: number;
  total_bonus_coins: number;
  total_payouts_usd: number;
  pending_payouts_usd: number;
}

interface DailyEarnings {
  day: string;
  coins: number;
  bonus_coins: number;
  payouts_usd: number;
}

interface HourlyActivity {
  hour_of_day: number;
  coins: number;
  gifts_count: number;
}

interface TopGifter {
  sender_id: string;
  total_coins: number;
  sender_username: string;
  sender_avatar_url: string;
}

interface BattleEventEarnings {
  source: string;
  coins: number;
}

export default function CreatorDashboard() {
  const { profile, user } = useAuthStore();
  const [overview, setOverview] = useState<EarningsOverview | null>(null);
  const [dailySeries, setDailySeries] = useState<DailyEarnings[]>([]);
  const [hourly, setHourly] = useState<HourlyActivity[]>([]);
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [battleEvent, setBattleEvent] = useState<BattleEventEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, timeRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEarningsOverview(),
        loadDailyEarningsSeries(),
        loadHourlyActivity(),
        loadTopGifters(),
        loadBattleEventEarnings()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEarningsOverview = async () => {
    const { data, error } = await supabase.rpc('get_earnings_overview');
    if (error) throw error;
    setOverview(data?.[0] || null);
  };

  const loadDailyEarningsSeries = async () => {
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const { data, error } = await supabase.rpc('get_daily_earnings_series', {
      days_back: daysBack
    });
    if (error) throw error;
    setDailySeries(data || []);
  };

  const loadHourlyActivity = async () => {
    const { data, error } = await supabase.rpc('get_hourly_activity');
    if (error) throw error;
    setHourly(data || []);
  };

  const loadTopGifters = async () => {
    const { data, error } = await supabase.rpc('get_top_gifters', {
      limit_count: 10
    });
    if (error) throw error;
    setTopGifters(data || []);
  };

  const loadBattleEventEarnings = async () => {
    const { data, error } = await supabase.rpc('get_battle_and_event_earnings');
    if (error) throw error;
    setBattleEvent(data || []);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A14] text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER + STATUS */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-gold-600 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Creator Earnings Dashboard
            </h1>
              <p className="text-gray-400">
                Track your gifts, bonuses, payouts, and performance.
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-400">Status</p>
            <p className="font-semibold">
              {profile?.role
                ? profile.role.replace(/_/g, ' ')
                : 'Creator'}
            </p>
            {profile?.created_at && (
              <p className="text-xs text-gray-500">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* TOP METRICS */}
        <section style={card}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px", fontWeight: 700 }}>
            Overview
          </h2>
          <div
            style={{
              display: "grid",
              gap: "18px",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            }}
          >
            <Metric
              label="Total Coins Earned"
              value={overview?.total_coins_earned ?? 0}
            />
            <Metric
              label="TrollTract Bonus Coins"
              value={overview?.total_bonus_coins ?? 0}
              highlight
            />
            <Metric
              label="Payouts Completed (USD)"
              value={overview?.total_payouts_usd ?? 0}
              isCurrency
            />
            <Metric
              label="Pending Payouts (USD)"
              value={overview?.pending_payouts_usd ?? 0}
              isCurrency
            />
          </div>
        </section>

        {/* DAILY EARNINGS CHART */}
        <section style={card}>
          <div className="flex items-center justify-between mb-6">
            <h2 style={{ fontSize: "18px", marginBottom: "6px", fontWeight: 700 }}>
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
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={dailySeries || []}>
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name === 'coins' ? 'Coins' : name === 'bonus_coins' ? 'Bonus Coins' : 'Payouts (USD)'
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="coins"
                  name="Coins"
                  stroke={COLORS[1]}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bonus_coins"
                  name="Bonus"
                  stroke={COLORS[0]}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="payouts_usd"
                  name="Payouts (USD)"
                  stroke={COLORS[2]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ROW: HOURLY ACTIVITY + BATTLE/EVENT PIE */}
        <div
          style={{
            display: "grid",
            gap: "18px",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            marginBottom: "20px",
          }}
        >
          <section style={card}>
            <h2 style={{ fontSize: "18px", marginBottom: "6px", fontWeight: 700 }}>
              Hourly Activity (last 7 days)
            </h2>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={hourly || []}>
                  <XAxis dataKey="hour_of_day" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="coins" name="Coins" fill={COLORS[1]} />
                  <Bar dataKey="gifts_count" name="Gifts" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={card}>
            <h2 style={{ fontSize: "18px", marginBottom: "6px", fontWeight: 700 }}>
              Battle vs Event Earnings
            </h2>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={battleEvent || []}
                    dataKey="coins"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label
                  >
                    {(battleEvent || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: 6 }}>
              "battle" = coins earned in battles, "event" = Troll events, "other" = normal gifts.
            </div>
          </section>
        </div>

        {/* TOP GIFTERS + TROLLTRACT BONUS BLOCK */}
        <div
          style={{
            display: "grid",
            gap: "18px",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          }}
        >
          {/* LEADERBOARD */}
          <section style={card}>
            <h2 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: 700 }}>
              Top Gifters
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.6 }}>
                  <th style={{ padding: "6px 4px" }}>#</th>
                  <th style={{ padding: "6px 4px" }}>User</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>
                    Coins Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {(topGifters || []).map((g, i) => (
                  <tr key={g.sender_id}>
                    <td style={{ padding: "6px 4px" }}>{i + 1}</td>
                    <td style={{ padding: "6px 4px" }}>
                      <div className="flex items-center gap-2">
                        {g.sender_avatar_url && (
                          <img 
                            src={g.sender_avatar_url} 
                            alt={g.sender_username}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span>{g.sender_username}</span>
                      </div>
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      {g.total_coins.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!topGifters || topGifters.length === 0) && (
                  <tr>
                    <td colSpan={3} style={{ padding: "6px 4px", opacity: 0.7 }}>
                      No gifts yet. Start going live to build your leaderboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

        </div>

        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] p-6 rounded-lg">
              <div className="animate-pulse text-white">Loading dashboard data...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: number;
  highlight?: boolean;
  isCurrency?: boolean;
  isText?: boolean;
}

function Metric({ label, value, highlight = false, isCurrency = false, isText = false }: MetricProps) {
  let display: string | number = value;

  if (!isText) {
    if (isCurrency) {
      display = `$${Number(value || 0).toFixed(2)}`;
    } else {
      display = Number(value || 0).toLocaleString();
    }
  }

  return (
    <div>
      <div style={{ fontSize: "13px", opacity: 0.6 }}>{label}</div>
      <div
        style={{
          fontSize: "22px",
          fontWeight: 700,
          marginTop: 4,
          color: highlight ? "#7CFC00" : "white",
        }}
      >
        {display}
      </div>
    </div>
  );
}
