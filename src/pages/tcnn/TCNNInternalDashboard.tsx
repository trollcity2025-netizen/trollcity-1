/**
 * TCNNInternalDashboard Component
 *
 * Internal dashboard for TCNN staff (Journalists, News Casters, Chief News Caster)
 * Tabs: Articles, Pending Approvals, Ticker Queue, Live Control, Role Management, Analytics
 */
import { useState, useEffect } from 'react';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  CheckCircle, 
  Radio, 
  Users, 
  BarChart3,
  Plus,
  Newspaper,
  Settings,
  Loader2
} from 'lucide-react';
import { trollCityTheme } from '@/styles/trollCityTheme';

// Tab Components
import ArticlesTab from '@/components/tcnn/dashboard/ArticlesTab';
import PendingApprovalsTab from '@/components/tcnn/dashboard/PendingApprovalsTab';
import TickerQueueTab from '@/components/tcnn/dashboard/TickerQueueTab';
import LiveControlTab from '@/components/tcnn/dashboard/LiveControlTab';
import RoleManagementTab from '@/components/tcnn/dashboard/RoleManagementTab';
import AnalyticsTab from '@/components/tcnn/dashboard/AnalyticsTab';

interface DashboardStats {
  published: number;
  pending: number;
  viewsToday: number;
}

export default function TCNNInternalDashboard() {
  const [activeTab, setActiveTab] = useState('articles');
  const [stats, setStats] = useState<DashboardStats>({ published: 0, pending: 0, viewsToday: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const { user } = useAuthStore();
  const {
    isJournalist,
    isNewsCaster,
    isChiefNewsCaster,
    hasAnyRole,
    canApproveArticles,
    canApproveTickers,
    canManageRoles,
  } = useTCNNRoles(user?.id);

  // Fetch real stats from Supabase
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        // Get published count
        const { count: publishedCount } = await supabase
          .from('tcnn_articles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published');

        // Get pending count (for approval)
        const { count: pendingCount } = await supabase
          .from('tcnn_articles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_review');

        // Get today's views - articles updated today with view_count increases
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const { data: todayViewsData } = await supabase
          .from('tcnn_articles')
          .select('view_count')
          .gte('updated_at', todayISO);

        // Sum up today's views from articles that had activity today
        // Note: For accurate "views today" you'd need a separate view tracking table
        // This is an approximation based on articles with activity today
        const viewsToday = todayViewsData?.reduce((sum, article) => sum + (article.view_count || 0), 0) || 0;

        setStats({
          published: publishedCount || 0,
          pending: pendingCount || 0,
          viewsToday: viewsToday
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if no TCNN role
  if (!hasAnyRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-white/60">This area is restricted to TCNN staff.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'articles', label: 'Articles', icon: FileText, show: true },
    { id: 'approvals', label: 'Pending Approvals', icon: CheckCircle, show: canApproveArticles },
    { id: 'ticker', label: 'Ticker Queue', icon: Newspaper, show: isNewsCaster || isChiefNewsCaster },
    { id: 'live', label: 'Live Control', icon: Radio, show: isNewsCaster || isChiefNewsCaster },
    { id: 'roles', label: 'Role Management', icon: Users, show: canManageRoles },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, show: true },
  ].filter(tab => tab.show);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'articles':
        return <ArticlesTab />;
      case 'approvals':
        return <PendingApprovalsTab />;
      case 'ticker':
        return <TickerQueueTab />;
      case 'live':
        return <LiveControlTab />;
      case 'roles':
        return <RoleManagementTab />;
      case 'analytics':
        return <AnalyticsTab />;
      default:
        return <ArticlesTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-500/20">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">TCNN Dashboard</h1>
                <p className="text-xs text-white/50">TCNN Staff Access</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6">
              {statsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{stats.published}</p>
                    <p className="text-[10px] text-white/50 uppercase">Published</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
                    <p className="text-[10px] text-white/50 uppercase">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-400">
                      {stats.viewsToday >= 1000 
                        ? `${(stats.viewsToday / 1000).toFixed(1)}k` 
                        : stats.viewsToday}
                    </p>
                    <p className="text-[10px] text-white/50 uppercase">Views Today</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${activeTab === tab.id 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderTabContent()}
      </main>
    </div>
  );
}