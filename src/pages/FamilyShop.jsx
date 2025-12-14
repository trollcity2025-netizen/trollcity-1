import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Award, Crown, Coins, Shield, Star, Zap,
  Sparkles, Gem, Lock, CheckCircle
} from 'lucide-react'

const FamilyShop = () => {
  const { user, profile } = useAuthStore()
  const [shopItems, setShopItems] = useState([])
  const [familyPurchases, setFamilyPurchases] = useState([])
  const [familyStats, setFamilyStats] = useState(null)
  const [family, setFamily] = useState(null)
  const [memberRole, setMemberRole] = useState('member')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadShopData()
    }
  }, [user])

  const loadShopData = async () => {
    setLoading(true)
    try {
      // Get user's family membership
      const { data: membership } = await supabase
        .from('family_members')
        .select(`
          role,
          troll_families (
            id,
            name,
            emblem_url
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (membership?.troll_families) {
        setFamily(membership.troll_families)
        setMemberRole(membership.role)

        const familyId = membership.troll_families.id

        // Load family stats
        const { data: stats } = await supabase
          .from('family_stats')
          .select('*')
          .eq('family_id', familyId)
          .single()

        setFamilyStats(stats)

        // Load shop items
        const { data: items } = await supabase
          .from('family_shop_items')
          .select('*')
          .eq('is_active', true)
          .order('cost_family_coins', { ascending: true })

        setShopItems(items || [])

        // Load family's purchases
        const { data: purchases } = await supabase
          .from('family_shop_purchases')
          .select('item_id')
          .eq('family_id', familyId)

        setFamilyPurchases(purchases?.map(p => p.item_id) || [])
      }
    } catch (error) {
      console.error('Error loading shop data:', error)
      toast.error('Failed to load shop data')
    } finally {
      setLoading(false)
    }
  }

  const purchaseItem = async (item) => {
    if (!family || !familyStats) return

    // Check permissions
    if (memberRole === 'member') {
      toast.error('Only family leaders and officers can make purchases')
      return
    }

    // Check if already purchased
    if (familyPurchases.includes(item.id)) {
      toast.error('This item has already been purchased by your family')
      return
    }

    // Check if family has enough coins
    if (familyStats.total_coins < item.cost_family_coins) {
      toast.error(`Not enough family coins. Need ${item.cost_family_coins.toLocaleString()}, have ${familyStats.total_coins.toLocaleString()}`)
      return
    }

    try {
      // Make purchase
      const { error: purchaseError } = await supabase
        .from('family_shop_purchases')
        .insert({
          family_id: family.id,
          item_id: item.id,
          purchased_by: user.id
        })

      if (purchaseError) throw purchaseError

      // Deduct coins from family
      const { error: updateError } = await supabase.rpc('increment_family_stats', {
        p_family_id: family.id,
        p_coin_bonus: -item.cost_family_coins,
        p_xp_bonus: 0
      })

      if (updateError) throw updateError

      // Log the purchase
      await supabase
        .from('family_activity_log')
        .insert({
          family_id: family.id,
          user_id: user.id,
          event_type: 'shop_purchase',
          event_message: `Family purchased "${item.name}" for ${item.cost_family_coins.toLocaleString()} coins`
        })

      toast.success(`Successfully purchased ${item.name}!`)
      loadShopData() // Refresh data
    } catch (error) {
      console.error('Error making purchase:', error)
      toast.error('Failed to complete purchase')
    }
  }

  const getUnlockIcon = (unlockType) => {
    switch (unlockType) {
      case 'badge':
        return <Award className="w-5 h-5 text-yellow-400" />
      case 'entrance_effect':
        return <Sparkles className="w-5 h-5 text-purple-400" />
      case 'profile_frame':
        return <Shield className="w-5 h-5 text-blue-400" />
      case 'banner':
        return <Star className="w-5 h-5 text-green-400" />
      case 'perk':
        return <Zap className="w-5 h-5 text-pink-400" />
      default:
        return <Gem className="w-5 h-5 text-gray-400" />
    }
  }

  const getUnlockTypeLabel = (unlockType) => {
    switch (unlockType) {
      case 'badge':
        return 'Badge'
      case 'entrance_effect':
        return 'Entrance Effect'
      case 'profile_frame':
        return 'Profile Frame'
      case 'banner':
        return 'Family Banner'
      case 'perk':
        return 'Special Perk'
      default:
        return unlockType
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <Award className="animate-spin w-8 h-8 mx-auto mb-4 text-yellow-400" />
          <p>Loading family shop...</p>
        </div>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto text-center">
          <Award className="w-16 h-16 mx-auto mb-6 text-yellow-400" />
          <h1 className="text-3xl font-bold mb-4">Family Shop</h1>
          <p className="text-gray-300 mb-6">
            Join a family to unlock exclusive perks and customizations!
          </p>
          <button
            onClick={() => window.location.href = '/apply/family'}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Browse Families
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            {family.emblem_url && (
              <img
                src={family.emblem_url}
                alt={`${family.name} emblem`}
                className="w-12 h-12 rounded-full border-2 border-yellow-400"
              />
            )}
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Award className="w-8 h-8 text-yellow-400" />
                FAMILY SHOP
              </h1>
              <p className="text-gray-300">{family.name}</p>
            </div>
          </div>

          {/* Family Coins Balance */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30 inline-block">
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-xl font-bold text-yellow-400">
                {(familyStats?.total_coins || 0).toLocaleString()}
              </span>
              <span className="text-gray-300">Family Coins Available</span>
            </div>
          </div>
        </div>

        {/* Shop Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shopItems.map((item) => {
            const isPurchased = familyPurchases.includes(item.id)
            const canAfford = (familyStats?.total_coins || 0) >= item.cost_family_coins
            const canPurchase = memberRole !== 'member' && !isPurchased && canAfford

            return (
              <div
                key={item.id}
                className={`bg-zinc-900 rounded-xl p-6 border transition-all ${
                  isPurchased
                    ? 'border-green-500/50 bg-green-900/10'
                    : canPurchase
                    ? 'border-yellow-500/50 hover:border-yellow-400'
                    : 'border-zinc-700 opacity-75'
                }`}
              >
                {/* Item Header */}
                <div className="flex items-center gap-3 mb-4">
                  {getUnlockIcon(item.unlock_type)}
                  <div>
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        isPurchased
                          ? 'bg-green-900 text-green-300'
                          : 'bg-zinc-700 text-gray-300'
                      }`}>
                        {getUnlockTypeLabel(item.unlock_type)}
                      </span>
                      {isPurchased && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-4">{item.description}</p>

                {/* Cost */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold text-yellow-400">
                      {item.cost_family_coins.toLocaleString()}
                    </span>
                  </div>
                  {isPurchased && (
                    <span className="text-green-400 font-semibold">Unlocked</span>
                  )}
                </div>

                {/* Purchase Button */}
                {isPurchased ? (
                  <button
                    disabled
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold cursor-not-allowed"
                  >
                    ✅ Unlocked
                  </button>
                ) : memberRole === 'member' ? (
                  <button
                    disabled
                    className="w-full py-3 bg-zinc-700 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                  >
                    🔒 Officers Only
                  </button>
                ) : !canAfford ? (
                  <button
                    disabled
                    className="w-full py-3 bg-red-900 text-red-300 rounded-lg font-semibold cursor-not-allowed"
                  >
                    💰 Not Enough Coins
                  </button>
                ) : (
                  <button
                    onClick={() => purchaseItem(item)}
                    className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-black rounded-lg font-semibold transition-colors"
                  >
                    🛒 Purchase
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Info Section */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">💰 Family Shop Rules</h3>
          <div className="space-y-2 text-zinc-300 text-sm">
            <p>• <strong>Leadership Required:</strong> Only family leaders and officers can make purchases</p>
            <p>• <strong>One Per Family:</strong> Each item can only be purchased once per family</p>
            <p>• <strong>Family Coins:</strong> Purchases are made using family coin balance</p>
            <p>• <strong>Exclusive Unlocks:</strong> Items provide unique perks and customizations</p>
            <p>• <strong>Earn More:</strong> Complete family tasks and participate in wars to earn coins</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/family/lounge'}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            ← Back to Family Lounge
          </button>
        </div>
      </div>
    </div>
  )
}

export default FamilyShop