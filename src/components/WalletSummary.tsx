import { Coins, DollarSign, Crown, Landmark, PiggyBank } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { getVipTier, isOG } from '../lib/vip'
import { useNavigate } from 'react-router-dom'
import { useCoins } from '../lib/hooks/useCoins'

export default function WalletSummary() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  
  const { balances, loading } = useCoins()

  if (!user || !profile) return null

  const trollCoins = balances.troll_coins
  const totalEarned = balances.total_earned_coins
  const savings = balances.earned_balance

  const vip = getVipTier(totalEarned)
  const ogStatus = isOG(profile.created_at || new Date().toISOString())

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-700 px-4 py-3 flex items-center gap-4">
      <div className="flex-1">
        <div className="text-sm text-slate-400">Wallet</div>
        <div className="flex gap-6 mt-1 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-slate-400">Troll Coins:</span>
            <span className="font-semibold text-yellow-300">
              {loading ? '...' : trollCoins.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PiggyBank className="w-4 h-4 text-green-400" />
            <span className="text-slate-400">Savings:</span>
            <span className="font-semibold text-green-300">
              {loading ? '...' : savings.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Lifetime Earned:</span>
            <span className="font-semibold text-cyan-300">
              {loading ? '...' : totalEarned.toLocaleString()}
            </span>
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

      <div className="flex items-center gap-2">
        <button
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold transition-colors flex items-center gap-2"
          onClick={() => navigate('/cashout')}
        >
          <DollarSign className="w-4 h-4" />
          Cash Out
        </button>
        <button
          className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-sm font-semibold transition-colors flex items-center gap-2"
          onClick={() => navigate('/loans')}
        >
          <Landmark className="w-4 h-4" />
          Pay Loan
        </button>
        <button
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-semibold transition-colors"
          onClick={() => navigate('/store')}
        >
          Buy Coins
        </button>
      </div>
    </div>
  )
}

