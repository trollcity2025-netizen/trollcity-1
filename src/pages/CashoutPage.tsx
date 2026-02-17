import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'

export default function CashoutPage() {
  const { balances, refreshCoins } = useCoins()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCashout = async () => {
    const cashoutAmount = parseInt(amount, 10)
    if (isNaN(cashoutAmount) || cashoutAmount <= 0) {
      toast.error('Please enter a valid amount to cash out.')
      return
    }

    if (cashoutAmount > balances.earned_balance) {
      toast.error("You don't have enough savings to cash out this amount.")
      return
    }

    setLoading(true)
    toast.info('Processing your cash out request...')

    // In a real application, this would trigger a backend process
    // to handle the actual financial transaction.
    // For this simulation, we'll just create a record of the request
    // and deduct the amount from the user's savings.

    const { error } = await supabase.rpc('request_cash_out', {
      p_amount: cashoutAmount,
    })

    setLoading(false)

    if (error) {
      toast.error(`Cash out failed: ${error.message}`)
    } else {
      toast.success(`Successfully requested cash out of ${cashoutAmount.toLocaleString()} coins.`)
      refreshCoins()
      setAmount('')
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Cash Out Savings</h1>
        <p className="text-slate-400 mb-6">
          You can cash out your savings here. Requests will be processed within 3-5 business days.
        </p>

        <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Available Savings Balance</span>
            <span className="text-2xl font-semibold text-green-400">
              {balances.earned_balance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="cashout-amount" className="block text-sm font-medium text-slate-300 mb-2">
              Amount to Cash Out
            </label>
            <div className="relative">
              <input
                type="number"
                id="cashout-amount"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            onClick={handleCashout}
            disabled={loading || !amount}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg"
          >
            {loading ? 'Processing...' : 'Request Cash Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
