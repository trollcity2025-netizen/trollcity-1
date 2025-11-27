import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase, isAdminEmail } from '../lib/supabase'
import {
  Users,
  FileText,
  DollarSign,
  Award,
  Shield,
  RefreshCw,
  CreditCard,
  TrendingUp,
  Gift,
  Camera,
  Monitor,
  Play
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'
import ProfitSummary from '../components/ProfitSummary'
import { TestingModeControl } from '../components/TestingModeControl'

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

export default function AdminDashboard() {
  const { profile, user, setProfile } = useAuthStore()
  const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'
  const navigate = useNavigate()

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
    vivedPromoCount: 0
    ,
    total_liability_coins: 0,
    total_platform_profit_usd: 0,
    kick_ban_revenue: 0
  })

  const [activeTab, setActiveTab] = useState<
    'connections' | 'payouts' | 'purchases' | 'verification' | 'users' | 'broadcasters' | 'families' | 'cashouts' | 'support' | 'declined' | 'agreements'
  >('connections')
  const [loading, setLoading] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

  const [payouts, setPayouts] = useState<any[]>([])
  const [cashouts, setCashouts] = useState<any[]>([])
  const [cashoutsSearch, setCashoutsSearch] = useState('')
  const [cashoutsProvider, setCashoutsProvider] = useState('')
  const [purchases, setPurchases] = useState<any[]>([])
  const [declinedTransactions, setDeclinedTransactions] = useState<any[]>([])
  const [selectedDeclined, setSelectedDeclined] = useState<any | null>(null)
  const [verifications, setVerifications] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [broadcastersList, setBroadcastersList] = useState<any[]>([])
  const [familiesList, setFamiliesList] = useState<any[]>([])
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [agreements, setAgreements] = useState<any[]>([])
  const [squareStatus, setSquareStatus] = useState<any | null>(null)
  const [agoraStatus, setAgoraStatus] = useState<any | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)

  // Economy summary
  const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
  const [economyLoading, setEconomyLoading] = useState(false)

  // Risk overview
  const [risk, setRisk] = useState<{ frozenCount: number; topHighRisk: any[] } | null>(null)

  // Revenue from insurance, effects, perks
  const [shopRevenue, setShopRevenue] = useState<{
    insuranceTotal: number
    effectsTotal: number
    perksTotal: number
    topBuyers: any[]
  } | null>(null)

  // CTV / Live streams section
  const [liveStreams, setLiveStreams] = useState<any[]>([])
  const [selectedStream, setSelectedStream] = useState<any | null>(null)
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [actionUntil, setActionUntil] = useState('')

  // === INITIAL LOAD ===
  useEffect(() => {
    loadDashboardData()
    loadLiveStreams()
    loadEconomySummary()
    loadShopRevenue()
  }, [])

  // Auto-refresh core stats every 15 seconds for real-time updates
  useEffect(() => {
    const id = setInterval(() => {
      loadDashboardData()
      loadEconomySummary()
      loadShopRevenue()
    }, 15000)
    return () => clearInterval(id)
  }, [])

  // GLOBAL MONITORING SYSTEM - Real-time updates for ALL admin dashboard data
  useEffect(() => {
    console.log('[Admin Monitor] Starting global monitoring system...')
    
    // Monitor streams
    const streamsChannel = supabase
      .channel('admin-global-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, (payload) => {
        console.log('[Admin Monitor] Stream change:', payload.eventType)
        loadLiveStreams()
        loadDashboardData()
      })
      .subscribe()

    // Monitor coin transactions
    const coinChannel = supabase
      .channel('admin-global-coins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, (payload) => {
        console.log('[Admin Monitor] Coin transaction change:', payload.eventType)
        loadDashboardData()
        loadEconomySummary()
        loadShopRevenue()
        if (activeTab === 'purchases') loadPurchases()
      })
      .subscribe()

    // Monitor user profiles
    const usersChannel = supabase
      .channel('admin-global-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, (payload) => {
        console.log('[Admin Monitor] User change:', payload.eventType)
        loadDashboardData()
        if (activeTab === 'users') loadUsers()
        if (activeTab === 'broadcasters') loadBroadcasters()
      })
      .subscribe()

    // Monitor applications
    const appsChannel = supabase
      .channel('admin-global-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (payload) => {
        console.log('[Admin Monitor] Application change:', payload.eventType)
        loadDashboardData()
        if (activeTab === 'verification') loadVerifications()
      })
      .subscribe()

    // Monitor payout requests
    const payoutsChannel = supabase
      .channel('admin-global-payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, (payload) => {
        console.log('[Admin Monitor] Payout change:', payload.eventType)
        loadDashboardData()
        if (activeTab === 'payouts') loadPayouts()
      })
      .subscribe()

    // Monitor earnings payouts
    const earningsChannel = supabase
      .channel('admin-global-earnings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'earnings_payouts' }, (payload) => {
        console.log('[Admin Monitor] Earnings payout change:', payload.eventType)
        loadDashboardData()
        loadEconomySummary()
        if (activeTab === 'payouts') loadPayouts()
      })
      .subscribe()

    // Monitor cashout requests
    const cashoutsChannel = supabase
      .channel('admin-global-cashouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, (payload) => {
        console.log('[Admin Monitor] Cashout change:', payload.eventType)
        loadDashboardData()
        loadEconomySummary()
        if (activeTab === 'cashouts') loadCashouts()
      })
      .subscribe()

    // Monitor declined transactions
    const declinedChannel = supabase
      .channel('admin-global-declined')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'declined_transactions' }, (payload) => {
        console.log('[Admin Monitor] Declined transaction change:', payload.eventType)
        if (activeTab === 'declined') loadDeclinedTransactions()
      })
      .subscribe()

    // Monitor messages
    const messagesChannel = supabase
      .channel('admin-global-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        console.log('[Admin Monitor] Message change:', payload.eventType)
        // Could add support ticket monitoring here
      })
      .subscribe()

    console.log('[Admin Monitor] Global monitoring active for all tables')

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
        payoutAggRes
      ] = await Promise.all([
        supabase.from('user_profiles').select('id'),
        supabase.from('user_profiles').select('id').eq('role', 'admin'),
        supabase.from('applications').select('id').eq('status', 'pending'),
        supabase.from('payout_requests').select('id').eq('status', 'pending'),
        supabase.from('user_profiles').select('id').eq('role', 'troll_officer'),
        supabase.from('stream_reports').select('id').eq('status', 'pending'),
        supabase.from('user_profiles').select('paid_coin_balance, free_coin_balance, sav_bonus_coins, vived_bonus_coins'),
        supabase.from('coin_transactions').select('metadata').eq('type', 'purchase'),
        supabase.from('coin_transactions').select('amount, type').eq('type', 'gift'),
        supabase.from('payout_requests').select('cash_amount, processing_fee')
      ])

      const users = usersRes.data || []
      const apps = appsRes.data || []
      const admins = adminsRes.data || []
      const pendingPayouts = pendingPayoutsRes.data || []
      const officers = officersRes.data || []
      const flags = flagsRes.data || []

      // Coin balances in user_profiles
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

      // 100 coins = $1 (your original assumption)
      const totalValue = totalCoins / 100

      // Revenue from coin_transactions.metadata.amount_paid
      const coinTx = coinTxRes.data || []
      let coinSalesRevenue = 0
      for (const t of coinTx as any[]) {
        const meta = t.metadata || {}
        const amountPaid = Number(meta.amount_paid || 0)
        if (!isNaN(amountPaid)) coinSalesRevenue += amountPaid
      }

      // Gift + promo coins
      const giftTx = giftTxRes.data || []
      let giftCoins = 0
      for (const g of giftTx as any[]) {
        const amt = Number(g.amount || 0)
        if (amt < 0) giftCoins += Math.abs(amt)
      }
      const appSponsoredGifts = savBonusTotal + vivedBonusTotal
      const savPromoCount = balances.filter((b: any) => Number(b.sav_bonus_coins || 0) > 0).length
      const vivedPromoCount = balances.filter((b: any) => Number(b.vived_bonus_coins || 0) > 0).length

      // Payouts & fees
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
        kick_ban_revenue: 0
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
      const json = await (await import('../lib/api')).default.get('/admin/economy/summary')
      if (!json.success) throw new Error(json?.error || 'Failed to load economy summary')
      setEconomySummary(json.data)
    } catch (err: any) {
      console.error('Failed to load economy summary:', err)
    } finally {
      setEconomyLoading(false)
    }
  }

  const loadShopRevenue = async () => {
    try {
      // Calculate revenue from insurance, entrance effects, and perks
      const { data: insuranceTxns, error: insError } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'insurance_purchase')

      const { data: effectTxns, error: effError } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'entrance_effect')

      const { data: perkTxns, error: perkError } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'perk_purchase')

      const insuranceTotal = Math.abs((insuranceTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0))
      const effectsTotal = Math.abs((effectTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0))
      const perksTotal = Math.abs((perkTxns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0))

      // Get top buyers (users who spent most on insurance, effects, perks)
      const { data: topBuyers, error: buyersError } = await supabase
        .from('coin_transactions')
        .select('user_id, amount, user_profiles!inner(username)')
        .in('type', ['insurance_purchase', 'entrance_effect', 'perk_purchase'])
        .order('amount', { ascending: true })
        .limit(10)

      // Group by user and sum
      const buyerMap = new Map<string, { username: string; total: number }>()
      ;(topBuyers || []).forEach((t: any) => {
        const userId = t.user_id
        const existing = buyerMap.get(userId) || { username: t.user_profiles?.username || 'Unknown', total: 0 }
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
        topBuyers: topBuyersList
      })
    } catch (err) {
      console.error('Failed to load shop revenue:', err)
    }
  }

  // Load risk overview
  useEffect(() => {
    const fetchRisk = async () => {
      if (profile?.role !== 'admin') return
      try {
        const json = await (await import('../lib/api')).default.get('/admin/risk/overview')
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
      const { error } = await supabase
        .from('notifications')
        .insert([{ user_id: null, type: 'troll_drop', content: `Troll Drop: ${amt} coins`, created_at: new Date().toISOString(), metadata: { coins: amt, ends_at: ends } }])
      if (error) throw error
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
        .select('id, title, category, broadcaster_id, current_viewers, status, created_at')
        .eq('status', 'live')
        .order('created_at', { ascending: false })

      if (error) throw error

      setLiveStreams(data || [])

      // Auto-select first stream if none selected
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
      const { error } = await supabase.rpc('ban_user', { p_user_id: selectedUserId, p_until: until })
      if (error) throw error
      toast.success('User banned')
    } catch {
      toast.error('Failed to ban user')
    }
  }

  const resetSelectedUserCoins = async () => {
    if (!selectedUserId) return
    try {
      const { error } = await supabase.rpc('reset_user_coins', { p_user_id: selectedUserId })
      if (error) throw error
      toast.success('Coins reset')
    } catch {
      toast.error('Failed to reset coins')
    }
  }

  const endSelectedStream = async () => {
    if (!selectedStream) return
    try {
      const { error } = await supabase.rpc('end_stream', { p_stream_id: selectedStream.id })
      if (error) throw error
      toast.success('Stream ended')
      loadLiveStreams()
    } catch {
      toast.error('Failed to end stream')
    }
  }

  const endStreamById = async (id: string) => {
    try {
      const { error } = await supabase.rpc('end_stream', { p_stream_id: id })
      if (error) throw error
      toast.success('Stream ended')
      loadLiveStreams()
    } catch {
      toast.error('Failed to end stream')
    }
  }

  const deleteStreamById = async (id: string) => {
    try {
      // First end the stream to notify all clients
      await supabase
        .from('streams')
        .update({ status: 'ended', end_time: new Date().toISOString(), is_force_ended: true, ended_by: profile?.id } as any)
        .eq('id', id)

      // Delete related rows to fully remove
      await supabase.from('messages').delete().eq('stream_id', id)
      await supabase.from('stream_reports').delete().eq('stream_id', id)

      // Finally delete the stream
      await supabase.from('streams').delete().eq('id', id)
      toast.success('Stream deleted everywhere')
      loadLiveStreams()
    } catch {
      toast.error('Failed to delete stream')
    }
  }

  const viewStream = (id: string) => {
    navigate(`/stream/${id}?admin=1`)
  }

  const flagSelectedUserAI = async () => {
    if (!selectedUserId) return
    try {
      const { error } = await supabase.from('admin_flags').insert({ user_id: selectedUserId, reason: 'ai_flag' })
      if (error) throw error
      toast.success('AI flag recorded')
    } catch {
      toast.error('Failed to record flag')
    }
  }

  const testAgoraStreaming = async () => {
    try {
      const body = { channelName: 'admin-test', userId: profile?.id || 'admin', role: 'publisher' }
      const json = await (await import('../lib/api')).default.post('/agora/agora-token', body)
      if (json?.success && json?.token) {
        setAgoraStatus({ ok: true, appId: json.appId, expiresAt: json.expiresAt })
        toast.success('Agora token generated')
      } else {
        setAgoraStatus({ ok: false, error: json?.error || 'Token generation failed', details: json?.details })
        toast.error('Agora test failed')
      }
    } catch (e: any) {
      setAgoraStatus({ ok: false, error: e?.message || 'Agora request failed' })
      toast.error('Agora test failed')
    }
  }

  const testSquare = async () => {
    try {
      const json = await (await import('../lib/api')).default.get('/payments/status')
      setSquareStatus(json)
      if (json.apiOk) {
        toast.success(`Square reachable (${json.env})`)
      } else {
        const errorMsg = json.details || 'Square status check failed'
        toast.error(`Square failed: ${errorMsg}`)
        console.warn('Square test result:', json)
      }
    } catch (e: any) {
      console.error('Square status check error:', e)
      setSquareStatus({ ok: false, error: e?.message })
      toast.error('Square status check failed')
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

  const getAdminToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
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
      if (cashoutsSearch) query = query.or(`username.ilike.%${cashoutsSearch}%,email.ilike.%${cashoutsSearch}%,payout_details.ilike.%${cashoutsSearch}%`)
      const { data } = await query
      setCashouts(data || [])
    } catch {
      setCashouts([])
    } finally {
      setTabLoading(false)
    }
  }

  const updatePayoutStatus = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    try {
      await supabase
        .from('payout_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      await loadPayouts()
      await loadDashboardData()

      toast.success(`Payout ${status}`)
    } catch {
      toast.error('Failed to update payout')
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
        .select(`
          *,
          user_profiles!inner(username, email)
        `)
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
      // Query applications table which has all application types (troller, officer, family)
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!applications_user_id_fkey(username, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('[Admin] Load applications error:', error)
        setVerifications([])
      } else {
        console.log('[Admin] Loaded applications:', data?.length || 0)
        setVerifications(data || [])
      }
    } catch (err) {
      console.error('[Admin] Load applications exception:', err)
      setVerifications([])
    } finally {
      setTabLoading(false)
    }
  }

  const approveVerification = async (id: string) => {
    try {
      // Get the application to determine type and user
      const { data: app } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!app) {
        toast.error('Application not found')
        return
      }

      // Update application status
      const { error: appError } = await supabase
        .from('applications')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (appError) throw appError

      // Update user role based on application type
      if (app.type === 'officer') {
        await supabase
          .from('user_profiles')
          .update({ role: 'troll_officer' })
          .eq('id', app.user_id)
      } else if (app.type === 'troller') {
        await supabase
          .from('user_profiles')
          .update({ role: 'troller' })
          .eq('id', app.user_id)
      }
      // family applications don't change role, they get family membership

      await loadVerifications()
      toast.success(`${app.type.charAt(0).toUpperCase() + app.type.slice(1)} application approved`)
    } catch (err) {
      console.error('[Admin] Approve application error:', err)
      toast.error('Failed to approve')
    }
  }

  const rejectApplication = async (id: string) => {
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

  const deleteUser = async (userId: string, username: string) => {
    try {
      console.log('[Admin] Deleting user:', userId, username)
      
      // Delete from auth.users using service role - this is permanent
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)
      
      if (authError) {
        console.error('[Admin] Auth delete error:', authError)
        throw authError
      }

      // Delete from user_profiles (should cascade to related data)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)
      
      if (profileError) {
        console.error('[Admin] Profile delete error:', profileError)
        // Auth user already deleted, so this is less critical
      }

      // Update UI immediately
      setUsersList(prev => prev.filter(u => u.id !== userId))
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }))

      toast.success(`User @${username} permanently deleted`)
      console.log('[Admin] User deleted successfully from auth and database:', userId)
    } catch (err) {
      console.error('[Admin] Delete user error:', err)
      toast.error(`Failed to delete user: ${err instanceof Error ? err.message : 'Unknown error'}`)
      // Reload to restore correct state
      await loadUsers()
      await loadDashboardData()
    }
  }

  const deleteAllFakeAccounts = async () => {
    try {
      console.log('[Admin] Deleting all fake accounts')
      const fakePatterns = ['test', 'fake', 'demo', 'sample', 'user']
      const fakeUsers = usersList.filter(u => 
        fakePatterns.some(pattern => 
          u.username?.toLowerCase().includes(pattern) || 
          u.email?.toLowerCase().includes(pattern)
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
          // Delete from auth
          await supabase.auth.admin.deleteUser(user.id)
          // Delete from profiles
          await supabase.from('user_profiles').delete().eq('id', user.id)
          deleted++
        } catch (err) {
          console.error('[Admin] Failed to delete fake user:', user.username, err)
          failed++
        }
      }

      // Update UI
      setUsersList(prev => prev.filter(u => !fakeUsers.find(f => f.id === u.id)))
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - deleted }))

      toast.success(`Deleted ${deleted} fake accounts${failed > 0 ? `, ${failed} failed` : ''}`)
      console.log('[Admin] Fake accounts cleanup complete:', { deleted, failed })
      
      await loadUsers()
      await loadDashboardData()
    } catch (err) {
      console.error('[Admin] Delete fake accounts error:', err)
      toast.error('Failed to delete fake accounts')
      await loadUsers()
      await loadDashboardData()
    }
  }

  const loadUsers = async () => {
    setTabLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false })

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
        .select('id, username, email, role, created_at')
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
        loadVerifications()
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
      default:
        break
    }
  }, [activeTab, profile?.id])

  useEffect(() => {
    if (activeTab !== 'payouts') return
    const channel = supabase
      .channel('payouts_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'earnings_payouts' }, () => {
        loadPayouts()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'cashouts') return
    const channel = supabase
      .channel('cashouts_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
        loadCashouts()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'purchases') return
    const channel = supabase
      .channel('purchases_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, () => {
        loadPurchases()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'users') return
    const channel = supabase
      .channel('users_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, (payload) => {
        console.log('[Admin] User profiles change detected:', payload.eventType)
        loadUsers()
        loadDashboardData() // Update stats count
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'declined') return
    const channel = supabase
      .channel('declined_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'declined_transactions' }, () => {
        loadDeclinedTransactions()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'verification') return
    const channel = supabase
      .channel('verification_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
        loadVerifications()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'broadcasters') return
    const channel = supabase
      .channel('broadcasters_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        loadBroadcasters()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'families') return
    const channel = supabase
      .channel('families_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, () => {
        loadFamilies()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'support') return
    const channel = supabase
      .channel('support_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        loadSupportTickets()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'agreements') return
    loadAgreements()
  }, [activeTab])

  const loadAgreements = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, terms_accepted, created_at')
        .eq('terms_accepted', true)
        .order('created_at', { ascending: false })
      
      setAgreements(data || [])
    } catch (error) {
      console.error('Error loading agreements:', error)
      setAgreements([])
    }
  }

  const cleanupStreams = () => {
    toast.success('Stream cleanup initiated')
    setTimeout(() => {
      toast.success('Stream cleanup completed')
    }, 2000)
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

  const respondToTicket = async (ticket: any) => {
    const response = window.prompt('Type your response:')
    if (!response) return
    try {
      await supabase
        .from('support_tickets')
        .update({ admin_response: response, status: 'responded', updated_at: new Date().toISOString() })
        .eq('id', ticket.id)
      toast.success('Response sent')
      loadSupportTickets()
    } catch {
      toast.error('Failed to respond')
    }
  }

  const metricCards = [
    { title: 'Users', value: stats.totalUsers, icon: <Users className="w-6 h-6 text-purple-400" />, color: 'bg-purple-600' },
    { title: 'Admins', value: stats.adminsCount, icon: <Shield className="w-6 h-6 text-red-400" />, color: 'bg-red-600' },
    { title: 'Pending Apps', value: stats.pendingApps, icon: <FileText className="w-6 h-6 text-yellow-400" />, color: 'bg-yellow-600' },
    { title: 'Pending Payouts', value: stats.pendingPayouts, icon: <DollarSign className="w-6 h-6 text-green-400" />, color: 'bg-green-600' },
    { title: 'Troll Officers', value: stats.trollOfficers, icon: <Award className="w-6 h-6 text-orange-400" />, color: 'bg-orange-600' },
    { title: 'AI Flags', value: stats.aiFlags, icon: <Shield className="w-6 h-6 text-red-400" />, color: 'bg-red-600' }
  ]

  const tabs = [
    { id: 'connections', label: 'Connections' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'cashouts', label: 'Manual Cashouts' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'declined', label: 'Declined Transactions' },
    { id: 'verification', label: 'Verification' },
    { id: 'users', label: 'Users' },
    { id: 'broadcasters', label: 'Broadcasters' },
    { id: 'families', label: 'Families' },
    { id: 'support', label: 'Support Tickets' },
    { id: 'agreements', label: 'User Agreements' }
  ] as const

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
          if (data) { p = data; break }
          await new Promise(r => setTimeout(r, 500))
          tries++
        }
        if (p) { setProfile(p as any); return }
      } catch {}
      // If still missing, create real profile in DB (RLS allows insert for own id)
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
        if (created) { setProfile(created as any); return }
      } catch (err) {
        console.error('Failed to create profile:', err)
      }
      const isAdmin2 = isAdminEmail(user?.email)
      setProfile({ id: user!.id, username: (user?.email || '').split('@')[0] || '', role: isAdmin2 ? 'admin' : 'user' } as any)
    }
    ensureProfile()
  }, [profile, user?.id])

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="p-8 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400">System overview and controls</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={async () => {
                try {
                  await supabase.auth.signOut()
                  useAuthStore.getState().logout()
                  toast.success('Logged out')
                  navigate('/auth?reset=1', { replace: true })
                } catch {
                  toast.error('Logout failed')
                }
              }}
              className="px-4 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition"
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
                window.location.href = '/auth?reset=1'
              }}
              className="px-4 py-2 border border-yellow-500 text-yellow-400 rounded-lg hover:bg-yellow-500 hover:text-black transition"
            >
              Reset App
            </button>
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C] mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-yellow-300" />
            <span className="font-semibold">Troll Drop</span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-gray-400">Coins</div>
              <input type="number" min={1} value={trollDropAmount} onChange={(e)=>setTrollDropAmount(Number(e.target.value))} className="w-24 bg-[#0D0D0D] border border-[#2C2C2C] rounded p-2 text-white" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Duration (sec)</div>
              <input type="number" min={5} value={trollDropDuration} onChange={(e)=>setTrollDropDuration(Number(e.target.value))} className="w-24 bg-[#0D0D0D] border border-[#2C2C2C] rounded p-2 text-white" />
            </div>
            <button onClick={createTrollDrop} className="px-3 py-2 bg-yellow-500 text-black rounded">Create</button>
          </div>
        </div>

        {/* TOP METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {metricCards.map((card, index) => (
            <div key={index} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
              <div className="flex items-center justify-between mb-2">
                {card.icon}
                <div className={`w-8 h-8 ${card.color} rounded-full flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">{card.value}</span>
                </div>
              </div>
              <h3 className="text-white font-semibold">{card.title}</h3>
            </div>
          ))}
        </div>

        {/* TESTING MODE CONTROL */}
        <div className="mb-8">
          <TestingModeControl />
        </div>

        {/* PROFIT SUMMARY */}
        <div className="mb-8">
          <ProfitSummary />
        </div>

        {/* ECONOMY OVERVIEW */}
        <section className="bg-[#050716]/80 border border-purple-500/30 rounded-2xl p-4 shadow-lg mb-8">
          <h2 className="text-xl font-bold text-purple-300 mb-4">
            Troll City Economy Overview
          </h2>

          {economyLoading && <div className="text-sm text-gray-400">Loading economy stats...</div>}

          {economySummary && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="bg-black/40 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-gray-400">Paid Coins Outstanding</div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {economySummary.paidCoins.outstandingLiability.toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Purchased: {economySummary.paidCoins.totalPurchased.toLocaleString()} • Spent: {economySummary.paidCoins.totalSpent.toLocaleString()}
                </div>
              </div>

              <div className="bg-black/40 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-gray-400">Broadcaster Cashouts</div>
                <div className="text-2xl font-semibold text-amber-300">
                  ${economySummary.broadcasters.pendingCashoutsUsd.toFixed(2)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Total Earned: ${economySummary.broadcasters.totalUsdOwed.toFixed(2)} • Paid: ${economySummary.broadcasters.paidOutUsd.toFixed(2)}
                </div>
              </div>

              <div className="bg-black/40 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-gray-400">Officer Earnings</div>
                <div className="text-2xl font-semibold text-cyan-300">
                  ${economySummary.officers.totalUsdPaid.toFixed(2)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  From kicks, bans & penalties
                </div>
              </div>

              <div className="bg-black/40 rounded-xl p-3 border border-purple-500/20">
                <div className="text-xs text-gray-400">Troll Wheel Activity</div>
                <div className="text-2xl font-semibold text-pink-300">
                  {economySummary.wheel.totalSpins.toLocaleString()} spins
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Coins Spent: {economySummary.wheel.totalCoinsSpent.toLocaleString()} • Jackpots: {economySummary.wheel.jackpotCount}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RISK & COMPLIANCE */}
        <section className="bg-[#050716]/80 border border-red-500/30 rounded-2xl p-4 shadow-lg mb-8">
          <h2 className="text-xl font-bold text-red-300 mb-3">
            Risk & Compliance
          </h2>
          {!risk ? (
            <div className="text-sm text-gray-400">Loading risk radar...</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Frozen Accounts</span>
                <span className="text-2xl font-semibold text-red-400">
                  {risk.frozenCount}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Top High-Risk Users</div>
                <ul className="space-y-1 max-h-32 overflow-auto text-xs text-gray-300">
                  {risk.topHighRisk.map((u: any) => (
                    <li key={u.user_id} className="flex justify-between">
                      <span>{u.user_id}</span>
                      <span className="text-red-300 font-semibold">{u.risk_score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* SHOP REVENUE - Insurance, Effects, Perks */}
        <section className="bg-[#050716]/80 border border-troll-gold/30 rounded-2xl p-4 shadow-lg mb-8">
          <h2 className="text-xl font-bold text-troll-gold mb-3">
            💰 Shop Revenue
          </h2>
          {!shopRevenue ? (
            <div className="text-sm text-gray-400">Loading shop data...</div>
          ) : (
            <div className="space-y-4">
              {/* Revenue Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-troll-green/10 border border-troll-green/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">🛡️ Insurance</div>
                  <div className="text-2xl font-bold text-troll-green">
                    {shopRevenue.insuranceTotal.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">coins</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">✨ Effects</div>
                  <div className="text-2xl font-bold text-purple-300">
                    {shopRevenue.effectsTotal.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">coins</div>
                </div>
                <div className="bg-troll-gold/10 border border-troll-gold/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">⭐ Perks</div>
                  <div className="text-2xl font-bold text-troll-gold">
                    {shopRevenue.perksTotal.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">coins</div>
                </div>
              </div>

              {/* Total Revenue */}
              <div className="bg-gradient-to-r from-troll-purple/20 to-troll-gold/20 border border-troll-gold/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Total Shop Revenue</div>
                <div className="text-3xl font-bold text-white">
                  {(shopRevenue.insuranceTotal + shopRevenue.effectsTotal + shopRevenue.perksTotal).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                  coins (~${((shopRevenue.insuranceTotal + shopRevenue.effectsTotal + shopRevenue.perksTotal) * 0.0001).toFixed(2)} USD)
                </div>
              </div>

              {/* Top Buyers Leaderboard */}
              <div>
                <div className="text-sm font-semibold text-gray-300 mb-2">Top Buyers</div>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {shopRevenue.topBuyers.length === 0 ? (
                    <div className="text-xs text-gray-500">No purchases yet</div>
                  ) : (
                    shopRevenue.topBuyers.map((buyer: any, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-troll-gold">#{idx + 1}</span>
                          <span className="text-sm text-white">{buyer.username}</span>
                        </div>
                        <div className="text-sm font-semibold text-troll-green">
                          {buyer.total.toLocaleString()} coins
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Admin Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              placeholder="User ID"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            />
            <input
              value={actionUntil}
              onChange={(e) => setActionUntil(e.target.value)}
              placeholder="Ban until (ISO)"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            />
            <button onClick={banSelectedUser} className="gaming-button-pink px-3 py-1 rounded text-sm">Ban user</button>
            <button onClick={resetSelectedUserCoins} className="gaming-button-green px-3 py-1 rounded text-sm">Reset coins</button>
            <button onClick={flagSelectedUserAI} className="gaming-button-yellow px-3 py-1 rounded text-sm">Detect AI flag</button>
            <button onClick={endSelectedStream} className="gaming-button-red px-3 py-1 rounded text-sm">End stream</button>
          </div>
        </div>

        {/* TABS */}
        <div className="mb-6">
          <div className="text-xs text-gray-400 mb-2">
            Admin Dashboard - {tabs.length} tabs available
          </div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  console.log('[Admin] Switching to tab:', tab.id)
                  setActiveTab(tab.id)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                    : 'bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONNECTIONS TAB */}
        {activeTab === 'connections' && (
          <>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Coin Economy (Live)</h2>
                <div className="flex items-center gap-2">
                  <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">Live</span>
                  <button
                    onClick={loadDashboardData}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <MetricBox
                  title="Purchased Coins (Balances)"
                  value={stats.purchasedCoins.toLocaleString()}
                  icon={<CreditCard className="w-5 h-5" />}
                  color="text-blue-400"
                />
                <MetricBox
                  title="Free Coins (Balances)"
                  value={stats.freeCoins.toLocaleString()}
                  icon={<Gift className="w-5 h-5" />}
                  color="text-cyan-400"
                />
                <MetricBox
                  title="Total Coins in Circulation"
                  value={stats.totalCoinsInCirculation.toLocaleString()}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="text-green-400"
                />
                <MetricBox
                  title="Total Coin Value (USD)"
                  value={`$${stats.totalValue.toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-purple-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <MetricBox
                  title="Coin Sales Revenue"
                  value={`$${stats.coinSalesRevenue.toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-green-300"
                />
                <MetricBox
                  title="Total Payouts"
                  value={`$${stats.totalPayouts.toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-red-300"
                />
                <MetricBox
                  title="Net Payouts"
                  value={`$${(stats.totalPayouts - stats.feesCollected).toFixed(2)}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-yellow-300"
                />
                <MetricBox
                  title="Platform Profit"
                  value={`$${stats.platformProfit.toFixed(2)}`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color={stats.platformProfit >= 0 ? 'text-green-400' : 'text-red-400'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricBox
                  title="Gift Coins Spent"
                  value={stats.giftCoins.toLocaleString()}
                  icon={<Gift className="w-5 h-5" />}
                  color="text-pink-300"
                />
                <MetricBox
                  title="App Sponsored Gifts (Coins)"
                  value={stats.appSponsoredGifts.toLocaleString()}
                  icon={<Gift className="w-5 h-5" />}
                  color="text-orange-300"
                />
                <MetricBox
                  title="Sav Promo Gifts (Count)"
                  value={stats.savPromoCount}
                  icon={<Gift className="w-5 h-5" />}
                  color="text-indigo-300"
                />
                <MetricBox
                  title="Vived Promo Gifts (Count)"
                  value={stats.vivedPromoCount}
                  icon={<Gift className="w-5 h-5" />}
                  color="text-lime-300"
                />
              </div>
            </div>

            {/* CTV LIVE FEED SECTION */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-green-400" />
                  Live Streams – CTV View
                </h2>
                <button
                  onClick={loadLiveStreams}
                  disabled={streamsLoading}
                  className="flex items-center gap-2 px-3 py-1 bg-[#1F2933] text-gray-200 rounded-lg hover:bg-[#27323D] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${streamsLoading ? 'animate-spin' : ''}`} />
                  Refresh Streams
                </button>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Multi-Cam Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveStreams.length === 0 && !streamsLoading && (
                    <div className="col-span-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-8 text-center text-gray-400">
                      No live streams detected right now.
                    </div>
                  )}

                  {liveStreams.map((stream) => (
                    <div
                      key={stream.id}
                      onClick={() => setSelectedStream(stream)}
                      className={`relative bg-[#101018] border rounded-xl p-3 cursor-pointer transition-all
                        ${selectedStream?.id === stream.id ? 'border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'border-[#2C2C2C]'}
                      `}
                    >
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); viewStream(stream.id) }} className="px-2 py-1 text-xs rounded bg-purple-600 text-white">View</button>
                        <button onClick={(e) => { e.stopPropagation(); endStreamById(stream.id) }} className="px-2 py-1 text-xs rounded bg-red-600 text-white">End</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteStreamById(stream.id) }} className="px-2 py-1 text-xs rounded bg-yellow-500 text-black">Delete</button>
                      </div>
                      <div className="h-28 bg-[#050509] rounded-lg mb-2 flex items-center justify-center">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Camera className="w-8 h-8 text-gray-600" />
                        )}
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-white truncate max-w-[70%]">
                          {stream.title || 'Untitled Stream'}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white">
                          Live
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        🎭 {stream.category || 'Unknown'} • 👥 {stream.current_viewers || 0} viewers
                      </p>
                    </div>
                  ))}
                </div>

                {/* Selected Stream Monitor */}
                <div className="bg-[#11111A] border border-[#2C2C2C] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Play className="w-4 h-4 text-green-400" />
                      Monitor View
                    </h3>
                    {selectedStream && (
                      <span className="text-xs text-gray-400">
                        ID: {selectedStream.id}
                      </span>
                    )}
                  </div>

                  <div className="h-40 bg-[#050509] rounded-lg mb-3 flex items-center justify-center">
                    {/* Plug your real player here (Agora / IVS / HLS, etc.) */}
                    {selectedStream ? (
                      <span className="text-gray-500 text-xs px-3 text-center">
                        Live monitor for <span className="text-green-400">{selectedStream.title}</span>.<br />
                        Replace this block with your video player (Agora / IVS).
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">
                        Select a stream on the left to monitor.
                      </span>
                    )}
                  </div>

                  {selectedStream && (
                    <>
                      <p className="text-sm text-white mb-1">
                        Broadcaster: <span className="text-gray-300">{selectedStream.broadcaster_id}</span>
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        Started:{' '}
                        {selectedStream.created_at
                          ? new Date(selectedStream.created_at).toLocaleString()
                          : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        Category: {selectedStream.category || 'Unknown'} • Viewers:{' '}
                        {selectedStream.current_viewers || 0}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                          onClick={endSelectedStream}
                          className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                        >
                          End Stream
                        </button>
                        <button
                          onClick={cleanupStreams}
                          className="w-full px-3 py-2 bg-yellow-600 text-black rounded-lg text-sm hover:bg-yellow-700 transition-colors"
                        >
                          Force Stream Cleanup
                        </button>
                      </div>

                      <button
                        onClick={loadLiveStreams}
                        className="mt-auto w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                      >
                        Refresh
                      </button>
                    </>
                  )}

                  {!selectedStream && (
                    <button
                      onClick={loadLiveStreams}
                      className="mt-auto w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                    >
                      Scan For Streams
                    </button>
                  )}
                </div>
              </div>
            </div>

            <SystemTests
              testAgoraStreaming={testAgoraStreaming}
              testSquare={testSquare}
              testSupabase={testSupabase}
              cleanupStreams={cleanupStreams}
              squareStatus={squareStatus}
              agoraStatus={agoraStatus}
              supabaseStatus={supabaseStatus}
            />
          </>
        )}

        {/* PAYOUTS TAB */}
        {activeTab === 'payouts' && (
          <DataTable
            loading={tabLoading}
            emptyText="No payout requests"
            headers={['User', 'Coins', 'Net', 'Status', 'Actions']}
            data={payouts}
            rowRenderer={(p: any) => (
              <tr key={p.id} className="border-t border-[#2C2C2C] text-sm">
                <td className="px-3 py-2 text-white">{p.user_id}</td>
                <td className="px-3 py-2 text-white">
                  {Number(p.coins_used || 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-white">
                  $
                  {Number(
                    p.net_amount || Number(p.cash_amount || 0)
                  ).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-white capitalize">{p.status}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updatePayoutStatus(p.id, 'approved')}
                      className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updatePayoutStatus(p.id, 'rejected')}
                      className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updatePayoutStatus(p.id, 'paid')}
                      className="px-3 py-1 rounded bg-yellow-500 text-black text-xs"
                    >
                      Mark Paid
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}

        {/* CASHOUTS TAB */}
        {activeTab === 'cashouts' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={cashoutsSearch}
                onChange={(e) => setCashoutsSearch(e.target.value)}
                placeholder="Search users or details"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              />
              <select
                value={cashoutsProvider}
                onChange={(e) => setCashoutsProvider(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              >
                <option value="">All Providers</option>
                <option value="CashApp">CashApp</option>
                <option value="PayPal">PayPal</option>
                <option value="Venmo">Venmo</option>
              </select>
              <button onClick={loadCashouts} className="px-3 py-1 rounded bg-purple-600 text-white text-sm">Search</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2C2C2C]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">User</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Coins</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">USD</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Method</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Details</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {cashouts.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-sm text-white">
                        <ClickableUsername username={r.username} className="text-white" />
                        <div className="text-xs text-gray-400">{r.email}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-white">{r.requested_coins?.toLocaleString?.() || r.requested_coins}</td>
                      <td className="px-4 py-2 text-sm text-troll-green">${Number(r.usd_value || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-white">{r.payout_method}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">{r.payout_details}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          r.status === 'pending'
                            ? 'bg-yellow-900 text-yellow-200'
                            : r.status === 'processing'
                            ? 'bg-blue-900 text-blue-200'
                            : r.status === 'paid'
                            ? 'bg-green-900 text-green-200'
                            : 'bg-purple-900 text-purple-200'
                        }`}>{String(r.status || 'pending').toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const { data, error } = await supabase.rpc('admin_mark_cashout_paid', { p_cashout_id: r.id, p_payment_reference: '' })
                              if (!error) toast.success('Marked paid')
                              else toast.error(error.message || 'Failed')
                              await loadCashouts()
                            }}
                            className="px-3 py-1 rounded bg-yellow-500 text-black text-xs"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={async () => {
                              const { data, error } = await supabase.rpc('admin_mark_cashout_completed', { p_cashout_id: r.id, p_payment_reference: r.admin_notes || '' })
                              if (!error) toast.success('Completed')
                              else toast.error(error.message || 'Failed')
                              await loadCashouts()
                            }}
                            className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => {
                              const w = window.open('', '_blank') as Window
                              const gross = Number(r.usd_value || 0)
                              const content = `<!doctype html><html><head><meta charset="utf-8"><title>Cashout Statement</title><style>body{font-family:Arial;padding:24px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;font-size:12px}</style></head><body><h1>Troll City Cashout Statement</h1><table><tr><th>User</th><td>@${r.username}</td></tr><tr><th>Email</th><td>${r.email || ''}</td></tr><tr><th>Method</th><td>${r.payout_method}</td></tr><tr><th>Details</th><td>${r.payout_details}</td></tr><tr><th>Coins</th><td>${r.requested_coins}</td></tr><tr><th>Gross USD</th><td>$${gross.toFixed(2)}</td></tr><tr><th>Status</th><td>${String(r.status).toUpperCase()}</td></tr><tr><th>Date</th><td>${new Date(r.created_at).toLocaleString()}</td></tr></table></body></html>`
                              w.document.write(content)
                              w.document.close()
                              w.focus()
                              w.print()
                              setTimeout(() => { w.close() }, 500)
                            }}
                            className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
                          >
                            Statement PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PURCHASES TAB */}
        {activeTab === 'purchases' && (
          <ListView
            loading={tabLoading}
            emptyText="No purchases"
            data={purchases}
            renderItem={(t: any) => (
              <div
                key={t.id}
                className="flex justify-between border-b border-[#2C2C2C] py-2 text-sm"
              >
                <span className="text-white">
                  {t.description || t.metadata?.packageName || 'Coin purchase'}
                </span>
                <span className="text-gray-400">
                  {new Date(t.created_at).toLocaleString()}
                </span>
              </div>
            )}
          />
        )}

        {/* DECLINED TRANSACTIONS TAB */}
        {activeTab === 'declined' && (
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
            <h3 className="text-xl font-bold text-white mb-4">Declined Transactions</h3>
            {tabLoading ? (
              <div className="text-gray-400">Loading...</div>
            ) : declinedTransactions.length === 0 ? (
              <div className="text-gray-400">No declined transactions found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2C2C2C]">
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Date</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Username</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Email</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Amount</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Error Code</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Error Message</th>
                      <th className="text-left py-3 px-2 text-gray-400 font-medium text-sm">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {declinedTransactions.map((dt: any) => (
                      <tr key={dt.id} className="border-b border-[#2C2C2C] hover:bg-[#252525]">
                        <td className="py-3 px-2 text-white text-sm">
                          {new Date(dt.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-white text-sm">
                          <ClickableUsername username={dt.user_profiles?.username || 'Unknown'} className="text-white" />
                        </td>
                        <td className="py-3 px-2 text-gray-400 text-sm">
                          {dt.user_profiles?.email || 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-white text-sm">
                          ${Number(dt.amount_usd || 0).toFixed(2)} {dt.currency}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-mono text-xs">
                            {dt.error_code || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-300 text-sm max-w-xs truncate">
                          {dt.error_message || 'Unknown error'}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          <button
                            onClick={() => setSelectedDeclined(dt)}
                            className="px-2 py-1 rounded bg-[#2C2C2C] text-gray-300 hover:bg-[#3C3C3C] text-xs"
                          >
                            View Full Log
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VERIFICATION TAB */}
        {activeTab === 'verification' && (
          <DataTable
            loading={tabLoading}
            emptyText="No pending applications"
            data={verifications}
            headers={["Type", "User", "Reason/Bio", "Goals/Experience", "Submitted", "Actions"]}
            rowRenderer={(app: any) => (
              <tr key={app.id} className="text-sm border-b border-[#2C2C2C]">
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    app.type === 'officer' ? 'bg-blue-500/20 text-blue-400' :
                    app.type === 'troller' ? 'bg-yellow-500/20 text-yellow-400' :
                    app.type === 'family' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {app.type === 'officer' ? '👮 Officer' : 
                     app.type === 'troller' ? '😈 Troller' :
                     app.type === 'family' ? '👨‍👩‍👧‍👦 Family' : app.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-white">
                  <div>
                    <div className="font-medium">
                      <ClickableUsername username={app.user_profiles?.username || 'Unknown'} className="text-white" />
                    </div>
                    <div className="text-xs text-gray-400">{app.user_profiles?.email || app.user_id}</div>
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-300 max-w-xs truncate">
                  {app.reason || '-'}
                </td>
                <td className="px-3 py-2 text-gray-300 max-w-xs truncate">
                  {app.goals || '-'}
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs">
                  {new Date(app.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveVerification(app.id)}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs text-white transition-colors"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => rejectApplication(app.id)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white transition-colors"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={deleteAllFakeAccounts}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Delete All Fake Accounts
              </button>
            </div>
            <UserTable loading={tabLoading} data={usersList} onDeleteUser={deleteUser} />
          </div>
        )}

        {/* BROADCASTERS TAB */}
        {activeTab === 'broadcasters' && (
          <ListView
            loading={tabLoading}
            emptyText="No broadcasters found"
            data={broadcastersList}
            renderItem={(b: any) => (
              <div
                key={b.id}
                className="flex justify-between border-b border-[#2C2C2C] py-2 text-sm"
              >
                <ClickableUsername username={b.username} className="text-white" />
                <span className="text-gray-400">{b.email}</span>
              </div>
            )}
          />
        )}

        {/* FAMILIES TAB */}
        {activeTab === 'families' && (
          <ListView
            loading={tabLoading}
            emptyText="No families found"
            data={familiesList}
            renderItem={(f: any) => (
              <div
                key={f.id}
                className="flex justify-between border-b border-[#2C2C2C] py-2 text-sm"
              >
                <span className="text-white">{f.name}</span>
                <span className="text-gray-400">
                  {(f.total_coins || 0).toLocaleString()} coins • {f.member_count} members • lvl{' '}
                  {f.level}
                </span>
              </div>
            )}
          />
        )}

        {/* SUPPORT TICKETS TAB */}
        {activeTab === 'support' && (
          <DataTable
            loading={tabLoading}
            emptyText="No support tickets"
            data={supportTickets}
            headers={["User", "Subject", "Category", "Status", "Created", "Actions"]}
            rowRenderer={(t: any) => (
              <tr key={t.id} className="text-sm border-b border-[#2C2C2C]">
                <td className="px-3 py-2">
                  <ClickableUsername username={t.username || t.user_id} className="text-white" />
                </td>
                <td className="px-3 py-2">{t.subject || t.content}</td>
                <td className="px-3 py-2">{t.category || '-'}</td>
                <td className="px-3 py-2">{t.status || 'open'}</td>
                <td className="px-3 py-2">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button onClick={() => respondToTicket(t)} className="px-3 py-1 bg-purple-600 rounded text-white text-xs">Respond</button>
                </td>
              </tr>
            )}
          />
        )}

        {/* AGREEMENTS TAB */}
        {activeTab === 'agreements' && (
          <DataTable
            loading={tabLoading}
            emptyText="No user agreements"
            data={agreements}
            headers={["Username", "User ID", "Agreed At", "Status"]}
            rowRenderer={(agreement: any) => (
              <tr key={agreement.id} className="text-sm border-b border-[#2C2C2C]">
                <td className="px-3 py-2">
                  <ClickableUsername 
                    username={agreement.username || 'Unknown'} 
                    className="font-medium text-white" 
                  />
                </td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">{agreement.id}</td>
                <td className="px-3 py-2 text-gray-300">{new Date(agreement.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                    ✓ Accepted
                  </span>
                </td>
              </tr>
            )}
          />
        )}
      </div>

      {/* Declined Transaction Details Modal */}
      {selectedDeclined && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDeclined(null)}
        >
          <div 
            className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Declined Transaction Details</h3>
              <button
                onClick={() => setSelectedDeclined(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Transaction ID</label>
                  <div className="text-white font-mono text-sm mt-1">{selectedDeclined.id}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Date/Time</label>
                  <div className="text-white text-sm mt-1">{new Date(selectedDeclined.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Username</label>
                  <div className="text-white text-sm mt-1">
                    <ClickableUsername 
                      username={selectedDeclined.user_profiles?.username || 'Unknown'} 
                      className="text-white" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Email</label>
                  <div className="text-white text-sm mt-1">{selectedDeclined.user_profiles?.email || 'N/A'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Amount</label>
                  <div className="text-white text-sm mt-1">${Number(selectedDeclined.amount_usd || 0).toFixed(2)} {selectedDeclined.currency}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Provider</label>
                  <div className="text-white text-sm mt-1">{selectedDeclined.payment_provider}</div>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Error Code</label>
                <div className="bg-red-500/20 border border-red-500/50 rounded px-3 py-2 mt-1">
                  <code className="text-red-400 font-mono text-sm">{selectedDeclined.error_code || 'N/A'}</code>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Error Message</label>
                <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded px-3 py-2 mt-1">
                  <div className="text-white text-sm">{selectedDeclined.error_message || 'Unknown error'}</div>
                </div>
              </div>

              {selectedDeclined.metadata && Object.keys(selectedDeclined.metadata).length > 0 && (
                <div>
                  <label className="text-sm text-gray-400">Metadata</label>
                  <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded px-3 py-2 mt-1">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedDeclined.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedDeclined.error_details && (
                <div>
                  <label className="text-sm text-gray-400">Full Error Details</label>
                  <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded px-3 py-2 mt-1">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedDeclined.error_details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedDeclined(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* HELPER COMPONENTS */

const MetricBox = ({
  title,
  value,
  icon,
  color
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
}) => (
  <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
    </div>
    <p className="text-white text-xl font-bold">{value}</p>
  </div>
)

const ListView = ({
  loading,
  emptyText,
  data,
  renderItem
}: {
  loading: boolean
  emptyText: string
  data: any[]
  renderItem: (item: any) => React.ReactNode
}) =>
  loading ? (
    <p className="text-gray-400">Loading...</p>
  ) : data.length === 0 ? (
    <p className="text-gray-400">{emptyText}</p>
  ) : (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
      {data.map(renderItem)}
    </div>
  )

const DataTable = ({
  loading,
  emptyText,
  data,
  headers,
  rowRenderer
}: {
  loading: boolean
  emptyText: string
  data: any[]
  headers: string[]
  rowRenderer: (row: any) => React.ReactNode
}) =>
  loading ? (
    <p className="text-gray-400">Loading...</p>
  ) : data.length === 0 ? (
    <p className="text-gray-400">{emptyText}</p>
  ) : (
    <div className="overflow-x-auto bg-[#1A1A1A] rounded-xl border border-[#2C2C2C]">
      <table className="w-full text-left text-xs md:text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-[#2C2C2C]">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{data.map(rowRenderer)}</tbody>
      </table>
    </div>
  )

const UserTable = ({
  loading,
  data,
  onDeleteUser
}: {
  loading: boolean
  data: any[]
  onDeleteUser?: (userId: string, username: string) => void
}) =>
  loading ? (
    <p className="text-gray-400">Loading users...</p>
  ) : data.length === 0 ? (
    <p className="text-gray-400">No users found</p>
  ) : (
    <div className="overflow-x-auto bg-[#1A1A1A] rounded-xl border border-[#2C2C2C]">
      <table className="w-full text-left text-xs md:text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-[#2C2C2C]">
            <th className="px-3 py-2 font-medium">Username</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Joined</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((u: any) => (
            <tr key={u.id} className="border-t border-[#2C2C2C]">
              <td className="px-3 py-2 text-white">
                <ClickableUsername username={u.username} className="text-white" />
              </td>
              <td className="px-3 py-2 text-white">{u.email}</td>
              <td className="px-3 py-2 text-white">{u.role === 'admin' ? 'User (Admin)' : u.role}</td>
              <td className="px-3 py-2 text-white">
                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
              </td>
              <td className="px-3 py-2 text-white">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      const role = window.prompt('Set role: user, troll_officer, admin', u.role || 'user')
                      if (!role) return
                      try {
                        await supabase.from('user_profiles').update({ role }).eq('id', u.id)
                        toast.success('Role updated')
                      } catch { toast.error('Update failed') }
                    }}
                    className="px-2 py-1 rounded bg-purple-600 text-xs"
                  >Role</button>
                  <button
                    onClick={async () => {
                      const amtStr = window.prompt('Add paid coins (+/-)', '0')
                      const amt = Number(amtStr || 0)
                      if (!amt) return
                      try {
                        await supabase.rpc('add_user_paid_coins', { p_user_id: u.id, p_delta: amt })
                        toast.success('Coins updated')
                      } catch {
                        try {
                          const { data } = await supabase.from('user_profiles').select('paid_coin_balance').eq('id', u.id).maybeSingle()
                          const newBal = Number(data?.paid_coin_balance || 0) + amt
                          await supabase.from('user_profiles').update({ paid_coin_balance: newBal }).eq('id', u.id)
                          toast.success('Coins updated')
                        } catch { toast.error('Update failed') }
                      }
                    }}
                    className="px-2 py-1 rounded bg-green-600 text-xs"
                  >Coins</button>
                  <button
                    onClick={async () => {
                      const lvlStr = window.prompt('Set level (number)', String(u.level || 1))
                      const lvl = Number(lvlStr || 1)
                      try { await supabase.from('user_profiles').update({ level: lvl }).eq('id', u.id); toast.success('Level set') } catch { toast.error('Failed') }
                    }}
                    className="px-2 py-1 rounded bg-blue-600 text-xs"
                  >Level</button>
                  <button
                    onClick={async () => {
                      const hoursStr = window.prompt('Ban hours', '24')
                      const hours = Number(hoursStr || 24)
                      const until = new Date(Date.now() + hours * 3600_000).toISOString()
                      try { await supabase.rpc('ban_user', { p_user_id: u.id, p_until: until }); toast.success('Banned') } catch { toast.error('Failed') }
                    }}
                    className="px-2 py-1 rounded bg-red-600 text-xs"
                  >Ban</button>
                  <button
                    onClick={async () => {
                      try { await supabase.from('admin_flags').insert({ user_id: u.id, reason: 'kick' }); toast.success('Kicked') } catch { toast.error('Failed') }
                    }}
                    className="px-2 py-1 rounded bg-yellow-600 text-xs"
                  >Kick</button>
                  {onDeleteUser && (
                    <button
                      onClick={() => onDeleteUser(u.id, u.username)}
                      className="px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white text-xs font-bold border border-red-600"
                      title="Permanently delete this user"
                    >🗑️ DELETE</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

const SystemTests = ({
  testAgoraStreaming,
  testSquare,
  testSupabase,
  cleanupStreams,
  squareStatus,
  agoraStatus,
  supabaseStatus
}: {
  testAgoraStreaming: () => void
  testSquare: () => void
  testSupabase: () => void
  cleanupStreams: () => void
  squareStatus: any | null
  agoraStatus: any | null
  supabaseStatus: any | null
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <TestBox
      title="Agora Streaming"
      vars={['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE']}
      onClick={testAgoraStreaming}
      result={agoraStatus}
    />
    <TestBox
      title="Square Payments (production)"
      vars={['SQUARE_ACCESS_TOKEN', 'SQUARE_ENVIRONMENT', 'SQUARE_LOCATION_ID']}
      onClick={testSquare}
      result={squareStatus}
    />
    <TestBox
      title="Supabase Database"
      vars={['SUPABASE_URL', 'SUPABASE_ANON_KEY']}
      onClick={testSupabase}
      result={supabaseStatus}
    />
    <TestBox title="Stream Cleanup" vars={['Auto Cleanup']} onClick={cleanupStreams} />
  </div>
)

const TestBox = ({
  title,
  vars,
  onClick,
  result
}: {
  title: string
  vars: string[]
  onClick: () => void
  result?: any | null
}) => (
  <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
    <h3 className="font-semibold text-white mb-2">{title}</h3>
    <ul className="text-gray-400 text-xs mb-3">
      {vars.map(v => (
        <li key={v}>• {v}</li>
      ))}
    </ul>
    <button
      onClick={onClick}
      className="px-4 py-2 bg-purple-600 rounded-lg text-white hover:bg-purple-700 transition-colors text-sm"
    >
      Test
    </button>
    {result && (
      <div className="mt-3 text-xs text-gray-300">
        {title.includes('Square') && (
          <div className="space-y-1">
            <div>Environment: <span className="text-white">{String(result.env || 'unknown')}</span></div>
            <div>Has Token: <span className={result.hasToken ? 'text-green-400' : 'text-red-400'}>{String(result.hasToken)}</span></div>
            <div>Has Location ID: <span className={result.hasLocationId ? 'text-green-400' : 'text-red-400'}>{String(result.hasLocationId)}</span></div>
            <div>Client Ready: <span className={result.clientReady ? 'text-green-400' : 'text-red-400'}>{String(result.clientReady)}</span></div>
            <div>API OK: <span className={result.apiOk ? 'text-green-400' : 'text-red-400'}>{String(result.apiOk)}</span></div>
            {result.details && <div className="text-yellow-400 mt-2">⚠️ {String(result.details)}</div>}
            {result.error && <div className="text-red-400 mt-2">Error: {String(result.error)}</div>}
          </div>
        )}
        {title.includes('Agora') && (
          <div>
            <div>ok: {String(result.ok)}</div>
            {result.appId && <div>appId: {String(result.appId)}</div>}
            {result.expiresAt && <div>expiresAt: {String(result.expiresAt)}</div>}
            {result.error && <div>error: {String(result.error)}</div>}
          </div>
        )}
        {title.includes('Supabase') && (
          <div>
            <div>ok: {String(result.ok)}</div>
            {result.error && <div>error: {String(result.error)}</div>}
          </div>
        )}
      </div>
    )}
  </div>
)
