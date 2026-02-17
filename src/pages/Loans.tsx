import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'

export default function LoansPage() {
  const { profile } = useAuthStore()
  const { refreshCoins } = useCoins()
  const [loans, setLoans] = useState<any[]>([])
  const [creditCard, setCreditCard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [fromSavings, setFromSavings] = useState(false)

  useEffect(() => {
    const fetchDebts = async () => {
      if (!profile) return
      setLoading(true)

      // Fetch bank loans
      const { data: loansData, error: loansError } = await supabase
        .from('bank_loans')
        .select('*')
        .eq('user_id', profile.id)
        .gt('remaining_amount', 0)
      
      if (loansError) {
        toast.error('Error fetching loans: ' + loansError.message)
      } else {
        setLoans(loansData || [])
      }

      // Fetch credit card debt
      if (profile.credit_used > 0) {
        setCreditCard({
          id: 'credit_card',
          name: 'Credit Card Debt',
          remaining_amount: profile.credit_used,
          due_date: 'N/A'
        })
      } else {
        setCreditCard(null)
      }

      setLoading(false)
    }

    fetchDebts()
  }, [profile])

  const handlePayment = async (loanId: string | null, amount: number) => {
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    let rpcName = ''
    let params: any = {}

    if (loanId === 'credit_card') {
      rpcName = 'pay_credit_card'
      params = { p_amount: amount, p_from_savings: fromSavings }
    } else {
      rpcName = 'pay_bank_loan'
      params = { p_loan_id: loanId, p_amount: amount, p_from_savings: fromSavings }
    }

    const { data: _data, error } = await supabase.rpc(rpcName, params)

    if (error) {
      toast.error('Payment failed: ' + error.message)
    } else {
      toast.success('Payment successful!')
      refreshCoins()
      // Re-fetch debts
      const fetchDebts = async () => {
        if (!profile) return
        setLoading(true)
  
        // Fetch bank loans
        const { data: loansData, error: loansError } = await supabase
          .from('bank_loans')
          .select('*')
          .eq('user_id', profile.id)
          .gt('remaining_amount', 0)
        
        if (loansError) {
          toast.error('Error fetching loans: ' + loansError.message)
        } else {
          setLoans(loansData || [])
        }
  
        // Fetch credit card debt
        if (profile.credit_used > 0) {
          setCreditCard({
            id: 'credit_card',
            name: 'Credit Card Debt',
            remaining_amount: profile.credit_used,
            due_date: 'N/A'
          })
        } else {
          setCreditCard(null)
        }
  
        setLoading(false)
      }
      fetchDebts()
    }
  }

  const allDebts = creditCard ? [...loans, creditCard] : loans

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Pay Off Loans</h1>
      {loading ? (
        <p>Loading debts...</p>
      ) : allDebts.length === 0 ? (
        <p>You have no outstanding debts.</p>
      ) : (
        <div className="space-y-4">
          {allDebts.map((debt) => (
            <div key={debt.id} className="p-4 border rounded-lg">
              <h2 className="text-xl font-semibold">{debt.name || `Loan #${debt.id.substring(0, 8)}`}</h2>
              <p>Remaining: {debt.remaining_amount.toLocaleString()} coins</p>
              <div className="mt-4 flex items-center gap-4">
                <input 
                  type="number" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  placeholder="Amount" 
                  className="px-2 py-1 border rounded"
                />
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={fromSavings} 
                    onChange={(e) => setFromSavings(e.target.checked)} 
                    id={`savings-checkbox-${debt.id}`}
                    className="mr-2"
                  />
                  <label htmlFor={`savings-checkbox-${debt.id}`}>Pay from Savings</label>
                </div>
                <button 
                  onClick={() => handlePayment(debt.id, parseInt(paymentAmount))} 
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Pay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
