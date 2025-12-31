// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react'
import './admin.css'
import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail } from '../../lib/supabase'
import { sendNotification } from '../../lib/sendNotification'
import { Users, DollarSign, Award, Shield, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import _api from '../../lib/api'
import _ClickableUsername from '../../components/ClickableUsername'
import _ProfitSummary from '../../components/ProfitSummary'
import { TestingModeControl as _TestingModeControl } from '../../components/TestingModeControl'
import CitySummaryBar from './components/CitySummaryBar'
import CityControlsHealth from './components/CityControlsHealth'
import FinanceEconomyCenter from './components/FinanceEconomyCenter'
import OperationsControlDeck from './components/OperationsControlDeck'
import AdditionalTasksGrid from './components/AdditionalTasksGrid'
import TrollsNightReviewPanel from '../../components/TrollsNightReviewPanel'
import QuickActionsBar from './components/QuickActionsBar'
import _AgreementsManagement from './components/AgreementsManagement'
import _IPTracking from './components/IPTracking'

// Import missing components
import _MetricsPanel from './components/MetricsPanel'
import _StreamsPanel from './components/StreamsPanel'
import _PayPalTestPanel from './components/PayPalTestPanel'
import _ReportsPanel from './components/ReportsPanel'
import _WeeklyReportsView from './WeeklyReportsView'
import _StreamMonitor from './components/StreamMonitor'
import _ReferralBonusPanel from './ReferralBonusPanel'
import _EmpireApplications from './EmpireApplications'
import _AdminApplications from './components/AdminApplications'
import _UsersPanel from './components/UsersPanel'
import _AdminSupportTickets from './components/AdminSupportTickets'
import _EarningsTaxOverview from './components/EarningsTaxOverview'
import _OfficerShiftsPanel from './components/OfficerShiftsPanel'
import _CreateSchedulePanel from './components/CreateSchedulePanel'
import { AdminGrantCoins as _AdminGrantCoins } from './components/AdminGrantCoins'
import _AdminControlPanel from './components/AdminControlPanel'
import _TestDiagnostics from './components/TestDiagnostics'
import _AdminResetPanel from './AdminResetPanel'
import _PayoutQueue from './components/PayoutQueue'
import _PayPalPayoutManager from './components/PayPalPayoutManager'
import MAIAuthorityPanel from '../../components/mai/MAIAuthorityPanel'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isValidUuid = (value?: string) => Boolean(value && UUID_REGEX.test(value))

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
  trollmonds: number
  giftCoins: number
  appSponsoredGifts: number
  savPromoCount: number
  total_liability_coins: number
  total_platform_profit_usd: number
  kick_ban_revenue: number
}

interface EconomySummary {
  troll_coins: {
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
  messages?: {
    totalPayments: number
    totalIncome: number
    transactionCount: number
  }
}

type TabId =
  | 'hr'
  | 'all_hr'
  | 'database_backup'
  | 'system_health'
  | 'cache_clear'
  | 'system_config'
  | 'user_search'
  | 'ban_management'
  | 'reports_queue'
  | 'role_management'
  | 'stream_monitor'
  | 'media_library'
  | 'chat_moderation'
  | 'announcements'
  | 'economy_dashboard'
  | 'finance_dashboard'
  | 'cost_dashboard'
  | 'grant_coins'
  | 'tax_reviews'
  | 'payment_logs'
  | 'store_pricing'
  | 'create_schedule'
  | 'officer_shifts'
  | 'shift_requests_approval'
  | 'empire_applications'
  | 'referral_bonuses'
  | 'control_panel'
  | 'test_diagnostics'
  | 'reset_maintenance'
  | 'export_data'
  | 'connections'
  | 'payouts'
  | 'payout_queue'
  | 'cashouts'
  | 'purchases'
  | 'declined'
  | 'verification'
  | 'users'
  | 'broadcasters'
  | 'families'
  | 'support'
  | 'agreements'
  | 'reports'

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
        const email = session.user.email || ''
        const isAdminEmailMatch = isAdminEmail(email)
        const isAdmin =
          profileData?.role === 'admin' ||
          profileData?.is_admin === true ||
          isAdminEmailMatch

        const isOfficerRole =
          profileData?.role === 'troll_officer' ||
          profileData?.role === 'lead_troll_officer'

        if (isOfficerRole) {
          setIsAuthorized(false)
          return
        }

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
    trollmonds: 0,
    giftCoins: 0,
    appSponsoredGifts: 0,
    savPromoCount: 0,
    total_liability_coins: 0,
    total_platform_profit_usd: 0,
    kick_ban_revenue: 0,
  })

  const [activeTab, setActiveTab] = useState<TabId>('connections')
  const [_loading, _setLoading] = useState(false)

  const [_cashouts, _setCashouts] = useState<any[]>([])
  const [_cashoutsSearch, _setCashoutsSearch] = useState('')
  const [_cashoutsProvider, _setCashoutsProvider] = useState('')
  const [, setTabLoading] = useState(false)
  const [_purchases, _setPurchases] = useState<any[]>([])
  const [_declinedTransactions, _setDeclinedTransactions] = useState<any[]>([])
  const [_selectedDeclined, _setSelectedDeclined] = useState<any | null>(null)
  const [_verifications, setVerifications] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [_broadcastersList, _setBroadcastersList] = useState<any[]>([])
  const [_familiesList, _setFamiliesList] = useState<any[]>([])
  const [_supportTickets, setSupportTickets] = useState<any[]>([])
  const [_agreements, setAgreements] = useState<any[]>([])
  const [liveKitStatus, setLiveKitStatus] = useState<any | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null)
  const [paypalStatus, setPaypalStatus] = useState<any | null>(null)
  const [paypalTesting, setPaypalTesting] = useState(false)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)
  const [_scheduledAnnouncements, _setScheduledAnnouncements] = useState<any[]>([])
  const [clearingSeedApplications, setClearingSeedApplications] = useState(false)

  // Economy summary
  const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
  const [_economySummaryData, _setEconomySummaryData] = useState<any>(null)
  const [economyLoading, setEconomyLoading] = useState(false)

  // Risk overview
  const [_risk, _setRisk] = useState<{ frozenCount: number; topHighRisk: any[] } | null>(null)

  // Shop revenue
  const [_shopRevenue, _setShopRevenue] = useState<{
    insuranceTotal: number
    effectsTotal: number
    perksTotal: number
    topBuyers: any[]
  } | null>(null)

  // Live streams
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [selectedStream, setSelectedStream] = useState<any | null>(null)
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [_selectedUserId, _setSelectedUserId] = useState('')
  const [_actionUntil, _setActionUntil] = useState('')

  // New dashboard state
  const [maintenanceMode, setMaintenanceMode] = useState(false)

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
      })
      .subscribe()

    const earningsChannel = supabase
      .channel('admin-global-earnings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'earnings_payouts' }, () => {
        loadDashboardData()
        loadEconomySummary()
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
    _setLoading(true)
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
        .select('troll_coins, sav_bonus_coins'),
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
      let trollmonds = 0
      let savBonusTotal = 0
      for (const row of balances as any[]) {
        purchasedCoins += Number(row.troll_coins || 0)
        trollmonds += Number(row.troll_coins || 0)
        savBonusTotal += Number(row.sav_bonus_coins || 0)
      }
      const freeCoins = trollmonds + savBonusTotal
      const totalCoins = purchasedCoins + trollmonds
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
      const appSponsoredGifts = savBonusTotal
      const savPromoCount = balances.filter((b: any) => Number(b.sav_bonus_coins || 0) > 0).length

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
        trollmonds,
        earnedCoins: 0,
        freeCoins,
        totalCoinsInCirculation: totalCoins,
        totalValue,
        coinSalesRevenue,
        totalPayouts,
        feesCollected,
        platformProfit,
        giftCoins,
        appSponsoredGifts,
        savPromoCount,
        total_liability_coins: 0,
        total_platform_profit_usd: platformProfit,
        kick_ban_revenue: 0,
      }))

      _setBroadcastersList([])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      _setLoading(false)
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
        _setEconomySummaryData(summary)
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
        const { data: troll_coinsTx } = await supabase
          .from('coin_transactions')
          .select('user_id, amount, type')
          .in('type', ['purchase', 'cashout'])

        const troll_coinsMap: Record<string, { purchased: number; spent: number }> = {};
        ;(troll_coinsTx || []).forEach((tx: any) => {
          const existing = troll_coinsMap[tx.user_id] || { purchased: 0, spent: 0 }
          if (tx.type === 'purchase') existing.purchased += Math.abs(Number(tx.amount || 0))
          if (tx.type === 'cashout') existing.spent += Math.abs(Number(tx.amount || 0))
          troll_coinsMap[tx.user_id] = existing
        })

        let totalPurchased = 0
        let totalSpent = 0
        Object.values(troll_coinsMap).forEach(v => { totalPurchased += v.purchased; totalSpent += v.spent })
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

        let messageStats = {
          totalPayments: 0,
          totalIncome: 0,
          transactionCount: 0
        }
        try {
          const { data: messageTx } = await supabase
            .from('coin_transactions')
            .select('amount, type')
            .in('type', ['message_payment', 'message_income'])

          let totalMessagePayments = 0
          let totalMessageIncome = 0
          ;(messageTx || []).forEach((tx: any) => {
            if (tx.type === 'message_payment') {
              totalMessagePayments += Math.abs(Number(tx.amount || 0))
            } else if (tx.type === 'message_income') {
              totalMessageIncome += Number(tx.amount || 0)
            }
          })

          messageStats = {
            totalPayments: totalMessagePayments,
            totalIncome: totalMessageIncome,
            transactionCount: (messageTx || []).length
          }
        } catch (messageErr) {
          console.warn('Failed to load message transaction summary:', messageErr)
        }

        setEconomySummary({
          troll_coins: { totalPurchased, totalSpent, outstandingLiability },
          broadcasters: { totalUsdOwed, pendingCashoutsUsd, paidOutUsd },
          officers: { totalUsdPaid },
          wheel: { totalSpins, totalCoinsSpent, totalCoinsAwarded, jackpotCount },
          messages: messageStats
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

      _setShopRevenue({
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
        _setRisk(json.data)
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

  const _banSelectedUser = async () => {
    if (!_selectedUserId || !_actionUntil) return
    try {
      const until = new Date(_actionUntil).toISOString()
      const { error } = await supabase.rpc('ban_user', {
        p_user_id: _selectedUserId,
        p_until: until,
      })
      if (error) throw error
      toast.success('User banned')
    } catch {
      toast.error('Failed to ban user')
    }
  }

  const _resetSelectedUserCoins = async () => {
    if (!_selectedUserId) return
    try {
      const { error } = await supabase.rpc('reset_user_coins', {
        p_user_id: _selectedUserId,
      })
      if (error) throw error
      toast.success('Coins reset')
    } catch {
      toast.error('Failed to reset coins')
    }
  }

  const _addCoinsToAdmin = async () => {
    if (!user?.id) {
      toast.error('User ID not found')
      return
    }
    
    try {
      // Get current balance before adding
      const { data: beforeData } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single()
      
      const beforeBalance = beforeData?.troll_coins || 0
      
      // Call RPC function
      const { data: _data, error } = await supabase.rpc('add_troll_coins', {
        user_id_input: user.id,
        coins_to_add: 12000
      })
      
      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      // Verify the balance was actually updated
      const { data: afterData, error: verifyError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single()
      
      if (verifyError) {
        console.error('Verification error:', verifyError)
        throw new Error('Failed to verify coins were added')
      }
      
      const afterBalance = afterData?.troll_coins || 0
      const actualAdded = afterBalance - beforeBalance
      
      if (actualAdded !== 12000) {
        console.warn(`Expected to add 12000 coins, but only added ${actualAdded}`)
        toast.warning(`Added ${actualAdded} coins (expected 12000). Balance may have been updated.`)
      } else {
        toast.success(`Added 12000 troll_coins! New balance: ${afterBalance.toLocaleString()}`)
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

          if (error && error.code !== 'PGRST205' && error.code !== '42P01' && error.code !== '42501') {
            console.warn(`Could not delete from ${table}:`, error)
          }
        }

        const cleanupStreamParticipants = async () => {
          const { error } = await supabase.functions.invoke('streams-maintenance', {
            body: {
              action: 'delete_stream',
              stream_id: id
            }
          })

          if (error) {
            console.warn('Failed to clean up stream participants via service function', error)
          }
        }

      // Delete related data in parallel (non-blocking)
        await Promise.allSettled([
          deleteRelatedData('messages'),
          deleteRelatedData('stream_reports'),
          cleanupStreamParticipants(),
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
    navigate(`/live/${id}?admin=1`)
  }

  const _flagSelectedUserAI = async () => {
    if (!_selectedUserId) return
    try {
      const { error } = await supabase
        .from('admin_flags')
        .insert({ user_id: _selectedUserId, reason: 'ai_flag' })
      if (error) throw error
      toast.success('AI flag recorded')
    } catch {
      toast.error('Failed to record flag')
    }
  }

  const testLiveKitStreaming = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { room: 'admin-test', identity: profile?.username || 'admin', user_id: profile?.id, allowPublish: true }
      })

      if (error || !data?.token) {
        setLiveKitStatus({ ok: false, error: (error as any)?.message || 'Token error' })
        toast.error('LiveKit test failed')
      } else {
        setLiveKitStatus({ ok: true })
        toast.success('LiveKit token generated')
      }
    } catch (e: any) {
      setLiveKitStatus({ ok: false, error: e?.message || 'LiveKit request failed' })
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


  // Mark a cashout as paid, deduct coins, and notify the user
  const _markCashoutPaid = async (r: any) => {
    try {
      // 1) Get latest wallet balance
      const { data: profileRow, error: profErr } = await supabase
        .from('user_profiles')
        .select('id, troll_coins')
        .eq('id', r.user_id)
        .maybeSingle();

      if (profErr || !profileRow) {
        console.error(profErr);
        toast.error('Could not load user profile for payout');
        return;
      }

      const requestedCoins = Number(r.requested_coins || 0);
      const currentBal = Number(profileRow.troll_coins || 0);
      const newBal = Math.max(0, currentBal - requestedCoins);

      // 2) Deduct coins from user wallet
      await supabase
        .from('user_profiles')
        .update({ troll_coins: newBal })
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
      const { data: _testData, error: testError } = await supabase
        .from('scheduled_announcements')
        .select('id')
        .limit(1)
      
      // If table doesn't exist (PGRST205 = table not found), skip silently
      if (testError?.code === 'PGRST205' || testError?.code === '42P01') {
        _setScheduledAnnouncements([])
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
            _setScheduledAnnouncements([])
            return
          }
          
          if (dataNoOrder) {
            // Sort manually by created_at if scheduled_time doesn't exist
            const sorted = [...(dataNoOrder || [])].sort((a, b) => {
              const aTime = a.scheduled_time || a.created_at || ''
              const bTime = b.scheduled_time || b.created_at || ''
              return new Date(aTime).getTime() - new Date(bTime).getTime()
            })
            _setScheduledAnnouncements(sorted)
            return
          }
        }
        // For other errors, just skip silently
        _setScheduledAnnouncements([])
        return
      }
      
      if (data) {
        _setScheduledAnnouncements(data)
      } else {
        _setScheduledAnnouncements([])
      }
    } catch {
      // Silently fail - this is a non-critical feature
      _setScheduledAnnouncements([])
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
      if (_cashoutsProvider) query = query.eq('payout_method', _cashoutsProvider)
      if (_cashoutsSearch)
        query = query.or(
          `username.ilike.*${_cashoutsSearch}*,email.ilike.*${_cashoutsSearch}*,payout_details.ilike.*${_cashoutsSearch}*`
        )
      const { data } = await query
      _setCashouts(data || [])
    } catch {
      _setCashouts([])
    } finally {
      setTabLoading(false)
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
      _setPurchases(data || [])
    } catch {
      _setPurchases([])
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
      _setDeclinedTransactions(data || [])
    } catch (err) {
      console.error('Failed to load declined transactions:', err)
      _setDeclinedTransactions([])
    } finally {
      setTabLoading(false)
    }
  }

  const loadVerifications = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          user_id,
          status,
          created_at,
          type,
          experience,
          reason,
          content_type,
          followers,
          portfolio,
          approved_at,
          user_profiles!applications_user_id_fkey(username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Admin] Load applications error:', error)
        setVerifications([])
      } else {
        const validApps = (data || []).filter(
          (app: any) => isValidUuid(app.id) && isValidUuid(app.user_id)
        )
        setVerifications(validApps)
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
    if (!isValidUuid(id)) {
      toast.error('Invalid application identifier')
      console.warn('[Admin] Reject called with invalid id', id)
      return
    }
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
    if (!isValidUuid(appId) || !isValidUuid(userId)) {
      toast.error('Invalid application or user identifier')
      console.warn('[Admin] Approve called with invalid ids', { appId, userId })
      return
    }
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

  const _clearSeedApplications = async () => {
    if (clearingSeedApplications) return
    setClearingSeedApplications(true)
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .or('user_id.ilike.user-% , id.eq.2')

      if (error) throw error

      toast.success('Seeded bot applications removed')
      await loadApplications()
    } catch (err) {
      console.error('[Admin] Clear seeded applications error:', err)
      toast.error('Failed to clear seeded applications')
    } finally {
      setClearingSeedApplications(false)
    }
  }

  const _deleteApplication = async (appId: string) => {
    if (!isValidUuid(appId)) {
      toast.error('Invalid application identifier')
      return
    }
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', appId)

      if (error) throw error

      toast.success('Application deleted')
      await loadApplications()
    } catch (err) {
      console.error('[Admin] Delete application error:', err)
      toast.error('Failed to delete application')
    }
  }

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
      _setBroadcastersList(data || [])
    } catch {
      _setBroadcastersList([])
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
      _setFamiliesList(data || [])
    } catch {
      _setFamiliesList([])
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

  const _cleanupStreams = () => {
    toast.success('Stream cleanup initiated')
    setTimeout(() => {
      toast.success('Stream cleanup completed')
    }, 2000)
  }

  // New dashboard handlers
  const handleEmergencyStop = () => {
    toast.warning('Emergency stop initiated - stopping all streams')
    // Implement emergency stop logic
  }

  const handleBroadcastMessage = () => {
    setActiveTab('announcements')
  }

  const handleSystemMaintenance = () => {
    setActiveTab('reset_maintenance')
  }

  const handleViewAnalytics = () => {
    setActiveTab('reports')
  }

  const handleExportData = () => {
    setActiveTab('export_data')
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
        break
      case 'payout_queue':
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
            troll_coins: 0,
            troll_coins: 100,
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
        troll_coins: 0,
        troll_coins: 0,
      } as any
      setProfile(minimalProfile)
    }
    ensureProfile()
  }, [profile, user?.id, setProfile])

  const _metricCards = [
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

  const handleSelectTab = (tabId: TabId) => {
    setActiveTab(tabId)
    if (tabId === 'finance_dashboard') {
      navigate('/admin/finance')
    }
  }

  const redirectRoutes = useMemo(
    () =>
      ({
        hr: '/admin/hr',
        all_hr: '/admin/hr',
        database_backup: '/admin/system/backup',
        cache_clear: '/admin/system/cache',
        system_config: '/admin/system/config',
        user_search: '/admin/user-search',
        ban_management: '/admin/ban-management',
        reports_queue: '/admin/reports-queue',
        role_management: '/admin/role-management',
        stream_monitor: '/admin/stream-monitor',
        media_library: '/admin/media-library',
        chat_moderation: '/admin/chat-moderation',
        announcements: '/admin/announcements',
        economy_dashboard: '/admin/economy',
        grant_coins: '/admin/grant-coins',
        tax_reviews: '/admin/tax-reviews',
        payment_logs: '/admin/payment-logs',
        store_pricing: '/admin/store-pricing',
        create_schedule: '/admin/create-schedule',
        officer_shifts: '/admin/officer-shifts',
        shift_requests_approval: '/admin/shift-requests-approval',
        empire_applications: '/admin/empire-applications',
        referral_bonuses: '/admin/referral-bonuses',
        control_panel: '/admin/control-panel',
        test_diagnostics: '/admin/test-diagnostics',
        reset_maintenance: '/admin/reset-maintenance',
        export_data: '/admin/export-data',
      } as Record<TabId, string>),
    []
  )

  useEffect(() => {
    const target = redirectRoutes[activeTab]
    if (target) {
      navigate(target)
    }
  }, [activeTab, navigate, redirectRoutes])


  if (adminCheckLoading || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
          Loading admin dashboard
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-red-950 border border-red-500 text-center">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm text-red-200">
            This dashboard is limited to administrators only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Quick Actions Bar */}
      <QuickActionsBar
        onEmergencyStop={handleEmergencyStop}
        onBroadcastMessage={handleBroadcastMessage}
        onSystemMaintenance={handleSystemMaintenance}
        onViewAnalytics={handleViewAnalytics}
        onExportData={handleExportData}
        onToggleMaintenanceMode={handleToggleMaintenanceMode}
        maintenanceMode={maintenanceMode}
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-5">
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

        <MAIAuthorityPanel mode="admin" location="admin_dashboard" />

        {/* City Controls & Health Section */}
        <CityControlsHealth
          paypalStatus={paypalStatus}
          supabaseStatus={supabaseStatus}
          liveKitStatus={liveKitStatus}
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

        <TrollsNightReviewPanel title="Trolls @ Night verification desk" />

          {/* Admin Modules */}
          {/* <AdminApplications /> */}

          {/* Agreements Management */}
          {/* <AgreementsManagement
            onLoadAgreements={() => console.log('Load agreements')}
            agreementsLoading={false}
            agreements={[]}
          /> */}

        {/* Additional Tasks Grid */}
        <AdditionalTasksGrid
          onSelectTab={handleSelectTab}
          onNavigateToEconomy={() => navigate('/admin/economy')}
          onNavigateToTaxReviews={() => navigate('/admin/tax-reviews')}
          onOpenTestDiagnostics={() => navigate('/admin/test-diagnostics')}
          onOpenControlPanel={() => navigate('/admin/control-panel')}
          onOpenGrantCoins={() => navigate('/admin/grant-coins')}
          onOpenFinanceDashboard={() => navigate('/admin/finance')}
          onOpenCreateSchedule={() => navigate('/admin/create-schedule')}
          onOpenOfficerShifts={() => navigate('/admin/officer-shifts')}
          onOpenResetPanel={() => navigate('/admin/reset-maintenance')}
          onOpenEmpireApplications={() => navigate('/admin/empire-applications')}
          onOpenReferralBonuses={() => navigate('/admin/referral-bonuses')}
        />
      </div>
    </div>
  )
}
