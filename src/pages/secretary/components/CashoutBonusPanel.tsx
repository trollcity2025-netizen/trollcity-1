import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { DollarSign, Check, X, Plus, Gift } from 'lucide-react'
import { useAuthStore } from '../../../lib/store'

interface CashoutBonusRequest {
  id: string
  user_id: string
  coin_amount: number
  cashout_amount: number
  status: string
  requested_at: string
  bonus_amount: number
  user_profile?: {
    username: string
    email?: string
  }
}

export default function CashoutBonusPanel() {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<CashoutBonusRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<CashoutBonusRequest | null>(null)
  const [bonusAmount, setBonusAmount] = useState<number>(0)
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'get_cashout_requests',
          filterStatus 
        }
      })

      if (error) throw error
      
      const requestsData = data?.requests || []
      setRequests(requestsData.map((req: any) => ({
        ...req,
        bonus_amount: req.bonus_amount || 0
      })))
    } catch (error) {
      console.error('Error fetching cashouts:', error)
      toast.error('Failed to load cashout requests')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [fetchRequests])

  const handleApproveBonus = async (req: CashoutBonusRequest, bonus: number) => {
    if (!user) return
    if (bonus < 0 || bonus > 100) {
      toast.error('Bonus must be between $0 and $100')
      return
    }

    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'approve_cashout_bonus',
          requestId: req.id,
          bonusAmount: bonus
        }
      })

      if (error) throw error

      toast.success(`Approved cashout with $${bonus.toFixed(2)} bonus`)
      setSelectedRequest(null)
      setBonusAmount(0)
      fetchRequests()
    } catch (error) {
      console.error(error)
      toast.error('Failed to approve bonus')
    }
  }

  const handleApproveWithoutBonus = async (req: CashoutBonusRequest) => {
    if (!user) return

    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'approve_cashout',
          requestId: req.id
        }
      })

      if (error) throw error

      toast.success('Approved cashout (no bonus)')
      fetchRequests()
    } catch (error) {
      console.error(error)
      toast.error('Failed to approve cashout')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center gap-4 mb-6 flex-wrap">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-400" />
          Cashout Bonus Approval
        </h2>
        <select 
          className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </div>

      <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-amber-900/50 p-2 rounded-full mt-0.5">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-200">Admin Bonus Feature</h4>
            <p className="text-xs text-amber-300/80 mt-1">
              You can add up to <span className="text-white font-bold">$100</span> bonus to any cashout request.
              If you don't approve the bonus, user only receives their original cashout amount.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Coins</th>
              <th className="p-3">Cashout</th>
              <th className="p-3">Bonus</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center">No requests found</td></tr>
            ) : (
              requests.map(req => (
                <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-3 font-medium text-white">
                    {req.user_profile?.username || 'Unknown'}
                    <div className="text-xs text-slate-500">{req.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-3 font-mono text-yellow-400">
                    {(req.coin_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-green-400">
                    ${req.cashout_amount?.toFixed(2) || '0.00'}
                  </td>
                  <td className="p-3">
                    {req.bonus_amount > 0 ? (
                      <span className="font-mono text-amber-400">+${req.bonus_amount.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                      req.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                      req.status === 'fulfilled' ? 'bg-green-500/20 text-green-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(req.requested_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleApproveWithoutBonus(req)}
                          className="p-1.5 bg-slate-600/20 hover:bg-slate-600/40 text-slate-400 rounded transition-colors"
                          title="Approve without bonus"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedRequest(req)
                            setBonusAmount(0)
                          }}
                          className="p-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded transition-colors flex items-center gap-1"
                          title="Add Bonus"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-xs font-bold">Bonus</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A24] border border-amber-500/30 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Add Cashout Bonus
              </h3>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">User:</span>
                <span className="text-white font-medium">{selectedRequest.user_profile?.username || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Coins:</span>
                <span className="text-yellow-400 font-mono">{selectedRequest.coin_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Original Cashout:</span>
                <span className="text-green-400 font-mono">${selectedRequest.cashout_amount?.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Bonus Amount (max $100)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-400">$</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-[#0D0D16] border border-amber-500/30 rounded-lg p-3 text-white font-bold text-xl focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                Total payout: ${(selectedRequest.cashout_amount + bonusAmount).toFixed(2)}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2C2C2C] text-gray-300 hover:bg-[#2C2C2C] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApproveBonus(selectedRequest, bonusAmount)}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" />
                Approve with Bonus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}