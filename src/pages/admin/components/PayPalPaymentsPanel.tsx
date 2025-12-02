import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { CreditCard, RefreshCw, CheckCircle, XCircle, Search, Filter } from 'lucide-react'

interface PayPalTransaction {
  id: string
  user_id: string
  coins: number
  amount_usd: number | null
  paypal_order_id: string | null
  external_id: string | null
  payment_status: string | null
  payment_provider: string | null
  created_at: string
  user_profiles?: {
    username: string | null
    email: string | null
  }
}

export default function PayPalPaymentsPanel() {
  const { profile } = useAuthStore()
  const [transactions, setTransactions] = useState<PayPalTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all')

  const loadTransactions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error('Error loading transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()

    const channel = supabase
      .channel('transactions_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => loadTransactions()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [statusFilter])

  const handleVerifyTransaction = async (transactionId: string, orderId: string | null) => {
    if (!orderId) {
      toast.error('No PayPal order ID found')
      return
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/paypal-verify-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: orderId
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Transaction verified successfully')
      } else {
        toast.error(data.error || 'Failed to verify transaction')
      }
    } catch (error: any) {
      console.error('Verify error:', error)
      toast.error(error?.message || 'Failed to verify transaction')
    }
  }

      const filteredTransactions = transactions.filter(tx => {
        if (searchTerm) {
          const search = searchTerm.toLowerCase()
          return (
            tx.user_profiles?.username?.toLowerCase().includes(search) ||
            tx.user_profiles?.email?.toLowerCase().includes(search) ||
            tx.paypal_order_id?.toLowerCase().includes(search) ||
            tx.external_id?.toLowerCase().includes(search)
          )
        }
        return true
      })

      const stats = {
        total: transactions.length,
        completed: transactions.filter(t => t.payment_status === 'completed' || t.payment_status === 'COMPLETED').length,
        pending: transactions.filter(t => t.payment_status === 'pending' || t.payment_status === 'PENDING').length,
        failed: transactions.filter(t => t.payment_status === 'failed' || t.payment_status === 'FAILED').length,
        totalRevenue: transactions
          .filter(t => t.payment_status === 'completed' || t.payment_status === 'COMPLETED')
          .reduce((sum, t) => sum + (t.amount_usd || 0), 0)
      }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-purple-400" />
          PayPal Transactions
        </h2>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total</div>
          <div className="text-2xl font-bold text-purple-300">{stats.total}</div>
        </div>
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Completed</div>
          <div className="text-2xl font-bold text-green-300">{stats.completed}</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Revenue</div>
          <div className="text-2xl font-bold text-blue-300">${stats.totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username, email, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading transactions...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No transactions found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-semibold">User</th>
                <th className="pb-3 text-gray-400 font-semibold">Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Amount</th>
                <th className="pb-3 text-gray-400 font-semibold">Status</th>
                <th className="pb-3 text-gray-400 font-semibold">PayPal Order ID</th>
                <th className="pb-3 text-gray-400 font-semibold">Date</th>
                <th className="pb-3 text-gray-400 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="py-3">
                    <div>
                      <div className="text-white">{tx.user_profiles?.username || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{tx.user_profiles?.email}</div>
                    </div>
                  </td>
                  <td className="py-3 text-white">{tx.coins.toLocaleString()}</td>
                  <td className="py-3 text-green-400">${(tx.amount_usd || 0).toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.payment_status === 'completed' || tx.payment_status === 'COMPLETED'
                        ? 'bg-green-900 text-green-300'
                        : tx.payment_status === 'pending' || tx.payment_status === 'PENDING'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {tx.payment_status || 'unknown'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400 text-xs font-mono">
                    {tx.paypal_order_id || 'N/A'}
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    {tx.paypal_order_id && (
                      <button
                        onClick={() => handleVerifyTransaction(tx.id, tx.paypal_order_id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        title="Verify with PayPal"
                      >
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

