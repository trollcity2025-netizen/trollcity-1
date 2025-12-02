import React, { useState, useEffect } from 'react'
import { supabase, isAdminEmail } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { getLevelConfig, formatOWC, convertOWCToPaidCoins } from '../lib/officerOWC'
import { Coins, TrendingUp, Clock, ArrowRight, RefreshCw } from 'lucide-react'

interface OWCTransaction {
  id: string
  amount: number
  transaction_type: string
  source: string
  conversion_rate: number | null
  paid_coins_received: number | null
  created_at: string
}

export default function OfficerOWCDashboard() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [owcBalance, setOwcBalance] = useState<number>(0)
  const [totalOWCEarned, setTotalOWCEarned] = useState<number>(0)
  const [converting, setConverting] = useState(false)
  const [convertAmount, setConvertAmount] = useState<string>('')
  const [transactions, setTransactions] = useState<OWCTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const officerLevel = profile?.officer_level || 1
  const levelConfig = getLevelConfig(officerLevel)

  const isAdmin = profile?.is_admin || profile?.role === 'admin' || (user?.email && isAdminEmail(user.email))
  const isOfficer = profile?.is_troll_officer || profile?.role === 'troll_officer'
  
  useEffect(() => {
    if (!user || (!isOfficer && !isAdmin)) return
    loadOWCData()
  }, [user, profile, isOfficer, isAdmin])

  const loadOWCData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Get OWC balance from profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('owc_balance, total_owc_earned')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      setOwcBalance(profileData?.owc_balance || 0)
      setTotalOWCEarned(profileData?.total_owc_earned || 0)

      // Load transactions
      const { data: txData, error: txError } = await supabase
        .from('owc_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (txError) throw txError
      setTransactions((txData as any) || [])
    } catch (error: any) {
      console.error('Error loading OWC data:', error)
      toast.error('Failed to load OWC data')
    } finally {
      setLoading(false)
    }
  }

  const handleConvert = async () => {
    if (!user || !convertAmount) return

    const amount = parseInt(convertAmount.replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) {
      toast.error('Enter a valid OWC amount')
      return
    }

    if (amount > owcBalance) {
      toast.error('Insufficient OWC balance')
      return
    }

    setConverting(true)
    try {
      const { data, error } = await supabase.rpc('convert_owc_to_paid', {
        p_user_id: user.id,
        p_owc_amount: amount
      })

      if (error) throw error

      const result = data as any
      if (!result.success) {
        toast.error(result.error || 'Conversion failed')
        return
      }

      toast.success(
        `Converted ${formatOWC(amount)} to ${result.total_paid_coins.toLocaleString()} paid coins! ` +
        `(${result.base_paid_coins.toLocaleString()} base + ${result.bonus_coins.toLocaleString()} bonus)`
      )

      setConvertAmount('')
      await loadOWCData()
      if (refreshProfile) await refreshProfile()
    } catch (error: any) {
      console.error('Error converting OWC:', error)
      toast.error('Failed to convert OWC')
    } finally {
      setConverting(false)
    }
  }

  const estimatedPaidCoins = convertOWCToPaidCoins(parseInt(convertAmount.replace(/[^\d]/g, '')) || 0, officerLevel)
  
  if (!user || (!isOfficer && !isAdmin)) {
    return (
      <div className="p-6 text-center text-white">
        Officer access only.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Officer Work Credit (OWC) Dashboard</h1>
        <p className="text-gray-400">Manage your OWC earnings and conversions</p>
      </div>

      {/* Level Info Card */}
      <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">{levelConfig.title}</h2>
            <div className="space-y-1 text-sm text-gray-300">
              <p>OWC per Hour: <span className="font-semibold text-purple-400">{formatOWC(levelConfig.owcPerHour)}</span></p>
              <p>Conversion Rate: <span className="font-semibold text-purple-400">{(levelConfig.conversionRate * 100).toFixed(1)}%</span></p>
              <p>Final Paid Coins/hr: <span className="font-semibold text-green-400">{levelConfig.finalPaidCoinsPerHour.toLocaleString()}</span> (with 10% bonus)</p>
            </div>
          </div>
          <div className="text-6xl">{levelConfig.badgeEmoji}</div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-black/60 border border-purple-600/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-400">Current OWC Balance</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{formatOWC(owcBalance)}</div>
        </div>

        <div className="bg-black/60 border border-blue-600/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">Total OWC Earned</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{formatOWC(totalOWCEarned)}</div>
        </div>

        <div className="bg-black/60 border border-green-600/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400">Estimated Value</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {convertOWCToPaidCoins(owcBalance, officerLevel).toLocaleString()} paid coins
          </div>
        </div>
      </div>

      {/* Conversion Section */}
      <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Convert OWC to Paid Coins</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">OWC Amount to Convert</label>
            <input
              type="text"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Enter OWC amount"
              className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
            />
            {convertAmount && (
              <p className="text-sm text-gray-400 mt-2">
                Will convert to approximately <span className="font-semibold text-green-400">
                  {estimatedPaidCoins.toLocaleString()} paid coins
                </span> (with 10% bonus)
              </p>
            )}
          </div>
          <button
            onClick={handleConvert}
            disabled={converting || !convertAmount || parseInt(convertAmount.replace(/[^\d]/g, '')) <= 0}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {converting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                Convert to Paid Coins
              </>
            )}
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-gray-800"
              >
                <div>
                  <div className="font-semibold">
                    {tx.transaction_type === 'earned' && '➕ Earned'}
                    {tx.transaction_type === 'converted' && '🔄 Converted'}
                    {tx.transaction_type === 'bonus' && '🎁 Bonus'}
                    {tx.transaction_type === 'deducted' && '➖ Deducted'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {tx.source} • {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{formatOWC(Math.abs(tx.amount))}
                  </div>
                  {tx.paid_coins_received && (
                    <div className="text-sm text-purple-400">
                      → {tx.paid_coins_received.toLocaleString()} paid coins
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

