import React, { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { toast } from 'sonner'
import {
  DollarSign,
  Check,
  X,
  Clock,
  CreditCard
} from 'lucide-react'

interface ManualOrder {
  id: string
  user_id: string
  package_id: string
  coins: number
  amount_usd: number
  price?: string // legacy fallback
  amount?: number // legacy fallback
  payment_method: string
  status: string
  purchase_type?: string
  payer_cashtag?: string
  created_at: string
  user?: {
    username: string
    avatar_url: string
  }
}

type ManualCoinOrdersListProps = {
  limit?: number
  showHeader?: boolean
  showRefresh?: boolean
  title?: string
  subtitle?: string
}

export default function ManualCoinOrdersList({
  limit,
  showHeader = true,
  showRefresh = true,
  title = 'Manual Coin Orders',
  subtitle = 'Review and approve manual coin purchases'
}: ManualCoinOrdersListProps) {
  const [orders, setOrders] = useState<ManualOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [confirmApproval, setConfirmApproval] = useState<ManualOrder | null>(null)
  const [confirmRejection, setConfirmRejection] = useState<ManualOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [txId, setTxId] = useState('')

  const fetchOrders = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('manual_coin_orders')
        .select('*')
        .eq('status', 'pending')
        .neq('purchase_type', 'troll_pass_bundle')
        .is('deleted_at', null)  // Filter out deleted orders
        .order('created_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error
      
      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((o: any) => o.user_id).filter(Boolean)))
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', userIds)
          
          const userMap: Record<string, any> = {}
          profiles?.forEach((p) => { userMap[p.id] = p })
          
          const ordersWithUsers = data.map((order: any) => ({
            ...order,
            user: userMap[order.user_id]
          }))
          
          setOrders(ordersWithUsers)
        } else {
          setOrders(data)
        }
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error('Error fetching manual orders:', error)
      toast.error('Failed to load manual orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [limit])

  const handleApproveClick = (order: ManualOrder) => {
    setTxId('')
    setConfirmApproval(order)
  }

  const handleConfirmApprove = async () => {
    if (!confirmApproval) return

    // Require TX ID for all manual methods
    if (!txId.trim()) {
        toast.error(`Please enter the ${confirmApproval.payment_method} Transaction ID/Reference`)
        return
    }

    try {
      setProcessing(confirmApproval.id)
      
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'approve_manual_order',
          orderId: confirmApproval.id,
          externalTxId: txId.trim() || `MANUAL-${Date.now()}`
        }
      })

      if (error) throw error

      toast.success(`Order approved for ${confirmApproval.user?.username}`)
      fetchOrders()
      setConfirmApproval(null)
    } catch (error: any) {
      console.error('Error approving order:', error)
      toast.error(error.message || 'Failed to approve order')
    } finally {
      setProcessing(null)
    }
  }

  const handleRejectClick = (order: ManualOrder) => {
    setRejectReason('')
    setConfirmRejection(order)
  }

  const handleConfirmReject = async () => {
    if (!confirmRejection) return

    try {
      setProcessing(confirmRejection.id)
      
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'reject_manual_order',
          orderId: confirmRejection.id,
          reason: rejectReason.trim() || 'Rejected by admin/secretary'
        }
      })

      if (error) throw error

      toast.success('Order rejected')
      fetchOrders()
      setConfirmRejection(null)
    } catch (error: any) {
      console.error('Error rejecting order:', error)
      toast.error(error.message || 'Failed to reject order')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading orders...</div>
  }

  return (
    <div className="space-y-6 relative">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-400" />
              {title}
            </h2>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
          {showRefresh && (
            <button 
              onClick={fetchOrders}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-12 text-center">
          <Check className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300">All Caught Up</h3>
          <p className="text-slate-500">No pending manual coin orders.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div 
              key={order.id}
              className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-slate-600 transition-colors"
            >
              {/* User Info */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <img 
                  src={order.user?.avatar_url || 'https://via.placeholder.com/40'} 
                  alt={order.user?.username}
                  className="w-10 h-10 rounded-full bg-slate-800"
                />
                <div>
                  <div className="font-bold text-white">{order.user?.username || 'Unknown User'}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Package</div>
                  <div className="text-sm text-slate-300 font-mono truncate" title={order.package_id}>
                    {order.package_id}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Amount</div>
                  <div className="text-sm text-yellow-400 font-bold flex items-center gap-1">
                    <img src="/assets/icons/coin.png" className="w-3 h-3" alt="coins" onError={(e) => e.currentTarget.style.display = 'none'} />
                    {(order.coins || order.amount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Price</div>
                  <div className="text-sm text-green-400 font-bold">
                    {order.amount_usd ? `$${order.amount_usd.toFixed(2)}` : (order.price || 'N/A')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Payment</div>
                  <div className="text-sm text-slate-300 flex items-center gap-1">
                    {order.payment_method === 'cashapp' ? (
                      <span className="text-green-400 font-bold">$</span>
                    ) : order.payment_method === 'venmo' ? (
                      <span className="text-blue-400 font-bold">V</span>
                    ) : order.payment_method === 'paypal' ? (
                      <span className="text-indigo-400 font-bold">P</span>
                    ) : (
                      <CreditCard className="w-3 h-3" />
                    )}
                    <span className="capitalize">{order.payment_method}</span>
                  </div>
                  {order.payer_cashtag && (
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {order.payer_cashtag}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
                <button
                  onClick={() => handleApproveClick(order)}
                  disabled={processing === order.id}
                  className="flex-1 md:flex-none px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === order.id ? (
                    <span className="animate-spin">⌛</span>
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => handleRejectClick(order)}
                  disabled={processing === order.id}
                  className="flex-1 md:flex-none px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 text-sm font-bold rounded-lg border border-red-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {confirmApproval && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Confirm Approval</h3>
                
                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">User</span>
                            <span className="text-white font-medium">{confirmApproval.user?.username}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Amount</span>
                            <span className="text-yellow-400 font-bold">{(confirmApproval.coins || confirmApproval.amount || 0).toLocaleString()} coins</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Price</span>
                            <span className="text-green-400 font-bold">{confirmApproval.amount_usd ? `$${confirmApproval.amount_usd.toFixed(2)}` : (confirmApproval.price || 'N/A')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Method</span>
                            <span className="capitalize text-white">{confirmApproval.payment_method}</span>
                        </div>
                        {confirmApproval.payer_cashtag && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Handle/Tag</span>
                                <span className="text-white font-mono">{confirmApproval.payer_cashtag}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            Transaction ID / Reference <span className="text-red-400 ml-1">*</span>
                        </label>
                        <input 
                            type="text"
                            value={txId}
                            onChange={(e) => setTxId(e.target.value)}
                            placeholder={`Enter ${confirmApproval.payment_method} Transaction ID`}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
                            autoFocus
                        />
                        <p className="text-xs text-yellow-500/80 mt-1">
                            Please verify the payment on your {confirmApproval.payment_method} before approving.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setConfirmApproval(null)}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmApprove}
                            disabled={processing === confirmApproval.id}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {processing === confirmApproval.id ? 'Processing...' : 'Confirm Approval'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Rejection Modal */}
      {confirmRejection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Reject Order</h3>
                
                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">User</span>
                            <span className="text-white font-medium">{confirmRejection.user?.username}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Amount</span>
                            <span className="text-yellow-400 font-bold">{(confirmRejection.coins || confirmRejection.amount || 0).toLocaleString()} coins</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Price</span>
                            <span className="text-green-400 font-bold">{confirmRejection.amount_usd ? `${confirmRejection.amount_usd.toFixed(2)}` : (confirmRejection.price || 'N/A')}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            Rejection Reason (will be sent to user)
                        </label>
                        <textarea 
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejection (e.g., payment not received, invalid cashtag, etc.)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none h-24 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setConfirmRejection(null)}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmReject}
                            disabled={processing === confirmRejection.id}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {processing === confirmRejection.id ? 'Processing...' : 'Confirm Rejection'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
