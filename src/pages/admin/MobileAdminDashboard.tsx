import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react'

interface DashboardStats {
  totalLiability: number
  pendingPayouts: number
  irsRiskUsers: number
  pendingApplications: number
  activeBroadcasters: number
  newPayouts: number
  newApplications: number
  newReports: number
}

type TabId = 'applications' | 'payouts' | 'reports' | 'earnings'

export default function MobileAdminDashboard() {
  const { user, profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('applications')
  const [stats, setStats] = useState<DashboardStats>({
    totalLiability: 0,
    pendingPayouts: 0,
    irsRiskUsers: 0,
    pendingApplications: 0,
    activeBroadcasters: 0,
    newPayouts: 0,
    newApplications: 0,
    newReports: 0
  })
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Check admin access
    if (!user) {
      navigate('/auth')
      return
    }

    // Check admin access - support both is_admin field and role = 'admin'
    const isAdmin = profile?.role === 'admin' || (profile as any)?.is_admin === true
    if (!isAdmin) {
      toast.error('Access Denied: Admins Only 🔒')
      navigate('/')
      return
    }

    loadStats()
    setupRealtime()
  }, [user, profile, navigate])

  const loadStats = async () => {
    setLoading(true)
    try {
      // Total Payout Liability (pending + approved)
      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('net_amount, cash_amount, status')
        .in('status', ['pending', 'approved'])

      const totalLiability = payouts?.reduce((sum, p) => {
        return sum + (Number(p.net_amount) || Number(p.cash_amount) || 0)
      }, 0) || 0

      // Pending Payouts
      const { data: pendingPayoutsData } = await supabase
        .from('payout_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')

      const pendingPayouts = pendingPayoutsData?.length || 0

      // IRS Risk Users (over $600 earnings)
      const { data: earnings } = await supabase
        .from('broadcaster_earnings')
        .select('broadcaster_id, usd_value')

      const creatorTotals = new Map<string, number>()
      earnings?.forEach(e => {
        const current = creatorTotals.get(e.broadcaster_id) || 0
        creatorTotals.set(e.broadcaster_id, current + (Number(e.usd_value) || 0))
      })

      const irsRiskUsers = Array.from(creatorTotals.values()).filter(total => total >= 600).length

      // Pending Broadcaster Applications
      const { data: pendingApps } = await supabase
        .from('broadcaster_applications')
        .select('id', { count: 'exact' })
        .eq('application_status', 'pending')

      const pendingApplications = pendingApps?.length || 0

      // Active Broadcasters
      const { data: broadcasters } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact' })
        .eq('is_broadcaster', true)

      const activeBroadcasters = broadcasters?.length || 0

      // New items (last 24 hours)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const { data: newPayoutsData } = await supabase
        .from('payout_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')
        .gte('created_at', yesterday.toISOString())

      const { data: newAppsData } = await supabase
        .from('broadcaster_applications')
        .select('id', { count: 'exact' })
        .eq('application_status', 'pending')
        .gte('created_at', yesterday.toISOString())

      const { data: newReportsData } = await supabase
        .from('stream_reports')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')
        .gte('created_at', yesterday.toISOString())

      setStats({
        totalLiability,
        pendingPayouts,
        irsRiskUsers,
        pendingApplications,
        activeBroadcasters,
        newPayouts: newPayoutsData?.length || 0,
        newApplications: newAppsData?.length || 0,
        newReports: newReportsData?.length || 0
      })
    } catch (error: any) {
      console.error('Error loading stats:', error)
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtime = () => {
    // Real-time updates for payouts
    const payoutChannel = supabase
      .channel('admin_payouts_mobile')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => loadStats()
      )
      .subscribe()

    // Real-time updates for applications
    const appChannel = supabase
      .channel('admin_applications_mobile')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'broadcaster_applications' },
        () => loadStats()
      )
      .subscribe()

    // Real-time updates for reports
    const reportChannel = supabase
      .channel('admin_reports_mobile')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stream_reports' },
        () => loadStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(payoutChannel)
      supabase.removeChannel(appChannel)
      supabase.removeChannel(reportChannel)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0D0D0D] border-b border-purple-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-purple-500/20 rounded-lg"
          >
            <Menu className="w-6 h-6 text-purple-400" />
          </button>
          <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-red-500/20 rounded-lg"
        >
          <LogOut className="w-5 h-5 text-red-400" />
        </button>
      </header>

      {/* Sidebar (Mobile Drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black/80"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#0D0D0D] border-r border-purple-500/30 p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-purple-500/20 rounded-lg"
              >
                <X className="w-5 h-5 text-purple-400" />
              </button>
            </div>
            <nav className="space-y-2">
              {(['applications', 'payouts', 'reports', 'earnings'] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-purple-500/20'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'applications' && stats.newApplications > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.newApplications}
                    </span>
                  )}
                  {tab === 'payouts' && stats.newPayouts > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.newPayouts}
                    </span>
                  )}
                  {tab === 'reports' && stats.newReports > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.newReports}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-xs text-gray-400 mb-1">Total Liability</p>
                <p className="text-lg font-bold text-green-400">
                  {formatCurrency(stats.totalLiability)}
                </p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-yellow-400" />
                  {stats.newPayouts > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.newPayouts}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1">Pending Payouts</p>
                <p className="text-lg font-bold text-yellow-400">
                  {stats.pendingPayouts}
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-xs text-gray-400 mb-1">IRS Risk ($600+)</p>
                <p className="text-lg font-bold text-red-400">
                  {stats.irsRiskUsers}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  {stats.newApplications > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.newApplications}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1">Pending Apps</p>
                <p className="text-lg font-bold text-purple-400">
                  {stats.pendingApplications}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Active Broadcasters</p>
                  <p className="text-xl font-bold text-cyan-400">
                    {stats.activeBroadcasters}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tab Navigation (Mobile Bottom Bar) */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D0D0D] border-t border-purple-500/30 px-2 py-2 safe-area-bottom">
        <div className="grid grid-cols-4 gap-1">
          {([
            { id: 'applications' as TabId, label: 'Apps', icon: FileText, badge: stats.newApplications },
            { id: 'payouts' as TabId, label: 'Payouts', icon: DollarSign, badge: stats.newPayouts },
            { id: 'reports' as TabId, label: 'Reports', icon: AlertTriangle, badge: stats.newReports },
            { id: 'earnings' as TabId, label: 'Earnings', icon: TrendingUp, badge: 0 }
          ]).map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                activeTab === id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-purple-500/20'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-24 px-4">
        {activeTab === 'applications' && (
          <MobileBroadcasterApplications onStatsUpdate={loadStats} />
        )}
        {activeTab === 'payouts' && (
          <MobilePayoutQueue onStatsUpdate={loadStats} />
        )}
        {activeTab === 'reports' && (
          <MobileFlaggedReports onStatsUpdate={loadStats} />
        )}
        {activeTab === 'earnings' && (
          <MobileEarningsTax onStatsUpdate={loadStats} />
        )}
      </div>
    </div>
  )
}

// Mobile-optimized components
function MobileBroadcasterApplications({ onStatsUpdate }: { onStatsUpdate: () => void }) {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('broadcaster_applications')
        .select('*, user_profiles!broadcaster_applications_user_id_fkey(username, email)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setApplications(data || [])
    } catch (error: any) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 mt-4">
      <h2 className="text-lg font-bold text-white">Broadcaster Applications</h2>
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : applications.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No applications</div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-[#0D0D0D] border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white">
                    {app.user_profiles?.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400">{app.email}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  app.application_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  app.application_status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {app.application_status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {new Date(app.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MobilePayoutQueue({ onStatsUpdate }: { onStatsUpdate: () => void }) {
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPayouts()
  }, [])

  const loadPayouts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*, user_profiles!payout_requests_user_id_fkey(username, email)')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setPayouts(data || [])
    } catch (error: any) {
      console.error('Error loading payouts:', error)
      toast.error('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="space-y-3 mt-4">
      <h2 className="text-lg font-bold text-white">Payout Queue</h2>
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : payouts.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No pending payouts</div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-[#0D0D0D] border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white">
                    {payout.user_profiles?.username || 'Unknown'}
                  </p>
                  <p className="text-sm text-green-400 font-bold">
                    {formatCurrency(payout.net_amount || payout.cash_amount)}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  payout.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {payout.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {payout.coins_used?.toLocaleString() || 0} coins • {new Date(payout.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileFlaggedReports({ onStatsUpdate }: { onStatsUpdate: () => void }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stream_reports')
        .select('*, user_profiles!stream_reports_reporter_id_fkey(username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setReports(data || [])
    } catch (error: any) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 mt-4">
      <h2 className="text-lg font-bold text-white">Flagged Reports</h2>
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No pending reports</div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-[#0D0D0D] border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white">
                    Report by {report.user_profiles?.username || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">{report.reason}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  report.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                  report.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {report.severity?.toUpperCase() || 'MINOR'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {new Date(report.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileEarningsTax({ onStatsUpdate }: { onStatsUpdate: () => void }) {
  const [irsUsers, setIrsUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadIRSUsers()
  }, [])

  const loadIRSUsers = async () => {
    setLoading(true)
    try {
      // Get creators over $600 threshold
      const { data: earnings } = await supabase
        .from('broadcaster_earnings')
        .select('broadcaster_id, usd_value')

      const creatorTotals = new Map<string, number>()
      earnings?.forEach(e => {
        const current = creatorTotals.get(e.broadcaster_id) || 0
        creatorTotals.set(e.broadcaster_id, current + (Number(e.usd_value) || 0))
      })

      const over600 = Array.from(creatorTotals.entries())
        .filter(([_, total]) => total >= 600)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 20)

      const userIds = over600.map(([id]) => id)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || [])
      
      setIrsUsers(over600.map(([id, total]) => ({
        user_id: id,
        username: profileMap.get(id) || 'Unknown',
        total_earnings: total
      })))
    } catch (error: any) {
      console.error('Error loading IRS users:', error)
      toast.error('Failed to load IRS risk users')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="space-y-3 mt-4">
      <h2 className="text-lg font-bold text-white">IRS Risk Users ($600+)</h2>
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : irsUsers.length === 0 ? (
        <div className="text-center text-gray-400 py-8">No users over $600 threshold</div>
      ) : (
        <div className="space-y-3">
          {irsUsers.map((user) => (
            <div
              key={user.user_id}
              className="bg-[#0D0D0D] border border-red-500/30 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{user.username}</p>
                  <p className="text-sm text-red-400 font-bold mt-1">
                    {formatCurrency(user.total_earnings)}
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                  IRS RISK
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

