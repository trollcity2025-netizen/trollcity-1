import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Camera, Edit, Star, Settings, ChevronDown, ChevronUp, Crown, Shield, UserPlus, UserMinus, MessageCircle, Ban, Gift, AlertTriangle, Sword, Trophy, TrendingUp, Users, DollarSign, Calendar, BarChart3, Award, Target, Clock, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getTierFromXP, getLevelFromXP } from '../lib/tierSystem'
import XPProgressBar from '../components/XPProgressBar'
import SendGiftModal from '../components/SendGiftModal'
import GiftersModal from '../components/GiftersModal'
import ReportModal from '../components/ReportModal'
import { EmpireBadge } from '../components/EmpireBadge'
import ClickableUsername from '../components/ClickableUsername'
import { APP_DATA_REFETCH_EVENT_NAME } from '../lib/appEvents'

// Import recharts for creator dashboard charts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useBackgroundProfileRefresh } from '../hooks/useBackgroundProfileRefresh'

export default function Profile() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { username: routeUsername, userId } = useParams()
  const { refreshProfileInBackground } = useBackgroundProfileRefresh()
  const [viewedState, setViewedState] = useState<any | null>(null)
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'referral_code',
    'profile_info',
    'stats',
    'creator_dashboard',
    'store_purchases',
    'account_settings'
  ])
  const [editingProfile, setEditingProfile] = useState(false)
  const [bio, setBio] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [streamsCreated, setStreamsCreated] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [effects, setEffects] = useState<any[]>([])
  const [selectedEffectId, setSelectedEffectId] = useState<string>('')
  const [perks, setPerks] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [selectedPerkId, setSelectedPerkId] = useState<string>('')
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>('')
  const [privateEnabled, setPrivateEnabled] = useState<boolean>(false)
  const [viewPrice, setViewPrice] = useState(0)
  const [messagePrice, setMessagePrice] = useState(0)
  const [paypalEmail, setPaypalEmail] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showGiftersModal, setShowGiftersModal] = useState(false)
  const [giftersModalType, setGiftersModalType] = useState<'received' | 'sent'>('received')
  const [coinsReceived, setCoinsReceived] = useState(0)
  const [coinsSent, setCoinsSent] = useState(0)
  const [showReportModal, setShowReportModal] = useState(false)
  const [userPosts, setUserPosts] = useState<any[]>([])
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean>(true)
  const [checkingAccess, setCheckingAccess] = useState<boolean>(false)
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null)

  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const normalizedRouteUsername = routeUsername ? routeUsername.trim().toLowerCase() : ''
  const isProfileMeRoute = normalizedRouteUsername === 'me'
  const routeTargetKey = userId
    ? `id:${userId}`
    : isProfileMeRoute
      ? 'self'
      : routeUsername
        ? `name:${routeUsername}`
        : null

  const shouldShowViewed = !!routeTargetKey && routeTargetKey !== 'self'
  const lastViewedRef = useRef<any | null>(null)

  const updateViewedState = (value: any | null) => {
    if (value) {
      lastViewedRef.current = value
    }
    setViewedState(value)
  }

  useEffect(() => {
    if (routeTargetKey === 'self') {
      lastViewedRef.current = null
      setViewedState(null)
    }
  }, [routeTargetKey])

  const viewed = shouldShowViewed ? (viewedState ?? lastViewedRef.current) : null

  const lastRouteTargetKeyRef = useRef<string | null>(null)
  const lastSelfIdentityRef = useRef<string | null>(null)

  // Referral code state
  const [referralCode, setReferralCode] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [recruitedBy, setRecruitedBy] = useState<any>(null)
  
  // Battle history state
  const [battles, setBattles] = useState<any[]>([])
  const [battleStats, setBattleStats] = useState({
    totalBattles: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winRate: 0,
    totalCoinsReceived: 0,
    totalCoinsSent: 0,
  })
  const [battlesLoading, setBattlesLoading] = useState(false)

  // Creator Dashboard state
  const [creatorOverview, setCreatorOverview] = useState<any>(null)
  const [dailySeries, setDailySeries] = useState<any[]>([])
  const [hourly, setHourly] = useState<any[]>([])
  const [topGifters, setTopGifters] = useState<any[]>([])
  const [battleEvent, setBattleEvent] = useState<any[]>([])
  const [bonusSummary, setBonusSummary] = useState<any>(null)
  const [creatorLoading, setCreatorLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const statsPollRef = useRef<number | null>(null)

  // Initialize view price and referral code from profile
  useEffect(() => {
    if (profile) {
      setViewPrice(Number((profile as any)?.profile_view_price ?? 0))
      setMessagePrice(Number((profile as any)?.message_price ?? 0))
      setPaypalEmail((profile as any)?.payout_paypal_email ?? '')

      // Set referral code and link
      const code = profile.id
      const link = `${window.location.origin}/auth?ref=${code}`
      setReferralCode(code)
      setReferralLink(link)
    }
  }, [profile?.id])

  // Handle URL section parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const section = params.get('section')
    if (section && !expandedSections.includes(section)) {
      setExpandedSections(prev => [...prev, section])
    }
  }, [location.search])

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const isValidUuid = (value: string) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )

  const loadBattleHistory = useCallback(async (targetUserId: string) => {
    setBattlesLoading(true)
    try {
      const { data, error } = await supabase
        .from('battle_history')
        .select(`
          *,
          opponent:opponent_id (username, avatar_url),
          battle:battle_id (
            host_id,
            challenger_id,
            winner_id,
            host_troll_coins,
            challenger_troll_coins,
            host_trollmonds,
            challenger_trollmonds
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const battleHistory = data || []
      setBattles(battleHistory)

      // Calculate stats
      const wins = battleHistory.filter((b: any) => b.won).length
      const losses = battleHistory.filter((b: any) => !b.won && b.battle?.winner_id !== null).length
      const ties = battleHistory.filter((b: any) => b.battle?.winner_id === null).length
      
      // Get total coins (paid + free) from battle data
      const totalCoinsReceived = battleHistory.reduce((sum: number, b: any) => {
        if (!b.battle) return sum
        const userTotal = b.battle.host_id === b.user_id
          ? (b.battle.host_troll_coins || 0) + (b.battle.host_trollmonds || 0)
          : (b.battle.challenger_troll_coins || 0) + (b.battle.challenger_trollmonds || 0)
        return sum + userTotal
      }, 0)
      
      const totalCoinsSent = battleHistory.reduce((sum: number, b: any) => sum + (b.troll_coins_sent || 0), 0)
      const winRate = battleHistory.length > 0 ? Math.round((wins / battleHistory.length) * 100) : 0

      setBattleStats({
        totalBattles: battleHistory.length,
        wins,
        losses,
        ties,
        winRate,
        totalCoinsReceived,
        totalCoinsSent,
      })
    } catch (err: any) {
      console.error('Error loading battle history:', err)
    } finally {
      setBattlesLoading(false)
    }
  }, [setBattles, setBattlesLoading, setBattleStats])

  // Creator Dashboard data loading functions
  const loadCreatorDashboardData = async () => {
    setCreatorLoading(true)
    try {
      await Promise.all([
        loadEarningsOverview(),
        loadDailyEarningsSeries(),
        loadHourlyActivity(),
        loadTopGifters(),
        loadBattleEventEarnings()
      ])
    } catch (error) {
      console.error('Error loading creator dashboard data:', error)
    } finally {
      setCreatorLoading(false)
    }
  }

  const loadEarningsOverview = async () => {
    const { data, error } = await supabase.rpc('get_earnings_overview')
    if (error) throw error
    setCreatorOverview(data?.[0] || null)
  }

  const loadDailyEarningsSeries = async () => {
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const { data, error } = await supabase.rpc('get_daily_earnings_series', {
      days_back: daysBack
    })
    if (error) throw error
    setDailySeries(data || [])
  }

  const loadHourlyActivity = async () => {
    const { data, error } = await supabase.rpc('get_hourly_activity')
    if (error) throw error
    setHourly(data || [])
  }

  const loadTopGifters = async () => {
    const limitCount = 10

    try {
      const { data, error } = await supabase.rpc('get_top_gifters', {
        limit_count: limitCount
      })
      if (error) throw error
      setTopGifters(data || [])
      return
    } catch (rpcError) {
      console.warn('Top gifters RPC is not available, falling back to client aggregation', rpcError)
    }

    if (!user?.id) {
      setTopGifters([])
      return
    }

    try {
      const { data: gifts, error: giftsError } = await supabase
        .from('gifts')
        .select('sender_id, coins_spent')
        .eq('receiver_id', user.id)

      if (giftsError) {
        console.warn('Failed to load gifts for fallback leaderboard', giftsError)
        setTopGifters([])
        return
      }

      const totals = new Map<string, number>()
      for (const gift of gifts || []) {
        const senderId = gift?.sender_id
        if (!senderId) continue
        const coins = Number(gift.coins_spent || 0)
        totals.set(senderId, (totals.get(senderId) ?? 0) + coins)
      }

      const sorted = Array.from(totals.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limitCount)

      if (!sorted.length) {
        setTopGifters([])
        return
      }

      const senderIds = sorted.map(([senderId]) => senderId)
      const { data: senderProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds)

      if (profilesError) {
        console.warn('Unable to fetch sender profiles for fallback leaderboard', profilesError)
      }

      const profileMap = new Map((senderProfiles || []).map(profile => [profile.id, profile]))

      const fallbackGifters = sorted.map(([senderId, totalCoins]) => ({
        sender_id: senderId,
        total_coins: totalCoins,
        sender_username: profileMap.get(senderId)?.username ?? 'Unknown User',
        sender_avatar_url: profileMap.get(senderId)?.avatar_url ?? ''
      }))

      setTopGifters(fallbackGifters)
    } catch (fallbackError) {
      console.warn('Failed to build fallback top gifters leaderboard', fallbackError)
      setTopGifters([])
    }
  }

  const loadBattleEventEarnings = async () => {
    try {
      const { data, error } = await supabase.rpc('get_battle_and_net_earnings')
      if (error) throw error
      setBattleEvent(data || [])
      return
    } catch (rpcError) {
      console.warn('Battle/event RPC missing, falling back to client aggregation', rpcError)
    }

    if (!user?.id) {
      setBattleEvent([])
      return
    }

    try {
      const { data: gifts, error: giftsError } = await supabase
        .from('gifts')
        .select('coins_spent, battle_id, message')
        .eq('receiver_id', user.id)

      if (giftsError) throw giftsError

      const totals = {
        battle: 0,
        event: 0,
        other: 0,
      }

      for (const gift of gifts || []) {
        const coins = Number(gift.coins_spent || 0)
        if (gift.battle_id) {
          totals.battle += coins
        } else if (typeof gift.message === 'string' && gift.message.toLowerCase().includes('event')) {
          totals.event += coins
        } else {
          totals.other += coins
        }
      }

      setBattleEvent([
        { source: 'battle', coins: totals.battle },
        { source: 'event', coins: totals.event },
        { source: 'other', coins: totals.other },
      ])
    } catch (fallbackError) {
      console.warn('Fallback battle/event aggregation failed', fallbackError)
      setBattleEvent([])
    }
  }


  const handleSaveProfile = async () => {
    if (!profile) return
    
    try {
      const updates: any = { bio }
      
      // If username is being edited and changed
      if (editUsername && editUsername !== profile.username) {
        // Check username length limit (14 chars for regular users, unlimited for officers/admin)
        const maxLength = (profile.role === 'troll_officer' || profile.role === 'admin') ? 999 : 14
        if (editUsername.length > maxLength) {
          toast.error(`Username must be ${maxLength} characters or less`)
          return
        }
        
        // Check if username is already taken
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', editUsername)
          .maybeSingle()
        
        if (existing) {
          toast.error('Username already taken')
          return
        }
        
        updates.username = editUsername
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) throw error

      // Update local profile
      useAuthStore.getState().setProfile({ ...profile, ...updates })
      
      toast.success('Profile updated successfully!')
      setEditingProfile(false)
      setEditUsername('')
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
    }
  }

  const loadStats = useCallback(async (forceRefresh = false) => {
    if (!routeTargetKey && !forceRefresh) {
      return
    }

    const selfIdentity = profile?.id || user?.id || null
    const shouldRefetchSelf =
      routeTargetKey === 'self' && selfIdentity && lastSelfIdentityRef.current !== selfIdentity
    const shouldFetch =
      forceRefresh ||
      lastRouteTargetKeyRef.current !== routeTargetKey ||
      shouldRefetchSelf

    if (!shouldFetch) {
      return
    }

    lastRouteTargetKeyRef.current = routeTargetKey
    if (shouldRefetchSelf && selfIdentity) {
      lastSelfIdentityRef.current = selfIdentity
    }

    const currentRouteKey = routeTargetKey
    if (!currentRouteKey) {
      updateViewedState(null)
      return
    }

    try {
      let target: any | null = null
      const isSelfRoute = currentRouteKey === 'self'
      const isRouteById = currentRouteKey.startsWith('id:')
      const isRouteByName = currentRouteKey.startsWith('name:')

      if (isSelfRoute) {
        target = profileRef.current || profile
        if ((!target || !target.id) && user?.id) {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*, avatar_url')
            .eq('id', user.id)
            .maybeSingle()

          if (!error && data) {
            target = data
          } else if (error) {
            console.error('Error loading self profile:', error)
            toast.error('Failed to load user profile')
          }
        }
        updateViewedState(null)
      } else if (isRouteById) {
        const targetId = currentRouteKey.slice(3)
        if (!isValidUuid(targetId)) {
          const decodedUsername = decodeURIComponent(targetId)
          let { data, error } = await supabase
            .from('user_profiles')
            .select('*, avatar_url')
            .eq('username', decodedUsername)
            .maybeSingle()

          if (!data && !error) {
            const { data: emailMatch, error: emailError } = await supabase
              .from('user_profiles')
              .select('*, avatar_url')
              .ilike('email', `${decodedUsername}@%`)
              .maybeSingle()
            data = emailMatch
            error = emailError
          }

          if (error) {
            console.error('Error loading target profile by username:', error)
            toast.error('Failed to load user profile')
            updateViewedState(null)
            return
          }

          if (!data) {
            toast.error('User not found')
            updateViewedState(null)
            return
          }

          target = data
          updateViewedState(data)
        } else {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*, avatar_url')
            .eq('id', targetId)
            .maybeSingle()

          if (error) {
            console.error('Error loading target profile by ID:', error)
            toast.error('Failed to load user profile')
            updateViewedState(null)
            return
          }

          if (!data) {
            toast.error('User not found')
            updateViewedState(null)
            return
          }

          target = data
          updateViewedState(data)
        }
      } else if (isRouteByName) {
        const usernameParam = currentRouteKey.slice(5)
        const decodedUsername = decodeURIComponent(usernameParam)
        let { data, error } = await supabase
          .from('user_profiles')
          .select('*, avatar_url')
          .eq('username', decodedUsername)
          .maybeSingle()

        if (!data && !error) {
          const { data: emailMatch, error: emailError } = await supabase
            .from('user_profiles')
            .select('*, avatar_url')
            .ilike('email', `${decodedUsername}@%`)
            .maybeSingle()
          data = emailMatch
          error = emailError
        }

        if (error) {
          console.error('Error loading target profile by username:', error)
          toast.error('Failed to load user profile')
          updateViewedState(null)
          return
        }

        if (!data) {
          toast.error('User not found')
          updateViewedState(null)
          return
        }

        target = data
        updateViewedState(data)
      } else {
        updateViewedState(null)
      }

      if (!target || !target.id) {
        console.error('Invalid target profile:', target)
        return
      }

      if (lastRouteTargetKeyRef.current !== currentRouteKey) {
        return
      }

      // Load stats for the target profile
      try {
        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('id')
          .eq('broadcaster_id', target.id)

        if (streamsError) {
          console.error('Error loading streams:', streamsError)
        } else {
          setStreamsCreated((streams || []).length)
        }
      } catch (err) {
        console.error('Error fetching streams:', err)
      }

      try {
        const { data: followers, error: followersError } = await supabase
          .from('user_follows')
          .select('id')
          .eq('following_id', target.id)

        if (followersError) {
          console.error('Error loading followers:', followersError)
        } else {
          setFollowersCount((followers || []).length)
        }
      } catch (err) {
        console.error('Error fetching followers:', err)
      }

      try {
        const { data: following, error: followingError } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', target.id)

        if (followingError) {
          console.error('Error loading following:', followingError)
        } else {
          setFollowingCount((following || []).length)
        }
      } catch (err) {
        console.error('Error fetching following:', err)
      }

      // Check if current user is following this profile
      if (user?.id && target.id !== user.id) {
        try {
          const { data: followCheck, error: followError } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', target.id)
            .maybeSingle()

          if (!followError) {
            setIsFollowing(!!followCheck)
          }

          // Check if current user has blocked this profile
          const { data: blockCheck, error: blockError } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', user.id)
            .eq('blocked_id', target.id)
            .maybeSingle()

          if (!blockError) {
            setIsBlocked(!!blockCheck)
          }

          // Check profile view access (don't auto-charge, just check)
          const viewPrice = target.profile_view_price || 0
          if (viewPrice > 0) {
            const accessKey = `tc-view-access-${user.id}-${target.id}`
            const lastAccess = localStorage.getItem(accessKey)
            const accessExpiry = 24 * 60 * 60 * 1000 // 24 hours

            // Check if access is still valid
            if (lastAccess && (Date.now() - parseInt(lastAccess)) < accessExpiry) {
              setHasAccess(true)
            } else {
              // Access expired or never granted - user needs to unlock manually
              setHasAccess(false)
            }
          } else {
            setHasAccess(true) // Free profile
          }
        } catch (err) {
          console.error('Error checking follow/block status:', err)
          setHasAccess(true) // Default to true on error
        }
      } else {
        setHasAccess(true) // Own profile always has access
      }

      // Load coins received and sent from gifts table
      try {
        const { data: receivedGifts, error: receivedError } = await supabase
          .from('gifts')
          .select('coins_spent')
          .eq('receiver_id', target.id)

        if (!receivedError && receivedGifts) {
          const totalReceived = receivedGifts.reduce((sum, gift) => sum + (gift.coins_spent || 0), 0)
          setCoinsReceived(totalReceived)
        }
      } catch (err) {
        console.error('Error loading coins received:', err)
      }

      try {
        const { data: sentGifts, error: sentError } = await supabase
          .from('gifts')
          .select('coins_spent')
          .eq('sender_id', target.id)

        if (!sentError && sentGifts) {
          const totalSent = sentGifts.reduce((sum, gift) => sum + (gift.coins_spent || 0), 0)
          setCoinsSent(totalSent)
        }
      } catch (err) {
        console.error('Error loading coins sent:', err)
      }

      // Try to load entrance effects (table might not exist yet)
      try {
        const { data: userEffects, error: effectsError } = await supabase
          .from('user_entrance_effects')
          .select('effect_id, entrance_effects:effect_id (*)')
          .eq('user_id', target.id)

        if (!effectsError && userEffects) {
          const mapped = (userEffects || []).map((row: any) => row.entrance_effects).filter(Boolean)
          if (mapped.length) {
            setEffects(mapped)
            try { localStorage.setItem('tc-effects', JSON.stringify(mapped)) } catch {}
          }
        }
      } catch (err) {
        // Table doesn't exist yet, that's okay
        console.log('Entrance effects table not available:', err)
      }

      try {
        const { data: userPerks, error: perksError } = await supabase
          .from('user_perks')
          .select('id, perk_id, expires_at, is_active, perks:perk_id (*)')
          .eq('user_id', target.id)
          .order('created_at', { ascending: false })

        if (!perksError && userPerks) {
          setPerks(userPerks)
        }
      } catch (err) {
        console.log('Perks table not available:', err)
      }

      try {
        const { data: userInsurances, error: insuranceError } = await supabase
          .from('user_insurances')
          .select('id, insurance_id, expires_at, is_active, protection_type, insurance_options:insurance_id (*)')
          .eq('user_id', target.id)
          .order('created_at', { ascending: false })

        if (!insuranceError && userInsurances) {
          setInsurances(userInsurances)
        }
      } catch (err) {
        console.log('Insurance table not available:', err)
      }

      // Load battle history
      try {
        await loadBattleHistory(target.id)
      } catch (err) {
        console.error('Error loading battle history:', err)
      }

      const viewerId = user?.id || profileRef.current?.id || profile?.id
      const isViewingSelf = !!viewerId && target?.id === viewerId

      if (!isViewingSelf) {
        setRecruitedBy(null)
      } else {
        try {
          const { data: referralData, error: referralError } = await supabase
            .from('referrals')
            .select(`
              referrer_id,
              referrer:user_profiles!referrals_referrer_id_fkey (
                username
              )
            `)
            .eq('referred_user_id', target.id)
            .maybeSingle()

          if (!referralError && referralData) {
            setRecruitedBy(Array.isArray(referralData.referrer) ? referralData.referrer[0] : referralData.referrer)
          }
        } catch (err) {
          console.error('Error loading referral data:', err)
        }
      }
    } catch (err) {
      console.error('Error in loadStats:', err)
      toast.error('Failed to load profile data')
    }
  }, [routeTargetKey, user, profile, loadBattleHistory, toast])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('tc-effects') || '[]')
      setEffects(Array.isArray(cached) ? cached : [])
    } catch {}

    try {
      if (user?.id) {
        const sel = localStorage.getItem(`tc-selected-effect-${user.id}`) || ''
        setSelectedEffectId(sel)
        const perkSel = localStorage.getItem(`tc-selected-perk-${user.id}`) || ''
        setSelectedPerkId(perkSel)
        const insuranceSel = localStorage.getItem(`tc-selected-insurance-${user.id}`) || ''
        setSelectedInsuranceId(insuranceSel)
        const priv = localStorage.getItem(`tc-private-profile-${user.id}`)
        setPrivateEnabled(priv === 'true')
      }
    } catch {}
  }, [user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleRefetch = () => {
      if (!shouldShowViewed) return
      void loadStats(true)
    }

    window.addEventListener(APP_DATA_REFETCH_EVENT_NAME, handleRefetch)
    window.addEventListener('appDataRefetch', handleRefetch)
    return () => {
      window.removeEventListener(APP_DATA_REFETCH_EVENT_NAME, handleRefetch)
      window.removeEventListener('appDataRefetch', handleRefetch)
    }
  }, [loadStats, shouldShowViewed])

  // Keep key stats fresh (avoid showing stale data after coin/follow changes)
  useEffect(() => {
    const targetId = viewed?.id || profile?.id
    if (!targetId) return

    const refreshNow = async () => {
      try {
        const { data: freshProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', targetId)
          .maybeSingle()

        if (freshProfile) {
          if (viewed && viewed.id === targetId) updateViewedState(freshProfile)
          if (!viewed && profile?.id === targetId) {
            const shouldUpdateProfile =
              !profile ||
              profile.id !== freshProfile.id ||
              (freshProfile.updated_at &&
                profile.updated_at !== freshProfile.updated_at)

            if (shouldUpdateProfile) {
              try {
                useAuthStore.getState().setProfile(freshProfile as any)
              } catch {}
            }
          }
        }

        const [{ count: streamsCount }, { count: followersCount }, { count: followingCount }] = await Promise.all([
          supabase.from('streams').select('id', { count: 'exact', head: true }).eq('broadcaster_id', targetId),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetId),
        ])

        if (typeof streamsCount === 'number') setStreamsCreated(streamsCount)
        if (typeof followersCount === 'number') setFollowersCount(followersCount)
        if (typeof followingCount === 'number') setFollowingCount(followingCount)
      } catch {
        // non-fatal
      }
    }

    refreshNow()

    if (statsPollRef.current) window.clearInterval(statsPollRef.current)
    statsPollRef.current = window.setInterval(refreshNow, 10000)

    return () => {
      if (statsPollRef.current) window.clearInterval(statsPollRef.current)
      statsPollRef.current = null
    }
  }, [profile?.id, viewed?.id])

  // Load creator dashboard data
  useEffect(() => {
    if (user && profile?.id === user.id) {
      loadCreatorDashboardData()
    }
  }, [user?.id, timeRange])

  const viewedPrice = () => {
    const p = Number(viewed?.profile_view_price || localStorage.getItem(`tc-profile-view-price-${viewed?.id}`) || 0)
    return isNaN(p) ? 0 : p
  }

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !viewed || profile?.id === viewed.id) {
        setHasAccess(true)
        setCheckingAccess(false)
        return
      }
      
      setCheckingAccess(true)
      const price = (useAuthStore.getState().profile?.role === 'admin') ? 0 : viewedPrice()
      if (price <= 0) {
        setHasAccess(true)
        setCheckingAccess(false)
        return
      }
      
      // Check localStorage first
      try {
        const access = localStorage.getItem(`tc-view-access-${user.id}-${viewed.id}`)
        if (access) {
          setHasAccess(true)
          setCheckingAccess(false)
          return
        }
      } catch {}
      
      // Check via RPC
      try {
        const { data, error } = await supabase.rpc('pay_for_profile_view', {
          p_viewer_id: user.id,
          p_profile_owner_id: viewed.id
        })
        
        if (error && error.message.includes('Insufficient')) {
          setHasAccess(false)
        } else if (data?.has_access) {
          setHasAccess(true)
        } else {
          setHasAccess(false)
        }
      } catch {
        setHasAccess(false)
      } finally {
        setCheckingAccess(false)
      }
    }
    
    if (viewed && user && viewed.id !== user.id) {
      checkAccess()
    } else {
      setHasAccess(true)
      setCheckingAccess(false)
    }
  }, [viewed?.id, user?.id, profile?.id])

  const hasAccessToViewed = async () => {
    if (!user || !viewed) return false
    if (profile?.id === viewed.id) return true
    const price = (useAuthStore.getState().profile?.role === 'admin') ? 0 : viewedPrice()
    if (price <= 0) return true
    
    // Check if user has paid for access
    try {
      const { data, error } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })
      
      if (error) {
        // If payment is required and user doesn't have access, return false
        if (error.message.includes('Insufficient')) {
          return false
        }
      }
      
      if (data?.has_access) {
        return true
      }
      
      // Fallback to localStorage check
      const access = localStorage.getItem(`tc-view-access-${user.id}-${viewed.id}`)
      return Boolean(access)
    } catch {
      return false
    }
  }
  const unlockViewedProfile = async () => {
    if (!user || !viewed || !profile) return
    const price = viewedPrice()
    if (price <= 0) {
      setHasAccess(true)
      return
    }
    
    try {
      const { data, error } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })
      
      if (error) {
        if (error.message.includes('Insufficient')) {
          toast.error('Not enough troll_coins')
        } else {
          toast.error('Failed to unlock profile')
        }
        return
      }
      
      if (data?.success && data?.has_access) {
        setHasAccess(true)
        try { localStorage.setItem(`tc-view-access-${user.id}-${viewed.id}`, String(Date.now())) } catch {}
        toast.success('Profile unlocked!')
        
        // Refresh profile balance
        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', profile.id)
          .single()
        if (updatedProfile) {
          useAuthStore.getState().setProfile(updatedProfile as any)
        }
      }
    } catch (error: any) {
      console.error('Error unlocking profile:', error)
      toast.error('Failed to unlock profile')
    }
  }

  const handleFollow = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    
    // If unfollowing, no coin cost
    if (isFollowing) {
      try {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', viewed.id)
        setIsFollowing(false)
        setFollowersCount(prev => Math.max(0, prev - 1))
        toast.success('Unfollowed')
      } catch (error) {
        console.error('Follow error:', error)
        toast.error('Failed to unfollow')
      }
      return
    }
    
    // Following requires coins - use spend_coins RPC
    const FOLLOW_COST = 100 // 100 troll_coins to follow
    try {
      if ((profile?.troll_coins_balance || 0) < FOLLOW_COST) {
        toast.error(`You need ${FOLLOW_COST} troll_coins to follow`)
        return
      }
      
      // Deduct coins using spend_coins RPC
      const { data: spendResult, error: spendError } = await supabase.rpc('spend_coins', {
        p_sender_id: user.id,
        p_receiver_id: viewed.id, // Coins go to the person being followed
        p_coin_amount: FOLLOW_COST,
        p_source: 'follow',
        p_item: `Follow @${viewed.username}`
      })
      
      if (spendError) {
        throw spendError
      }
      
      if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !spendResult.success) {
        const errorMsg = (spendResult as any).error || 'Failed to follow'
        toast.error(errorMsg)
        return
      }
      
      // Create follow relationship
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, following_id: viewed.id })
      
      if (followError) {
        throw followError
      }
      
      setIsFollowing(true)
      setFollowersCount(prev => prev + 1)
      toast.success(`Following @${viewed.username}!`)
      
      // Refresh profile balance
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      }
    } catch (error: any) {
      console.error('Follow error:', error)
      toast.error(error?.message || 'Failed to follow')
    }
  }

  const handleBlock = async () => {
    if (!user || !viewed || viewed.id === user.id) return
    
    // Prevent blocking admins, officers, and trollers
    const viewedUserRole = viewed?.role || (viewed?.is_admin ? 'admin' : null) || 
                          (viewed?.is_troll_officer ? 'troll_officer' : null) ||
                          (viewed?.is_troller ? 'troller' : null)
    const cannotBeBlocked = viewedUserRole === 'admin' || viewedUserRole === 'troll_officer' || viewedUserRole === 'troller'
    
    if (cannotBeBlocked) {
      toast.error(`Cannot block ${viewedUserRole === 'admin' ? 'admins' : viewedUserRole === 'troll_officer' ? 'troll officers' : 'trollers'}`)
      return
    }
    
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', viewed.id)
        setIsBlocked(false)
        toast.success('Unblocked')
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: viewed.id })
        setIsBlocked(true)
        toast.success('Blocked')
      }
    } catch (error) {
      console.error('Block error:', error)
      toast.error('Failed to update block status')
    }
  }

  const handleMessage = async () => {
    if (!viewed || !user || !profile) return

    // Check if user needs to pay to message (unless sender is admin, troll officer, or troller)
    const senderRole = profile.role
    const senderIsOfficer = profile.is_troll_officer || profile.is_officer
    const senderIsTroller = profile.is_troller
    const senderIsAdmin = senderRole === 'admin' || profile.is_admin

    const canMessageFree = senderIsAdmin || senderIsOfficer || senderIsTroller

    if (!canMessageFree && viewed.profile_view_price && viewed.profile_view_price > 0) {
      // User must pay profile view price to message
      const { data: paymentResult, error: paymentError } = await supabase.rpc('pay_for_profile_view', {
        p_viewer_id: user.id,
        p_profile_owner_id: viewed.id
      })

      if (paymentError || !paymentResult?.success) {
        const errorMsg = paymentResult?.error || paymentError?.message || 'Payment required to message this user'
        toast.error(errorMsg)
        return
      }
    }

    navigate(`/messages?user=${viewed.id}`)
  }

  const handleSelectEffect = (id: string) => {
    if (!user) return
    if (selectedEffectId === id) {
      setSelectedEffectId('')
      try { localStorage.setItem(`tc-selected-effect-${user.id}`, '') } catch {}
      toast.success('Entrance effect deselected')
    } else {
      setSelectedEffectId(id)
      try { localStorage.setItem(`tc-selected-effect-${user.id}`, id) } catch {}
      toast.success('Entrance effect selected')
    }
  }

  const handleSelectPerk = (id: string) => {
    if (!user) return
    setSelectedPerkId(id)
    try { localStorage.setItem(`tc-selected-perk-${user.id}`, id) } catch {}
    toast.success('Perk selected')
  }

  const handleSelectInsurance = (id: string) => {
    if (!user) return
    setSelectedInsuranceId(id)
    try { localStorage.setItem(`tc-selected-insurance-${user.id}`, id) } catch {}
    toast.success('Insurance selected')
  }

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      if (!file.type.startsWith('image/')) throw new Error('File must be an image')
      if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5MB)')
      const ext = file.name.split('.').pop()
      const name = `${user.id}-${Date.now()}.${ext}`
      const path = `avatars/${name}`
      // Try multiple bucket names
      let bucketName = 'troll-city-assets'
      let uploadErr = null
      let publicUrl = null
      
      // Try troll-city-assets first
      const uploadResult = await supabase.storage
        .from(bucketName)
        .upload(path, file, { cacheControl: '3600', upsert: false })
      uploadErr = uploadResult.error
      
      // If that fails, try avatars bucket
      if (uploadErr) {
        bucketName = 'avatars'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      // If that fails, try public bucket
      if (uploadErr) {
        bucketName = 'public'
        const retryResult = await supabase.storage
          .from(bucketName)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        uploadErr = retryResult.error
      }
      
      if (uploadErr) throw uploadErr
      
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path)
      publicUrl = urlData.publicUrl
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateErr) throw updateErr
      const { data: updated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (updated) useAuthStore.getState().setProfile(updated as any)
      toast.success('Avatar uploaded')
    } catch (err: any) {
      try {
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result as string
          await supabase
            .from('user_profiles')
            .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
            .eq('id', user!.id)
          const { data: updated } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user!.id)
            .single()
          if (updated) useAuthStore.getState().setProfile(updated as any)
          toast.success('Avatar uploaded')
        }
        reader.readAsDataURL(file)
      } catch {
        toast.error(err?.message || 'Failed to upload avatar')
      }
    }
  }

  const togglePrivateProfile = async () => {
    if (!profile || !user) return
    if (!privateEnabled) {
      const cost = 2000
      if ((profile.troll_coins_balance || 0) < cost) {
        toast.error('Requires 2,000 troll_coins')
        return
      }
      try {
        const { error: updErr } = await supabase
          .from('user_profiles')
          .update({ troll_coins_balance: profile.troll_coins_balance - cost, updated_at: new Date().toISOString() })
          .eq('id', profile.id)
        if (updErr) throw updErr
        await supabase
          .from('coin_transactions')
          .insert([{ user_id: profile.id, type: 'purchase', amount: -cost, description: 'Private profile activation', metadata: { feature: 'private_profile' } }])
        useAuthStore.getState().setProfile({ ...profile, troll_coins_balance: profile.troll_coins_balance - cost } as any)
        refreshProfileInBackground()
        setPrivateEnabled(true)
        try { localStorage.setItem(`tc-private-profile-${user.id}`, 'true') } catch {}
        toast.success('Private profile enabled')
      } catch {
        toast.error('Failed to enable private profile')
      }
    } else {
      setPrivateEnabled(false)
      try { localStorage.setItem(`tc-private-profile-${user.id}`, 'false') } catch {}
      toast.success('Private profile disabled')
    }
  }

  // Define this before sections array since it's used inside
  const isViewingOtherUser = viewed && user && viewed.id !== user.id
  const isAdminViewer = profile?.role === 'admin' || (profile as any)?.is_admin
  const isLeadOfficerViewer = profile?.role === 'lead_troll_officer' || profile?.is_lead_officer
  const isViewingOwnProfile = !viewed || viewed.id === profile?.id
  const emailToShow = isAdminViewer
    ? (viewed?.email || user?.email || '')
    : (isViewingOwnProfile ? (user?.email || '') : '')

  const displayProfile = isViewingOtherUser ? viewed : profile
  const displayUsername = displayProfile?.username || 'User'
  const displayXP = displayProfile?.xp || 0
  const displayRole = displayProfile?.role || (displayProfile?.is_admin ? 'admin' : undefined)
  const displayLevel = getLevelFromXP(displayXP, displayRole === 'admin')
  const displayTier = getTierFromXP(displayXP)
  const displayTotalEarned = displayProfile?.total_earned_coins || 0
  const displaytroll_coins = displayProfile?.troll_coins_balance || 0
  const displaytrollmonds = displayProfile?.free_coin_balance || 0
  const canModerateProfile = Boolean(isViewingOtherUser && (isAdminViewer || isLeadOfficerViewer))
  const targetIsBanned = Boolean(displayProfile?.is_banned)
  const targetIsDisabled = Boolean(displayProfile?.account_deleted_at)
  
  // Check if the viewed user is admin, officer, or troller (cannot be blocked)
  const viewedUserRole = viewed?.role || viewed?.is_admin ? 'admin' : 
                         viewed?.is_troll_officer || viewed?.role === 'troll_officer' ? 'troll_officer' :
                         viewed?.is_troller || viewed?.role === 'troller' ? 'troller' : null
  const cannotBeBlocked = viewedUserRole === 'admin' || viewedUserRole === 'troll_officer' || viewedUserRole === 'troller'

  async function handleAdminKick() {
    if (!profile?.id || !viewed?.id) return
    setAdminActionLoading('kick')
    try {
      const { data, error } = await supabase.rpc('kick_user', {
        p_target_user_id: viewed.id,
        p_kicker_user_id: profile.id,
        p_stream_id: null
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Kicked @${displayUsername}`)
      } else {
        toast.error(data?.error || 'Failed to kick user')
      }
      await loadStats(true)
    } catch (error: any) {
      console.error('Kick user error:', error)
      toast.error(error?.message || 'Failed to kick user')
    } finally {
      setAdminActionLoading(null)
    }
  }

  async function handleAdminBan() {
    if (!viewed?.id) return
    if (!confirm(`Ban @${displayUsername}?`)) return
    setAdminActionLoading('ban')
    try {
      const until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase.rpc('ban_user', { p_user_id: viewed.id, p_until: until })
      if (error) throw error
      toast.success(`Banned @${displayUsername}`)
      await loadStats(true)
    } catch (error: any) {
      console.error('Ban user error:', error)
      toast.error(error?.message || 'Failed to ban user')
    } finally {
      setAdminActionLoading(null)
    }
  }

  async function handleAdminUnban() {
    if (!viewed?.id) return
    setAdminActionLoading('unban')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_banned: false, banned_until: null })
        .eq('id', viewed.id)
      if (error) throw error
      toast.success(`Unbanned @${displayUsername}`)
      await loadStats(true)
    } catch (error: any) {
      console.error('Unban user error:', error)
      toast.error(error?.message || 'Failed to unban user')
    } finally {
      setAdminActionLoading(null)
    }
  }

  async function handleAdminDisable() {
    if (!viewed?.id) return
    if (!confirm(`Disable @${displayUsername}'s account?`)) return
    setAdminActionLoading('disable')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          account_deleted_at: new Date().toISOString(),
          account_deletion_cooldown_until: null
        })
        .eq('id', viewed.id)
      if (error) throw error
      toast.success(`Disabled @${displayUsername}`)
      await loadStats(true)
    } catch (error: any) {
      console.error('Disable user error:', error)
      toast.error(error?.message || 'Failed to disable user')
    } finally {
      setAdminActionLoading(null)
    }
  }

  async function handleAdminEnable() {
    if (!viewed?.id) return
    setAdminActionLoading('enable')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          account_deleted_at: null,
          account_deletion_cooldown_until: null
        })
        .eq('id', viewed.id)
      if (error) throw error
      toast.success(`Enabled @${displayUsername}`)
      await loadStats(true)
    } catch (error: any) {
      console.error('Enable user error:', error)
      toast.error(error?.message || 'Failed to enable user')
    } finally {
      setAdminActionLoading(null)
    }
  }

  async function handleAdminHardBan() {
    if (!profile?.id || !viewed?.id) return
    if (viewed.id === profile.id) {
      toast.error('You cannot hard ban your own account')
      return
    }
    if (!confirm(`Hard ban + wipe @${displayUsername}? This deletes the account and bans their IP.`)) {
      return
    }
    setAdminActionLoading('hard_ban')
    try {
      const { data, error } = await supabase.functions.invoke('admin-hard-ban', {
        body: {
          target_user_id: viewed.id,
          reason: `Hard ban from profile by ${profile.username || profile.id}`
        }
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Hard banned @${displayUsername}`)
        navigate('/')
      } else {
        const warning = Array.isArray(data?.warnings) ? data.warnings[0] : null
        toast.error(data?.error || warning || 'Hard ban failed')
      }
    } catch (error: any) {
      console.error('Hard ban error:', error)

      // Check if the error is due to function not being deployed
      if (error?.message?.includes('Failed to send a request') ||
          error?.message?.includes('function was not found') ||
          error?.message?.includes('404')) {
        toast.error('Hard ban function is not available. Please contact system administrator.')
      } else {
        toast.error(error?.message || 'Hard ban failed')
      }
    } finally {
      setAdminActionLoading(null)
    }
  }

  // Filter sections based on whether viewing own profile or another user's
  const allSections = [
    {
      id: 'referral_code',
      title: 'Referral Code',
      icon: <UserPlus className="w-5 h-5 text-green-500" />,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg">
            <div className="text-white font-semibold mb-2">Your Referral Code</div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={referralCode}
                readOnly
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralCode)
                  toast.success('Referral code copied!')
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="text-white font-semibold mb-2">Referral Link</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralLink)
                  toast.success('Referral link copied!')
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Copy Link
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Share this link with friends! When they sign up and earn 40,000 troll_coins within 21 days, you'll get 10,000 coins as a reward.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'profile_info',
      title: 'Profile Info',
      icon: <Camera className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          {!!emailToShow && (isViewingOwnProfile || isAdminViewer) && (
            <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C]">
              <div className="text-xs text-gray-500 mb-1">Email</div>
              <div className="text-sm text-gray-300">{emailToShow}</div>
            </div>
          )}
          <p className="text-gray-300">{bio}</p>
          
          {isViewingOtherUser && (
            <React.Fragment>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={handleFollow}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isFollowing
                      ? 'bg-gray-600 hover:bg-gray-700 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                
                <button
                  onClick={handleMessage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
                
                <button
                  onClick={() => setShowGiftModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Gift className="w-4 h-4" />
                  Send Gift
                </button>
                
                {!cannotBeBlocked && (
                  <button
                    onClick={handleBlock}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isBlocked
                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                )}
                
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Report User
                </button>
              </div>

              {canModerateProfile && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-[#0D0D0D] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-300 mb-3">
                    Admin Actions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleAdminKick}
                      disabled={adminActionLoading === 'kick'}
                      className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                      Kick
                    </button>
                    {targetIsBanned ? (
                      <button
                        onClick={handleAdminUnban}
                        disabled={adminActionLoading === 'unban'}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={handleAdminBan}
                        disabled={adminActionLoading === 'ban'}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        Ban
                      </button>
                    )}
                    {targetIsDisabled ? (
                      <button
                        onClick={handleAdminEnable}
                        disabled={adminActionLoading === 'enable'}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        onClick={handleAdminDisable}
                        disabled={adminActionLoading === 'disable'}
                        className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      onClick={handleAdminHardBan}
                      disabled={adminActionLoading === 'hard_ban'}
                      className="px-3 py-2 rounded-lg bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                      IP Ban + Wipe
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          )}
          
          {editingProfile ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Username {(profile?.role !== 'troll_officer' && profile?.role !== 'admin') && '(max 14 characters)'}
                </div>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  maxLength={(profile?.role === 'troll_officer' || profile?.role === 'admin') ? undefined : 14}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white placeholder-gray-500"
                  placeholder="Enter username..."
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Bio</div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white placeholder-gray-500 resize-none h-20"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 bg-[#2C2C2C] text-gray-300 rounded-lg hover:bg-[#3C3C3C] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            !isViewingOtherUser && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setEditingProfile(true)
                    setEditUsername(profile?.username || '')
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </button>
                {profile?.empire_role !== 'partner' && (
                  <button
                    onClick={() => navigate('/empire-partner/apply')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Apply for Empire Partner
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )
    },
    {
      id: 'stats',
      title: 'Stats',
      icon: <div className="w-5 h-5 flex items-center justify-center">📊</div>,
      badge: null,
      content: (
        <div className="space-y-6">
          {/* Basic Stats */}
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              General Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] rounded-lg p-4">
                <div className="text-gray-400 text-sm">Streams Created</div>
                <div className="text-white text-2xl font-bold">{streamsCreated}</div>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4">
                <div className="text-gray-400 text-sm">Followers</div>
                <div className="text-white text-2xl font-bold">{followersCount}</div>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4">
                <div className="text-gray-400 text-sm">Following</div>
                <div className="text-white text-2xl font-bold">{followingCount}</div>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4">
                <div className="text-gray-400 text-sm">Level</div>
                <div className="text-white text-2xl font-bold">
                  {displayLevel}
                </div>
              </div>
              <div
                className="bg-[#0D0D0D] rounded-lg p-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
                onClick={() => {
                  setGiftersModalType('received')
                  setShowGiftersModal(true)
                }}
                title="Click to see gifters"
              >
                <div className="text-gray-400 text-sm">Coins Received</div>
                <div className="text-white text-2xl font-bold">{coinsReceived.toLocaleString()}</div>
              </div>
              <div
                className="bg-[#0D0D0D] rounded-lg p-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
                onClick={() => {
                  setGiftersModalType('sent')
                  setShowGiftersModal(true)
                }}
                title="Click to see recipients"
              >
                <div className="text-gray-400 text-sm">Coins Sent</div>
                <div className="text-white text-2xl font-bold">{coinsSent.toLocaleString()}</div>
              </div>
              <div className="bg-[#0D0D0D] rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Earned</div>
                <div className="text-white text-2xl font-bold">{displayTotalEarned.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Battle Stats */}
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Sword className="w-4 h-4 text-orange-500" />
              Battle Stats
            </h3>
            {battlesLoading ? (
              <div className="text-center py-4 text-gray-400">Loading battle history...</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Total Battles</div>
                  <div className="text-white text-2xl font-bold">{battleStats.totalBattles}</div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Win Rate</div>
                  <div className="text-white text-2xl font-bold">{battleStats.winRate}%</div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-green-400" />
                    Wins
                  </div>
                  <div className="text-green-400 text-2xl font-bold">{battleStats.wins}</div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm flex items-center gap-1">
                    <Sword className="w-3 h-3 text-red-400" />
                    Losses
                  </div>
                  <div className="text-red-400 text-2xl font-bold">{battleStats.losses}</div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Coins from Battles</div>
                  <div className="text-yellow-400 text-2xl font-bold">{battleStats.totalCoinsReceived.toLocaleString()}</div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Ties</div>
                  <div className="text-gray-400 text-2xl font-bold">{battleStats.ties}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
    
    {
      id: 'battle_history',
      title: 'Battle History',
      icon: <Sword className="w-5 h-5 text-orange-500" />,
      badge: null,
      content: (
        <div className="space-y-4">
          {battlesLoading ? (
            <div className="text-center py-8 text-gray-400">Loading battle history...</div>
          ) : battles.length === 0 ? (
            <div className="text-center py-8 bg-[#0D0D0D] rounded-lg border border-gray-700">
              <Sword className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No battles yet. Start your first battle from a live stream!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {battles.map((battle: any) => {
                const totalCoins = battle.battle
                  ? (battle.battle.host_id === battle.user_id
                      ? (battle.battle.host_troll_coins || 0) + (battle.battle.host_trollmonds || 0)
                      : (battle.battle.challenger_troll_coins || 0) + (battle.battle.challenger_trollmonds || 0))
                  : 0
                const opponentTotalCoins = battle.battle
                  ? (battle.battle.host_id === battle.opponent_id
                      ? (battle.battle.host_troll_coins || 0) + (battle.battle.host_trollmonds || 0)
                      : (battle.battle.challenger_troll_coins || 0) + (battle.battle.challenger_trollmonds || 0))
                  : 0

                return (
                  <div
                    key={battle.id}
                    className={`p-4 rounded-lg border ${
                      battle.won
                        ? 'bg-green-500/5 border-green-500/30'
                        : 'bg-[#0D0D0D] border-[#2C2C2C]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {battle.won ? (
                          <Trophy className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <Sword className="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <div className="text-white font-medium">
                            vs <ClickableUsername username={battle.opponent?.username || 'Unknown'} />
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(battle.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Duration</div>
                        <div className="text-sm text-gray-300">
                          {Math.floor((battle.battle_duration_seconds || 120) / 60)}:
                          {String((battle.battle_duration_seconds || 120) % 60).padStart(2, '0')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Your Coins</div>
                        <div className="text-yellow-400 font-semibold">{totalCoins.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Opponent Coins</div>
                        <div className="text-gray-400 font-semibold">{opponentTotalCoins.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    },
    
    {
      id: 'store_purchases',
      title: 'Store Purchases',
      icon: <ShoppingCart className="w-5 h-5 text-purple-500" />,
      badge: null,
      content: (
        <div className="space-y-6">
          {!(isViewingOwnProfile && isAdminViewer) && (
            <div>
              <div className="text-sm font-semibold text-gray-300 mb-3">Entrance Effects</div>
              {effects.length === 0 ? (
                <div className="bg-[#0D0D0D] rounded-lg border border-[#2C2C2C] p-4 text-gray-400">
                  No entrance effects yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {effects.map((e: any) => (
                    <div key={e.id} className={`bg-[#0D0D0D] rounded-lg p-4 text-center border ${selectedEffectId===e.id?'border-purple-500':'border-[#2C2C2C]'}`}>
                      <div className="text-2xl mb-2">{e.icon || '??'}</div>
                      <div className="text-white font-medium mb-2">{e.name}</div>
                      <button onClick={() => handleSelectEffect(e.id)} className={`w-full py-2 rounded ${selectedEffectId===e.id?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300'}`}>
                        {selectedEffectId===e.id ? 'Deselect' : 'Use'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-gray-300 mb-3">Perks</div>
            {perks.length === 0 ? (
              <div className="bg-[#0D0D0D] rounded-lg border border-[#2C2C2C] p-4 text-gray-400">
                No perks purchased yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {perks.map((p: any) => {
                  const perk = Array.isArray(p.perks) ? p.perks[0] : p.perks
                  const expiresAt = p.expires_at ? new Date(p.expires_at) : null
                  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false
                  const isActive = p.is_active && !isExpired
                  return (
                    <div key={p.id} className={`bg-[#0D0D0D] rounded-lg p-4 text-center border ${selectedPerkId===p.id?'border-purple-500':'border-[#2C2C2C]'}`}>
                      <div className="text-white font-medium mb-1">{perk?.name || 'Perk'}</div>
                      <div className="text-xs text-gray-500 mb-2">{perk?.description || 'Perk purchase'}</div>
                      <div className="text-xs text-gray-500 mb-2">
                        {expiresAt ? `Expires ${expiresAt.toLocaleDateString()}` : 'No expiry'}
                      </div>
                      <button
                        onClick={() => handleSelectPerk(p.id)}
                        disabled={!isActive}
                        className={`w-full py-2 rounded ${selectedPerkId===p.id?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300'} ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {selectedPerkId===p.id ? 'Selected' : isActive ? 'Use' : 'Inactive'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-300 mb-3">Insurance</div>
            {insurances.length === 0 ? (
              <div className="bg-[#0D0D0D] rounded-lg border border-[#2C2C2C] p-4 text-gray-400">
                No insurance purchased yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insurances.map((i: any) => {
                  const plan = Array.isArray(i.insurance_options) ? i.insurance_options[0] : i.insurance_options
                  const expiresAt = i.expires_at ? new Date(i.expires_at) : null
                  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false
                  const isActive = i.is_active && !isExpired
                  return (
                    <div key={i.id} className={`bg-[#0D0D0D] rounded-lg p-4 text-center border ${selectedInsuranceId===i.id?'border-purple-500':'border-[#2C2C2C]'}`}>
                      <div className="text-white font-medium mb-1">{plan?.name || 'Insurance'}</div>
                      <div className="text-xs text-gray-500 mb-2">{plan?.description || i.protection_type || 'Protection plan'}</div>
                      <div className="text-xs text-gray-500 mb-2">
                        {expiresAt ? `Expires ${expiresAt.toLocaleDateString()}` : 'No expiry'}
                      </div>
                      <button
                        onClick={() => handleSelectInsurance(i.id)}
                        disabled={!isActive}
                        className={`w-full py-2 rounded ${selectedInsuranceId===i.id?'bg-purple-600 text-white':'bg-[#2C2C2C] text-gray-300'} ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {selectedInsuranceId===i.id ? 'Selected' : isActive ? 'Use' : 'Inactive'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <button onClick={() => navigate('/store')} className="px-4 py-2 rounded bg-purple-600 text-white">Browse Store</button>
          </div>
        </div>
      )
    },

    { id: 'account_settings',
      title: 'Account Settings',
      icon: <Settings className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          {/* Earnings and Transactions Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/earnings')}
              className="p-4 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg hover:bg-[#1A1A1A] transition-colors text-left"
            >
              <div className="text-white font-semibold mb-1">Earnings</div>
              <div className="text-gray-400 text-sm">View your earnings history</div>
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="p-4 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg hover:bg-[#1A1A1A] transition-colors text-left"
            >
              <div className="text-white font-semibold mb-1">Transactions</div>
              <div className="text-gray-400 text-sm">View your transaction history</div>
            </button>
          </div>

          {!!emailToShow && (isViewingOwnProfile || isAdminViewer) && (
            <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2C2C2C]">
              <div className="text-xs text-gray-500 mb-1">Account Email</div>
              <div className="text-sm text-gray-300">{emailToShow}</div>
            </div>
          )}
          <div className="p-4 bg-[#0D0D0D] rounded-lg border border-purple-600/30">
            <div className="text-white font-semibold mb-3">Profile View Price (coins)</div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={2000}
                value={viewPrice}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(2000, Number(e.target.value || 0)))
                  setViewPrice(val)
                }}
                placeholder="Enter price in coins"
                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-purple-600 focus:border-purple-400 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!profile?.id) {
                    toast.error('Profile not loaded')
                    return
                  }

                  const priceValue = Number(viewPrice)
                  if (isNaN(priceValue) || priceValue < 0) {
                    toast.error('Please enter a valid price (0-2000 coins)')
                    return
                  }

                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({
                        profile_view_price: Math.floor(priceValue),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', profile.id)
                    
                    if (error) {
                      console.error('Error updating profile view price:', error)
                      toast.error(error.message || 'Failed to save profile view price')
                      return
                    }
                    
                    // Update local profile state
                    useAuthStore.getState().setProfile({
                      ...(profile as any),
                      profile_view_price: Math.floor(priceValue)
                    } as any)
                    
                    toast.success(`Profile view price saved: ${Math.floor(priceValue)} coins`)
                  } catch (err: any) {
                    console.error('Error saving profile view price:', err)
                    toast.error(err?.message || 'Failed to save profile view price')
                  }
                }}
                disabled={isNaN(Number(viewPrice)) || Number(viewPrice) < 0}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Viewers must pay this amount in troll_coins to view your profile (max 2000 coins)
            </p>
          </div>
          <div className="mt-4 p-4 bg-[#0D0D0D] rounded-lg border border-purple-600/30">
            <div className="text-white font-semibold mb-3">Message Price (coins)</div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                min={0}
                max={2000}
                value={messagePrice}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(2000, Number(e.target.value || 0)))
                  setMessagePrice(val)
                }}
                placeholder="Enter price in coins"
                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-purple-600 focus:border-purple-400 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!profile?.id) {
                    toast.error('Profile not loaded')
                    return
                  }

                  const priceValue = Number(messagePrice)
                  if (isNaN(priceValue) || priceValue < 0) {
                    toast.error('Please enter a valid price (0-2000 coins)')
                    return
                  }

                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({
                        message_price: Math.floor(priceValue),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', profile.id)

                    if (error) {
                      console.error('Error updating message price:', error)
                      toast.error(error.message || 'Failed to save message price')
                      return
                    }

                    useAuthStore.getState().setProfile({
                      ...(profile as any),
                      message_price: Math.floor(priceValue)
                    } as any)

                    toast.success(`Message price saved: ${Math.floor(priceValue)} coins`)
                  } catch (err: any) {
                    console.error('Error saving message price:', err)
                    toast.error(err?.message || 'Failed to save message price')
                  }
                }}
                disabled={isNaN(Number(messagePrice)) || Number(messagePrice) < 0}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Require Troll coins before others can message you (max 2000 coins)
            </p>
          </div>
          <div className="mt-4 p-4 bg-[#0D0D0D] rounded-lg border border-purple-600/30">
            <div className="text-white font-semibold mb-3">PayPal Payout Email</div>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="Enter your PayPal email"
                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-purple-600 focus:border-purple-400 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!profile?.id) {
                    toast.error('Profile not loaded')
                    return
                  }

                  const emailValue = paypalEmail.trim()
                  if (!emailValue) {
                    toast.error('Please enter a PayPal email')
                    return
                  }

                  // Basic email validation
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                  if (!emailRegex.test(emailValue)) {
                    toast.error('Please enter a valid email address')
                    return
                  }

                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({
                        payout_paypal_email: emailValue,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', profile.id)

                    if (error) {
                      console.error('Error updating PayPal email:', error)
                      toast.error(error.message || 'Failed to save PayPal email')
                      return
                    }

                    // Update local profile state
                    useAuthStore.getState().setProfile({
                      ...(profile as any),
                      payout_paypal_email: emailValue
                    } as any)

                    toast.success('PayPal email saved successfully!')
                  } catch (err: any) {
                    console.error('Error saving PayPal email:', err)
                    toast.error(err?.message || 'Failed to save PayPal email')
                  }
                }}
                disabled={!paypalEmail.trim() || paypalEmail.trim() === (profile as any)?.payout_paypal_email}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              This email will be used for PayPal payouts when you request withdrawals
            </p>
          </div>
          <button
            onClick={async () => {
              // No confirmation - proceed directly
              const hasEnoughCoins = profile?.troll_coins_balance >= 500;
              const payEarly = hasEnoughCoins; // Auto-pay if user has enough coins
              
              try {
                const { data, error } = await supabase.rpc('delete_user_account', {
                  p_user_id: user?.id,
                  p_pay_early_fee: payEarly || false
                });
                
                if (error) throw error;
                
                if (data?.success) {
                  if (payEarly) {
                    toast.success('Account deleted. You can create a new account immediately.');
                  } else {
                    const cooldownDate = new Date(data.cooldown_until).toLocaleDateString();
                    toast.success(`Account deletion scheduled. You must wait until ${cooldownDate} before creating a new account, or pay $5 to skip.`);
                  }
                  
                  // Sign out and redirect to login
                  await supabase.auth.signOut();
                  useAuthStore.getState().logout();
                  localStorage.clear();
                  sessionStorage.clear();
                  navigate('/auth', { replace: true });
                } else {
                  toast.error(data?.error || 'Failed to delete account');
                }
              } catch (error: any) {
                console.error('Error deleting account:', error);
                toast.error(error?.message || 'Failed to delete account');
              }
            }}
            className="w-full py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
          >
            Delete Account
          </button>
        </div>
      )
    },
    {
      id: 'creator_dashboard',
      title: 'Creator Analytics',
      icon: <BarChart3 className="w-5 h-5 text-purple-500" />,
      badge: null,
      content: (
        <div className="space-y-6">
          {creatorLoading ? (
            <div className="text-center py-8 text-gray-400">Loading creator analytics...</div>
          ) : (
            <React.Fragment>
              {/* TOP METRICS */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Total Coins Earned</div>
                  <div className="text-white text-2xl font-bold">
                    {(creatorOverview?.total_coins_earned ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Payouts (USD)</div>
                  <div className="text-blue-400 text-2xl font-bold">
                    ${(creatorOverview?.total_payouts_usd ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Pending Payouts</div>
                  <div className="text-yellow-400 text-2xl font-bold">
                    ${(creatorOverview?.pending_payouts_usd ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* DAILY EARNINGS CHART */}
              <div className="bg-[#0D0D0D] rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-semibold">Earnings Analytics</h3>
                  <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          timeRange === range
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ width: "100%", height: 260, minHeight: 260 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dailySeries || []}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value, name) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          name === 'coins' ? 'Coins' : name === 'bonus_coins' ? 'Bonus Coins' : 'Payouts (USD)'
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="coins"
                        name="Coins"
                        stroke="#ff2e92"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="payouts_usd"
                        name="Payouts (USD)"
                        stroke="#ffd54f"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TOP GIFTERS + ANALYTICS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TOP GIFTERS */}
                <div className="bg-[#0D0D0D] rounded-lg p-6">
                  <h3 className="text-white font-semibold mb-4">Top Gifters</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {(topGifters || []).map((g, i) => (
                      <div key={g.sender_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm w-6">#{i + 1}</span>
                          {g.sender_avatar_url && (
                            <img
                              src={g.sender_avatar_url}
                              alt={g.sender_username}
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span className="text-white text-sm">{g.sender_username}</span>
                        </div>
                        <span className="text-yellow-400 text-sm font-semibold">
                          {g.total_coins.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {(!topGifters || topGifters.length === 0) && (
                      <div className="text-center py-4 text-gray-500">
                        No gifts yet. Start going live to build your leaderboard.
                      </div>
                    )}
                  </div>
                </div>

                
              </div>
            </React.Fragment>
          )}
        </div>
      )
    }
  ]

  // Filter sections: when viewing another user, only show stats and action buttons
  // Only show referral code for approved Empire Partners
  const filteredSections = isViewingOtherUser
    ? allSections.filter(s => s.id === 'stats' || s.id === 'profile_info')
    : allSections.filter(s => s.id !== 'referral_code' || (profile as any)?.empire_role === 'partner')

  const sections = filteredSections

  console.log('Profile component - profile:', profile, 'user:', user, 'routeUsername:', routeUsername)

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading profile...</div>
          <div className="text-sm text-gray-400">User: {user?.email || 'No user'}</div>
          <div className="text-xs text-gray-500 mt-2">If this persists, try refreshing the page</div>
        </div>
      </div>
    )
  }

  // Show loading state while checking access for viewed profile
  if (viewed && profile.id !== viewed.id && checkingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading profile...</div>
          <div className="text-sm text-gray-400">Checking access permissions...</div>
        </div>
      </div>
    )
  }

  return (
    <React.Fragment>
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          {viewed && profile.id !== viewed.id && !hasAccess && !checkingAccess && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="w-[360px] bg-[#121212] border border-purple-600 rounded-xl p-4">
                <div className="font-semibold mb-2">Unlock @{viewed.username}'s profile</div>
                <div className="text-xs text-gray-300 mb-3">Price: {viewedPrice()} troll_coins</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => navigate('/store')} className="px-3 py-1 rounded bg-gray-700 text-white text-xs">Get Coins</button>
                  <button onClick={unlockViewedProfile} className="px-3 py-1 rounded bg-purple-600 text-white text-xs">Unlock</button>
                </div>
              </div>
            </div>
          )}
          
          {viewed && profile.id !== viewed.id && checkingAccess && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="text-white">Loading...</div>
            </div>
          )}
          
          <div className="bg-[#1A1A1A] rounded-xl p-8 border border-[#2C2C2C] mb-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full overflow-hidden">
                  <img 
                    src={
                      displayProfile?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayUsername}`
                    } 
                    alt={`${displayUsername}'s avatar`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to dicebear if image fails to load
                      const target = e.target as HTMLImageElement
                      target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayUsername}`
                    }}
                  />
                </div>
                {(!viewed || viewed.id === profile.id) && (
                  <button 
                    onClick={triggerAvatarUpload} 
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-[#1A1A1A]"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                )}
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload} 
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">@{displayUsername}</h1>
                    <EmpireBadge empireRole={displayProfile?.empire_role} />
                  </div>
                  {/* Admin Badge */}
                  {(displayProfile?.role || displayProfile?.is_admin) === 'admin' && (
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      ADMIN
                    </span>
                  )}
                  {/* OG Badge - for early users (created before 2026-01-01) or Level 100 */}
                  {(displayProfile?.badge === 'og' || getLevelFromXP((displayProfile?.xp || 0), (displayProfile?.role || displayProfile?.is_admin) === 'admin') === 100) && (
                    <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      OG
                    </span>
                  )}
                </div>
                {/* Tier and Level Display */}
                <div className="mb-2">
                  <div className="text-purple-400 font-semibold text-sm">
                    Level {displayLevel} - {displayTier.title}
                  </div>
                  {/* XP Progress Bar */}
                  <XPProgressBar
                    key={displayXP}
                    currentXP={displayXP}
                    isAdmin={displayRole === 'admin'}
                    className="mt-2"
                  />
                </div>
                {!!emailToShow && (isViewingOwnProfile || isAdminViewer) && (
                  <p className="text-gray-400 mb-3">{emailToShow}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xl font-bold">{displaytroll_coins} Paid</span>
                  <span className="text-blue-400 text-xl font-bold">{displaytrollmonds} Free</span>
                </div>

                {/* Recruited by display */}
                {recruitedBy && (
                  <div className="mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Recruited by: <ClickableUsername username={recruitedBy.username} />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C]">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-[#2C2C2C] transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-3">
                    {section.icon}
                    <span className="text-white font-semibold">{section.title}</span>
                    {section.badge && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        section.id === 'recent_streams' ? 'bg-red-500 text-white' :
                        section.id === 'store_purchases' ? 'bg-purple-500 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {section.badge}
                      </span>
                    )}
                  </div>
                  {expandedSections.includes(section.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.includes(section.id) && (
                  <div className="px-6 pb-6 border-t border-[#2C2C2C]">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    
    {viewed && (
      <SendGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamerId={viewed.id}
        streamId={null as any}
      />
    )}
    
    {viewed && (
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetUserId={viewed.id}
        streamId={null}
        targetType="user"
        onSuccess={() => setShowReportModal(false)}
      />
    )}
    </React.Fragment>
  )
}




