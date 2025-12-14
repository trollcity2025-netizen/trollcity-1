import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  Heart,
  Users,
  Coins,
  Crown,
  Shield,
  Ban,
  Eye,
  MicOff,
  MessageSquare,
  Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid'
import { UserRole } from '../lib/supabase'

/* =========================
   TYPES
========================= */
interface StreamData {
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
}

interface UserProfile {
  id: string
  username: string
  level: number
  role: UserRole
  troll_family_id?: string
  paid_coin_balance?: number
  free_coin_balance?: number
  xp?: number
  is_admin?: boolean
  is_lead_officer?: boolean
}

/* =========================
   COMPONENT
========================= */
const LiveBroadcast: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>()
  const { user, profile } = useAuthStore()

  const [stream, setStream] = useState<StreamData | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [hasPaidEntry, setHasPaidEntry] = useState(false)
  const [showGiftDrawer, setShowGiftDrawer] = useState(false)

  const roomName = `stream-${streamId}`

  /* =========================
     LOAD STREAM + BROADCASTER
  ========================= */
  useEffect(() => {
    if (!streamId) return

    const loadStream = async () => {
      const { data: streamData } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (!streamData) return
      setStream(streamData)

      const { data: broadcasterData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', streamData.broadcaster_id)
        .single()

      setBroadcaster(broadcasterData as UserProfile)
    }

    loadStream()
  }, [streamId])

  /* =========================
     PAID ENTRY CHECK
  ========================= */
  useEffect(() => {
    if (!user || !profile || !stream) return

    if (stream.pricing_type === 'free') {
      setHasPaidEntry(true)
      return
    }

    const checkEntry = async () => {
      const { data } = await supabase
        .from('stream_entries')
        .select('has_paid_entry')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .single()

      if (data?.has_paid_entry) {
        setHasPaidEntry(true)
        return
      }

      const cost = stream.pricing_value
      const paid = profile.paid_coin_balance || 0
      const free = profile.free_coin_balance || 0

      if (paid + free < cost) {
        toast.error('Insufficient coins to enter stream')
        return
      }

      const newPaid = Math.max(0, paid - cost)
      const remaining = cost - paid
      const newFree = remaining > 0 ? Math.max(0, free - remaining) : free

      await supabase
        .from('user_profiles')
        .update({
          paid_coin_balance: newPaid,
          free_coin_balance: newFree,
        })
        .eq('id', profile.id)

      await supabase.from('stream_entries').upsert({
        stream_id: stream.id,
        user_id: user.id,
        has_paid_entry: true,
        entry_time: new Date().toISOString(),
      })

      setHasPaidEntry(true)
      toast.success(`Paid ${cost} coins to enter stream`)
    }

    checkEntry()
  }, [stream, user, profile])

  if (!stream || !hasPaidEntry || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p>Loading stream…</p>
        </div>
      </div>
    )
  }

  /* =========================
     ROLE RESOLUTION (TYPE SAFE)
  ========================= */
  const isBroadcaster =
    profile.role === UserRole.ADMIN ||
    profile.role === UserRole.MODERATOR ||
    profile.role === UserRole.TROLL_OFFICER

  const liveKitRole: string = isBroadcaster ? profile.role : 'viewer'

  const isAdmin =
    profile.role === UserRole.ADMIN ||
    profile.role === UserRole.TROLL_OFFICER ||
    profile.is_admin ||
    profile.is_lead_officer

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      {/* HUD */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 border-b border-purple-500/20 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="font-semibold">{broadcaster?.username}</div>
            <div className="text-xs text-gray-400">
              Level {broadcaster?.level}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-2 items-center">
              <Coins className="w-5 h-5 text-yellow-400" />
              {stream.total_gifts_coins}
            </div>
            <div className="flex gap-2 items-center">
              <Users className="w-5 h-5 text-green-400" />
              {stream.viewer_count}
            </div>
            <button
              onClick={() => setLikeCount((v) => v + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 rounded-lg"
            >
              <Heart className="w-5 h-5 text-red-400" />
              {likeCount}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-20 flex h-screen">
        {/* VIDEO */}
        <div className="flex-1 p-4">
          <div className="h-full rounded-xl overflow-hidden border border-purple-500/20">
            <LiveKitRoomWrapper
              roomName={roomName}
              identity={user?.id || `viewer-${crypto.randomUUID()}`}
              role={liveKitRole}
              autoConnect
              autoPublish={isBroadcaster}
              maxParticipants={6}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* CHAT */}
        <div className="w-80 bg-zinc-900/50 border-l border-purple-500/20 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Chat
          </div>
          <div className="flex-1 text-gray-400 text-sm">Chat messages…</div>
          <input
            placeholder="Type a message…"
            className="mt-4 bg-zinc-800 border border-purple-500/30 rounded px-3 py-2"
          />
        </div>
      </div>

      {/* ADMIN TOOLS */}
      {isAdmin && (
        <div className="fixed bottom-4 right-4 bg-zinc-900/90 p-4 rounded-lg space-y-2">
          <button className="flex gap-2 text-sm">
            <Ban className="w-4 h-4" /> Ban
          </button>
          <button className="flex gap-2 text-sm">
            <Eye className="w-4 h-4" /> Shadow Ban
          </button>
          <button className="flex gap-2 text-sm">
            <MicOff className="w-4 h-4" /> Mute
          </button>
          <button className="flex gap-2 text-sm">
            <Shield className="w-4 h-4" /> Disable Stream
          </button>
          <button className="flex gap-2 text-sm">
            <Crown className="w-4 h-4" /> Court Summon
          </button>
        </div>
      )}

      {/* GIFT BUTTON */}
      <button
        onClick={() => setShowGiftDrawer(true)}
        className="fixed bottom-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full w-14 h-14 flex items-center justify-center"
      >
        <Gift className="w-6 h-6" />
      </button>

      {showGiftDrawer && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 p-4 border-t border-purple-500/20">
          <div className="flex justify-between mb-4">
            <div className="flex gap-2 items-center">
              <Gift className="w-5 h-5 text-purple-400" />
              Send Gifts
            </div>
            <button onClick={() => setShowGiftDrawer(false)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveBroadcast
