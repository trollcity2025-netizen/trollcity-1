import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'
import { Gift, Coins, X, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface GiftModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientUsername: string
}

const presetAmounts = [50, 100, 200, 500, 1000, 2500, 5000]

const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose, recipientId, recipientUsername }) => {
  const { user } = useAuthStore()
  const { balances, spendCoins } = useCoins()
  const [amount, setAmount] = useState<number>(100)
  const [loading, setLoading] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)

  // Reset idempotency key when transaction parameters change
  useEffect(() => {
    setIdempotencyKey(null)
  }, [amount, recipientId])

  if (!isOpen) return null

  const sendGift = async () => {
    if (!user || amount <= 0 || amount > (balances.troll_coins || 0)) {
      toast.error('Invalid gift amount or insufficient balance')
      return
    }

    // Reuse existing key if retrying, otherwise generate new one
    const key = idempotencyKey || uuidv4()
    if (!idempotencyKey) {
      setIdempotencyKey(key)
    }

    setLoading(true)
    try {
      const success = await spendCoins({
        senderId: user.id,
        receiverId: recipientId,
        amount: amount,
        source: 'gift',
        item: 'Coin Gift',
        idempotencyKey: key
      })

      if (success) {
        toast.success('Gift sent successfully!')
        setTimeout(() => {
          onClose()
          setAmount(100)
          setIdempotencyKey(null)
        }, 1500)
      }
    } catch (err: any) {
      console.error('Gift error:', err)
      toast.error(err.message || 'Failed to send gift')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Send Gift</h3>
                <p className="text-sm text-gray-400">to {recipientUsername}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Troll Coins</span>
              </div>
              <span className="text-lg font-bold text-yellow-400">
                {balances.troll_coins?.toLocaleString?.() ?? '0'}
              </span>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-300 mb-3">Gift Amount</label>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  amount === preset ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter amount"
              min="1"
            />
            <Coins className="absolute right-3 top-3 w-5 h-5 text-yellow-400" />
          </div>

          <button
            onClick={sendGift}
            disabled={loading || amount <= 0 || amount > (balances.troll_coins || 0)}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                Send Gift ({amount.toLocaleString()} Coins)
              </>
            )}
          </button>

          {amount > (balances.troll_coins || 0) && (
            <p className="text-red-400 text-sm mt-2 text-center">Insufficient Troll Coins balance</p>
          )}
        </div>
      </div>
    </>
  )
}

export default GiftModal
