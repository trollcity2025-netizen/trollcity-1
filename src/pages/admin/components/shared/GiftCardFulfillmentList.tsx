import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { GiftCardFulfillment, CashoutRequest } from '../../../../types/admin'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../lib/store'
import { Gift, AlertTriangle, Save, ExternalLink } from 'lucide-react'

interface GiftCardFulfillmentListProps {
  viewMode: 'admin' | 'secretary'
}

type ExtendedFulfillment = GiftCardFulfillment & {
  cashout_request?: CashoutRequest & {
    user_profile?: {
      username: string
    }
  }
}

export default function GiftCardFulfillmentList({ viewMode: _viewMode }: GiftCardFulfillmentListProps) {
  const { user: _user } = useAuthStore()
  const [fulfillments, setFulfillments] = useState<ExtendedFulfillment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<GiftCardFulfillment>>({})

  const fetchFulfillments = useCallback(async () => {
    setLoading(true)
    try {
      // We might need to manually join if foreign keys aren't perfect in types
      // But assuming they are set up in Supabase
      const { data, error } = await supabase
        .from('giftcard_fulfillments')
        .select(`
          *,
          cashout_request:cashout_requests(
            *,
            user_profile:user_profiles(username)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFulfillments(data || [])
    } catch (error) {
      console.error('Error fetching fulfillments:', error)
      toast.error('Failed to load fulfillments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFulfillments()
  }, [fetchFulfillments])

  const handleEdit = (fulfillment: ExtendedFulfillment) => {
    setEditingId(fulfillment.id)
    setEditForm({
      provider: fulfillment.provider,
      amount_usd: fulfillment.amount_usd,
      purchase_reference: fulfillment.purchase_reference,
      giftcard_code: fulfillment.giftcard_code,
      giftcard_link: fulfillment.giftcard_link,
      fulfillment_status: fulfillment.fulfillment_status,
      failure_reason: fulfillment.failure_reason
    })
  }

  const handleSave = async (id: string) => {
    try {
      if (editForm.fulfillment_status === 'failed' && !editForm.failure_reason) {
        toast.error('Failure reason is required when status is failed')
        return
      }

      const updates = {
        ...editForm,
        delivered_at: editForm.fulfillment_status === 'completed' ? new Date().toISOString() : null,
        // If delivered_to_user logic is needed (e.g. email or user ID), add here
      }

      const { error } = await supabase
        .from('giftcard_fulfillments')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      
      // If failed, trigger critical alert logic (handled by backend or we do it here?)
      // Requirement: "If fulfillment_status = 'failed': ... show UI warning: Critical alert triggers automatically"
      // Assuming backend trigger does the alert creation.

      toast.success('Fulfillment updated')
      setEditingId(null)
      fetchFulfillments()
    } catch (error) {
      console.error(error)
      toast.error('Failed to update fulfillment')
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-400" />
          Gift Card Fulfillment
        </h2>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-slate-400">Loading...</div>
        ) : fulfillments.length === 0 ? (
          <div className="text-center text-slate-400">No active fulfillments</div>
        ) : (
          fulfillments.map(item => (
            <div key={item.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              {editingId === item.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Provider</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={editForm.provider || ''}
                      onChange={e => setEditForm({...editForm, provider: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Amount (USD)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={editForm.amount_usd || 0}
                      onChange={e => setEditForm({...editForm, amount_usd: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Code</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={editForm.giftcard_code || ''}
                      onChange={e => setEditForm({...editForm, giftcard_code: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Link</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={editForm.giftcard_link || ''}
                      onChange={e => setEditForm({...editForm, giftcard_link: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Status</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                      value={editForm.fulfillment_status}
                      onChange={e => setEditForm({...editForm, fulfillment_status: e.target.value as any})}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  {editForm.fulfillment_status === 'failed' && (
                    <div className="col-span-2">
                      <label className="text-xs text-red-400 block mb-1 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Failure Reason (Required)
                      </label>
                      <input 
                        className="w-full bg-slate-800 border border-red-500/50 rounded p-2 text-sm text-white"
                        value={editForm.failure_reason || ''}
                        onChange={e => setEditForm({...editForm, failure_reason: e.target.value})}
                        placeholder="Why did it fail?"
                      />
                      <p className="text-xs text-red-400 mt-1">Critical alert will be triggered automatically.</p>
                    </div>
                  )}
                  <div className="col-span-2 flex justify-end gap-2 mt-2">
                    <button 
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleSave(item.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white">{item.provider} - ${item.amount_usd}</h3>
                    <p className="text-sm text-slate-400">
                      For: {item.cashout_request?.user_profile?.username || 'Unknown User'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.fulfillment_status === 'completed' ? 'bg-green-500/20 text-green-300' :
                        item.fulfillment_status === 'failed' ? 'bg-red-500/20 text-red-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {item.fulfillment_status.toUpperCase()}
                      </span>
                      {item.giftcard_code && (
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                          Code: {item.giftcard_code}
                        </span>
                      )}
                    </div>
                    {item.fulfillment_status === 'failed' && item.failure_reason && (
                      <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {item.failure_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.giftcard_link && (
                      <a 
                        href={item.giftcard_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
