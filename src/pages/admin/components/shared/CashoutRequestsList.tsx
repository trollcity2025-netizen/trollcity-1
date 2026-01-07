import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { CashoutRequest } from '../../../../types/admin'
import { toast } from 'sonner'
import { DollarSign, Check, X, CreditCard } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'

interface CashoutRequestsListProps {
  viewMode: 'admin' | 'secretary'
}

type ExtendedCashoutRequest = CashoutRequest & {
  user_profile?: {
    username: string;
    email?: string;
  }
}

export default function CashoutRequestsList({ viewMode: _viewMode }: CashoutRequestsListProps) {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<ExtendedCashoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<ExtendedCashoutRequest | null>(null)
  const [giftCardCode, setGiftCardCode] = useState('')
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('cashout_requests')
        .select(`
          *,
          user_profile:user_profiles(username, email)
        `)
        .order('requested_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error('Error fetching cashouts:', error)
      toast.error('Failed to load cashout requests')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    fetchRequests()
    
    const subscription = supabase
      .channel('cashout_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
        fetchRequests()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchRequests])

  const handleUpdateStatus = async (id: string, status: string, notes?: string) => {
    if (!user) return
    try {
      const updates: any = { status }
      
      if (status === 'approved') {
        updates.approved_by = user.id
        updates.approved_at = new Date().toISOString()
        
        const { error } = await supabase
          .from('cashout_requests')
          .update(updates)
          .eq('id', id)
        if (error) throw error
      } else if (status === 'denied') {
        const { error } = await supabase.rpc('process_cashout_refund', {
          p_request_id: id,
          p_admin_id: user.id,
          p_notes: notes || 'Request denied'
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('cashout_requests')
          .update(updates)
          .eq('id', id)
        if (error) throw error
      }
      toast.success(`Request marked as ${status}`)
      fetchRequests()
    } catch (error) {
      console.error(error)
      toast.error('Failed to update request')
    }
  }

  const openFulfillModal = (req: ExtendedCashoutRequest) => {
    setSelectedRequest(req)
    setGiftCardCode('')
    setIsFulfillModalOpen(true)
  }

  const handleFulfill = async () => {
    if (!selectedRequest || !giftCardCode) return
    if (!user) return

    try {
      const { error } = await supabase.rpc('fulfill_cashout_request', {
        p_request_id: selectedRequest.id,
        p_admin_id: user.id,
        p_notes: 'Fulfilled via admin panel',
        p_gift_card_code: giftCardCode
      })

      if (error) throw error
      toast.success('Request fulfilled with Gift Card code!')
      setIsFulfillModalOpen(false)
      fetchRequests()
    } catch (error) {
      console.error(error)
      toast.error('Failed to fulfill request')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Cashout Requests
        </h2>
        <select 
          className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="failed">Failed</option>
          <option value="denied">Denied</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center">No requests found</td></tr>
            ) : (
              requests.map(req => (
                <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-3 font-medium text-white">
                    {req.user_profile?.username || 'Unknown'}
                    <div className="text-xs text-slate-500">{req.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-3 font-mono text-yellow-400">
                    {(req.coin_amount || 0).toLocaleString()} coins
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded border border-slate-600 text-xs">
                      {req.tier || 'Standard'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                      req.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                      req.status === 'fulfilled' ? 'bg-green-500/20 text-green-300' :
                      req.status === 'denied' ? 'bg-red-500/20 text-red-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(req.requested_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {req.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(req.id, 'approved')}
                          className="p-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(req.id, 'denied')}
                          className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                          title="Deny"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {req.status === 'approved' && (
                      <button 
                        onClick={() => openFulfillModal(req)}
                        className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded transition-colors flex items-center gap-1 px-2"
                        title="Fulfill with Gift Card"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-xs font-bold">Fulfill</span>
                      </button>
                    )}
                    {req.status === 'processing' && (
                      <button 
                        onClick={() => openFulfillModal(req)}
                        className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded transition-colors flex items-center gap-1 px-2"
                        title="Mark Fulfilled"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-xs font-bold">Fulfill</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isFulfillModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A24] border border-[#2C2C2C] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Fulfill Cashout Request</h3>
              <button 
                onClick={() => setIsFulfillModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
              <div className="bg-[#0D0D16] p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">User:</span>
                  <span className="text-white font-medium">{selectedRequest.user_profile?.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-yellow-400 font-mono">
                  {(selectedRequest.coin_amount || 0).toLocaleString()} coins
                  </span>
                </div>
              {/* USD value and delivery method omitted due to schema differences */}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Gift Card Code / Link</label>
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value)}
                placeholder="Enter code or claim link..."
                className="w-full bg-[#0D0D16] border border-[#2C2C2C] rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
              />
              <p className="text-xs text-gray-500">
                This will be securely sent to the user's Gift Cards page.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsFulfillModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2C2C2C] text-gray-300 hover:bg-[#2C2C2C] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFulfill}
                disabled={!giftCardCode}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Gift Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
