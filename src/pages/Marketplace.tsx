import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Store, ShoppingCart, Coins, Plus } from 'lucide-react'
import { trollCityTheme } from '../styles/trollCityTheme'

export default function Marketplace() {
  console.log('🛒 Marketplace component rendering')
  const navigate = useNavigate()
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadShops()
  }, [])

  const loadShops = async () => {
    setLoading(true)
    try {
      // Load shops first
      const { data: shopsData, error: shopsError } = await supabase
        .from('trollcity_shops')
        .select('*')
        .eq('is_active', true)

      if (shopsError) throw shopsError

      // Fetch owner usernames
      const ownerIds = [...new Set((shopsData || []).map((s: any) => s.owner_id).filter(Boolean))]
      let ownerMap: Record<string, { username: string }> = {}
      if (ownerIds.length > 0) {
        const { data: ownersData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', ownerIds)
        ownerMap = (ownersData || []).reduce((acc: any, u: any) => {
          acc[u.id] = { username: u.username }
          return acc
        }, {})
      }

      // Load items for each shop
      const shopsWithItems = await Promise.all(
        (shopsData || []).map(async (shop) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('shop_items')
            .select('*')
            .eq('shop_id', shop.id)

          if (itemsError) {
            console.error(`Error loading items for shop ${shop.id}:`, itemsError)
            return { ...shop, shop_items: [], owner_username: ownerMap[shop.owner_id]?.username || 'unknown' }
          }

          return { ...shop, shop_items: itemsData || [], owner_username: ownerMap[shop.owner_id]?.username || 'unknown' }
        })
      )

      setShops(shopsWithItems)
    } catch (err) {
      console.error('Error loading shops:', err)
      toast.error('Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.app} ${trollCityTheme.text.primary} p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Store className="w-8 h-8 text-purple-400" />
            Troll City Marketplace
          </h1>
          <p className={`${trollCityTheme.text.muted}`}>Discover and purchase items from fellow Troll City members</p>
          <div className={`mt-4 max-w-3xl mx-auto ${trollCityTheme.backgrounds.glass} border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300`}>
            All sales are final. Illegal items or sales are strictly prohibited and will result in enforcement actions.
          </div>
        </div>
        {shops.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/sell')}
              className={`${trollCityTheme.gradients.button} px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity text-white`}
            >
              <Plus className="w-4 h-4" />
              Create Your Shop
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6 animate-pulse`}>
                <div className={`h-4 ${trollCityTheme.backgrounds.glass} rounded w-1/2 mb-2`}></div>
                <div className={`h-8 ${trollCityTheme.backgrounds.glass} rounded w-3/4`}></div>
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-12">
            <Store className={`w-16 h-16 ${trollCityTheme.text.muted} mx-auto mb-4`} />
            <h2 className="text-2xl font-bold mb-2">No Shops Available</h2>
            <p className={`${trollCityTheme.text.muted} mb-6`}>Be the first to create a shop and start selling!</p>
            <button
              onClick={() => navigate('/sell')}
              className={`${trollCityTheme.gradients.button} px-6 py-3 rounded-lg font-semibold text-white`}
            >
              Create Your Shop
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <div key={shop.id} className={`${trollCityTheme.components.card}`}>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-purple-300">{shop.name}</h3>
                  <p className={`text-sm ${trollCityTheme.text.muted}`}>by {shop.owner_username}</p>
                </div>

                <div className="space-y-3 mb-4">
                  {shop.shop_items?.length > 0 ? (
                    shop.shop_items.slice(0, 3).map((item: any) => (
                      <div key={item.id} className={`flex items-center justify-between ${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <span className="text-sm">{item.name}</span>
                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {item.price}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className={`${trollCityTheme.text.muted} text-sm`}>No items listed yet</p>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/shop/${shop.owner_username}`)}
                  className={`w-full px-4 py-2 ${trollCityTheme.gradients.button} rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-white`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Visit Shop
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
