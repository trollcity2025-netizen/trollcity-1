/**
 * AnalyticsTab Component
 * 
 * Dashboard tab for viewing TCNN analytics and statistics
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Card } from '@/components/ui/card';
import {
  BarChart3,
  Eye,
  Coins,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AnalyticsData {
  totalArticles: number;
  totalViews: number;
  totalTips: number;
  totalTipAmount: number;
  articlesByCategory: { name: string; value: number }[];
  viewsOverTime: { date: string; views: number }[];
  topArticles: { id: string; title: string; views: number; tips: number }[];
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AnalyticsTab() {
  const { user } = useAuthStore();
  const { isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<AnalyticsData>({
    totalArticles: 0,
    totalViews: 0,
    totalTips: 0,
    totalTipAmount: 0,
    articlesByCategory: [],
    viewsOverTime: [],
    topArticles: []
  });

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get total articles
      const { count: totalArticles } = await supabase
        .from('tcnn_articles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      // Get total views
      const { data: viewsData } = await supabase
        .from('tcnn_articles')
        .select('view_count')
        .eq('status', 'published');

      const totalViews = viewsData?.reduce((sum, article) => sum + (article.view_count || 0), 0) || 0;

      // Get total tips
      const { count: totalTips } = await supabase
        .from('tcnn_tips')
        .select('*', { count: 'exact', head: true });

      // Get total tip amount
      const { data: tipsData } = await supabase
        .from('tcnn_tips')
        .select('amount');

      const totalTipAmount = tipsData?.reduce((sum, tip) => sum + (tip.amount || 0), 0) || 0;

      // Get articles by category
      const { data: categoryData } = await supabase
        .from('tcnn_articles')
        .select('category')
        .eq('status', 'published');

      const categoryCounts: Record<string, number> = {};
      categoryData?.forEach(article => {
        categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
      });

      const articlesByCategory = Object.entries(categoryCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      // Get views over time - using published articles as activity indicator
      // Note: For accurate daily view tracking, a separate view tracking table would be needed
      const { data: articlesByDay } = await supabase
        .from('tcnn_articles')
        .select('published_at, view_count')
        .eq('status', 'published')
        .gte('published_at', startDate.toISOString());

      // Group views by day
      const viewsByDay: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateKey = date.toLocaleDateString('en-US', { weekday: 'short' });
        viewsByDay[dateKey] = 0;
      }

      // Aggregate view counts by publish day (approximation)
      articlesByDay?.forEach(article => {
        if (article.published_at) {
          const date = new Date(article.published_at);
          const dateKey = date.toLocaleDateString('en-US', { weekday: 'short' });
          if (Object.prototype.hasOwnProperty.call(viewsByDay, dateKey)) {
            viewsByDay[dateKey] += article.view_count || 0;
          }
        }
      });

      const viewsOverTime = Object.entries(viewsByDay).map(([date, views]) => ({
        date,
        views
      }));

      // Get top articles
      const { data: topArticlesData } = await supabase
        .from('tcnn_articles')
        .select('id, title, view_count, tip_count')
        .eq('status', 'published')
        .order('view_count', { ascending: false })
        .limit(5);

      const topArticles = topArticlesData?.map(article => ({
        id: article.id,
        title: article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title,
        views: article.view_count || 0,
        tips: article.tip_count || 0
      })) || [];

      setData({
        totalArticles: totalArticles || 0,
        totalViews,
        totalTips: totalTips || 0,
        totalTipAmount,
        articlesByCategory,
        viewsOverTime,
        topArticles
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          TCNN Analytics
        </h2>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.totalArticles}</p>
              <p className="text-sm text-gray-400">Published Articles</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.totalViews.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Total Views</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.totalTips}</p>
              <p className="text-sm text-gray-400">Tips Received</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.totalTipAmount.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Coins Tipped</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Over Time */}
        <Card className="bg-slate-900/50 border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Views Over Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.viewsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Articles by Category */}
        <Card className="bg-slate-900/50 border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            Articles by Category
          </h3>
          <div className="h-64">
            {data.articlesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.articlesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.articlesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No category data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top Articles */}
      <Card className="bg-slate-900/50 border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" />
          Top Performing Articles
        </h3>
        {data.topArticles.length > 0 ? (
          <div className="space-y-3">
            {data.topArticles.map((article, index) => (
              <div
                key={article.id}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-white font-medium">{article.title}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {article.views.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Coins className="w-4 h-4" />
                    {article.tips}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No articles published yet</p>
        )}
      </Card>

      {/* Chief-only Section */}
      {isChiefNewsCaster && (
        <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Chief News Caster Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <p className="text-3xl font-bold text-white">{data.totalArticles}</p>
              <p className="text-sm text-gray-400 mt-1">Total Published</p>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <p className="text-3xl font-bold text-white">{data.totalViews.toLocaleString()}</p>
              <p className="text-sm text-gray-400 mt-1">Total Readership</p>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-400">{data.totalTipAmount.toLocaleString()}</p>
              <p className="text-sm text-gray-400 mt-1">Total Tips (Coins)</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
