import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { PieChart, Users, Wallet, Search, CheckCircle, XCircle, RefreshCw, ArrowRightLeft, DollarSign, Settings, Save, Building, Plus, Trash } from 'lucide-react'

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
  const [_allocationLoading, _setAllocationLoading] = useState(false)
  const [officers, setOfficers] = useState<UserLite[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminPoolLedger[]>([])
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveSource, setMoveSource] = useState('Treasury')
  const [moveTarget, setMoveTarget] = useState('Officer Pay')
  const [moveAmount, setMoveAmount] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderCost, setNewProviderCost] = useState('')

  useEffect(() => {
    if (!buckets.length) return

    const bucketNames = new Set(buckets.map((b) => b.bucket_name))
    const first = buckets[0]?.bucket_name
    if (!first) return

    if (!bucketNames.has(moveSource)) {
      setMoveSource(first)
    }
    if (!bucketNames.has(moveTarget)) {
      const second = buckets.find((b) => b.bucket_name !== first)?.bucket_name
      setMoveTarget(second || first)
    }
  }, [buckets, moveSource, moveTarget])

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
        const { data, error } = await supabase.functions.invoke('admin-actions', {
          body: { action: 'get_admin_pool_dashboard' }
        })

        if (error) throw error
        if (data.error) throw new Error(data.error)

        setTransactions(data.transactions || [])
        setUsers(data.users || {})
        setPoolCoins(data.poolCoins)
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
          setWalletLoading(true)
          
          const { data, error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'get_allocations_dashboard' }
          })
          
          if (error) throw error
          if (data.error) throw new Error(data.error)

          setBuckets(data.buckets || [])
          setOfficers(data.officers || [])
          setAuditLogs(data.logs || [])

        } catch (err: any) {
          console.error('Failed to load allocations:', err)
          toast.error('Failed to load allocations data')
        } finally {
          setWalletLoading(false)
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
          const { data, error } = await supabase.functions.invoke('admin-actions', {
            body: { 
              action: 'get_wallets_dashboard',
              search: searchTerm || null,
              limit: 100
            }
          })
          
          if (error) throw error
          if (data.error) throw new Error(data.error)

          setWalletRows(data.wallets || [])
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
          const { data, error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'get_cashouts_dashboard' }
          })
          
          if (error) throw error
          if (data.error) throw new Error(data.error)
          
          setCashoutRequests(data.cashouts || [])
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
          const { data, error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'get_properties_dashboard' }
          })

          if (error) throw error
          if (data.error) throw new Error(data.error)

          setProperties(data.properties || [])
          setPropertyFees(data.fees || [])
        } catch (err: any) {
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
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'manage_provider_cost',
          sub_action: 'add',
          name: newProviderName,
          cost: newProviderCost.replace(/,/g, '')
        }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      
      setSettings(prev => ({ ...prev, provider_costs: data.newCosts }))
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
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'manage_provider_cost',
          sub_action: 'remove',
          name
        }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      
      setSettings(prev => ({ ...prev, provider_costs: data.newCosts }))
      toast.success('Provider removed successfully')
    } catch (err: any) {
      console.error('Failed to remove provider:', err)
      toast.error('Failed to remove provider')
    }
  }

  const handleMoveCoins = async () => {
    try {
      if (!moveAmount || !moveReason) return toast.error('Please fill all fields')
      if (!moveSource || !moveTarget) return toast.error('Please select source and target buckets')
      if (moveSource === moveTarget) return toast.error('Source and target buckets must be different')

      const amount = Number.parseInt(String(moveAmount).replace(/,/g, ''), 10)
      if (!Number.isFinite(amount) || amount <= 0) {
        return toast.error('Enter a valid amount')
      }
      
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'move_allocations',
          fromBucket: moveSource,
          toBucket: moveTarget,
          amount,
          reason: moveReason
        }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      
      toast.success('Coins moved successfully')
      setMoveModalOpen(false)
      setMoveAmount('')
      setMoveReason('')
      
      // Reload Buckets
      const { data: bucketData } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_allocations_dashboard' }
      })
      if (bucketData?.buckets) setBuckets(bucketData.buckets)
      
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to move coins')
    }
  }

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'update_admin_setting',
          key,
          value
        }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)
      
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
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'get_user_gift_history',
          userId,
          limit: 50
        }
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      setGiftHistory(data.history || [])
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

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'pay_officer',
          officerId
        }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)
      toast.success('Officer marked as PAID')

      // Reload Buckets & Logs
      const { data: allocData } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_allocations_dashboard' }
      })
      if (allocData) {
        setBuckets(allocData.buckets || [])
        setAuditLogs(allocData.logs || [])
      }

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to pay officer')
    }
  }

  const payWithPayPal = async (payoutId: string) => {
    const confirm = window.confirm("Are you sure you want to send this payout via PayPal?");
    if (!confirm) return;

    const toastId = toast.loading("Processing PayPal payout...");
    try {
      const { data, error } = await supabase.functions.invoke('paypal-payout', {
        body: { 
            payoutRequestId: payoutId,
            adminId: user?.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Payout sent successfully!", { id: toastId });
        // Reload
        const { data: newData } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'get_cashouts_dashboard' }
        })
        if (newData?.cashouts) setCashoutRequests(newData.cashouts)
      } else {
         toast.error(data.error || "PayPal payout failed", { id: toastId });
      }
    } catch (err: any) {
      console.error("PayPal Error:", err);
      toast.error(err.message || "Failed to process PayPal payout", { id: toastId });
    }
  };

  const handleApproveCashout = async (reqId: string) => {
    try {
      if (!confirm('Are you sure you want to mark this request as PAID? Coins will be permanently burned from escrow.')) return
      
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'finalize_cashout',
          requestId: reqId
        }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      toast.success('Cashout marked as PAID')
      
      // Reload
      const { data: newData } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_cashouts_dashboard' }
      })
      if (newData?.cashouts) setCashoutRequests(newData.cashouts)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to approve cashout')
    }
  }

  const handleDenyCashout = async (reqId: string) => {
    try {
      const reason = prompt('Enter reason for denial:')
      if (reason === null) return
      
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'deny_cashout_final',
          requestId: reqId,
          reason
        }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      toast.success('Cashout DENIED and coins returned')
      
      // Reload
      const { data: newData } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_cashouts_dashboard' }
      })
      if (newData?.cashouts) setCashoutRequests(newData.cashouts)
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
              <Users className="w-4 h-4" />
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
              <RefreshCw className="w-4 h-4" />
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
              <Building className="w-4 h-4" />
              Properties
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'settings' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {activeTab === 'transactions' && (
          <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6 shadow-xl">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                  Transaction Log
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="bg-[#111] px-4 py-2 rounded border border-[#333]">
                    <span className="text-gray-400 block text-xs">Total Profit</span>
                    <span className="text-green-400 font-bold">{totalProfit.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#111] px-4 py-2 rounded border border-[#333]">
                    <span className="text-gray-400 block text-xs">Total Fees</span>
                    <span className="text-yellow-400 font-bold">{totalFees.toFixed(2)}</span>
                  </div>
                </div>
             </div>

             {loading ? (
               <div className="text-center py-12 text-gray-400 animate-pulse">Loading transactions...</div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-[#333] text-gray-400 text-xs uppercase tracking-wider">
                       <th className="p-3">Date</th>
                       <th className="p-3">User</th>
                       <th className="p-3">Type</th>
                       <th className="p-3 text-right">Amount</th>
                       <th className="p-3 text-right">Fee</th>
                       <th className="p-3 text-right">Profit</th>
                       <th className="p-3">Details</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#222]">
                     {rows.map(row => (
                       <tr key={row.id} className="hover:bg-[#222] transition-colors">
                         <td className="p-3 text-sm text-gray-400">{row.date}</td>
                         <td className="p-3 font-medium text-white">{row.username}</td>
                         <td className="p-3">
                           <span className="px-2 py-1 bg-[#222] rounded text-xs text-gray-300 border border-[#333]">
                             {row.transaction_type}
                           </span>
                         </td>
                         <td className="p-3 text-right font-mono text-gray-300">{row.cashout_amount}</td>
                         <td className="p-3 text-right font-mono text-yellow-500">{row.admin_fee}</td>
                         <td className="p-3 text-right font-mono text-green-500">{row.admin_profit}</td>
                         <td className="p-3 text-xs text-gray-500 max-w-xs truncate">
                           {JSON.stringify(row.source_details)}
                         </td>
                       </tr>
                     ))}
                     {rows.length === 0 && (
                       <tr>
                         <td colSpan={7} className="text-center py-12 text-gray-500">
                           No transactions found
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        )}

        {activeTab === 'wallets' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                User Wallets
              </h2>

              {walletLoading ? (
                <div className="text-center py-12 text-gray-400 animate-pulse">Loading wallets...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#333] text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-3">User</th>
                        <th className="p-3 text-right">Total Coins</th>
                        <th className="p-3 text-right">Escrowed</th>
                        <th className="p-3 text-right">Available</th>
                        <th className="p-3 text-center">Cashout Eligible</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {walletRows.map(row => (
                        <tr key={row.user_id} className="hover:bg-[#222] transition-colors">
                          <td className="p-3 font-medium text-white">{row.username}</td>
                          <td className="p-3 text-right font-mono text-blue-400">{row.total_coins.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-yellow-500">{row.escrowed_coins.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-green-500">{row.available_coins.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            {row.is_cashout_eligible ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-600 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleViewGifts(row.user_id, row.username)}
                              className="text-xs bg-[#333] hover:bg-[#444] text-white px-2 py-1 rounded transition-colors"
                            >
                              Gift History
                            </button>
                          </td>
                        </tr>
                      ))}
                      {walletRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-gray-500">
                            No wallets found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'allocations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buckets.map(bucket => (
                <div key={bucket.id} className="bg-[#1A1A24] p-6 rounded-lg border border-[#2C2C2C] relative group">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-white">{bucket.bucket_name}</h3>
                    <DollarSign className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="text-3xl font-mono font-bold text-white mb-2">
                    {bucket.balance_coins.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    Target: {bucket.target_coins > 0 ? bucket.target_coins.toLocaleString() : '∞'}
                  </div>
                  {bucket.bucket_name === 'Officer Pay' && (
                    <div className="mt-4 pt-4 border-t border-[#333]">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Pending Payments</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {officers.filter(o => o.role === 'troll_officer' || o.is_troll_officer).map(off => (
                          <div key={off.id} className="flex justify-between items-center text-sm bg-[#111] p-2 rounded">
                            <span>{off.username}</span>
                            <button
                              onClick={() => handleMarkOfficerPaid(off.id)}
                              className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded"
                            >
                              Pay
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Move Coins Card */}
              <div className="bg-[#1A1A24] p-6 rounded-lg border border-[#2C2C2C] flex flex-col justify-center items-center text-center cursor-pointer hover:border-purple-500 transition-colors" onClick={() => setMoveModalOpen(true)}>
                 <ArrowRightLeft className="w-10 h-10 text-purple-500 mb-3" />
                 <h3 className="font-bold text-lg text-white">Move Allocations</h3>
                 <p className="text-sm text-gray-400 mt-2">Transfer coins between buckets</p>
              </div>
            </div>

            <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Provider Costs & Estimates
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                   <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase">Monthly Providers</h4>
                   <div className="space-y-3">
                     {Object.entries(settings['provider_costs'] || {}).map(([name, cost]: [string, any]) => (
                       <div key={name} className="flex justify-between items-center bg-[#111] p-3 rounded border border-[#333]">
                         <span className="font-medium">{name}</span>
                         <div className="flex items-center gap-4">
                           <span className="font-mono text-yellow-400">${Number(cost).toLocaleString()}</span>
                           <button onClick={() => handleRemoveProvider(name)} className="text-red-500 hover:text-red-400">
                             <Trash className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                     ))}
                     
                     <div className="flex gap-2 mt-4">
                       <input 
                         placeholder="Provider Name" 
                         className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm flex-1"
                         value={newProviderName}
                         onChange={e => setNewProviderName(e.target.value)}
                       />
                       <input 
                         placeholder="Cost ($)" 
                         className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm w-24"
                         value={newProviderCost}
                         onChange={e => setNewProviderCost(e.target.value)}
                       />
                       <button 
                         onClick={handleAddProvider}
                         className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded text-white"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                 </div>

                 <div>
                   <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase">Financial Summary</h4>
                   <div className="bg-[#111] p-4 rounded border border-[#333] space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Monthly Cost</span>
                        <span className="font-mono font-bold text-white">
                          ${Object.values(settings['provider_costs'] || {}).reduce((a: any, b: any) => a + Number(b), 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Coin/USD Rate</span>
                        <div className="flex items-center gap-2">
                           <span className="font-mono text-green-400">${settings['coin_usd_rate']}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-[#333]">
                         <p className="text-xs text-gray-500">
                           To cover monthly costs, the platform needs to generate approximately <span className="text-white font-bold">
                             {Math.ceil((Object.values(settings['provider_costs'] || {}).reduce((a: number, b: any) => a + Number(b), 0) as number) * ADMIN_POOL_COINS_PER_DOLLAR).toLocaleString()}
                           </span> coins in profit.
                         </p>
                      </div>
                   </div>
                 </div>
              </div>
            </div>

            <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6">
               <h3 className="font-bold text-lg mb-4 text-gray-400">Recent Audit Logs</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead>
                     <tr className="text-gray-500 border-b border-[#333]">
                       <th className="pb-2">Date</th>
                       <th className="pb-2">Action</th>
                       <th className="pb-2 text-right">Amount</th>
                       <th className="pb-2 text-right">Admin</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#222]">
                     {auditLogs.map(log => (
                       <tr key={log.id}>
                         <td className="py-2 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                         <td className="py-2">{log.reason}</td>
                         <td className="py-2 text-right font-mono">{log.amount.toLocaleString()}</td>
                         <td className="py-2 text-right text-gray-400">{log.ref_user_id?.slice(0, 8)}...</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'cashouts' && (
          <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                Cashout Requests
             </h2>

             {cashoutLoading ? (
               <div className="text-center py-12 text-gray-400 animate-pulse">Loading requests...</div>
             ) : (
               <div className="space-y-4">
                 {cashoutRequests.map(req => (
                   <div key={req.id} className="bg-[#111] p-4 rounded border border-[#333] flex flex-col md:flex-row justify-between gap-4">
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <span className="font-bold text-lg text-white">{req.user?.username || 'Unknown User'}</span>
                         <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${
                           req.status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                           req.status === 'paid' ? 'bg-green-900 text-green-200' :
                           'bg-red-900 text-red-200'
                         }`}>
                           {req.status}
                         </span>
                       </div>
                       <div className="text-sm text-gray-400 flex flex-col gap-1">
                         <p>Requested: <span className="text-white font-mono">{req.requested_coins.toLocaleString()} coins</span> ({formatUSD(req.requested_coins)})</p>
                         <p>Method: <span className="text-purple-400">{req.payout_method}</span></p>
                         <p className="text-xs break-all">{req.payout_details}</p>
                         <p className="text-xs text-slate-500 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                       </div>
                     </div>
                     
                     {req.status === 'pending' && (
                       <div className="flex flex-col gap-2 justify-center min-w-[150px]">
                         <button 
                           onClick={() => handleApproveCashout(req.id)}
                           className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                         >
                           Mark as Paid
                         </button>
                         <button 
                            onClick={() => payWithPayPal(req.id)}
                            className="bg-[#003087] hover:bg-[#001c64] text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <span>Pay with PayPal</span>
                          </button>
                         <button 
                           onClick={() => handleDenyCashout(req.id)}
                           className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                         >
                           Deny & Refund
                         </button>
                       </div>
                     )}
                   </div>
                 ))}
                 
                 {cashoutRequests.length === 0 && (
                   <div className="text-center py-12 text-gray-500">
                     No cashout requests found
                   </div>
                 )}
               </div>
             )}
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6 shadow-xl">
             <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-400" />
                Admin Properties
             </h2>

             {loadingProps ? (
               <div className="text-center py-12 text-gray-400 animate-pulse">Loading properties...</div>
             ) : (
               <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Admin-Owned Properties</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {properties.map(p => (
                        <div key={p.id} className="bg-[#111] p-4 rounded border border-[#333]">
                           <div className="font-bold text-lg mb-1">{p.name || 'Unnamed Property'}</div>
                           <div className="text-sm text-gray-400 mb-2">{p.address}</div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="text-gray-500">Value</span>
                             <span className="text-green-400 font-mono">${(p.purchase_price || 0).toLocaleString()}</span>
                           </div>
                        </div>
                      ))}
                      {properties.length === 0 && <p className="text-gray-500 italic">No admin properties found.</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Property Sale Fees</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-gray-500 border-b border-[#333]">
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Reason</th>
                            <th className="pb-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222]">
                          {propertyFees.map(fee => (
                            <tr key={fee.id}>
                              <td className="py-2 text-gray-400">{new Date(fee.created_at).toLocaleString()}</td>
                              <td className="py-2">{fee.reason}</td>
                              <td className="py-2 text-right font-mono text-green-400">+{fee.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                           {propertyFees.length === 0 && (
                            <tr><td colSpan={3} className="py-4 text-center text-gray-500 italic">No fees recorded.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="bg-[#1A1A24] rounded-lg border border-[#2C2C2C] p-6 shadow-xl max-w-2xl mx-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Global Settings
              </h2>
              
              <div className="space-y-6">
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-2">Coin to USD Rate</label>
                   <div className="flex gap-2">
                     <input 
                       type="number" 
                       step="0.0001"
                       defaultValue={settings['coin_usd_rate']}
                       className="bg-[#111] border border-[#333] rounded px-4 py-2 text-white w-full"
                       onBlur={(e) => handleUpdateSetting('coin_usd_rate', e.target.value)}
                     />
                     <button className="bg-[#333] hover:bg-[#444] px-4 rounded text-gray-300">
                       <Save className="w-4 h-4" />
                     </button>
                   </div>
                   <p className="text-xs text-gray-500 mt-1">
                     Determines the display value of cashouts and wallets.
                   </p>
                </div>
              </div>
           </div>
        )}

        {/* Move Modal */}
        {moveModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#1A1A24] p-6 rounded-lg border border-[#333] w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Move Allocations</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source Bucket</label>
                  <select 
                    value={moveSource}
                    onChange={e => setMoveSource(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white"
                  >
                    {buckets.map(b => <option key={b.id} value={b.bucket_name}>{b.bucket_name}</option>)}
                  </select>
                </div>
                
                <div className="flex justify-center">
                  <ArrowRightLeft className="w-6 h-6 text-gray-500 rotate-90" />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Bucket</label>
                  <select 
                    value={moveTarget}
                    onChange={e => setMoveTarget(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white"
                  >
                    {buckets.map(b => <option key={b.id} value={b.bucket_name}>{b.bucket_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount</label>
                  <input 
                    type="text"
                    value={moveAmount}
                    onChange={e => setMoveAmount(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input 
                    type="text"
                    value={moveReason}
                    onChange={e => setMoveReason(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white"
                    placeholder="e.g. Monthly top-up"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setMoveModalOpen(false)}
                    className="flex-1 bg-[#333] hover:bg-[#444] text-white py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleMoveCoins}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded"
                  >
                    Move Coins
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gift History Modal */}
        {giftHistoryModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1A24] rounded-lg border border-[#333] w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-[#333] flex justify-between items-center">
                <h3 className="text-lg font-bold">
                  Gift History: <span className="text-purple-400">{currentGiftUser?.username}</span>
                </h3>
                <button onClick={() => setGiftHistoryModalOpen(false)} className="text-gray-400 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {giftHistoryLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading history...</div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#333]">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">User</th>
                        <th className="pb-2">Gift</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {giftHistory.map(g => (
                        <tr key={g.id}>
                          <td className="py-2 text-gray-400">{new Date(g.created_at).toLocaleString()}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              g.direction === 'sent' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                            }`}>
                              {g.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2">{g.other_username}</td>
                          <td className="py-2 text-gray-300">{g.gift_name}</td>
                          <td className="py-2 text-right font-mono">{g.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      {giftHistory.length === 0 && (
                        <tr><td colSpan={5} className="py-4 text-center text-gray-500">No history found.</td></tr>
                      )}
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
