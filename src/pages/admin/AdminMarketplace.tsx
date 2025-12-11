import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Store, Package, Users, DollarSign, Ban, CheckCircle, XCircle, Edit, Trash } from 'lucide-react'

export default function AdminMarketplace() {
  const [items, setItems] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'purchases'>('items')

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              {items.filter(item => item.status === 'active').length}
            </p>
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
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-2 rounded-md transition-colors ${activeTab === 'purchases' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Purchase History
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
      </div>
    </div>
  )
}