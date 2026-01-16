import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Hammer, TrendingUp, Coins, ShoppingBag, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { useCoins } from '../lib/hooks/useCoins'
import { recordCoinTransaction, deductCoins } from '../lib/coinTransactions'

type PropertyRow = {
  id: string
  owner_user_id: string
  base_value: number | null
  created_at: string
  condition_factor: number | null
  upgrade_spend_total: number | null
  is_listed: boolean | null
  ask_price: number | null
  is_starter: boolean | null
}

type PropertyUpgradeRow = {
  id: string
  property_id: string
  upgrade_type: string
  cost: number
  status: 'pending' | 'installed'
  tasks_required_total: number
  tasks_completed: number
}

type DeedRow = {
  id: string
  property_id: string
  current_owner_user_id: string
  created_at: string
}

type UpgradeDefinition = {
  id: string
  name: string
  category: string
  cost: number
  conditionImpact: number
  description: string
  tasksRequiredTotal: number
}

import { formatCompactNumber } from '../lib/utils'

const STARTER_HOME_BASE_VALUE = 1500
const UPGRADE_ROI = 0.75
const BASE_MONTHLY_RATE = -0.005
const UPGRADE_MONTHLY_RATE = 0.002
const MIN_CONDITION = 0.85
const MAX_CONDITION = 1.1
const MAX_LISTING_PREMIUM = 0.15

const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    id: 'interior_paint',
    name: 'Interior Paint Refresh',
    category: 'Interior',
    cost: 250,
    conditionImpact: 0.02,
    description: 'Fresh paint makes your starter home feel brand new.',
    tasksRequiredTotal: 3
  },
  {
    id: 'flooring_upgrade',
    name: 'Flooring Upgrade',
    category: 'Interior',
    cost: 500,
    conditionImpact: 0.04,
    description: 'Better floors increase comfort and long-term value.',
    tasksRequiredTotal: 4
  },
  {
    id: 'yard_cleanup',
    name: 'Yard Cleanup',
    category: 'Exterior',
    cost: 150,
    conditionImpact: 0.015,
    description: 'Basic yard work to keep curb appeal from slipping.',
    tasksRequiredTotal: 2
  },
  {
    id: 'security_system',
    name: 'Security System',
    category: 'Safety',
    cost: 800,
    conditionImpact: 0.03,
    description: 'Modern alarms and cameras to protect your investment.',
    tasksRequiredTotal: 4
  },
  {
    id: 'kitchen_renovation',
    name: 'Kitchen Renovation',
    category: 'Interior',
    cost: 2000,
    conditionImpact: 0.06,
    description: 'Full kitchen remodel that boosts comfort and value.',
    tasksRequiredTotal: 5
  },
  {
    id: 'bathroom_upgrade',
    name: 'Bathroom Upgrade',
    category: 'Interior',
    cost: 1200,
    conditionImpact: 0.045,
    description: 'Modern fixtures and finishes for your bathroom.',
    tasksRequiredTotal: 4
  },
  {
    id: 'solar_panels',
    name: 'Solar Panels',
    category: 'Exterior',
    cost: 5000,
    conditionImpact: 0.08,
    description: 'Energy-efficient solar installation with long-term benefits.',
    tasksRequiredTotal: 6
  },
  {
    id: 'landscaping_overhaul',
    name: 'Landscaping Overhaul',
    category: 'Exterior',
    cost: 1800,
    conditionImpact: 0.05,
    description: 'Full yard redesign to maximize curb appeal.',
    tasksRequiredTotal: 5
  }
]

function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function getMonthsSince(dateString: string) {
  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const approxMonths = diffMs / (1000 * 60 * 60 * 24 * 30)
  if (!isFinite(approxMonths) || approxMonths < 0) return 0
  return Math.floor(approxMonths)
}

function computeSystemValue(property: PropertyRow) {
  const baseValue = property.base_value ?? STARTER_HOME_BASE_VALUE
  const condition = clamp(property.condition_factor ?? 1, MIN_CONDITION, MAX_CONDITION)
  const upgradeSpend = property.upgrade_spend_total ?? 0
  const months = getMonthsSince(property.created_at)

  const baseInflationFactor = Math.pow(1 + BASE_MONTHLY_RATE, months)
  const upgradeInflationFactor = Math.pow(1 + UPGRADE_MONTHLY_RATE, months)

  const baseComponent = baseValue * baseInflationFactor * condition
  const upgradeComponent = upgradeSpend * UPGRADE_ROI * upgradeInflationFactor

  const total = baseComponent + upgradeComponent
  if (!isFinite(total) || total < 0) return 0
  return Math.round(total)
}

function getUpgradeTasksForProperty(upgrade: UpgradeDefinition, property: PropertyRow) {
  const baseTasks = upgrade.tasksRequiredTotal || 3
  const value = property.base_value ?? STARTER_HOME_BASE_VALUE

  let multiplier = 1
  if (value >= 100_000_000) {
    multiplier = 4
  } else if (value >= 10_000_000) {
    multiplier = 3.5
  } else if (value >= 1_000_000) {
    multiplier = 3
  } else if (value >= 250_000) {
    multiplier = 2.5
  } else if (value >= 50_000) {
    multiplier = 2
  } else if (value >= 5_000) {
    multiplier = 1.5
  }

  const tasks = Math.round(baseTasks * multiplier)
  return tasks < baseTasks ? baseTasks : tasks
}

const HOME_TIERS = [
  {
    id: 'tier_5k',
    name: 'Neighborhood Starter',
    price: 5000,
    description: 'A simple extra home to practice upgrades and tasks.',
    image: '/assets/properties/neighborhood_starter.png'
  },
  {
    id: 'tier_50k',
    name: 'Suburban Duplex',
    price: 50_000,
    description: 'Medium-tier property with more room for experiments.',
    image: '/assets/properties/suburban_duplex.png'
  },
  {
    id: 'tier_250k',
    name: 'Urban Loft',
    price: 250_000,
    description: 'Stylish loft in a busy part of Troll City.',
    image: '/assets/properties/urban_loft.png'
  },
  {
    id: 'tier_1m',
    name: 'City High-Rise',
    price: 1_000_000,
    description: 'Premium city property with room for serious projects.',
    image: '/assets/properties/city_high_rise.png'
  },
  {
    id: 'tier_10m',
    name: 'Luxury Penthouse',
    price: 10_000_000,
    description: 'High-tier Troll Town home with elite potential.',
    image: '/assets/properties/luxury_penthouse.png'
  },
  {
    id: 'tier_50m',
    name: 'Troll Mansion',
    price: 50_000_000,
    description: 'A luxurious mansion for the elite of Troll City.',
    image: '/assets/properties/troll_mansion.png'
  },
  {
    id: 'tier_100m',
    name: 'Mega Estate',
    price: 100_000_000,
    description: 'Ultra-rare estate for top Trolls with massive balances.',
    image: '/assets/properties/mega_estate.png'
  }
]

const getTierImageForValue = (value: number | null, isStarter: boolean | null) => {
  if (isStarter) return HOME_TIERS[0].image
  const val = value ?? 0
  const sorted = [...HOME_TIERS].sort((a, b) => a.price - b.price)
  let selected = sorted[0]
  for (const tier of sorted) {
    if (val >= tier.price) {
      selected = tier
    }
  }
  return selected.image
}

type HomeVisualTier = 'starter' | 'mid' | 'luxury' | 'apartment' | 'mansion' | 'mega'

const getHomeVisualTier = (value: number | null, isStarter: boolean | null): HomeVisualTier => {
  if (isStarter) return 'starter'
  const val = value || 0
  if (val >= 100_000_000) return 'mega'
  if (val >= 50_000_000) return 'mansion'
  if (val >= 10_000_000) return 'luxury'
  if (val >= 1_000_000) return 'apartment'
  if (val >= 250_000) return 'mid'
  return 'starter'
}

const HomeVisual: React.FC<{ value: number | null; isStarter: boolean | null }> = ({
  value,
  isStarter
}) => {
  const tier = getHomeVisualTier(value, isStarter)
  // See docs/UNREAL_ASSET_PIPELINE.md for instructions on creating the house_options.jpg collage from Unreal assets
  const collageUrl =
    import.meta.env.VITE_GEMINI_HOUSE_COLLAGE_URL || '/assets/house_options.png'

  // Map tiers to background positions on the collage
  // Assuming a grid layout in the source image
  const bgPosition = {
    starter: '0% 0%',
    mid: '33% 0%',
    apartment: '66% 0%',
    luxury: '100% 0%',
    mansion: '0% 50%',
    mega: '50% 50%'
  }[tier] || 'center'

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-lg shadow-slate-900/70 bg-slate-900">
      <div 
        className="w-full h-full transition-transform duration-500 hover:scale-105"
        style={{
          backgroundImage: `url('${collageUrl}')`,
          backgroundSize: '300% auto', // Zoom in to show just one house from the collage
          backgroundPosition: bgPosition,
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-1 left-0 right-0 h-2 bg-black/70 blur-sm" />
    </div>
  )
}

const TrollsTownPage: React.FC = () => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { troll_coins: trollCoins, refreshCoins } = useCoins()

  const [myProperty, setMyProperty] = useState<PropertyRow | null>(null)
  const [ownedProperties, setOwnedProperties] = useState<PropertyRow[]>([])
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null)
  const [myDeed, setMyDeed] = useState<DeedRow | null>(null)
  const [upgrades, setUpgrades] = useState<PropertyUpgradeRow[]>([])
  const [listings, setListings] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [listingPrice, setListingPrice] = useState<string>('')
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [startingUpgradeId, setStartingUpgradeId] = useState<string | null>(null)
  const [completingUpgradeId, setCompletingUpgradeId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  const effectiveBalance = useMemo(() => {
    const hookBalance = typeof trollCoins === 'number' ? trollCoins : 0
    const profileBalance = profile?.troll_coins ?? 0
    const maxBalance = Math.max(hookBalance, profileBalance)
    return Number.isFinite(maxBalance) && maxBalance > 0 ? maxBalance : 0
  }, [trollCoins, profile?.troll_coins])

  useEffect(() => {
    if (!user) return
    refreshCoins()
  }, [user, refreshCoins])

  const systemValue = useMemo(() => {
    if (!myProperty) return 0
    return computeSystemValue(myProperty)
  }, [myProperty])

  const maxAskPrice = useMemo(() => {
    return Math.round(systemValue * (1 + MAX_LISTING_PREMIUM))
  }, [systemValue])

  const loadPropertyDetails = useCallback(
    async (property: PropertyRow) => {
      setMyProperty(property)
      setActivePropertyId(property.id)

      const { data: deed, error: deedError } = await supabase
        .from('deeds')
        .select('*')
        .eq('property_id', property.id)
        .maybeSingle()

      if (!deedError && deed) {
        setMyDeed(deed as DeedRow)
      } else {
        setMyDeed(null)
      }

      const { data: upgradesData, error: upgradesError } = await supabase
        .from('property_upgrades')
        .select('*')
        .eq('property_id', property.id)
        .order('created_at', { ascending: true })

      if (!upgradesError && upgradesData) {
        setUpgrades(upgradesData as PropertyUpgradeRow[])
      } else {
        setUpgrades([])
      }
    },
    []
  )

  useEffect(() => {
    if (!user) return
    const loadData = async () => {
      setLoading(true)
      try {
        const { data: properties, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: true })

        if (propError && propError.code !== 'PGRST116' && propError.code !== 'PGRST106') {
          throw propError
        }

        if (properties && properties.length > 0) {
          const rows = properties as PropertyRow[]
          setOwnedProperties(rows)
          const starter = rows.find(p => p.is_starter)
          const selected = starter || rows[0]
          await loadPropertyDetails(selected)
        } else {
          setOwnedProperties([])
          setMyProperty(null)
          setMyDeed(null)
          setUpgrades([])
        }

        const { data: listingRows, error: listingsError } = await supabase
          .from('properties')
          .select('*')
          .eq('is_listed', true)
          .neq('owner_user_id', user.id)
          .order('created_at', { ascending: false })

        if (!listingsError && listingRows) {
          setListings(listingRows as PropertyRow[])
        } else {
          setListings([])
        }
      } catch (error) {
        console.error('Failed to load Troll Town data', error)
        toast.error('Failed to load Troll Town data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, loadPropertyDetails])

  const handleClaimStarterHome = async () => {
    if (!user || !profile) {
      navigate('/auth')
      return
    }
    if (myProperty) {
      toast.error('You already have your starter home')
      return
    }

    setClaiming(true)
    try {
      const { data: newProperty, error: createError } = await supabase
        .from('properties')
        .insert({
          owner_user_id: user.id,
          base_value: STARTER_HOME_BASE_VALUE,
          condition_factor: 1,
          upgrade_spend_total: 0,
          is_listed: false,
          ask_price: null,
          is_starter: true
        })
        .select('*')
        .single()

      if (createError) {
        throw createError
      }

      setMyProperty(newProperty as PropertyRow)

      const { data: deed, error: deedError } = await supabase
        .from('deeds')
        .insert({
          property_id: newProperty.id,
          current_owner_user_id: user.id
        })
        .select('*')
        .single()

      if (!deedError && deed) {
        setMyDeed(deed as DeedRow)
      }

      const updatedOwned = [...ownedProperties, newProperty as PropertyRow]
      setOwnedProperties(updatedOwned)
      await loadPropertyDetails(newProperty as PropertyRow)
      toast.success('Starter home claimed')
    } catch (error: any) {
      console.error('Failed to claim starter home', error)
      toast.error(error?.message || 'Failed to claim starter home')
    } finally {
      setClaiming(false)
    }
  }

  const handleListingPriceChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '')
    setListingPrice(cleaned)
  }

  const handleListForSale = async () => {
    if (!user || !profile || !myProperty) return
    const raw = listingPrice.trim()
    if (!raw) {
      toast.error('Enter an asking price')
      return
    }
    const ask = Number(raw)
    if (!Number.isFinite(ask) || ask <= 0) {
      toast.error('Invalid asking price')
      return
    }

    const max = maxAskPrice
    if (ask > max) {
      toast.error(`Max allowed listing price is ${max.toLocaleString()} TrollCoins`)
      return
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          is_listed: true,
          ask_price: ask
        })
        .eq('id', myProperty.id)
        .eq('owner_user_id', user.id)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      setMyProperty(data as PropertyRow)
      toast.success('Home listed for sale')
    } catch (error: any) {
      console.error('Failed to list home', error)
      toast.error(error?.message || 'Failed to list home')
    }
  }

  const handleCancelListing = async () => {
    if (!user || !myProperty) return
    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          is_listed: false,
          ask_price: null
        })
        .eq('id', myProperty.id)
        .eq('owner_user_id', user.id)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      setMyProperty(data as PropertyRow)
      toast.success('Listing cancelled')
    } catch (error: any) {
      console.error('Failed to cancel listing', error)
      toast.error(error?.message || 'Failed to cancel listing')
    }
  }

  const loadListings = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_listed', true)
        .neq('owner_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setListings((data || []) as PropertyRow[])
    } catch (error) {
      console.error('Failed to refresh listings', error)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('troll-town-listings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          loadListings()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user, loadListings])

  useEffect(() => {
    if (!user) return

    const loadTransactions = async () => {
      setLoadingTransactions(true)
      try {
        const { data, error } = await supabase
          .from('coin_transactions')
          .select('id, created_at, amount, type, description, metadata, balance_after')
          .eq('user_id', user.id)
          .in('type', ['troll_town_purchase', 'troll_town_sale', 'troll_town_upgrade'])
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data) {
          setTransactions(data as any[])
        }
      } catch (error) {
        console.error('Failed to load Troll Town transactions', error)
      } finally {
        setLoadingTransactions(false)
      }
    }

    loadTransactions()

    const txChannel = supabase
      .channel('troll-town-transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coin_transactions',
          filter: `user_id=eq.${user.id}`
        },
        payload => {
          const row = payload.new as any
          if (!['troll_town_purchase', 'troll_town_sale', 'troll_town_upgrade'].includes(row.type)) {
            return
          }
          setTransactions(prev => [row, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => {
      txChannel.unsubscribe()
    }
  }, [user])

  const handleSelectProperty = async (property: PropertyRow) => {
    if (!user) return
    setLoading(true)
    try {
      await loadPropertyDetails(property)
    } finally {
      setLoading(false)
    }
  }

  const handleBuyTieredHome = async (tierId: string) => {
    if (!user || !profile) {
      navigate('/auth')
      return
    }

    const tier = HOME_TIERS.find(t => t.id === tierId)
    if (!tier) return

    const balance = effectiveBalance
    if (balance < tier.price) {
      toast.error('Not enough TrollCoins for this home')
      return
    }

    try {
      // 1. Deduct coins first using the secure RPC wrapper
      const result = await deductCoins({
        userId: user.id,
        amount: tier.price,
        type: 'troll_town_purchase',
        coinType: 'troll_coins',
        description: 'Troll Town system home purchase',
        metadata: {
          tier_id: tier.id,
          tier_name: tier.name
        }
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase home')
        return
      }

      // 2. Create the property
      const { data: newProperty, error: createError } = await supabase
        .from('properties')
        .insert({
          owner_user_id: user.id,
          base_value: tier.price,
          condition_factor: 1,
          upgrade_spend_total: 0,
          is_listed: false,
          ask_price: null,
          is_starter: false
        })
        .select('*')
        .single()

      if (newProperty) {
        try {
          localStorage.setItem(`trollcity_home_owned_${user.id}`, 'true')
        } catch {}
      }

      if (createError) {
        // Critical: Failed to create property after deduction.
        console.error('CRITICAL: Property creation failed after deduction', createError)
        toast.error('Error creating property. Please contact support.')
        throw createError
      }

      // 3. Create deed
      const { data: deed, error: deedError } = await supabase
        .from('deeds')
        .insert({
          property_id: newProperty.id,
          current_owner_user_id: user.id
        })
        .select('*')
        .single()

      if (deedError) {
        console.error('Failed to create deed', deedError)
      } else {
        if (result.transaction && result.transaction.id) {
           await supabase
             .from('coin_transactions')
             .update({
               metadata: {
                 ...result.transaction.metadata,
                 property_id: newProperty.id,
                 deed_id: deed.id
               }
             })
             .eq('id', result.transaction.id)
        }
      }

      if (result.transaction) {
        setTransactions(prev => [result.transaction, ...prev].slice(0, 20))
      }

      const updatedOwned = [...ownedProperties, newProperty as PropertyRow]
      setOwnedProperties(updatedOwned)
      await loadPropertyDetails(newProperty as PropertyRow)
      await refreshCoins()

      toast.success('New home purchased')
    } catch (error: any) {
      console.error('Failed to purchase tiered home', error)
      toast.error(error?.message || 'Failed to purchase home')
    }
  }

  const handleBuyProperty = async (property: PropertyRow) => {
    if (!user || !profile) {
      navigate('/auth')
      return
    }
    if (!property.ask_price || !property.is_listed) {
      toast.error('Property is not available')
      return
    }
    if (property.owner_user_id === user.id) {
      toast.error('You already own this property')
      return
    }

    const currentBalance = effectiveBalance
    const ask = property.ask_price
    if (currentBalance < ask) {
      toast.error('Not enough TrollCoins to purchase this home')
      return
    }

    const systemVal = computeSystemValue(property)
    const maxAllowed = Math.round(systemVal * (1 + MAX_LISTING_PREMIUM))
    if (ask > maxAllowed) {
      toast.error('This listing exceeds the allowed price and cannot be purchased')
      return
    }

    const deedFee = Math.round(ask * 0.1)
    const sellerNet = ask - deedFee

    setBuyingId(property.id)
    try {
      // 1. Process payment via spend_coins RPC (handles deduction and transfer)
      // Step 1: Deduct full amount from buyer
      const deductResult = await deductCoins({
        userId: user.id,
        amount: ask,
        type: 'troll_town_purchase',
        coinType: 'troll_coins',
        description: 'Troll Town home purchase',
        metadata: {
          property_id: property.id,
          seller_id: property.owner_user_id,
          ask_price: ask
        }
      })

      if (!deductResult.success) {
        toast.error(deductResult.error || 'Payment failed')
        return
      }

      // Step 2: Add net amount to seller
      const { error: addError } = await supabase.rpc('add_troll_coins', {
        user_id_input: property.owner_user_id,
        coins_to_add: sellerNet
      })

      if (addError) {
        console.error('Failed to pay seller', addError)
        // Critical error: Buyer paid, seller didn't get paid.
      } else {
        // Log seller transaction
        await recordCoinTransaction({
            userId: property.owner_user_id,
            amount: sellerNet,
            type: 'troll_town_sale',
            coinType: 'troll_coins',
            description: 'Troll Town home sale',
            metadata: {
                property_id: property.id,
                buyer_id: user.id,
                ask_price: ask,
                deed_fee: deedFee
            }
        })
      }

      // Step 3: Add fee to admin pool
      const { data: poolRow } = await supabase
        .from('admin_pool')
        .select('id, trollcoins_balance')
        .maybeSingle()
      
      if (poolRow) {
         await supabase
            .from('admin_pool')
            .update({ trollcoins_balance: (poolRow.trollcoins_balance || 0) + deedFee })
            .eq('id', poolRow.id)
      } else {
         await supabase
            .from('admin_pool')
            .insert({ trollcoins_balance: deedFee })
      }

      // Step 4: Transfer Property & Deed
      await supabase
        .from('properties')
        .update({
          owner_user_id: user.id,
          is_listed: false,
          ask_price: null,
          is_starter: false
        })
        .eq('id', property.id)

      const { data: existingDeed } = await supabase
        .from('deeds')
        .select('*')
        .eq('property_id', property.id)
        .maybeSingle()

      let deedId = existingDeed?.id
      if (!deedId) {
        const { data: newDeed } = await supabase
          .from('deeds')
          .insert({
            property_id: property.id,
            current_owner_user_id: user.id
          })
          .select()
          .single()
        deedId = newDeed?.id
      } else {
        await supabase
          .from('deeds')
          .update({ current_owner_user_id: user.id })
          .eq('id', deedId)
      }

      // Step 5: Record Deed Transfer
      await supabase
        .from('deed_transfers')
        .insert({
            deed_id: deedId,
            property_id: property.id,
            seller_user_id: property.owner_user_id,
            buyer_user_id: user.id,
            sale_price: ask,
            deed_fee: deedFee,
            seller_net: sellerNet,
            system_value_at_sale: systemVal
        })

      if (deductResult.transaction) {
        setTransactions(prev => [deductResult.transaction, ...prev].slice(0, 20))
      }

      await refreshCoins()
      await loadListings()

      if (myProperty && myProperty.id === property.id) {
        setMyProperty({
          ...myProperty,
          owner_user_id: user.id,
          is_listed: false,
          ask_price: null,
          is_starter: false
        })
      } else {
        if (property.owner_user_id === user.id) {
          setMyProperty({
            ...property,
            owner_user_id: user.id,
            is_listed: false,
            ask_price: null,
            is_starter: false
          })
        }
      }

      toast.success('Home purchased successfully')
    } catch (error: any) {
      console.error('Failed to purchase property', error)
      toast.error(error?.message || 'Failed to purchase property')
    } finally {
      setBuyingId(null)
    }
  }

  const handleStartUpgrade = async (upgrade: UpgradeDefinition) => {
    if (!user || !profile || !myProperty) return
    const balance = effectiveBalance
    if (balance < upgrade.cost) {
      toast.error('Not enough TrollCoins for this upgrade')
      return
    }

    const existing = upgrades.find(u => u.upgrade_type === upgrade.id && u.status === 'installed')
    if (existing) {
      toast.error('You already installed this upgrade')
      return
    }

    setStartingUpgradeId(upgrade.id)
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: upgrade.cost,
        type: 'troll_town_upgrade',
        coinType: 'troll_coins',
        description: 'Troll Town home upgrade',
        metadata: {
          property_id: myProperty.id,
          upgrade_id: upgrade.id,
          upgrade_name: upgrade.name
        }
      })

      if (!result.success) {
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.error('Failed to start upgrade')
        }
        return
      }

      if (result.transaction) {
        setTransactions(prev => [result.transaction, ...prev].slice(0, 20))
      }

      const tasksTotal = getUpgradeTasksForProperty(upgrade, myProperty)

      const { data: inserted, error: insertError } = await supabase
        .from('property_upgrades')
        .insert({
          property_id: myProperty.id,
          upgrade_type: upgrade.id,
          cost: upgrade.cost,
          status: 'pending',
          tasks_required_total: tasksTotal,
          tasks_completed: 0
        })
        .select('*')
        .single()

      if (insertError) {
        throw insertError
      }

      setUpgrades([...upgrades, inserted as PropertyUpgradeRow])
      await refreshCoins()
      toast.success('Upgrade started. Complete tasks to install it.')
    } catch (error: any) {
      console.error('Failed to start upgrade', error)
      toast.error(error?.message || 'Failed to start upgrade')
    } finally {
      setStartingUpgradeId(null)
    }
  }

  const handleCompleteUpgradeTask = async (upgradeRow: PropertyUpgradeRow) => {
    if (!myProperty) return
    if (upgradeRow.status === 'installed') return

    const def = UPGRADE_CATALOG.find(u => u.id === upgradeRow.upgrade_type)
    if (!def) return

    const nextCompleted = Math.min(
      upgradeRow.tasks_required_total,
      upgradeRow.tasks_completed + 1
    )
    const willInstall = nextCompleted >= upgradeRow.tasks_required_total

    setCompletingUpgradeId(upgradeRow.id)
    try {
      const { data: updatedUpgrade, error: updateError } = await supabase
        .from('property_upgrades')
        .update({
          tasks_completed: nextCompleted,
          status: willInstall ? 'installed' : 'pending'
        })
        .eq('id', upgradeRow.id)
        .select('*')
        .single()

      if (updateError) {
        throw updateError
      }

      let newProperty = myProperty

      if (willInstall) {
        const newSpend = (myProperty.upgrade_spend_total || 0) + upgradeRow.cost
        const newCondition = clamp(
          (myProperty.condition_factor || 1) + def.conditionImpact,
          MIN_CONDITION,
          MAX_CONDITION
        )

        const { data: propData, error: propError } = await supabase
          .from('properties')
          .update({
            upgrade_spend_total: newSpend,
            condition_factor: newCondition
          })
          .eq('id', myProperty.id)
          .select('*')
          .single()

        if (propError) {
          throw propError
        }

        newProperty = propData as PropertyRow
        setMyProperty(newProperty)
      }

      setUpgrades(prev =>
        prev.map(u => (u.id === upgradeRow.id ? (updatedUpgrade as PropertyUpgradeRow) : u))
      )

      if (willInstall) {
        toast.success('Upgrade installed and home condition improved')
      } else {
        toast.success('Upgrade task completed')
      }
    } catch (error: any) {
      console.error('Failed to complete upgrade task', error)
      toast.error(error?.message || 'Failed to complete upgrade task')
    } finally {
      setCompletingUpgradeId(null)
    }
  }

  const availableUpgrades = useMemo(() => {
    const installedTypes = new Set(
      upgrades
        .filter(u => u.status === 'installed')
        .map(u => u.upgrade_type)
    )
    return UPGRADE_CATALOG
      .filter(up => !installedTypes.has(up.id))
  }, [upgrades])

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="bg-black/40 border border-purple-500/40 rounded-xl p-8 text-center max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-3">Troll Town</h1>
          <p className="text-gray-300 mb-4">
            You need to be logged in to manage your home in Troll Town.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-emerald-500 flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Troll Town</h1>
              <p className="text-sm text-gray-400">
                Every citizen gets one free starter home. Upgrade, maintain, and trade fairly.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs uppercase tracking-widest text-gray-400">TrollCoins</span>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-lg font-semibold text-yellow-300">
                {formatCompactNumber(effectiveBalance)}
              </span>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-black/40 border border-emerald-500/40 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Marketplace</h2>
                <p className="text-xs text-gray-400">
                  Spend TrollCoins to add more homes to your portfolio.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HOME_TIERS.map(tier => {
                const canAfford = effectiveBalance >= tier.price
                return (
                  <div
                    key={tier.id}
                    className="border border-white/10 rounded-xl p-4 bg-black/30 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="w-full aspect-[4/5] rounded-lg overflow-hidden border border-white/10">
                        <img
                          src={tier.image}
                          alt={tier.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{tier.name}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{tier.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">
                          Price
                        </p>
                        <p className="text-lg font-semibold text-yellow-300">
                          {formatCompactNumber(tier.price)} TC
                        </p>
                      </div>
                      <button
                        disabled={!canAfford}
                        onClick={() => handleBuyTieredHome(tier.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold disabled:opacity-50"
                      >
                        {canAfford ? 'Buy Home' : 'Not enough TC'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

            <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-24">
                    <HomeVisual
                      value={myProperty?.base_value ?? null}
                      isStarter={myProperty?.is_starter ?? null}
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">My Home</h2>
                    <p className="text-xs text-gray-400">
                      One free starter home per user. No gambling, only effort.
                    </p>
                  </div>
                </div>
              </div>

              {ownedProperties.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-2">
                    Your Homes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ownedProperties.map(p => {
                      const isActive = p.id === activePropertyId
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProperty(p)}
                          className={`px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 ${
                            isActive
                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                              : 'border-white/10 bg-black/40 text-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          <div className="w-16">
                            <HomeVisual value={p.base_value} isStarter={p.is_starter} />
                          </div>
                          <span>
                            Home {p.id.slice(0, 6).toUpperCase()}
                            {p.is_starter ? ' • Starter' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* My Deed Section */}
                  {myDeed && (
                    <div className="mt-4 p-4 border border-yellow-500/30 bg-yellow-900/10 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                         <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest">
                           Property Deed
                         </h3>
                         <div className="text-[10px] text-yellow-600/70 font-mono">
                           ID: {myDeed.id.slice(0, 8)}...
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-yellow-200/80">
                         <div>
                           <p className="text-yellow-600 uppercase text-[10px]">Owner</p>
                           <p className="font-medium truncate">{profile?.username || 'You'}</p>
                         </div>
                         <div>
                           <p className="text-yellow-600 uppercase text-[10px]">Issued</p>
                           <p className="font-medium">{new Date(myDeed.created_at).toLocaleDateString()}</p>
                         </div>
                         <div className="col-span-2">
                           <p className="text-yellow-600 uppercase text-[10px]">Property ID</p>
                           <p className="font-mono text-[10px]">{myDeed.property_id}</p>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="py-10 text-center text-gray-400 text-sm">
                  Loading your home...
                </div>
              ) : !myProperty ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <p className="text-gray-300 text-sm text-center max-w-md">
                    You do not have a starter home yet. Claim one free home
                    to enter Troll Town&apos;s housing market.
                  </p>
                  <button
                    disabled={claiming}
                    onClick={handleClaimStarterHome}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-700 hover:to-emerald-600 font-semibold disabled:opacity-60"
                  >
                    {claiming ? 'Claiming...' : 'Claim Free Starter Home'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs uppercase tracking-widest text-gray-400">
                          System Value
                        </span>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-bold text-emerald-300">
                        {formatCompactNumber(systemValue)}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Auto-calculated from base value, condition, upgrades, and inflation.
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs uppercase tracking-widest text-gray-400">
                          Condition
                        </span>
                        <Hammer className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-blue-300">
                        {Math.round(clamp(myProperty.condition_factor ?? 1, MIN_CONDITION, MAX_CONDITION) * 100)}%
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Keep this from decaying by installing upgrades and doing maintenance tasks.
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs uppercase tracking-widest text-gray-400">
                          Upgrades Spend
                        </span>
                        <ShoppingBag className="w-4 h-4 text-pink-400" />
                      </div>
                      <div className="text-2xl font-bold text-pink-300">
                        {formatCompactNumber(myProperty.upgrade_spend_total || 0)}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Only a portion of this is reflected in value to keep realism.
                      </p>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    {myProperty.is_listed && myProperty.ask_price ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">
                            Listed For Sale
                          </p>
                          <div className="text-lg font-semibold text-yellow-300">
                            {formatCompactNumber(myProperty.ask_price)} TrollCoins
                          </div>
                          <p className="text-[11px] text-gray-500">
                            System Max Allowed: {formatCompactNumber(maxAskPrice)} TrollCoins
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleCancelListing}
                            className="px-4 py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 text-sm font-semibold"
                          >
                            Cancel Listing
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">
                            List Starter Home
                          </p>
                          <p className="text-[11px] text-gray-500">
                            You set the Ask Price, system enforces the cap.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                              TC
                            </span>
                            <input
                              value={listingPrice}
                              onChange={e => handleListingPriceChange(e.target.value)}
                              placeholder={systemValue.toString()}
                              className="pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm outline-none focus:border-purple-500 min-w-[140px]"
                              inputMode="numeric"
                            />
                          </div>
                          <button
                            onClick={handleListForSale}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-semibold"
                          >
                            List Home
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-500 md:text-right">
                            Max allowed listing price: {formatCompactNumber(maxAskPrice)} TrollCoins
                          </div>
                      </>
                    )}
                  </div>

                  <div className="border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Upgrades & Tasks</h3>
                        <p className="text-xs text-gray-500">
                          Pay coins to start upgrades, complete tasks to activate them.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">
                          Available Upgrades
                        </p>
                        {availableUpgrades.length === 0 && (
                          <p className="text-xs text-gray-500">
                            You have installed all available upgrades for now.
                          </p>
                        )}
                        {availableUpgrades.map(up => (
                          <div
                            key={up.id}
                            className="border border-white/10 rounded-lg p-3 flex flex-col gap-2 bg-black/30"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{up.name}</p>
                                <p className="text-[11px] text-gray-500">{up.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">{up.category}</p>
                                <p className="text-sm font-semibold text-yellow-300">
                                  {formatCompactNumber(up.cost)} TC
                                </p>
                              </div>
                            </div>
                            <button
                              disabled={startingUpgradeId === up.id}
                              onClick={() => handleStartUpgrade(up)}
                              className="mt-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold disabled:opacity-60"
                            >
                              {startingUpgradeId === up.id ? 'Processing...' : 'Start Upgrade'}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">
                          Active Tasks
                        </p>
                    {upgrades.length === 0 && (
                          <p className="text-xs text-gray-500">
                            No upgrades in progress yet. Start one to see tasks here.
                          </p>
                        )}
                        {upgrades.map(up => {
                          const def = UPGRADE_CATALOG.find(d => d.id === up.upgrade_type)
                          const progress =
                            up.tasks_required_total > 0
                              ? Math.round(
                                  (up.tasks_completed / up.tasks_required_total) * 100
                                )
                              : 0
                          return (
                            <div
                              key={up.id}
                              className="border border-white/10 rounded-lg p-3 bg-black/30 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold">
                                    {def?.name || up.upgrade_type}
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    {up.status === 'installed'
                                      ? 'Installed'
                                      : 'Pending installation'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">
                                    {up.tasks_completed}/{up.tasks_required_total} tasks
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    Cost {up.cost.toLocaleString()} TC
                                  </p>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    up.status === 'installed'
                                      ? 'bg-emerald-400'
                                      : 'bg-purple-400'
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              {up.status === 'pending' && (
                                <button
                                  disabled={completingUpgradeId === up.id}
                                  onClick={() => handleCompleteUpgradeTask(up)}
                                  className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                                >
                                  {completingUpgradeId === up.id
                                    ? 'Completing task...'
                                    : 'Complete Task'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-black/40 border border-emerald-500/40 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Market Listings</h2>
                  <p className="text-xs text-gray-500">
                    Buy homes from other users, with system-controlled pricing caps.
                  </p>
                </div>
                <button
                  onClick={loadListings}
                  className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
                >
                  Refresh
                </button>
              </div>
              {listings.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No homes are listed for sale right now. Check back soon.
                </p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {listings.map(row => {
                    const value = computeSystemValue(row)
                    const cap = Math.round(value * (1 + MAX_LISTING_PREMIUM))
                    return (
                      <div
                        key={row.id}
                        className="border border-white/10 rounded-lg p-3 bg-black/30 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-24 rounded-lg overflow-hidden border border-white/10">
                              <img
                                src={getTierImageForValue(row.base_value, row.is_starter)}
                                alt="Property"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                Home {row.id.slice(0, 6).toUpperCase()}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                Starter: {row.is_starter ? 'Yes' : 'No'} • Created{' '}
                                {new Date(row.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Ask Price</p>
                            <p className="text-sm font-semibold text-yellow-300">
                              {(row.ask_price || 0).toLocaleString()} TC
                            </p>
                            <p className="text-[10px] text-gray-500">
                              System cap {cap.toLocaleString()} TC
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-400">System Value</p>
                            <p className="text-sm font-semibold text-emerald-300">
                              {value.toLocaleString()} TC
                            </p>
                          </div>
                          <button
                            disabled={buyingId === row.id}
                            onClick={() => handleBuyProperty(row)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold disabled:opacity-60"
                          >
                            {buyingId === row.id ? 'Processing...' : 'Buy Home'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-xs text-gray-400 space-y-2">
              <h3 className="text-sm font-semibold text-white">Non-Gambling Rules</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>No randomness or chance-based payouts in Troll Town.</li>
                <li>Home value is calculated from fixed formulas and your upgrade spend.</li>
                <li>Starter homes slowly fall behind inflation if you never upgrade.</li>
                <li>Listings are capped to 15% above system value to prevent abuse.</li>
                <li>10% of each sale is collected into the Admin Pool as a deed fee.</li>
              </ul>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-xs text-gray-300 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Troll Town Transactions</h3>
                </div>
              </div>
              {loadingTransactions ? (
                <div className="text-gray-500 text-xs">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-gray-500 text-xs">
                  No recent Troll Town coin activity yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {transactions.map(tx => {
                    const isDebit = tx.amount < 0
                    const label =
                      tx.type === 'troll_town_purchase'
                        ? 'Home purchase'
                        : tx.type === 'troll_town_sale'
                        ? 'Home sale'
                        : 'Upgrade'
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between border border-white/5 rounded-lg px-2 py-1.5 bg-black/40"
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-white">
                            {label}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-[11px] font-semibold ${
                              isDebit ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {isDebit ? '-' : '+'}
                            {Math.abs(tx.amount).toLocaleString()} TC
                          </div>
                          {typeof tx.balance_after === 'number' && (
                            <div className="text-[10px] text-gray-500">
                              Balance: {tx.balance_after.toLocaleString()} TC
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrollsTownPage
