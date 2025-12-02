import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Banknote, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react'

interface PayoutRequest {
  id: string
  user_id: string
  coin_amount: number
  cash_amount: number
  paypal_email: string | null
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  processed_at: string | null
  admin_id: string | null
  user_profiles?: {
    username: string
    email: string
  }
}

export default function PayPalPayoutsPanel() {
  const { profile, user } = useAuthStore()
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('all')

  const loadPayouts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setPayouts(data || [])
    } catch (error: any) {
      console.error('Error loading payouts:', error)
      toast.error('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayouts()

    const channel = supabase
      .channel('payout_requests_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => loadPayouts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [statusFilter])

  const handleApprove = async (payoutId: string) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'approved',
          admin_id: user.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', payoutId)

      if (error) throw error
      toast.success('Payout approved')
      loadPayouts()
    } catch (error: any) {
      console.error('Approve error:', error)
      toast.error(error?.message || 'Failed to approve payout')
    }
  }

  const handleMarkAsPaid = async (payoutId: string) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    if (!confirm('Mark this payout as paid? This will finalize the payout.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'paid',
          admin_id: user.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', payoutId)

      if (error) throw error
      toast.success('Payout marked as paid')
      loadPayouts()
    } catch (error: any) {
      console.error('Mark paid error:', error)
      toast.error(error?.message || 'Failed to mark payout as paid')
    }
  }

  const handleReject = async (payoutId: string) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    const reason = prompt('Enter rejection reason:')
    if (!reason || !reason.trim()) {
      toast.error('Reason is required')
      return
    }

    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'rejected',
          admin_id: user.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', payoutId)

      if (error) throw error
      toast.success('Payout rejected')
      loadPayouts()
    } catch (error: any) {
      console.error('Reject error:', error)
      toast.error(error?.message || 'Failed to reject payout')
    }
  }

  const filteredPayouts = payouts.filter(payout => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        payout.user_profiles?.username?.toLowerCase().includes(search) ||
        payout.user_profiles?.email?.toLowerCase().includes(search) ||
        payout.paypal_email?.toLowerCase().includes(search)
      )
    }
    return true
  })

  const stats = {
    total: payouts.length,
    pending: payouts.filter(p => p.status === 'pending').length,
    approved: payouts.filter(p => p.status === 'approved').length,
    paid: payouts.filter(p => p.status === 'paid').length,
    totalPending: payouts
      .filter(p => p.status === 'pending' || p.status === 'approved')
      .reduce((sum, p) => sum + (p.cash_amount || 0), 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Banknote className="w-6 h-6 text-purple-400" />
          PayPal Payout Requests
        </h2>
        <button
          onClick={loadPayouts}
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
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-blue-300">{stats.approved}</div>
        </div>
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending Amount</div>
          <div className="text-2xl font-bold text-green-300">${stats.totalPending.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username, email, or PayPal email..."
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
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Payouts Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading payouts...</div>
      ) : filteredPayouts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No payout requests found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-semibold">User</th>
                <th className="pb-3 text-gray-400 font-semibold">Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">USD Amount</th>
                <th className="pb-3 text-gray-400 font-semibold">PayPal Email</th>
                <th className="pb-3 text-gray-400 font-semibold">Status</th>
                <th className="pb-3 text-gray-400 font-semibold">Requested</th>
                <th className="pb-3 text-gray-400 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((payout) => (
                <tr key={payout.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="py-3">
                    <div>
                      <div className="text-white">{payout.user_profiles?.username || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{payout.user_profiles?.email}</div>
                    </div>
                  </td>
                  <td className="py-3 text-white">{payout.coin_amount.toLocaleString()}</td>
                  <td className="py-3 text-green-400">${payout.cash_amount.toFixed(2)}</td>
                  <td className="py-3 text-gray-400 text-sm">{payout.paypal_email || 'N/A'}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      payout.status === 'paid'
                        ? 'bg-green-900 text-green-300'
                        : payout.status === 'approved'
                        ? 'bg-blue-900 text-blue-300'
                        : payout.status === 'pending'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {new Date(payout.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {payout.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(payout.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleReject(payout.id)
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {payout.status === 'approved' && (
                        <button
                          onClick={() => handleMarkAsPaid(payout.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
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

