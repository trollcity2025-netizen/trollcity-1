import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Inbox,
  DollarSign,
  Gift,
  Bell,
  FileText,
  LogOut,
  ShieldAlert,
  Home
} from 'lucide-react'
import ExecutiveIntakeList from './admin/components/shared/ExecutiveIntakeList'
import CashoutRequestsList from './admin/components/shared/CashoutRequestsList'
import GiftCardFulfillmentList from './admin/components/shared/GiftCardFulfillmentList'
import CriticalAlertsList from './admin/components/shared/CriticalAlertsList'
import ExecutiveReportsList from './admin/components/shared/ExecutiveReportsList'

type TabId = 'intake' | 'cashouts' | 'giftcards' | 'alerts' | 'reports' | 'troll_town'

export default function SecretaryConsole() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('intake')
  const [loading, setLoading] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const [counts, setCounts] = useState({
    intake: 0,
    cashouts: 0,
    alerts: 0
  })

  const fetchCounts = useCallback(async () => {
    try {
        const [intakeRes, cashoutRes, alertsRes] = await Promise.all([
            supabase.from('executive_intake').select('id', { count: 'exact', head: true }).eq('status', 'new'),
            supabase.from('cashout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('critical_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false)
        ])
        
        setCounts({
            intake: intakeRes.count || 0,
            cashouts: cashoutRes.count || 0,
            alerts: alertsRes.count || 0
        })
    } catch (e) {
        console.error("Error fetching counts", e)
    }
  }, [])

  const checkAccess = useCallback(async () => {
    if (!user) {
      navigate('/')
      return
    }

    try {
      // 1. Check if secretary
      const { data: secData, error: secError } = await supabase
        .from('secretary_assignments')
        .select('id')
        .eq('secretary_id', user.id)
        .maybeSingle()

      if (secError) throw secError
      
      if (!secData && profile?.role !== 'admin') {
        toast.error('Unauthorized access')
        navigate('/')
        return
      }

      // 2. Get privileges
      const { data: _privData, error: privError } = await supabase.rpc('get_effective_privileges')
      if (privError) {
        console.error('Privilege check failed', privError)
      } else {
        // Check suspension via privileges or profile
        if (profile?.is_officer_active === false) {
            setSuspended(true)
            toast.error('Your account is currently suspended. Actions are disabled.')
        }
      }

    } catch (error) {
      console.error('Access check failed:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [user, navigate, profile])

  // Global UI Rules Implementation
  useEffect(() => {
    checkAccess()
    fetchCounts()
    
    // Subscribe to changes for counts
    const sub = supabase.channel('secretary-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'executive_intake' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'critical_alerts' }, () => fetchCounts())
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [checkAccess, fetchCounts])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Verifying credentials...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-purple-500" />
            Secretary Console
          </h1>
          <p className="text-xs text-slate-500 mt-2">Executive Operations</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton 
            active={activeTab === 'intake'} 
            onClick={() => setActiveTab('intake')}
            icon={<Inbox className="w-5 h-5" />}
            label="Intake Inbox"
            alert={counts.intake > 0}
            count={counts.intake}
          />
          <NavButton 
            active={activeTab === 'cashouts'} 
            onClick={() => setActiveTab('cashouts')}
            icon={<DollarSign className="w-5 h-5" />}
            label="Cashout Queue"
            alert={counts.cashouts > 0}
            count={counts.cashouts}
          />
          <NavButton 
            active={activeTab === 'giftcards'} 
            onClick={() => setActiveTab('giftcards')}
            icon={<Gift className="w-5 h-5" />}
            label="Gift Card Fulfillment"
          />
          <NavButton 
            active={activeTab === 'alerts'} 
            onClick={() => setActiveTab('alerts')}
            icon={<Bell className="w-5 h-5" />}
            label="Critical Alerts"
            alert={counts.alerts > 0}
            count={counts.alerts}
          />
          <NavButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<FileText className="w-5 h-5" />}
            label="Report Builder"
          />
          <NavButton 
            active={activeTab === 'troll_town'} 
            onClick={() => setActiveTab('troll_town')}
            icon={<Home className="w-5 h-5" />}
            label="Troll Town Deeds"
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={profile?.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" />
            <div>
              <p className="text-white text-sm font-medium">{profile?.username}</p>
              <p className="text-xs text-slate-500">Executive Secretary</p>
            </div>
          </div>
          {suspended && (
             <div className="bg-red-900/20 border border-red-500/50 p-2 rounded mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-300">Account Suspended</span>
             </div>
          )}
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" /> Exit Console
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto pointer-events-auto">
        {suspended && (
            <div className="absolute inset-0 z-50 pointer-events-none">
                <div className="bg-slate-950/50 absolute inset-0 backdrop-blur-[1px]" />
            </div>
        )}
        <div className={suspended ? 'opacity-50 pointer-events-none select-none' : ''}>
            {activeTab === 'intake' && <ExecutiveIntakeList viewMode="secretary" />}
            {activeTab === 'cashouts' && <CashoutRequestsList viewMode="secretary" />}
            {activeTab === 'giftcards' && <GiftCardFulfillmentList viewMode="secretary" />}
            {activeTab === 'alerts' && <CriticalAlertsList viewMode="secretary" />}
            {activeTab === 'reports' && <ExecutiveReportsList viewMode="secretary" />}
            {activeTab === 'troll_town' && <SecretaryTrollTownDeeds />}
        </div>
      </div>
    </div>
  )
}

type DeedTransferView = {
  id: string
  property_id: string
  seller_user_id: string
  buyer_user_id: string
  sale_price: number
  deed_fee: number
  seller_net: number
  system_value_at_sale: number | null
  created_at: string
  seller_username?: string
  buyer_username?: string
}

const SecretaryTrollTownDeeds: React.FC = () => {
  const [rows, setRows] = useState<DeedTransferView[]>([])
  const [loading, setLoading] = useState(true)
  const [adminPoolBalance, setAdminPoolBalance] = useState<number | null>(null)
  const [filterSeller, setFilterSeller] = useState('')
  const [filterBuyer, setFilterBuyer] = useState('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('deed_transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST106') {
            setRows([])
          } else {
            throw error
          }
        } else {
          const transfers = (data || []) as any[]
          const userIds = new Set<string>()
          transfers.forEach(row => {
            if (row.seller_user_id) userIds.add(row.seller_user_id)
            if (row.buyer_user_id) userIds.add(row.buyer_user_id)
          })

          let usernames = new Map<string, string>()
          if (userIds.size > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, username')
              .in('id', Array.from(userIds))
            usernames = new Map(
              (profiles || []).map((p: any) => [p.id as string, p.username as string])
            )
          }

          const mapped: DeedTransferView[] = transfers.map(row => ({
            id: row.id,
            property_id: row.property_id,
            seller_user_id: row.seller_user_id,
            buyer_user_id: row.buyer_user_id,
            sale_price: Number(row.sale_price || 0),
            deed_fee: Number(row.deed_fee || 0),
            seller_net: Number(row.seller_net || 0),
            system_value_at_sale: row.system_value_at_sale
              ? Number(row.system_value_at_sale)
              : null,
            created_at: row.created_at,
            seller_username: usernames.get(row.seller_user_id) || undefined,
            buyer_username: usernames.get(row.buyer_user_id) || undefined
          }))
          setRows(mapped)
        }

        const { data: poolRow } = await supabase
          .from('admin_pool')
          .select('trollcoins_balance')
          .maybeSingle()
        if (poolRow) {
          setAdminPoolBalance(Number(poolRow.trollcoins_balance || 0))
        } else {
          setAdminPoolBalance(null)
        }
      } catch (error: any) {
        console.error('Failed to load Troll Town deeds', error)
        toast.error(error?.message || 'Failed to load Troll Town deeds')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredRows = rows.filter(row => {
    if (filterSeller) {
      const match = row.seller_username || ''
      if (!match.toLowerCase().includes(filterSeller.toLowerCase())) return false
    }
    if (filterBuyer) {
      const match = row.buyer_username || ''
      if (!match.toLowerCase().includes(filterBuyer.toLowerCase())) return false
    }
    if (filterMinPrice) {
      const min = Number(filterMinPrice)
      if (!Number.isNaN(min) && row.sale_price < min) return false
    }
    if (filterMaxPrice) {
      const max = Number(filterMaxPrice)
      if (!Number.isNaN(max) && row.sale_price > max) return false
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate).getTime()
      if (new Date(row.created_at).getTime() < start) return false
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate).getTime()
      if (new Date(row.created_at).getTime() > end) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-400" />
            Troll Town Deeds
          </h2>
          <p className="text-xs text-slate-400">
            Read-only view of property transfers and deed fees.
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-400">Admin Pool Balance</p>
          <p className="text-emerald-300 font-semibold">
            {adminPoolBalance === null
              ? '—'
              : `${adminPoolBalance.toLocaleString()} TrollCoins`}
          </p>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <input
            value={filterSeller}
            onChange={e => setFilterSeller(e.target.value)}
            placeholder="Filter by seller"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterBuyer}
            onChange={e => setFilterBuyer(e.target.value)}
            placeholder="Filter by buyer"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterMinPrice}
            onChange={e => setFilterMinPrice(e.target.value)}
            placeholder="Min price"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterMaxPrice}
            onChange={e => setFilterMaxPrice(e.target.value)}
            placeholder="Max price"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-900/90 sticky top-0 z-10">
                <tr className="text-slate-300">
                  <th className="px-3 py-2 text-left font-semibold">Date/Time</th>
                  <th className="px-3 py-2 text-left font-semibold">Property</th>
                  <th className="px-3 py-2 text-left font-semibold">Seller</th>
                  <th className="px-3 py-2 text-left font-semibold">Buyer</th>
                  <th className="px-3 py-2 text-right font-semibold">Sale Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Deed Fee</th>
                  <th className="px-3 py-2 text-right font-semibold">Seller Net</th>
                  <th className="px-3 py-2 text-right font-semibold">System Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      Loading deeds...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No deed transfers found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-800/80 hover:bg-slate-900/80"
                    >
                      <td className="px-3 py-2 text-slate-300">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        Home {row.property_id.slice(0, 6).toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.seller_username || row.seller_user_id.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.buyer_username || row.buyer_user_id.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-300">
                        {row.sale_price.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-yellow-300">
                        {row.deed_fee.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {row.seller_net.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">
                        {row.system_value_at_sale
                          ? row.system_value_at_sale.toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const NavButton = ({ active, onClick, icon, label, alert, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; alert?: boolean; count?: number }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all relative ${
      active
        ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/20'
        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
    }`}
  >
    {alert && !count && (
      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
    )}
    {count !== undefined && count > 0 && (
       <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-red-400">
         {count > 99 ? '99+' : count}
       </span>
    )}
    {icon}
    <span className="font-bold text-sm">{label}</span>
  </button>
)
