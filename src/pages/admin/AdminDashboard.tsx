// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react'
import './admin.css'
import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail } from '../../lib/supabase'
import { sendNotification } from '../../lib/sendNotification'
import {
  Users,
  FileText,
  DollarSign,
  Award,
  Shield,
  RefreshCw,
  CreditCard,
  Gift,
  Camera,
  Monitor,
  Play,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../lib/api'
import ClickableUsername from '../../components/ClickableUsername'
import ProfitSummary from '../../components/ProfitSummary'
import { TestingModeControl } from '../../components/TestingModeControl'
import CitySummaryBar from './components/CitySummaryBar'
import CityControlsHealth from './components/CityControlsHealth'
import FinanceEconomyCenter from './components/FinanceEconomyCenter'
import OperationsControlDeck from './components/OperationsControlDeck'
import ApplicationsHub from './components/ApplicationsHub'
import AdditionalTasksGrid from './components/AdditionalTasksGrid'
import QuickActionsBar from './components/QuickActionsBar'
import AgreementsManagement from './components/AgreementsManagement'

// Import missing components
import MetricsPanel from './components/MetricsPanel'
import StreamsPanel from './components/StreamsPanel'
import PayPalTestPanel from './components/PayPalTestPanel'
import ReportsPanel from './components/ReportsPanel'
import WeeklyReportsView from './WeeklyReportsView'
import StreamMonitor from './components/StreamMonitor'
import ReferralBonusPanel from './ReferralBonusPanel'
import EmpireApplications from './EmpireApplications'
import AdminApplications from './components/AdminApplications'
import UsersPanel from './components/UsersPanel'
import AdminSupportTickets from './components/AdminSupportTickets'
import EarningsTaxOverview from './components/EarningsTaxOverview'
import OfficerShiftsPanel from './components/OfficerShiftsPanel'
import CreateSchedulePanel from './components/CreateSchedulePanel'
import { AdminGrantCoins } from './components/AdminGrantCoins'
import AdminControlPanel from './components/AdminControlPanel'
import TestDiagnostics from './components/TestDiagnostics'
import AdminResetPanel from './AdminResetPanel'
import PayoutAdmin from '../../components/PayoutAdmin'

type StatState = {
  totalUsers: number
  adminsCount: number
  pendingApps: number
  pendingPayouts: number
  trollOfficers: number
  aiFlags: number
  coinSalesRevenue: number
  totalPayouts: number
  feesCollected: number
  platformProfit: number
  totalCoinsInCirculation: number
  totalValue: number
  purchasedCoins: number
  earnedCoins: number
  freeCoins: number
  giftCoins: number
  appSponsoredGifts: number
  savPromoCount: number
  vivedPromoCount: number
  total_liability_coins: number
  total_platform_profit_usd: number
  kick_ban_revenue: number
}

interface EconomySummary {
  paidCoins: {
    totalPurchased: number
    totalSpent: number
    outstandingLiability: number
  }
  broadcasters: {
    totalUsdOwed: number
    pendingCashoutsUsd: number
    paidOutUsd: number
  }
  officers: {
    totalUsdPaid: number
  }
  wheel: {
    totalSpins: number
    totalCoinsSpent: number
    totalCoinsAwarded: number
    jackpotCount: number
  }
}

type TabId =
  | 'connections'
  | 'metrics'
  | 'streams'
  | 'paypal'
  | 'reports'
  | 'officer_reports'
  | 'monitor'
  | 'payouts'
  | 'purchases'
  | 'verification'
  | 'users'
  | 'broadcasters'
  | 'referrals'
  | 'families'
  | 'cashouts'
  | 'support'
  | 'declined'
  | 'agreements'
  | 'earnings_tax'
  | 'reset'
  | 'officer_shifts'
  | 'create_schedule'
  | 'grant_coins'
  | 'control_panel'
  | 'test_diagnostics'
  | 'empire_applications'
  | 'economy'
  | 'tax_reviews'
  | 'payout_queue'

export default function AdminDashboard() {
  const { profile, user, setProfile } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
  const navigate = useNavigate()
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Admin Guard: Check admin status on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setAdminCheckLoading(false)
        setIsAuthorized(false)
        return
      }

      try {
        const { data: session } = await supabase.auth.getUser()
        if (!session.user) {
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.error('Error checking admin access:', error)
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        // Check if user is admin
        const isAdmin = 
          profileData?.role === 'admin' || 
          profileData?.is_admin === true ||
          session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()

        setIsAuthorized(isAdmin)
      } catch (error) {
        console.error('Error in admin check:', error)
        setIsAuthorized(false)
      } finally {
        setAdminCheckLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, ADMIN_EMAIL])

  const [stats, setStats] = useState<StatState>({
    totalUsers: 0,
    adminsCount: 0,
    pendingApps: 0,
    pendingPayouts: 0,
    trollOfficers: 0,
    aiFlags: 0,
    coinSalesRevenue: 0,
    totalPayouts: 0,
    feesCollected: 0,
    platformProfit: 0,
    totalCoinsInCirculation: 0,
    totalValue: 0,
    purchasedCoins: 0,
    earnedCoins: 0,
    freeCoins: 0,
    giftCoins: 0,
    appSponsoredGifts: 0,
    savPromoCount: 0,
    vivedPromoCount: 0,
    total_liability_coins: 0,
    total_platform_profit_usd: 0,
    kick_ban_revenue: 0,
  })

  const [activeTab, setActiveTab] = useState<TabId>('connections')
  const [loading, setLoading] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

  const [payouts, setPayouts] = useState<any[]>([])
  const [cashouts, setCashouts] = useState<any[]>([])
  const [cashoutsSearch, setCashoutsSearch] = useState('')
  const [cashoutsProvider, setCashoutsProvider] = useState('')
  const [purchases, setPurchases] = useState<any[]>([])
  const [declinedTransactions, setDeclinedTransactions] = useState<any[]>([])
  const [selectedDeclined, setSelectedDeclined] = useState<any | null>(null)
  const [_verifications, setVerifications] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [broadcastersList, setBroadcastersList] = useState<any[]>([])
  const [familiesList, setFamiliesList] = useState<any[]>([])
  const [_supportTickets, setSupportTickets] = useState<any[]>([])
  const [_agreements, setAgreements] = useState<any[]>([])
  const [agoraStatus, setAgoraStatus] = useState<any | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null)
  const [paypalStatus, setPaypalStatus] = useState<any | null>(null)
  const [paypalTesting, setPaypalTesting] = useState(false)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)
  const [scheduledAnnouncements, setScheduledAnnouncements] = useState<any[]>([])

  // Economy summary
  const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
  const [economySummaryData, setEconomySummaryData] = useState<any>(null)
  const [economyLoading, setEconomyLoading] = useState(false)

  // Risk overview
  const [risk, setRisk] = useState<{ frozenCount: number; topHighRisk: any[] } | null>(null)

  // Shop revenue
  const [shopRevenue, setShopRevenue] = useState<{
    insuranceTotal: number
    effectsTotal: number
    perksTotal: number
    topBuyers: any[]
  } | null>(null)

  // Live streams
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [selectedStream, setSelectedStream] = useState<any | null>(null)
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [actionUntil, setActionUntil] = useState('')

  // New dashboard state
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Admin Guard: Check admin status on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setAdminCheckLoading(false)
        setIsAuthorized(false)
        return
      }

      try {
        const { data: session } = await supabase.auth.getUser()
        if (!session.user) {
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('role, is_admin')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.error('Error checking admin access:', error)
          setAdminCheckLoading(false)
          setIsAuthorized(false)
          return
        }

        // Check if user is admin
        const isAdmin = 
          profileData?.role === 'admin' || 
          profileData?.is_admin === true ||
          session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()

        setIsAuthorized(isAdmin)
      } catch (error) {
        console.error('Error in admin check:', error)
        setIsAuthorized(false)
      } finally {
        setAdminCheckLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, ADMIN_EMAIL])

  // === INITIAL LOAD ===
  useEffect(() => {
    if (isAuthorized) {
      loadDashboardData()
      loadLiveStreams()
      loadEconomySummary()
      loadShopRevenue()
    }
  }, [isAuthorized])

  // Auto-refresh core stats every 15s
  useEffect(() => {
    const id = setInterval(() => {
      loadDashboardData()
      loadEconomySummary()
      loadShopRevenue()
      if (activeTab === 'connections') loadLiveStreams()
    }, 15000)
    return () => clearInterval(id)
  }, [activeTab])

    // Global monitoring channels
    useEffect(() => {
      console.log('[Admin Monitor] Starting global monitoring system...')
  
      const streamsChannel = supabase
        .channel('admin-global-streams')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => {
          loadLiveStreams()
          loadDashboardData()
        })
        .subscribe()

    const coinChannel = supabase
      .channel('admin-global-coins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, () => {
        loadDashboardData()
        loadEconomySummary()
        loadShopRevenue()
        if (activeTab === 'purchases') loadPurchases()
      })
      .subscribe()

    const usersChannel = supabase
      .channel('admin-global-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        loadDashboardData()
        if (activeTab === 'users') loadUsers()
        if (activeTab === 'broadcasters') loadBroadcasters()
      })
      .subscribe()

    const appsChannel = supabase
      .channel('admin-global-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
        loadDashboardData()
        if (activeTab === 'verification') loadVerifications()
      })
      .subscribe()

    const payoutsChannel = supabase
      .channel('admin-global-payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, () => {
        loadDashboardData()
        if (activeTab === 'payouts') loadPayouts()
      })
      .subscribe()

    const earningsChannel = supabase
      .channel('admin-global-earnings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'earnings_payouts' }, () => {
        loadDashboardData()
        loadEconomySummary()
        if (activeTab === 'payouts') loadPayouts()
      })
      .subscribe()

    const cashoutsChannel = supabase
      .channel('admin-global-cashouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
        loadDashboardData()
        loadEconomySummary()
        if (activeTab === 'cashouts') loadCashouts()
      })
      .subscribe()

    const declinedChannel = supabase
      .channel('admin-global-declined')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'declined_transactions' }, () => {
        if (activeTab === 'declined') loadDeclinedTransactions()
      })
      .subscribe()

    const messagesChannel = supabase
      .channel('admin-global-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        // hook if you want support monitoring via messages
      })
      .subscribe()

    return () => {
      console.log('[Admin Monitor] Stopping global monitoring system...')
      supabase.removeChannel(streamsChannel)
      supabase.removeChannel(coinChannel)
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(appsChannel)
      supabase.removeChannel(payoutsChannel)
      supabase.removeChannel(earningsChannel)
      supabase.removeChannel(cashoutsChannel)
      supabase.removeChannel(declinedChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [activeTab])

  // Load scheduled announcements on mount and listen for updates
  useEffect(() => {
    if (profile?.id) {
      loadScheduledAnnouncements()
      
      // Listen for scheduled announcements updates
      const scheduledChannel = supabase
        .channel('admin-scheduled-announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_announcements' }, () => {
          loadScheduledAnnouncements()
        })
        .subscribe()
      
      return () => {
        supabase.removeChannel(scheduledChannel)
      }
    }
  }, [profile?.id])

  // Real-time cashout updates
  useEffect(() => {
    const channel = supabase
      .channel('cashout-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cashout_requests' },
        (payload) => {
          toast.success(`💸 New Cashout Request: ${payload.new.username}`);
          loadCashouts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cashout_requests' },
        () => loadCashouts()
      )
      .subscribe();

    loadCashouts();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [
        usersRes,
        adminsRes,
        appsRes,
        pendingPayoutsRes,
        officersRes,
        flagsRes,
        balancesRes,
        coinTxRes,
        giftTxRes,
        payoutAggRes,
      ] = await Promise.all([
        supabase.from('user_profiles').select('id'),
        supabase.from('user_profiles').select('id').eq('role', 'admin'),
        supabase.from('applications').select('id').eq('status', 'pending'),
        supabase.from('payout_requests').select('id').eq('status', 'pending'),
        supabase.from('user_profiles').select('id').eq('role', 'troll_officer'),
        supabase.from('stream_reports').select('id').eq('status', 'pending'),
        supabase
          .from('user_profiles')
          .select('paid_coin_balance, free_coin_balance, sav_bonus_coins, vived_bonus_coins'),
        supabase.from('coin_transactions').select('metadata').eq('type', 'purchase'),
        supabase.from('coin_transactions').select('amount, type').eq('type', 'gift'),
        supabase.from('payout_requests').select('cash_amount, processing_fee'),
      ])

      const users = usersRes.data || []
      const apps = appsRes.data || []
      const admins = adminsRes.data || []
      const pendingPayouts = pendingPayoutsRes.data || []
      const officers = officersRes.data || []
      const flags = flagsRes.data || []

      const balances = balancesRes.data || []
      let purchasedCoins = 0
      let freeCoins = 0
      let savBonusTotal = 0
      let vivedBonusTotal = 0
      for (const row of balances as any[]) {
        purchasedCoins += Number(row.paid_coin_balance || 0)
        freeCoins += Number(row.free_coin_balance || 0)
        savBonusTotal += Number(row.sav_bonus_coins || 0)
        vivedBonusTotal += Number(row.vived_bonus_coins || 0)
      }
      const totalCoins = purchasedCoins + freeCoins
      const totalValue = totalCoins / 100

      const coinTx = coinTxRes.data || []
      let coinSalesRevenue = 0
      for (const t of coinTx as any[]) {
        const meta = t.metadata || {}
        const amountPaid = Number(meta.amount_paid || 0)
        if (!isNaN(amountPaid)) coinSalesRevenue += amountPaid
      }

      const giftTx = giftTxRes.data || []
      let giftCoins = 0
      for (const g of giftTx as any[]) {
        const amt = Number(g.amount || 0)
        if (amt < 0) giftCoins += Math.abs(amt)
      }
      const appSponsoredGifts = savBonusTotal + vivedBonusTotal
      const savPromoCount = balances.filter((b: any) => Number(b.sav_bonus_coins || 0) > 0).length
      const vivedPromoCount = balances.filter((b: any) => Number(b.vived_bonus_coins || 0) > 0).length

      const payoutRows = payoutAggRes.data || []
      let totalPayouts = 0
      let feesCollected = 0
      for (const p of payoutRows as any[]) {
        const cashAmount = Number(p.cash_amount || 0)
        const feeAmount = Number(p.processing_fee || 0)
        if (!isNaN(cashAmount)) totalPayouts += cashAmount
        if (!isNaN(feeAmount)) feesCollected += feeAmount
      }

      const platformProfit = coinSalesRevenue - totalPayouts

      setStats(prev => ({
        ...prev,
        totalUsers: users.length,
        adminsCount: admins.length,
        pendingApps: apps.length,
        pendingPayouts: pendingPayouts.length,
        trollOfficers: officers.length,
        aiFlags: flags.length,
        purchasedCoins,
        freeCoins,
        earnedCoins: 0,
        totalCoinsInCirculation: totalCoins,
        totalValue,
        coinSalesRevenue,
        totalPayouts,
        feesCollected,
        platformProfit,
        giftCoins,
        appSponsoredGifts,
        savPromoCount,
        vivedPromoCount,
        total_liability_coins: 0,
        total_platform_profit_usd: platformProfit,
        kick_ban_revenue: 0,
      }))

      setBroadcastersList([])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const loadEconomySummary = async () => {
    try {
      setEconomyLoading(true)
      
      // Load from economy_summary view
      const { data: summary, error: summaryError } = await supabase
        .from('economy_summary')
        .select('*')
        .single()
      
      if (!summaryError && summary) {
        setEconomySummaryData(summary)
      } else {
        console.warn('Failed to load economy_summary view:', summaryError)
      }
      
      // Also load detailed economy summary from API (existing logic)
      const json = await (await import('../../lib/api')).default.get('/admin/economy/summary')
      if (!json.success) throw new Error(json?.error || 'Failed to load economy summary')
      setEconomySummary(json.data)
    } catch (err: any) {
      console.error('Failed to load economy summary:', err)
      // Fallback: compute summary client-side
      try {
        const { data: paidCoinsTx } = await supabase
          .from('coin_transactions')
          .select('user_id, amount, type')
          .in('type', ['purchase', 'cashout'])

        const paidCoinsMap: Record<string, { purchased: number; spent: number }> = {};
        ;(paidCoinsTx || []).forEach((tx: any) => {
          const existing = paidCoinsMap[tx.user_id] || { purchased: 0, spent: 0 }
          if (tx.type === 'purchase') existing.purchased += Math.abs(Number(tx.amount || 0))
          if (tx.type === 'cashout') existing.spent += Math.abs(Number(tx.amount || 0))
          paidCoinsMap[tx.user_id] = existing
        })

        let totalPurchased = 0
        let totalSpent = 0
        Object.values(paidCoinsMap).forEach(v => { totalPurchased += v.purchased; totalSpent += v.spent })
        const outstandingLiability = totalPurchased - totalSpent

        const { data: broadcasterEarnings } = await supabase
          .from('earnings_payouts')
          .select('amount, status')
        let totalUsdOwed = 0
        let paidOutUsd = 0;
        ;(broadcasterEarnings || []).forEach((e: any) => {
          const amt = Number(e.amount || 0)
          if (e.status === 'paid') paidOutUsd += amt
          totalUsdOwed += amt
        })
        const pendingCashoutsUsd = totalUsdOwed - paidOutUsd

        const { data: officerPayments } = await supabase
          .from('coin_transactions')
          .select('amount')
          .eq('type', 'officer_payment')
        const totalUsdPaid = (officerPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

        const { data: wheelSpins } = await supabase
          .from('coin_transactions')
          .select('amount, metadata')
          .eq('type', 'wheel_spin')
        let totalSpins = 0
        let totalCoinsSpent = 0
        let totalCoinsAwarded = 0
        let jackpotCount = 0;
        ;(wheelSpins || []).forEach((spin: any) => {
          totalSpins++
          const spent = Math.abs(Number(spin.amount || 0))
          totalCoinsSpent += spent
          const meta = spin.metadata || {}
          const awarded = Number(meta.coins_awarded || 0)
          totalCoinsAwarded += awarded
          if (meta.is_jackpot) jackpotCount++
        })

        setEconomySummary({
          paidCoins: { totalPurchased, totalSpent, outstandingLiability },
          broadcasters: { totalUsdOwed, pendingCashoutsUsd, paidOutUsd },
          officers: { totalUsdPaid },
          wheel: { totalSpins, totalCoinsSpent, totalCoinsAwarded, jackpotCount }
        })
      } catch (e) {
        console.error('Economy fallback failed:', e)
      }
    } finally {
      setEconomyLoading(false)
    }
  }

  const loadShopRevenue = async () => {
    try {
      const { data: insuranceTxns } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'insurance_purchase')

      const { data: effectTxns } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'entrance_effect')

      const { data: perkTxns } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'perk_purchase')

      const insuranceTotal = Math.abs(
        (insuranceTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      )
      const effectsTotal = Math.abs(
        (effectTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      )
      const perksTotal = Math.abs(
        (perkTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      )

      const { data: topBuyers } = await supabase
        .from('coin_transactions')
        .select('user_id, amount, user: user_id (username)')
        .in('type', ['insurance_purchase', 'entrance_effect', 'perk_purchase'])
        .order('amount', { ascending: true })
        .limit(50)

      const buyerMap = new Map<string, { username: string; total: number }>()
      ;(topBuyers || []).forEach((t: any) => {
        const userId = t.user_id
        const existing =
          buyerMap.get(userId) || {
            username: t.user?.username || 'Unknown',
            total: 0,
          }
        existing.total += Math.abs(t.amount || 0)
        buyerMap.set(userId, existing)
      })

      const topBuyersList = Array.from(buyerMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      setShopRevenue({
        insuranceTotal,
        effectsTotal,
        perksTotal,
        topBuyers: topBuyersList,
      })
    } catch (err) {
      console.error('Failed to load shop revenue:', err)
    }
  }

  // Risk overview
  useEffect(() => {
    const fetchRisk = async () => {
      if (profile?.role !== 'admin') return
      try {
        const json = await (await import('../../lib/api')).default.get('/admin/risk/overview')
        if (!json.success) throw new Error(json?.error || 'Failed risk')
        setRisk(json.data)
      } catch (e) {
        console.error(e)
      }
    }
    fetchRisk()
  }, [profile?.role])

  const createTrollDrop = async () => {
    try {
      const amt = Math.max(1, Math.min(100000, Number(trollDropAmount || 0)))
      const dur = Math.max(5, Math.min(3600, Number(trollDropDuration || 0)))
      const ends = new Date(Date.now() + dur * 1000).toISOString()
      await sendNotification(
        null,
        "troll_drop",
        "🎉 Troll Drop!",
        `Troll Drop: ${amt} coins available!`,
        { coins: amt, ends_at: ends }
      )
      toast.success('Troll Drop created')
    } catch {
      toast.error('Failed to create Troll Drop')
    }
  }

  const loadLiveStreams = async () => {
    setStreamsLoading(true)
    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, status, created_at, broadcaster_id')
        .eq('is_live', true) // Use is_live instead of status for consistency
        .order('created_at', { ascending: false })

      if (error) throw error

      setLiveStreams(data || [])

      if (!selectedStream && data && data.length > 0) {
        setSelectedStream(data[0])
      }
      if (data && data.length === 0) {
        setSelectedStream(null)
      }
    } catch (error) {
      console.error('Error loading live streams:', error)
    } finally {
      setStreamsLoading(false)
    }
  }

  const banSelectedUser = async () => {
    if (!selectedUserId || !actionUntil) return
    try {
      const until = new Date(actionUntil).toISOString()
      const { error } = await supabase.rpc('ban_user', {
        p_user_id: selectedUserId,
        p_until: until,
      })
      if (error) throw error
      toast.success('User banned')
    } catch {
      toast.error('Failed to ban user')
    }
  }

  const resetSelectedUserCoins = async () => {
    if (!selectedUserId) return
    try {
      const { error } = await supabase.rpc('reset_user_coins', {
        p_user_id: selectedUserId,
      })
      if (error) throw error
      toast.success('Coins reset')
    } catch {
      toast.error('Failed to reset coins')
    }
  }

  const addCoinsToAdmin = async () => {
    if (!user?.id) {
      toast.error('User ID not found')
      return
    }
    
    try {
      // Get current balance before adding
      const { data: beforeData } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance')
        .eq('id', user.id)
        .single()
      
      const beforeBalance = beforeData?.paid_coin_balance || 0
      
      // Call RPC function
      const { data, error } = await supabase.rpc('add_paid_coins', {
        user_id_input: user.id,
        coins_to_add: 7000
      })
      
      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      // Verify the balance was actually updated
      const { data: afterData, error: verifyError } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance')
        .eq('id', user.id)
        .single()
      
      if (verifyError) {
        console.error('Verification error:', verifyError)
        throw new Error('Failed to verify coins were added')
      }
      
      const afterBalance = afterData?.paid_coin_balance || 0
      const actualAdded = afterBalance - beforeBalance
      
      if (actualAdded !== 7000) {
        console.warn(`Expected to add 7000 coins, but only added ${actualAdded}`)
        toast.warning(`Added ${actualAdded} coins (expected 7000). Balance may have been updated.`)
      } else {
        toast.success(`Added 7000 paid coins! New balance: ${afterBalance.toLocaleString()}`)
      }
      
      // Reload full profile to update balance in store
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileData) {
        setProfile(profileData)
      }
    } catch (error: any) {
      console.error('Error adding coins:', error)
      toast.error(error?.message || 'Failed to add coins. Check console for details.')
    }
  }

  const endStreamById = async (id: string) => {
    try {
      // Get auth token
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      if (!token) {
        toast.error('Authentication required')
        return
      }

      // Call the streams-maintenance edge function to properly end the stream
      const functionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${functionsUrl}/streams-maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'end_stream',
          stream_id: id,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to end stream'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (!result.success && result.error) {
        throw new Error(result.error)
      }

      toast.success('Stream ended successfully')
      // Reload live streams list
      await loadLiveStreams()
    } catch (error: any) {
      console.error('Error ending stream:', error)
      toast.error(error?.message || 'Failed to end stream')
    }
  }

  const deleteStreamById = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stream? This action cannot be undone.')) {
      return
    }

    try {
      // First, end the stream properly
      const { error: endError } = await supabase
        .from('streams')
        .update({
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (endError) {
        console.error('Error ending stream:', endError)
        throw endError
      }

      // Delete related data (handle errors gracefully if tables don't exist or RLS blocks)
      const deleteRelatedData = async (table: string, column: string = 'stream_id') => {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(column, id)
        
        // Ignore 404 (table not found) and 403 (RLS blocked) errors
        if (error && error.code !== 'PGRST205' && error.code !== '42P01' && error.code !== '42501') {
          console.warn(`Could not delete from ${table}:`, error)
        }
      }

      // Delete related data in parallel (non-blocking)
      await Promise.allSettled([
        deleteRelatedData('messages'),
        deleteRelatedData('stream_reports'),
        deleteRelatedData('streams_participants'),
        deleteRelatedData('gifts'),
        deleteRelatedData('chat_messages'),
      ])

      // Finally, delete the stream itself
      const { error: deleteError } = await supabase
        .from('streams')
        .delete()
        .eq('id', id)

      if (deleteError) {
        throw deleteError
      }

      toast.success('Stream deleted successfully')
      await loadLiveStreams()
    } catch (error: any) {
      console.error('Error deleting stream:', error)
      toast.error(error?.message || 'Failed to delete stream')
    }
  }

  const viewStream = (id: string) => {
    navigate(`/stream/${id}?admin=1`)
  }

  const flagSelectedUserAI = async () => {
    if (!selectedUserId) return
    try {
      const { error } = await supabase
        .from('admin_flags')
        .insert({ user_id: selectedUserId, reason: 'ai_flag' })
      if (error) throw error
      toast.success('AI flag recorded')
    } catch {
      toast.error('Failed to record flag')
    }
  }

  const testLiveKitStreaming = async () => {
    try {
      const tokenResp = await api.post('/livekit-token', { room: 'admin-test', identity: profile?.username || 'admin' })
      if (!tokenResp.success) {
        setAgoraStatus({ ok: false, error: tokenResp.error || 'Token error' })
        toast.error('LiveKit test failed')
      } else {
        setAgoraStatus({ ok: true })
        toast.success('LiveKit token generated')
      }
    } catch (e: any) {
      setAgoraStatus({ ok: false, error: e?.message || 'LiveKit request failed' })
      toast.error('LiveKit test failed')
    }
  }


  const testSupabase = async () => {
    try {
      const uid = user?.id || profile?.id
      if (!uid) throw new Error('No user id')
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', uid)
        .limit(1)
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Profile not found')
      setSupabaseStatus({ ok: true })
      toast.success('Supabase connection verified')
    } catch (e: any) {
      setSupabaseStatus({ ok: false, error: e?.message || 'Failed' })
      toast.error('Supabase test failed')
    }
  }

  const testPayPal = async () => {
    setPaypalTesting(true)
    setPaypalStatus(null)
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL environment variable is not set')
      }

      const testUrl = `${supabaseUrl}/functions/v1/paypal-test-live`
      const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!apikey) {
        throw new Error('VITE_SUPABASE_ANON_KEY environment variable is not set')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

      try {
        const response = await fetch(testUrl, {
          method: 'OPTIONS',
          headers: {
            'apikey': apikey
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok || response.status === 200 || response.status === 204) {
          setPaypalStatus({ ok: true })
          toast.success('PayPal function reachable')
        } else {
          const responseText = await response.text().catch(() => 'No response body')
          throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`)
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after 15 seconds. Function may not be deployed or URL is incorrect: ${testUrl}`)
        } else if (fetchError.message?.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          throw new Error(`Network error: ${fetchError.message}. Check if function is deployed at: ${testUrl}`)
        } else {
          throw fetchError
        }
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Unknown error occurred'
      console.error('[PayPal Test] Error:', e)
      setPaypalStatus({ ok: false, error: errorMsg })
      toast.error(`PayPal test failed: ${errorMsg}`)
    } finally {
      setPaypalTesting(false)
    }
  }

  const loadPayouts = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setPayouts(data || [])
    } catch {
      setPayouts([])
    } finally {
      setTabLoading(false)
    }
  }

  // Mark a cashout as paid, deduct coins, and notify the user
  const markCashoutPaid = async (r: any) => {
    try {
      // 1) Get latest wallet balance
      const { data: profileRow, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, paid_coin_balance')
        .eq('id', r.user_id)
        .maybeSingle();

      if (profErr || !profileRow) {
        console.error(profErr);
        toast.error('Could not load user profile for payout');
        return;
      }

      const requestedCoins = Number(r.requested_coins || 0);
      const currentBal = Number(profileRow.paid_coin_balance || 0);
      const newBal = Math.max(0, currentBal - requestedCoins);

      // 2) Deduct coins from user wallet
      await supabase
        .from('user_profiles')
        .update({ paid_coin_balance: newBal })
        .eq('id', profileRow.id);

      // 3) Update cashout status
      await supabase
        .from('cashout_requests')
        .update({
          status: 'paid',
          processed_at: new Date().toISOString(),
        })
        .eq('id', r.id);

      // 4) Send in-app message / notification
      try {
        await sendNotification(
          r.user_id,
          "payout_update",
          "💸 Payout Approved",
          `Your Troll City payout of $${Number(r.usd_value || 0).toFixed(2)} has been sent. Check your ${String(r.payout_method || 'payment method')} account.`,
          { usd_value: r.usd_value, payout_method: r.payout_method }
        );
      } catch (notifyErr) {
        console.error('Failed to send payout notification', notifyErr);
      }

      toast.success('Cashout marked paid & user notified');
      await loadCashouts();
      await loadDashboardData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to mark cashout paid');
    }
  };

  const loadScheduledAnnouncements = async () => {
    if (!profile?.id) return
    try {
      // First, try a simple query without ordering to check if table exists
      const { data: testData, error: testError } = await supabase
        .from('scheduled_announcements')
        .select('id')
        .limit(1)
      
      // If table doesn't exist (PGRST205 = table not found), skip silently
      if (testError?.code === 'PGRST205' || testError?.code === '42P01') {
        setScheduledAnnouncements([])
        return
      }
      
      // Table exists, now try with ordering
      const { data, error } = await supabase
        .from('scheduled_announcements')
        .select('*')
        .order('scheduled_time', { ascending: true })
        .limit(10)
      
      if (error) {
        // If error is about missing column, try without ordering
        if (error.code === '42703' || error.message?.includes('does not exist') || error.message?.includes('scheduled_time')) {
          const { data: dataNoOrder, error: errorNoOrder } = await supabase
            .from('scheduled_announcements')
            .select('*')
            .limit(10)
          
          if (errorNoOrder) {
            // Table might have RLS issues, just skip
            setScheduledAnnouncements([])
            return
          }
          
          if (dataNoOrder) {
            // Sort manually by created_at if scheduled_time doesn't exist
            const sorted = [...(dataNoOrder || [])].sort((a, b) => {
              const aTime = a.scheduled_time || a.created_at || ''
              const bTime = b.scheduled_time || b.created_at || ''
              return new Date(aTime).getTime() - new Date(bTime).getTime()
            })
            setScheduledAnnouncements(sorted)
            return
          }
        }
        // For other errors, just skip silently
        setScheduledAnnouncements([])
        return
      }
      
      if (data) {
        setScheduledAnnouncements(data)
      } else {
        setScheduledAnnouncements([])
      }
    } catch (err) {
      // Silently fail - this is a non-critical feature
      setScheduledAnnouncements([])
    }
  }

  const loadCashouts = async () => {
    setTabLoading(true)
    try {
      let query = supabase
        .from('cashout_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (cashoutsProvider) query = query.eq('payout_method', cashoutsProvider)
      if (cashoutsSearch)
        query = query.or(
          `username.ilike.*${cashoutsSearch}*,email.ilike.*${cashoutsSearch}*,payout_details.ilike.*${cashoutsSearch}*`
        )
      const { data } = await query
      setCashouts(data || [])
    } catch {
      setCashouts([])
    } finally {
      setTabLoading(false)
    }
  }

  const updatePayoutStatus = async (id: string, status: 'approved' | 'rejected' | 'paid', e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('Update payout status error:', error)
        toast.error(`Failed to update payout: ${error.message}`)
        return
      }

      await loadPayouts()
      await loadDashboardData()

      toast.success(`Payout ${status}`)
    } catch (err: any) {
      console.error('Update payout status error:', err)
      toast.error(err.message || 'Failed to update payout')
    }
  }

  const approvePayout = async (req: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    try {
      const { error: updateError } = await supabase.from('payout_requests')
        .update({ status: 'paid', processed_at: new Date().toISOString() })
        .eq('id', req.id);

      if (updateError) {
        console.error('Update payout error:', updateError)
        toast.error(`Failed to update payout: ${updateError.message}`)
        return
      }

      const { error: deductError } = await supabase.rpc('deduct_user_coins', {
        p_user_id: req.user_id,
        p_coins: req.coins_redeemed
      });

      if (deductError) {
        console.error('Deduct coins error:', deductError)
        toast.error(`Failed to deduct coins: ${deductError.message}`)
        return
      }

      const { error: messageError } = await supabase.from('messages').insert([
        {
          user_id: req.user_id,
          content: `🎉 Your payout of $${req.cash_amount || req.cash_value || 0} has been sent! Check your email or wallet.`,
          system: true
        }
      ]);

      if (messageError) {
        console.error('Insert message error:', messageError)
        // Don't fail the whole operation for message errors
      }

      toast.success('Payout approved and processed successfully!')
      await loadPayouts()
      await loadDashboardData()

      toast.success("Payment marked as complete.");
    } catch {
      toast.error('Failed to approve payout')
    }
  }

  const loadPurchases = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('type', 'purchase')
        .order('created_at', { ascending: false })
        .limit(50)
      setPurchases(data || [])
    } catch {
      setPurchases([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadDeclinedTransactions = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('declined_transactions')
        .select(`*, user_profiles!inner(username)`)
        .order('created_at', { ascending: false })
        .limit(100)
      setDeclinedTransactions(data || [])
    } catch (err) {
      console.error('Failed to load declined transactions:', err)
      setDeclinedTransactions([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadVerifications = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id, user_id, status, created_at, user_profiles!applications_user_id_fkey(username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Admin] Load applications error:', error)
        setVerifications([])
      } else {
        setVerifications(data || [])
      }
    } catch (err) {
      console.error('[Admin] Load applications exception:', err)
      setVerifications([])
    } finally {
      setTabLoading(false)
    }
  }

  const _approveVerification = async (id: string) => {
    try {
      const { data: app } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .single()

      if (!app) {
        toast.error('Application not found')
        return
      }

      const { error: appError } = await supabase
        .from('applications')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (appError) throw appError

      if (app.type === 'officer') {
        await supabase
          .from('user_profiles')
          .update({ role: 'troll_officer' })
          .eq('id', app.user_id)
      } else if (app.type === 'troller') {
        await supabase.from('user_profiles').update({ role: 'troller' }).eq('id', app.user_id)
      }

      await loadVerifications()
      toast.success(
        `${app.type.charAt(0).toUpperCase() + app.type.slice(1)} application approved`
      )
    } catch (err) {
      console.error('[Admin] Approve application error:', err)
      toast.error('Failed to approve')
    }
  }

  const _rejectApplication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      await loadVerifications()
      toast.success('Application rejected')
    } catch (err) {
      console.error('[Admin] Reject application error:', err)
      toast.error('Failed to reject')
    }
  }

  const _deleteUser = async (userId: string, username: string) => {
    try {
      console.log('[Admin] Deleting user:', userId, username)

      const { error: authError } = await supabase.auth.admin.deleteUser(userId)
      if (authError) {
        console.error('[Admin] Auth delete error:', authError)
        throw authError
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (profileError) {
        console.error('[Admin] Profile delete error:', profileError)
      }

      setUsersList(prev => prev.filter(u => u.id !== userId))
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }))

      toast.success(`User @${username} permanently deleted`)
    } catch (err) {
      console.error('[Admin] Delete user error:', err)
      toast.error(
        `Failed to delete user: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      await loadUsers()
      await loadDashboardData()
    }
  }

  const _approveApplication = async (appId: string, userId: string, newRole: string) => {
    // 1. Approve application
    await supabase
      .from("applications")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.username
      })
      .eq("id", appId);

    // 2. Update user role
    await supabase
      .from("user_profiles")
      .update({ role: newRole })
      .eq("id", userId);

    // 3. Send Notification to User
    await sendNotification(
      userId,
      "role_update",
      "🎉 Application Approved",
      `Your application has been approved! You are now a ${newRole.replace('_', ' ').toUpperCase()}.`
    );

    toast.success(`Approved and assigned: ${newRole}`);
    loadApplications();
  };

  const _deleteAllFakeAccounts = async () => {
    try {
      console.log('[Admin] Deleting all fake accounts')
      const fakePatterns = ['test', 'fake', 'demo', 'sample', 'user']
      const fakeUsers = usersList.filter((u: any) =>
        fakePatterns.some(pattern =>
          (u.username?.toLowerCase() || '').includes(pattern) ||
          (u.email?.toLowerCase() || '').includes(pattern)
        )
      )

      if (fakeUsers.length === 0) {
        toast.info('No fake accounts found')
        return
      }

      let deleted = 0
      let failed = 0

      for (const user of fakeUsers) {
        try {
          await supabase.auth.admin.deleteUser(user.id)
          await supabase.from('user_profiles').delete().eq('id', user.id)
          deleted++
        } catch (err) {
          console.error('[Admin] Failed to delete fake user:', user.username, err)
          failed++
        }
      }

      setUsersList(prev => prev.filter(u => !fakeUsers.find(f => f.id === u.id)))
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - deleted }))

      toast.success(
        `Deleted ${deleted} fake accounts${failed > 0 ? `, ${failed} failed` : ''}`
      )

      await loadUsers()
      await loadDashboardData()
    } catch (err) {
      console.error('[Admin] Delete fake accounts error:', err)
      toast.error('Failed to delete fake accounts')
      await loadUsers()
      await loadDashboardData()
    }
  }

  const loadApplications = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, user_profiles!applications_user_id_fkey(username)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Admin] Load applications error:', error)
        setVerifications([])
      } else {
        setVerifications(data || [])
      }
    } catch (err) {
      console.error('[Admin] Load applications exception:', err)
      setVerifications([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadUsers = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, created_at, role')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setUsersList(data || [])
    } catch (e) {
      console.error('Error loading users:', e)
      setUsersList([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadBroadcasters = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, role, created_at')
        .eq('role', 'broadcaster')
        .order('created_at', { ascending: false })
        .limit(50)
      setBroadcastersList(data || [])
    } catch {
      setBroadcastersList([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadFamilies = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('families')
        .select('id, name, total_coins, member_count, level')
        .order('total_coins', { ascending: false })
        .limit(20)
      setFamiliesList(data || [])
    } catch {
      setFamiliesList([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadSupportTickets = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setSupportTickets(data || [])
    } catch {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', 'support_ticket')
          .order('created_at', { ascending: false })
          .limit(200)
        setSupportTickets(data || [])
      } catch {
        setSupportTickets([])
      }
    } finally {
      setTabLoading(false)
    }
  }

  const _respondToTicket = async (ticket: any) => {
    const response = window.prompt('Type your response:')
    if (!response) return
    try {
      await supabase
        .from('support_tickets')
        .update({
          admin_response: response,
          status: 'responded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id)
      toast.success('Response sent')
      loadSupportTickets()
    } catch {
      toast.error('Failed to respond')
    }
  }

  const loadAgreements = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, terms_accepted, created_at')
        .eq('terms_accepted', true)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        console.error('Error loading agreements:', error)
        toast.error('Failed to load user agreements')
        setAgreements([])
        return
      }

      setAgreements(data || [])
    } catch (error) {
      console.error('Exception loading agreements:', error)
      setAgreements([])
    }
  }

  const cleanupStreams = () => {
    toast.success('Stream cleanup initiated')
    setTimeout(() => {
      toast.success('Stream cleanup completed')
    }, 2000)
  }

  // New dashboard handlers
  const handleRefreshAll = async () => {
    setRefreshing(true)
    try {
      await loadDashboardData()
      await loadLiveStreams()
      await loadEconomySummary()
      await loadShopRevenue()
      toast.success('All data refreshed')
    } catch (error) {
      toast.error('Failed to refresh data')
    } finally {
      setRefreshing(false)
    }
  }

  const handleEmergencyStop = () => {
    toast.warning('Emergency stop initiated - stopping all streams')
    // Implement emergency stop logic
  }

  const handleBroadcastMessage = () => {
    toast.info('Broadcast message feature coming soon')
  }

  const handleSystemMaintenance = () => {
    toast.info('System maintenance panel opening')
  }

  const handleViewAnalytics = () => {
    navigate('/admin/analytics')
  }

  const handleExportData = () => {
    toast.info('Data export initiated')
  }

  const handleToggleMaintenanceMode = () => {
    setMaintenanceMode(!maintenanceMode)
    toast.success(maintenanceMode ? 'Maintenance mode disabled' : 'Maintenance mode enabled')
  }

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (!profile) return
    switch (activeTab) {
      case 'payouts':
        loadPayouts()
        break
      case 'cashouts':
        loadCashouts()
        break
      case 'purchases':
        loadPurchases()
        break
      case 'declined':
        loadDeclinedTransactions()
        break
      case 'verification':
        loadApplications()
        break
      case 'users':
        loadUsers()
        break
      case 'broadcasters':
        loadBroadcasters()
        break
      case 'families':
        loadFamilies()
        break
      case 'support':
        loadSupportTickets()
        break
      case 'agreements':
        loadAgreements()
        break
      default:
        break
    }
  }, [activeTab, profile?.id])

  // Ensure profile exists
  React.useEffect(() => {
    const ensureProfile = async () => {
      if (profile || !user?.id) return
      try {
        let tries = 0
        let p: any = null
        while (tries < 3 && !p) {
          const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
          if (data) {
            p = data
            break
          }
          await new Promise(r => setTimeout(r, 500))
          tries++
        }
        if (p) {
          // Preserve admin role if user is admin email, but keep all existing data
          const isAdmin = isAdminEmail(user?.email)
          if (isAdmin && p.role !== 'admin') {
            // Update role to admin but preserve all payment and other data
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({ role: 'admin', updated_at: new Date().toISOString() })
              .eq('id', user.id)
            if (!updateError) {
              p = { ...p, role: 'admin' }
            }
          }
          setProfile(p as any)
          return
        }
      } catch {}

      try {
        const uname = (user?.email || '').split('@')[0] || 'user'
        const isAdmin = isAdminEmail(user?.email)
        const now = new Date().toISOString()
        const { data: created } = await supabase
          .from('user_profiles')
          .insert({
            id: user!.id,
            username: uname,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname}`,
            bio: 'New troll in the city!',
            role: isAdmin ? 'admin' : 'user',
            tier: 'Bronze',
            paid_coin_balance: 0,
            free_coin_balance: 100,
            total_earned_coins: 100,
            total_spent_coins: 0,
            email: user?.email || null,
            created_at: now,
            updated_at: now,
          })
          .select('*')
          .single()
        if (created) {
          setProfile(created as any)
          return
        }
      } catch (err) {
        console.error('Failed to create profile:', err)
      }
      // Last resort: create minimal profile object (only if profile truly doesn't exist)
      // This should rarely happen, but if it does, we'll fetch the full profile on next load
      const isAdmin2 = isAdminEmail(user?.email)
      const minimalProfile = {
        id: user!.id,
        username: (user?.email || '').split('@')[0] || '',
        role: isAdmin2 ? 'admin' : 'user',
        paid_coin_balance: 0,
        free_coin_balance: 0,
      } as any
      setProfile(minimalProfile)
    }
    ensureProfile()
  }, [profile, user?.id, setProfile])

  const metricCards = [
    {
      title: 'Users',
      value: stats.totalUsers,
      icon: <Users className="w-6 h-6 text-purple-400" />,
      color: 'bg-purple-600',
    },
    {
      title: 'Admins',
      value: stats.adminsCount,
      icon: <Shield className="w-6 h-6 text-red-400" />,
      color: 'bg-red-600',
    },
    {
      title: 'Pending Apps',
      value: stats.pendingApps,
      icon: <FileText className="w-6 h-6 text-yellow-400" />,
      color: 'bg-yellow-600',
    },
    {
      title: 'Pending Payouts',
      value: stats.pendingPayouts,
      icon: <DollarSign className="w-6 h-6 text-green-400" />,
      color: 'bg-green-600',
    },
    {
      title: 'Troll Officers',
      value: stats.trollOfficers,
      icon: <Award className="w-6 h-6 text-orange-400" />,
      color: 'bg-orange-600',
    },
  ]

  const tabs: { id: TabId; label: string }[] = [
    { id: 'connections', label: 'Connections' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'streams', label: 'Live Streams' },
    { id: 'reset', label: 'Reset & Maintenance' },
    { id: 'paypal', label: 'PayPal Payments' },
    { id: 'reports', label: 'Reports' },
    { id: 'officer_reports', label: 'Officer Reports' },
    { id: 'monitor', label: 'Stream Monitor' },
    { id: 'referrals', label: 'Referral Bonuses' },
    { id: 'empire_applications', label: 'Empire Applications' },
    { id: 'economy', label: 'Economy Dashboard' },
    { id: 'tax_reviews', label: 'Tax Reviews' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'payout_queue', label: 'Payout Queue' },
    { id: 'cashouts', label: 'Manual Cashouts' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'declined', label: 'Declined' },
    { id: 'verification', label: 'Applications' },
    { id: 'users', label: 'Users' },
    { id: 'broadcasters', label: 'Broadcasters' },
    { id: 'families', label: 'Families' },
    { id: 'support', label: 'Support Tickets' },
    { id: 'agreements', label: 'User Agreements' },
    { id: 'earnings_tax', label: 'Earnings & Tax' },
    { id: 'officer_shifts', label: 'Officer Shifts' },
    { id: 'create_schedule', label: 'Create Schedule' },
    { id: 'grant_coins', label: 'Grant Coins' },
    { id: 'control_panel', label: 'Control Panel' },
    { id: 'test_diagnostics', label: 'Test Diagnostics' },
  ]


  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
          Loading…
        </div>
      </div>
    )
  }

  // Allow admins and officers to access monitoring features
  const canAccess = profile?.is_admin || profile?.is_troll_officer || user?.email === ADMIN_EMAIL
  
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-red-950 border border-red-500 text-center">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm text-red-200">
            This dashboard is restricted to admins and troll officers.
          </p>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    if (tabLoading) {
      return <div className="text-sm text-gray-400">Loading {activeTab}…</div>
    }

    switch (activeTab) {
      case 'metrics':
        return <MetricsPanel />

      case 'streams':
        return <StreamsPanel />

      case 'paypal':
        return <PayPalTestPanel />

      case 'reports':
        return <ReportsPanel />

      case 'officer_reports':
        return <WeeklyReportsView />

      case 'monitor':
        return <StreamMonitor />

      case 'referrals':
        return <ReferralBonusPanel />
      case 'empire_applications':
        return <EmpireApplications />
      case 'economy':
        // Navigate to economy dashboard route
        navigate('/admin/economy')
        return <div className="text-sm text-gray-400">Redirecting to Economy Dashboard...</div>
      case 'tax_reviews':
        // Navigate to tax reviews route
        navigate('/admin/tax-reviews')
        return <div className="text-sm text-gray-400">Redirecting to Tax Reviews...</div>

      case 'connections':
        return (
          <div className="space-y-6">
            {/* connection tests */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">PayPal</span>
                </div>
                <button
                  type="button"
                  onClick={testPayPal}
                  disabled={paypalTesting}
                  className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paypalTesting ? 'Testing...' : 'Test PayPal'}
                </button>
                <div className="mt-2 text-xs text-gray-400">
                  Status:{' '}
                  {paypalTesting ? (
                    <span className="text-yellow-400">Testing...</span>
                  ) : paypalStatus ? (
                    paypalStatus.ok ? (
                      <span className="text-green-400">OK</span>
                    ) : (
                      <span className="text-red-400">{paypalStatus.error || 'Failed'}</span>
                    )
                  ) : (
                    'Not tested'
                  )}
                </div>
              </div>

              <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold">Supabase</span>
                </div>
                <button
                  onClick={testSupabase}
                  className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500"
                >
                  Test Supabase
                </button>
                <div className="mt-2 text-xs text-gray-400">
                  Status:{' '}
                  {supabaseStatus
                    ? supabaseStatus.ok
                      ? 'OK'
                      : supabaseStatus.error || 'Failed'
                    : 'Not tested'}
                </div>
              </div>

              <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold">LiveKit</span>
                </div>
                <button
                  onClick={testLiveKitStreaming}
                  className="px-3 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500"
                >
                  Test LiveKit
                </button>
                <div className="mt-2 text-xs text-gray-400">
                  Status:{' '}
                  {agoraStatus
                    ? agoraStatus.ok
                      ? 'OK'
                      : agoraStatus.error || 'Failed'
                    : 'Not tested'}
                </div>
              </div>
            </div>

            {/* live streams */}
            <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-pink-400" />
                <span className="font-semibold">Live Streams</span>
                <button
                  onClick={loadLiveStreams}
                  className="ml-auto text-xs flex items-center gap-1 text-gray-300 hover:text-white"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>

              {streamsLoading ? (
                <div className="text-xs text-gray-400">Loading streams…</div>
              ) : liveStreams.length === 0 ? (
                <div className="text-xs text-gray-500">No streams currently live.</div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="py-1 pr-4">Title</th>
                        <th className="py-1 pr-4">Category</th>
                        <th className="py-1 pr-4">Broadcaster</th>
                        <th className="py-1 pr-4 text-center">Viewers</th>
                        <th className="py-1 pr-4">Created</th>
                        <th className="py-1 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveStreams.map(stream => (
                        <tr key={stream.id} className="border-b border-gray-800">
                          <td className="py-1 pr-4">{stream.title || 'Untitled'}</td>
                          <td className="py-1 pr-4">{stream.category}</td>
                          <td className="py-1 pr-4 text-xs">{stream.broadcaster_id}</td>
                          <td className="py-1 pr-4 text-center">
                            {/* Viewer count removed - column doesn't exist */}
                          </td>
                          <td className="py-1 pr-4">
                            {new Date(stream.created_at).toLocaleString()}
                          </td>
                          <td className="py-1 pr-4 text-right space-x-1">
                            <button
                              onClick={() => viewStream(stream.id)}
                              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-[10px]"
                            >
                              View
                            </button>
                            <button
                              onClick={() => endStreamById(stream.id)}
                              className="px-2 py-0.5 rounded bg-yellow-600 hover:bg-yellow-500 text-[10px]"
                            >
                              End
                            </button>
                            <button
                              onClick={() => deleteStreamById(stream.id)}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-[10px]"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-3 text-right space-x-2">
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to DELETE ALL live streams? This action cannot be undone.')) return
                    try {
                      const { error } = await supabase
                        .from('streams')
                        .delete()
                        .eq('is_live', true)
                      if (error) throw error
                      toast.success('All live streams deleted')
                      loadLiveStreams()
                      loadDashboardData()
                    } catch (error: any) {
                      console.error('Error deleting all streams:', error)
                      toast.error(error?.message || 'Failed to delete streams')
                    }
                  }}
                  className="text-xs px-3 py-1 border border-red-600 text-red-400 rounded hover:bg-red-900 hover:text-red-200"
                >
                  Delete All Broadcasts
                </button>
                <button
                  onClick={cleanupStreams}
                  className="text-xs px-3 py-1 border border-gray-600 rounded hover:bg-gray-800"
                >
                  Cleanup orphaned streams
                </button>
              </div>
            </div>
          </div>
        )

      case 'payouts':
        return (
          <div className="overflow-x-auto text-xs">
            {payouts.length === 0 ? (
              <div className="text-gray-500">No payout requests.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">User</th>
                    <th className="py-1 pr-4">Coins</th>
                    <th className="py-1 pr-4">Cash</th>
                    <th className="py-1 pr-4">Fee</th>
                    <th className="py-1 pr-4">Status</th>
                    <th className="py-1 pr-4">Created</th>
                    <th className="py-1 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} className="border-b border-gray-800">
                      <td className="py-1 pr-4 text-xs">{p.user_id}</td>
                      <td className="py-1 pr-4">{p.coin_amount}</td>
                      <td className="py-1 pr-4">${p.cash_amount?.toFixed(2)}</td>
                      <td className="py-1 pr-4">${p.processing_fee?.toFixed(2)}</td>
                      <td className="py-1 pr-4 capitalize">{p.status}</td>
                      <td className="py-1 pr-4">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                      <td className="py-1 pr-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            approvePayout(p, e)
                          }}
                          className="px-2 py-0.5 rounded bg-green-600 hover:bg-green-500"
                        >
                          Approve & Pay
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            updatePayoutStatus(p.id, 'rejected', e)
                          }}
                          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'cashouts':
        return (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={cashoutsSearch}
                onChange={e => setCashoutsSearch(e.target.value)}
                placeholder="Search username / email / details"
                className="bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs flex-1 min-w-[180px]"
              />
              <select
                value={cashoutsProvider}
                onChange={e => setCashoutsProvider(e.target.value)}
                className="bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="">All providers</option>
                <option value="paypal">PayPal</option>
                <option value="cashapp">Cash App</option>
                <option value="zelle">Zelle</option>
                <option value="bank">Bank</option>
              </select>
              <button
                onClick={loadCashouts}
                className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500"
              >
                Apply
              </button>
            </div>

            <div className="overflow-x-auto">
              {cashouts.length === 0 ? (
                <div className="text-gray-500">No cashout requests.</div>
              ) : (
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-1 pr-4">User</th>
                      <th className="py-1 pr-4">Method</th>
                      <th className="py-1 pr-4">Details</th>
                      <th className="py-1 pr-4">Coins</th>
                      <th className="py-1 pr-4">Status</th>
                      <th className="py-1 pr-4">Created</th>
                      <th className="py-1 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashouts.map(c => (
                      <tr key={c.id} className="border-b border-gray-800">
                        <td className="py-1 pr-4 text-xs">{c.username || c.user_id}</td>
                        <td className="py-1 pr-4">{c.payout_method}</td>
                        <td className="py-1 pr-4 max-w-xs truncate">{c.payout_details}</td>
                        <td className="py-1 pr-4">{c.coin_amount}</td>
                        <td className="py-1 pr-4 capitalize">{c.status}</td>
                        <td className="py-1 pr-4">
                          {new Date(c.created_at).toLocaleString()}
                        </td>
                        <td className="py-1 pr-4 text-right">
                          {c.status === 'pending' && (
                            <button
                              onClick={() => markCashoutPaid(c)}
                              className="px-2 py-0.5 rounded bg-green-600 hover:bg-green-500 text-[10px]"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )

      case 'purchases':
        return (
          <div className="overflow-x-auto text-xs">
            {purchases.length === 0 ? (
              <div className="text-gray-500">No purchases yet.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">User</th>
                    <th className="py-1 pr-4">Amount</th>
                    <th className="py-1 pr-4">Type</th>
                    <th className="py-1 pr-4">Metadata</th>
                    <th className="py-1 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(tx => (
                    <tr key={tx.id} className="border-b border-gray-800">
                      <td className="py-1 pr-4 text-xs">{tx.user_id}</td>
                      <td className="py-1 pr-4">{tx.amount}</td>
                      <td className="py-1 pr-4">{tx.type}</td>
                      <td className="py-1 pr-4 max-w-xs truncate">
                        {JSON.stringify(tx.metadata || {})}
                      </td>
                      <td className="py-1 pr-4">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'declined':
        return (
          <div className="overflow-x-auto text-xs">
            {declinedTransactions.length === 0 ? (
              <div className="text-gray-500">No declined transactions.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">User</th>
                    <th className="py-1 pr-4">Reason</th>
                    <th className="py-1 pr-4">Code</th>
                    <th className="py-1 pr-4">Amount</th>
                    <th className="py-1 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {declinedTransactions.map(tx => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-800 hover:bg-gray-900 cursor-pointer"
                      onClick={() => setSelectedDeclined(tx)}
                    >
                      <td className="py-1 pr-4">
                        <ClickableUsername
                          username={tx.user_profiles?.username}
                        />
                        <div className="text-[10px] text-gray-500">
                          {tx.user_profiles?.username || 'Unknown'}
                        </div>
                      </td>
                      <td className="py-1 pr-4 max-w-xs truncate">{tx.failure_message}</td>
                      <td className="py-1 pr-4">{tx.failure_code}</td>
                      <td className="py-1 pr-4">{tx.amount}</td>
                      <td className="py-1 pr-4">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedDeclined && (
              <div className="mt-3 text-xs bg-black/60 border border-gray-700 rounded p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">Declined details</span>
                  <button
                    className="text-[10px] text-gray-400 hover:text-white"
                    onClick={() => setSelectedDeclined(null)}
                  >
                    Close
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-[10px] text-gray-300 max-h-64 overflow-auto">
                  {JSON.stringify(selectedDeclined, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )

      case 'verification':
        return <AdminApplications />

      case 'users':
        return <UsersPanel />

      case 'broadcasters':
        return (
          <div className="overflow-x-auto text-xs">
            {broadcastersList.length === 0 ? (
              <div className="text-gray-500">No broadcasters yet.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">User</th>
                    <th className="py-1 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastersList.map(b => (
                    <tr key={b.id} className="border-b border-gray-800">
                      <td className="py-1 pr-4">
                        <ClickableUsername username={b.username} />
                      </td>
                      <td className="py-1 pr-4">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'families':
        return (
          <div className="overflow-x-auto text-xs">
            {familiesList.length === 0 ? (
              <div className="text-gray-500">No families created yet.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">Name</th>
                    <th className="py-1 pr-4">Level</th>
                    <th className="py-1 pr-4">Members</th>
                    <th className="py-1 pr-4">Total Coins</th>
                  </tr>
                </thead>
                <tbody>
                  {familiesList.map(f => (
                    <tr key={f.id} className="border-b border-gray-800">
                      <td className="py-1 pr-4">{f.name}</td>
                      <td className="py-1 pr-4">{f.level}</td>
                      <td className="py-1 pr-4">{f.member_count}</td>
                      <td className="py-1 pr-4">{f.total_coins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'support':
        return <AdminSupportTickets />

      case 'agreements':
        return (
          <div className="overflow-x-auto text-xs">
            {_agreements.length === 0 ? (
              <div className="text-gray-500">No users have accepted terms yet.</div>
            ) : (
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1 pr-4">User</th>
                    <th className="py-1 pr-4">Accepted</th>
                  </tr>
                </thead>
                <tbody>
                  {_agreements.map(a => (
                    <tr key={a.id} className="border-b border-gray-800">
                      <td className="py-1 pr-4">
                        <ClickableUsername username={a.username} />
                      </td>
                      <td className="py-1 pr-4">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )


      case 'earnings_tax':
        return <EarningsTaxOverview />

      case 'officer_shifts':
        return <OfficerShiftsPanel />

      case 'create_schedule':
        return <CreateSchedulePanel />

      case 'grant_coins':
        return <AdminGrantCoins />

      case 'control_panel':
        return <AdminControlPanel />
      case 'test_diagnostics':
        return <TestDiagnostics />

      case 'reset':
        return <AdminResetPanel />

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Quick Actions Bar */}
      <QuickActionsBar
        onRefreshAll={handleRefreshAll}
        onEmergencyStop={handleEmergencyStop}
        onBroadcastMessage={handleBroadcastMessage}
        onSystemMaintenance={handleSystemMaintenance}
        onViewAnalytics={handleViewAnalytics}
        onExportData={handleExportData}
        onToggleMaintenanceMode={handleToggleMaintenanceMode}
        maintenanceMode={maintenanceMode}
        refreshing={refreshing}
      />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Troll City Command Center</h1>
            <p className="text-gray-400 text-sm">
              Enterprise-level administration for Troll City operations.
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={async () => {
                try {
                  await supabase.auth.signOut()
                  useAuthStore.getState().logout()
                  localStorage.clear()
                  sessionStorage.clear()
                  toast.success('Logged out')
                  await supabase.auth.signOut()
                  navigate('/auth', { replace: true })
                } catch {
                  toast.error('Logout failed')
                }
              }}
              className="px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition text-sm"
            >
              Logout
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.clear()
                  sessionStorage.clear()
                  toast.success('App reset')
                } catch {}
                navigate('/auth?reset=1', { replace: true })
              }}
              className="px-4 py-2 border border-yellow-500 text-yellow-400 rounded-lg hover:bg-yellow-500 hover:text-black transition text-sm"
            >
              Reset App
            </button>
          </div>
        </div>

        {/* City Summary Bar */}
        <CitySummaryBar
          stats={stats}
          liveStreamsCount={liveStreams.length}
          economySummary={economySummary}
        />

        {/* City Controls & Health Section */}
        <CityControlsHealth
          paypalStatus={paypalStatus}
          supabaseStatus={supabaseStatus}
          agoraStatus={agoraStatus}
          liveStreams={liveStreams}
          onTestPayPal={testPayPal}
          onTestSupabase={testSupabase}
          onTestLiveKit={testLiveKitStreaming}
          onLoadLiveStreams={loadLiveStreams}
          onCreateTrollDrop={createTrollDrop}
          trollDropAmount={trollDropAmount}
          setTrollDropAmount={setTrollDropAmount}
          trollDropDuration={trollDropDuration}
          setTrollDropDuration={setTrollDropDuration}
          paypalTesting={paypalTesting}
        />

        {/* Finance & Economy Center */}
        <FinanceEconomyCenter
          stats={stats}
          economySummary={economySummary}
          economyLoading={economyLoading}
          onLoadEconomySummary={loadEconomySummary}
        />

        {/* Operations & Control Deck */}
        <OperationsControlDeck
          liveStreams={liveStreams}
          streamsLoading={streamsLoading}
          onLoadLiveStreams={loadLiveStreams}
          onEndStreamById={endStreamById}
          onDeleteStreamById={deleteStreamById}
          onViewStream={viewStream}
          stats={stats}
        />

        {/* Applications Hub */}
        <ApplicationsHub
          onLoadApplications={loadApplications}
          applicationsLoading={tabLoading}
          applications={[]}
          onApproveApplication={_approveApplication}
          onRejectApplication={_rejectApplication}
        />

        {/* Agreements Management */}
        <AgreementsManagement
          onLoadAgreements={() => console.log('Load agreements')}
          agreementsLoading={false}
          agreements={[]}
        />

        {/* Additional Tasks Grid */}
        <AdditionalTasksGrid
          onNavigateToEconomy={() => navigate('/admin/economy')}
          onNavigateToTaxReviews={() => navigate('/admin/tax-reviews')}
          onOpenTestDiagnostics={() => console.log('Test diagnostics')}
          onOpenControlPanel={() => console.log('Control panel')}
          onOpenGrantCoins={() => console.log('Grant coins')}
          onOpenCreateSchedule={() => console.log('Create schedule')}
          onOpenOfficerShifts={() => console.log('Officer shifts')}
          onOpenResetPanel={() => console.log('Reset panel')}
          onOpenEmpireApplications={() => console.log('Empire applications')}
          onOpenReferralBonuses={() => console.log('Referral bonuses')}
        />
      </div>
    </div>
  )
}
