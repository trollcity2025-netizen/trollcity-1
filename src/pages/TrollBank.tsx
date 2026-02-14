// src/pages/TrollBank.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useBank } from '@/lib/hooks/useBank'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { Coins, CreditCard, Landmark, History, AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { trollCityTheme } from '@/styles/trollCityTheme'

export default function TrollBank() {
  const { balances, refreshCoins } = useCoins()
  const { loans, ledger, payLoan, payCreditCard, creditInfo } = useBank()
  const activeLoan = loans && loans.length > 0 ? loans[0] : null
  
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  
  // Fetch and Subscribe to Bank Reserves
  useEffect(() => {
    const fetchReserves = async () => {
      try {
        const { data, error } = await supabase.rpc('get_bank_reserves')
        if (error) throw error
        setBankBalance(data)
      } catch (err) {
        console.error('Failed to fetch bank reserves:', err)
      }
    }

    fetchReserves()

    // Subscribe to ledger changes to update reserves instantly
    const channel = supabase
      .channel('bank_reserves_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coin_ledger' },
        () => fetchReserves()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const [payAmount, setPayAmount] = useState<string>('')
  const [paying, setPaying] = useState(false)
  
  // Legacy Loan Payment
  const [legacyPayAmount, setLegacyPayAmount] = useState<string>('')
  const [legacyPaying, setLegacyPaying] = useState(false)

  const handlePayCredit = async () => {
    if (!payAmount) return
    const amount = parseInt(payAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }
    
    setPaying(true)
    const result = await payCreditCard(amount)
    setPaying(false)
    
    if (result.success) {
      setPayAmount('')
      refreshCoins() 
    }
  }

  const handlePayLegacyLoan = async () => {
    if (!activeLoan || !legacyPayAmount) return
    const amount = parseInt(legacyPayAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }
    
    setLegacyPaying(true)
    const result = await payLoan(activeLoan.id, amount)
    setLegacyPaying(false)
    
    if (result.success) {
      setLegacyPayAmount('')
      refreshCoins()
    }
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6 pb-24`}>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl shadow-lg shadow-yellow-900/20">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl font-bold ${trollCityTheme.text.heading}`}>
              Troll Bank
            </h1>
            <p className={trollCityTheme.text.secondary}>Secure Coin Storage & Credit Services</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Balance */}
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Coins className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${trollCityTheme.text.secondary} text-sm font-medium mb-1`}>Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-yellow-400">{balances.troll_coins.toLocaleString()}</span>
                <span className="text-sm text-yellow-400/70">coins</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <Lock className="w-3 h-3" />
                <span>Protected by Troll Bank Security</span>
              </div>
            </div>
          </div>

          {/* Bank Reserves */}
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${trollCityTheme.text.secondary} text-sm font-medium mb-1`}>Bank Reserves</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-emerald-400">
                  {bankBalance !== null ? bankBalance.toLocaleString() : '---'}
                </span>
                <span className="text-sm text-emerald-400/70">coins</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3" />
                <span>Verified Bank Holdings</span>
              </div>
            </div>
          </div>

          {/* Credit Card Status */}
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${trollCityTheme.text.secondary} text-sm font-medium mb-1`}>Credit Card Debt</p>
              {creditInfo.used > 0 ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-red-400">{creditInfo.used.toLocaleString()}</span>
                    <span className="text-sm text-red-400/70">due</span>
                  </div>
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-200">
                      <strong>Warning:</strong> You cannot request cashouts while you have outstanding credit debt.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-green-400">None</span>
                  </div>
                  <p className={`mt-2 text-sm ${trollCityTheme.text.secondary}`}>You are debt free!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credit Card Management */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            Credit Card Management
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                 <p className="text-sm text-purple-300 mb-1">Total Credit Limit</p>
                 <p className="text-2xl font-bold text-white">{creditInfo.limit.toLocaleString()}</p>
             </div>
             <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                 <p className="text-sm text-blue-300 mb-1">Available to Spend</p>
                 <p className="text-2xl font-bold text-white">{creditInfo.available.toLocaleString()}</p>
             </div>
          </div>
          
          {creditInfo.used > 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <h3 className="font-semibold text-emerald-400 mb-2">Pay Credit Card Bill</h3>
                <p className={`text-sm ${trollCityTheme.text.secondary} mb-4`}>
                   Pay down your balance to unlock cashouts and restore your spending limit.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount to pay"
                    className={`${trollCityTheme.components.input} flex-1`}
                  />
                  <button
                    onClick={handlePayCredit}
                    disabled={paying || !payAmount}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {paying ? 'Paying...' : 'Pay Bill'}
                  </button>
                  <button
                    onClick={() => setPayAmount(creditInfo.used.toString())}
                    className={`${trollCityTheme.buttons.secondary} px-3 py-2 rounded-lg font-medium transition-colors`}
                  >
                    Full Balance
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl">
             <h3 className="text-sm font-semibold text-gray-300 mb-2">Credit Card Terms</h3>
             <ul className="text-sm text-gray-400 space-y-1 list-disc pl-4">
                 <li><strong>Usage:</strong> Valid for Coin Store items and KT Auto vehicles.</li>
                 <li><strong>Restrictions:</strong> Cannot be used for P2P transfers, gifts, or rent.</li>
                 <li><strong>Fees:</strong> Flat 8% finance fee added to every transaction.</li>
                 <li><strong>Cashouts:</strong> Blocked until debt is fully paid.</li>
             </ul>
          </div>
        </div>

        {/* Legacy Loan Section (Only visible if active) */}
        {activeLoan && (
            <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 border-red-500/30`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                Legacy Loan (Outstanding)
            </h2>
            <p className="text-sm text-gray-400 mb-4">You have an outstanding loan from the old system. Please pay this off.</p>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-red-300">Amount Due</span>
                    <span className="text-xl font-bold text-red-400">{activeLoan.balance.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={legacyPayAmount}
                    onChange={(e) => setLegacyPayAmount(e.target.value)}
                    placeholder="Amount to pay"
                    className={`${trollCityTheme.components.input} flex-1`}
                  />
                  <button
                    onClick={handlePayLegacyLoan}
                    disabled={legacyPaying || !legacyPayAmount}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {legacyPaying ? 'Paying...' : 'Pay Legacy Loan'}
                  </button>
                </div>
            </div>
            </div>
        )}

        {/* Ledger */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6`}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h2>
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div 
                key={entry.id} 
                className={`flex justify-between items-center p-3 rounded-lg ${trollCityTheme.backgrounds.input} border border-white/5`}
              >
                <div>
                  <p className="font-medium text-white">{entry.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`font-bold ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}
                </div>
              </div>
            ))}
            {ledger.length === 0 && (
              <p className="text-center text-gray-500 py-4">No recent activity</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
