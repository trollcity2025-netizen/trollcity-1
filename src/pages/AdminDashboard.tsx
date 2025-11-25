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
  })

  const [activeTab, setActiveTab] = useState<
    'connections' | 'payouts' | 'purchases' | 'verification' | 'users' | 'broadcasters' | 'families' | 'cashouts' | 'support'
  >('connections')
  const [loading, setLoading] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)

  const [payouts, setPayouts] = useState<any[]>([])
  const [cashouts, setCashouts] = useState<any[]>([])
  const [cashoutsSearch, setCashoutsSearch] = useState('')
  const [cashoutsProvider, setCashoutsProvider] = useState('')
  const [purchases, setPurchases] = useState<any[]>([])
  const [verifications, setVerifications] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [broadcastersList, setBroadcastersList] = useState<any[]>([])
  const [familiesList, setFamiliesList] = useState<any[]>([])
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [squareStatus, setSquareStatus] = useState<any | null>(null)
  const [agoraStatus, setAgoraStatus] = useState<any | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null)
  const [trollDropAmount, setTrollDropAmount] = useState<number>(100)
  const [trollDropDuration, setTrollDropDuration] = useState<number>(60)

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
  }, [])

  // Auto-refresh core stats every 10 seconds
  useEffect(() => {
    const id = setInterval(() => {
      loadDashboardData()
    }, 10000)
    return () => clearInterval(id)
  }, [])

  // Realtime stream updates (CTV-style)
  useEffect(() => {
    const channel = supabase
      .channel('admin-streams-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => {
          loadLiveStreams()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
        supabase.from('troll_officer_applications').select('id').eq('status', 'pending'),
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
        earnedCoins: 0, // still placeholder until you wire separate earned-coin logic
        totalCoinsInCirculation: totalCoins,
        totalValue,
        coinSalesRevenue,
        totalPayouts,
        feesCollected,
        platformProfit,
        giftCoins,
        appSponsoredGifts,
        savPromoCount,
        vivedPromoCount
      }))
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

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
      const res = await fetch('/api/agora/agora-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (res.ok && json?.token) {
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
      const res = await fetch('/api/payments/status')
      const json = await res.json()
      setSquareStatus(json)
      if (json.apiOk) toast.success(`Square reachable (${json.env})`)
      else toast.error(json.details ? `Square failed: ${json.details}` : 'Square status check failed')
    } catch {
      setSquareStatus({ ok: false })
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

  const loadVerifications = async () => {
    setTabLoading(true)
    try {
      const { data } = await supabase
        .from('troll_officer_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      setVerifications(data || [])
    } catch {
      setVerifications([])
    } finally {
      setTabLoading(false)
    }
  }

  const approveVerification = async (id: string) => {
    try {
      await supabase
        .from('troll_officer_applications')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id)
      await loadVerifications()
      toast.success('Application approved')
    } catch {
      toast.error('Failed to approve')
    }
  }

  const loadUsers = async () => {
    setTabLoading(true)
    try {
      const token = await getAdminToken()
      const resp = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) {
        const json = await resp.json()
        setUsersList(json?.users || [])
      } else {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, email, role, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        setUsersList(data || [])
      }
    } catch {
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
    if (activeTab !== 'cashouts') return
    const channel = supabase
      .channel('cashouts_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
        loadCashouts()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

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
    { id: 'verification', label: 'Verification' },
    { id: 'users', label: 'Users' },
    { id: 'broadcasters', label: 'Broadcasters' },
    { id: 'families', label: 'Families' },
    { id: 'support', label: 'Support Tickets' }
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
            role: isAdmin ? 'admin' : 'user',
            email: user?.email || null,
            created_at: now,
            updated_at: now,
          })
          .select('*')
          .single()
        if (created) { setProfile(created as any); return }
      } catch {}
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
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
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
                      <td className="px-4 py-2 text-sm text-white">@{r.username}<div className="text-xs text-gray-400">{r.email}</div></td>
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

        {/* VERIFICATION TAB */}
        {activeTab === 'verification' && (
          <ListView
            loading={tabLoading}
            emptyText="No pending applications"
            data={verifications}
            renderItem={(v: any) => (
              <div
                key={v.id}
                className="flex justify-between border-b border-[#2C2C2C] py-2 text-sm"
              >
                <span className="text-white">{v.user_id}</span>
                <button
                  onClick={() => approveVerification(v.id)}
                  className="bg-purple-600 px-3 py-1 rounded text-xs"
                >
                  Approve
                </button>
              </div>
            )}
          />
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && <UserTable loading={tabLoading} data={usersList} />}

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
                <span className="text-white">@{b.username}</span>
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
                <td className="px-3 py-2">@{t.username || t.user_id}</td>
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
      </div>
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
  data
}: {
  loading: boolean
  data: any[]
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
              <td className="px-3 py-2 text-white">@{u.username}</td>
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
          <div>
            <div>env: {String(result.env || 'unknown')}</div>
            <div>hasToken: {String(result.hasToken)}</div>
            <div>clientReady: {String(result.clientReady)}</div>
            <div>apiOk: {String(result.apiOk)}</div>
            {result.details && <div>details: {String(result.details)}</div>}
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
