import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Package, Zap, Crown, Star, Palette, MessageCircle, Play, CheckCircle, XCircle } from 'lucide-react'

export default function UserInventory() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeItems, setActiveItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    loadInventory()
  }, [user, navigate])

  const loadInventory = async () => {
    try {
      setLoading(true)

      // Load user's inventory with item details
      const { data, error } = await supabase
        .from('user_inventory')
        .select('*')
        .eq('user_id', user!.id)
        .order('acquired_at', { ascending: false })

      if (error) throw error
      const inventoryData = data || []

      const itemIds = Array.from(
        new Set(
          inventoryData
            .map((entry: any) => entry.item_id)
            .filter(Boolean),
        ),
      )

      const itemDetailsMap: Record<string, any> = {}
      if (itemIds.length) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('marketplace_items')
          .select('id, title, description, thumbnail_url, type')
          .in('id', itemIds)

        if (itemsError) throw itemsError

        itemsData?.forEach((item) => {
          itemDetailsMap[item.id] = item
        })
      }

      const combinedInventory = inventoryData.map((entry) => ({
        ...entry,
        marketplace_item: itemDetailsMap[entry.item_id] || null,
      }))

      setInventory(combinedInventory)

      // Load active digital items
      const { data: activeData } = await supabase
        .from('user_active_items')
        .select('item_id')
        .eq('user_id', user!.id)

      const activeSet = new Set(activeData?.map(item => item.item_id) || [])
      setActiveItems(activeSet)

    } catch (err) {
      console.error('Error loading inventory:', err)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const toggleItemActivation = async (itemId: string, itemType: string) => {
    try {
      if (activeItems.has(itemId)) {
        // Deactivate
        const { error } = await supabase
          .from('user_active_items')
          .delete()
          .eq('user_id', user!.id)
          .eq('item_id', itemId)

        if (error) throw error

        setActiveItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })

        toast.success('Item deactivated')
      } else {
        // Check if we can activate this type (some items might have limits)
        if (itemType === 'effect' || itemType === 'badge') {
          // Allow multiple of these
          const { error } = await supabase
            .from('user_active_items')
            .insert({
              user_id: user!.id,
              item_id: itemId,
              item_type: itemType
            })

          if (error) throw error

          setActiveItems(prev => new Set([...prev, itemId]))
          toast.success('Item activated!')
        } else {
          // For other types, might have single activation limit
          toast.info('This item type has special activation rules')
        }
      }
    } catch (err) {
      console.error('Error toggling item:', err)
      toast.error('Failed to toggle item')
    }
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'effect': return <Zap className="w-5 h-5 text-yellow-400" />
      case 'badge': return <Crown className="w-5 h-5 text-purple-400" />
      case 'ticket': return <Star className="w-5 h-5 text-blue-400" />
      case 'digital': return <Palette className="w-5 h-5 text-green-400" />
      default: return <Package className="w-5 h-5 text-gray-400" />
    }
  }

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'effect': return 'Effect'
      case 'badge': return 'Badge'
      case 'ticket': return 'Ticket'
      case 'digital': return 'Digital Item'
      default: return 'Item'
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Package className="w-8 h-8 text-purple-400" />
            My Inventory
          </h1>
          <p className="text-gray-400">Manage your purchased items and activate digital effects</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : inventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your Inventory is Empty</h2>
            <p className="text-gray-400 mb-6">Purchase items from the marketplace to see them here</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventory.map((item) => {
              const isActive = activeItems.has(item.item_id)
              const isDigital = ['effect', 'badge', 'digital'].includes(item.marketplace_item?.type)

              return (
                <div key={item.id} className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                  {/* Item Image */}
                  {item.marketplace_item?.thumbnail_url && (
                    <div className="mb-4">
                      <img
                        src={item.marketplace_item.thumbnail_url}
                        alt={item.marketplace_item.title}
                        className="w-full h-32 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Item Info */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getItemIcon(item.marketplace_item?.type)}
                      <span className="text-sm text-gray-400">
                        {getItemTypeLabel(item.marketplace_item?.type)}
                      </span>
                      {isActive && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">
                      {item.marketplace_item?.title}
                    </h3>

                    <p className="text-gray-400 text-sm mb-2">
                      {item.marketplace_item?.description}
                    </p>

                    <p className="text-xs text-gray-500">
                      Acquired: {new Date(item.acquired_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isDigital ? (
                    <button
                      onClick={() => toggleItemActivation(item.item_id, item.marketplace_item?.type)}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                        isActive
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <XCircle className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-center py-3 text-gray-400">
                      <Package className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-sm">Physical Item</p>
                      <p className="text-xs">Contact seller for delivery</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Digital Items Info */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Digital Item Effects
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">Available Effects:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Entrance animations when joining streams</li>
                <li>• Special profile borders and frames</li>
                <li>• Animated badges and titles</li>
                <li>• Premium chat colors and styles</li>
                <li>• Troll-themed visual effects</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">How to Use:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Click "Activate" on digital items</li>
                <li>• Effects apply automatically across the app</li>
                <li>• Multiple effects can be active simultaneously</li>
                <li>• Deactivate anytime to remove effects</li>
                <li>• Physical items require manual redemption</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
