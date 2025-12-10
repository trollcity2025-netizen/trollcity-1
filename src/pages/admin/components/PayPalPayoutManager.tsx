import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  DollarSign, CreditCard, Shield, Eye, EyeOff, 
  Check, X, AlertCircle, Clock, RefreshCw 
} from 'lucide-react'

interface PayoutRequest {
  id: string
  user_id: string
  username: string
  email: string
  payout_paypal_email: string
  coins_used: number
  cash_amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  processed_at: string | null
  processed_by: string | null
}

export default function PayPalPayoutManager() {
  const { profile } = useAuthStore()
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [processingPayout, setProcessingPayout] = useState<string | null>(null)
  const [showPayPalEmail, setShowPayPalEmail] = useState<{[key: string]: boolean}>({})
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('pending')

  // Check if user is admin or lead officer
  const isAdmin = profile?.role === 'admin'
  const isLeadOfficer = profile?.officer_role === 'lead_officer'
  const canViewPaymentInfo = isAdmin // Only admins can see full payment info
  const canProcessPayouts = isAdmin || isLeadOfficer

  useEffect(() => {
    if (canProcessPayouts) {
      loadPayouts()
    }
  }, [statusFilter, canProcessPayouts])

  const loadPayouts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          user_profiles!payout_requests_user_id_fkey (
            username,
            email,
            payout_paypal_email
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

      // Transform data
      const transformedPayouts: PayoutRequest[] = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        username: p.user_profiles?.username || 'Unknown',
        email: p.user_profiles?.email || '',
        payout_paypal_email: p.user_profiles?.payout_paypal_email || '',
        coins_used: p.coins_used || p.coin_amount || 0,
        cash_amount: Number(p.cash_amount || p.amount_usd || 0),
        status: p.status,
        created_at: p.created_at,
        processed_at: p.processed_at,
        processed_by: p.processed_by
      }))

      setPayouts(transformedPayouts)
    } catch (error: any) {
      console.error('Error loading payouts:', error)
      toast.error('Failed to load payout requests')
    } finally {
      setLoading(false)
    }
  }

  const processPayPalPayout = async (payout: PayoutRequest) => {
    if (!canProcessPayouts) {
      toast.error('Insufficient permissions to process payouts')
      return
    }

    if (!canViewPaymentInfo) {
      toast.error('Lead officers cannot view payment information')
      return
    }

    if (!payout.payout_paypal_email) {
      toast.error('No PayPal email found for this user')
      return
    }

    setProcessingPayout(payout.id)

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // Call PayPal payout processing function
      const response = await fetch(
        `${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/paypal-payout-process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            payout_request_id: payout.id,
            recipient_email: payout.payout_paypal_email,
            amount: payout.cash_amount,
            currency: 'USD'
          })
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'PayPal payout failed')
      }

      if (result.success) {
        toast.success(`Payout processed successfully! Batch ID: ${result.payout_batch_id}`)
        loadPayouts() // Refresh the list
      } else {
        throw new Error(result.error || 'Payout processing failed')
      }

    } catch (error: any) {
      console.error('PayPal payout error:', error)
      toast.error(error.message || 'Failed to process PayPal payout')
    } finally {
      setProcessingPayout(null)
    }
  }

  const approvePayout = async (payout: PayoutRequest) => {
    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: profile?.id
        })
        .eq('id', payout.id)

      if (error) throw error

      toast.success('Payout approved successfully')
      loadPayouts()
    } catch (error: any) {
      console.error('Approve payout error:', error)
      toast.error('Failed to approve payout')
    }
  }

  const rejectPayout = async (payout: PayoutRequest) => {
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
          processed_at: new Date().toISOString(),
          processed_by: profile?.id
        })
        .eq('id', payout.id)

      if (error) throw error

      toast.success('Payout rejected')
      loadPayouts()
    } catch (error: any) {
      console.error('Reject payout error:', error)
      toast.error('Failed to reject payout')
    }
  }

  const toggleEmailVisibility = (payoutId: string) => {
    setShowPayPalEmail(prev => ({
      ...prev,
      [payoutId]: !prev[payoutId]
    }))
  }

  const maskEmail = (email: string) => {
    if (!email) return 'No email'
    if (email.length <= 4) return email
    return email.substring(0, 2) + '***' + email.substring(email.length - 2)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!canProcessPayouts) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-red-400 mb-2">Access Restricted</h3>
        <p className="text-gray-300">
          Only administrators and lead troll officers can access the payout management system.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-400" />
            PayPal Payout Manager
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin ? 'Full access to payout processing' : 'Lead Officer - Limited access'}
          </p>
        </div>
        <button
          onClick={loadPayouts}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Access Level Warning for Lead Officers */}
      {!canViewPaymentInfo && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <EyeOff className="w-5 h-5 text-yellow-400" />
            <h3 className="text-yellow-400 font-semibold">Limited Access Mode</h3>
          </div>
          <p className="text-yellow-200 text-sm">
            As a Lead Officer, you can approve/reject payouts but cannot view PayPal email addresses or process payments.
            Contact an administrator for payment processing.
          </p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['all', 'pending', 'approved'] as const).map((status) => (
          <button
            key={status}
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
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No payout requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-[#1A1A1A]">
                  <th className="px-4 py-3 text-left text-gray-400">User</th>
                  <th className="px-4 py-3 text-left text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-gray-400">PayPal Email</th>
                  <th className="px-4 py-3 text-left text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-gray-400">Date</th>
                  <th className="px-4 py-3 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr 
                    key={payout.id} 
                    className="border-b border-gray-800 hover:bg-[#1A1A1A] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white font-medium">{payout.username}</div>
                        <div className="text-gray-400 text-xs">{payout.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-green-400 font-bold">
                        {formatCurrency(payout.cash_amount)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {payout.coins_used.toLocaleString()} coins
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-xs">
                          {canViewPaymentInfo 
                            ? (showPayPalEmail[payout.id] 
                                ? payout.payout_paypal_email 
                                : maskEmail(payout.payout_paypal_email))
                            : '*** Hidden ***'
                          }
                        </span>
                        {canViewPaymentInfo && (
                          <button
                            onClick={() => toggleEmailVisibility(payout.id)}
                            className="text-gray-400 hover:text-white"
                          >
                            {showPayPalEmail[payout.id] ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        payout.status === 'paid' 
                          ? 'bg-green-900 text-green-300'
                          : payout.status === 'approved'
                          ? 'bg-blue-900 text-blue-300'
                          : payout.status === 'pending'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {payout.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(payout.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payout.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => approvePayout(payout)}
                            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => rejectPayout(payout)}
                            className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {payout.status === 'approved' && canViewPaymentInfo && (
                        <button
                          onClick={() => processPayPalPayout(payout)}
                          disabled={processingPayout === payout.id}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 rounded text-xs flex items-center gap-1"
                        >
                          {processingPayout === payout.id ? (
                            <Clock className="w-3 h-3 animate-spin" />
                          ) : (
                            <CreditCard className="w-3 h-3" />
                          )}
                          PayPal
                        </button>
                      )}
                      {payout.status === 'paid' && (
                        <span className="text-green-400 text-xs">✓ Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-blue-400" />
          <h3 className="text-blue-400 font-semibold">Processing Instructions</h3>
        </div>
        <div className="text-blue-200 text-sm space-y-1">
          <p>• <strong>Pending:</strong> Review and approve/reject the payout request</p>
          <p>• <strong>Approved:</strong> Process payment via PayPal (Admin only)</p>
          <p>• <strong>Lead Officers:</strong> Cannot view payment details or process PayPal payouts</p>
          <p>• <strong>Security:</strong> Payment information is masked for non-admin users</p>
        </div>
      </div>
    </div>
  )
}