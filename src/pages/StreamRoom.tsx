import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Radio,
  Users,
  Eye,
  Gift,
  Send,
  Heart,
  Star,
  Crown,
  MessageSquare,
  Skull,
  ShieldOff
} from 'lucide-react'
import { supabase, Stream, UserProfile } from '../lib/supabase'
import api, { API_ENDPOINTS } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { recordAppEvent } from '../lib/progressionEngine'
import ClickableUsername from '../components/ClickableUsername'
import TrollEvent from '../components/TrollEvent'

interface Message {
  id: string
  user_id: string
  content: string
  message_type: 'chat' | 'gift' | 'entrance'
  gift_amount: number | null
  created_at: string
  user_profiles?: UserProfile
}

interface GiftItem {
  id: string
  name: string
  coin_cost: number
  image_url: string
  animation_type: string
  type?: 'paid' | 'free'
}

interface EntranceEffectMeta {
  id: string
  name: string
  icon: string
  animation_type: string
  image_url: string
  coin_cost: number
}

// Same IDs/names as your EntranceEffects store (no free effects here)
const ENTRANCE_EFFECTS: EntranceEffectMeta[] = [
  {
    id: 'e2',
    name: 'Royal Sparkle Crown',
    icon: '👑',
    animation_type: 'sparkle_crown',
    coin_cost: 5000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20sparkle%20crown%20neon%20gold&image_size=square'
  },
  {
    id: 'e3',
    name: 'Neon Meteor Shower',
    icon: '☄️',
    animation_type: 'meteor_shower',
    coin_cost: 10000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20meteor%20shower%20cosmic&image_size=square'
  },
  {
    id: 'e4',
    name: 'Lightning Strike Arrival',
    icon: '⚡',
    animation_type: 'lightning_arrival',
    coin_cost: 7500,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lightning%20strike%20arrival%20neon&image_size=square'
  },
  {
    id: 'e5',
    name: 'Chaos Portal Arrival',
    icon: '🌀',
    animation_type: 'chaos_portal',
    coin_cost: 15000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=chaos%20portal%20arrival%20neon%20warp&image_size=square'
  },
  {
    id: 'e6',
    name: 'Galactic Warp Beam',
    icon: '🛸',
    animation_type: 'warp_beam',
    coin_cost: 25000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=galactic%20warp%20beam%20neon&image_size=square'
  },
  {
    id: 'e7',
    name: 'Troll City VIP Flames',
    icon: '🔥',
    animation_type: 'vip_flames',
    coin_cost: 35000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=vip%20flames%20neon%20crown&image_size=square'
  },
  {
    id: 'e8',
    name: 'Flaming Gold Crown Drop',
    icon: '👑',
    animation_type: 'gold_crown_drop',
    coin_cost: 50000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=flaming%20gold%20crown%20drop&image_size=square'
  },
  {
    id: 'e9',
    name: 'Aurora Storm Entrance',
    icon: '🌌',
    animation_type: 'aurora_storm',
    coin_cost: 75000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=aurora%20storm%20entrance&image_size=square'
  },
  {
    id: 'e10',
    name: 'Black Hole Vortex',
    icon: '🕳️',
    animation_type: 'black_hole',
    coin_cost: 100000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=black%20hole%20vortex%20neon&image_size=square'
  },
  {
    id: 'e11',
    name: 'Money Shower Madness',
    icon: '💸',
    animation_type: 'money_shower',
    coin_cost: 125000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=money%20shower%20madness%20neon&image_size=square'
  },
  {
    id: 'e12',
    name: 'Floating Royal Throne',
    icon: '👑',
    animation_type: 'royal_throne',
    coin_cost: 150000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20royal%20throne%20neon&image_size=square'
  },
  {
    id: 'e13',
    name: 'Platinum Fire Tornado',
    icon: '🔥',
    animation_type: 'fire_tornado',
    coin_cost: 200000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=platinum%20fire%20tornado%20neon&image_size=square'
  },
  {
    id: 'e14',
    name: 'Cosmic Crown Meteor Fall',
    icon: '☄️',
    animation_type: 'crown_meteor',
    coin_cost: 250000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cosmic%20crown%20meteor%20fall&image_size=square'
  },
  {
    id: 'e15',
    name: 'Royal Diamond Explosion',
    icon: '💎',
    animation_type: 'diamond_explosion',
    coin_cost: 300000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20diamond%20explosion%20neon&image_size=square'
  },
  {
    id: 'e16',
    name: 'Neon Chaos Warp',
    icon: '🌀',
    animation_type: 'chaos_warp',
    coin_cost: 400000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20chaos%20warp&image_size=square'
  },
  {
    id: 'e17',
    name: 'Supreme Emerald Storm',
    icon: '💚',
    animation_type: 'emerald_storm',
    coin_cost: 500000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=supreme%20emerald%20storm%20neon&image_size=square'
  },
  {
    id: 'e18',
    name: 'Millionaire Troller Arrival',
    icon: '🤑',
    animation_type: 'millionaire_arrival',
    coin_cost: 1000000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=millionaire%20troller%20arrival%20neon&image_size=square'
  },
  {
    id: 'e19',
    name: 'Troll God Ascension',
    icon: '🧌',
    animation_type: 'god_ascension',
    coin_cost: 2500000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=troll%20god%20ascension%20neon&image_size=square'
  },
  {
    id: 'e20',
    name: 'Troll City World Domination',
    icon: '🌍',
    animation_type: 'world_domination',
    coin_cost: 5000000,
    image_url:
      'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=world%20domination%20neon&image_size=square'
  }
]

const TROLL_OFFICER_PENALTY = 200

const StreamRoom = () => {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showGiftPanel, setShowGiftPanel] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [isEndingStream, setIsEndingStream] = useState(false)
  const [streamStartLogged, setStreamStartLogged] = useState(false)
  const lastChatRef = useRef<number>(Date.now())

  const [userOwnedEntranceEffects, setUserOwnedEntranceEffects] =
    useState<EntranceEffectMeta[]>([])
  const [broadcasterActivePerks, setBroadcasterActivePerks] = useState<any[]>([])
  const [broadcasterActiveInsurance, setBroadcasterActiveInsurance] = useState<any | null>(null)
  const [broadcasterActiveEffect, setBroadcasterActiveEffect] = useState<any | null>(null)
  const [activeEntrance, setActiveEntrance] = useState<{
    username: string
    effectName: string
    image_url: string
    icon: string
  } | null>(null)

  // 🔔 LIVE BANNER for big Troll Wheel wins
  const [liveBanner, setLiveBanner] = useState<{
    username: string
    prize_name: string
    prize_value: number
  } | null>(null)
  const [falling, setFalling] = useState<number[]>(Array.from({ length: 10 }, (_, i) => i))
  const [boxOneUserId, setBoxOneUserId] = useState<string | null>(null)
  const [boxOneTimer, setBoxOneTimer] = useState<number | null>(null)
  const [autoEndTimer, setAutoEndTimer] = useState<NodeJS.Timeout | null>(null)
  const [isBroadcasterAway, setIsBroadcasterAway] = useState(false)
  const [giftAnimation, setGiftAnimation] = useState<{ giftName: string; animationType: string; icon: string } | null>(null)

  const isGhostActiveNow = () => {
    try {
      const until = Number(localStorage.getItem(`tc-ghost-mode-${profile?.id}`) || '0')
      return until > Date.now()
    } catch {
      return false
    }
  }
  const isDisappearActiveNow = () => {
    try {
      const until = Number(localStorage.getItem(`tc-disappear-chat-${profile?.id}`) || '0')
      return until > Date.now()
    } catch {
      return false
    }
  }

  // Auto-end stream when broadcaster is away for 5+ minutes
  useEffect(() => {
    if (!stream || !profile || profile.id !== stream.broadcaster_id) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBroadcasterAway(true)
        // Start 5-minute timer
        const timer = setTimeout(async () => {
          try {
            await endStreamAsBroadcaster()
            toast.info('Stream auto-ended due to inactivity')
          } catch (error) {
            console.error('Failed to auto-end stream:', error)
          }
        }, 5 * 60 * 1000) // 5 minutes
        setAutoEndTimer(timer)
      } else {
        setIsBroadcasterAway(false)
        if (autoEndTimer) {
          clearTimeout(autoEndTimer)
          setAutoEndTimer(null)
        }
      }
    }

    const handleBeforeUnload = () => {
      // Immediately end stream when tab is closed
      endStreamAsBroadcaster()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (autoEndTimer) {
        clearTimeout(autoEndTimer)
      }
    }
  }, [stream, profile, autoEndTimer])

  const KICK_FEE = 500

  const canMuteOrKick = () => {
    const role = (profile as any)?.role
    return !!stream && !!profile && (role === 'admin' || role === 'troll_officer' || (profile?.id === stream?.broadcaster_id))
  }

  const kickUserPaid = async (targetUserId: string) => {
    if (!profile || !stream) return
    const currentPaid = Number(profile.paid_coin_balance || 0)
    if (currentPaid < KICK_FEE && profile.id !== stream.broadcaster_id) {
      toast.error('500 paid coins required to kick')
      navigate('/store')
      return
    }
    try {
      const newBal = currentPaid - KICK_FEE
      await supabase.from('user_profiles').update({ paid_coin_balance: newBal }).eq('id', profile.id)
      useAuthStore.getState().setProfile({ ...(profile as any), paid_coin_balance: newBal } as any)

      await supabase.from('admin_flags').insert({ user_id: targetUserId, reason: 'kick_paid', created_at: new Date().toISOString() })
      try {
        await supabase.from('stream_reports').insert({ stream_id: stream.id, reporter_id: profile.id, reported_user_id: targetUserId, type: 'kick', created_at: new Date().toISOString() })
      } catch {}

      if ((profile as any).role === 'troll_officer') {
        const reward = Math.floor(KICK_FEE * 0.25)
        await supabase.from('user_profiles').update({ paid_coin_balance: (profile.paid_coin_balance || 0) + reward }).eq('id', profile.id)
        useAuthStore.getState().setProfile({ ...(profile as any), paid_coin_balance: (profile.paid_coin_balance || 0) + reward } as any)
      }

      toast.success('User kicked')
    } catch {
      toast.error('Kick failed')
    }
  }

  const tryBanUserFromApp = async (targetUserId: string) => {
    if (!profile || !stream) return
    if (profile.id !== stream.broadcaster_id) { toast.error('Only broadcaster can ban'); return }
    try {
      const { data } = await supabase.from('admin_flags').select('id').eq('user_id', targetUserId).eq('reason', 'kick_paid')
      if (!data || data.length < 3) {
        toast.error('User must be kicked 3 times (paid) before ban')
        return
      }
      await supabase.rpc('reset_user_coins', { p_user_id: targetUserId })
      await supabase.rpc('ban_user', { p_user_id: targetUserId, p_until: new Date(Date.now() + 30*24*3600_000).toISOString() })
      toast.success('User banned from app')
    } catch { toast.error('Ban failed') }
  }

  const muteUser = async (targetUserId: string) => {
    if (!canMuteOrKick()) { toast.error('No permission'); return }
    toast.success('User muted')
  }
  
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const multiStreamRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const remoteTracks = useRef<{ [key: string]: any }>({})
  const client = useRef<any>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<BlobPart[]>([])

  const isTrollOfficer =
    !!profile &&
    (
      (profile as any).role === 'troll_officer' ||
      (profile as any).is_troll_officer === true
    )

  const triggerEntranceOverlay = (username: string, effect: EntranceEffectMeta) => {
    setActiveEntrance({
      username,
      effectName: effect.name,
      image_url: effect.image_url,
      icon: effect.icon
    })
    // auto hide after 4s
    setTimeout(() => {
      setActiveEntrance(null)
    }, 4000)
  }

  const getBestEntranceEffect = (owned: EntranceEffectMeta[]) => {
    if (!owned.length) return null
    return owned.reduce((best, cur) =>
      cur.coin_cost > best.coin_cost ? cur : best
    )
  }

  const loadUserOwnedEntranceEffects = async (): Promise<EntranceEffectMeta[]> => {
    if (!profile) return []
    try {
      const { data, error } = await supabase
        .from('user_entrance_effects')
        .select('effect_id')
        .eq('user_id', profile.id)

      if (error) throw error
      const ownedIds = (data || []).map((row: any) => row.effect_id)
      const owned = ENTRANCE_EFFECTS.filter(e => ownedIds.includes(e.id))
      setUserOwnedEntranceEffects(owned)
      return owned
    } catch (err) {
      console.error('Error loading user entrance effects:', err)
      return []
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadUserOwnedEntranceEffects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const loadBroadcasterActiveItems = async (broadcasterId: string) => {
    if (!broadcasterId) return

    const now = new Date().toISOString()

    try {
      // Load active perks
      const { data: perks } = await supabase
        .from('user_perks')
        .select('*, perks(*)')
        .eq('user_id', broadcasterId)
        .eq('is_active', true)
        .gte('expires_at', now)
        .limit(5)

      setBroadcasterActivePerks(perks || [])

      // Load active insurance
      const { data: insurance } = await supabase
        .from('user_insurances')
        .select('*, insurance_options(*)')
        .eq('user_id', broadcasterId)
        .eq('is_active', true)
        .gte('expires_at', now)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setBroadcasterActiveInsurance(insurance)

      // Load active entrance effect
      const { data: effect } = await supabase
        .from('user_entrance_effects')
        .select('*, entrance_effects(*)')
        .eq('user_id', broadcasterId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      setBroadcasterActiveEffect(effect)
    } catch (err) {
      console.error('Error loading broadcaster active items:', err)
    }
  }

  useEffect(() => {
    if (streamId) {
      loadStreamData()
      loadGifts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  useEffect(() => {
    if (stream && user) {
      joinStream()
    }
    
    // Cleanup on unmount
    return () => {
      // Stop all remote tracks
      Object.values(remoteTracks.current).forEach((track: any) => {
        try {
          track?.stop()
        } catch (e) {
          console.error('Error stopping track:', e)
        }
      })
      remoteTracks.current = {}
      
      // Disconnect from LiveKit room
      if (client.current) {
        try {
          client.current.disconnect()
          client.current = null
        } catch (e) {
          console.error('Error disconnecting from room:', e)
        }
      }
      
      // Decrement viewer count
      if (stream?.id) {
        void supabase
          .from('troll_streams')
          .update({ current_viewers: Math.max(0, (stream.current_viewers || 1) - 1) })
          .eq('id', stream.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, user])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 🛰️ SUBSCRIBE to big win banner events (per stream)
  useEffect(() => {
    if (!streamId) return

    const bannerChannel = supabase
      .channel(`live-banner-events-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_banner_events',
          filter: `stream_id=eq.${streamId}`
        },
        (payload: any) => {
          const { username, prize_name, prize_value } = payload.new
          setLiveBanner({ username, prize_name, prize_value })
          // hide after 6 seconds
          setTimeout(() => setLiveBanner(null), 6000)
        }
      )
      .subscribe()

    return () => {
      bannerChannel.unsubscribe()
    }
  }, [streamId])

  const loadStreamData = async () => {
    try {
      setLoading(true)
      
      // Load stream (no FK join dependency)
      const { data: streamData, error: streamError } = await supabase
        .from('troll_streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (streamError) throw streamError
  if (!streamData) {
        toast.error('Stream not found')
        navigate('/')
        return
  }

  setStream(streamData)
  // Load broadcaster profile separately
  if (streamData?.broadcaster_id) {
    const { data: bc } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', streamData.broadcaster_id)
      .single()
    if (bc) setBroadcaster(bc as any)
  }
  
  // Load broadcaster's active perks, insurance, and entrance effects
  if (streamData?.broadcaster_id) {
    loadBroadcasterActiveItems(streamData.broadcaster_id)
  }
  
  if (!streamStartLogged && profile?.id && streamData?.status === 'live') {
    // Identity event hook — First Stream
    try { await recordAppEvent(profile.id, 'STREAM_START', { stream_id: streamId }) } catch {}
    setStreamStartLogged(true)
  }

      // Load existing messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          user_profiles!user_id (*)
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (messagesError) throw messagesError
      setMessages(messagesData || [])

      // Subscribe to new messages
      const messageSubscription = supabase
        .channel(`stream-messages-${streamId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `stream_id=eq.${streamId}`
          },
          (payload: any) => {
            const newMsg = payload.new as Message
            setMessages(prev => [...prev, newMsg])

            // When an entrance message comes in, parse effect and show overlay
            if (newMsg.message_type === 'entrance' && newMsg.content) {
              const text = newMsg.content
              const effectMatch = text.match(/entered with (.+)!$/)
              const userMatch = text.match(/^(.+?) entered with/)
              const effectName = effectMatch?.[1]?.trim()
              const username = userMatch?.[1]?.trim() || 'Someone'
              if (effectName) {
                const effect = ENTRANCE_EFFECTS.find(e => e.name === effectName)
                if (effect) {
                  triggerEntranceOverlay(username, effect)
                }
              }
            }
          }
        )
        .subscribe()

      // Subscribe to stream updates
      const streamSubscription = supabase
        .channel(`stream-${streamId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'troll_streams',
            filter: `id=eq.${streamId}`
          },
          (payload: any) => {
            setStream(payload.new)
            const ended = (payload.new as any)?.is_live === false
            if (ended) {
              toast.error('Stream has ended.')
              navigate('/stream-ended')
            }
            // Promote active speaker to box one briefly
            try {
              const lastChat = messages[messages.length - 1]
              if (lastChat && lastChat.message_type === 'chat') {
                if (boxOneTimer) { clearTimeout(boxOneTimer as any) }
                if (lastChat.user_id !== (payload.new as any)?.broadcaster_id) {
                  setBoxOneUserId(lastChat.user_id)
                  const t = window.setTimeout(() => { setBoxOneUserId((payload.new as any)?.broadcaster_id || null) }, 6000)
                  setBoxOneTimer(t as any)
                }
              }
            } catch {}
          }
        )
        .subscribe()

      // Stream report subscription (for recording)
      const reportsSubscription = supabase
        .channel(`stream-reports-${streamId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_reports',
            filter: `stream_id=eq.${streamId}`
          },
          () => {
            startReportRecording()
          }
        )
        .subscribe()

      return () => {
        messageSubscription.unsubscribe()
        streamSubscription.unsubscribe()
        reportsSubscription.unsubscribe()
      }
    } catch (error) {
      console.error('Error loading stream:', error)
      toast.error('Failed to load stream')
    } finally {
      setLoading(false)
    }
  }

  const loadGifts = async () => {
    try {
      const { data, error } = await supabase
        .from('troll_gift_items')
        .select('*')
        .eq('is_active', true)
        .order('coin_cost', { ascending: true })

      if (error) throw error
      setGifts(data || [])
    } catch (error) {
      console.error('Error loading gifts:', error)
    }
  }

  const enforceRejoinPenalty = async (): Promise<boolean> => {
    if (!stream || !user) return true
    if (user.id === stream.broadcaster_id) return true
    try {
      const { data } = await supabase
        .from('stream_reports')
        .select('id, type')
        .eq('stream_id', stream.id)
        .eq('reported_user_id', user.id)
      const count = (data || []).filter((r: any) => r.type === 'kick' || r.type === 'report').length
      if (count >= 3) {
        toast.error('You have been kicked/reported 3 times. You cannot join this stream.')
        navigate('/')
        return false
      }
      const isTroller = (profile as any)?.role === 'troll_officer' || (profile as any)?.is_troll_officer === true
      if (count >= 1 && isTroller) {
        const freeBal = Number(profile?.free_coin_balance || 0)
        if (freeBal < 50) {
          toast.error('50 FREE coins required to rejoin this stream')
          return false
        }
        const newFree = freeBal - 50
        await supabase.from('user_profiles').update({ free_coin_balance: newFree }).eq('id', profile?.id)
        if (profile?.id) {
          useAuthStore.getState().setProfile({ ...(profile as any), free_coin_balance: newFree } as any)
        }
        try {
          const { data: bc } = await supabase
            .from('user_profiles')
            .select('id, free_coin_balance')
            .eq('id', stream.broadcaster_id)
            .single()
          const bcNew = Number((bc as any)?.free_coin_balance || 0) + 50
          await supabase.from('user_profiles').update({ free_coin_balance: bcNew }).eq('id', stream.broadcaster_id)
        } catch {}
        toast.success('Rejoin fee paid to broadcaster')
      }
    } catch {
      // allow join if reports table not available
    }
    return true
  }

  const joinStream = async () => {
    if (!stream || !user) return
    const ok = await enforceRejoinPenalty()
    if (!ok) return

    try {
      setJoining(true)

      // Increment viewer count
      await supabase
        .from('troll_streams')
        .update({ current_viewers: (stream.current_viewers || 0) + 1 })
        .eq('id', streamId)

      // Create entrance message if not broadcaster
      if (user.id !== stream.broadcaster_id) {
        // ensure we know which effects user owns
        const owned =
          userOwnedEntranceEffects.length > 0
            ? userOwnedEntranceEffects
            : await loadUserOwnedEntranceEffects()

        const isAdmin = profile?.role === 'admin'
        const adminEffect = {
          id: 'admin_global',
          name: 'Global Admin Arrival',
          icon: '👑',
          animation_type: 'admin_global',
          image_url: '',
          coin_cost: 0
        } as EntranceEffectMeta
        const bestEffect = isAdmin ? adminEffect : getBestEntranceEffect(owned)

        const entranceText = bestEffect
          ? `${profile?.username} entered with ${bestEffect.name}!`
          : `${profile?.username} joined the stream!`

        if (!isGhostActiveNow()) {
          await supabase.from('messages').insert([
            {
              stream_id: streamId,
              user_id: user.id,
              content: entranceText,
              message_type: 'entrance',
              gift_amount: null
            }
          ])
        }

        // Local overlay for this viewer
        if (bestEffect && !isGhostActiveNow()) {
          triggerEntranceOverlay(profile?.username || 'Someone', bestEffect)
        }
      }

      // Initialize LiveKit viewer
      await initializeLiveKitViewer()
      // Identity event hook — Silent viewer detection (2 minutes without chat)
      const startedAt = Date.now()
      setTimeout(async () => {
        const now = Date.now()
        const inactiveFor = now - lastChatRef.current
        if (inactiveFor >= 120000 && user && streamId) {
          try { await recordAppEvent(user.id, 'SILENT_WATCHER', { stream_id: streamId, since_ms: now - startedAt }) } catch {}
        }
      }, 120000)
    } catch (error) {
      console.error('Error joining stream:', error)
      toast.error('Failed to join stream')
    } finally {
      setJoining(false)
    }
  }

  const [showSummary, setShowSummary] = useState(false)
  const [battle, setBattle] = useState<{ opponent?: any; startAt?: number; endsAt?: number; myCoins: number; oppCoins: number } | null>(null)
  const [trollDrop, setTrollDrop] = useState<{ id: string; coins: number; endsAt: number } | null>(null)

  const initializeLiveKitViewer = async () => {
    if (!stream?.livekit_room) return

    try {
      const LIVEKIT_URL = (import.meta as any).env.VITE_LIVEKIT_URL
      if (!LIVEKIT_URL) {
        toast.error('LiveKit URL not configured')
        return
      }

      const EDGE_FUNCTION_URL = (import.meta as any).env.VITE_EDGE_FUNCTIONS_URL
      const { data: sessionData } = await supabase.auth.getSession()
      const jwt = sessionData?.session?.access_token

      if (!jwt) throw new Error('No auth token')

      const response = await fetch(`${EDGE_FUNCTION_URL}/livekit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`
        },
        body: JSON.stringify({
          identity: user?.id,
          roomName: stream.livekit_room
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Function error: ${errorText}`)
      }

      const { token } = await response.json()

      const { Room, RoomEvent } = await import('livekit-client')

      // Create LiveKit room
      client.current = new Room()

      // Handle participant tracks BEFORE connecting so we don't miss events
      client.current.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === 'video') {
          const videoElement = track.attach()
          if (remoteVideoRef.current && !stream?.multi_beam) {
            // Clear previous video(s) so we only show the active one
            remoteVideoRef.current.innerHTML = ''
            remoteVideoRef.current.appendChild(videoElement)
          }
        } else if (track.kind === 'audio') {
          track.attach()
        }
      })

      client.current.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach()
      })

      // Connect to room AFTER handlers are registered
      await client.current.connect(LIVEKIT_URL, token)
      console.log('Connected to LiveKit room')
    } catch (error: any) {
      console.error('LiveKit viewer initialization error:', error)
      toast.error('Failed to connect to stream')
    }
  }

  useEffect(() => {
    const loadDrop = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('id, type, content, metadata, created_at')
          .eq('type', 'troll_drop')
          .order('created_at', { ascending: false })
          .limit(1)
        const row = (data || [])[0]
        const ends = Number(new Date(row?.metadata?.ends_at || row?.created_at).getTime())
        if (row && ends > Date.now()) {
          setTrollDrop({ id: row.id, coins: Number(row.metadata?.coins || 0), endsAt: ends })
        } else {
          setTrollDrop(null)
        }
      } catch { setTrollDrop(null) }
    }
    loadDrop()
    const id = setInterval(loadDrop, 10000)
    return () => clearInterval(id)
  }, [])

  const startRandomBattle = async () => {
    try {
      const { data } = await supabase
        .from('troll_streams')
        .select('id, title, broadcaster_id, current_viewers, total_gifts_coins')
        .eq('is_live', true)
        .neq('id', stream.id)
        .limit(20)
      const pool = (data || [])
      if (!pool.length) return toast.error('No opponents available')
      const opponent = pool[Math.floor(Math.random() * pool.length)]
      const now = Date.now()
      const myBase = Number(stream.total_gifts_coins || 0)
      const oppBase = Number(opponent.total_gifts_coins || 0)
      setBattle({ opponent, startAt: now, endsAt: now + 120000, myCoins: myBase, oppCoins: oppBase })
      toast.success('Battle started — 2 minutes!')
      setTimeout(() => {
        void finalizeBattle()
      }, 120000)
    } catch {
      toast.error('Failed to start battle')
    }
  }

  const finalizeBattle = async () => {
    try {
      const b = battle
      if (!b) return
      const { data: latestOpp } = await supabase
        .from('troll_streams')
        .select('id, total_gifts_coins')
        .eq('id', b.opponent.id)
        .maybeSingle()
      const myEnd = Number(stream.total_gifts_coins || 0)
      const oppEnd = Number(latestOpp?.total_gifts_coins || b.oppCoins)
      const myDelta = myEnd - b.myCoins
      const oppDelta = oppEnd - b.oppCoins
      const win = myDelta >= oppDelta
      toast.success(win ? 'You win the battle!' : 'Opponent wins the battle')
      setBattle(null)
    } catch {
      setBattle(null)
    }
  }

  const startReportRecording = () => {
    try {
      const container = remoteVideoRef.current
      if (!container) return
      const video = container.querySelector('video') as HTMLVideoElement | null
      if (!video || typeof (video as any).captureStream !== 'function') return
      const streamObj = (video as any).captureStream()
      const mimeCandidates = [
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm'
      ]
      const mime =
        mimeCandidates.find(
          (t) =>
            (window as any).MediaRecorder &&
            (MediaRecorder as any).isTypeSupported &&
            (MediaRecorder as any).isTypeSupported(t)
        ) || 'video/webm'
      const rec = new MediaRecorder(streamObj, { mimeType: mime as any })
      recordChunksRef.current = []
      rec.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const isMp4 = String(mime).includes('mp4')
        const blob = new Blob(recordChunksRef.current, {
          type: isMp4 ? 'video/mp4' : 'video/webm'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reported-stream-${streamId}-${Date.now()}.${
          isMp4 ? 'mp4' : 'webm'
        }`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
      recorderRef.current = rec
      rec.start()
      setTimeout(() => {
        try {
          recorderRef.current?.stop()
        } catch {}
      }, 60000)
    } catch {}
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !streamId) return

    try {
      await supabase.from('messages').insert([
        {
          stream_id: streamId,
          user_id: user.id,
          content: newMessage,
          message_type: 'chat',
          gift_amount: null
        }
      ])
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    }
  }

  // Quick BOO / Troll button (styled differently in chat)
  const sendTrollBoo = async () => {
    if (!user || !streamId) return
    try {
      await supabase.from('messages').insert([
        {
          stream_id: streamId,
          user_id: user.id,
          content: `${profile?.username} BOO'd the stream!`,
          message_type: 'chat',
          gift_amount: null
        }
      ])
    } catch (error) {
      console.error('Error sending troll boo:', error)
    }
  }

  const sendGift = async (gift: GiftItem) => {
    if (!user || !streamId || !stream) return

    const isAdmin = profile?.role === 'admin'
    const totalCoins =
      (profile?.paid_coin_balance || 0) + (profile?.free_coin_balance || 0)
    if (!isAdmin && totalCoins < gift.coin_cost) {
      toast.error('Insufficient coins')
      return
    }

    try {
      // Deduct coins (prefer paid coins first) - skip for admin
      let paidCoinsToUse = 0
      let freeCoinsToUse = 0
      if (!isAdmin) {
        paidCoinsToUse = Math.min(
          gift.coin_cost,
          profile?.paid_coin_balance || 0
        )
        freeCoinsToUse = gift.coin_cost - paidCoinsToUse

        if (paidCoinsToUse > 0) {
          await supabase
            .from('user_profiles')
            .update({ paid_coin_balance: profile!.paid_coin_balance - paidCoinsToUse })
            .eq('id', user.id)
        }

        if (freeCoinsToUse > 0) {
          await supabase
            .from('user_profiles')
            .update({
              free_coin_balance: profile!.free_coin_balance - freeCoinsToUse
            })
            .eq('id', user.id)
        }
      }

      // Add coins to broadcaster wallet
      const broadcasterPaid = (broadcaster?.paid_coin_balance || 0) + gift.coin_cost
      const broadcasterEarned =
        (broadcaster?.total_earned_coins || 0) + gift.coin_cost

      const { data: updatedBroadcasterRows } = await supabase
        .from('user_profiles')
        .update({
          paid_coin_balance: broadcasterPaid,
          total_earned_coins: broadcasterEarned
        })
        .eq('id', stream.broadcaster_id)
        .select('*')

      if (updatedBroadcasterRows && updatedBroadcasterRows[0]) {
        setBroadcaster(updatedBroadcasterRows[0] as UserProfile)
      }

      // Trigger gift animation
      setGiftAnimation({
        giftName: gift.name,
        animationType: gift.animation_type || 'bounce',
        icon: '🎁'
      })
      // Hide animation after 3 seconds
      setTimeout(() => setGiftAnimation(null), 3000)

      // Create gift chat message
      await supabase.from('messages').insert([
        {
          stream_id: streamId,
          user_id: user.id,
          content: `${profile?.username} sent ${gift.name}!`,
          message_type: 'gift',
          gift_amount: gift.coin_cost
        }
      ])

      // Update stream stats
      await supabase
        .from('troll_streams')
        .update({
          total_gifts_coins: (stream.total_gifts_coins || 0) + gift.coin_cost,
          total_unique_gifters: (stream.total_unique_gifters || 0) + 1
        })
        .eq('id', streamId)

      // Record per-user coin transactions (sender + receiver)
      // Record per-user coin transactions (sender + receiver) with expanded fields
      await supabase.from('coin_transactions').insert([
        {
          user_id: user.id,
          type: 'gift_send',
          amount: -gift.coin_cost,
          coin_type: gift.type === 'paid' ? 'paid' : 'free',
          source: 'gift',
          description: `Sent ${gift.name} to ${broadcaster?.username}`,
          metadata: {
            gift_id: gift.id,
            gift_name: gift.name,
            stream_id: streamId
          },
          platform_profit: 0,
          liability: gift.type === 'free' ? gift.coin_cost : 0,
          created_at: new Date().toISOString()
        },
        {
          user_id: stream.broadcaster_id,
          type: 'gift_receive',
          amount: gift.coin_cost,
          coin_type: gift.type === 'paid' ? 'paid' : 'free',
          source: 'gift',
          description: `Received ${gift.name} from ${profile?.username}`,
          metadata: {
            gift_id: gift.id,
            gift_name: gift.name,
            stream_id: streamId
          },
          platform_profit: 0,
          liability: gift.type === 'free' ? gift.coin_cost : 0,
          created_at: new Date().toISOString()
        }
      ])

      // Sav / Vived promo bonus
      const lowerName = gift.name.toLowerCase()
      const isSavGift = lowerName.includes('sav')
      const isVivedGift = lowerName.includes('vived')

      if ((isSavGift || isVivedGift) && broadcaster) {
        const bonusField = isSavGift ? 'sav_bonus_coins' : 'vived_bonus_coins'
        const bonusCap = isSavGift ? 25000 : 5000
        const bonusPerGift = 5

        const currentBonus = (broadcaster as any)[bonusField] || 0

        if (currentBonus < bonusCap) {
          const remaining = bonusCap - currentBonus
          const bonusToAdd = Math.min(bonusPerGift, remaining)

          const bonusUpdate: any = {
            paid_coin_balance: broadcasterPaid + bonusToAdd,
            total_earned_coins: broadcasterEarned + bonusToAdd
          }
          bonusUpdate[bonusField] = currentBonus + bonusToAdd

          const { data: bonusRows } = await supabase
            .from('user_profiles')
            .update(bonusUpdate)
            .eq('id', stream.broadcaster_id)
            .select('*')

          if (bonusRows && bonusRows[0]) {
            setBroadcaster(bonusRows[0] as UserProfile)
          }

          toast.success(
            `${isSavGift ? 'Sav' : 'Vived'} promo bonus +${bonusToAdd} coins!`
          )
        }
      }

      // Notification for broadcaster
      try {
        await supabase.from('notifications').insert([
          {
            user_id: stream.broadcaster_id,
            type: 'gift',
            content: `${profile?.username} sent ${gift.name} (${gift.coin_cost} coins)`,
            created_at: new Date().toISOString()
          }
        ])
      } catch {}

      toast.success(`Sent ${gift.name}!`)
      setShowGiftPanel(false)
    } catch (error) {
      console.error('Error sending gift:', error)
      toast.error('Failed to send gift')
    }
  }

  const toggleFollow = async () => {
    if (!user || !stream) return
    try {
      const { data: bProfile } = await supabase
        .from('user_profiles')
        .select('id, profile_view_price, username')
        .eq('id', stream.broadcaster_id)
        .maybeSingle()
      const price = Number(bProfile?.profile_view_price || localStorage.getItem(`tc-profile-view-price-${bProfile?.id}`) || 0)
      if (price > 0) {
        const access = localStorage.getItem(`tc-view-access-${user.id}-${bProfile?.id}`)
        if (!access) {
          toast.error(`Unlock @${bProfile?.username} profile to follow`)
          return
        }
      }
    } catch {}
    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', stream.broadcaster_id)
        toast.success('Unfollowed')
        setIsFollowing(false)
      } else {
        await supabase.from('user_follows').insert([
          {
            follower_id: user.id,
            following_id: stream.broadcaster_id,
            created_at: new Date().toISOString()
          }
        ])
        setIsFollowing(true)
        toast.success('Followed')
        try {
          await supabase.from('notifications').insert([
            {
              user_id: stream.broadcaster_id,
              type: 'follow',
              content: `${profile?.username} followed you`,
              created_at: new Date().toISOString()
            }
          ])
        } catch {}
      }
    } catch {
      toast.error('Failed to update follow')
    }
  }

  // Broadcaster: end their own stream
  const endStreamAsBroadcaster = async () => {
    if (!stream || !profile || profile.id !== stream.broadcaster_id) return

    try {
      setIsEndingStream(true)

      // Mark stream as ended
      await supabase
        .from('troll_streams')
        .update({
          is_live: false,
          status: 'ended',
          end_time: new Date().toISOString()
        })
        .eq('id', stream.id)

      toast.success('Stream ended')
      navigate('/stream-ended')
    } catch (error) {
      console.error('Error ending stream:', error)
      toast.error('Failed to end stream')
    } finally {
      setIsEndingStream(false)
    }
  }

  // Troll Officer: hard end stream, deduct 200 coins from broadcaster, redirect everyone
  const endStreamAsTrollOfficer = async () => {
    if (!stream || !broadcaster || !isTrollOfficer) return

    const confirmEnd = window.confirm(
      `End this stream for everyone?\nThis will apply a ${TROLL_OFFICER_PENALTY} coin penalty to the broadcaster.`
    )
    if (!confirmEnd) return

    try {
      setIsEndingStream(true)

      // Reload broadcaster balances to be safe
      const { data: freshBroadcaster, error: freshErr } = await supabase
        .from('user_profiles')
        .select('id, paid_coin_balance, free_coin_balance, username')
        .eq('id', stream.broadcaster_id)
        .single()
      if (freshErr || !freshBroadcaster) throw freshErr

      let remainingPenalty = TROLL_OFFICER_PENALTY
      let paid = freshBroadcaster.paid_coin_balance || 0
      let free = freshBroadcaster.free_coin_balance || 0

      const paidDeduct = Math.min(remainingPenalty, paid)
      paid -= paidDeduct
      remainingPenalty -= paidDeduct

      const freeDeduct = Math.min(remainingPenalty, free)
      free -= freeDeduct
      remainingPenalty -= freeDeduct

      // Update balances (we allow partial deduction if user is broke)
      await supabase
        .from('user_profiles')
        .update({
          paid_coin_balance: paid,
          free_coin_balance: free
        })
        .eq('id', freshBroadcaster.id)

      // Log penalty transaction
      await supabase.from('coin_transactions').insert([
        {
          user_id: freshBroadcaster.id,
          type: 'penalty',
          amount: -(TROLL_OFFICER_PENALTY - remainingPenalty), // whatever actually got deducted
          description: `Troll Officer ended stream penalty`,
          metadata: {
            stream_id: stream.id,
            ended_by: profile?.id,
            ended_by_username: profile?.username
          }
        }
      ])

      // Mark stream as ended so all listeners redirect
      await supabase
        .from('troll_streams')
        .update({
          status: 'ended',
          end_time: new Date().toISOString()
        } as any)
        .eq('id', stream.id)

      toast.success('Stream ended by Troll Officer')
      navigate('/')
    } catch (error) {
      console.error('Error ending stream as Troll Officer:', error)
      toast.error('Failed to end stream')
    } finally {
      setIsEndingStream(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-troll-dark flex items-center justify-center">
        <div className="text-troll-gold text-xl animate-pulse">
          Loading Troll City stream...
        </div>
      </div>
    )
  }

  if (!stream || !broadcaster) {
    return (
      <div className="min-h-screen bg-troll-dark flex items-center justify-center">
        <div className="text-troll-purple text-xl">Stream not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05010B] via-[#090018] to-[#180019] text-white relative overflow-hidden">
      {/* Neon animated background layer (can be refined in CSS) */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="w-full h-full bg-[radial-gradient(circle_at_top,_#7c3aed_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#22c55e_0,_transparent_55%)] animate-pulse" />
      </div>

      {/* 🔔 BIG WIN SCROLLING BANNER */}
      {liveBanner && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] sm:w-[70%] z-40">
          <div className="bg-gradient-to-r from-yellow-400 via-purple-600 to-green-400 text-white text-sm sm:text-base px-4 py-2 sm:py-3 rounded-full shadow-[0_0_25px_rgba(234,179,8,0.9)] border border-yellow-300 overflow-hidden">
            <div className="whitespace-nowrap animate-marquee font-bold flex items-center gap-2">
              <span>🎉</span>
              <span>
                <ClickableUsername username={liveBanner.username} className="text-white font-bold" /> just won {liveBanner.prize_name} (
                {liveBanner.prize_value.toLocaleString()} coins) on Troll Wheel!
              </span>
              <span>🎉</span>
            </div>
          </div>
        </div>
      )}

      {/* Entrance effect overlay */}
      {activeEntrance && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
          <div className="bg-black/70 px-6 py-4 rounded-2xl border border-troll-gold shadow-[0_0_40px_rgba(234,179,8,0.9)] flex items-center space-x-4 animate-pulse">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-troll-gold/60 bg-black/40 flex items-center justify-center">
              <img
                src={activeEntrance.image_url}
                alt={activeEntrance.effectName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div>
              <div className="text-xs text-troll-gold/80 mb-1">
                ENTRANCE EFFECT ACTIVATED
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{activeEntrance.icon}</span>
                <span className="font-bold text-lg">
                  <ClickableUsername username={activeEntrance.username} className="text-white font-bold" /> entered with {activeEntrance.effectName}!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gift animation overlay */}
      {giftAnimation && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
          <div className="bg-black/70 px-8 py-6 rounded-2xl border border-troll-gold shadow-[0_0_40px_rgba(234,179,8,0.9)] flex flex-col items-center space-y-4 animate-mega">
            <div className="text-6xl animate-floatGift">
              {giftAnimation.icon}
            </div>
            <div className="text-center">
              <div className="text-sm text-troll-gold/80 mb-2">
                GIFT RECEIVED!
              </div>
              <div className="text-2xl font-bold text-white">
                {giftAnimation.giftName}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative container mx-auto px-4 py-4">
        {showSummary && (
          <div className="bg-black/70 rounded-2xl border border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.6)] p-6 mb-4">
            <div className="text-2xl font-bold text-yellow-300 mb-2">Stream Summary</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-yellow-500/60">
                <div className="text-gray-300 text-xs">Total Viewers</div>
                <div className="text-white text-2xl font-bold">{Number(stream?.current_viewers || 0)}</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-yellow-500/60">
                <div className="text-gray-300 text-xs">Gift Coins</div>
                <div className="text-white text-2xl font-bold">{Number(stream?.total_gifts_coins || 0)}</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-yellow-500/60">
                <div className="text-gray-300 text-xs">Unique Gifters</div>
                <div className="text-white text-2xl font-bold">{Number(stream?.total_unique_gifters || 0)}</div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-2rem)]">
          {/* Main Stream Area */}
          <div className="lg:col-span-3 flex flex-col space-y-4">
            {/* Video Player Card */}
            <div className="bg-troll-purple-dark/70 rounded-2xl overflow-hidden border border-yellow-500 shadow-[0_0_35px_rgba(234,179,8,0.6)] backdrop-blur-md">
              <div className="aspect-video bg-troll-dark relative">
                {/* Multi-Beam Grid Layout */}
                {stream?.multi_beam ? (
                  <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const userId = `box-${idx}`
                      return (
                        <div
                          key={userId}
                          ref={(el) => {
                            if (el) multiStreamRefs.current[userId] = el
                          }}
                          className="relative bg-black/80 rounded overflow-hidden border border-purple-500/30 hover:border-yellow-400/50 transition-colors"
                          style={{
                            gridColumn: idx === 0 ? 'span 2' : 'span 1',
                            gridRow: idx === 0 ? 'span 2' : 'span 1'
                          }}
                        >
                          {/* Placeholder when no stream */}
                          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                            Box {idx + 1}
                          </div>
                          {/* Username overlay when active */}
                          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white">
                            <ClickableUsername username={broadcaster.username} className="text-white text-[10px]" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Single Stream Mode */
                  <div
                    ref={remoteVideoRef}
                    className="w-full h-full"
                  />
                )}

                {/* Overlay when joining / loading */}
                {joining && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none">
                    <Radio className="w-16 h-16 text-troll-purple animate-pulse mb-3" />
                    <p className="text-sm text-gray-300">
                      Connecting to Troll City live...
                    </p>
                  </div>
                )}
                
                {/* Stream Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          broadcaster.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${broadcaster.username}`
                        }
                        alt={broadcaster.username}
                        className="w-12 h-12 rounded-full ring-2 ring-troll-gold shadow-[0_0_18px_rgba(253,224,71,0.7)]"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg flex items-center space-x-1">
                            <ClickableUsername username={broadcaster.username} className="text-white" />
                            {/* Example badges */}
                            {(broadcaster as any).has_crown_badge && (
                              <Crown className="w-4 h-4 text-troll-gold" />
                            )}
                            {(broadcaster as any).vip_tier && (
                              <Star className="w-4 h-4 text-troll-purple" />
                            )}
                          </h3>
                        </div>
                        
                        {/* Active Perks/Insurance/Effects */}
                        {(broadcasterActivePerks.length > 0 || broadcasterActiveInsurance || broadcasterActiveEffect) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {broadcasterActiveInsurance && (
                              <span className="text-xs px-2 py-1 rounded-full bg-troll-green/20 text-troll-green border border-troll-green/30 flex items-center gap-1">
                                🛡️ Insurance
                              </span>
                            )}
                            {broadcasterActiveEffect && (
                              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                {broadcasterActiveEffect.entrance_effects?.icon || '✨'} Effect
                              </span>
                            )}
                            {broadcasterActivePerks.slice(0, 3).map((perk: any) => (
                              <span 
                                key={perk.id}
                                className="text-xs px-2 py-1 rounded-full bg-troll-gold/20 text-troll-gold border border-troll-gold/30 flex items-center gap-1"
                              >
                                {perk.perks?.icon || '⭐'} {perk.perks?.name || 'Perk'}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-sm text-gray-300">
                          {stream.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-xs sm:text-sm">
                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-black/40">
                        <Eye className="w-4 h-4 text-troll-green" />
                        <span>{stream.current_viewers || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-black/40">
                        <Gift className="w-4 h-4 text-troll-gold" />
                        <span>{stream.total_gifts_coins || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Stream Actions Bar */}
            <div className="bg-troll-purple-dark/80 rounded-2xl p-4 border border-troll-purple flex flex-wrap items-center justify-between gap-3 backdrop-blur">
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleFollow}
                  className={`px-4 py-2 rounded-full font-medium transition-colors shadow-[0_0_15px_rgba(34,197,94,0.5)] ${
                    isFollowing
                      ? 'bg-troll-purple text-white'
                      : 'bg-troll-green text-troll-dark hover:bg-troll-green-dark'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                <button
                  onClick={() => setShowGiftPanel(!showGiftPanel)}
                  className="px-4 py-2 bg-troll-gold text-troll-dark rounded-full font-medium hover:bg-troll-gold-dark transition-colors flex items-center space-x-2 shadow-[0_0_18px_rgba(234,179,8,0.8)]"
                >
                  <Gift className="w-4 h-4" />
                  <span>Send Gift</span>
                </button>

                <button
                  onClick={sendTrollBoo}
                  className="px-4 py-2 bg-[#0f172a] text-troll-green rounded-full font-medium hover:bg-black transition-colors flex items-center space-x-2 border border-troll-green/60"
                >
                  <Skull className="w-4 h-4" />
                  <span>Troll (BOO)</span>
                </button>
              </div>

              <div className="flex items-center space-x-3 text-xs sm:text-sm text-gray-300">
                <span>
                  Started{' '}
                  {stream.start_time
                    ? new Date(stream.start_time).toLocaleTimeString()
                    : '—'}
                </span>

                {profile?.id === stream.broadcaster_id && (
                  <button
                    onClick={endStreamAsBroadcaster}
                    disabled={isEndingStream}
                    className="flex items-center space-x-1 px-3 py-1 rounded-full border border-red-500/70 text-red-400 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-50"
                  >
                    <ShieldOff className="w-4 h-4" />
                    <span>
                      {isEndingStream ? 'Ending...' : 'End Stream'}
                    </span>
                  </button>
                )}

                {isTrollOfficer && (
                  <button
                    onClick={endStreamAsTrollOfficer}
                    disabled={isEndingStream}
                    className="flex items-center space-x-1 px-3 py-1 rounded-full border border-red-500/70 text-red-400 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-50"
                  >
                    <ShieldOff className="w-4 h-4" />
                    <span>
                      {isEndingStream ? 'Ending...' : 'End Stream (Troll Officer)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chat + Gifts Sidebar */}
          <div className="flex flex-col space-y-4">
            {/* Chat Messages */}
            <div className="bg-troll-purple-dark/80 rounded-2xl border border-troll-purple h-[60%] flex flex-col backdrop-blur">
              <div className="p-4 border-b border-troll-purple flex items-center justify-between">
                <h3 className="font-semibold flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-troll-green" />
                  <span>Troll Chat</span>
                </h3>
                <div className="flex items-center space-x-1 text-xs text-gray-300">
                  <Users className="w-4 h-4" />
                  <span>{stream.current_viewers || 0}</span>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-troll-purple flex items-center justify-between">
                <button onClick={startRandomBattle} className="px-3 py-1 rounded bg-yellow-500 text-black text-xs">Start Battle (2m)</button>
                {battle && (
                  <div className="text-xs text-gray-200">
                    vs {battle.opponent?.title || battle.opponent?.id} • ends in {Math.max(0, Math.floor((battle.endsAt! - Date.now())/1000))}s
                  </div>
                )}
                {trollDrop && (
                  <button
                    onClick={async () => {
                      try {
                        const claimKey = `tc-claimed-drop-${trollDrop.id}-${profile?.id}`
                        if (localStorage.getItem(claimKey)) return
                        const inc = Number(trollDrop.coins || 0)
                        const newFree = Number(profile?.free_coin_balance || 0) + inc
                        await supabase.from('user_profiles').update({ free_coin_balance: newFree }).eq('id', profile!.id)
                        useAuthStore.getState().setProfile({ ...profile!, free_coin_balance: newFree } as any)
                        localStorage.setItem(claimKey, '1')
                        toast.success(`Claimed ${inc} free coins`)
                      } catch { toast.error('Claim failed') }
                    }}
                    className="px-2 py-1 rounded bg-green-600 text-white text-xs"
                  >
                    Troll Drop: {trollDrop.coins}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                <div className="pointer-events-none absolute inset-0 z-0">
                  {falling.map((i) => (
                    <span
                      key={i}
                      style={{
                        position: 'absolute',
                        top: -30,
                        left: `${(i * 9) % 100}%`,
                        fontSize: '10px',
                        animation: 'fallTroll 9s linear infinite',
                        animationDelay: `${(i % 7) * 0.7}s`,
                        color: Math.random() < 0.5 ? '#22c55e' : '#ef4444'
                      }}
                    >
                      👹
                    </span>
                  ))}
                </div>
                {messages.map((message) => {
                  const isGift = message.message_type === 'gift'
                  const isEntrance = message.message_type === 'entrance'
                  const isBoo =
                    message.message_type === 'chat' &&
                    message.content.toLowerCase().includes("boo'd the stream")

                  const hideOwn = (() => {
                    if (!isDisappearActiveNow()) return false
                    if (message.message_type !== 'chat') return false
                    if (!profile?.id || message.user_id !== profile.id) return false
                    const age = Date.now() - new Date(message.created_at).getTime()
                    return age > 10000
                  })()

                  if (hideOwn) return null

                  return (
                    <div key={message.id} className="text-sm">
                      {isGift && (
                        <div className="bg-troll-gold-dark/30 rounded-xl p-2 border border-troll-gold shadow-[0_0_14px_rgba(234,179,8,0.7)]">
                          <p className="text-troll-gold font-medium">
                            🎁 {message.content}
                          </p>
                        </div>
                      )}

                      {isEntrance && (
                        <div className="bg-troll-green-dark/40 rounded-xl p-2 border border-troll-green shadow-[0_0_14px_rgba(34,197,94,0.7)] flex items-center space-x-2">
                          <span className="text-lg">
                            {(() => {
                              const text = message.content || ''
                              const effectMatch = text.match(/entered with (.+)!$/)
                              const effectName = effectMatch?.[1]?.trim()
                              const effect = effectName
                                ? ENTRANCE_EFFECTS.find(e => e.name === effectName)
                                : null
                              return effect?.icon || '✨'
                            })()}
                          </span>
                          <p className="text-xs text-troll-green">
                            {message.content}
                          </p>
                        </div>
                      )}

                      {!isGift && !isEntrance && (
                        <div
                          className={`flex items-start space-x-1 ${
                            isBoo ? 'text-troll-green' : ''
                          }`}
                        >
                          <ClickableUsername
                            username={message.user_profiles?.username || 'Unknown'}
                            className="font-medium text-troll-purple"
                            prefix=""
                          />
                          <span>:</span>
                          <span className="ml-1 break-words">
                            {message.content}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messageEndRef} />
                {isGhostActiveNow() && (
                  <div className="mt-1 text-[11px] text-gray-300">
                    Ghost Mode active — your entrance is hidden
                  </div>
                )}
              </div>
              
              {/* Message Input */}
              <div className="p-4 border-t border-troll-purple">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your troll message..."
                    className="flex-1 px-3 py-2 bg-troll-dark border border-troll-purple rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-troll-green"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-troll-green text-troll-dark rounded-full font-medium hover:bg-troll-green-dark transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Gift Panel */}
            {showGiftPanel && (
              <div className="bg-troll-purple-dark/80 rounded-2xl border border-troll-purple p-4 backdrop-blur flex-1">
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Gift className="w-5 h-5 text-troll-gold" />
                  <span>Send a Gift</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {gifts.map((gift) => (
                    <button
                      key={gift.id}
                      onClick={() => sendGift(gift)}
                      className="p-3 bg-troll-dark rounded-xl border border-troll-purple hover:border-troll-gold transition-colors flex flex-col items-center justify-center text-center"
                    >
                      <div className="text-2xl mb-1">
                        {(() => {
                          const type = gift.animation_type || 'bounce'
                          switch (type) {
                            case 'driveCar': return '🚗'
                            case 'diamondRain': return '💎'
                            case 'catScratch': return '🐱'
                            case 'crownFlash': return '👑'
                            case 'hatBounce': return '🎩'
                            case 'toolboxSpin': return '🧰'
                            case 'wineGlow': return '🍷'
                            case 'mega': return '🎉'
                            default: return '🎁'
                          }
                        })()}
                      </div>
                      <div className="text-xs font-medium truncate w-full">
                        {gift.name}
                      </div>
                      <div className="text-[11px] text-troll-gold mt-1">
                        {gift.coin_cost} coins
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-300 text-center">
                  Your balance:{' '}
                  {((profile?.paid_coin_balance || 0) +
                    (profile?.free_coin_balance || 0)) || 0}{' '}
                  coins
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Troll Events */}
      <TrollEvent streamId={streamId} />
    </div>
  )
}

export default StreamRoom
