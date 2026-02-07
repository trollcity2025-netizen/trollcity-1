import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { ShoppingBag, Coins } from 'lucide-react'

import { getTrollMartItems, purchaseTrollMartItem } from '../lib/purchases'
import { useTrollMartInventory } from '../hooks/usePurchases'
import type { TrollMartClothing } from '../types/purchases'

// Mock consumables for now (replace with DB fetch if needed)
const CONSUMABLES = [
  {
    id: 'broadcast_notification',
    name: 'Stream Notification',
    category: 'broadcast_notification',
    item_code: 'broadcast_notification',
    price_coins: 500,
    image_url: null,
    model_url: null,
    description: 'Send a notification to all users to watch your stream. Lasts 1 hour.',
    rarity: 'rare',
    is_active: true,
    sort_order: 100,
    created_at: '',
  },
  {
    id: 'broadcast_feature',
    name: 'Top Broadcaster Feature',
    category: 'broadcast_feature',
    item_code: 'broadcast_feature',
    price_coins: 1000,
    image_url: null,
    model_url: null,
    description: 'Feature your stream in the top broadcasters on the homepage for 1 hour.',
    rarity: 'epic',
    is_active: true,
    sort_order: 101,
    created_at: '',
  },
]

export default function TrollMart() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<TrollMartClothing[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const { ownedItems, loadInventory } = useTrollMartInventory()

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    const loadItems = async () => {
      setLoading(true)
      try {
        const data = await getTrollMartItems()
        // Add consumables to the end of the list
        setItems([...(data as TrollMartClothing[]), ...(CONSUMABLES as any[])])
      } finally {
        setLoading(false)
      }
    }
    loadItems()
  }, [user, navigate])

  const handlePurchase = async (item: TrollMartClothing) => {
    if (!user || !profile) return
    if (ownedItems.has(item.id)) return

    if ((profile.troll_coins || 0) < item.price_coins) {
      toast.error('Not enough TrollCoins')
      return
    }

    setPurchasingId(item.id)
    try {
      const spend = await deductCoins({
        userId: user.id,
        amount: item.price_coins,
        type: 'purchase',
        coinType: 'troll_coins',
        description: `Troll Mart purchase: ${item.name}`,
        metadata: {
          clothing_id: item.id,
          category: item.category
        }
      })

      if (!spend.success) {
        toast.error(spend.error || 'Failed to purchase item')
        return
      }

      const result = await purchaseTrollMartItem(user.id, item.id, item.price_coins)
      if (!result.success) {
        toast.error(result.error || 'Failed to finalize purchase')
        return
      }

      toast.success(`${item.name} added to your wardrobe`) 
      await loadInventory()
      refreshProfile()
    } catch (err: any) {
      console.error('Purchase failed', err)
      toast.error(err?.message || 'Purchase failed')
    } finally {
      setPurchasingId(null)
    }
  }

  if (!user) return null

  return (
    <div className={`min-h-screen p-6 ${trollCityTheme.backgrounds.primary} ${trollCityTheme.text.primary}`}>
      {/* Background Overlays */}
      <div className={`fixed inset-0 pointer-events-none ${trollCityTheme.overlays.radialCyan}`} />

      <div className="relative max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl font-bold ${trollCityTheme.text.primary}`}>Troll Mart</h1>
            <p className={`text-sm ${trollCityTheme.text.muted}`}>Avatar clothing, style upgrades, and stream consumables.</p>
          </div>
        </div>

        {loading ? (
          <div className={`text-center ${trollCityTheme.text.muted}`}>Loading Troll Mart...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const isOwned = ownedItems.has(item.id)
              return (
                <div key={item.id} className={`${trollCityTheme.components.card} flex flex-col h-full`}>
                  <div className={`aspect-square ${trollCityTheme.backgrounds.card} rounded-xl overflow-hidden mb-4 border ${trollCityTheme.borders.glass}`}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${trollCityTheme.text.muted} text-sm`}>
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold ${trollCityTheme.text.primary}`}>{item.name}</h3>
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${trollCityTheme.backgrounds.card} ${trollCityTheme.text.muted} border ${trollCityTheme.borders.glass}`}>
                            {item.category}
                        </span>
                        </div>
                        <p className={`text-xs ${trollCityTheme.text.muted} line-clamp-2`}>{item.description || 'Style upgrade'}</p>
                    </div>
                    
                    <div className={`mt-auto flex items-center justify-between pt-2 border-t ${trollCityTheme.borders.glass}`}>
                      <span className="flex items-center gap-1 text-yellow-300 font-semibold">
                        <Coins className="w-4 h-4" />
                        {item.price_coins.toLocaleString()}
                      </span>
                      <button
                        disabled={isOwned || purchasingId === item.id}
                        onClick={() => handlePurchase(item)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 transition-all ${isOwned ? `bg-white/5 ${trollCityTheme.text.muted} border ${trollCityTheme.borders.glass} cursor-default` : `${trollCityTheme.gradients.button} hover:shadow-lg hover:-translate-y-0.5`}`}
                      >
                        {isOwned ? 'Owned' : purchasingId === item.id ? 'Purchasing…' : 'Buy'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
