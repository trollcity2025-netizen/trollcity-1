import { useEffect, useState } from 'react'
import { Zap, Coins, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useTrollz } from '@/lib/hooks/useTrollz'

interface TrollzBalanceDisplayProps {
  showConversion?: boolean
  compact?: boolean
}

export default function TrollzBalanceDisplay({ showConversion = true, compact = false }: TrollzBalanceDisplayProps) {
  const { balances, loading, refreshBalances, convertToCoins, converting, getConversionRate } = useTrollz()
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertAmount, setConvertAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')

  const conversionRate = getConversionRate()

  useEffect(() => {
    refreshBalances()
  }, [refreshBalances])

  const handleQuickConvert = (amount: number) => {
    setConvertAmount(amount)
    setCustomAmount(amount.toString())
  }

  const handleCustomConvert = () => {
    const amount = parseInt(customAmount, 10)
    if (amount >= conversionRate.trollz) {
      setConvertAmount(amount)
    }
  }

  const handleConvert = async () => {
    if (convertAmount < conversionRate.trollz) return
    if (convertAmount > balances.trollz_balance) return
    
    await convertToCoins(convertAmount)
    setShowConvertModal(false)
    setCustomAmount('')
  }

  const coinsToReceive = Math.floor(convertAmount / conversionRate.trollz) * conversionRate.coins

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded-lg">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">{balances.trollz_balance.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded-lg">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-white">{balances.bonus_coin_balance.toLocaleString()}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Your Trollz</h3>
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Trollz Balance */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-slate-400">Trollz</span>
            </div>
            <p className="text-xl font-bold text-white">{balances.trollz_balance.toLocaleString()}</p>
          </div>

          {/* Bonus Coins Balance */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-xs text-slate-400">Bonus Coins</span>
            </div>
            <p className="text-xl font-bold text-white">{balances.bonus_coin_balance.toLocaleString()}</p>
          </div>
        </div>

        {/* Conversion Info */}
        {showConversion && (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-slate-400">
                <span className="text-yellow-400 font-semibold">{conversionRate.trollz} Trollz</span>
                {' = '}
                <span className="text-yellow-500 font-semibold">{conversionRate.coins} Bonus Coins</span>
              </p>
            </div>

            {/* Convert Button */}
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={balances.trollz_balance < conversionRate.trollz}
              className={`
                w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all
                ${balances.trollz_balance >= conversionRate.trollz
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Convert to Coins
            </button>
          </>
        )}

        {/* How to earn */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            Earn Trollz by sending gifts! You'll receive <span className="text-yellow-400">50%</span> of the gift value in Trollz.
          </p>
        </div>
      </div>

      {/* Conversion Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-yellow-400" />
              Convert Trollz to Coins
            </h3>

            {/* Conversion Rate */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-400 text-center">
                <span className="text-yellow-400 font-semibold">{conversionRate.trollz} Trollz</span>
                {' = '}
                <span className="text-yellow-500 font-semibold">{conversionRate.coins} Bonus Coins</span>
              </p>
            </div>

            {/* Current Balance */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-1">Available Trollz</p>
              <p className="text-2xl font-bold text-white">{balances.trollz_balance.toLocaleString()}</p>
            </div>

            {/* Quick Select */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">Quick Select</p>
              <div className="grid grid-cols-4 gap-2">
                {[100, 200, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickConvert(amount)}
                    disabled={amount > balances.trollz_balance}
                    className={`
                      py-2 rounded-lg text-sm font-medium transition-all
                      ${convertAmount === amount
                        ? 'bg-yellow-500 text-white'
                        : amount > balances.trollz_balance
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }
                    `}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">Or enter custom amount</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onBlur={handleCustomConvert}
                  placeholder="Enter amount"
                  min={conversionRate.trollz}
                  max={balances.trollz_balance}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">You'll receive:</span>
                <span className="text-xl font-bold text-yellow-400">+{coinsToReceive.toLocaleString()} Bonus Coins</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConvertModal(false)
                  setCustomAmount('')
                }}
                className="flex-1 py-2.5 rounded-lg font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting || convertAmount < conversionRate.trollz || convertAmount > balances.trollz_balance}
                className={`
                  flex-1 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all
                  ${converting || convertAmount < conversionRate.trollz || convertAmount > balances.trollz_balance
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400'
                  }
                `}
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  'Convert'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
