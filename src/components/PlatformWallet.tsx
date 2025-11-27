import { useEffect, useState } from 'react'

interface WalletData {
  coinPurchases: {
    coins: number
    usd: string
  }
  shopRevenue: {
    coins: number
    usd: string
  }
  giftRevenue: {
    totalGiftCoins: number
    platformShare: number
    platformShareUSD: string
    platformCutPercent: number
  }
  totalRevenue: {
    usd: string
  }
  broadcasterEarnings: {
    totalCoins: number
    totalUSD: string
  }
  cashouts: {
    paidUSD: string
    pendingUSD: string
    remainingLiabilityUSD: string
  }
  officerCommissions: {
    coins: number
    usd: string
  }
  adminBalance: {
    paidCoins: number
    freeCoins: number
    totalCoins: number
    valueUSD: string
  }
  netSpendableProfit: {
    usd: string
    breakdown: string
  }
}

const PlatformWallet = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchWallet = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/platform-wallet`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch platform wallet')
      }
      
      const data = await response.json()
      setWallet(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Platform wallet error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallet()
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchWallet()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-black/50 p-5 rounded-xl border border-green-500">
        <p className="text-gray-400">Loading platform wallet...</p>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="bg-black/50 p-5 rounded-xl border border-red-500">
        <p className="text-red-400">Failed to load platform wallet</p>
      </div>
    )
  }

  return (
    <div className="bg-black/50 p-6 rounded-xl border border-green-500 space-y-4">
      <h2 className="text-2xl font-bold text-green-400">💰 Platform Wallet</h2>

      {/* Revenue Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Revenue Sources</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">💵 Coin Purchases:</p>
          <p className="text-right font-semibold">{wallet.coinPurchases.coins.toLocaleString()} coins (${wallet.coinPurchases.usd})</p>
          
          <p className="text-gray-300">🛒 Shop Revenue:</p>
          <p className="text-right font-semibold">{wallet.shopRevenue.coins.toLocaleString()} coins (${wallet.shopRevenue.usd})</p>
          
          <p className="text-gray-300">🎁 Gift Platform Share ({wallet.giftRevenue.platformCutPercent}%):</p>
          <p className="text-right font-semibold">{wallet.giftRevenue.platformShare.toLocaleString()} coins (${wallet.giftRevenue.platformShareUSD})</p>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <p className="text-green-400 font-bold">📊 Total Revenue:</p>
            <p className="text-right text-green-400 font-bold text-lg">${wallet.totalRevenue.usd}</p>
          </div>
        </div>
      </div>

      {/* Liabilities Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Liabilities & Costs</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">🔻 Broadcaster Earnings (Total Owed):</p>
          <p className="text-right font-semibold text-orange-400">{wallet.broadcasterEarnings.totalCoins.toLocaleString()} coins (${wallet.broadcasterEarnings.totalUSD})</p>
          
          <p className="text-gray-300">✅ Already Paid Out:</p>
          <p className="text-right font-semibold text-gray-400">${wallet.cashouts.paidUSD}</p>
          
          <p className="text-gray-300">🕒 Pending Cashouts:</p>
          <p className="text-right font-semibold text-yellow-400">${wallet.cashouts.pendingUSD}</p>
          
          <p className="text-gray-300">💼 Officer Commissions:</p>
          <p className="text-right font-semibold text-blue-400">{wallet.officerCommissions.coins.toLocaleString()} coins (${wallet.officerCommissions.usd})</p>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <p className="text-red-400 font-bold">⚠️ Remaining Liability:</p>
            <p className="text-right text-red-400 font-bold">${wallet.cashouts.remainingLiabilityUSD}</p>
          </div>
        </div>
      </div>

      {/* Admin Balance Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Admin Account</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">👑 Paid Coins:</p>
          <p className="text-right font-semibold">{wallet.adminBalance.paidCoins.toLocaleString()} coins</p>
          
          <p className="text-gray-300">🎫 Free Coins:</p>
          <p className="text-right font-semibold">{wallet.adminBalance.freeCoins.toLocaleString()} coins</p>
          
          <p className="text-gray-300 font-semibold">Total Value:</p>
          <p className="text-right font-bold">${wallet.adminBalance.valueUSD}</p>
        </div>
      </div>

      {/* Net Spendable Profit */}
      <div className="pt-3 border-t-2 border-green-500">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <p className="text-green-400 font-bold text-xl">🟢 Net Spendable Profit:</p>
          <p className="text-right text-green-400 font-bold text-2xl">
            ${wallet.netSpendableProfit.usd}
          </p>
        </div>
        <p className="text-xs text-gray-400 text-center">
          {wallet.netSpendableProfit.breakdown}
        </p>
      </div>
    </div>
  )
}

export default PlatformWallet
