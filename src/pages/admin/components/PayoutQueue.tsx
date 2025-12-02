import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  DollarSign, Check, X, CreditCard, Filter, 
  RefreshCw, Eye, AlertCircle, ExternalLink 
} from 'lucide-react'

interface PayoutRequest {
  id: string
  user_id: string
  username: string
  email: string
  coins_used: number
  cash_amount: number
  net_amount: number
  fee_amount?: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  payment_method: string | null
  payment_reference: string | null
  provider_type?: string | null
  provider_username?: string | null
  notes: string | null
  rejection_reason: string | null
  created_at: string
  approved_at: string | null
  paid_at: string | null
  processed_by: string | null
  processed_by_username: string | null
}

export default function PayoutQueue() {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('pending')
  const [rejectionReason, setRejectionReason] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadPayouts()
  }, [statusFilter])

  const loadPayouts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!payout_requests_user_id_fkey (
            username,
            email
          ),
          processed_by_user:user_profiles!payout_requests_processed_by_fkey (
            username
          )
        `)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (statusFilter === 'pending') {
        query = query.in('status', ['pending', 'approved'])
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data to include username and email
      const transformedPayouts: PayoutRequest[] = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        username: p.user_profiles?.username || 'Unknown',
        email: p.user_profiles?.email || '',
        coins_used: p.coins_redeemed || p.coins_used || p.coin_amount || p.requested_coins || 0,
        cash_amount: Number(p.cash_amount || p.amount_usd || 0),
        net_amount: Number(p.net_amount) || Number(p.cash_amount) || 0,
        fee_amount: Number(p.processing_fee || p.fee_amount || 0),
        status: p.status,
        payment_method: p.payment_method || p.payout_method,
        payment_reference: p.payment_reference || p.payout_address || p.paypal_email,
        provider_type: p.provider_type || p.payment_method || p.payout_method,
        provider_username: p.provider_username || p.payment_reference || p.payout_address || p.paypal_email,
        notes: p.notes,
        rejection_reason: p.rejection_reason,
        created_at: p.created_at,
        approved_at: p.approved_at,
        paid_at: p.paid_at,
        processed_by: p.processed_by,
        processed_by_username: p.processed_by_user?.username || null
      }))

      setPayouts(transformedPayouts)
    } catch (error: any) {
      console.error('Error loading payouts:', error)
      toast.error('Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }

  const approve = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      const { data, error } = await supabase.rpc('approve_payout', {
        p_payout_id: id
      })

      if (error) {
        console.error('Approve payout error:', error)
        toast.error(`Approval failed: ${error.message || 'Unknown error'}`)
        return
      }

      if (data?.success) {
        toast.success(`Paid ${data.username}. New balance: ${data.new_balance} coins`)
        loadPayouts()
      } else {
        toast.error(data?.error || 'Failed to approve payout')
      }
    } catch (error: any) {
      console.error('Approve payout error:', error)
      toast.error(error.message || 'Failed to approve payout')
    }
  }

  const reject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const reason = prompt('Enter rejection reason:')
    if (!reason || !reason.trim()) {
      toast.error('Rejection reason is required')
      return
    }

    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          processed_by: profile?.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      toast.success('Payout rejected')
      loadPayouts()
    } catch (error: any) {
      console.error('Reject payout error:', error)
      toast.error(error.message || 'Failed to reject payout')
    }
  }

  const handleStatusUpdate = async (payoutId: string, newStatus: string, reason?: string) => {
    if (!profile) {
      toast.error('You must be logged in as admin')
      return
    }

    if (newStatus === 'rejected' && !reason?.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    try {
      const { data, error } = await supabase.rpc('admin_update_payout_status', {
        p_payout_id: payoutId,
        p_admin_id: profile.id,
        p_new_status: newStatus,
        p_rejection_reason: reason || null,
        p_payment_reference: paymentReference || null,
        p_notes: adminNotes || null
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Payout ${newStatus} successfully`)
        
        // Send email notification
        const payout = payouts.find(p => p.id === payoutId)
        if (payout) {
          try {
            await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/sendEmail`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
              },
              body: JSON.stringify({
                to: payout.email,
                subject: newStatus === 'approved' 
                  ? '✅ Payout Approved' 
                  : newStatus === 'paid'
                  ? '💰 Payout Sent'
                  : '❌ Payout Rejected',
                html: `
                  <p>Hi ${payout.username},</p>
                  <p>Your payout request status has been updated.</p>
                  <p><strong>Status: ${newStatus.toUpperCase()}</strong></p>
                  ${reason ? `<p>Reason: ${reason}</p>` : ''}
                  ${paymentReference ? `<p>Payment Reference: ${paymentReference}</p>` : ''}
                  <p>– TrollCity Team</p>
                `
              })
            })
          } catch (emailError) {
            console.error('Email send error:', emailError)
          }
        }

        setSelectedPayout(null)
        setRejectionReason('')
        setPaymentReference('')
        setAdminNotes('')
        loadPayouts()
      } else {
        toast.error(data?.error || 'Failed to update payout status')
      }
    } catch (error: any) {
      console.error('Update payout error:', error)
      toast.error(error.message || 'Failed to update payout status')
    }
  }

  const calculateTotalLiability = () => {
    return payouts
      .filter(p => p.status === 'pending' || p.status === 'approved')
      .reduce((sum, p) => sum + (p.net_amount || p.cash_amount), 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      paid: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
    return styles[status as keyof typeof styles] || styles.pending
  }

  const maskDestination = (method: string | null, reference: string | null) => {
    if (!method || !reference) return '—'
    // Mask sensitive payment info
    if (reference.length > 4) {
      return `${method}: ****${reference.slice(-4)}`
    }
    return `${method}: ${reference}`
  }

  const filteredPayouts = payouts

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Payout Queue
        </h2>
        <button
          type="button"
          onClick={loadPayouts}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Total Liability Card */}
      <div className="bg-[#0D0D0D] border border-green-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Liability</p>
            <p className="text-3xl font-bold text-green-400">
              {formatCurrency(calculateTotalLiability())}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Pending + Approved payouts
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Total Requests</p>
            <p className="text-2xl font-semibold text-white">
              {filteredPayouts.length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['all', 'pending', 'approved', 'paid', 'rejected'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-xs">
                ({payouts.filter(p => p.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Payouts Table */}
      <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading payouts...</div>
        ) : filteredPayouts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No payout requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-[#1A1A1A]">
                  <th className="px-4 py-3 text-left text-gray-400">Username</th>
                  <th className="px-4 py-3 text-left text-gray-400">Coins</th>
                  <th className="px-4 py-3 text-left text-gray-400">Cash</th>
                  <th className="px-4 py-3 text-left text-gray-400">Payout Method</th>
                  <th className="px-4 py-3 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr 
                    key={payout.id} 
                    className="border-b border-gray-800 hover:bg-[#1A1A1A] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link 
                        to={`/admin/users/${payout.user_id}`}
                        className="text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {payout.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white">{payout.coins_used.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">
                      ${payout.cash_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {payout.provider_type && payout.provider_username 
                        ? `${payout.provider_type} — ${payout.provider_username}`
                        : payout.payment_method || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payout.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => approve(e, payout.id)}
                            className="bg-green-600 px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Approve & Pay
                          </button>
                          <button
                            type="button"
                            onClick={(e) => reject(e, payout.id)}
                            className="bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700 ml-2"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {payout.status !== 'pending' && (
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadge(payout.status)}`}>
                          {payout.status.toUpperCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed View Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-purple-500/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1A1A1A] border-b border-purple-500/30 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Payout Details</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedPayout(null)
                  setRejectionReason('')
                  setPaymentReference('')
                  setAdminNotes('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3">Request Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Username</div>
                    <div className="text-white font-medium">{selectedPayout.username}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Email</div>
                    <div className="text-white">{selectedPayout.email}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Coins Requested</div>
                    <div className="text-white">{selectedPayout.coins_used.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Cash Amount</div>
                    <div className="text-green-400 font-bold">
                      {formatCurrency(selectedPayout.cash_amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Net Amount</div>
                    <div className="text-green-400 font-bold">
                      {formatCurrency(selectedPayout.net_amount || selectedPayout.cash_amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Status</div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadge(selectedPayout.status)}`}>
                      {selectedPayout.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Processing Info */}
              {(selectedPayout.approved_at || selectedPayout.paid_at || selectedPayout.processed_by_username) && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3">Processing Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedPayout.approved_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Approved At</span>
                        <span className="text-white">{formatDate(selectedPayout.approved_at)}</span>
                      </div>
                    )}
                    {selectedPayout.paid_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Paid At</span>
                        <span className="text-white">{formatDate(selectedPayout.paid_at)}</span>
                      </div>
                    )}
                    {selectedPayout.processed_by_username && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Processed By</span>
                        <span className="text-white">{selectedPayout.processed_by_username}</span>
                      </div>
                    )}
                    {selectedPayout.payment_reference && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Payment Reference</span>
                        <span className="text-white font-mono text-xs">{selectedPayout.payment_reference}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes & Rejection Reason */}
              {(selectedPayout.notes || selectedPayout.rejection_reason) && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3">Notes</h4>
                  {selectedPayout.notes && (
                    <p className="text-sm text-white mb-2">{selectedPayout.notes}</p>
                  )}
                  {selectedPayout.rejection_reason && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-400">{selectedPayout.rejection_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Actions */}
              {selectedPayout.status !== 'paid' && selectedPayout.status !== 'rejected' && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700 space-y-4">
                  <h4 className="text-sm font-semibold text-purple-400">Admin Actions</h4>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Admin Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm"
                      placeholder="Add internal notes..."
                    />
                  </div>

                  {selectedPayout.status === 'approved' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Payment Reference (optional)</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm"
                        placeholder="Transaction ID, confirmation number, etc."
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    {selectedPayout.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(selectedPayout.id, 'approved')}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                    )}
                    {selectedPayout.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(selectedPayout.id, 'paid')}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Mark Paid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:')
                        if (reason) {
                          setRejectionReason(reason)
                          handleStatusUpdate(selectedPayout.id, 'rejected', reason)
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


