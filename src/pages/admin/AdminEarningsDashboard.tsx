import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { 
  Loader, Shield, AlertCircle, DollarSign, Users, 
  FileText, Download, Filter, Search, Calendar,
  TrendingUp, CheckCircle, XCircle, Clock
} from 'lucide-react'
import { EarningsView } from '../../types/earnings'

interface CreatorEarnings extends EarningsView {
  // Extended for admin view
  w9_status?: string
}

interface MonthlyBreakdown {
  user_id: string
  username: string
  month: string
  coins_earned_from_gifts: number
  gift_count: number
  unique_gifters: number
  paid_coins_earned: number
  free_coins_earned: number
}

interface PayoutHistory {
  id: string
  user_id: string
  username: string
  cash_amount: number
  coins_redeemed: number
  status: string
  created_at: string
  processed_at?: string
  admin_username?: string
  usd_equivalent: number
}

interface IRSThreshold {
  user_id: string
  username: string
  year: number
  total_paid_usd: number
  payout_count: number
  requires_1099: boolean
  threshold_status: string
  last_payout_date: string
}

const AdminEarningsDashboard: React.FC = () => {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [creators, setCreators] = useState<CreatorEarnings[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyBreakdown[]>([])
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([])
  const [irsThresholds, setIrsThresholds] = useState<IRSThreshold[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'over_threshold' | 'nearing_threshold' | 'below_threshold'>('all')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [sortBy, setSortBy] = useState<'earnings' | 'payouts' | 'threshold'>('earnings')

  // Strict admin-only check
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Access denied. Admin only.')
      navigate('/')
      return
    }
  }, [profile, navigate])

  useEffect(() => {
    if (profile?.role !== 'admin') {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        await Promise.all([
          loadCreators(),
          loadMonthlyData(),
          loadPayoutHistory(),
          loadIRSThresholds()
        ])
      } catch (err) {
        console.error('Error fetching earnings data:', err)
        toast.error('Failed to load earnings data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, selectedYear])

  const loadCreators = async () => {
    try {
      // Try to load from earnings_view first, but fallback to user_profiles if it doesn't exist
      const { data, error } = await supabase
        .from('earnings_view')
        .select('*')
        .order('total_earned_coins', { ascending: false })

      if (error) {
        console.warn('earnings_view not found, using fallback:', error)
        throw error // Will trigger fallback
      }
      
      if (data) {
        setCreators(data as CreatorEarnings[])
        return // Success, exit early
      }
    } catch (err: any) {
      // Fallback: load from user_profiles
      console.log('Using fallback: loading from user_profiles')
      const { data, error: fallbackError } = await supabase
        .from('user_profiles')
        .select('id, username, total_earned_coins, troll_coins, free_coin_balance')
        .gt('total_earned_coins', 0)
        .order('total_earned_coins', { ascending: false })
        .limit(100)
      
      if (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        return
      }
      
      if (data) {
        setCreators(data.map(p => ({
          id: p.id,
          username: p.username || '',
          total_earned_coins: p.total_earned_coins || 0,
          troll_coins: p.troll_coins || 0,
          free_coin_balance: p.free_coin_balance || 0,
          current_month_earnings: 0,
          current_month_transactions: 0,
          current_month_paid_out: 0,
          current_month_pending: 0,
          current_month_approved: 0,
          current_month_paid_count: 0,
          current_month_pending_count: 0,
          yearly_paid_usd: 0,
          yearly_payout_count: 0,
          tax_year: new Date().getFullYear(),
          irs_threshold_status: 'below_threshold' as const,
          last_payout_at: null,
          pending_requests_count: 0,
          lifetime_paid_usd: 0
        })))
      }
    }
  }

  const loadMonthlyData = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_earnings_breakdown')
        .select('*')
        .order('month', { ascending: false })
        .limit(500)

      if (error) {
        console.warn('monthly_earnings_breakdown not found, using empty array')
        setMonthlyData([])
        return
      }
      setMonthlyData(data || [])
    } catch (err: any) {
      console.warn('Error loading monthly data (non-critical):', err)
      setMonthlyData([]) // Set empty array instead of failing
    }
  }

  const loadPayoutHistory = async () => {
    try {
      // Try payout_history_view first, fallback to payout_requests
      const { data, error } = await supabase
        .from('payout_history_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        console.warn('payout_history_view not found, using payout_requests fallback')
        // Fallback to payout_requests table
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('payout_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
        
        if (fallbackError) {
          console.error('Fallback also failed:', fallbackError)
          setPayoutHistory([])
          return
        }
        setPayoutHistory(fallbackData || [])
        return
      }
      setPayoutHistory(data || [])
    } catch (err: any) {
      console.warn('Error loading payout history (non-critical):', err)
      setPayoutHistory([]) // Set empty array instead of failing
    }
  }

  const loadIRSThresholds = async () => {
    try {
      const { data, error } = await supabase
        .from('irs_threshold_tracking')
        .select('*')
        .eq('year', selectedYear)
        .order('total_paid_usd', { ascending: false })

      if (error) {
        console.warn('irs_threshold_tracking not found, using empty array')
        setIrsThresholds([])
        return
      }
      setIrsThresholds(data || [])
    } catch (err: any) {
      console.warn('Error loading IRS thresholds (non-critical):', err)
      setIrsThresholds([]) // Set empty array instead of failing
    }
  }

  const filteredCreators = useMemo(() => {
    let filtered = creators

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.username.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.irs_threshold_status === statusFilter)
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'earnings':
          return b.total_earned_coins - a.total_earned_coins
        case 'payouts':
          return b.lifetime_paid_usd - a.lifetime_paid_usd
        case 'threshold':
          return b.yearly_paid_usd - a.yearly_paid_usd
        default:
          return 0
      }
    })

    return filtered
  }, [creators, searchTerm, statusFilter, sortBy])


  const exportToCSV = async () => {
    try {
      // Fetch additional user data for CSV (address, tax_id_last4, etc.)
      const userIds = filteredCreators.map(c => c.id)
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, username, address_line1, city, state_region, postal_code, tax_id_last4')
        .in('id', userIds)

      const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

      const headers = [
        'Username',
        'Total Earned (Coins)',
        'Total Earned (USD Est)',
        'Current Month Earnings',
        'Yearly Paid (USD)',
        'Lifetime Paid (USD)',
        'IRS Threshold Status',
        'Pending Requests',
        'Last Payout',
        'Address',
        'Tax ID Last 4'
      ]

      const rows = filteredCreators.map(c => {
        const profile = profileMap.get(c.id)
        const address = profile 
          ? `${profile.address_line1 || ''}, ${profile.city || ''}, ${profile.state_region || ''} ${profile.postal_code || ''}`.trim()
          : ''
        
        return [
          c.username,
          c.total_earned_coins,
          (c.total_earned_coins * 0.0001).toFixed(2), // USD estimate
          c.current_month_earnings,
          c.yearly_paid_usd.toFixed(2),
          c.lifetime_paid_usd.toFixed(2),
          c.irs_threshold_status,
          c.pending_requests_count,
          c.last_payout_at ? new Date(c.last_payout_at).toLocaleDateString() : 'Never',
          address,
          profile?.tax_id_last4 || ''
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trollcity_earnings_report_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Earnings report downloaded')
    } catch (err: any) {
      console.error('Error exporting CSV:', err)
      toast.error('Failed to export CSV')
    }
  }

  const exportPayoutHistoryCSV = () => {
    const headers = [
      'Date',
      'Username',
      'Coins Redeemed',
      'Cash Amount (USD)',
      'Status',
      'Processed At',
      'Admin'
    ]

    const rows = payoutHistory.map(p => [
      new Date(p.created_at).toLocaleDateString(),
      p.username,
      p.coins_redeemed,
      p.cash_amount.toFixed(2),
      p.status,
      p.processed_at ? new Date(p.processed_at).toLocaleDateString() : '',
      p.admin_username || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trollcity_payout_history_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Payout history downloaded')
  }

  // Show access denied for non-admins
  if (profile && profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1A1A1A] border border-red-500/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300 mb-4">
            This dashboard is restricted to administrators only.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white bg-[#0A0814]">
        <div className="text-center">
          <Loader className="animate-spin w-8 h-8 mx-auto mb-4" />
          <p>Loading creator earnings data...</p>
        </div>
      </div>
    )
  }

  const totalEarnings = creators.reduce((sum, c) => sum + c.total_earned_coins, 0)
  const totalPaidOut = creators.reduce((sum, c) => sum + c.lifetime_paid_usd, 0)
  const overThresholdCount = creators.filter(c => c.irs_threshold_status === 'over_threshold').length
  const pendingRequests = creators.reduce((sum, c) => sum + c.pending_requests_count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-400" />
              Creator Earnings Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Comprehensive earnings tracking and payout management</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV for Accountant
            </button>
            <button
              type="button"
              onClick={exportPayoutHistoryCSV}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Payout History
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {totalEarnings.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">coins across all creators</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Total Paid Out</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              ${totalPaidOut.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">lifetime payouts</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-gray-400">Over $600 Threshold</span>
            </div>
            <p className="text-2xl font-bold text-red-400">
              {overThresholdCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">creators requiring 1099</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Pending Requests</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {pendingRequests}
            </p>
            <p className="text-xs text-gray-500 mt-1">awaiting review</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="all">All Threshold Status</option>
              <option value="over_threshold">Over $600</option>
              <option value="nearing_threshold">Nearing $600</option>
              <option value="below_threshold">Below $600</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="earnings">Sort by Earnings</option>
              <option value="payouts">Sort by Payouts</option>
              <option value="threshold">Sort by Threshold</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Creators Table */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Creator Earnings ({filteredCreators.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2">Username</th>
                    <th className="text-right py-2">Total Earned Coins</th>
                    <th className="text-right py-2">Converted USD Est</th>
                    <th className="text-right py-2">Pending Payout</th>
                    <th className="text-left py-2">Last Payout Date</th>
                    <th className="text-center py-2">Status Badge</th>
                  </tr>
                </thead>
              <tbody>
                {filteredCreators.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      No creators found
                    </td>
                  </tr>
                ) : (
                  filteredCreators.map((creator) => {
                    const pendingPayout = creator.current_month_pending || 0
                    const needsW9 = creator.w9_status && creator.w9_status !== 'submitted' && creator.w9_status !== 'verified'
                    const isOverThreshold = creator.irs_threshold_status === 'over_threshold'
                    
                    let statusBadge = 'Active'
                    let statusColor = 'bg-green-900 text-green-300'
                    
                    if (isOverThreshold) {
                      statusBadge = 'Over-Threshold'
                      statusColor = 'bg-red-900 text-red-300'
                    } else if (needsW9) {
                      statusBadge = 'Needs W9'
                      statusColor = 'bg-yellow-900 text-yellow-300'
                    }

                    return (
                      <tr key={creator.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/profile/${creator.username}`)}
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            {creator.username}
                          </button>
                        </td>
                        <td className="text-right py-2 text-green-400 font-semibold">
                          {creator.total_earned_coins.toLocaleString()}
                        </td>
                        <td className="text-right py-2 text-gray-300">
                          ${(creator.total_earned_coins * 0.0001).toFixed(2)}
                        </td>
                        <td className="text-right py-2">
                          {pendingPayout > 0 ? (
                            <span className="text-yellow-400 font-semibold">
                              ${pendingPayout.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-400 text-xs">
                          {creator.last_payout_at 
                            ? new Date(creator.last_payout_at).toLocaleDateString()
                            : 'Never'
                          }
                        </td>
                        <td className="text-center py-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                            {statusBadge}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* IRS Threshold Tracking */}
        {irsThresholds.length > 0 && (
          <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              IRS 1099 Threshold Tracking ({selectedYear})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2">Creator</th>
                    <th className="text-right py-2">Total Paid (USD)</th>
                    <th className="text-right py-2">Payout Count</th>
                    <th className="text-center py-2">1099 Required</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-left py-2">Last Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {irsThresholds.map((threshold) => (
                    <tr key={`${threshold.user_id}-${threshold.year}`} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${threshold.username}`)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          {threshold.username}
                        </button>
                      </td>
                      <td className="text-right py-2 font-semibold text-red-400">
                        ${threshold.total_paid_usd.toFixed(2)}
                      </td>
                      <td className="text-right py-2 text-gray-300">
                        {threshold.payout_count}
                      </td>
                      <td className="text-center py-2">
                        {threshold.requires_1099 ? (
                          <CheckCircle className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-500 mx-auto" />
                        )}
                      </td>
                      <td className="text-center py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          threshold.threshold_status === 'REQUIRED' ? 'bg-red-900 text-red-300' :
                          threshold.threshold_status === 'WARNING' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-green-900 text-green-300'
                        }`}>
                          {threshold.threshold_status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(threshold.last_payout_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payout History */}
        {payoutHistory.length > 0 && (
          <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Recent Payout History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Creator</th>
                    <th className="text-right py-2">Coins</th>
                    <th className="text-right py-2">Amount (USD)</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-left py-2">Processed By</th>
                    <th className="text-left py-2">Processed At</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((payout) => (
                    <tr key={payout.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 text-gray-300">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${payout.username}`)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {payout.username}
                        </button>
                      </td>
                      <td className="text-right py-2 text-gray-300">
                        {payout.coins_redeemed?.toLocaleString() || 0}
                      </td>
                      <td className="text-right py-2 font-semibold text-green-400">
                        ${payout.cash_amount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="text-center py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          payout.status === 'paid' ? 'bg-green-900 text-green-300' :
                          payout.status === 'approved' ? 'bg-blue-900 text-blue-300' :
                          payout.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-red-900 text-red-300'
                        }`}>
                          {payout.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {payout.admin_username || '—'}
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {payout.processed_at 
                          ? new Date(payout.processed_at).toLocaleDateString()
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminEarningsDashboard
