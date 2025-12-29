// LiveBroadcast.tsx (drop-in replacement)
// Notes: fixes role logic, stable LiveKit identity, safer chat hydration, autoscroll,
// type cleanup, and an optional atomic entry-payment RPC with a safe fallback.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid'
import { useGiftSystem, GiftItem } from '../lib/hooks/useGiftSystem'
import { UserRole } from '../lib/supabase'
import type { LucideIcon } from 'lucide-react'
import {
  Heart,
  Users,
  Coins,
  Gift,
  Menu,
  MessageCircle,
  Mic,
  Video,
  Power,
  Settings,
} from 'lucide-react'
import { useLiveKit } from '../contexts/LiveKitContext'

type StreamData = {
  id: string
  title: string
  broadcaster_id: string
  pricing_type: string
  pricing_value: number
  gift_multiplier: string
  like_price: number | string
  family_xp_bonus: boolean
  family_coin_bonus: boolean
  notify_followers: boolean
  notify_family: boolean
  allow_officer_free_join: boolean
  moderator_mode: boolean
  allow_gifts: boolean
  max_guest_slots: number
  viewer_count: number
  total_gifts_coins: number
  status: string
  room_name?: string
  is_live?: boolean
}

type UserProfile = {
  id: string
  username: string
  level: number
  role: UserRole
  troll_family_id?: string
  troll_coins?: number
  xp?: number
  is_admin?: boolean
  is_lead_officer?: boolean
}

type StreamMessage = {
  id: string
  stream_id?: string
  user_id: string
  username?: string
  content: string
  message_type?: string
  created_at: string
  role?: string
  level?: number
  user_profiles?: {
    username?: string
    role?: string
    level?: number
  }
}

type ProfileCacheEntry = {
  username: string
  role?: string
  level: number
}

type ActionButtonProps = {
  icon: LucideIcon
  label: string
  onClick?: () => void
}

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-purple-500/40 bg-gradient-to-br bg-clip-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:border-purple-400 hover:shadow-[0_0_20px_rgba(180,100,255,0.35)]"
      style={{
        backgroundImage:
          'linear-gradient(130deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
      }}
    >
      <div className="rounded-full border border-white/10 bg-white/10 p-2 shadow-[0_0_25px_rgba(147,103,255,0.35)]">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[10px] tracking-[0.25em]">{label}</span>
    </button>
  )
}

const GIFT_OFFERS: GiftItem[] = [
  { id: 'heart', name: 'Heart Burst', coinCost: 100, type: 'paid' },
  { id: 'dragon', name: 'Dragon Fury', coinCost: 500, type: 'paid' },
  { id: 'crown', name: 'Royal Crown', coinCost: 1200, type: 'paid' },
]

const LOCAL_VIEWER_ID_KEY = 'trollcity_viewer_id_v1'

const LiveBroadcast: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>()
  const { user, profile } = useAuthStore()

  const [stream, setStream] = useState<StreamData | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)

  const [likeCount, setLikeCount] = useState(0)
  const [hasPaidEntry, setHasPaidEntry] = useState(false)

  const [showGiftDrawer, setShowGiftDrawer] = useState(false)
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatTable, setChatTable] = useState<'stream_messages' | 'messages'>('stream_messages')

  const [showGuestPanel, setShowGuestPanel] = useState(false)
  const [showMenuPanel, setShowMenuPanel] = useState(false)

  const [mediaRequestState, setMediaRequestState] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle')
  const [activeGiftId, setActiveGiftId] = useState<string | null>(null)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [liveSeconds, setLiveSeconds] = useState(0)

  const [chatDraft, setChatDraft] = useState('')
  const [maxGuestSlots, setMaxGuestSlots] = useState(3)

  const profileCacheRef = useRef<Map<string, ProfileCacheEntry>>(new Map())
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  const messageSelectFields = useMemo(
    () => `
      id,
      stream_id,
      user_id,
      content,
      created_at,
      message_type,
      user_profiles (
        username,
        role,
        level
      )
    `,
    []
  )

  const viewerIdentity = useMemo(() => {
    if (user?.id) return user.id
    if (typeof window === 'undefined') return `viewer-server`
    const existing = window.localStorage.getItem(LOCAL_VIEWER_ID_KEY)
    if (existing) return existing
    const created = `viewer-${crypto.randomUUID()}`
    window.localStorage.setItem(LOCAL_VIEWER_ID_KEY, created)
    return created
  }, [user?.id])

  const ensureProfileInfo = useCallback(async (userId: string) => {
    if (!userId) return { username: 'Anonymous', role: 'viewer', level: 1 }
    const cached = profileCacheRef.current.get(userId)
    if (cached) return cached

    const { data, error } = await supabase
      .from('user_profiles')
      .select('username, role, level')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // soft-fail
      const fallback = { username: 'Anonymous', role: 'viewer', level: 1 }
      profileCacheRef.current.set(userId, fallback)
      return fallback
    }

    const profileInfo: ProfileCacheEntry = {
      username: data?.username || 'Anonymous',
      role: (data?.role as string) || 'viewer',
      level: data?.level ?? 1,
    }
    profileCacheRef.current.set(userId, profileInfo)
    return profileInfo
  }, [])

  const normalizeMessage = useCallback(
    async (row: StreamMessage): Promise<StreamMessage> => {
      const embedded = row.user_profiles
      const cached = row.user_id ? profileCacheRef.current.get(row.user_id) : undefined

      const hasEmbedded =
        Boolean(embedded?.username) && typeof embedded?.level === 'number' && embedded?.role !== undefined

      let username = row.username || embedded?.username || cached?.username
      let role = row.role || embedded?.role || cached?.role
      let level = row.level ?? embedded?.level ?? cached?.level

      if (!username || role === undefined || typeof level !== 'number') {
        const hydrated = await ensureProfileInfo(row.user_id)
        username = username || hydrated.username
        role = role ?? hydrated.role
        level = typeof level === 'number' ? level : hydrated.level
      }

      // minimal required validation
      if (!row.id || !row.user_id || !row.created_at) {
        // if DB row is malformed, don't crash the whole UI
        return {
          id: row.id || crypto.randomUUID(),
          user_id: row.user_id || 'unknown',
          created_at: row.created_at || new Date().toISOString(),
          content: row.content || '',
          username: username || 'Anonymous',
          role: role || 'viewer',
          level: typeof level === 'number' ? level : 1,
        }
      }

      if (row.user_id) {
        profileCacheRef.current.set(row.user_id, {
          username: username || 'Anonymous',
          role: role || 'viewer',
          level: typeof level === 'number' ? level : 1,
        })
      }

      return {
        ...row,
        username: username || 'Anonymous',
        role: role || 'viewer',
        level: typeof level === 'number' ? level : 1,
      }
    },
    [ensureProfileInfo]
  )

  const {
    localParticipant,
    participants,
    startPublishing,
    toggleCamera,
    toggleMicrophone,
    isConnected,
    isConnecting,
    disconnect,
  } = useLiveKit()

  const { sendGift: sendGiftToStreamer, isSending: isGiftSending } = useGiftSystem(
    stream?.broadcaster_id || '',
    stream?.id || null
  )

  const roomName = useMemo(() => `stream-${streamId}`, [streamId])

  // Load stream + broadcaster
  useEffect(() => {
    if (!streamId) return

    const loadStream = async () => {
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (streamError || !streamData) return
      setStream(streamData)

      const { data: broadcasterData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', streamData.broadcaster_id)
        .single()

      setBroadcaster((broadcasterData as UserProfile) || null)
    }

    loadStream()
  }, [streamId])

  // Keep guest slots in sync (0..5)
  useEffect(() => {
    if (typeof stream?.max_guest_slots === 'number') {
      const normalized = Math.min(Math.max(stream.max_guest_slots, 0), 5)
      setMaxGuestSlots((prev) => (prev === normalized ? prev : normalized))
    }
  }, [stream?.max_guest_slots])

  const isBroadcaster = useMemo(() => {
    return Boolean(profile?.id && stream?.broadcaster_id && profile.id === stream.broadcaster_id)
  }, [profile?.id, stream?.broadcaster_id])

  const isStaff = useMemo(() => {
    return (
      profile?.role === UserRole.ADMIN ||
      profile?.role === UserRole.MODERATOR ||
      profile?.role === UserRole.TROLL_OFFICER
    )
  }, [profile?.role])

  const liveKitRole: string = isBroadcaster ? (profile?.role || 'broadcaster') : 'viewer'

  const hasLocalTracks = useMemo(() => {
    return Boolean(localParticipant?.videoTrack?.track) && Boolean(localParticipant?.audioTrack?.track)
  }, [localParticipant?.videoTrack?.track, localParticipant?.audioTrack?.track])

  const showGoLiveOverlay = isBroadcaster && isConnected && !hasLocalTracks

  // Optional atomic entry payment:
  // If you create a Supabase RPC named `pay_stream_entry` that handles coin deduction + stream_entries upsert
  // in a transaction, this will use it. Otherwise it falls back to the current client-side approach.
  const attemptAtomicEntryPayment = useCallback(
    async (streamIdValue: string, userIdValue: string, cost: number) => {
      try {
        const { data, error } = await supabase.rpc('pay_stream_entry', {
          p_stream_id: streamIdValue,
          p_user_id: userIdValue,
          p_cost: cost,
        })
        if (error) throw error
        // If your RPC returns anything, you can interpret it here. For now: success means no error.
        return { ok: true as const, data }
      } catch {
        return { ok: false as const }
      }
    },
    []
  )

  // Check entry (free or paid)
  useEffect(() => {
    if (!user || !profile || !stream) return

    if (stream.pricing_type === 'free') {
      setHasPaidEntry(true)
      return
    }

    const checkEntry = async () => {
      // If officers can free-join, allow that (only if you intended this flag)
      if (stream.allow_officer_free_join && isStaff) {
        setHasPaidEntry(true)
        return
      }

      const { data: entryRow } = await supabase
        .from('stream_entries')
        .select('has_paid_entry')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (entryRow?.has_paid_entry) {
        setHasPaidEntry(true)
        return
      }

      const cost = Number(stream.pricing_value || 0)
      const paid = Number(profile.troll_coins || 0)

      if (paid < cost) {
        toast.error(`Insufficient coins to enter stream. You need ${cost - paid} more.`)
        return
      }

      // Try atomic server-side payment first
      const atomic = await attemptAtomicEntryPayment(stream.id, user.id, cost)
      if (atomic.ok) {
        setHasPaidEntry(true)
        toast.success(`Paid ${cost} coins to enter stream`)
        return
      }

      // Fallback (non-atomic). Works, but RPC is strongly recommended.
      const newPaid = paid - cost

      const { error: coinErr } = await supabase
        .from('user_profiles')
        .update({ troll_coins: newPaid })
        .eq('id', profile.id)

      if (coinErr) {
        toast.error('Unable to process entry payment.')
        return
      }

      const { error: entryErr } = await supabase.from('stream_entries').upsert({
        stream_id: stream.id,
        user_id: user.id,
        has_paid_entry: true,
        entry_time: new Date().toISOString(),
      })

      if (entryErr) {
        toast.error('Payment processed, but entry failed. Contact support.')
        return
      }

      setHasPaidEntry(true)
      toast.success(`Paid ${cost} coins to enter stream`)
    }

    checkEntry()
  }, [stream, user, profile, attemptAtomicEntryPayment, isStaff])

  // Live timer
  useEffect(() => {
    if (!isConnected) {
      setLiveSeconds(0)
      return
    }

    const interval = setInterval(() => setLiveSeconds((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [isConnected])

  const effectiveMaxGuests = useMemo(() => Math.min(Math.max(maxGuestSlots, 0), 5), [maxGuestSlots])

  const guestParticipants = useMemo(
    () => Array.from(participants.values()).filter((p) => !p.isLocal),
    [participants]
  )

  const guestSlotEntries = useMemo(
    () =>
      Array.from({ length: effectiveMaxGuests }).map((_, index) => ({
        slotIndex: index,
        participant: guestParticipants[index] || null,
      })),
    [effectiveMaxGuests, guestParticipants]
  )

  const liveKitMaxParticipants = useMemo(
    () => Math.min(1 + effectiveMaxGuests, 6),
    [effectiveMaxGuests]
  )

  const quickReactions = useMemo(() => ['❤️', '🔥', '✨', '🎉'], [])

  const menuOptions = useMemo(
    () => [
      {
        label: 'Copy stream link',
        action: async () => {
          setShowMenuPanel(false)
          try {
            const url =
              stream?.id && typeof window !== 'undefined'
                ? `${window.location.origin}/live/${stream.id}`
                : ''
            if (!url) throw new Error('Unable to determine share link')
            await navigator.clipboard.writeText(url)
            toast.success('Stream link copied to clipboard')
          } catch (error) {
            console.error('Copy failed:', error)
            toast.error('Unable to copy stream link')
          }
        },
      },
      {
        label: 'Report an issue',
        action: () => {
          setShowMenuPanel(false)
          toast('Report submitted — team will review soon')
        },
      },
      {
        label: 'Support & FAQ',
        action: () => {
          setShowMenuPanel(false)
          toast('Support portal will be available shortly')
        },
      },
    ],
    [stream?.id]
  )

  const handleGoLive = useCallback(async () => {
    if (!startPublishing) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Your browser does not expose camera/microphone APIs.')
      return
    }

    setMediaRequestState('requesting')
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      await startPublishing()
      setMediaRequestState('granted')
    } catch (error: any) {
      console.error('Media permission failed:', error)
      setMediaRequestState('denied')
      setShowPermissionModal(true)
      toast.error('Camera and microphone access are required to go live.')
    }
  }, [startPublishing])

  const handleToggleMicrophone = useCallback(async () => {
    if (!toggleMicrophone) return
    try {
      await toggleMicrophone()
    } catch (error) {
      console.error('Toggle microphone failed:', error)
      toast.error('Unable to toggle microphone.')
    }
  }, [toggleMicrophone])

  const handleToggleCamera = useCallback(async () => {
    if (!toggleCamera) return
    try {
      await toggleCamera()
    } catch (error) {
      console.error('Toggle camera failed:', error)
      toast.error('Unable to toggle camera.')
    }
  }, [toggleCamera])

  const handleEndStream = useCallback(async () => {
    if (!isBroadcaster || !stream?.id) return
    try {
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false, status: 'ended' })
        .eq('id', stream.id)

      if (error) throw error

      setStream((prev) => (prev ? { ...prev, is_live: false, status: 'ended' } : prev))
      disconnect()
      toast.success('Stream ended successfully.')
    } catch (err) {
      console.error('Failed to end stream:', err)
      toast.error('Unable to end the broadcast right now.')
    }
  }, [disconnect, isBroadcaster, stream?.id])

  const adjustGuestSlots = useCallback(
    async (delta: number) => {
      if (!isBroadcaster || !stream?.id) return
      const current = Math.min(Math.max(maxGuestSlots, 0), 5)
      const target = Math.min(Math.max(current + delta, 0), 5)
      if (target === current) return

      try {
        const { error } = await supabase
          .from('streams')
          .update({ max_guest_slots: target })
          .eq('id', stream.id)

        if (error) throw error

        setMaxGuestSlots(target)
        setStream((prev) => (prev ? { ...prev, max_guest_slots: target } : prev))
        toast.success(target > 0 ? `Guest slots limited to ${target}` : 'Guest slots disabled')
      } catch (error) {
        console.error('Failed to update guest slots:', error)
        toast.error('Unable to adjust guest slots.')
      }
    },
    [isBroadcaster, stream?.id, maxGuestSlots]
  )

  const handleOpenGuestPanel = useCallback(() => setShowGuestPanel(true), [])
  const handleOpenGiftDrawer = useCallback(() => setShowGiftDrawer(true), [])
  const handleOpenMenuPanel = useCallback(() => setShowMenuPanel(true), [])

  const verticalActions = useMemo(
    () => [
      { id: 'gifts', icon: Gift, label: 'Gifts', onClick: handleOpenGiftDrawer },
      { id: 'guests', icon: Users, label: 'Guests', onClick: handleOpenGuestPanel },
      { id: 'menu', icon: Menu, label: 'Menu', onClick: handleOpenMenuPanel },
    ],
    [handleOpenGiftDrawer, handleOpenGuestPanel, handleOpenMenuPanel]
  )

  const loadMessages = useCallback(async () => {
    if (!stream?.id) return
    setIsChatLoading(true)

    try {
      const { data, error } = await supabase
        .from(chatTable)
        .select(messageSelectFields)
        .eq('stream_id', stream.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) {
        if (chatTable === 'stream_messages') {
          setChatTable('messages')
          return
        }
        throw error
      }

      const rows = (data || []) as StreamMessage[]
      const normalized = await Promise.all(rows.map((row) => normalizeMessage(row)))
      setMessages(normalized)
    } catch (error) {
      console.error('Unable to load chat messages', error)
    } finally {
      setIsChatLoading(false)
    }
  }, [stream?.id, chatTable, messageSelectFields, normalizeMessage])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Realtime chat subscribe
  useEffect(() => {
    if (!stream?.id) return
    let isSubscribed = true

    const channelName = `livechat-${stream.id}-${chatTable}`
    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: true } } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: chatTable,
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload) => {
          const incoming = payload.new as StreamMessage
          if (!incoming) return

          normalizeMessage(incoming)
            .then((msg) => {
              if (!isSubscribed || !msg?.id) return
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev
                return [...prev, msg].slice(-60)
              })
            })
            .catch((e) => console.error('Failed to normalize incoming message', e))
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [stream?.id, chatTable, normalizeMessage])

  // Chat autoscroll (keeps it feeling "live")
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMessage = useCallback(
    async (rawMessage: string, tableOverride?: 'stream_messages' | 'messages') => {
      if (!rawMessage.trim() || !user || !stream?.id) return
      const trimmed = rawMessage.trim()
      const table = tableOverride || chatTable

      try {
        const { data, error } = await supabase
          .from(table)
          .insert({
            stream_id: stream.id,
            user_id: user.id,
            content: trimmed,
            message_type: 'chat',
          })
          .select(messageSelectFields)
          .single()

        if (error) {
          if (table === 'stream_messages') {
            setChatTable('messages')
            return sendMessage(trimmed, 'messages')
          }
          throw error
        }

        setChatDraft('')
      } catch (err) {
        console.error('Failed to send chat message', err)
        toast.error('Failed to send chat message')
      }
    },
    [chatTable, stream?.id, user, messageSelectFields, normalizeMessage]
  )

  const handleQuickReaction = useCallback((emoji: string) => sendMessage(emoji), [sendMessage])

  const handleSendGift = useCallback(
    async (gift: GiftItem) => {
      if (!sendGiftToStreamer || !stream?.broadcaster_id) return
      setActiveGiftId(gift.id)
      try {
        await sendGiftToStreamer(gift)
      } finally {
        setActiveGiftId(null)
      }
    },
    [sendGiftToStreamer, stream?.broadcaster_id]
  )

  const handleRetryPermission = useCallback(() => {
    setShowPermissionModal(false)
    handleGoLive()
  }, [handleGoLive])

  if (!stream || !profile || (!hasPaidEntry && stream.pricing_type !== 'free')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#04000c] via-[#08031b] to-[#120321] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-2 border-purple-500/60 animate-pulse" />
          <p className="text-sm text-gray-300">Loading the Troll City experience…</p>
        </div>
      </div>
    )
  }

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? true
  const cameraEnabled = localParticipant?.isCameraEnabled ?? true

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05010c] via-[#080216] to-[#12011e] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-4 py-6">
        <header className="rounded-3xl border border-purple-500/40 bg-white/5 bg-clip-padding p-5 shadow-[0_30px_90px_rgba(120,69,255,0.35)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-purple-400/60 bg-gradient-to-br from-purple-500/50 to-pink-500/20 text-lg font-bold shadow-[0_0_25px_rgba(201,91,255,0.45)]">
                {broadcaster?.username?.charAt(0) || 'T'}
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-lg font-semibold">{broadcaster?.username}</div>
                <div className="text-xs uppercase tracking-[0.3em] text-gray-300">
                  Level {broadcaster?.level ?? 1}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-200">
              <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs uppercase tracking-wider text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.45)]">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                LIVE
              </div>

              <div className="flex flex-col text-right">
                <span className="text-xs text-gray-400">Timer</span>
                <span className="text-base font-semibold text-white">{formatTimer(liveSeconds)}</span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-xs text-gray-400">Viewers</span>
                <span className="text-base font-semibold text-white">{stream.viewer_count}</span>
              </div>

              <button
                onClick={() => setLikeCount((prev) => prev + 1)}
                className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-pink-300 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
              >
                <Heart className="h-4 w-4 text-pink-400" />
                {likeCount}
              </button>

              <div className="flex items-center gap-2 rounded-full border border-yellow-400/40 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-yellow-300">
                <Coins className="h-4 w-4" />
                {stream.total_gifts_coins?.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            {stream.title || 'Troll City broadcast'} — Modern neon vibes with glassified overlays.
          </div>
        </header>

        <main className="flex-1 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr,360px]">
            <section className="space-y-4">
              <div className="relative overflow-hidden rounded-[32px] border border-purple-500/30 bg-gradient-to-br from-[#090111]/80 to-[#150025]/80 p-5 shadow-[0_30px_90px_rgba(93,30,158,0.45)]">
                <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-black/80">
                  <LiveKitRoomWrapper
                    roomName={roomName}
                    identity={viewerIdentity}
                    role={liveKitRole}
                    autoPublish={isBroadcaster ? false : true}
                    maxParticipants={liveKitMaxParticipants}
                    className="h-[420px] w-full"
                  />
                </div>

                <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-4 lg:flex">
                  {verticalActions.map((action) => (
                    <ActionButton
                      key={action.id}
                      icon={action.icon}
                      label={action.label}
                      onClick={action.onClick}
                    />
                  ))}
                </div>

                {showGoLiveOverlay && (
                  <div className="absolute inset-0 rounded-3xl bg-black/75 p-6 text-center text-sm text-white backdrop-blur">
                    <p className="mb-2 text-xs uppercase tracking-[0.4em] text-purple-300">
                      Host Control
                    </p>
                    <p className="text-lg font-semibold text-white">Live camera + mic pending</p>
                    <p className="my-3 text-xs text-purple-200">
                      Allow camera and microphone, then publish tracks to open the Troll City stage.
                    </p>

                    {isConnecting && (
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-300">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                        Connecting to the broadcast…
                      </div>
                    )}

                    <button
                      onClick={handleGoLive}
                      disabled={!isConnected || mediaRequestState === 'requesting'}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-purple-400/70 bg-gradient-to-br from-purple-600 to-pink-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mediaRequestState === 'requesting' ? 'Requesting permissions…' : 'Go Live'}
                    </button>

                    <div className="mt-3 text-[11px] text-gray-400">
                      Permissions are required before the broadcast room renders for your audience.
                    </div>
                  </div>
                )}
              </div>

              {isBroadcaster && (
                <div className="flex flex-wrap items-center justify-center gap-4 rounded-3xl border border-purple-500/30 bg-black/50 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-gray-300 shadow-[0_20px_40px_rgba(58,40,129,0.3)]">
                  <span>Guest slots configured: {effectiveMaxGuests}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustGuestSlots(-1)}
                      disabled={effectiveMaxGuests <= 0}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => adjustGuestSlots(1)}
                      disabled={effectiveMaxGuests >= 5}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {guestSlotEntries.length > 0 ? (
                  guestSlotEntries.map((slot) => {
                    const participant = slot.participant
                    const displayName =
                      participant?.name || participant?.identity || `Guest ${slot.slotIndex + 1}`

                    return (
                      <div
                        key={`guest-slot-${slot.slotIndex}`}
                        className="flex flex-col gap-2 rounded-2xl border border-purple-500/30 bg-black/60 p-4 text-sm text-gray-200 shadow-[0_20px_45px_rgba(72,49,150,0.3)]"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-purple-300">
                          <span>Slot {slot.slotIndex + 1}</span>
                          <span>{participant ? 'Live' : 'Waiting'}</span>
                        </div>

                        {participant ? (
                          <>
                            <div className="text-base font-semibold text-white">{displayName}</div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-300">
                              <span>{participant.isCameraEnabled ? 'Camera On' : 'Camera Off'}</span>
                              <span>
                                {participant.isMicrophoneEnabled ? 'Mic On' : 'Mic Off'}
                              </span>
                            </div>
                            <div className="text-[10px] text-purple-300">ID: {participant.identity}</div>
                          </>
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center text-center text-xs text-gray-400">
                            <span className="text-lg font-semibold text-white">Seat available</span>
                            <span className="mt-1 text-[10px] uppercase tracking-[0.3em] text-purple-400">
                              Waiting for guest
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-full rounded-2xl border border-purple-500/40 bg-black/60 p-6 text-center text-xs uppercase tracking-[0.3em] text-gray-400">
                    Guest slots are currently closed. Add one to let trolls join the stream.
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="lg:hidden flex items-center justify-center gap-3">
                {verticalActions.map((action) => (
                  <ActionButton
                    key={`mobile-${action.id}`}
                    icon={action.icon}
                    label={action.label}
                    onClick={action.onClick}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0b0416]/80 p-4 shadow-[0_30px_90px_rgba(86,33,178,0.3)]">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400">
                  <span>Chat</span>
                  <span className="flex items-center gap-2 text-[11px] text-green-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    {stream.viewer_count} viewers
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-purple-500/20 bg-black/40 p-3">
                  <div
                    ref={chatScrollRef}
                    onScroll={() => {
                      const el = chatScrollRef.current
                      if (!el) return
                      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
                      shouldAutoScrollRef.current = distanceFromBottom < 140 // px threshold
                    }}
                    className="flex flex-1 flex-col gap-3 overflow-y-auto pr-2"
                  >
                    {isChatLoading ? (
                      <div className="text-center text-sm text-gray-400">Loading chat…</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-sm text-gray-400">No chat yet</div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} className="flex gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-500/60 bg-gradient-to-br from-purple-600 to-pink-500 text-xs font-bold uppercase tracking-wider text-white shadow-[0_10px_30px_rgba(111,66,193,0.45)]">
                            {(message.username || 'T').charAt(0)}
                          </div>
                          <div className="flex-1 rounded-2xl border border-purple-500/20 bg-white/5 p-3 text-xs text-gray-200">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-purple-300">
                              <span>{message.username || 'Anonymous'}</span>
                              <span>
                                {message.role || 'Viewer'}
                                {typeof message.level === 'number' ? ` · Lvl ${message.level}` : ''}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed text-sm text-white">{message.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <textarea
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        placeholder="Type a message…"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            sendMessage(chatDraft)
                          }
                        }}
                        className="flex-1 rounded-2xl border border-purple-500/40 bg-black/70 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={() => sendMessage(chatDraft)}
                        disabled={!chatDraft.trim()}
                        className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Send
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xl">
                      {quickReactions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleQuickReaction(emoji)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 transition hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                      <MessageCircle className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <section className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-purple-500/40 bg-gradient-to-br from-[#0b0416] to-[#150024] p-4 text-xs uppercase tracking-[0.3em] text-white shadow-[0_25px_80px_rgba(82,36,160,0.35)]">
            <button
              onClick={handleToggleMicrophone}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white shadow-[0_0_25px_rgba(239,68,68,0.35)] transition hover:border-pink-400"
            >
              <Mic className={`h-4 w-4 ${micEnabled ? 'text-emerald-300' : 'text-red-400'}`} />
              {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
            </button>

            <button
              onClick={handleToggleCamera}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-cyan-400"
            >
              <Video className={`h-4 w-4 ${cameraEnabled ? 'text-cyan-300' : 'text-red-400'}`} />
              {cameraEnabled ? 'Camera On' : 'Camera Off'}
            </button>

            <button
              onClick={handleOpenGuestPanel}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-purple-300"
            >
              <Users className="h-4 w-4" />
              Guests
            </button>

            <button
              onClick={handleEndStream}
              disabled={!isBroadcaster}
              className="flex items-center gap-2 rounded-full border border-red-500/80 bg-red-500/30 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:bg-red-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Power className="h-4 w-4" />
              End Live
            </button>

            <button
              onClick={handleOpenMenuPanel}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-yellow-400"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={handleOpenGiftDrawer}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-fuchsia-400"
            >
              <Gift className="h-4 w-4" />
              Gifts
            </button>
          </section>
        </main>
      </div>

      {showGiftDrawer && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 backdrop-blur">
          <div className="mx-auto max-w-lg rounded-3xl border border-purple-500/40 bg-[#090112]/90 p-4 shadow-[0_30px_90px_rgba(112,66,255,0.45)]">
            <div className="flex items-center justify-between text-sm text-gray-200">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-300" />
                Send Gifts
              </div>
              <button onClick={() => setShowGiftDrawer(false)} className="text-xs text-gray-400">
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {GIFT_OFFERS.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  disabled={isGiftSending || !stream?.broadcaster_id}
                  className="flex flex-col gap-1 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-600/10 to-black/40 px-4 py-4 text-center text-xs uppercase tracking-[0.2em] text-gray-200 transition hover:border-white/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="text-sm font-bold text-white">{gift.name}</div>
                  <div className="text-[10px] text-gray-400">{gift.coinCost.toLocaleString()} coins</div>
                  <span className="text-[10px] text-purple-300">
                    {isGiftSending && activeGiftId === gift.id ? 'Sending…' : 'Send Gift'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showGuestPanel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-4xl rounded-3xl border border-purple-500/60 bg-[#070114]/95 p-6 shadow-[0_30px_90px_rgba(94,63,255,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-purple-300">Guest queue</p>
                <h3 className="text-2xl font-bold text-white">Guests & invitations</h3>
              </div>
              <button onClick={() => setShowGuestPanel(false)} className="text-sm text-gray-200">
                Close
              </button>
            </div>

            {isBroadcaster && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-purple-500/40 bg-black/40 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-gray-200">
                <span>Guest slots allowed: {effectiveMaxGuests}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustGuestSlots(-1)}
                    disabled={effectiveMaxGuests <= 0}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reduce
                  </button>
                  <button
                    onClick={() => adjustGuestSlots(1)}
                    disabled={effectiveMaxGuests >= 5}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Increase
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {guestSlotEntries.length > 0 ? (
                guestSlotEntries.map((slot) => {
                  const participant = slot.participant
                  const displayName =
                    participant?.name || participant?.identity || `Guest ${slot.slotIndex + 1}`

                  return (
                    <div
                      key={`guest-panel-${slot.slotIndex}`}
                      className="rounded-2xl border border-purple-500/30 bg-[#0f081f] p-4 text-sm text-gray-200"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-purple-300">
                        <span>Slot {slot.slotIndex + 1}</span>
                        <span>{participant ? 'Active' : 'Waiting'}</span>
                      </div>

                      {participant ? (
                        <>
                          <p className="mt-2 text-lg font-semibold text-white">{displayName}</p>
                          <p className="text-[11px] text-gray-400">
                            Camera: {participant.isCameraEnabled ? 'On' : 'Off'} · Mic:{' '}
                            {participant.isMicrophoneEnabled ? 'On' : 'Off'}
                          </p>
                          <p className="text-[11px] text-purple-300">ID: {participant.identity}</p>
                        </>
                      ) : (
                        <div className="mt-4 text-xs text-gray-400">
                          Seat available — share the stream link to invite a guest.
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-purple-500/40 bg-[#0b0416]/80 p-6 text-center text-xs uppercase tracking-[0.3em] text-gray-400">
                  Guest slots are currently disabled. Enable some seats to let guests join.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMenuPanel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-md rounded-3xl border border-purple-500/60 bg-[#070114]/95 p-6 text-center shadow-[0_30px_90px_rgba(94,63,255,0.35)]">
            <p className="text-xs uppercase tracking-[0.4em] text-purple-300">Live menu</p>
            <h3 className="text-2xl font-semibold text-white">Stream options</h3>
            <div className="mt-6 space-y-3">
              {menuOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={option.action}
                  className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-purple-300"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-purple-500/60 bg-[#070114]/95 p-6 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-purple-300">Permissions required</p>
            <h2 className="mt-4 text-xl font-semibold">Camera & mic access blocked</h2>
            <p className="mt-2 text-sm text-gray-300">
              Troll City needs both camera and microphone access to publish the live broadcast.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-xs uppercase tracking-[0.3em]">
              <button
                onClick={handleRetryPermission}
                className="rounded-full border border-purple-400/70 bg-gradient-to-br from-purple-600 to-pink-500 px-4 py-3 font-semibold text-white shadow-[0_0_30px_rgba(214,127,255,0.45)]"
              >
                Retry
              </button>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="rounded-full border border-white/20 px-4 py-3 text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveBroadcast
