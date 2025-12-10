import { Coins, Gift, Crown } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { getVipTier, isOG } from '../lib/vip'
import { useNavigate } from 'react-router-dom'
import { useCoins } from '../lib/hooks/useCoins'

export default function WalletSummary() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  
  // ✅ REAL COIN LOGIC: Use useCoins hook for real-time balance updates
  // This replaces manual fetching and ensures balances stay in sync
  const { balances, loading } = useCoins()

  if (!user || !profile) return null

  // Use balances from hook (real-time) or fallback to profile
  const paidCoins = balances.paid_coin_balance
  const freeCoins = balances.free_coin_balance
  const totalEarned = balances.total_earned_coins

  const vip = getVipTier(totalEarned)
  const ogStatus = isOG(profile.created_at || new Date().toISOString())

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-700 px-4 py-3 flex items-center gap-4">
      <div className="flex-1">
        <div className="text-sm text-slate-400">Wallet</div>
        <div className="flex gap-6 mt-1 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-slate-400">Paid:</span>
            <span className="font-semibold text-yellow-300">
              {loading ? '...' : paidCoins.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Gift className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">TrollMonds:</span>
            <button
              className="font-semibold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
              onClick={() => navigate('/trollmond-store')}
            >
              {loading ? '...' : freeCoins.toLocaleString()}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">VIP:</span>
            <span 
              className="font-semibold"
              style={{ color: vip.color }}
            >
              {vip.name}
              {ogStatus && <span className="ml-1 text-yellow-400">• OG</span>}
            </span>
          </div>
        </div>
      </div>

      <button
        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-semibold transition-colors"
        onClick={() => navigate('/store')}
      >
        Buy Coins
      </button>
    </div>
  )
}

