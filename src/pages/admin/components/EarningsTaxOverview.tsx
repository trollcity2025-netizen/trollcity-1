import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { 
  DollarSign, Users, FileText, TrendingUp, Filter, 
  Calendar, X, Download, ExternalLink
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface EarningsData {
  totalLiability: number
  creatorsOverThreshold: number
  totalPayouts: number
  platformKept: number
  forms1099Sent: number
}

interface MonthlyEarnings {
  month: string
  total_usd: number
  creator_count: number
}

interface CreatorEarnings {
  user_id: string
  username: string
  total_earnings_usd: number
  reached_threshold: boolean
  form_1099_generated: boolean
  documents_status: string
  country?: string
  monthly_breakdown?: { month: string; earnings: number }[]
}

export default function EarningsTaxOverview() {
  const [loading, setLoading] = useState(false)
  const [earningsData, setEarningsData] = useState<EarningsData>({
    totalLiability: 0,
    creatorsOverThreshold: 0,
    totalPayouts: 0,
    platformKept: 0,
    forms1099Sent: 0
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyEarnings[]>([])
  const [creators, setCreators] = useState<CreatorEarnings[]>([])
  const [filteredCreators, setFilteredCreators] = useState<CreatorEarnings[]>([])
  const [selectedCreator, setSelectedCreator] = useState<CreatorEarnings | null>(null)
  const [showOnlyOver600, setShowOnlyOver600] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [sortOrder, setSortOrder] = useState<'high' | 'low'>('high')

  const loadDashboardCards = React.useCallback(async () => {
    try {
      // 1. Get creators tax status for selected year
      const { data: taxData, error: taxError } = await supabase
        .from('view_admin_creator_tax_status')
        .select('*')
        .eq('tax_year', selectedYear)

      if (taxError) throw taxError

      // 2. Get payouts for selected year
      const startDate = new Date(selectedYear, 0, 1).toISOString()
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()
      
      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('cash_amount')
        .eq('status', 'paid')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      // Calculate Metrics
      const totalLiability = taxData?.reduce((sum, item) => sum + (Number(item.total_earnings_usd) || 0), 0) || 0
      const creatorsOverThreshold = taxData?.filter(item => item.is_irs_threshold_met).length || 0
      const totalPayouts = payouts?.reduce((sum, p) => sum + (Number(p.cash_amount) || 0), 0) || 0
      const platformKept = Math.max(0, totalLiability - totalPayouts)
      const forms1099Sent = taxData?.filter(item => item.has_tax_form).length || 0

      setEarningsData({
        totalLiability,
        creatorsOverThreshold,
        totalPayouts,
        platformKept,
        forms1099Sent
      })

      // Set Creators List
      const creatorsList: CreatorEarnings[] = taxData?.map(item => ({
        user_id: item.user_id,
        username: item.username || 'Unknown',
        total_earnings_usd: Number(item.total_earnings_usd),
        reached_threshold: item.is_irs_threshold_met,
        form_1099_generated: item.has_tax_form,
        documents_status: item.document_status,
        country: 'US', // Default or fetch from profile if needed
        monthly_breakdown: [] // We can fetch this if detailed view is opened
      })) || []

      setCreators(creatorsList)

    } catch (error) {
      console.error('Error loading creators list:', error)
    }
  }, [])

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Load dashboard cards data
      await Promise.all([
        loadDashboardCards(),
        loadMonthlyEarnings(),
        loadCreatorsList()
      ])
    } catch (error) {
      console.error('Error loading earnings data:', error)
      toast.error('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }, [loadDashboardCards, loadMonthlyEarnings, loadCreatorsList])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filterAndSortCreators = React.useCallback(() => {
    let filtered = [...creators]

    // Filter by threshold
    if (showOnlyOver600) {
      filtered = filtered.filter(c => c.reached_threshold)
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortOrder === 'high') {
        return b.total_earnings_usd - a.total_earnings_usd
      } else {
        return a.total_earnings_usd - b.total_earnings_usd
      }
    })

    setFilteredCreators(filtered)
  }, [creators, showOnlyOver600, sortOrder])

  useEffect(() => {
    filterAndSortCreators()
  }, [filterAndSortCreators])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleDownload1099 = async (creator: CreatorEarnings) => {
    if (!creator.form_1099_generated) {
      toast.error('1099 form not yet generated for this creator')
      return
    }
    
    // In a real implementation, this would generate/download the PDF
    toast.info('1099 form download would be implemented here')
  }

  const handleViewStripe = (_creator: CreatorEarnings) => {
    // Open Stripe dashboard in new tab
    window.open('https://dashboard.stripe.com/customers', '_blank')
    toast.info('Opening Stripe dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Earnings & Tax Overview
        </h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <TrendingUp className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D0D0D] border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Liability</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(earningsData.totalLiability)}
          </div>
        </div>

        <div className="bg-[#0D0D0D] border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Creators Over $600</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {earningsData.creatorsOverThreshold}
          </div>
        </div>

        <div className="bg-[#0D0D0D] border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">1099 Forms Sent</span>
            <FileText className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {earningsData.forms1099Sent}
          </div>
        </div>

        <div className="bg-[#0D0D0D] border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Platform Revenue</span>
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {formatCurrency(earningsData.platformKept)}
          </div>
        </div>
      </div>

      {/* Monthly Earnings Chart */}
      <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Monthly Earnings - {selectedYear}</h3>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2C" />
              <XAxis 
                dataKey="month" 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1A1A', 
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total_usd" 
                stroke="#10B981" 
                strokeWidth={2} 
                dot={{ fill: '#10B981', r: 4 }}
                name="Total Earnings (USD)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            No earnings data for {selectedYear}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-xl p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showOnlyOver600}
              onChange={(e) => setShowOnlyOver600(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
            />
            Only Over $600
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-1 text-white text-sm"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'high' | 'low')}
            className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-1 text-white text-sm"
          >
            <option value="high">High → Low</option>
            <option value="low">Low → High</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-400">
          Showing {filteredCreators.length} of {creators.length} creators
        </div>
      </div>

      {/* Creators Table */}
      <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 bg-[#1A1A1A]">
                <th className="px-4 py-3 text-left text-gray-400">Username</th>
                <th className="px-4 py-3 text-left text-gray-400">Total $</th>
                <th className="px-4 py-3 text-left text-gray-400">Over IRS Limit?</th>
                <th className="px-4 py-3 text-left text-gray-400">1099 Sent?</th>
                <th className="px-4 py-3 text-left text-gray-400">Documents Status</th>
                <th className="px-4 py-3 text-left text-gray-400">Year</th>
                <th className="px-4 py-3 text-right text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreators.map((creator) => (
                <tr 
                  key={creator.user_id} 
                  className="border-b border-gray-800 hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                  onClick={() => setSelectedCreator(creator)}
                >
                  <td className="px-4 py-3 font-medium text-white">{creator.username}</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">
                    {formatCurrency(creator.total_earnings_usd)}
                  </td>
                  <td className="px-4 py-3">
                    {creator.reached_threshold ? (
                      <span className="text-green-400">✔ Yes</span>
                    ) : (
                      <span className="text-gray-500">❌ No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {creator.form_1099_generated ? (
                      <span className="text-green-400">✔ Yes</span>
                    ) : (
                      <span className="text-gray-500">❌ No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] ${
                      creator.documents_status === 'Submitted' ? 'bg-green-500/20 text-green-400' :
                      creator.documents_status === 'Required' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {creator.documents_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{selectedYear}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCreator(creator)
                      }}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px]"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCreators.length === 0 && (
          <div className="p-8 text-center text-gray-400">No creators found</div>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedCreator && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-purple-500/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1A1A1A] border-b border-purple-500/30 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Creator Details</h3>
              <button
                onClick={() => setSelectedCreator(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3">Creator Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Username</div>
                    <div className="text-white font-medium">{selectedCreator.username}</div>
                  </div>
                  {selectedCreator.country && (
                    <div>
                      <div className="text-gray-400">Country</div>
                      <div className="text-white">{selectedCreator.country}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-400">Total Earnings</div>
                    <div className="text-green-400 font-bold text-lg">
                      {formatCurrency(selectedCreator.total_earnings_usd)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">IRS Threshold Status</div>
                    <div className={selectedCreator.reached_threshold ? 'text-green-400' : 'text-gray-400'}>
                      {selectedCreator.reached_threshold ? 'Over $600' : 'Under $600'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown */}
              {selectedCreator.monthly_breakdown && selectedCreator.monthly_breakdown.length > 0 && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3">Monthly Earnings Breakdown</h4>
                  <div className="space-y-2">
                    {selectedCreator.monthly_breakdown.map((month, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">{month.month}</span>
                        <span className="text-white font-medium">{formatCurrency(month.earnings)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tax Reporting Status */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3">Tax Reporting Status</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">1099 Form Generated</span>
                    <span className={selectedCreator.form_1099_generated ? 'text-green-400' : 'text-gray-400'}>
                      {selectedCreator.form_1099_generated ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Documents Status</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedCreator.documents_status === 'Submitted' ? 'bg-green-500/20 text-green-400' :
                      selectedCreator.documents_status === 'Required' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {selectedCreator.documents_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleDownload1099(selectedCreator)}
                  disabled={!selectedCreator.form_1099_generated}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download 1099
                </button>
                <button
                  onClick={() => handleViewStripe(selectedCreator)}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Stripe Dashboard
                </button>
              </div>

              {/* Security Notice */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-xs text-yellow-400">
                  <strong>Security Notice:</strong> Sensitive tax information (SSN, bank details) is not displayed here. 
                  All identity verification is handled securely via third-party providers (Stripe/Persona).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

