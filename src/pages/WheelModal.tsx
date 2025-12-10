import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { X, DollarSign, Gem, Crown, Skull, Gift, Zap } from 'lucide-react'

interface WheelSegment {
  id: string
  label: string
  icon: JSX.Element
  color: string
  coins: number
  probability: number
}

interface WheelModalProps {
  onClose?: () => void
}

export default function WheelModal({ onClose }: WheelModalProps) {
  const { profile, user } = useAuthStore()
  const [isOpen, setIsOpen] = useState(true)
  const [isSpinning, setIsSpinning] = useState(false)
  const [result, setResult] = useState<WheelSegment | null>(null)
  const [wheelConfig, setWheelConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Wheel segments configuration
  const segments: WheelSegment[] = [
    { id: '100', label: '100', icon: <DollarSign className="w-6 h-6" />, color: '#FFD700', coins: 100, probability: 0.3 },
    { id: '500', label: '500', icon: <Gem className="w-6 h-6" />, color: '#00BFFF', coins: 500, probability: 0.2 },
    { id: '1000', label: '1000', icon: <Crown className="w-6 h-6" />, color: '#FF6347', coins: 1000, probability: 0.15 },
    { id: '5000', label: 'JACKPOT', icon: <Zap className="w-6 h-6" />, color: '#FF1493', coins: 5000, probability: 0.05 },
    { id: '250', label: '250', icon: <DollarSign className="w-6 h-6" />, color: '#32CD32', coins: 250, probability: 0.2 },
    { id: '750', label: '750', icon: <Gift className="w-6 h-6" />, color: '#FF69B4', coins: 750, probability: 0.1 },
  ]

  useEffect(() => {
    const loadWheelConfig = async () => {
      try {
        setLoading(true)
        // Load wheel configuration from database
        const { data, error } = await supabase
          .from('wheel_config')
          .select('*')
          .maybeSingle()

        if (error) {
          console.warn('No wheel config found, using defaults')
          // Use default config if not found
          setWheelConfig({
            is_active: true,
            spin_cost: 500,
            max_spins_per_day: 10,
            jackpot_odds: 0.05
          })
        } else {
          setWheelConfig(data)
        }
      } catch (err) {
        console.error('Error loading wheel config:', err)
        setWheelConfig({
          is_active: true,
          spin_cost: 500,
          max_spins_per_day: 10,
          jackpot_odds: 0.05
        })
      } finally {
        setLoading(false)
      }
    }

    loadWheelConfig()
  }, [])

  const spinWheel = async () => {
    if (!profile || !user || !wheelConfig?.is_active) return

    // Check if wheel is active
    if (!wheelConfig.is_active) {
      toast.error('Troll Wheel is currently disabled')
      return
    }

    // Check if user has enough free coins
    if ((profile.free_coin_balance || 0) < (wheelConfig.spin_cost || 500)) {
      toast.error(`You need ${wheelConfig.spin_cost || 500} free coins to spin the wheel`)
      return
    }

    setIsSpinning(true)

    try {
      // Deduct free coins first
      const { error: deductError } = await supabase.rpc('spend_free_coins', {
        p_user_id: user.id,
        p_amount: wheelConfig.spin_cost || 500,
        p_reason: 'troll_wheel_spin'
      })

      if (deductError) {
        throw deductError
      }

      // Calculate result based on probabilities
      const random = Math.random()
      let cumulativeProbability = 0
      let selectedSegment = segments[0]

      for (const segment of segments) {
        cumulativeProbability += segment.probability
        if (random <= cumulativeProbability) {
          selectedSegment = segment
          break
        }
      }

      // Apply jackpot odds override if configured
      if (wheelConfig.jackpot_odds && Math.random() < wheelConfig.jackpot_odds) {
        selectedSegment = segments.find(s => s.id === '5000') || selectedSegment
      }

      setResult(selectedSegment)

      // Award trollmonds to user (prizes go to trollmond balance)
      // Since we don't have a specific RPC for trollmonds, we'll use a direct database approach
      // First, try to update the wallets table if it exists
      let awardError = null
      try {
        // Try to update wallets table first
        const { error: walletError } = await supabase
          .from('wallets')
          .upsert({
            user_id: user.id,
            trollmonds: (profile as any)?.trollmond_balance || 0 + selectedSegment.coins,
            updated_at: new Date().toISOString()
          })

        if (walletError) {
          console.warn('Wallets table update failed, trying alternative approach:', walletError)
          // If wallets table doesn't exist, we'll need to add trollmond_balance to user_profiles
          // This would require a migration, so for now we'll log the win but not award
          awardError = walletError
        }
      } catch (err) {
        console.error('Error awarding trollmonds:', err)
        awardError = err as any
      }

      if (awardError) {
        console.error('Error awarding trollmonds:', awardError)
        toast.error('Spin completed but failed to award trollmonds')
      } else {
        // Update local profile with trollmond balance
        const updatedProfile = {
          ...profile,
          trollmond_balance: ((profile as any)?.trollmond_balance || 0) + selectedSegment.coins
        }
        useAuthStore.getState().setProfile(updatedProfile as any)
      }

      // Log the spin in database
      await supabase.from('wheel_spins').insert({
        user_id: user.id,
        result: selectedSegment.id,
        coins_won: selectedSegment.coins,
        coins_spent: wheelConfig.spin_cost || 500,
        timestamp: new Date().toISOString()
      })

    } catch (error: any) {
      console.error('Wheel spin error:', error)
      toast.error(error.message || 'Failed to spin wheel')
    } finally {
      setIsSpinning(false)
    }
  }

  const closeModal = () => {
    setIsOpen(false)
    if (onClose) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full relative">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center z-10"
          disabled={isSpinning}
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2 text-center flex items-center justify-center gap-2">
          <span className="text-purple-400">🎡</span>
          TROLL WHEEL
          <span className="text-purple-400">🎡</span>
        </h2>

        <p className="text-gray-300 text-center mb-4 text-sm">
          Spin the wheel for a chance to win free coins!
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          </div>
        ) : (
          <>
            {!result ? (
              <>
                <div className="relative w-64 h-64 mx-auto mb-6">
                  <svg viewBox="0 0 300 300" className="w-full h-full transform transition-all duration-300">
                    {segments.map((segment, index) => {
                      const angle = (index * 60) - 30 // 6 segments = 60 degrees each, offset by 30 to center
                      const startAngle = angle
                      const endAngle = angle + 60
                      const startX = 150 + 140 * Math.cos((startAngle * Math.PI) / 180)
                      const startY = 150 + 140 * Math.sin((startAngle * Math.PI) / 180)
                      const endX = 150 + 140 * Math.cos((endAngle * Math.PI) / 180)
                      const endY = 150 + 140 * Math.sin((endAngle * Math.PI) / 180)

                      return (
                        <path
                          key={segment.id}
                          d={`M150,150 L${startX},${startY} A140,140 0 0,1 ${endX},${endY} Z`}
                          fill={segment.color}
                          stroke="#fff"
                          strokeWidth="2"
                          className="transition-all duration-300"
                        />
                      )
                    })}

                    {/* Wheel center and pointer */}
                    <circle cx="150" cy="150" r="40" fill="#1a1a1a" />
                    <circle cx="150" cy="150" r="30" fill="#8a2be2" />
                    <text x="150" y="155" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
                      SPIN
                    </text>

                    {/* Pointer */}
                    <path
                      d="M150,20 L160,40 L140,40 Z"
                      fill="#ff00ff"
                      className="transition-all duration-300"
                    />
                  </svg>

                  {/* Segment labels */}
                  {segments.map((segment, index) => {
                    const angle = (index * 60) + 30 // Center of segment
                    const radius = 100
                    const x = 150 + radius * Math.cos((angle * Math.PI) / 180)
                    const y = 150 + radius * Math.sin((angle * Math.PI) / 180)

                    return (
                      <text
                        key={`label-${segment.id}`}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                        transform={`rotate(${angle}, ${x}, ${y})`}
                      >
                        {segment.label}
                      </text>
                    )
                  })}
                </div>

                <div className="text-center mb-6">
                  <p className="text-sm text-gray-300 mb-2">
                    Cost: <span className="text-yellow-400 font-bold">{wheelConfig?.spin_cost || 500} free coins</span>
                  </p>
                  <p className="text-sm text-gray-300">
                    Your balance: <span className="text-green-400 font-bold">{profile?.free_coin_balance || 0} free coins</span>
                  </p>
                </div>

                <button
                  onClick={spinWheel}
                  disabled={isSpinning || (profile?.free_coin_balance || 0) < (wheelConfig?.spin_cost || 500)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSpinning ? (
                    <>
                      <span className="animate-spin inline-block mr-2">🎡</span>
                      SPINNING...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🎡</span>
                      SPIN THE WHEEL
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="mb-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    {result.icon}
                  </div>
                  <h3 className="text-3xl font-bold text-yellow-400 mb-2">
                    {result.coins.toLocaleString()} COINS!
                  </h3>
                  <p className="text-gray-300 mb-4">
                    You won <span className="text-yellow-400 font-bold">{result.coins.toLocaleString()}</span> free coins!
                  </p>
                </div>

                <button
                  onClick={() => {
                    setResult(null)
                    closeModal()
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  CLAIM PRIZE & CLOSE
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}