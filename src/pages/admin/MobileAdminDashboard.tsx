import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Briefcase,
  Settings,
  Shield,
  Gift,
  Search,
  MessageSquare,
  Database,
  Calendar,
  ChevronRight,
  ChevronLeft
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

interface SubItem {
  id: string
  label: string
  icon?: any
  type: 'tab' | 'link'
  value: string
}

interface Category {
  id: string
  label: string
  icon: any
  items: SubItem[]
}

type TabId = 'applications' | 'payouts' | 'reports' | 'earnings'

export default function MobileAdminDashboard() {
  const { user, profile, logout, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('applications')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
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

  // Menu Structure
  const menuCategories: Category[] = [
    {
      id: 'finance',
      label: 'Finance & Economy',
      icon: DollarSign,
      items: [
        { id: 'payouts', label: 'Payout Queue', icon: DollarSign, type: 'tab', value: 'payouts' },
        { id: 'earnings', label: 'Earnings & Tax', icon: TrendingUp, type: 'tab', value: 'earnings' },
        { id: 'finance_dash', label: 'Finance Dashboard', type: 'link', value: '/admin/finance' },
        { id: 'grant_coins', label: 'Grant Coins', type: 'link', value: '/admin/grant-coins' },
        { id: 'store_pricing', label: 'Store Pricing', type: 'link', value: '/admin/store-pricing' }
      ]
    },
    {
      id: 'moderation',
      label: 'Moderation',
      icon: Shield,
      items: [
        { id: 'reports', label: 'Reports Queue', icon: AlertTriangle, type: 'tab', value: 'reports' },
        { id: 'ban_mgmt', label: 'Ban Management', type: 'link', value: '/admin/ban-management' },
        { id: 'chat_mod', label: 'Chat Moderation', type: 'link', value: '/admin/chat-moderation' },
        { id: 'stream_mon', label: 'Stream Monitor', type: 'link', value: '/admin/stream-monitor' }
      ]
    },
    {
      id: 'users',
      label: 'Users & HR',
      icon: Users,
      items: [
        { id: 'applications', label: 'Broadcaster Apps', icon: FileText, type: 'tab', value: 'applications' },
        { id: 'user_search', label: 'User Search', type: 'link', value: '/admin/user-search' },
        { id: 'hr_dash', label: 'HR Dashboard', type: 'link', value: '/admin/hr' },
        { id: 'roles', label: 'Role Management', type: 'link', value: '/admin/role-management' }
      ]
    },
    {
      id: 'system',
      label: 'System',
      icon: Settings,
      items: [
        { id: 'announcements', label: 'Announcements', type: 'link', value: '/admin/announcements' },
        { id: 'sys_config', label: 'System Config', type: 'link', value: '/admin/system/config' },
        { id: 'maintenance', label: 'Maintenance', type: 'link', value: '/admin/reset-maintenance' },
        { id: 'export', label: 'Export Data', type: 'link', value: '/admin/export-data' }
      ]
    }
  ]

  const handleSubItemClick = (item: SubItem) => {
    if (item.type === 'tab') {
      setActiveTab(item.value as TabId)
      setSidebarOpen(false)
      setSelectedCategory(null)
    } else {
      navigate(item.value)
    }
  }

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const loadStats = useCallback(async () => {
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
    } catch (error) {
      console.error('Error loading stats:', error)
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }, [])

  const setupRealtime = useCallback(() => {
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
  }, [loadStats])

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return

    // Check admin access
    if (!user) {
      navigate('/auth')
      return
    }

    // Check admin access - support both is_admin field and role = 'admin'
    const isAdmin = profile?.role === 'admin' || (profile && 'is_admin' in profile && (profile as { is_admin: boolean }).is_admin === true)
    if (!isAdmin) {
      toast.error('Access Denied: Admins Only 🔒')
      navigate('/')
      return
    }

    loadStats()
    setupRealtime()
  }, [user, profile, navigate, loadStats, setupRealtime, isLoading])

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
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

      {/* Navigation Popup */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-purple-500/30 rounded-t-3xl p-6 z-[70] safe-area-bottom"
            >
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ChevronLeft size={20} className="text-white" />
                    </button>
                  )}
                  <h3 className="text-lg font-bold text-white">
                    {selectedCategory ? selectedCategory.label : 'Dashboard Menu'}
                  </h3>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {!selectedCategory ? (
                // Main Categories
                <div className="grid grid-cols-2 gap-3">
                  {menuCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category)}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <category.icon className="mb-2 w-8 h-8 text-purple-400" />
                      <span className="text-sm font-medium text-white">{category.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // Sub Items
                <div className="space-y-2">
                  {selectedCategory.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSubItemClick(item)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        item.type === 'tab' && activeTab === item.value
                          ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-900/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon && <item.icon className={`w-5 h-5 ${item.type === 'tab' && activeTab === item.value ? 'text-white' : 'text-purple-400'}`} />}
                        <span className={`text-sm font-medium ${item.type === 'tab' && activeTab === item.value ? 'text-white' : 'text-gray-300'}`}>
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${item.type === 'tab' && activeTab === item.value ? 'text-white/50' : 'text-gray-500'}`} />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      // Avoid FK-name joins (schema cache/constraint-name drift can cause PGRST200)
      const { data, error } = await supabase
        .from('broadcaster_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const raw = data || []
      const userIds = Array.from(
        new Set(raw.map((a: any) => a.user_id).filter((id: any) => typeof id === 'string' && id.length > 0)),
      )

      const profileMap = new Map<string, any>()
      if (userIds.length) {
        const { data: profiles, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, username, email')
          .in('id', userIds)

        if (profErr) {
          console.warn('Failed to hydrate user profiles (non-fatal):', profErr)
        } else {
          ;(profiles || []).forEach((p: any) => profileMap.set(p.id, p))
        }
      }

      setApplications(
        raw.map((a: any) => ({
          ...a,
          user_profiles: profileMap.get(a.user_id) || null,
        })),
      )
    } catch (error) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()

    const channel = supabase
      .channel('mobile_applications_list')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'broadcaster_applications' },
        () => {
          loadApplications()
          onStatsUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadApplications, onStatsUpdate])

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
                  <p className="text-xs text-gray-400">{app.user_profiles?.email || ''}</p>
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

interface Payout {
  id: string
  user_id: string
  amount: number
  net_amount?: number
  cash_amount?: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  coins_used?: number
  user_profiles?: {
    username: string
    email: string
  } | null
}

function MobilePayoutQueue({ onStatsUpdate }: { onStatsUpdate: () => void }) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(false)

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    try {
      // Avoid FK-name joins (schema cache/constraint-name drift can cause PGRST200)
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const raw = (data || []) as Payout[]
      const userIds = Array.from(
        new Set(raw.map((p) => p.user_id).filter((id) => typeof id === 'string' && id.length > 0)),
      )

      const profileMap = new Map<string, { id: string; username: string; email: string }>()
      if (userIds.length) {
        const { data: profiles, error: profErr } = await supabase
          .from('user_profiles')
          .select('id, username, email')
          .in('id', userIds)

        if (profErr) {
          console.warn('Failed to hydrate user profiles (non-fatal):', profErr)
        } else {
          ;(profiles || []).forEach((p) => profileMap.set(p.id, p))
        }
      }

      setPayouts(
        raw.map((p) => ({
          ...p,
          user_profiles: profileMap.get(p.user_id) || null,
        })),
      )
    } catch (error: unknown) {
      console.error('Error loading payouts:', error)
      toast.error('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayouts()

    const channel = supabase
      .channel('mobile_payouts_queue')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => {
          loadPayouts()
          onStatsUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadPayouts, onStatsUpdate])

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

  const loadReports = useCallback(async () => {
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
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()

    const channel = supabase
      .channel('mobile_reports_list')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stream_reports' },
        () => {
          loadReports()
          onStatsUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadReports, onStatsUpdate])

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

  const loadIRSUsers = useCallback(async () => {
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
    } catch (error) {
      console.error('Error loading IRS users:', error)
      toast.error('Failed to load IRS risk users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIRSUsers()

    const channel = supabase
      .channel('mobile_earnings_tax')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'broadcaster_earnings' },
        () => {
          loadIRSUsers()
          onStatsUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadIRSUsers, onStatsUpdate])

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

