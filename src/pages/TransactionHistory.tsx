import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ShoppingCart, 
  Gift, 
  Sparkles, 
  DollarSign,
  Settings,
  TrendingUp,
  Award,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'

interface CoinTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  coin_type: 'paid' | 'free'
  source: string
  description: string
  metadata: any
  balance_after: number
  created_at: string
  platform_profit?: number
  liability?: number
}

const TRANSACTION_ICONS: Record<string, any> = {
  store_purchase: ShoppingCart,
  gift_sent: Gift,
  gift_received: Gift,
  wheel_spin: Sparkles,
  wheel_prize: Award,
  cashout: DollarSign,
  adjustment: Settings,
  bonus: TrendingUp,
  initial_balance: Sparkles,
  refund: ArrowUpRight,
  kick_fee: ArrowDownRight,
  ban_fee: ArrowDownRight,
  entrance_effect: Sparkles,
  insurance: Settings
}

const TRANSACTION_COLORS: Record<string, string> = {
  store_purchase: 'text-green-500',
  gift_sent: 'text-pink-500',
  gift_received: 'text-purple-500',
  wheel_spin: 'text-yellow-500',
  wheel_prize: 'text-yellow-500',
  cashout: 'text-red-500',
  adjustment: 'text-blue-500',
  bonus: 'text-green-500',
  initial_balance: 'text-blue-500',
  refund: 'text-green-500',
  kick_fee: 'text-red-500',
  ban_fee: 'text-red-500',
  entrance_effect: 'text-purple-500',
  insurance: 'text-blue-500'
}

export default function TransactionHistory() {
  const user = useAuthStore((s) => s.user)
  const [transactions, setTransactions] = useState<CoinTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalEarned: 0,
    totalPurchased: 0,
    totalFree: 0
  })

  useEffect(() => {
    if (!user?.id) return
    loadTransactions()
  }, [user?.id, filter])

  async function loadTransactions() {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      let query = supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('type', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setTransactions(data || [])

      // Calculate stats
      if (data) {
        const calculatedStats = data.reduce(
          (acc, tx) => {
            if (tx.amount > 0) {
              acc.totalEarned += tx.amount
              if (tx.coin_type === 'paid') {
                acc.totalPurchased += tx.amount
              } else {
                acc.totalFree += tx.amount
              }
            } else {
              acc.totalSpent += Math.abs(tx.amount)
            }
            return acc
          },
          { totalSpent: 0, totalEarned: 0, totalPurchased: 0, totalFree: 0 }
        )
        setStats(calculatedStats)
      }
    } catch (error: any) {
      console.error('Failed to load transactions:', error)
      toast.error('Failed to load transaction history')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  function formatTransactionType(type: string) {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const uniqueTypes = Array.from(new Set(transactions.map(t => t.type)))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading transactions...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
          <p className="text-gray-400">Your complete coin activity log</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <ArrowUpRight size={16} />
              <span className="text-xs font-medium">Earned</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalEarned.toLocaleString()}</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <ArrowDownRight size={16} />
              <span className="text-xs font-medium">Spent</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalSpent.toLocaleString()}</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-yellow-500 mb-1">
              <ShoppingCart size={16} />
              <span className="text-xs font-medium">Purchased</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalPurchased.toLocaleString()}</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-purple-500 mb-1">
              <Sparkles size={16} />
              <span className="text-xs font-medium">Free</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalFree.toLocaleString()}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Filter by Type</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {uniqueTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  filter === type
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {formatTransactionType(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No transactions yet</p>
              <p className="text-gray-500 text-sm mt-2">Your coin activity will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {transactions.map((tx) => {
                const Icon = TRANSACTION_ICONS[tx.type] || Settings
                const colorClass = TRANSACTION_COLORS[tx.type] || 'text-gray-400'
                const isCredit = tx.amount > 0

                return (
                  <div key={tx.id} className="p-4 hover:bg-gray-700/30 transition">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg bg-gray-700/50 ${colorClass}`}>
                        <Icon size={20} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-white font-medium">
                              {formatTransactionType(tx.type)}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1">{tx.description}</p>
                            {tx.metadata?.package_name && (
                              <span className="inline-block mt-2 px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                                {tx.metadata.package_name}
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <div className={`text-lg font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                              {isCredit ? '+' : ''}{tx.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Balance: {(tx.balance_after || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span>{formatDate(tx.created_at)}</span>
                          <span>•</span>
                          <span className={tx.coin_type === 'paid' ? 'text-yellow-500' : 'text-purple-500'}>
                            {tx.coin_type === 'paid' ? 'Paid' : 'Free'} Coins
                          </span>
                          {tx.source && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{tx.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {transactions.length >= 100 && (
          <p className="text-center text-gray-500 text-sm mt-4">
            Showing last 100 transactions
          </p>
        )}
      </div>
    </div>
  )
}
