import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { X, DollarSign, AlertCircle } from 'lucide-react'
import { RequestPayoutResponse } from '../types/earnings'

interface RequestPayoutModalProps {
  userId: string
  availableCoins: number
  onClose: () => void
  onSuccess: () => void
}

export default function RequestPayoutModal({
  userId,
  availableCoins,
  onClose,
  onSuccess
}: RequestPayoutModalProps) {
  const [coinsToRedeem, setCoinsToRedeem] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const MINIMUM_COINS = 7000 // $21 minimum
  // Conversion rate varies by tier: $21/7k = $0.003, $49.50/14k = $0.0035357, $90/27k = $0.00333, $150/47k = $0.00319
  // Using average rate for display purposes
  const CONVERSION_RATE = 0.003 // Approximate rate for display

  const coinsNum = parseInt(coinsToRedeem, 10) || 0
  const usdAmount = coinsNum * CONVERSION_RATE
  const isValid = coinsNum >= MINIMUM_COINS && coinsNum <= availableCoins

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isValid) {
      toast.error(`Please enter between ${MINIMUM_COINS.toLocaleString()} and ${availableCoins.toLocaleString()} coins`)
      return
    }

    setLoading(true)
    try {
      // Call RPC function
      const { data, error } = await supabase
        .rpc('request_payout', {
          p_user_id: userId,
          p_coins_to_redeem: coinsNum
        })

      if (error) throw error

      const response = data as RequestPayoutResponse

      if (!response.success) {
        toast.error(response.error || 'Failed to submit payout request')
        return
      }

      toast.success(`Payout request submitted! ${coinsNum.toLocaleString()} coins = $${usdAmount.toFixed(2)}`)
      onSuccess()
    } catch (err: any) {
      console.error('Payout request error:', err)
      toast.error(err?.message || 'Failed to submit payout request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-400" />
            Request Payout
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Convert your coins to cash
          </p>
        </div>

        {/* Available Balance */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-4 border border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Available Coins:</span>
            <span className="text-xl font-bold text-yellow-400">
              {availableCoins.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-gray-400">USD Value:</span>
            <span className="text-lg font-semibold text-green-400">
              ${(availableCoins * CONVERSION_RATE).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Coins to Redeem
            </label>
            <input
              type="number"
              min={MINIMUM_COINS}
              max={availableCoins}
              value={coinsToRedeem}
              onChange={(e) => setCoinsToRedeem(e.target.value)}
              placeholder={`Min: ${MINIMUM_COINS.toLocaleString()} coins`}
              className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum: {MINIMUM_COINS.toLocaleString()} coins (${(MINIMUM_COINS * CONVERSION_RATE).toFixed(2)})
            </p>
          </div>

          {/* Conversion Display */}
          {coinsNum > 0 && (
            <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">You will receive:</span>
                <span className="text-2xl font-bold text-green-400">
                  ${usdAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Conversion rate: 100 coins = $1.00
              </p>
            </div>
          )}

          {/* Validation Errors */}
          {coinsToRedeem && !isValid && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">
                {coinsNum < MINIMUM_COINS && (
                  <p>Minimum withdrawal is {MINIMUM_COINS.toLocaleString()} coins</p>
                )}
                {coinsNum > availableCoins && (
                  <p>You don't have enough coins. Available: {availableCoins.toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

