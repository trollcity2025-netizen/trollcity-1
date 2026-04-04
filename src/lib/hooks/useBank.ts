import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { post, API_ENDPOINTS } from '../api'
import { useAuthStore } from '../store'
import { toast } from 'sonner'

export function useBank() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [loans, setLoans] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [tiers, setTiers] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])

  // Credit Card Info derived from profile
  const creditInfo = {
    limit: profile?.credit_limit || 0,
    used: profile?.credit_used || 0,
    apr: profile?.credit_apr_fee_percent || 8,
    status: profile?.credit_status || 'active',
    available: (profile?.credit_limit || 0) - (profile?.credit_used || 0)
  }

  const fetchBankData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Fetch all active loans (Legacy)
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setLoans(activeLoans || [])

      // Fetch ledger (recent 50) - explicitly select columns to avoid JSON coercion issues
      const { data: ledgers } = await supabase
        .from('coin_ledger')
        .select('id, user_id, delta, bucket, source, reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setLedger(ledgers || [])

      // Fetch applications
      const { data: apps } = await supabase
        .from('loan_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setApplications(apps || [])
      
      // Fetch tiers
      const { data: tierData } = await supabase
        .from('bank_tiers')
        .select('*')
        .order('min_tenure_days', { ascending: true })
      setTiers(tierData || [])

    } catch (error) {
      console.error('Error fetching bank data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchBankData()
  }, [fetchBankData])

  const applyForLoan = async (amount: number) => {
    if (!user) return { success: false, error: 'User not logged in' }
    setLoading(true)
    try {
        const response = await post(API_ENDPOINTS.bank.apply, { amount })

        if (response.error) throw new Error(response.error)
        if (response.success === false) throw new Error(response.message || response.reason || 'Application failed')

        toast.success('Loan approved and disbursed!')
        fetchBankData()
        return { success: true }
    } catch (error: any) {
        toast.error(error.message || 'Failed to apply for loan')
        return { success: false, error: error.message || 'Failed to apply for loan' }
    } finally {
        setLoading(false)
    }
  }

  const payLoan = async (loanId: string, amount: number) => {
    if (!user) return { success: false, error: 'User not logged in' }
    setLoading(true)
    try {
        const { data, error } = await supabase.rpc('pay_bank_loan', {
            p_loan_id: loanId,
            p_amount: amount
        })

        if (error) throw error
        if (data && data.success === false) throw new Error(data.error || 'Payment failed')

        toast.success('Loan payment successful!')
        fetchBankData()
        return { success: true, data }
    } catch (error: any) {
        console.error('Payment error:', error)
        toast.error(error.message || 'Payment failed')
        return { success: false, error: error.message }
    } finally {
        setLoading(false)
    }
  }

  // New Credit Card Methods
  const payCreditCard = async (amount: number) => {
    if (!user) return { success: false, error: 'User not logged in' }
    setLoading(true)
    try {
        console.log('[payCreditCard] Calling pay_credit_card RPC with amount:', amount)
        const { data, error } = await supabase.rpc('pay_credit_card', {
            p_amount: amount
        })

        if (error) {
          console.error('[payCreditCard] RPC error:', error)
          throw error
        }
        if (data && data.success === false) {
          console.error('[payCreditCard] Payment failed:', data)
          throw new Error(data.message || 'Payment failed')
        }

        console.log('[payCreditCard] Payment successful, response:', data)
        toast.success(`Paid ${amount.toLocaleString()} coins towards credit card!`)
        
        // Force refresh profile to update credit_score in the UI
        // Bypass debounce to ensure immediate update
        console.log('[payCreditCard] Forcing profile refresh...')
        await refreshProfile(true)
        console.log('[payCreditCard] Profile refresh complete')
        
        fetchBankData() // Update ledger
        return { success: true, data }
    } catch (error: any) {
        console.error('Credit Payment error:', error)
        toast.error(error.message || 'Payment failed')
        return { success: false, error: error.message }
    } finally {
        setLoading(false)
    }
  }

  return {
    loans,
    ledger,
    tiers,
    applications,
    loading,
    creditInfo, // Expose new credit info
    fetchBankData,
    applyForLoan,
    payLoan,
    payCreditCard
  }
}
