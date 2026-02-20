// src/pages/admin/AdminDashboard.tsx - Reload
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import './admin.css'
import { trollCityTheme } from '../../styles/trollCityTheme'
import { useAuthStore } from '../../lib/store'
import { supabase, isAdminEmail, UserRole } from '../../lib/supabase'
import { sendNotification } from '../../lib/sendNotification'
import { Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import CitySummaryBar from './components/CitySummaryBar'
import CityControlsHealth from './components/CityControlsHealth'
import FinanceEconomyCenter from './components/FinanceEconomyCenter'
import RevenueInventoryDashboard from './components/RevenueInventoryDashboard'
import OperationsControlDeck from './components/OperationsControlDeck'
import AdditionalTasksGrid from './components/AdditionalTasksGrid'
import QuickActionsBar from './components/QuickActionsBar'
import PresidentialOversightPanel from './components/PresidentialOversightPanel'
import ProposalManagementPanel from './components/shared/ProposalManagementPanel'
import TempAdminDashboard from './TempAdminDashboard'
import ErrorBoundary from '../../components/ErrorBoundary'

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
  purchasedCoins: number
  earnedCoins: number
  freeCoins: number
  totalCoinsInCirculation: number
  totalValue: number
  giftCoins: number
  appSponsoredGifts: number
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
  | 'admin_pool'
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
  | 'voting'
  | 'cashouts'
  | 'purchases'
  | 'declined'
  | 'verification'
  | 'users'
  | 'broadcasters'
  | 'families'
  | 'support'
  | 'support_tickets'
  | 'agreements'
  | 'reports'
  | 'send_notifications'
  | 'interview'

interface CoinTransaction {
  amount: number | null;
  type: string;
  metadata?: {
    amount_paid?: number;
    coins_awarded?: number;
    is_jackpot?: boolean;
    [key: string]: unknown;
  };
  user_id?: string;
}



interface LiveStream {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  broadcaster_id: string;
}

export default function AdminDashboard() {
  const { profile, user, setProfile, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const isTempAdmin = profile?.role === UserRole.TEMP_CITY_ADMIN

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
    total_liability_coins: 0,
    total_platform_profit_usd: 0,
    kick_ban_revenue: 0,
  })

  const [activeTab, setActiveTab] = useState<TabId>('connections')
  // Real-time toast for tab changes
  useEffect(() => {
    // Only show toast for critical tabs
    if ([
      'payouts',
      'payout_queue',
      'purchases',
      'stream_monitor',
      'send_notifications',
    ].includes(activeTab)) {
      toast.info(`Switched to tab: ${activeTab}`)
    }
  }, [activeTab])
  const [supabaseStatus, setSupabaseStatus] = useState<unknown | null>(null)
  const [paypalStatus, setPaypalStatus] = useState<unknown | null>(null)
  const [paypalTesting, setPaypalTesting] = useState(false)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)

  // Economy summary
  const [economySummary, setEconomySummary] = useState<EconomySummary | null>(null)
  const [economyLoading, setEconomyLoading] = useState(false)

  // Live streams
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [streamsLoading, setStreamsLoading] = useState(false)

  // New dashboard state
  const [taskCounts, setTaskCounts] = useState({
    taxReviews: 0,
    supportTickets: 0,
    alerts: 0
  })

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
  }, [user, isLoading])

  const loadDashboardData = useCallback(async () => {
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
        taxReviewsRes,
        supportRes,
        alertsRes,
        // paypalRevenueRes, // Deprecated view
      ] = await Promise.all([
        supabase.from('user_profiles').select('id'),
        supabase.from('user_profiles').select('id').eq('role', 'admin'),
        supabase.from('applications').select('id').eq('status', 'pending'),
        supabase.from('payout_requests').select('id').eq('status', 'pending'),
        supabase.from('user_profiles').select('id').eq('role', 'troll_officer'),
        supabase.from('stream_reports').select('id').eq('status', 'pending'),
        supabase.from('user_profiles').select('troll_coins'),
        supabase.from('coin_transactions').select('metadata, platform_profit, amount').in('type', ['store_purchase', 'paypal_purchase', 'purchase']),
        supabase.from('coin_transactions').select('amount, type').eq('type', 'gift'),
        supabase.from('payout_requests').select('cash_amount, processing_fee'),
        supabase.from('user_tax_info').select('id').eq('status', 'pending'),
        supabase.from('support_tickets').select('id').eq('status', 'open'),
        supabase.from('system_alerts').select('id').eq('status', 'unread'),
        // supabase.from('view_admin_coin_revenue').select('*'), // Deprecated
      ])

      const users = usersRes.data || []
      const apps = appsRes.data || []
      const admins = adminsRes.data || []
      const pendingPayouts = pendingPayoutsRes.data || []
      const officers = officersRes.data || []
      const flags = flagsRes.data || []
      const taxReviews = taxReviewsRes.data || []
      const supportTickets = supportRes.data || []
      const alerts = alertsRes.data || []
      // const paypalRevenueData = paypalRevenueRes.data || []

      const balances = balancesRes.data || []
      let purchasedCoins = 0
      let savBonusTotal = 0
      for (const row of balances as any[]) {
        purchasedCoins += Number(row.troll_coins || 0)
        savBonusTotal += Number(row.sav_bonus_coins || 0)
      }
      const freeCoins = savBonusTotal
      const totalCoins = purchasedCoins
      const totalValue = totalCoins / 100

      const coinTx = coinTxRes.data || []
      let coinSalesRevenue = 0
      let platformProfit = 0 // Track real profit

      for (const t of coinTx as any[]) {
        let profit = Number(t.platform_profit || 0)
        let revenue = profit 
        
        // Fallback if profit is 0 (e.g. older transactions or direct purchases)
        if (profit <= 0) {
          const meta = t.metadata || {}
          const amountPaid = Number(meta.amount_paid || meta.price || 0)
          if (!isNaN(amountPaid) && amountPaid > 0) {
            revenue = amountPaid
            profit = revenue // Simplified assumption if profit not tracked
          }
        }

        if (revenue > 0) coinSalesRevenue += revenue
        if (profit > 0) platformProfit += profit
      }

      // Add PayPal revenue (if we still need to fetch from view, but we are using coin_transactions now which should include paypal_purchase)
      // So we can skip paypalRevenueData loop to avoid double counting if coin_transactions has it.
      // Assuming coin_transactions is the source of truth for all "store_purchase" and "paypal_purchase".

      const giftTx = giftTxRes.data || []
      let giftCoins = 0
      for (const g of giftTx as any[]) {
        const amt = Number(g.amount || 0)
        if (amt < 0) giftCoins += Math.abs(amt)
      }
      const appSponsoredGifts = 0

      const payoutRows = payoutAggRes.data || []
      let totalPayouts = 0
      let feesCollected = 0
      for (const p of payoutRows as any[]) {
        const cashAmount = Number(p.cash_amount || 0)
        const feeAmount = Number(p.processing_fee || 0)
        if (!isNaN(cashAmount)) totalPayouts += cashAmount
        if (!isNaN(feeAmount)) feesCollected += feeAmount
      }

      // const platformProfit = coinSalesRevenue - totalPayouts // Old logic
      // New logic: platformProfit is summed from transactions (actual profit), minus payouts? 
      // Usually Platform Profit = (Revenue - Gateway Fees) - Payouts?
      // But 'platform_profit' in coin_transactions usually means (Revenue - Gateway Fee).
      // So Net Profit = Platform Profit - Payouts.
      // Let's display "Platform Profit" as the Gross Profit from Sales, and maybe a "Net Profit" elsewhere.
      // But the variable name 'platformProfit' matches the state. Let's use the summed profit.
      // Or if the user wants "Revenue", we use coinSalesRevenue.
      // Let's keep platformProfit as the summed profit from transactions.

      setStats(prev => ({
        ...prev,
        totalUsers: users.length,
        adminsCount: admins.length,
        pendingApps: apps.length,
        pendingPayouts: pendingPayouts.length,
        trollOfficers: officers.length,
        aiFlags: flags.length,
        purchasedCoins,
        earnedCoins: 0,
        freeCoins,
        totalCoinsInCirculation: totalCoins,
        totalValue,
        coinSalesRevenue,
        totalPayouts,
        feesCollected,
        platformProfit, // Updated
        giftCoins,
        appSponsoredGifts,
        total_liability_coins: 0,
        total_platform_profit_usd: platformProfit, // Updated

        kick_ban_revenue: 0,
      }))

      setTaskCounts({
        taxReviews: taxReviews.length,
        supportTickets: supportTickets.length,
        alerts: alerts.length
      })

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    }
  }, [])

  const loadEconomySummary = useCallback(async () => {
    try {
      setEconomyLoading(true)
      
      // Load from economy_summary view
      const { data: summary, error: summaryError } = await supabase
        .from('economy_summary')
        .select('*')
        .single()
      
      if (!summaryError && summary) {
        // We could use this summary directly if we had a place for it, 
        // but currently we use the API/calculated one
      } else {
        console.warn('Failed to load economy_summary view:', summaryError)
      }
      
      // Also load detailed economy summary from API (existing logic)
      const json = await (await import('../../lib/api')).default.get('/admin/economy/summary')
      if (!json.success) throw new Error(json?.error || 'Failed to load economy summary')
      setEconomySummary(json.data)
    } catch (err: unknown) {
      console.error('Failed to load economy summary:', err)
      // Fallback: compute summary client-side
      try {
        const { data: troll_coinsTx } = await supabase
          .from('coin_transactions')
          .select('user_id, amount, type')
          .in('type', ['store_purchase', 'cashout', 'paypal_purchase'])

        const troll_coinsMap: Record<string, { purchased: number; spent: number }> = {};
        ((troll_coinsTx || []) as CoinTransaction[]).forEach((tx) => {
          const userId = tx.user_id || 'unknown';
          const existing = troll_coinsMap[userId] || { purchased: 0, spent: 0 }
          if (tx.type === 'store_purchase' || tx.type === 'paypal_purchase') existing.purchased += Math.abs(Number(tx.amount || 0))
          if (tx.type === 'cashout') existing.spent += Math.abs(Number(tx.amount || 0))
          troll_coinsMap[userId] = existing
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
        (broadcasterEarnings || []).forEach((e: { amount: number | null; status: string }) => {
          const amt = Number(e.amount || 0)
          if (e.status === 'paid') paidOutUsd += amt
          totalUsdOwed += amt
        })
        const pendingCashoutsUsd = totalUsdOwed - paidOutUsd

        const { data: officerPayments } = await supabase
          .from('coin_transactions')
          .select('amount')
          .eq('type', 'officer_payment')
        const totalUsdPaid = (officerPayments || []).reduce((sum: number, p: { amount: number | null }) => sum + Number(p.amount || 0), 0)

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
          const transactions = (messageTx || []) as CoinTransaction[]
          transactions.forEach((tx) => {
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
          messages: messageStats
        })
      } catch (e) {
        console.error('Economy fallback failed:', e)
      }
    } finally {
      setEconomyLoading(false)
    }
  }, [])

  const loadLiveStreams = useCallback(async () => {
    setStreamsLoading(true)
    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, status, created_at, broadcaster_id')
        .eq('is_live', true) // Use is_live instead of status for consistency
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setLiveStreams(data || [])
    } catch (error) {
      console.error('Error loading live streams:', error)
    } finally {
      setStreamsLoading(false)
    }
  }, [])

  // === INITIAL LOAD & REALTIME UPDATES ===
  useEffect(() => {
    if (!isAuthorized) return

    // Initial load
    loadLiveStreams()
    loadDashboardData()
    loadEconomySummary()

    // Polling for data updates (every 30s)
    const interval = setInterval(() => {
        loadLiveStreams();
        loadDashboardData();
        // Economy summary is heavy, maybe poll less frequently or not at all?
        // Let's keep it manual refresh or long poll if needed.
    }, 30000);

    // Realtime subscriptions
    // Only keep low-velocity, critical admin alerts if necessary.
    // Removed 'streams' subscription to prevent high-frequency updates from viewer counts.
    
    const appsChannel = supabase
      .channel('admin-global-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const payoutsChannel = supabase
      .channel('admin-global-payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(appsChannel)
      supabase.removeChannel(payoutsChannel)
    }
  }, [isAuthorized, loadLiveStreams, loadDashboardData, loadEconomySummary])

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
    } catch (error: unknown) {
      console.error('Error ending stream:', error)
      const message = error instanceof Error ? error.message : 'Failed to end stream'
      toast.error(message)
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

  // New dashboard handlers
  const handleEmergencyStop = async () => {
    if (!window.confirm("⚠️ EMERGENCY STOP: This will immediately END ALL active broadcasts.\n\nAre you sure you want to proceed?")) {
      return
    }

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .or('is_live.eq.true,status.eq.live')

      if (error) throw error

      toast.success('Emergency stop executed - All streams ended')
      loadLiveStreams() // Refresh local state
    } catch (error) {
      console.error('Error executing emergency stop:', error)
      toast.error('Failed to stop streams')
    }
  }

  const handleBroadcastMessage = () => {
    navigate('/admin/send-notifications')
  }

  const handleSendNotifications = () => {
    navigate('/admin/send-notifications')
  }

  const handleSystemMaintenance = () => {
    navigate('/admin/reset-maintenance')
  }

  const handleViewAnalytics = () => {
    navigate('/admin/reports-queue')
  }

  const handleExportData = () => {
    navigate('/admin/export-data')
  }

  const _handleSelectTab = (tabId: string) => {
    setActiveTab(tabId as TabId)
  }

  const handleNavigateToEconomy = () => navigate('/admin/economy')
  const handleNavigateToTaxReviews = () => navigate('/admin/tax-reviews')
  const handleOpenTestDiagnostics = () => navigate('/admin/test-diagnostics')
  const handleOpenControlPanel = () => navigate('/admin/control-panel')
  const handleOpenGrantCoins = () => navigate('/admin/grant-coins')
  const handleOpenFinanceDashboard = () => navigate('/admin/finance')
  const handleOpenCreateSchedule = () => navigate('/admin/create-schedule')
  const handleOpenOfficerShifts = () => navigate('/admin/officer-shifts')
  const handleOpenResetPanel = () => navigate('/admin/reset-maintenance')
  const handleOpenEmpireApplications = () => navigate('/admin/empire-applications')
  const handleOpenReferralBonuses = () => navigate('/admin/referral-bonuses')
  const handleOpenAdminPool = () => navigate('/admin/pool')
  const handleOpenTrollmersTournament = () => navigate('/admin/trollmers-tournament')

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
        voting: '/admin/voting',
        media_library: '/admin/media-library',
        chat_moderation: '/admin/chat-moderation',
        announcements: '/admin/announcements',
        reports: '/admin/reports-queue',
        finance_dashboard: '/admin/finance',
        economy_dashboard: '/admin/economy',
        grant_coins: '/admin/grant-coins',
        tax_reviews: '/admin/tax-reviews',
        payment_logs: '/admin/payment-logs',
        store_pricing: '/admin/store-pricing',
        admin_pool: '/admin/pool',
        create_schedule: '/admin/create-schedule',
        officer_shifts: '/admin/officer-shifts',
        // NOTE: /admin/shift-requests-approval route does not exist; keep the action working by
        // landing on the shifts view instead.
        shift_requests_approval: '/admin/officer-shifts',
        empire_applications: '/admin/empire-applications',
        referral_bonuses: '/admin/referral-bonuses',
        control_panel: '/admin/control-panel',
        test_diagnostics: '/admin/test-diagnostics',
        reset_maintenance: '/admin/reset-maintenance',
        export_data: '/admin/export-data',
        support_tickets: '/admin/support-tickets',
        send_notifications: '/admin/send-notifications',
      } as Record<TabId, string>),
    []
  )

  useEffect(() => {
    const target = redirectRoutes[activeTab]
    if (target) {
      navigate(target)
    }
  }, [activeTab, navigate, redirectRoutes])


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
            // Update role to admin securely
            const { error: updateError } = await supabase.rpc('admin_update_user_role', {
              p_target_user_id: user.id,
              p_new_role: 'admin'
            });
            
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
            total_earned_coins: 100,
            total_spent_coins: 0,
            email: user?.email || null,
            created_at: now,
            updated_at: now,
          })
          .select('*')
          .single()
        if (created) {
          // Credit 100 starter coins via Troll Bank
          try {
              await supabase.functions.invoke('bank-credit', {
                  body: {
                      user_id: created.id,
                      coins: 100,
                      bucket: 'promo',
                      source: 'admin_dashboard_init',
                      ref_id: 'starter_coins_' + created.id
                  }
              })
          } catch (e) {
              console.error('Failed to credit starter coins:', e)
          }

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
      } as any
      setProfile(minimalProfile)
    }
    ensureProfile()
  }, [profile, user, setProfile])

  if (adminCheckLoading || !profile) {
    return (
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex items-center justify-center`}>
        <div className={`px-6 py-3 rounded ${trollCityTheme.backgrounds.card} border border-[#2C2C2C]`}>
          Loading admin dashboard
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white flex items-center justify-center`}>
        <div className="px-6 py-3 rounded bg-red-950 border border-red-500 text-center">
          <p className="font-bold mb-1">Access Restricted</p>
          <p className="text-sm text-red-200">
            This dashboard is limited to administrators only.
          </p>
        </div>
      </div>
    )
  }

  if (isTempAdmin) {
    return <TempAdminDashboard />
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white`}>
      {/* Quick Actions Bar */}
      <QuickActionsBar
        onEmergencyStop={handleEmergencyStop}
        onBroadcastMessage={handleBroadcastMessage}
        onSendNotifications={handleSendNotifications}
        onSystemMaintenance={handleSystemMaintenance}
        onViewAnalytics={handleViewAnalytics}
        onExportData={handleExportData}
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
                  // Clear local storage first
                  localStorage.clear()
                  sessionStorage.clear()

                  // Call logout from the store
                  const { logout } = useAuthStore.getState()
                  if (logout) logout()

                  // Only attempt supabase signOut if there is an active session
                  try {
                    const { data: sessionData } = await supabase.auth.getSession()
                    const hasSession = !!sessionData?.session
                    if (hasSession) {
                      const { error } = await supabase.auth.signOut()
                      if (error) console.warn('supabase.signOut returned error:', error)
                    } else {
                      // No active session — nothing to sign out from
                      console.debug('No active auth session; skipping supabase.auth.signOut()')
                    }
                  } catch (innerErr: any) {
                    // If signOut throws due to missing session, ignore and continue
                    console.warn('Error during supabase signOut (ignored):', innerErr?.message || innerErr)
                  }

                  toast.success('Logged out')
                  navigate('/auth', { replace: true })
                } catch (error) {
                  console.error('Logout error:', error)
                  // Even if signOut fails, clear local state and redirect
                  localStorage.clear()
                  sessionStorage.clear()
                  const { logout } = useAuthStore.getState()
                  if (logout) logout()
                  navigate('/auth', { replace: true })
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
        <ErrorBoundary>
          <CitySummaryBar
            stats={stats}
            liveStreamsCount={liveStreams.length}
          />
        </ErrorBoundary>

        {/* City Controls & Health Section */}
        <ErrorBoundary>
          <CityControlsHealth
            paypalStatus={paypalStatus}
            supabaseStatus={supabaseStatus}
            liveStreams={liveStreams}
            onTestPayPal={testPayPal}
            onTestSupabase={testSupabase}
            onLoadLiveStreams={loadLiveStreams}
            onCreateTrollDrop={createTrollDrop}
            trollDropAmount={trollDropAmount}
            setTrollDropAmount={setTrollDropAmount}
            trollDropDuration={trollDropDuration}
            setTrollDropDuration={setTrollDropDuration}
            paypalTesting={paypalTesting}
          />
        </ErrorBoundary>

        {/* Finance & Economy Center */}
        <ErrorBoundary>
          <FinanceEconomyCenter
            stats={stats}
            economySummary={economySummary}
            economyLoading={economyLoading}
            onLoadEconomySummary={loadEconomySummary}
          />
        </ErrorBoundary>

        {/* Revenue & Inventory Sync */}
        <ErrorBoundary>
          <RevenueInventoryDashboard />
        </ErrorBoundary>

        {/* Operations & Control Deck */}
        <ErrorBoundary>
          <OperationsControlDeck
            liveStreams={liveStreams}
            streamsLoading={streamsLoading}
            onLoadLiveStreams={loadLiveStreams}
            onEndStreamById={endStreamById}
            onDeleteStreamById={deleteStreamById}
            onViewStream={viewStream}
            stats={stats}
          />
        </ErrorBoundary>

        {/* Presidential Oversight & Proposals */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ErrorBoundary>
             <PresidentialOversightPanel />
          </ErrorBoundary>
          <ErrorBoundary>
             <ProposalManagementPanel viewMode="admin" />
          </ErrorBoundary>
        </div>

        {/* Additional Tasks Grid */}
        <ErrorBoundary>
          <AdditionalTasksGrid 
            onNavigateToEconomy={handleNavigateToEconomy}
            onNavigateToTaxReviews={handleNavigateToTaxReviews}
            onOpenTestDiagnostics={handleOpenTestDiagnostics}
            onOpenControlPanel={handleOpenControlPanel}
            onOpenGrantCoins={handleOpenGrantCoins}
            onOpenAdminPool={handleOpenAdminPool}
            onOpenTrollmersTournament={handleOpenTrollmersTournament}
            onOpenFinanceDashboard={handleOpenFinanceDashboard}
            onOpenCreateSchedule={handleOpenCreateSchedule}
            onOpenOfficerShifts={handleOpenOfficerShifts}
            onOpenResetPanel={handleOpenResetPanel}
            onOpenEmpireApplications={handleOpenEmpireApplications}
            onOpenReferralBonuses={handleOpenReferralBonuses}
            onSelectTab={_handleSelectTab} 
            counts={{
              empire_apps: stats.pendingApps,
              cashouts: stats.pendingPayouts,
              reports: stats.aiFlags,
              alerts: taskCounts.alerts,
              tax_reviews: taskCounts.taxReviews,
              support: taskCounts.supportTickets
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}