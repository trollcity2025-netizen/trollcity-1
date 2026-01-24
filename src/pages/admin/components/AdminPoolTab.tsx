import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { PieChart, Users, Wallet, Lock, Search, AlertCircle, CheckCircle, XCircle, RefreshCw, ArrowRightLeft, DollarSign, Settings, Save, Gift, Building, Plus, Trash, ChevronUp, ChevronDown } from 'lucide-react'

const ADMIN_POOL_COINS_PER_DOLLAR = 222.3

type AdminPoolTransaction = {
  id: string
  transaction_id: string
  user_id: string
  cashout_amount: number
  admin_fee: number
  admin_profit: number
  transaction_type: string
  created_at: string
  source_details: any
}

type GiftTransaction = {
  id: string
  direction: 'sent' | 'received'
  amount: number
  other_username: string
  gift_name: string
  created_at: string
}

type UserLite = {
  id: string
  username: string
  role?: string
  is_troll_officer?: boolean
}

type WalletRow = {
  user_id: string
  username: string
  total_coins: number
  escrowed_coins: number
  available_coins: number
  is_cashout_eligible: boolean
}

type AllocationBucket = {
  id: string
  bucket_name: string
  balance_coins: number
  target_coins: number
  updated_at: string
}

type CashoutRequest = {
  id: string
  user_id: string
  requested_coins: number
  usd_value: number
  payout_method: string
  payout_details: string
  status: 'pending' | 'paid' | 'denied' | 'cancelled'
  created_at: string
  escrowed_coins: number
  user?: UserLite
}

type AdminPoolLedger = {
  id: string
  amount: number
  reason: string
  ref_user_id: string
  created_at: string
}

export default function AdminPoolTab() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'transactions' | 'wallets' | 'allocations' | 'cashouts' | 'secretary_approvals' | 'properties' | 'settings'>('allocations')
  const [transactions, setTransactions] = useState<AdminPoolTransaction[]>([])
  const [users, setUsers] = useState<Record<string, UserLite>>({})
  const [loading, setLoading] = useState(false)
  const [poolCoins, setPoolCoins] = useState<number | null>(null)

  // Properties State
  const [properties, setProperties] = useState<any[]>([])
  const [propertyFees, setPropertyFees] = useState<AdminPoolLedger[]>([])
  const [loadingProps, setLoadingProps] = useState(false)

  // Wallet State
  const [walletRows, setWalletRows] = useState<WalletRow[]>([])
  const [walletLoading, setWalletLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [giftHistoryModalOpen, setGiftHistoryModalOpen] = useState(false)
  const [giftHistory, setGiftHistory] = useState<GiftTransaction[]>([])
  const [giftHistoryLoading, setGiftHistoryLoading] = useState(false)
  const [currentGiftUser, setCurrentGiftUser] = useState<{id: string, username: string} | null>(null)

  // Allocation State
  const [buckets, setBuckets] = useState<AllocationBucket[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [officers, setOfficers] = useState<UserLite[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminPoolLedger[]>([])
  const [allocationLoading, setAllocationLoading] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveSource, setMoveSource] = useState('Treasury')
  const [moveTarget, setMoveTarget] = useState('Officer Pay')
  const [moveAmount, setMoveAmount] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderCost, setNewProviderCost] = useState('')

  // Cashout State
  const [cashoutRequests, setCashoutRequests] = useState<CashoutRequest[]>([])
  const [cashoutLoading, setCashoutLoading] = useState(false)

  // Helper to format currency
  const formatUSD = (coins: number) => {
    const rate = parseFloat(settings['coin_usd_rate'] || '0.0045')
    return `$${(coins * rate).toFixed(2)}`
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        // Load Admin Pool Transactions
        const { data, error } = await supabase
          .from('admin_pool_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (error && error.code !== 'PGRST116') throw error
        const rows = (data || []) as AdminPoolTransaction[]
        setTransactions(rows)

        const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))
        if (ids.length) {
          const { data: profiles, error: pErr } = await supabase
            .from('user_profiles')
            .select('id, username')
            .in('id', ids)
          if (pErr) throw pErr
          const map: Record<string, UserLite> = {}
          ;(profiles || []).forEach((u: any) => { map[u.id] = { id: u.id, username: u.username } })
          setUsers(map)
        }

        // Load Admin Pool Balance
        const { data: poolRow, error: poolError } = await supabase
          .from('admin_pool')
          .select('trollcoins_balance')
          .maybeSingle()
        if (poolError && (poolError as any).code !== 'PGRST116') throw poolError
        if (poolRow && typeof (poolRow as any).trollcoins_balance !== 'undefined') {
          setPoolCoins(Number((poolRow as any).trollcoins_balance || 0))
        } else {
          setPoolCoins(null)
        }
      } catch (err: any) {
        console.error('Failed to load admin pool:', err)
        toast.error('Failed to load admin pool')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  // Load Allocations & Settings (Global for USD rate)
  useEffect(() => {
    const loadSettings = async () => {
      const { data: settingData } = await supabase.from('admin_app_settings').select('*')
      const settingsMap: Record<string, any> = {}
      settingData?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value
      })
      setSettings(settingsMap)
    }
    loadSettings()

    if (activeTab === 'allocations') {
      const loadAllocations = async () => {
        try {
          setAllocationLoading(true)
          
          // Load Buckets
          const { data: bucketData, error: bucketError } = await supabase
            .from('admin_allocation_buckets')
            .select('*')
            .order('bucket_name')
          
          if (bucketError) throw bucketError
          setBuckets(bucketData || [])

          // Load Officers
          const { data: officerData, error: officerError } = await supabase
            .from('user_profiles')
            .select('id, username, role, is_troll_officer')
            .or('role.eq.troll_officer,is_troll_officer.eq.true')
          
          if (officerError) throw officerError
          setOfficers(officerData || [])

          // Load Audit Logs
          const { data: logData } = await supabase
            .from('admin_pool_ledger')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
          setAuditLogs((logData || []) as AdminPoolLedger[])

        } catch (err: any) {
          console.error('Failed to load allocations:', err)
        } finally {
          setAllocationLoading(false)
        }
      }
      loadAllocations()
    }
  }, [activeTab])

  // Load Wallets
  useEffect(() => {
    if (activeTab === 'wallets') {
      const loadWallets = async () => {
        try {
          setWalletLoading(true)
          const { data, error } = await supabase.rpc('get_admin_user_wallets_secure', {
            p_search: searchTerm || null,
            p_limit: 100
          })
          
          if (error) throw error
          setWalletRows(data || [])
        } catch (err: any) {
          console.error('Failed to load wallets:', err)
          toast.error('Failed to load user wallets')
        } finally {
          setWalletLoading(false)
        }
      }
      
      const timer = setTimeout(() => {
        loadWallets()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [activeTab, searchTerm])

  // Load Cashouts
  useEffect(() => {
    if (activeTab === 'cashouts') {
      const loadCashouts = async () => {
        try {
          setCashoutLoading(true)
          const { data, error } = await supabase
            .from('cashout_requests')
            .select(`
              *,
              user:user_id (id, username)
            `)
            .order('created_at', { ascending: false })
          
          if (error) throw error
          setCashoutRequests(data || [])
        } catch (err: any) {
          console.error(err)
          toast.error('Failed to load cashout requests')
        } finally {
          setCashoutLoading(false)
        }
      }
      loadCashouts()
    }
  }, [activeTab])

  // Load Properties & Fees
  useEffect(() => {
    if (activeTab === 'properties') {
      const loadProperties = async () => {
        try {
          setLoadingProps(true)
          // Get all admin IDs first
          const { data: admins } = await supabase
            .from('user_profiles')
            .select('id')
            .or('role.eq.admin,is_admin.eq.true')
          
          if (!admins || admins.length === 0) return

          const adminIds = admins.map(a => a.id)
          const { data: props, error } = await supabase
            .from('properties')
            .select('*')
            .in('owner_user_id', adminIds)
            .order('updated_at', { ascending: false })

          if (error) throw error
          setProperties(props || [])

          // Load Property Fees from Ledger
          const { data: fees, error: feesError } = await supabase
            .from('admin_pool_ledger')
            .select('*')
            .ilike('reason', '%Property Sale%')
            .order('created_at', { ascending: false })
            .limit(50)
          
          if (feesError) throw feesError
          setPropertyFees(fees || [])

        } catch (err) {
          console.error('Failed to load properties', err)
          toast.error('Failed to load properties')
        } finally {
          setLoadingProps(false)
        }
      }
      loadProperties()
    }
  }, [activeTab])

  const handleAddProvider = async () => {
    if (!newProviderName || !newProviderCost) return toast.error('Please fill all fields')
    
    try {
      const currentCosts = settings['provider_costs'] || {}
      const updatedCosts = {
        ...currentCosts,
        [newProviderName]: parseInt(newProviderCost.replace(/,/g, ''))
      }
      
      const { error } = await supabase
        .from('admin_app_settings')
        .upsert({ 
          setting_key: 'provider_costs', 
          setting_value: updatedCosts,
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      setSettings(prev => ({ ...prev, provider_costs: updatedCosts }))
      setNewProviderName('')
      setNewProviderCost('')
      toast.success('Provider added successfully')
    } catch (err: any) {
      console.error('Failed to add provider:', err)
      toast.error('Failed to add provider')
    }
  }

  const handleRemoveProvider = async (name: string) => {
    try {
      const currentCosts = { ...settings['provider_costs'] }
      delete currentCosts[name]
      
      const { error } = await supabase
        .from('admin_app_settings')
        .upsert({ 
          setting_key: 'provider_costs', 
          setting_value: currentCosts,
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      setSettings(prev => ({ ...prev, provider_costs: currentCosts }))
      toast.success('Provider removed successfully')
    } catch (err: any) {
      console.error('Failed to remove provider:', err)
      toast.error('Failed to remove provider')
    }
  }

  const handleMoveCoins = async () => {
    try {
      if (!moveAmount || !moveReason) return toast.error('Please fill all fields')
      
      const { error } = await supabase.rpc('admin_move_allocations', {
        p_from_bucket: moveSource,
        p_to_bucket: moveTarget,
        p_amount: parseInt(moveAmount.replace(/,/g, '')),
        p_reason: moveReason,
        p_admin_id: user?.id
      })
      
      if (error) throw error
      
      toast.success('Coins moved successfully')
      setMoveModalOpen(false)
      setMoveAmount('')
      setMoveReason('')
      
      // Reload Buckets
      const { data } = await supabase
        .from('admin_allocation_buckets')
        .select('*')
        .order('bucket_name')
      if (data) setBuckets(data)
      
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to move coins')
    }
  }

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('admin_app_settings')
        .upsert({ 
          setting_key: key, 
          setting_value: value,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      
      setSettings(prev => ({ ...prev, [key]: value }))
      toast.success('Setting updated')
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to update setting')
    }
  }

  const handleViewGifts = async (userId: string, username: string) => {
    setCurrentGiftUser({ id: userId, username })
    setGiftHistoryModalOpen(true)
    setGiftHistoryLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_user_gift_history', {
        p_user_id: userId,
        p_limit: 50
      })
      if (error) throw error
      setGiftHistory(data || [])
    } catch (err: any) {
      console.error('Failed to load gift history:', err)
      toast.error('Failed to load gift history')
    } finally {
      setGiftHistoryLoading(false)
    }
  }

  const handleMarkOfficerPaid = async (officerId: string) => {
    try {
      if (!confirm('Mark this officer as PAID? Coins will be deducted from Officer Pay bucket and credited to the officer.')) return

      const { error } = await supabase.rpc('troll_bank_pay_officer', {
        p_officer_id: officerId,
        p_admin_id: user?.id
      })

      if (error) throw error
      toast.success('Officer marked as PAID')

      // Reload Buckets & Logs
      const { data: bucketData } = await supabase.from('admin_pool_buckets').select('*').order('bucket_name')
      if (bucketData) setBuckets(bucketData)
      
      const { data: logData } = await supabase.from('admin_pool_ledger').select('*').order('created_at', { ascending: false }).limit(50)
      if (logData) setAuditLogs(logData as AdminPoolLedger[])

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to pay officer')
    }
  }

  const handleApproveCashout = async (reqId: string) => {
    try {
      if (!confirm('Are you sure you want to mark this request as PAID? Coins will be permanently burned from escrow.')) return
      
      const { error } = await supabase.rpc('troll_bank_finalize_cashout', {
        p_request_id: reqId,
        p_admin_id: user?.id
      })
      
      if (error) throw error
      toast.success('Cashout marked as PAID')
      
      // Reload
      const { data } = await supabase.from('cashout_requests').select('*, user:user_id(id, username)').order('created_at', { ascending: false })
      if (data) setCashoutRequests(data)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to approve cashout')
    }
  }

  const handleDenyCashout = async (reqId: string) => {
    try {
      const reason = prompt('Enter reason for denial:')
      if (reason === null) return
      
      const { error } = await supabase.rpc('troll_bank_deny_cashout', {
        p_request_id: reqId,
        p_admin_id: user?.id,
        p_reason: reason
      })
      
      if (error) throw error
      toast.success('Cashout DENIED and coins returned')
      
      // Reload
      refreshCashouts(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to deny cashout')
    }
  }

  const { rows, totalProfit, totalFees } = useMemo(() => {
    let profit = 0
    let fees = 0
    const processed = transactions.map(t => {
      profit += Number(t.admin_profit || 0)
      fees += Number(t.admin_fee || 0)
      return {
        ...t,
        username: users[t.user_id]?.username || t.user_id || 'Unknown',
        date: new Date(t.created_at).toLocaleString(),
      }
    })
    return { rows: processed, totalProfit: profit, totalFees: fees }
  }, [transactions, users])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <PieChart className="w-6 h-6 text-troll-green" />
              Admin Pool
            </h1>

            <div className="text-right">
               <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Pool Value</p>
               <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-sm font-mono">
                 {poolCoins === null ? '—' : poolCoins.toLocaleString()}
                </div>
            </div>
          </div>
          
          <div className="flex bg-[#1A1A24] p-1 rounded-lg border border-[#2C2C2C] overflow-x-auto self-start md:self-auto w-full md:w-auto">
            <button
              onClick={() => setActiveTab('allocations')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'allocations' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Allocations
            </button>
            <button
              onClick={() => setActiveTab('cashouts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'cashouts' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Cashouts
            </button>
            <button
              onClick={() => setActiveTab('wallets')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'wallets' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wallet className="w-4 h-4" />
              User Wallets
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'transactions' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <PieChart className="w-4 h-4" />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'properties' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building size={16} />
              <span>Properties</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'settings' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {activeTab === 'transactions' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#121212] border border-troll-green/30 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-1">Total Admin Profit</h3>
                <div className="text-3xl font-bold text-troll-green">${totalProfit.toFixed(2)}</div>
              </div>
              <div className="bg-[#121212] border border-blue-500/30 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-1">Total Admin Fees Collected</h3>
                <div className="text-3xl font-bold text-blue-400">${totalFees.toFixed(2)}</div>
              </div>
              <div className="bg-[#121212] border border-emerald-500/30 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-1">Admin Pool Coins</h3>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-sm font-mono">
                  {poolCoins === null ? '—' : poolCoins.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#121212] border border-purple-500/30 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-1">Admin Pool Cash Value</h3>
                <div className="text-3xl font-bold text-purple-300">
                  {poolCoins === null ? '—' : `$${(poolCoins / ADMIN_POOL_COINS_PER_DOLLAR).toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-4">
              {loading ? (
                <div className="text-gray-300">Loading admin pool transactions...</div>
              ) : rows.length === 0 ? (
                <div className="text-gray-400">No transactions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-300 border-b border-[#2C2C2C]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Cashout Amount</th>
                        <th className="py-3 px-4">Admin Fee</th>
                        <th className="py-3 px-4">Admin Profit</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5">
                          <td className="py-3 px-4">{r.date}</td>
                          <td className="py-3 px-4 font-medium text-blue-300">@{r.username}</td>
                          <td className="py-3 px-4 capitalize">{r.transaction_type}</td>
                          <td className="py-3 px-4">${Number(r.cashout_amount).toFixed(2)}</td>
                          <td className="py-3 px-4 text-yellow-400">${Number(r.admin_fee).toFixed(2)}</td>
                          <td className="py-3 px-4 text-troll-green font-bold">${Number(r.admin_profit).toFixed(2)}</td>
                          <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate">
                            {JSON.stringify(r.source_details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'secretary_approvals' && (
          <div className="space-y-6">
             <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white">Secretary Approvals History</h3>
              </div>
              
              {approvalsLoading ? (
                <div className="p-8 text-center text-gray-400">Loading approvals...</div>
              ) : secretaryApprovals.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No approvals found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-[#2C2C2C] bg-[#1A1A24]">
                        <th className="py-3 px-6">Date</th>
                        <th className="py-3 px-6">User</th>
                        <th className="py-3 px-6 text-right">Amount</th>
                        <th className="py-3 px-6 text-right">Approver</th>
                        <th className="py-3 px-6 text-right">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secretaryApprovals.map((approval) => (
                        <tr key={approval.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5">
                          <td className="py-3 px-6 text-gray-400">
                            {new Date(approval.fulfilled_at || approval.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-6 font-medium text-blue-300">
                            @{approval.user?.username || 'Unknown'}
                          </td>
                          <td className="py-3 px-6 text-right font-mono text-yellow-400">
                            {(approval.coins || approval.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-6 text-right font-medium text-purple-300">
                            @{approval.approver?.username || 'Unknown'}
                          </td>
                           <td className="py-3 px-6 text-right text-gray-400 capitalize">
                            {approval.payment_method || 'Manual'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Sales Fees */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
               <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Recent Property Sale Fees
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[#121212]">
                    <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-4">Amount</th>
                      <th className="py-2 px-4">Reason</th>
                      <th className="py-2 px-4">Seller ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyFees.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-gray-500">No sale fees recorded</td></tr>
                    ) : (
                      propertyFees.map(fee => (
                        <tr key={fee.id} className="border-b border-[#2C2C2C]/30 hover:bg-white/5">
                          <td className="py-2 px-4 text-gray-500">{new Date(fee.created_at).toLocaleString()}</td>
                          <td className="py-2 px-4 font-mono text-green-400">+{Number(fee.amount).toLocaleString()}</td>
                          <td className="py-2 px-4 text-gray-300">{fee.reason}</td>
                          <td className="py-2 px-4 text-blue-400 text-xs font-mono">{fee.ref_user_id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sales Fees */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden mt-6">
               <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Recent Property Sale Fees
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[#121212]">
                    <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-4">Amount</th>
                      <th className="py-2 px-4">Reason</th>
                      <th className="py-2 px-4">Seller ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyFees.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-gray-500">No sale fees recorded</td></tr>
                    ) : (
                      propertyFees.map(fee => (
                        <tr key={fee.id} className="border-b border-[#2C2C2C]/30 hover:bg-white/5">
                          <td className="py-2 px-4 text-gray-500">{new Date(fee.created_at).toLocaleString()}</td>
                          <td className="py-2 px-4 font-mono text-green-400">+{Number(fee.amount).toLocaleString()}</td>
                          <td className="py-2 px-4 text-gray-300">{fee.reason}</td>
                          <td className="py-2 px-4 text-blue-400 text-xs font-mono">{fee.ref_user_id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#121212] border border-[#2C2C2C] rounded-xl p-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1A1A24] border border-[#2C2C2C] rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span>Showing top 100 results</span>
              </div>
            </div>

            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              {walletLoading ? (
                <div className="p-8 text-center text-gray-400">Loading user wallets...</div>
              ) : walletRows.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No users found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-[#2C2C2C] bg-[#1A1A24]">
                        <th className="py-3 px-6">User</th>
                        <th className="py-3 px-6 text-right">Total Balance</th>
                        <th className="py-3 px-6 text-right">Escrowed</th>
                        <th className="py-3 px-6 text-right">Available</th>
                        <th className="py-3 px-6 text-center">Status</th>
                        <th className="py-3 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletRows.map((row) => (
                        <tr 
                          key={row.user_id} 
                          className={`border-b border-[#2C2C2C]/50 hover:bg-white/5 transition-colors ${
                            row.is_cashout_eligible ? 'bg-emerald-900/10' : ''
                          }`}
                        >
                          <td className="py-3 px-6 font-medium text-blue-300">
                            @{row.username || 'Unknown'}
                          </td>
                          <td className="py-3 px-6 text-right font-mono text-gray-300">
                            {row.total_coins.toLocaleString()}
                            <div className="text-xs text-green-500/70">{formatUSD(row.total_coins)}</div>
                          </td>
                          <td className="py-3 px-6 text-right font-mono text-yellow-500">
                            {row.escrowed_coins > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                <Lock className="w-3 h-3" />
                                {row.escrowed_coins.toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-6 text-right font-mono font-bold text-white">
                            {row.available_coins.toLocaleString()}
                            <div className="text-xs text-green-400">{formatUSD(row.available_coins)}</div>
                          </td>
                          <td className="py-3 px-6 text-center">
                            {row.is_cashout_eligible ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3" />
                                Eligible
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">Ineligible</span>
                            )}
                          </td>
                          <td className="py-3 px-6 text-center">
                            <button
                              onClick={() => handleViewGifts(row.user_id, row.username)}
                              className="p-1.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/40 transition-colors"
                              title="View Gift History"
                            >
                              <Gift className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Property Sale Fees Section */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden mt-6">
               <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Recent Property Sale Fees
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[#121212]">
                    <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-4">Amount</th>
                      <th className="py-2 px-4">Reason</th>
                      <th className="py-2 px-4">Seller ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyFees.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-gray-500">No sale fees recorded</td></tr>
                    ) : (
                      propertyFees.map(fee => (
                        <tr key={fee.id} className="border-b border-[#2C2C2C]/30 hover:bg-white/5">
                          <td className="py-2 px-4 text-gray-500">{new Date(fee.created_at).toLocaleString()}</td>
                          <td className="py-2 px-4 font-mono text-green-400">+{Number(fee.amount).toLocaleString()}</td>
                          <td className="py-2 px-4 text-gray-300">{fee.reason}</td>
                          <td className="py-2 px-4 text-blue-400 text-xs font-mono">{fee.ref_user_id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cashouts' && (
          <div className="space-y-6">
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white">Pending Cashout Requests</h3>
              </div>
              
              {cashoutLoading ? (
                <div className="p-8 text-center text-gray-400">Loading requests...</div>
              ) : cashoutRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No cashout requests found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Coins</th>
                        <th className="py-3 px-4">USD Value</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Details</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashoutRequests.map((req) => (
                        <tr key={req.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5">
                          <td className="py-3 px-4 text-gray-400">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-blue-300 font-medium">
                            @{req.user?.username || 'Unknown'}
                          </td>
                          <td className="py-3 px-4 font-mono text-white">
                            {req.requested_coins.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-green-400 font-bold">
                            ${req.usd_value.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 capitalize text-gray-300">
                            {req.payout_method}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate" title={req.payout_details}>
                            {req.payout_details}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              req.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              req.status === 'denied' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {req.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {req.status === 'pending' && (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleApproveCashout(req.id)}
                                  className="p-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-colors"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDenyCashout(req.id)}
                                  className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                                  title="Deny Request"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'allocations' && (
          <div className="space-y-6">
            {/* Total Pool Overview Card */}
            <div className="bg-[#121212] border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
              <div className="flex justify-between items-center relative z-10">
                <div>
                  <h3 className="text-gray-400 text-sm mb-2 uppercase tracking-wider font-bold">Total Admin Pool Reserves</h3>
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-sm font-mono">
                    {poolCoins === null ? '—' : poolCoins.toLocaleString()}
                  </div>
                  <div className="text-lg text-green-400 font-mono mt-2 font-medium">
                    {poolCoins ? formatUSD(poolCoins) : '$0.00'} Cash Value
                  </div>
                </div>
                <div className="hidden md:block bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20">
                  <Building className="w-12 h-12 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Overview & Buckets */}
            {allocationLoading ? (
              <div className="p-8 text-center text-gray-400">Loading allocations...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {buckets.map(bucket => (
                  <div key={bucket.id} className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">{bucket.bucket_name}</h3>
                        <div className="text-2xl font-bold text-white mt-1">
                          {bucket.balance_coins.toLocaleString()}
                          <span className="text-xs text-gray-500 ml-1">coins</span>
                        </div>
                        <div className="text-sm text-green-400 font-mono mt-1">
                          {formatUSD(bucket.balance_coins)}
                        </div>
                      </div>
                      <div className="bg-[#1A1A24] p-2 rounded-lg">
                        <DollarSign className="w-5 h-5 text-purple-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end">
              <button
                onClick={() => setMoveModalOpen(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Move Allocations
              </button>
            </div>

            {/* Move Modal */}
            {moveModalOpen && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">Move Allocation Coins</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">From Bucket</label>
                      <select 
                        value={moveSource}
                        onChange={(e) => setMoveSource(e.target.value)}
                        className="w-full bg-[#1A1A24] border border-[#2C2C2C] rounded-lg p-3 text-white"
                      >
                        {buckets.map(b => <option key={b.id} value={b.bucket_name}>{b.bucket_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">To Bucket</label>
                      <select 
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="w-full bg-[#1A1A24] border border-[#2C2C2C] rounded-lg p-3 text-white"
                      >
                        {buckets.map(b => <option key={b.id} value={b.bucket_name}>{b.bucket_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Amount</label>
                      <input
                        type="number"
                        value={moveAmount}
                        onChange={(e) => setMoveAmount(e.target.value)}
                        className="w-full bg-[#1A1A24] border border-[#2C2C2C] rounded-lg p-3 text-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Reason</label>
                      <input
                        type="text"
                        value={moveReason}
                        onChange={(e) => setMoveReason(e.target.value)}
                        className="w-full bg-[#1A1A24] border border-[#2C2C2C] rounded-lg p-3 text-white"
                        placeholder="Why are you moving these coins?"
                      />
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setMoveModalOpen(false)}
                        className="flex-1 py-2 bg-[#1A1A24] hover:bg-[#2C2C2C] rounded-lg text-sm font-bold text-gray-400"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleMoveCoins}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold text-white"
                      >
                        Move Coins
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Officer Pay Section */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleSection('officers')}
                className="w-full p-4 flex items-center justify-between bg-[#1A1A24] hover:bg-[#252530] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="font-bold">Officer Pay</span>
                </div>
                {expandedSection === 'officers' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSection === 'officers' && (
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6 bg-[#0A0814] p-4 rounded-lg border border-[#2C2C2C]">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 block mb-1">Standard Officer Pay (Coins/Period)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={settings['officer_pay_rate'] || 1000}
                          onChange={(e) => handleUpdateSetting('officer_pay_rate', e.target.value)}
                          className="bg-[#1A1A24] border border-[#2C2C2C] rounded px-3 py-1 text-white w-full max-w-xs"
                        />
                        <button className="p-2 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40">
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                        <th className="py-2 px-4">Officer</th>
                        <th className="py-2 px-4">Role</th>
                        <th className="py-2 px-4 text-right">Owed (Est)</th>
                        <th className="py-2 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officers.length === 0 ? (
                        <tr><td colSpan={4} className="py-4 text-center text-gray-500">No officers found</td></tr>
                      ) : (
                        officers.map(officer => (
                          <tr key={officer.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5">
                            <td className="py-2 px-4 text-white font-medium">@{officer.username}</td>
                            <td className="py-2 px-4 text-gray-400 capitalize">{officer.role || 'Officer'}</td>
                            <td className="py-2 px-4 text-right font-mono text-yellow-400">
                              {(settings['officer_pay_rate'] || 1000).toLocaleString()}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <button 
                                onClick={() => handleMarkOfficerPaid(officer.id)}
                                className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-900 rounded text-xs hover:bg-green-900/50"
                              >
                                Mark Paid
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Provider Pay Section */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleSection('providers')}
                className="w-full p-4 flex items-center justify-between bg-[#1A1A24] hover:bg-[#252530] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-orange-400" />
                  <span className="font-bold">Provider Costs</span>
                </div>
                {expandedSection === 'providers' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSection === 'providers' && (
                <div className="p-6">
                  <div className="mb-4 flex gap-6 text-sm">
                    <div className="bg-[#0A0814] px-4 py-2 rounded-lg border border-[#2C2C2C]">
                      <div className="text-gray-500 text-xs">Total Monthly Cost</div>
                      <div className="font-bold text-white text-lg">
                        {Object.values(settings['provider_costs'] || {}).reduce((acc: number, val: any) => acc + Number(val), 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#0A0814] px-4 py-2 rounded-lg border border-[#2C2C2C]">
                      <div className="text-gray-500 text-xs">Allocated Bucket Balance</div>
                      <div className={`font-bold text-lg ${
                        (buckets.find(b => b.bucket_name === 'Provider Pay')?.balance_coins || 0) < 
                        Object.values(settings['provider_costs'] || {}).reduce((acc: number, val: any) => acc + Number(val), 0)
                          ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {(buckets.find(b => b.bucket_name === 'Provider Pay')?.balance_coins || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Add Provider Form */}
                  <div className="bg-[#1A1A24] p-4 rounded-lg border border-dashed border-[#2C2C2C] mb-4">
                    <div className="text-sm font-semibold text-gray-300 mb-2">Add New Provider</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Provider Name"
                        value={newProviderName}
                        onChange={(e) => setNewProviderName(e.target.value)}
                        className="flex-1 bg-[#0A0814] border border-[#2C2C2C] rounded px-3 py-2 text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Monthly Cost"
                        value={newProviderCost}
                        onChange={(e) => setNewProviderCost(e.target.value)}
                        className="w-32 bg-[#0A0814] border border-[#2C2C2C] rounded px-3 py-2 text-white text-sm"
                      />
                      <button
                        onClick={handleAddProvider}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(settings['provider_costs'] || {}).map(([provider, cost]: [string, any]) => (
                      <div key={provider} className="bg-[#0A0814] p-4 rounded-lg border border-[#2C2C2C] relative group">
                        <button
                          onClick={() => handleRemoveProvider(provider)}
                          className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Provider"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <h4 className="font-bold text-gray-300 mb-2 pr-6">{provider}</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">Cost:</span>
                          <input 
                            type="number"
                            value={cost}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value)
                              const newCosts = { ...(settings['provider_costs'] || {}), [provider]: val }
                              setSettings(prev => ({ ...prev, provider_costs: newCosts }))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateSetting('provider_costs', settings['provider_costs'])
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            onBlur={() => {
                              handleUpdateSetting('provider_costs', settings['provider_costs'])
                            }}
                            className="bg-[#1A1A24] border border-[#2C2C2C] rounded px-2 py-1 text-white w-full"
                          />
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>USD Est:</span>
                          <span className="text-green-400">{formatUSD(cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Global Settings Section */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleSection('settings')}
                className="w-full p-4 flex items-center justify-between bg-[#1A1A24] hover:bg-[#252530] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-400" />
                  <span className="font-bold">Global Settings</span>
                </div>
                {expandedSection === 'settings' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedSection === 'settings' && (
                <div className="p-6">
                  <div className="max-w-md">
                    <label className="text-sm text-gray-400 block mb-2">Coin to USD Display Rate</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        step="0.0001"
                        value={settings['coin_usd_rate'] || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, coin_usd_rate: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateSetting('coin_usd_rate', settings['coin_usd_rate'])
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        onBlur={() => handleUpdateSetting('coin_usd_rate', settings['coin_usd_rate'])}
                        className="bg-[#1A1A24] border border-[#2C2C2C] rounded px-4 py-2 text-white w-full"
                      />
                      <div className="px-4 py-2 bg-[#1A1A24] border border-[#2C2C2C] rounded text-gray-400">
                        USD/Coin
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Used for display purposes only. 1000 coins = ${((1000 * parseFloat(settings['coin_usd_rate'] || '0'))).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-400" />
                Bank Owned Properties
              </h2>
              
              {loadingProps ? (
                <div className="text-center py-8 text-gray-500">Loading properties...</div>
              ) : properties.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No properties found in admin possession</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.map(prop => (
                    <div key={prop.id} className="bg-[#1A1A24] border border-[#2C2C2C] rounded-lg p-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 bg-purple-900/50 rounded-bl-lg text-xs text-purple-200 border-l border-b border-purple-500/30">
                        {prop.neighborhood}
                      </div>
                      
                      <div className="mb-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                          <Building className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="font-bold text-lg text-white">{prop.address}</h3>
                        <p className="text-xs text-gray-400">ID: {prop.id}</p>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-400">
                          <span>Original Price:</span>
                          <span className="text-white font-mono">{prop.original_price?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Last Sold:</span>
                          <span className="text-white font-mono">{prop.last_sold_price?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Acquired:</span>
                          <span className="text-white">{new Date(prop.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Future Action Buttons could go here */}
                      <div className="mt-4 pt-4 border-t border-[#2C2C2C] flex gap-2">
                        <button className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-1.5 rounded text-sm transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">

            {/* Audit Log Section */}
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl overflow-hidden">
              <div className="p-4 bg-[#1A1A24] border-b border-[#2C2C2C]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  Allocation Audit Log
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[#121212]">
                    <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                      <th className="py-2 px-4">Date</th>
                      <th className="py-2 px-4">Amount</th>
                      <th className="py-2 px-4">Reason</th>
                      <th className="py-2 px-4">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-gray-500">No logs found</td></tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="border-b border-[#2C2C2C]/30 hover:bg-white/5">
                          <td className="py-2 px-4 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="py-2 px-4 font-mono text-white">{Number(log.amount).toLocaleString()}</td>
                          <td className="py-2 px-4 text-gray-300">{log.reason}</td>
                          <td className="py-2 px-4 text-blue-400 text-xs truncate max-w-[100px]">{log.ref_user_id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}


        {activeTab === 'settings' && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Provider Costs & Allocations
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Provider List */}
               <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300">Current Providers</h3>
                  {Object.keys(settings['provider_costs'] || {}).length === 0 ? (
                    <p className="text-gray-500">No providers configured.</p>
                  ) : (
                    <div className="space-y-2">
                       {Object.entries(settings['provider_costs'] || {}).map(([name, cost]) => (
                         <div key={name} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                            <div>
                               <div className="font-bold">{name}</div>
                               <div className="text-sm text-gray-400">Monthly Cost: <span className="text-yellow-400">{Number(cost).toLocaleString()} Coins</span></div>
                            </div>
                            <button 
                              onClick={() => handleRemoveProvider(name)}
                              className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                            >
                               <Trash size={16} />
                            </button>
                         </div>
                       ))}
                    </div>
                  )}
               </div>

               {/* Add New */}
               <div className="bg-black/20 p-6 rounded-xl border border-white/5 h-fit">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4">Add Provider</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">Provider Name</label>
                        <input 
                          type="text" 
                          value={newProviderName}
                          onChange={e => setNewProviderName(e.target.value)}
                          className="w-full bg-zinc-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-purple-500 outline-none"
                          placeholder="e.g. Vercel"
                        />
                     </div>
                     <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">Monthly Cost (Coins)</label>
                        <input 
                          type="number" 
                          value={newProviderCost}
                          onChange={e => setNewProviderCost(e.target.value)}
                          className="w-full bg-zinc-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-purple-500 outline-none"
                          placeholder="e.g. 5000"
                        />
                     </div>
                     <button 
                        onClick={handleAddProvider}
                        disabled={!newProviderName || !newProviderCost}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        <Plus size={16} />
                        Add Provider
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
        {/* Gift History Modal */}
        {giftHistoryModalOpen && currentGiftUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#121212] border border-[#2C2C2C] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-[#2C2C2C] flex justify-between items-center bg-[#1A1A24] rounded-t-xl">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Gift className="w-5 h-5 text-purple-400" />
                  Gift History: <span className="text-purple-400">@{currentGiftUser.username}</span>
                </h3>
                <button 
                  onClick={() => setGiftHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                {giftHistoryLoading ? (
                  <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                    <span>Loading history...</span>
                  </div>
                ) : giftHistory.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Gift className="w-12 h-12 opacity-20" />
                    <span>No gift history found</span>
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#1A1A24] sticky top-0 z-10 shadow-lg">
                      <tr className="text-left text-gray-400 border-b border-[#2C2C2C]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Other User</th>
                        <th className="py-3 px-4">Item</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {giftHistory.map((gift) => (
                        <tr key={gift.id} className="border-b border-[#2C2C2C]/50 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(gift.created_at).toLocaleDateString()}
                            <div className="text-xs opacity-50">{new Date(gift.created_at).toLocaleTimeString()}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              gift.direction === 'sent' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                              {gift.direction}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-blue-300 font-medium">
                            @{gift.other_username}
                          </td>
                          <td className="py-3 px-4 text-gray-300 font-medium">
                            {gift.gift_name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-yellow-400">
                            {gift.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
