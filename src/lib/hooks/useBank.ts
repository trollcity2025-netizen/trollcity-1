import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { post, API_ENDPOINTS } from '../api'
import { useAuthStore } from '../store'
import { toast } from 'sonner'

export function useBank() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [loans, setLoans] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [tiers, setTiers] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])

  const fetchBankData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Fetch all active loans
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setLoans(activeLoans || [])

      // Fetch ledger (recent 50)
      const { data: ledgers } = await supabase
        .from('coin_ledger')
        .select('*')
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

  return {
    loading,
    loans,
    ledger,
    tiers,
    applications,
    applyForLoan,
    refresh: fetchBankData
  }
}
