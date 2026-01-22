// src/pages/TrollBank.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useBank } from '@/lib/hooks/useBank'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { Coins, CreditCard, Landmark, History, AlertCircle, CheckCircle, Lock } from 'lucide-react'

// Interfaces are now handled by useBank hook, but we keep local usage aligned

export default function TrollBank() {
  const { profile } = useAuthStore()
  const { balances, refreshCoins } = useCoins()
  const { loan: activeLoan, ledger, tiers, refresh, applyForLoan } = useBank()
  
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

  const [applying, setApplying] = useState(false)
  const [requestedAmount, setRequestedAmount] = useState(100)
  
  // Eligibility State
  const [eligibility, setEligibility] = useState<{
    canApply: boolean
    reasons: string[]
    maxAmount: number
  }>({ canApply: false, reasons: [], maxAmount: 0 })

  useEffect(() => {
    if (profile?.id) {
      refresh()
    }
  }, [profile?.id, refresh])

  // Re-check eligibility whenever data changes
  useEffect(() => {
    const checkEligibility = (currentLoan: any, currentLedger: any[], bankTiers: any[]) => {
      const reasons: string[] = []
      let canApply = true

      if (currentLoan) {
        reasons.push('You already have an active loan.')
        canApply = false
      }

      // Calculate account age
      const created = new Date(profile?.created_at || Date.now())
      const diffTime = Math.abs(Date.now() - created.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) 

      // Find eligible tier
      const sortedTiers = [...(bankTiers || [])].sort((a, b) => b.min_tenure_days - a.min_tenure_days)
      const eligibleTier = sortedTiers.find(t => diffDays >= t.min_tenure_days)

      if (!eligibleTier) {
        // Fallback if no tiers loaded yet (or 0-day tier missing)
        if (bankTiers.length > 0) {
           reasons.push(`Account too new for any loan tier.`)
           canApply = false
        }
        // If tiers not loaded, we might just wait (canApply defaults false if reasons empty? No, let's allow basic 100 if tiers fail to load?)
        // Better to block until tiers load.
      }

      const maxAmount = eligibleTier ? eligibleTier.max_loan_coins : 0
      
      // Ensure requested amount is within limit
      // We don't block applying here based on amount, but we validate it on submit
      
      setEligibility({ canApply: canApply && maxAmount > 0, reasons, maxAmount })
    }

    checkEligibility(activeLoan, ledger || [], tiers || [])
  }, [activeLoan, ledger, tiers, profile?.created_at])

  const handleApply = async () => {
    if (!eligibility.canApply) return
    if (requestedAmount > eligibility.maxAmount) {
        toast.error(`Maximum loan amount for your tier is ${eligibility.maxAmount} coins.`)
        return
    }
    
    setApplying(true)
    try {
      const { success } = await applyForLoan(requestedAmount)

      if (success) {
        // toast handled by hook
        await refreshCoins()
        setRequestedAmount(100)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply for loan.')
    } finally {
      setApplying(false)
    }
  }


  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl shadow-lg shadow-yellow-900/20">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Troll Bank
            </h1>
            <p className="text-gray-400">Secure Coin Storage & Lending Services</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Balance */}
          <div className="bg-[#13111C] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Coins className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-gray-400 text-sm font-medium mb-1">Available Balance</p>
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
          <div className="bg-[#13111C] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-gray-400 text-sm font-medium mb-1">Bank Reserves</p>
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

          {/* Loan Status */}
          <div className="bg-[#13111C] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-gray-400 text-sm font-medium mb-1">Active Loan</p>
              {activeLoan ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-red-400">{activeLoan.balance.toLocaleString()}</span>
                    <span className="text-sm text-red-400/70">due</span>
                  </div>
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-200">
                      <strong>Auto-Repayment Active:</strong> 50% of all incoming purchased coins will be automatically deducted to repay this loan.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-green-400">None</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">You are debt free!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loan Application / Management */}
        <div className="bg-[#13111C] border border-white/5 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            Loan Services
          </h2>
          
          {activeLoan ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-400">Repayment Information</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    Loans are repaid automatically when you purchase or receive paid coins. 
                    There is no interest if paid within 30 days (currently indefinite).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-white mb-2">Apply for a Loan</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Get coins instantly and pay them back later automatically.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Amount (Coins) - Max: {eligibility.maxAmount}
                      </label>
                      <input 
                        type="number"
                        value={requestedAmount}
                        onChange={(e) => setRequestedAmount(Number(e.target.value))}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        min={100}
                        max={eligibility.maxAmount || 100}
                      />
                    </div>
                    
                    <button
                      onClick={handleApply}
                      disabled={!eligibility.canApply || applying}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                    >
                      {applying ? 'Processing...' : 'Apply for Loan'}
                    </button>
                  </div>
                </div>

                <div className="bg-black/20 rounded-xl p-4">
                  <h3 className="font-semibold text-white mb-3">Eligibility Requirements</h3>
                  <ul className="space-y-2">
                    <Requirement 
                      label="No active loans" 
                      met={!activeLoan} 
                    />
                    <Requirement 
                      label="Account age check" 
                      met={eligibility.maxAmount > 0} 
                      note={`(Limit: ${eligibility.maxAmount})`}
                    />
                    {profile?.credit_score !== undefined && (
                      <li className="flex items-center gap-2 text-sm">
                        <span className="text-cyan-400">Credit Score:</span>
                        <span className="font-semibold">{profile.credit_score}</span>
                      </li>
                    )}
                    {profile?.created_at && (
                      <li className="flex items-center gap-2 text-sm">
                        <span className="text-cyan-400">Account Age:</span>
                        <span className="font-semibold">
                          {Math.ceil(Math.abs(Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                        </span>
                      </li>
                    )}
                    {/* Removed explicit spend check from UI as it's now implicit or removed */}
                  </ul>
                  
                  {eligibility.reasons.length > 0 && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-300 font-semibold mb-1">Why you can't apply:</p>
                      <ul className="list-disc list-inside text-xs text-red-200/80">
                        {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ledger / History */}
        <div className="bg-[#13111C] border border-white/5 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            Recent Transactions
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-white/5">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.bucket === 'repayment' ? 'bg-red-500/20 text-red-300' :
                        entry.bucket === 'loan' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {entry.bucket.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{entry.source}</td>
                    <td className={`py-3 px-4 text-right font-mono font-medium ${
                      entry.amount_delta > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {entry.amount_delta > 0 ? '+' : ''}{entry.amount_delta}
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

function Requirement({ label, met, note }: { label: string, met: boolean, note?: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {met ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-gray-600" />
      )}
      <span className={met ? 'text-gray-200' : 'text-gray-500'}>
        {label} {note && <span className="text-xs opacity-50">{note}</span>}
      </span>
    </li>
  )
}
