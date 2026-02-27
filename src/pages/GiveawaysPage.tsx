import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Gift,
  Clock,
  Users,
  Trophy,
  Crown,
  Tag,
  CheckCircle,
  Coins,
  Sparkles,
  Ticket,
  ChevronRight,
  RefreshCw,
  Wallet
} from 'lucide-react'

// Types
interface Giveaway {
  id: string
  title: string
  description: string | null
  prize_type: 'troll_coins' | 'vip_badge' | 'gift_pack' | 'custom'
  prize_amount: number | null
  prize_tier: string | null
  prize_duration_days: number | null
  gift_pack_discount: number | null
  entry_cost_trollz: number
  max_entries: number | null
  allow_free_entry: boolean
  end_time: string
  entry_count: number
  user_entry_count: number
  user_has_free_entry: boolean
}

interface UserReward {
  id: string
  reward_type: string
  reward_amount: number | null
  vip_tier: string | null
  vip_duration_days: number | null
  gift_pack_discount: number | null
  is_claimed: boolean
  claimed_at: string | null
  giveaway_title: string | null
  created_at: string
}

type TabType = 'active' | 'my-rewards'

export default function GiveawaysPage() {
  const { profile } = useAuthStore()
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [rewards, setRewards] = useState<UserReward[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [loading, setLoading] = useState(true)
  const [entering, setEntering] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({})

  // Fetch giveaways
  const fetchGiveaways = useCallback(async () => {
    if (!profile?.id) return
    
    try {
      const { data, error } = await supabase.rpc('get_active_giveaways')
      if (error) throw error
      setGiveaways(data || [])
    } catch (err) {
      console.error('Error fetching giveaways:', err)
      toast.error('Failed to load giveaways')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  // Fetch user rewards
  const fetchRewards = useCallback(async () => {
    if (!profile?.id) return
    
    try {
      const { data, error } = await supabase.rpc('get_user_rewards')
      if (error) throw error
      setRewards(data || [])
    } catch (err) {
      console.error('Error fetching rewards:', err)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchGiveaways()
    fetchRewards()
  }, [fetchGiveaways, fetchRewards])

  // Countdown timer
  useEffect(() => {
    const updateTimers = () => {
      const now = new Date()
      const newTimeLeft: Record<string, string> = {}
      
      giveaways.forEach(g => {
        const end = new Date(g.end_time)
        const diff = end.getTime() - now.getTime()
        
        if (diff <= 0) {
          newTimeLeft[g.id] = 'Ended'
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          
          if (days > 0) {
            newTimeLeft[g.id] = `${days}d ${hours}h`
          } else if (hours > 0) {
            newTimeLeft[g.id] = `${hours}h ${minutes}m`
          } else {
            newTimeLeft[g.id] = `${minutes}m`
          }
        }
      })
      
      setTimeLeft(newTimeLeft)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [giveaways])

  // Enter giveaway
  const handleEnterGiveaway = async (giveawayId: string, useFreeEntry: boolean) => {
    if (!profile?.id) {
      toast.error('Please log in to enter')
      return
    }

    setEntering(giveawayId)
    
    try {
      const { data, error } = await supabase.rpc('enter_giveaway', {
        p_giveaway_id: giveawayId,
        p_use_free_entry: useFreeEntry
      })

      if (error) throw error

      if (data?.success) {
        toast.success(useFreeEntry ? 'Entered with free entry!' : `Entered for ${data.cost} Trollz!`)
        fetchGiveaways()
        fetchRewards()
      } else {
        toast.error(data?.error || 'Failed to enter')
      }
    } catch (err: any) {
      console.error('Error entering giveaway:', err)
      toast.error(err.message || 'Failed to enter giveaway')
    } finally {
      setEntering(null)
    }
  }

  // Claim reward
  const handleClaimReward = async (rewardId: string) => {
    if (!profile?.id) {
      toast.error('Please log in to claim')
      return
    }

    setClaiming(rewardId)
    
    try {
      const { data, error } = await supabase.rpc('claim_giveaway_reward', {
        p_reward_id: rewardId
      })

      if (error) throw error

      if (data?.success) {
        let message = 'Reward claimed!'
        if (data.discount_code) {
          message += ` Code: ${data.discount_code}`
        }
        toast.success(message)
        fetchRewards()
      } else {
        toast.error(data?.error || 'Failed to claim')
      }
    } catch (err: any) {
      console.error('Error claiming reward:', err)
      toast.error(err.message || 'Failed to claim reward')
    } finally {
      setClaiming(null)
    }
  }

  // Get prize icon
  const getPrizeIcon = (prizeType: string) => {
    switch (prizeType) {
      case 'troll_coins':
        return <Coins className="w-6 h-6 text-yellow-400" />
      case 'vip_badge':
        return <Crown className="w-6 h-6 text-purple-400" />
      case 'gift_pack':
        return <Tag className="w-6 h-6 text-green-400" />
      default:
        return <Gift className="w-6 h-6 text-blue-400" />
    }
  }

  // Get prize color
  const getPrizeColor = (prizeType: string) => {
    switch (prizeType) {
      case 'troll_coins':
        return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30'
      case 'vip_badge':
        return 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
      case 'gift_pack':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30'
      default:
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
    }
  }

  // Format prize display
  const formatPrize = (g: Giveaway) => {
    switch (g.prize_type) {
      case 'troll_coins':
        return `${g.prize_amount?.toLocaleString()} Troll Coins`
      case 'vip_badge':
        return `${g.prize_duration_days}-Day ${g.prize_tier?.charAt(0).toUpperCase() + g.prize_tier?.slice(1)} VIP`
      case 'gift_pack':
        return `${g.gift_pack_discount}% Off Coin Store`
      default:
        return g.title
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-slate-400">Please log in to view and enter giveaways</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/20">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Giveaways
            </h1>
            <p className="text-slate-400 text-sm">
              Enter raffles and win amazing prizes!
            </p>
          </div>
        </div>

        {/* Entry Rules */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-purple-400 font-semibold">
            100 Trollz = 1 Entry • Free entry available once per giveaway
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Ticket className="w-5 h-5 inline-block mr-2" />
            Active Giveaways
          </button>
          <button
            onClick={() => setActiveTab('my-rewards')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'my-rewards'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-5 h-5 inline-block mr-2" />
            My Rewards
          </button>
        </div>
      </div>

      {/* Active Giveaways Tab */}
      {activeTab === 'active' && (
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
              <p className="text-slate-400 mt-4">Loading giveaways...</p>
            </div>
          ) : giveaways.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-white/10">
              <Gift className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Active Giveaways</h3>
              <p className="text-slate-400">Check back later for new giveaways!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {giveaways.map((g) => (
                <div
                  key={g.id}
                  className={`relative bg-slate-900/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/10`}
                >
                  {/* Prize Type Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${getPrizeColor(g.prize_type)} opacity-50`} />

                  <div className="relative p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-slate-800/80`}>
                        {getPrizeIcon(g.prize_type)}
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 bg-slate-800/80 rounded-full text-sm">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">
                          {timeLeft[g.id] || 'Loading...'}
                        </span>
                      </div>
                    </div>

                    {/* Title & Prize */}
                    <h3 className="text-xl font-bold text-white mb-2">{g.title}</h3>
                    <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-4">
                      {formatPrize(g)}
                    </p>

                    {/* Description */}
                    {g.description && (
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                        {g.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{g.entry_count} entries</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <Ticket className="w-4 h-4" />
                        <span>{g.user_entry_count} your entries</span>
                      </div>
                    </div>

                    {/* Entry Info */}
                    <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Entry Cost:</span>
                        <span className="text-yellow-400 font-bold">{g.entry_cost_trollz} Trollz</span>
                      </div>
                      {g.max_entries && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-slate-400">Max Entries:</span>
                          <span className="text-white">{g.max_entries}</span>
                        </div>
                      )}
                      {g.allow_free_entry && g.user_has_free_entry && (
                        <div className="flex items-center gap-1 mt-2 text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span>Free entry available!</span>
                        </div>
                      )}
                    </div>

                    {/* Enter Button */}
                    <div className="space-y-2">
                      {/* Free Entry Button */}
                      {g.allow_free_entry && g.user_has_free_entry && (
                        <button
                          onClick={() => handleEnterGiveaway(g.id, true)}
                          disabled={entering === g.id}
                          className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {entering === g.id ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Ticket className="w-5 h-5" />
                              Use Free Entry
                            </>
                          )}
                        </button>
                      )}

                      {/* Paid Entry Button */}
                      <button
                        onClick={() => handleEnterGiveaway(g.id, false)}
                        disabled={entering === g.id || (g.max_entries && g.user_entry_count >= g.max_entries)}
                        className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {entering === g.id ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : g.max_entries && g.user_entry_count >= g.max_entries ? (
                          'Max Entries Reached'
                        ) : (
                          <>
                            <Coins className="w-5 h-5" />
                            Enter for {g.entry_cost_trollz} Trollz
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Decorative Corner */}
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${getPrizeColor(g.prize_type)} opacity-20 rounded-bl-full`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Rewards Tab */}
      {activeTab === 'my-rewards' && (
        <div className="max-w-6xl mx-auto">
          {rewards.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-white/10">
              <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Rewards Yet</h3>
              <p className="text-slate-400">Enter giveaways to win prizes!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rewards.map((r) => (
                <div
                  key={r.id}
                  className={`p-6 bg-slate-900/80 backdrop-blur-sm border rounded-2xl ${
                    r.is_claimed 
                      ? 'border-green-500/30' 
                      : 'border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        r.is_claimed ? 'bg-green-500/20' : 'bg-purple-500/20'
                      }`}>
                        {r.reward_type === 'troll_coins' ? (
                          <Coins className="w-6 h-6 text-yellow-400" />
                        ) : r.reward_type === 'vip_badge' ? (
                          <Crown className="w-6 h-6 text-purple-400" />
                        ) : (
                          <Tag className="w-6 h-6 text-green-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">
                          {r.reward_type === 'troll_coins' && `${r.reward_amount?.toLocaleString()} Troll Coins`}
                          {r.reward_type === 'vip_badge' && `${r.vip_duration_days}-Day ${r.vip_tier} VIP`}
                          {r.reward_type === 'gift_pack' && `${r.gift_pack_discount}% Off Coin Store`}
                        </h4>
                        {r.giveaway_title && (
                          <p className="text-slate-400 text-sm">
                            From: {r.giveaway_title}
                          </p>
                        )}
                        <p className="text-slate-500 text-xs">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      {r.is_claimed ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 font-semibold">Claimed</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward(r.id)}
                          disabled={claiming === r.id}
                          className="px-6 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {claiming === r.id ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              Claim Reward
                              <ChevronRight className="w-5 h-5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
