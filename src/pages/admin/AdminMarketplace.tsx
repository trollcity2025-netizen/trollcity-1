import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Store, Package, Users, DollarSign, Ban, CheckCircle, XCircle, Edit, Trash, Shield, AlertTriangle, MessageSquare, Gavel, Clock } from 'lucide-react'

export default function AdminMarketplace() {
  const [items, setItems] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [disputes, setDisputes] = useState<any[]>([])
  const [fraudHolds, setFraudHolds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'purchases' | 'moderation' | 'disputes' | 'fraud'>('items')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load marketplace items
      const { data: itemsData, error: itemsError } = await supabase
        .from('marketplace_items')
        .select(`
          *,
          user_profiles!seller_id (
            username
          )
        `)
        .order('created_at', { ascending: false })

      if (itemsError) throw itemsError
      setItems(itemsData || [])

      // Load pending moderation items
      const { data: pendingData, error: pendingError } = await supabase
        .from('marketplace_items')
        .select(`
          *,
          user_profiles!seller_id (
            username,
            email
          )
        `)
        .in('moderation_status', ['pending_review', 'rejected'])
        .order('created_at', { ascending: false })

      if (pendingError) throw pendingError
      setPendingItems(pendingData || [])

      // Load marketplace purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('marketplace_purchases')
        .select(`
          *,
          buyer:user_profiles!buyer_id (
            username
          ),
          seller:user_profiles!seller_id (
            username
          ),
          item:marketplace_items (
            title
          )
        `)
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError
      setPurchases(purchasesData || [])

      // Load active marketplace disputes
      const { data: disputesData, error: disputesError } = await supabase
        .from('active_marketplace_disputes')
        .select('*')
        .order('created_at', { ascending: false })

      if (disputesError) {
        console.warn('Could not load disputes (table may not exist yet):', disputesError)
        setDisputes([])
      } else {
        setDisputes(disputesData || [])
      }

      // Load sellers with fraud holds
      const { data: fraudData, error: fraudError } = await supabase
        .from('sellers_with_fraud_holds')
        .select('*')
        .order('fraud_hold_until', { ascending: true })

      if (fraudError) {
        console.warn('Could not load fraud holds (table may not exist yet):', fraudError)
        setFraudHolds([])
      } else {
        setFraudHolds(fraudData || [])
      }

    } catch (err) {
      console.error('Error loading marketplace data:', err)
      toast.error('Failed to load marketplace data')
    } finally {
      setLoading(false)
    }
  }

  const updateItemStatus = async (itemId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('marketplace_items')
        .update({ status })
        .eq('id', itemId)

      if (error) throw error

      toast.success(`Item ${status === 'active' ? 'activated' : status === 'removed' ? 'removed' : 'marked as sold out'}`)
      loadData()
    } catch (err) {
      console.error('Error updating item:', err)
      toast.error('Failed to update item')
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to permanently delete this item?')) return

    try {
      const { error } = await supabase
        .from('marketplace_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      toast.success('Item deleted permanently')
      loadData()
    } catch (err) {
      console.error('Error deleting item:', err)
      toast.error('Failed to delete item')
    }
  }

  const moderateProduct = async (itemId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('moderate_product', {
        p_item_id: itemId,
        p_action: action,
        p_notes: notes || null
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Product ${action}d successfully`)
        loadData()
      } else {
        toast.error(data?.error || 'Failed to moderate product')
      }
    } catch (err: any) {
      console.error('Error moderating product:', err)
      toast.error(err.message || 'Failed to moderate product')
    }
  }

  const resolveDispute = async (disputeId: string, resolution: string, refundAmount: number) => {
    try {
      const { data, error } = await supabase.rpc('resolve_marketplace_dispute', {
        p_dispute_id: disputeId,
        p_resolution: resolution,
        p_refund_amount: refundAmount
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Dispute resolved successfully')
        loadData()
      } else {
        toast.error(data?.error || 'Failed to resolve dispute')
      }
    } catch (err: any) {
      console.error('Error resolving dispute:', err)
      toast.error(err.message || 'Failed to resolve dispute')
    }
  }

  const applyFraudHold = async (sellerId: string, holdAmount: number, reason: string, holdDays: number) => {
    try {
      const { data, error } = await supabase.rpc('apply_fraud_hold', {
        p_seller_id: sellerId,
        p_hold_amount: holdAmount,
        p_reason: reason,
        p_hold_days: holdDays
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Fraud hold applied successfully')
        loadData()
      } else {
        toast.error(data?.error || 'Failed to apply fraud hold')
      }
    } catch (err: any) {
      console.error('Error applying fraud hold:', err)
      toast.error(err.message || 'Failed to apply fraud hold')
    }
  }

  const releaseFraudHold = async (sellerId: string) => {
    try {
      const { data, error } = await supabase.rpc('release_fraud_hold', {
        p_seller_id: sellerId
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Fraud hold released successfully')
        loadData()
      } else {
        toast.error(data?.error || 'Failed to release fraud hold')
      }
    } catch (err: any) {
      console.error('Error releasing fraud hold:', err)
      toast.error(err.message || 'Failed to release fraud hold')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Store className="w-8 h-8 text-purple-400" />
            Admin Marketplace Controls
          </h1>
          <p className="text-gray-400">Manage marketplace items, purchases, and seller activities</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Total Items</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{items.length}</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Active Items</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {items.filter(item => item.status === 'active' && item.moderation_status === 'approved').length}
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-gray-400">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">{pendingItems.length}</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Total Sales</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              ${purchases.reduce((sum, p) => sum + (p.price_paid || 0), 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Total Purchases</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{purchases.length}</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-red-400" />
              <span className="text-sm text-gray-400">Active Disputes</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{disputes.length}</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-pink-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-pink-400" />
              <span className="text-sm text-gray-400">Fraud Holds</span>
            </div>
            <p className="text-2xl font-bold text-pink-400">{fraudHolds.length}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center">
          <div className="bg-[#1A1A1A] rounded-lg p-1 border border-[#2C2C2C]">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'items' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Marketplace Items
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'moderation' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Product Moderation {pendingItems.length > 0 && `(${pendingItems.length})`}
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'purchases' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Purchase History
            </button>
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'disputes' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Disputes {disputes.length > 0 && `(${disputes.length})`}
            </button>
            <button
              onClick={() => setActiveTab('fraud')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'fraud' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Fraud Holds {fraudHolds.length > 0 && `(${fraudHolds.length})`}
            </button>
          </div>
        </div>

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="bg-zinc-900 rounded-xl border border-[#2C2C2C] overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Marketplace Items</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-[#1A1A1A] p-4 rounded-lg border border-[#2C2C2C] flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{item.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'active' ? 'bg-green-600' :
                          item.status === 'sold_out' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}>
                          {item.status}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.moderation_status === 'approved' ? 'bg-blue-600' :
                          item.moderation_status === 'pending_review' ? 'bg-orange-600' :
                          item.moderation_status === 'rejected' ? 'bg-red-600' :
                          'bg-gray-600'
                        }`}>
                          {item.moderation_status?.replace('_', ' ') || 'draft'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-1">{item.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-yellow-400 font-semibold">
                          {item.price_coins?.toLocaleString()} coins
                        </span>
                        <span className="text-gray-400">
                          Seller: {item.user_profiles?.username || 'Unknown'}
                        </span>
                        <span className="text-gray-400">
                          Type: {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {item.status !== 'active' && (
                        <button
                          onClick={() => updateItemStatus(item.id, 'active')}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                        >
                          Activate
                        </button>
                      )}
                      {item.status === 'active' && (
                        <button
                          onClick={() => updateItemStatus(item.id, 'sold_out')}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition-colors"
                        >
                          Mark Sold Out
                        </button>
                      )}
                      <button
                        onClick={() => updateItemStatus(item.id, 'removed')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No marketplace items found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Moderation Tab */}
        {activeTab === 'moderation' && (
          <div className="bg-zinc-900 rounded-xl border border-[#2C2C2C] overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-400" />
                Product Moderation Queue
              </h2>
              <div className="space-y-4">
                {pendingItems.map((item) => (
                  <div key={item.id} className="bg-[#1A1A1A] p-4 rounded-lg border border-orange-500/30">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{item.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.moderation_status === 'pending_review' ? 'bg-orange-600' :
                            'bg-red-600'
                          }`}>
                            {item.moderation_status?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{item.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                          <div>
                            <span className="font-semibold">Seller:</span> {item.user_profiles?.username || 'Unknown'}
                          </div>
                          <div>
                            <span className="font-semibold">Email:</span> {item.user_profiles?.email || 'N/A'}
                          </div>
                          <div>
                            <span className="font-semibold">Price:</span> {item.price_coins?.toLocaleString()} coins
                          </div>
                          <div>
                            <span className="font-semibold">Type:</span> {item.type}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            const notes = prompt('Optional approval notes:');
                            moderateProduct(item.id, 'approve', notes || undefined);
                          }}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Rejection reason (required):');
                            if (notes) {
                              moderateProduct(item.id, 'reject', notes);
                            }
                          }}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {pendingItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No products pending moderation</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="bg-zinc-900 rounded-xl border border-[#2C2C2C] overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Purchase History</h2>
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="bg-[#1A1A1A] p-4 rounded-lg border border-[#2C2C2C]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{purchase.item?.title || 'Unknown Item'}</h3>
                      <span className="text-yellow-400 font-semibold">
                        {purchase.price_paid?.toLocaleString()} coins
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
                      <div>
                        <span className="font-semibold">Buyer:</span> {purchase.buyer?.username || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-semibold">Seller:</span> {purchase.seller?.username || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-semibold">Platform Fee:</span> {purchase.platform_fee?.toLocaleString()} coins
                      </div>
                      <div>
                        <span className="font-semibold">Seller Earnings:</span> {purchase.seller_earnings?.toLocaleString()} coins
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-2">
                      Purchased on {new Date(purchase.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}

                {purchases.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No purchases found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <div className="bg-zinc-900 rounded-xl border border-[#2C2C2C] overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-red-400" />
                Marketplace Disputes & Arbitration
              </h2>
              <div className="space-y-4">
                {disputes.map((dispute) => (
                  <div key={dispute.id} className="bg-[#1A1A1A] p-4 rounded-lg border border-red-500/30">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{dispute.item_title || 'Unknown Item'}</h3>
                          <span className={`px-2 py-1 rounded text-xs ${
                            dispute.status === 'pending' ? 'bg-orange-600' :
                            dispute.status === 'under_review' ? 'bg-yellow-600' :
                            dispute.status === 'arbitration' ? 'bg-red-600' :
                            'bg-gray-600'
                          }`}>
                            {dispute.status?.replace('_', ' ')}
                          </span>
                          <span className="text-yellow-400 font-semibold">
                            {dispute.dispute_amount?.toLocaleString()} coins disputed
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{dispute.dispute_reason}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                          <div>
                            <span className="font-semibold">Buyer:</span> {dispute.buyer_username || 'Unknown'}
                          </div>
                          <div>
                            <span className="font-semibold">Seller:</span> {dispute.seller_username || 'Unknown'}
                          </div>
                          <div>
                            <span className="font-semibold">Type:</span> {dispute.dispute_type?.replace('_', ' ')}
                          </div>
                          <div>
                            <span className="font-semibold">Deadline:</span> {dispute.days_until_deadline?.toFixed(1)} days
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Filed: {new Date(dispute.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            const refundAmount = parseInt(prompt('Refund amount (0 for seller wins):') || '0');
                            const resolution = prompt('Resolution details:') || '';
                            if (resolution !== null) {
                              resolveDispute(dispute.id, resolution, refundAmount);
                            }
                          }}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {disputes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Gavel className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No active disputes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fraud Holds Tab */}
        {activeTab === 'fraud' && (
          <div className="bg-zinc-900 rounded-xl border border-[#2C2C2C] overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-pink-400" />
                Fraud Prevention & Holds
              </h2>
              <div className="space-y-4">
                {fraudHolds.map((hold) => (
                  <div key={hold.seller_id} className="bg-[#1A1A1A] p-4 rounded-lg border border-pink-500/30">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{hold.username || 'Unknown Seller'}</h3>
                          <span className="text-pink-400 font-semibold">
                            {hold.fraud_hold_coins?.toLocaleString()} coins held
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{hold.fraud_hold_reason}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                          <div>
                            <span className="font-semibold">Email:</span> {hold.email || 'N/A'}
                          </div>
                          <div>
                            <span className="font-semibold">Available Balance:</span> {hold.available_coins?.toLocaleString()} coins
                          </div>
                          <div>
                            <span className="font-semibold">Total Earned:</span> {hold.total_earned_coins?.toLocaleString()} coins
                          </div>
                          <div>
                            <span className="font-semibold">Release In:</span> {hold.days_until_release?.toFixed(1)} days
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Hold applied: {new Date(hold.fraud_hold_until).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => releaseFraudHold(hold.seller_id)}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Release Hold
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Apply New Fraud Hold */}
                <div className="bg-[#1A1A1A] p-4 rounded-lg border border-pink-500/30">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-pink-400" />
                    Apply New Fraud Hold
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Seller ID"
                      className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white"
                      id="fraud-seller-id"
                    />
                    <input
                      type="number"
                      placeholder="Hold Amount"
                      className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white"
                      id="fraud-hold-amount"
                    />
                    <input
                      type="number"
                      placeholder="Hold Days (30)"
                      defaultValue="30"
                      className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white"
                      id="fraud-hold-days"
                    />
                    <button
                      onClick={() => {
                        const sellerId = (document.getElementById('fraud-seller-id') as HTMLInputElement)?.value;
                        const holdAmount = parseInt((document.getElementById('fraud-hold-amount') as HTMLInputElement)?.value || '0');
                        const holdDays = parseInt((document.getElementById('fraud-hold-days') as HTMLInputElement)?.value || '30');
                        const reason = prompt('Reason for fraud hold:');
                        if (sellerId && holdAmount > 0 && reason) {
                          applyFraudHold(sellerId, holdAmount, reason, holdDays);
                        }
                      }}
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded text-sm transition-colors flex items-center justify-center gap-1"
                    >
                      <Shield className="w-4 h-4" />
                      Apply Hold
                    </button>
                  </div>
                </div>

                {fraudHolds.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No active fraud holds</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}