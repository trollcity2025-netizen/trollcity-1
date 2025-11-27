import { useEffect, useState } from 'react'

interface ProfitData {
  totalPaidCoins: number
  totalPaidCoinsUSD: string
  totalShopRevenue: number
  totalShopRevenueUSD: string
  totalGiftRevenue: number
  platformGiftShare: number
  platformGiftShareUSD: string
  totalRevenue: number
  totalRevenueUSD: string
  totalLiabilityCoins: number
  totalLiabilityUSD: string
  pendingCashoutUSD: string
  adminPaidCoins: number
  adminFreeCoins: number
  adminTotalCoins: number
  platformSpendableCoins: number
  platformSpendableUSD: string
  platformCutPct: number
}

const ProfitSummary = () => {
  const [summary, setSummary] = useState<ProfitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchProfitSummary = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/profit-summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch profit summary')
      }
      
      const data = await response.json()
      setSummary(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching profit summary:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfitSummary()
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchProfitSummary()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-black/50 p-5 rounded-xl border border-green-400">
        <p className="text-gray-400">Loading profit data...</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-black/50 p-5 rounded-xl border border-red-400">
        <p className="text-red-400">Failed to load profit summary</p>
      </div>
    )
  }

  return (
    <div className="bg-black/50 p-6 rounded-xl border border-green-400 space-y-4">
      <h2 className="text-2xl font-bold text-green-400">💰 Platform Profit Overview</h2>

      {/* Revenue Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Revenue Streams</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">💵 Coin Purchases (Square):</p>
          <p className="text-right font-semibold">{summary.totalPaidCoins.toLocaleString()} coins (${summary.totalPaidCoinsUSD})</p>
          
          <p className="text-gray-300">🛒 Shop Revenue (Insurance/Effects/Perks):</p>
          <p className="text-right font-semibold">{summary.totalShopRevenue.toLocaleString()} coins (${summary.totalShopRevenueUSD})</p>
          
          <p className="text-gray-300">🎁 Platform Share of Gifts ({summary.platformCutPct}%):</p>
          <p className="text-right font-semibold">{summary.platformGiftShare.toLocaleString()} coins (${summary.platformGiftShareUSD})</p>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <p className="text-green-400 font-bold">📊 Total Revenue:</p>
            <p className="text-right text-green-400 font-bold">{summary.totalRevenue.toLocaleString()} coins (${summary.totalRevenueUSD})</p>
          </div>
        </div>
      </div>

      {/* Liabilities Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Liabilities</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">🔻 Broadcaster Earnings (Owed):</p>
          <p className="text-right font-semibold text-red-400">{summary.totalLiabilityCoins.toLocaleString()} coins (${summary.totalLiabilityUSD})</p>
          
          <p className="text-gray-300">🕒 Pending Cashout Requests:</p>
          <p className="text-right font-semibold text-yellow-400">${summary.pendingCashoutUSD}</p>
        </div>
      </div>

      {/* Admin Balance Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-1">Admin Account</h3>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-300">👑 Admin Paid Coins:</p>
          <p className="text-right font-semibold">{summary.adminPaidCoins.toLocaleString()} coins</p>
          
          <p className="text-gray-300">🎫 Admin Free Coins:</p>
          <p className="text-right font-semibold">{summary.adminFreeCoins.toLocaleString()} coins</p>
          
          <p className="text-gray-300 font-semibold">Total Admin Balance:</p>
          <p className="text-right font-bold">{summary.adminTotalCoins.toLocaleString()} coins</p>
        </div>
      </div>

      {/* Net Profit */}
      <div className="pt-3 border-t-2 border-green-500">
        <div className="grid grid-cols-2 gap-2">
          <p className="text-green-400 font-bold text-xl">🟢 Net Spendable Profit:</p>
          <p className="text-right text-green-400 font-bold text-xl">
            {summary.platformSpendableCoins.toLocaleString()} coins
            <br />
            <span className="text-lg">(${summary.platformSpendableUSD})</span>
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          This is real platform profit after subtracting broadcaster liabilities
        </p>
      </div>
    </div>
  )
}

export default ProfitSummary
