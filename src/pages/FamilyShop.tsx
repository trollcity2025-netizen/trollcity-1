import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Coins, Shield, Star, Zap,
  MessageSquare,
  Crown, Flame, Layout, Clock, Monitor,
  Award, Gem,
  CheckCircle, Sparkles
} from 'lucide-react'
import { UserProfile } from '../lib/supabase'

const getCategoryTitle = (type) => {
  switch (type) {
    case 'limited': return 'Limited-Time Offers'
    case 'boost': return 'Spotlight / Placement Boosts'
    case 'war_item': return 'War Boosts'
    case 'cosmetic': return 'Cosmetic Upgrades'
    case 'officer': return 'Officer / Leadership Upgrades'
    case 'social': return 'Emotes / Social Packs'
    case 'feature': return 'Family Features / Engagement Systems'
    case 'economy': return 'Vault / Rewards / Economy Tools'
    case 'xp_boost': return 'XP / Progression Boosts'
    case 'legendary': return 'Legendary Family Effects'
    default: return 'Other Items'
  }
}

const getCategoryIcon = (type) => {
  switch (type) {
    case 'limited': return <Clock className="w-6 h-6 text-orange-400" />
    case 'boost': return <Zap className="w-6 h-6 text-yellow-400" />
    case 'war_item': return <Flame className="w-6 h-6 text-red-400" />
    case 'cosmetic': return <Sparkles className="w-6 h-6 text-pink-400" />
    case 'officer': return <Shield className="w-6 h-6 text-blue-400" />
    case 'social': return <MessageSquare className="w-6 h-6 text-green-400" />
    case 'feature': return <Monitor className="w-6 h-6 text-purple-400" />
    case 'economy': return <Coins className="w-6 h-6 text-blue-400" />
    case 'xp_boost': return <Star className="w-6 h-6 text-yellow-400" />
    case 'legendary': return <Crown className="w-6 h-6 text-purple-400" />
    default: return <Award className="w-6 h-6 text-gray-400" />
  }
}

const FamilyShop = ({ user: _authUser }: { user?: UserProfile | null }) => {
  const { user } = useAuthStore()
  const [shopItems, setShopItems] = useState([])
  const [familyPurchases, setFamilyPurchases] = useState([])
  const [familyStats, setFamilyStats] = useState(null)
  const [family, setFamily] = useState(null)
  const [memberRole, setMemberRole] = useState('member')
  const [loading, setLoading] = useState(true)

  const loadShopData = useCallback(async () => {
    setLoading(true)
    try {
      // Step 1: Get membership first (without join to avoid relationship issues)
      const { data: membership, error: memberError } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (memberError) throw memberError

      if (membership?.family_id) {
        // Step 2: Get family details
        const { data: familyData, error: familyError } = await supabase
          .from('troll_families')
          .select('id, name, emblem_url')
          .eq('id', membership.family_id)
          .single()

        if (familyError) throw familyError

        if (familyData) {
          setFamily(familyData)
          setMemberRole(membership.role)

          const familyId = familyData.id

          // Load family stats
          const { data: stats } = await supabase
            .from('family_stats')
            .select('*')
            .eq('family_id', familyId)
            .maybeSingle()

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
      } else {
        setFamily(null)
      }
    } catch (error) {
      console.error('Error loading shop data:', error)
      if (error.code !== 'PGRST116') {
        toast.error('Failed to load shop data')
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadShopData()
    }
  }, [user, loadShopData])

  const purchaseItem = async (item) => {
    if (!family || !familyStats) return

    // Check permissions
    if (memberRole === 'member') {
      toast.error('Only family leaders and officers can make purchases')
      return
    }

    // Check if already purchased (unless consumable)
    if (!item.is_consumable && familyPurchases.includes(item.id)) {
      toast.error('This item has already been purchased by your family')
      return
    }

    // Check if family has enough coins
    if (familyStats.total_coins < item.cost_family_coins) {
      toast.error(`Not enough Vault Tokens. Need ${item.cost_family_coins.toLocaleString()}, have ${familyStats.total_coins.toLocaleString()}`)
      return
    }

    // Check if family has enough XP
    if ((item.cost_family_xp || 0) > 0 && familyStats.xp < item.cost_family_xp) {
      toast.error(`Not enough Family XP. Need ${item.cost_family_xp.toLocaleString()}, have ${familyStats.xp.toLocaleString()}`)
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

      // Deduct coins and XP from family
      const { error: updateError } = await supabase.rpc('increment_family_stats', {
        p_family_id: family.id,
        p_coin_bonus: -item.cost_family_coins,
        p_xp_bonus: -(item.cost_family_xp || 0)
      })

      if (updateError) throw updateError

      // Log the purchase
      const costString = []
      if (item.cost_family_coins > 0) costString.push(`${item.cost_family_coins.toLocaleString()} tokens`)
      if (item.cost_family_xp > 0) costString.push(`${item.cost_family_xp.toLocaleString()} XP`)

      await supabase
        .from('family_activity_log')
        .insert({
          family_id: family.id,
          user_id: user.id,
          event_type: 'shop_purchase',
          event_message: `Family purchased "${item.name}" for ${costString.join(' + ')}`
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
      case 'boost': return <Zap className="w-5 h-5 text-yellow-400" />
      case 'war_item': return <Flame className="w-5 h-5 text-red-400" />
      case 'cosmetic': return <Sparkles className="w-5 h-5 text-pink-400" />
      case 'officer': return <Shield className="w-5 h-5 text-blue-400" />
      case 'social': return <MessageSquare className="w-5 h-5 text-green-400" />
      case 'feature': return <Monitor className="w-5 h-5 text-purple-400" />
      case 'economy': return <Coins className="w-5 h-5 text-blue-400" />
      case 'xp_boost': return <Star className="w-5 h-5 text-yellow-400" />
      case 'legendary': return <Crown className="w-5 h-5 text-purple-400" />
      case 'prestige': return <Crown className="w-5 h-5 text-purple-400" />
      // Legacy support
      case 'perk': return <Layout className="w-5 h-5 text-green-400" />
      case 'badge':
        return <Award className="w-5 h-5 text-yellow-400" />
      case 'entrance_effect':
        return <Sparkles className="w-5 h-5 text-purple-400" />
      case 'profile_frame':
        return <Shield className="w-5 h-5 text-blue-400" />
      case 'banner':
        return <Star className="w-5 h-5 text-green-400" />
      default:
        return <Gem className="w-5 h-5 text-gray-400" />
    }
  }

  const getUnlockTypeLabel = (unlockType) => {
    switch (unlockType) {
      case 'boost': return 'Boost'
      case 'war_item': return 'War Item'
      case 'cosmetic': return 'Cosmetic'
      case 'officer': return 'Officer'
      case 'social': return 'Social'
      case 'feature': return 'Feature'
      case 'economy': return 'Economy'
      case 'xp_boost': return 'XP Boost'
      case 'legendary': return 'Legendary'
      case 'prestige': return 'Prestige'
      // Legacy support
      case 'perk': return 'Perk'
      case 'badge':
        return 'Badge'
      case 'entrance_effect':
        return 'Entrance Effect'
      case 'profile_frame':
        return 'Profile Frame'
      case 'banner':
        return 'Family Banner'
      default:
        return unlockType?.replace(/_/g, ' ') || 'Item'
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
            onClick={() => window.location.href = '/family/browse'}
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

          {/* Vault Tokens Balance */}
          <div className="flex justify-center gap-4">
            <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30 inline-block">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-400" />
                <span className="text-xl font-bold text-yellow-400">
                  {(familyStats?.total_coins || 0).toLocaleString()}
                </span>
                <span className="text-gray-300">Vault Tokens</span>
              </div>
            </div>

            {/* Family XP Balance */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/30 inline-block">
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold text-purple-400">
                  {(familyStats?.xp || 0).toLocaleString()}
                </span>
                <span className="text-gray-300">Family XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Items Categories */}
        {['limited', 'boost', 'war_item', 'cosmetic', 'officer', 'social', 'feature', 'economy', 'xp_boost', 'legendary', 'other'].map(category => {
          const items = shopItems.filter(item => {
            if (category === 'limited') return item.is_limited
            if (item.is_limited) return false
            return (item.unlock_type || 'other') === category
          })
          if (items.length === 0) return null

          return (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 border-b border-zinc-800 pb-2 text-white">
                {getCategoryIcon(category)}
                {getCategoryTitle(category)}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => {
                  const isPurchased = familyPurchases.includes(item.id)
                  const canAffordCoins = (familyStats?.total_coins || 0) >= item.cost_family_coins
                  const canAffordXP = (familyStats?.xp || 0) >= (item.cost_family_xp || 0)
                  const canAfford = canAffordCoins && canAffordXP

                  // Allow purchase if not purchased OR is consumable
                  const canPurchase = memberRole !== 'member' && (!isPurchased || item.is_consumable) && canAfford

                  return (
                    <div
                      key={item.id}
                      className={`bg-zinc-900 rounded-xl p-6 border transition-all ${
                        isPurchased && !item.is_consumable
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
                              isPurchased && !item.is_consumable
                                ? 'bg-green-900 text-green-300'
                                : item.is_limited 
                                  ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30'
                                  : 'bg-zinc-700 text-gray-300'
                            }`}>
                              {item.is_limited ? 'Limited Edition' : getUnlockTypeLabel(item.unlock_type)}
                            </span>
                            {isPurchased && !item.is_consumable && (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-gray-300 text-sm mb-4 min-h-[40px]">{item.description}</p>

                      {/* Cost */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-yellow-400" />
                            <span className="font-bold text-yellow-400">
                              {item.cost_family_coins.toLocaleString()}
                            </span>
                          </div>
                          {(item.cost_family_xp || 0) > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <Star className="w-5 h-5 text-purple-400" />
                              <span className="font-bold text-purple-400">
                                {item.cost_family_xp.toLocaleString()} XP
                              </span>
                            </div>
                          )}
                        </div>
                        {isPurchased && !item.is_consumable && (
                          <span className="text-green-400 font-semibold">Unlocked</span>
                        )}
                      </div>

                      {/* Purchase Button */}
                      {isPurchased && !item.is_consumable ? (
                        <button
                          disabled
                          className="w-full py-3 bg-green-600/20 text-green-400 rounded-lg font-semibold cursor-default"
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
                          className="w-full py-3 bg-red-900/50 text-red-300 rounded-lg font-semibold cursor-not-allowed"
                        >
                          💰 Insufficient Funds
                        </button>
                      ) : (
                        <button
                          onClick={() => purchaseItem(item)}
                          className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-black rounded-lg font-semibold transition-colors"
                        >
                          🛒 Purchase {item.is_consumable ? '(Again)' : ''}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Info Section */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">💰 Family Shop Rules</h3>
          <div className="space-y-2 text-zinc-300 text-sm">
            <p>• <strong>Leadership Required:</strong> Only family leaders and officers can make purchases</p>
            <p>• <strong>One Per Family:</strong> Unlocks are permanent; consumables can be repurchased</p>
            <p>• <strong>Vault Tokens & XP:</strong> Purchases use Vault Tokens and Family XP</p>
            <p>• <strong>Exclusive Unlocks:</strong> Items provide unique perks, boosts, and customizations</p>
            <p>• <strong>Earn More:</strong> Complete family tasks and participate in wars to earn tokens</p>
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
