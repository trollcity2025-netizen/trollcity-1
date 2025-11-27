import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, CoinPackage } from '../lib/supabase'
import { addXp, recordAppEvent } from '../lib/progressionEngine'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import TrollerInsurance from './TrollerInsurance'
import { deductCoins } from '../lib/coinTransactions'

type EntranceEffect = {
  id: string
  name: string
  coin_cost: number
  icon: string
  rarity: 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Exclusive'
}

type Perk = {
  id: string
  name: string
  cost: number
  desc: string
}

type PaymentMethod = {
  id: string
  user_id: string
  provider: string
  brand: string | null
  last4: string | null
  is_default: boolean
  created_at: string
}

const DEFAULT_PACKAGES: CoinPackage[] = [
  {
    id: 'cc532723-f51f-4e5a-b547-160a0e6609b8',
    name: 'Baby Troll',
    coin_amount: 500,
    price: 6.49,
    currency: 'USD',
    description: 'Starter pack',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '908575d4-a0fa-44f7-a116-27be6981b517',
    name: 'Little Troller',
    coin_amount: 1440,
    price: 12.99,
    currency: 'USD',
    description: 'Small bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '8aaad4d3-97a1-46db-ba60-5cef0c67ee6c',
    name: 'Mischief Pack',
    coin_amount: 3200,
    price: 24.99,
    currency: 'USD',
    description: 'Medium bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '13989073-66de-4b19-be37-5d2276d052f2',
    name: 'Chaos Chest',
    coin_amount: 7000,
    price: 49.99,
    currency: 'USD',
    description: 'Large bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '034c0101-b4e3-41fc-94d5-bb1203433df1',
    name: 'Royal Troll',
    coin_amount: 15700,
    price: 99.99,
    currency: 'USD',
    description: 'Mega bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '88f208b1-013e-416a-aeac-98964eba5fdb',
    name: 'Troll Emperor Pack',
    coin_amount: 50000,
    price: 299.00,
    currency: 'USD',
    description: 'Ultra bundle',
    is_active: true,
    created_at: new Date().toISOString()
  }
]

const DEFAULT_EFFECTS: EntranceEffect[] = [
  { id: 'effect1', name: '🔥 Flame Burst', coin_cost: 500, icon: '🔥', rarity: 'Rare' },
  { id: 'effect2', name: '💸 Money Shower', coin_cost: 1500, icon: '💸', rarity: 'Epic' },
  { id: 'effect3', name: '⚡ Electric Flash', coin_cost: 2800, icon: '⚡', rarity: 'Epic' },
  { id: 'effect4', name: '👑 Royal Throne', coin_cost: 5200, icon: '👑', rarity: 'Legendary' },
  { id: 'effect5', name: '🌈 Rainbow Descent', coin_cost: 8500, icon: '🌈', rarity: 'Legendary' },
  { id: 'effect6', name: '🚗 Troll Roll-Up', coin_cost: 12000, icon: '🚗', rarity: 'Mythic' },
  { id: 'effect7', name: '🚨 VIP Siren Rush', coin_cost: 25000, icon: '🚨', rarity: 'Mythic' },
  { id: 'effect8', name: '🎆 Firework Explosion', coin_cost: 50000, icon: '🎆', rarity: 'Mythic' },
  { id: 'effect9', name: '🧌 Troll King Arrival', coin_cost: 100000, icon: '🧌', rarity: 'Exclusive' }
]

const PERKS: Perk[] = [
  {
    id: 'perk_disappear_chat',
    name: 'Disappearing Chats (30m)',
    cost: 500,
    desc: 'Your chats, messages auto-hide after 10s for 30 minutes'
  },
  {
    id: 'perk_ghost_mode',
    name: 'Ghost Mode (30m)',
    cost: 1200,
    desc: 'View streams in stealth without status indicators'
  },
  {
    id: 'perk_message_admin',
    name: 'Message Admin (Officer Only)',
    cost: 250,
    desc: 'Unlock DM to Admin'
  },
  {
    id: 'perk_global_highlight',
    name: 'Glowing Username (1h)',
    cost: 8000,
    desc: 'Your username glows neon in all chats & gift animations'
  },
  {
    id: 'perk_slowmo_chat',
    name: 'Slow-Motion Chat Control (5hrs)',
    cost: 15000,
    desc: 'Activate chat slow-mode in any live stream you are watching'
  },
  {
    id: 'perk_troll_alarm',
    name: 'Troll Alarm Arrival (100hrs)',
    cost: 2000,
    desc: 'When you enter any stream, a sound + flash announces your arrival'
  },
  {
    id: 'perk_ban_shield',
    name: 'Ban Shield (2hrs)',
    cost: 1700,
    desc: 'Immunity from kick, mute, or ban actions for 2 hours'
  },
  {
    id: 'perk_double_xp',
    name: 'Double XP Mode (1h)',
    cost: 1300,
    desc: 'Earn 2x XP from streaming, gifting, and app actions for the next hour'
  },
  {
    id: 'perk_flex_banner',
    name: 'Golden Flex Banner (100h)',
    cost: 3500,
    desc: 'A golden animated crown banner appears on all your chat messages'
  },
  {
    id: 'perk_troll_spell',
    name: 'Troll Spell (1h)',
    cost: 2800,
    desc: 'Randomly changes another user’s username style & emoji for 100 hour'
  }
]

export default function CoinStore() {
  const { user, profile, setProfile } = useAuthStore()
  const navigate = useNavigate()

  const [packages] = useState<CoinPackage[]>(DEFAULT_PACKAGES)
  const [effects] = useState<EntranceEffect[]>(DEFAULT_EFFECTS)
  const [activeTab, setActiveTab] = useState<'packages' | 'effects' | 'free' | 'perks' | 'insurance'>('packages')

  const venmoEnabled = false
  const isFriday = new Date().getDay() === 5

  const [defaultMethod, setDefaultMethod] = useState<PaymentMethod | null>(null)

  // Load default payment method
  useEffect(() => {
    const loadDefault = async () => {
      // You already have user + profile in store; prefer user.id
      const uid =
        useAuthStore.getState().user?.id || useAuthStore.getState().profile?.id

      if (!uid) return

      // First try to get the default payment method
      let { data, error } = await supabase
        .from('user_payment_methods')
        .select('id, user_id, provider, brand, last4, is_default, created_at')
        .eq('user_id', uid)
        .eq('is_default', true)
        .maybeSingle()

      // If no default is set, fall back to the most recent
      if (!data && !error) {
        const fallback = await supabase
          .from('user_payment_methods')
          .select('id, user_id, provider, brand, last4, is_default, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('Failed to load default payment method', error)
        return
      }

      setDefaultMethod((data as PaymentMethod) || null)
    }

    // Reload when component mounts or user changes
    loadDefault()
    
    // Also listen for real-time updates
    const uid = useAuthStore.getState().user?.id
    if (uid) {
      const channel = supabase
        .channel(`payment_methods_${uid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_payment_methods',
          filter: `user_id=eq.${uid}`
        }, () => {
          loadDefault()
        })
        .subscribe()
      
      return () => {
        void supabase.removeChannel(channel)
      }
    }
  }, [user?.id, profile?.id])

  // Start purchase using saved payment method
  const startPurchase = async (pkg: CoinPackage) => {
    if (!user) {
      toast.error('Login required')
      return
    }

    if (!defaultMethod) {
      toast.error('You must add a payment method in Profile Settings.')
      return
    }
    
    // Validate the saved payment method
    if (defaultMethod.last4 && defaultMethod.last4.startsWith('test')) {
      toast.error('Test cards cannot be used for real purchases. Please add a valid card.')
      return
    }

    console.log('Starting purchase with saved card:', {
      brand: defaultMethod.brand,
      last4: defaultMethod.last4,
      packageId: pkg.id,
      packageName: pkg.name,
      price: pkg.price
    })

    try {
      const res = await fetch('/api/payments/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          packageId: pkg.id
          // Backend will use the user's default saved card
        })
      })

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        const errorMsg = (data as any)?.details ||
          (data as any)?.error ||
          (res.status === 503 ? 'Server is temporarily unavailable. Please try again.' : 'Payment failed')
        console.error('Purchase failed:', { status: res.status, error: errorMsg, data })
        toast.error(errorMsg)
        return
      }
      
      console.log('Purchase successful:', data)

      // Refresh user profile coin balances
      try {
        const { data: refreshed } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (refreshed) {
          setProfile(refreshed as any)
        }
      } catch (err) {
        console.error('Failed to refresh profile after purchase', err)
      }

      toast.success('Coins added to your balance')

      try {
        const xpAmount = Math.max(1, Math.floor(pkg.coin_amount / 100))
        await addXp(user.id, xpAmount, 'purchase')
        await recordAppEvent(user.id, 'HIGH_SPENDER_EVENT', {
          coins: xpAmount,
          packageId: pkg.id,
          price: pkg.price
        })
      } catch (err) {
        console.error('XP tracking failed', err)
      }
    } catch (e: any) {
      console.error('Purchase error', e)
      toast.error(e?.message || 'Purchase failed')
    }
  }

  const buyPerk = async (perkId: string) => {
    if (!profile) {
      toast.error('Login required')
      return
    }

    const perk = PERKS.find(p => p.id === perkId)
    if (!perk) return

    const currentPaid = profile.paid_coin_balance || 0

    if (currentPaid < perk.cost) {
      toast.error('Not enough Coins')
      return
    }

    if (
      perkId === 'perk_message_admin' &&
      profile.role !== 'troll_officer' &&
      profile.role !== 'admin'
    ) {
      toast.error('Only Troll Officers can buy Message Admin')
      return
    }

    try {
      // Deduct coins using centralized transaction logging
      const result = await deductCoins({
        userId: profile.id,
        amount: perk.cost,
        type: 'perk_purchase',
        coinType: 'paid',
        description: `Purchased ${perk.name}`,
        metadata: {
          perk_id: perkId,
          perk_name: perk.name,
          duration: 30,
          cost: perk.cost
        }
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase perk')
        return
      }

      // Calculate expiry time
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 30)

      // Save to user_perks table
      const { error: perkError } = await supabase
        .from('user_perks')
        .insert({
          user_id: profile.id,
          perk_id: perkId,
          purchased_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
          metadata: {
            perk_name: perk.name,
            cost: perk.cost,
            description: perk.desc
          }
        })

      if (perkError) {
        console.error('Failed to save perk record:', perkError)
      }

      // Update local state
      useAuthStore
        .getState()
        .setProfile({ ...profile, paid_coin_balance: result.newBalance } as any)

      // Set localStorage for backwards compatibility
      try {
        const effectsUntil = expiresAt.getTime()
        if (perkId === 'perk_ghost_mode') {
          localStorage.setItem(`tc-ghost-mode-${profile.id}`, String(effectsUntil))
        }
        if (perkId === 'perk_disappear_chat') {
          localStorage.setItem(`tc-disappear-chat-${profile.id}`, String(effectsUntil))
        }
        if (perkId === 'perk_message_admin') {
          localStorage.setItem(`tc-message-admin-${profile.id}`, String(effectsUntil))
        }
      } catch (err) {
        console.error('localStorage failed', err)
      }

      toast.success(`${perk.name} activated`)
    } catch (err) {
      console.error('Perk purchase failed', err)
      toast.error('Purchase failed')
    }
  }

  const purchaseEntranceEffect = async (effect: EntranceEffect) => {
    if (!profile) {
      toast.error('Login required')
      return
    }

    const currentPaid = profile.paid_coin_balance || 0
    if (currentPaid < effect.coin_cost) {
      toast.error('Not enough Coins')
      return
    }

    try {
      // Deduct coins using centralized transaction logging
      const result = await deductCoins({
        userId: profile.id,
        amount: effect.coin_cost,
        type: 'entrance_effect',
        coinType: 'paid',
        description: `Purchased ${effect.name}`,
        metadata: {
          effect_name: effect.name,
          rarity: effect.rarity,
          icon: effect.icon,
          cost: effect.coin_cost
        }
      })

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase effect')
        return
      }

      // Save to user_entrance_effects table
      const { error: effectError } = await supabase
        .from('user_entrance_effects')
        .insert({
          user_id: profile.id,
          effect_id: effect.id,
          purchased_at: new Date().toISOString(),
          is_active: false, // User must activate it manually
          metadata: {
            effect_name: effect.name,
            rarity: effect.rarity,
            icon: effect.icon,
            cost: effect.coin_cost
          }
        })
        .select()
        .single()

      if (effectError) {
        console.error('Failed to save entrance effect:', effectError)
        toast.error('Purchase succeeded but failed to save effect')
        return
      }

      // Update local state
      setProfile({ ...(profile as any), paid_coin_balance: result.newBalance } as any)
      toast.success(`Purchased ${effect.name}! Activate it in your profile.`)
    } catch (err) {
      console.error('Entrance effect purchase failed', err)
      toast.error('Purchase failed')
    }
  }

  const exchangeCoins = async () => {
    if (!profile) {
      toast.error('Login required')
      return
    }

    const currentFree = profile.free_coin_balance || 0
    if (currentFree < 100000) {
      toast.error('Need 100,000 free coins')
      return
    }

    const currentPaid = profile.paid_coin_balance || 0
    const newPaid = currentPaid + 10
    const newFree = currentFree - 100000

    await supabase
      .from('user_profiles')
      .update({
        paid_coin_balance: newPaid,
        free_coin_balance: newFree
      })
      .eq('id', profile.id)

    setProfile(
      {
        ...(profile as any),
        paid_coin_balance: newPaid,
        free_coin_balance: newFree
      } as any
    )

    toast.success('Converted 100,000 free → 10 paid coins')
  }

  const triggerTrollDrop = async () => {
    if (!profile) {
      toast.error('Login required')
      return
    }

    const currentFree = profile.free_coin_balance || 0
    const isGreen = Math.random() > 0.5
    const coinChange = isGreen ? 2500 : -2500
    const newBalance = Math.max(0, currentFree + coinChange)

    await supabase
      .from('user_profiles')
      .update({ free_coin_balance: newBalance })
      .eq('id', profile.id)

    setProfile(
      { ...(profile as any), free_coin_balance: newBalance } as any
    )

    toast.success(
      isGreen
        ? '🟢 Lucky Green Troll! +2500 free coins!'
        : '🔴 Red Troll! -2500 coins!'
    )
  }

  // Listen for completed coin_transactions
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`coin_tx_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coin_transactions',
          filter: `user_id=eq.${profile.id}`
        },
        payload => {
          const row: any = payload.new
          if (row.status === 'completed') {
            const currentPaid = profile.paid_coin_balance || 0
            const added = Number(row.coins || 0)

            setProfile(
              {
                ...(profile as any),
                paid_coin_balance: currentPaid + added
              } as any
            )

            toast.success('Coins added')
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.paid_coin_balance, setProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/asfalt-light.png')] opacity-5" />

      <div className="relative max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Troll Coin Store
          </h1>

          {profile && (
            <div className="mt-4 inline-flex items-center space-x-4 bg-[#121212] rounded-lg px-6 py-3 border border-[#2C2C2C]">
              <span>
                💰 Paid:{' '}
                {profile.paid_coin_balance?.toLocaleString() ?? 0}
              </span>
              <span>
                🧌 Free:{' '}
                {profile.free_coin_balance?.toLocaleString() ?? 0}
              </span>
            </div>
          )}

          {isFriday && (
            <div className="mt-3 text-sm text-green-300">
              Friday bonus active: +10% coins on purchases over $20
            </div>
          )}
        </div>

        {/* Payment method pill */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-3 inline-flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-troll-neon-blue" />
            <span className="text-sm text-gray-300">Payment Method:</span>

            {defaultMethod ? (
              <span className="px-3 py-1 rounded bg-[#23232b] border border-troll-purple text-white text-sm">
                {defaultMethod.brand ?? 'Card'} ••••{' '}
                {defaultMethod.last4 ?? '****'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded bg-red-500/20 border border-red-500 text-red-300 text-sm">
                No payment method
              </span>
            )}

            <button
              onClick={() =>
                navigate('/account/wallet')
              }
              className="text-xs text-troll-neon-blue hover:underline"
            >
              Manage
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6 space-x-3">
          {(['packages', 'effects', 'free', 'perks', 'insurance'] as const).map(
            tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg transition ${
                  activeTab === tab
                    ? 'bg-[#FFC93C] text-black'
                    : 'bg-[#1A1A1A] text-white'
                }`}
              >
                {tab === 'packages'
                  ? 'Coin Packages'
                  : tab === 'effects'
                  ? 'Entrance Effects'
                  : tab === 'free'
                  ? 'Free Coin Store'
                  : tab === 'perks'
                  ? 'Perks'
                  : 'Insurance'}
              </button>
            )
          )}
        </div>

        {/* =================== INSURANCE =================== */}
        {activeTab === 'insurance' && (
          <div className="mt-6">
            <TrollerInsurance />
          </div>
        )}

        {/* =================== PACKAGES =================== */}
        {activeTab === 'packages' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className="relative p-6 rounded-2xl bg-gradient-to-br from-[#0A0A0F] to-[#13141F] border border-gray-700 shadow-lg hover:shadow-yellow-500/40 hover:border-yellow-400 cursor-pointer backdrop-blur-xl transform transition duration-300 hover:-translate-y-2"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-purple-500/10 to-green-500/10 blur-xl opacity-0 hover:opacity-100 transition duration-500 pointer-events-none" />

                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">💰</span>
                  <h3 className="text-xl font-bold text-gray-100 tracking-wide">
                    {pkg.name}
                  </h3>
                </div>

                <p className="text-[#FFC93C] text-3xl font-extrabold drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                  {pkg.coin_amount.toLocaleString()} Coins
                </p>

                {isFriday && pkg.price > 20 && (
                  <div className="mt-1 text-xs text-green-300">
                    +10% Friday bonus applied at checkout
                  </div>
                )}

                <p className="text-gray-400 mt-2">
                  ${pkg.price.toFixed(2)}
                </p>

                <button
                  onClick={() => startPurchase(pkg)}
                  className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-400 text-black font-bold hover:scale-105 transition shadow-lg"
                >
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        )}

        {/* =================== ENTRANCE EFFECTS =================== */}
        {activeTab === 'effects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {effects.map(e => (
              <div
                key={e.id}
                className={[
                  'p-6 rounded-xl bg-[#1A1A1A] border hover:scale-105 transition shadow-lg',
                  e.rarity === 'Rare'
                    ? 'border-blue-400 shadow-blue-500/30'
                    : '',
                  e.rarity === 'Epic'
                    ? 'border-purple-400 shadow-purple-500/30'
                    : '',
                  e.rarity === 'Legendary'
                    ? 'border-yellow-400 shadow-yellow-500/50'
                    : '',
                  e.rarity === 'Mythic'
                    ? 'border-red-400 shadow-red-500/50 animate-pulse'
                    : '',
                  e.rarity === 'Exclusive'
                    ? 'border-green-400 shadow-green-500/50 animate-bounce'
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="text-6xl mb-2">{e.icon}</div>
                <h3 className="text-xl font-bold">{e.name}</h3>
                <p className="text-gray-400 text-sm">{e.rarity}</p>
                <p className="text-[#FFC93C] text-2xl mt-2">
                  {e.coin_cost.toLocaleString()} Coins
                </p>

                <button
                  className="mt-3 bg-[#FFC93C] text-black px-4 py-2 rounded-lg hover:bg-white"
                  onClick={() => purchaseEntranceEffect(e)}
                >
                  Buy Effect
                </button>
              </div>
            ))}
          </div>
        )}

        {/* =================== PERKS =================== */}
        {activeTab === 'perks' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {PERKS.map(perk => (
              <div
                key={perk.id}
                className="p-6 rounded-2xl bg-[#121212] border border-yellow-500/60 shadow-lg"
              >
                <div className="font-bold text-white mb-1">
                  {perk.name}
                </div>
                <div className="text-sm text-gray-400 mb-3">
                  {perk.desc}
                </div>
                <div className="text-[#FFC93C] text-xl font-bold mb-3">
                  {perk.cost.toLocaleString()} Coins
                </div>
                <button
                  onClick={() => buyPerk(perk.id)}
                  className="w-full py-2 rounded bg-yellow-500 text-black font-bold"
                >
                  Buy
                </button>
              </div>
            ))}
          </div>
        )}

        {/* =================== FREE STORE =================== */}
        {activeTab === 'free' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Convert Free -> Paid */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[#0A0A0F] to-[#13141F] border border-gray-700 shadow-lg hover:shadow-green-500/40 hover:border-green-400 cursor-pointer backdrop-blur-xl transform transition duration-300 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-400/10 via-purple-500/10 to-yellow-400/10 blur-xl opacity-0 hover:opacity-100 transition duration-500 pointer-events-none" />
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🔄</span>
                <h3 className="text-lg font-bold">
                  Convert Free ➜ Paid Coins
                </h3>
              </div>
              <p className="text-gray-300">
                100,000 free coins = 🎯 10 paid coins
              </p>
              <button
                onClick={exchangeCoins}
                className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-green-400 to-yellow-400 text-black font-bold hover:scale-105 transition shadow-lg"
              >
                Convert Now
              </button>
            </div>

            {/* Random Troll Drop */}
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[#0A0A0F] to-[#13141F] border border-gray-700 shadow-lg hover:shadow-red-500/40 hover:border-red-400 cursor-pointer backdrop-blur-xl transform transition duration-300 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/10 via-purple-500/10 to-yellow-500/10 blur-xl opacity-0 hover:opacity-100 transition duration-500 pointer-events-none" />
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🎲</span>
                <h3 className="text-lg font-bold">Random Troll Drop</h3>
              </div>
              <p className="text-gray-300">
                🟢 Green Troll: +2500 Free Coins
                <br />
                🔴 Red Troll: -2500 Coins
              </p>
              <button
                onClick={triggerTrollDrop}
                className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:scale-105 transition shadow-lg"
              >
                Trigger Troll Drop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
