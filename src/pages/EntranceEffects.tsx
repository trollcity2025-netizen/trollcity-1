import React, { useState, useEffect } from 'react'
import { CreditCard, Coins, DollarSign, Check, X, Star } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase, UserProfile } from '../lib/supabase'
import { deductCoins } from '../lib/coinTransactions'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'

import { ENTRANCE_EFFECTS_DATA as DEFAULT_EFFECTS, type EntranceEffect } from '../lib/entranceEffects'

const EntranceEffects = () => {
  const { profile } = useAuthStore()
  const { balances, refreshCoins } = useCoins()
  const [effects, setEffects] = useState<EntranceEffect[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [_backgroundLoading, setBackgroundLoading] = useState(false)

  useEffect(() => {
    loadEntranceEffectsFromDatabase()
  }, [])

  const loadEntranceEffectsFromDatabase = async () => {
    try {
      setLoading(true)
      // Load entrance effects from database table (not hardcoded)
      const { data, error } = await supabase
        .from('entrance_effects')
        .select('id, name, coin_cost, rarity, animation_type')
        .order('coin_cost', { ascending: true })
      
      if (error) {
        console.warn('Failed to load entrance effects from DB, using defaults:', error)
        // Fallback to hardcoded defaults if table doesn't exist
        setEffects(DEFAULT_EFFECTS)
      } else if (data && data.length > 0) {
        // Map database rows to EntranceEffect type
        const dbEffects = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          coin_cost: row.coin_cost,
          rarity: row.rarity || 'Standard',
          animation_type: row.animation_type || 'default',
          icon: '✨',
          description: `${row.rarity || 'Standard'} effect`,
          image_url: `https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(row.name)}&image_size=square`
        } as EntranceEffect))
        setEffects(dbEffects)
      } else {
        // Use defaults if table is empty
        setEffects(DEFAULT_EFFECTS)
      }
    } catch (error: any) {
      console.error('Error loading entrance effects:', error)
      setEffects(DEFAULT_EFFECTS)
    } finally {
      setLoading(false)
      setBackgroundLoading(false)
    }
  }

  const purchaseEffect = async (effect: EntranceEffect) => {
    if (!profile) {
      toast.error('Please sign in to purchase effects')
      return
    }

    const userCoins = balances.troll_coins || 0
    if (userCoins < effect.coin_cost) {
      toast.error('Insufficient coins. Please purchase more coins.')
      return
    }

    try {
      setPurchasing(effect.id)

      // Deduct coins using the proper coin transaction system
      const deductResult = await deductCoins({
        userId: profile.id,
        amount: effect.coin_cost,
        type: 'entrance_effect',
        description: `Purchased ${effect.name} entrance effect`,
        metadata: {
          effect_id: effect.id,
          effect_name: effect.name
        }
      })

      if (!deductResult.success) {
        toast.error('Failed to process payment')
        return
      }

      // Add effect to user's purchased effects
      const { error: purchaseError } = await supabase
        .from('user_entrance_effects')
        .upsert({
          user_id: profile.id,
          effect_id: effect.id,
          purchased_at: new Date().toISOString()
        }, { onConflict: 'user_id, effect_id' })

      if (purchaseError) throw purchaseError

      await refreshCoins().catch(err => console.warn('Failed to refresh coins after purchase:', err))
      toast.success(`Successfully purchased ${effect.name}!`)

      // Update local profile immediately (optimistic)
      const optimisticProfile = {
        ...profile,
        troll_coins: Number(deductResult.newBalance ?? 0)
      }
      useAuthStore.getState().setProfile(optimisticProfile as UserProfile)

      // Refresh profile from DB in background (silent, with delay)
      refreshProfileBackground()

    } catch (error: any) {
      toast.error('Failed to purchase effect')
      console.error('Purchase error:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const refreshProfileBackground = async () => {
    // Wait 500ms to allow database replication
    await new Promise(resolve => setTimeout(resolve, 500))
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profile?.id)
        .single()
      
      if (!error && data) {
        const currentProfile = useAuthStore.getState().profile
        
        // Only update if coins actually changed (prevent flickering)
        if (currentProfile &&
            currentProfile.troll_coins === data.troll_coins &&
            currentProfile.trollmonds === data.trollmonds &&
            currentProfile.total_earned_coins === data.total_earned_coins &&
            currentProfile.total_spent_coins === data.total_spent_coins) {
          return
        }
        
        useAuthStore.getState().setProfile(data)
      }
    } catch (error) {
      console.error('Background profile refresh error:', error)
    }
  }

  const getRarityColor = (rarity: string) => {
    const r = rarity.toLowerCase()
    if (r.includes('unobtainable')) return 'bg-gradient-to-r from-black to-gray-700'
    if (r.includes('divine')) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    if (r.includes('ultra')) return 'bg-gradient-to-r from-indigo-500 to-purple-600'
    if (r.includes('mythic')) return 'bg-gradient-to-r from-pink-500 to-purple-500'
    if (r.includes('legendary')) return 'bg-gradient-to-r from-[#FFC93C] to-[#FFD700]'
    if (r.includes('exotic')) return 'bg-gradient-to-r from-teal-500 to-emerald-600'
    if (r.includes('exclusive')) return 'bg-gradient-to-r from-blue-500 to-cyan-500'
    if (r.includes('rare')) return 'bg-gradient-to-r from-[#E2E2E2] to-[#B8B8B8]'
    return 'bg-gradient-to-r from-[#666666] to-[#888888]'
  }


  const getCardGradient = (rarity: string) => {
    const r = rarity.toLowerCase()
    if (r.includes('unobtainable')) return 'bg-gradient-to-br from-gray-900 via-black to-gray-800'
    if (r.includes('divine')) return 'bg-gradient-to-br from-yellow-900/30 via-amber-900/20 to-yellow-900/30'
    if (r.includes('ultra')) return 'bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-indigo-900/30'
    if (r.includes('mythic')) return 'bg-gradient-to-br from-pink-900/30 via-purple-900/20 to-pink-900/30'
    if (r.includes('legendary')) return 'bg-gradient-to-br from-orange-900/30 via-red-900/20 to-yellow-900/30'
    if (r.includes('exotic')) return 'bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-emerald-900/30'
    if (r.includes('exclusive')) return 'bg-gradient-to-br from-blue-900/30 via-cyan-900/20 to-blue-900/30'
    if (r.includes('rare')) return 'bg-gradient-to-br from-blue-900/30 via-cyan-900/20 to-blue-900/30'
    return 'bg-gradient-to-br from-gray-900/30 via-slate-900/20 to-gray-900/30'
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-[#0D0D0D]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#FFC93C]/20 rounded-full animate-pulse mx-auto mb-4"></div>
          <div className="text-[#FFC93C] font-bold">Loading Entrance Effects...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white relative overflow-hidden">
      {/* Top Banner */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center space-x-2 bg-[#121212] border border-[#FFC93C]/30 rounded-full px-6 py-3">
          <Coins className="w-5 h-5 text-[#FFC93C]" />
          <span className="text-[#00D4FF] text-sm font-semibold">
            Purchased Troll Coins have REAL VALUE and can be cashed out by streamers
          </span>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Star className="w-6 h-6 text-[#FFC93C]" />
          <h1 className="text-3xl font-bold text-white">Entrance Effects</h1>
        </div>
        <p className="text-[#E2E2E2]/70">Make a grand entrance to any stream</p>
      </div>

      {/* Effects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {effects.map((effect) => (
          <div
            key={effect.id}
            className={`${getCardGradient(effect.rarity)} border border-gray-700 rounded-lg p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-[#121212] ${effect.name === 'TROLLCITY' ? 'ring-2 ring-[#FFC93C] shadow-[#FFC93C]/40' : ''}`}
          >
            {/* Rarity Chip */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${getRarityColor(effect.rarity)} mb-4`}>
              {effect.rarity}
            </div>
            {effect.name === 'TROLLCITY' && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-black bg-[#FFC93C] mb-4 ml-2">
                BEST
              </div>
            )}

            {/* Effect Image */}
            <div className="w-full h-32 bg-troll-dark-card/30 rounded-lg mb-4 flex items-center justify-center border border-troll-neon-pink/10">
              <img
                src={effect.image_url}
                alt={effect.name}
                className="w-20 h-20 object-cover rounded-lg opacity-80"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = `https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(effect.description)}&image_size=square`
                }}
              />
            </div>

            {/* Effect Info */}
            <h3 className="text-xl font-bold text-white mb-2">{effect.name}</h3>
            <p className="text-troll-neon-blue/70 text-sm mb-4">{effect.description}</p>

            {/* Price and Purchase */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-troll-neon-gold" />
                <span className="text-troll-neon-gold font-bold text-lg">{effect.coin_cost}</span>
              </div>
              <button
                onClick={() => purchaseEffect(effect)}
                disabled={purchasing === effect.id || balances.troll_coins < effect.coin_cost}
                className="px-6 py-2 bg-gradient-to-r from-troll-neon-pink to-troll-neon-purple text-white font-bold rounded-lg hover:from-troll-neon-pink/80 hover:to-troll-neon-purple/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {purchasing === effect.id ? 'Purchasing...' : 'Purchase'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Info Bar */}
      <div className="bg-gradient-to-r from-troll-neon-blue/20 to-troll-neon-green/20 border border-troll-neon-blue/30 rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-4">
          <CreditCard className="w-8 h-8 text-troll-neon-blue" />
          <div>
            <h3 className="text-lg font-bold text-white">Secure Payment</h3>
            <p className="text-troll-neon-blue/70">Pay using your saved payment methods or enter a new card</p>
          </div>
        </div>
      </div>

      {/* Balances Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance */}
        <div className="bg-troll-dark-card/50 border border-troll-neon-green/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-troll-neon-green">Total Balance</h3>
            <DollarSign className="w-6 h-6 text-troll-neon-gold" />
          </div>
          <div className="text-3xl font-bold text-white mb-4">
            {balances.troll_coins || 0}
          </div>
          <div className="border-t border-troll-neon-green/20 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-troll-neon-blue/70">Total Value:</span>
              <span className="text-troll-neon-green font-bold">
                ${((balances.troll_coins || 0) * 0.01).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Troll Coins */}
        <div className="bg-troll-dark-card/50 border border-troll-neon-green/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-troll-neon-green">Troll Coins</h3>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-troll-neon-green" />
              <Coins className="w-6 h-6 text-troll-neon-gold" />
            </div>
          </div>
          <div className="text-3xl font-bold text-troll-neon-green mb-4">
            {balances.troll_coins || 0}
          </div>
          <div className="border-t border-troll-neon-green/20 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-troll-neon-blue/70">Value:</span>
              <span className="text-troll-neon-purple font-bold">
                ${((balances.troll_coins || 0) * 0.01).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-troll-neon-blue/50">Real value • Can spend</p>
          </div>
        </div>

        {/* trollmonds */}
        <div className="bg-troll-dark-card/50 border border-troll-neon-red/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-troll-neon-red">trollmonds</h3>
            <div className="flex items-center space-x-2">
              <X className="w-5 h-5 text-troll-neon-red" />
              <Coins className="w-6 h-6 text-troll-neon-orange" />
            </div>
          </div>
          <div className="text-3xl font-bold text-troll-neon-red mb-4">
            {profile ? (profile.trollmonds || 0) : 0}
          </div>
          <div className="border-t border-troll-neon-red/20 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-troll-neon-blue/70">Value:</span>
              <span className="text-troll-neon-blue/50 font-bold">
                $0.00
              </span>
            </div>
            <p className="text-xs text-troll-neon-blue/50">No cash value • Can spend</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EntranceEffects
