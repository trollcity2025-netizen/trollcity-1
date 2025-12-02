import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Download, Filter, Search, DollarSign, Coins, TrendingUp, FileText } from 'lucide-react'

interface Transaction {
  id: string
  user_id: string
  coins_purchased: number
  amount_paid: number
  payment_id: string | null
  receipt_url: string | null
  status: 'completed' | 'failed' | 'pending'
  created_at: string
  user_profiles: {
    username: string
  } | null
}

interface UserStats {
  userId: string
  username: string
  totalSpent: number
  totalCoins: number
  transactionCount: number
}

export default function PaymentsDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'pending'>('all')
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })

  // Check admin access
  useEffect(() => {
    if (profile && !['admin', 'troll_officer'].includes(profile.role)) {
      toast.error('Access denied')
      navigate('/', { replace: true })
    }
  }, [profile, navigate])

  // Load transactions
  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          coins_purchased,
          amount_paid,
          payment_id,
          receipt_url,
          status,
          created_at,
          user_profiles:user_id (
            username,
            square_card_id
          )
        `)
        .eq('type', 'coin_purchase')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      // Transform data to match Transaction interface
      const transformed = (data || []).map((tx: any) => ({
        ...tx,
        user_profiles: Array.isArray(tx.user_profiles) ? tx.user_profiles[0] : tx.user_profiles
      }))

      setTransactions(transformed as Transaction[])
    } catch (error: any) {
      console.error('Failed to load transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = 
          tx.user_profiles?.username?.toLowerCase().includes(searchLower) ||
          tx.payment_id?.toLowerCase().includes(searchLower) ||
          tx.user_id.toLowerCase().includes(searchLower)
        
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) {
        return false
      }

      // Date filter
      if (dateFilter.start || dateFilter.end) {
        const txDate = new Date(tx.created_at)
        if (dateFilter.start && txDate < new Date(dateFilter.start)) return false
        if (dateFilter.end) {
          const endDate = new Date(dateFilter.end)
          endDate.setHours(23, 59, 59, 999)
          if (txDate > endDate) return false
        }
      }

      return true
    })
  }, [transactions, searchTerm, statusFilter, dateFilter])

  // Calculate stats
  const stats = useMemo(() => {
    const completed = filteredTransactions.filter(tx => tx.status === 'completed')
    const totalRevenue = completed.reduce((sum, tx) => sum + (tx.amount_paid || 0), 0)
    const totalCoins = completed.reduce((sum, tx) => sum + (tx.coins_purchased || 0), 0)
    
    // Top buyers
    const userSpending: Record<string, UserStats> = {}
    completed.forEach(tx => {
      const userId = tx.user_id
      if (!userSpending[userId]) {
        userSpending[userId] = {
          userId,
          username: tx.user_profiles?.username || 'Unknown',
          totalSpent: 0,
          totalCoins: 0,
          transactionCount: 0
        }
      }
      userSpending[userId].totalSpent += tx.amount_paid || 0
      userSpending[userId].totalCoins += tx.coins_purchased || 0
      userSpending[userId].transactionCount += 1
    })

    const topBuyers = Object.values(userSpending)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)

    // Users over $600 threshold (IRS 1099)
    const over600 = Object.values(userSpending)
      .filter(u => u.totalSpent >= 600)
      .sort((a, b) => b.totalSpent - a.totalSpent)

    return {
      totalRevenue,
      totalCoins,
      totalTransactions: completed.length,
      topBuyers,
      over600
    }
  }, [filteredTransactions])

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'User', 'User ID', 'Coins', 'Amount', 'Status', 'Payment ID', 'Receipt URL']
    const rows = filteredTransactions.map(tx => [
      new Date(tx.created_at).toLocaleString(),
      tx.user_profiles?.username || 'Unknown',
      tx.user_id,
      tx.coins_purchased || 0,
      `$${(tx.amount_paid || 0).toFixed(2)}`,
      tx.status,
      tx.payment_id || '',
      tx.receipt_url || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast.success('Transactions exported to CSV')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
            <p className="mt-4">Loading transactions...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Payments Dashboard</h1>
          <p className="text-gray-400">View and manage all coin purchase transactions</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">Total Coins Sold</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalCoins.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Transactions</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalTransactions}</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">Over $600 (1099)</span>
            </div>
            <p className="text-2xl font-bold">{stats.over600.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="User, Payment ID..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Start Date</label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">End Date</label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setDateFilter({ start: '', end: '' })
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Top Buyers */}
        {stats.topBuyers.length > 0 && (
          <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 p-4 mb-6">
            <h2 className="text-xl font-bold mb-4">Top 5 Buyers</h2>
            <div className="space-y-2">
              {stats.topBuyers.map((buyer, idx) => (
                <div key={buyer.userId} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400 font-bold">#{idx + 1}</span>
                    <span>{buyer.username}</span>
                    <span className="text-gray-400 text-sm">({buyer.transactionCount} transactions)</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${buyer.totalSpent.toFixed(2)}</div>
                    <div className="text-sm text-gray-400">{buyer.totalCoins.toLocaleString()} coins</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IRS 1099 Threshold */}
        {stats.over600.length > 0 && (
          <div className="bg-red-900/20 backdrop-blur-md rounded-lg border border-red-500/30 p-4 mb-6">
            <h2 className="text-xl font-bold mb-4 text-red-400">⚠️ Users Over $600 (IRS 1099 Required)</h2>
            <div className="space-y-2">
              {stats.over600.map((buyer) => (
                <div key={buyer.userId} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                  <div>
                    <span className="font-semibold">{buyer.username}</span>
                    <span className="text-gray-400 text-sm ml-2">({buyer.transactionCount} transactions)</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-400">${buyer.totalSpent.toFixed(2)}</div>
                    <div className="text-sm text-gray-400">{buyer.totalCoins.toLocaleString()} coins</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-gray-900/50 backdrop-blur-md rounded-lg border border-purple-500/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Coins</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Payment Method</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Payment ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">{tx.user_profiles?.username || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">{tx.user_id.substring(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{tx.coins_purchased?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-sm font-semibold">${(tx.amount_paid || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                          tx.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                          'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {tx.user_profiles?.square_card_id ? (
                          <span className="px-2 py-1 rounded text-xs bg-purple-900/50 text-purple-400 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            Stored Card
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-blue-900/50 text-blue-400">
                            Checkout
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs text-gray-400">
                        {tx.payment_id || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {tx.receipt_url ? (
                          <a
                            href={tx.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

