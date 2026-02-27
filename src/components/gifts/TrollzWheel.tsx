import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Gift, Coins, Sparkles, Star, Zap } from 'lucide-react'
import { useTrollz } from '@/lib/hooks/useTrollz'

interface WheelSegment {
  type: 'trollz' | 'bonus_coins'
  label: string
  color: string
  textColor: string
  range: [number, number]
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: 'trollz', label: '50 Trollz', color: '#10B981', textColor: '#ffffff', range: [0, 6] },
  { type: 'trollz', label: '100 Trollz', color: '#059669', textColor: '#ffffff', range: [6, 12] },
  { type: 'trollz', label: '75 Trollz', color: '#10B981', textColor: '#ffffff', range: [12, 18] },
  { type: 'trollz', label: '150 Trollz', color: '#047857', textColor: '#ffffff', range: [18, 24] },
  { type: 'bonus_coins', label: '5 Coins', color: '#F59E0B', textColor: '#ffffff', range: [24, 30] },
  { type: 'trollz', label: '200 Trollz', color: '#065F46', textColor: '#ffffff', range: [30, 36] },
  { type: 'trollz', label: '100 Trollz', color: '#10B981', textColor: '#ffffff', range: [36, 42] },
  { type: 'bonus_coins', label: '10 Coins', color: '#D97706', textColor: '#ffffff', range: [42, 48] },
  { type: 'trollz', label: '125 Trollz', color: '#059669', textColor: '#ffffff', range: [48, 54] },
  { type: 'trollz', label: '75 Trollz', color: '#10B981', textColor: '#ffffff', range: [54, 60] },
  { type: 'bonus_coins', label: '25 Coins', color: '#B45309', textColor: '#ffffff', range: [60, 66] },
  { type: 'trollz', label: '300 Trollz', color: '#064E3B', textColor: '#ffffff', range: [66, 72] },
  { type: 'trollz', label: '100 Trollz', color: '#10B981', textColor: '#ffffff', range: [72, 78] },
  { type: 'bonus_coins', label: '50 Coins', color: '#92400E', textColor: '#ffffff', range: [78, 84] },
  { type: 'trollz', label: '250 Trollz', color: '#065F46', textColor: '#ffffff', range: [84, 90] },
  { type: 'trollz', label: '500 Trollz', color: '#022c22', textColor: '#ffffff', range: [90, 100] },
]

const SPIN_DURATION = 5000 // 5 seconds
const SPIN_COST = 100

export default function TrollzWheel() {
  const { balances, spinning, spinWheel, refreshBalances, getSpinCost } = useTrollz()
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [showReward, setShowReward] = useState(false)
  const [lastReward, setLastReward] = useState<{ type: string; amount: number } | null>(null)

  const spinCost = getSpinCost()

  const handleSpin = useCallback(async () => {
    if (balances.trollz_balance < spinCost || isSpinning || spinning) {
      return
    }

    setIsSpinning(true)
    setShowReward(false)
    setLastReward(null)

    // Random rotation between 1800 and 3600 degrees (5-10 full rotations)
    const newRotation = rotation + 1800 + Math.random() * 1800
    setRotation(newRotation)

    // Wait for spin animation to complete
    setTimeout(async () => {
      const result = await spinWheel()
      
      if (result && result.success) {
        setLastReward({
          type: result.reward_type,
          amount: result.reward_amount
        })
        setShowReward(true)
        
        // Hide reward after 5 seconds
        setTimeout(() => {
          setShowReward(false)
        }, 5000)
      }
      
      setIsSpinning(false)
    }, SPIN_DURATION)
  }, [balances.trollz_balance, isSpinning, spinning, spinWheel, rotation, spinCost])

  useEffect(() => {
    refreshBalances()
  }, [refreshBalances])

  // Get icon for reward type
  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'trollz':
        return <Zap className="w-8 h-8 text-yellow-400" />
      case 'bonus_coins':
        return <Coins className="w-8 h-8 text-yellow-400" />
      default:
        return <Gift className="w-8 h-8 text-yellow-400" />
    }
  }

  // Get label for reward type
  const getRewardLabel = (type: string) => {
    switch (type) {
      case 'trollz':
        return 'Trollz'
      case 'bonus_coins':
        return 'Bonus Coins'
      default:
        return 'Reward'
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Troll Wheel</h3>
            <p className="text-sm text-slate-400">Spin to win rewards!</p>
          </div>
        </div>
        
        {/* Balance Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-white">{balances.trollz_balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Wheel Container */}
      <div className="relative flex justify-center mb-6">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[16px] border-t-red-500" />
        </div>

        {/* Wheel */}
        <div className="relative w-64 h-64">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-yellow-500 shadow-lg shadow-yellow-500/30" />
          
          {/* Spinning wheel */}
          <div 
            className="absolute inset-2 rounded-full overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none'
            }}
          >
            {WHEEL_SEGMENTS.map((segment, index) => {
              const segmentAngle = 360 / WHEEL_SEGMENTS.length
              return (
                <div
                  key={index}
                  className="absolute w-1/2 h-1/2 origin-bottom-left"
                  style={{
                    backgroundColor: segment.color,
                    transform: `rotate(${index * segmentAngle - 90}deg)`,
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%)'
                  }}
                >
                  <span 
                    className="absolute left-8 top-8 text-xs font-bold whitespace-nowrap"
                    style={{ 
                      color: segment.textColor,
                      transform: `rotate(${segmentAngle / 2}deg)`
                    }}
                  >
                    {segment.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-yellow-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Spin Button */}
      <div className="text-center">
        <button
          onClick={handleSpin}
          disabled={balances.trollz_balance < spinCost || isSpinning || spinning}
          className={`
            relative px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200
            ${balances.trollz_balance >= spinCost && !isSpinning && !spinning
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transform hover:scale-105'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {isSpinning || spinning ? (
            <span className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 animate-spin" />
              Spinning...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Spin ({spinCost} Trollz)
            </span>
          )}
        </button>

        {balances.trollz_balance < spinCost && (
          <p className="mt-2 text-sm text-red-400">
            Not enough Trollz! Send gifts to earn more.
          </p>
        )}
      </div>

      {/* Reward Display */}
      {showReward && lastReward && (
        <div className="mt-6 animate-bounce-in">
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getRewardIcon(lastReward.type)}
              <span className="text-2xl font-bold text-yellow-400">
                +{lastReward.amount.toLocaleString()}
              </span>
              <span className="text-lg text-white">
                {getRewardLabel(lastReward.type)}
              </span>
            </div>
            <p className="text-sm text-slate-300">Congratulations!</p>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">How it works:</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Each spin costs <span className="text-yellow-400 font-semibold">{spinCost} Trollz</span></li>
          <li>• Win Trollz or Bonus Coins!</li>
          <li>• Earn Trollz by sending gifts (50% of gift value)</li>
          <li>• Convert 100 Trollz = 10 Bonus Coins</li>
        </ul>
      </div>
    </div>
  )
}
