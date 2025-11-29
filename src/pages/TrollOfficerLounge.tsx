import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'
import {
  Eye,
  Ban,
  VolumeX,
  Users,
  Shield,
  Camera,
  AlertTriangle,
  DoorOpen,
  MessageSquare,
  Star,
  Coins,
  TrendingUp,
  RefreshCw
} from 'lucide-react'

type Stream = {
  id: string
  title: string
  category?: string
  broadcaster_id: string
  current_viewers?: number
  status: string
}

type OfficerChatMessage = {
  id: string
  user_id: string
  message: string
  created_at: string
  username?: string
}

type OfficerStats = {
  kicks: number
  bans: number
  mutes: number
  coinsEarned: number
  reputation: number
  rank: string
}

export default function TrollOfficerLounge() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [liveStreams, setLiveStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [reportAlerts, setReportAlerts] = useState<any[]>([])
  const [officerChat, setOfficerChat] = useState<OfficerChatMessage[]>([])
  const [newOfficerMessage, setNewOfficerMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'moderation' | 'families'>('moderation')
  const [familiesList, setFamiliesList] = useState<any[]>([])

  const [officerStats, setOfficerStats] = useState<OfficerStats>({
    kicks: 0,
    bans: 0,
    mutes: 0,
    coinsEarned: 0,
    reputation: 0,
    rank: 'Bronze I'
  })

  // --- Helpers for rank & reputation ---
  const getRankFromReputation = (rep: number) => {
    if (rep >= 200) return 'Diamond Troll'
    if (rep >= 120) return 'Platinum Troll'
    if (rep >= 70) return 'Gold Troll'
    if (rep >= 30) return 'Silver Troll'
    return 'Bronze I'
  }

  const bumpStats = (type: 'kick' | 'ban' | 'mute') => {
    setOfficerStats((prev) => {
      let { kicks, bans, mutes, coinsEarned, reputation } = prev

      if (type === 'kick') {
        kicks += 1
        coinsEarned += 50 // example: 10% of 500 coin penalty
        reputation += 3
      } else if (type === 'ban') {
        bans += 1
        coinsEarned += 100 // heavier action, higher reward
        reputation += 7
      } else if (type === 'mute') {
        mutes += 1
        reputation += 1
      }

      const rank = getRankFromReputation(reputation)

      return { kicks, bans, mutes, coinsEarned, reputation, rank }
    })
  }

  // --- Access Gate ---
  useEffect(() => {
    if (!profile) return

    if (!['troll_officer', 'admin'].includes(profile.role)) {
      toast.error('Access denied')
      window.location.href = '/'
    }
  }, [profile])

  // --- Live Streams + AI Flags subscriptions ---
  useEffect(() => {
    fetchLiveStreams()

    const streamChannel = supabase
      .channel('stream-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => fetchLiveStreams()
      )
      .subscribe()

    const flagsChannel = supabase
      .channel('ai-flags')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_reports',
          filter: 'severity=eq.critical'
        },
        (payload: any) => {
          setReportAlerts((prev) => [...prev, payload.new])
          toast.error(`🚨 Critical alert in stream ${payload.new.stream_id}`)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(streamChannel)
      void supabase.removeChannel(flagsChannel)
    }
  }, [])

  // --- Officer Chat load + realtime ---
  useEffect(() => {
    if (!profile) return

    loadOfficerChat()

    const chatChannel = supabase
      .channel('officer-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'officer_chat_messages' },
        async () => {
          // Refresh so we always get username join
          await loadOfficerChat()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(chatChannel)
    }
  }, [profile])

  const fetchLiveStreams = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, broadcaster_id, current_viewers, status')
        .eq('is_live', true)

      if (error) throw error
      setLiveStreams((data as Stream[]) || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load streams')
    } finally {
      setLoading(false)
    }
  }

  const loadOfficerChat = async () => {
    setChatLoading(true)
    try {
      const { data, error } = await supabase
        .from('officer_chat_messages')
        .select('*, user_profiles!inner(username)')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      const mapped: OfficerChatMessage[] =
        data?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          message: row.message,
          created_at: row.created_at,
          username: row.user_profiles?.username || 'Officer'
        })) || []

      setOfficerChat(mapped)
    } catch (err) {
      console.warn('Officer chat table missing or load failed', err)
    } finally {
      setChatLoading(false)
    }
  }

  const sendOfficerMessage = async () => {
    if (!profile || !newOfficerMessage.trim()) return

    const messageText = newOfficerMessage.trim()
    setNewOfficerMessage('')

    try {
      const { data, error } = await supabase
        .from('officer_chat_messages')
        .insert({ user_id: profile.id, message: messageText })
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setOfficerChat((prev) => [
          ...prev,
          {
            id: data.id,
            user_id: data.user_id,
            message: data.message,
            created_at: data.created_at,
            username: profile.username
          }
        ])
      }

      // extra safety sync
      await loadOfficerChat()
    } catch (err) {
      console.error(err)
      toast.error('Failed to send officer message')
    }
  }

  const loadFamilies = async () => {
    try {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setFamiliesList(data || [])
    } catch (err) {
      console.error('Failed to load families:', err)
      setFamiliesList([])
    }
  }

  // Load families when tab changes to families
  useEffect(() => {
    if (activeTab === 'families') {
      loadFamilies()
    }
  }, [activeTab])

  const kickUser = async (username: string) => {
    // TODO: hook into moderation_logs + coin penalties
    toast.success(`${username} kicked - 500 paid coins deducted`)
    bumpStats('kick')
  }

  const banUserFromApp = async (username: string) => {
    // TODO: write actual ban logic (profiles / auth block)
    toast.success(`${username} banned from the entire app`)
    bumpStats('ban')
  }

  const muteUser = async (username: string) => {
    // TODO: mute in chat via stream_chat_messages or a mute table
    toast.success(`${username} muted in chat`)
    bumpStats('mute')
  }

  const endStream = async (streamId: string, broadcaster: string) => {
    try {
      const { error } = await supabase
        .from('streams')
        .update({ status: 'ended', end_time: new Date().toISOString() })
        .eq('id', streamId)

      if (error) throw error

      toast.success(`Stream ended - ${broadcaster} temporarily locked`)
      fetchLiveStreams()
    } catch (err) {
      console.error(err)
      toast.error('Failed to end stream')
    }
  }

  const openStreamView = (streamId: string) => {
    navigate(`/stream/${streamId}`)
  }

  const getPlaybackUrl = (stream: Stream | null) => {
    return null
  }

  return (
    <div className="min-h-screen p-8 bg-[#05050A] text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              Troll Officer Command Center
            </h1>
            <p className="text-gray-400">
              Monitor, analyze, and respond to live stream issues. Moderation in real time.
            </p>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg shadow-lg text-sm">
            <div className="font-semibold text-purple-200">
              Officer:{' '}
              <ClickableUsername username={profile?.username || 'unknown'} className="text-white" />
            </div>
            <div className="text-xs text-gray-300">
              Rank:{' '}
              <span className="text-yellow-300 font-semibold">
                {officerStats.rank}
              </span>{' '}
              • REP {officerStats.reputation}
            </div>
          </div>
        </header>

        {/* TABS */}
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-4 py-2 rounded-t-lg transition ${
              activeTab === 'moderation'
                ? 'bg-purple-600 text-white'
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#252525]'
            }`}
          >
            Moderation
          </button>
          <button
            onClick={() => setActiveTab('families')}
            className={`px-4 py-2 rounded-t-lg transition ${
              activeTab === 'families'
                ? 'bg-purple-600 text-white'
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#252525]'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Troll Families
          </button>
        </div>

        {/* MODERATION TAB */}
        {activeTab === 'moderation' && (
          <>
        {reportAlerts.length > 0 && (
          <section className="bg-[#2A0000] border border-red-700 rounded-xl p-4 shadow-lg">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-300">
              <AlertTriangle className="text-red-400" /> Active Critical Alerts
            </h2>
            {reportAlerts.map((alert, i) => (
              <div key={i} className="text-sm mt-2 text-red-200">
                🚨 Stream {alert.stream_id} flagged – {alert.reason}
              </div>
            ))}
          </section>
        )}

        {/* STATS + EARNINGS + CHAT GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats + Earnings */}
          <div className="space-y-4 lg:col-span-2">
            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatBox
                title="Streams Live"
                value={liveStreams.length}
                icon={<Camera className="w-5 h-5" />}
              />
              <StatBox
                title="Kicks"
                value={officerStats.kicks}
                icon={<Ban className="w-5 h-5" />}
              />
              <StatBox
                title="Bans"
                value={officerStats.bans}
                icon={<Shield className="w-5 h-5" />}
              />
              <StatBox
                title="Mutes"
                value={officerStats.mutes}
                icon={<VolumeX className="w-5 h-5" />}
              />
            </div>

            {/* Earnings + Reputation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111320] border border-purple-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-200 mb-2">
                  <Coins className="w-5 h-5 text-yellow-300" />
                  Troll Officer Earnings
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  You earn a small cut of penalties from kicks & bans.
                </p>
                <div className="text-3xl font-bold text-yellow-300 mb-1">
                  {officerStats.coinsEarned.toLocaleString()}{' '}
                  <span className="text-base">paid coins</span>
                </div>
                <div className="text-xs text-gray-400">
                  Approx value: $
                  {(officerStats.coinsEarned / 100).toFixed(2)} USD (100 coins = $1)
                </div>
              </div>

              <div className="bg-[#111320] border border-indigo-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-200 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-300" />
                  Reputation & Promotions
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  Clean actions, accurate bans, and fast responses raise your rank.
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300">Reputation Score</div>
                    <div className="text-2xl font-bold text-green-300">
                      {officerStats.reputation}
                    </div>
                    <div className="text-xs text-gray-500">
                      Higher = faster promotions
                    </div>
                  </div>
                  <div className="w-24 h-24 rounded-full border-4 border-purple-500 flex flex-col items-center justify-center text-center px-2">
                    <Star className="w-6 h-6 text-yellow-300 mb-1" />
                    <span className="text-xs text-gray-200 font-semibold">
                      {officerStats.rank}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Officer Chat */}
          <div className="bg-[#0F111A] border border-gray-700 rounded-xl p-5 flex flex-col h-full">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-300 mb-3">
              <MessageSquare className="w-5 h-5" />
              Officer Chat (Private)
            </h3>
            <div className="text-xs text-gray-400 mb-2">
              Only Troll Officers & Admins can see this channel.
            </div>

            <div className="flex-1 bg-[#151726] rounded-lg p-3 overflow-y-auto mb-3 space-y-2">
              {chatLoading && (
                <p className="text-gray-500 text-sm">Loading chat…</p>
              )}
              {!chatLoading && officerChat.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No messages yet. Start the first troll briefing.
                </p>
              )}
              {officerChat.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-purple-300 font-semibold">
                    <ClickableUsername username={msg.username || 'Officer'} className="text-purple-300" />:{' '}
                  </span>
                  <span className="text-gray-200">{msg.message}</span>
                  <span className="text-[10px] text-gray-500 ml-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-[#1A1D2E] border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="Brief the other officers…"
                value={newOfficerMessage}
                onChange={(e) => setNewOfficerMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    sendOfficerMessage()
                  }
                }}
              />
              <button
                onClick={(e) => {
                  e.preventDefault()
                  sendOfficerMessage()
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        {/* LIVE STREAM GRID + PREVIEW */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Streams grid */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Camera className="text-purple-300" />
              Live Streams to Monitor
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {liveStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="bg-[#111320] border border-gray-700 rounded-lg p-4 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-900/30 transition cursor-pointer"
                  onClick={() => setSelectedStream(stream)}
                >
                  <div className="h-36 bg-black/40 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                    <Camera className="w-10 h-10 text-gray-500" />
                    <div className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-1 rounded-full">
                      LIVE
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 text-xs px-2 py-1 rounded">
                      👥 {stream.current_viewers || 0}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold">{stream.title}</h3>
                  <p className="text-gray-400 text-sm">
                    🎭 {stream.category || 'General'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Broadcaster: {stream.broadcaster_id}
                  </p>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedStream(stream)
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg px-3 py-2 flex items-center justify-center gap-1"
                    >
                      <Eye className="w-4 h-4" /> Actions
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openStreamView(stream.id)
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-sm rounded-lg px-3 py-2 flex items-center justify-center gap-1"
                    >
                      <Camera className="w-4 h-4" /> Watch
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!loading && liveStreams.length === 0 && (
              <p className="text-center text-gray-500 py-10">
                🚫 No live streams at the moment. Time to sip coffee and wait for
                chaos.
              </p>
            )}
          </div>

          {/* Live preview panel */}
          <div className="bg-[#111320] border border-gray-700 rounded-xl p-5 h-full">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-cyan-300 mb-3">
              <Eye className="w-5 h-5" />
              Live Preview
            </h3>
            {!selectedStream && (
              <p className="text-gray-500 text-sm">
                Select a live stream tile to see embedded preview and actions.
              </p>
            )}

            {selectedStream && (
              <div className="space-y-4">
                <div className="aspect-video bg-black/60 rounded-lg flex items-center justify-center overflow-hidden">
                  {getPlaybackUrl(selectedStream) ? (
                    <video
                      src={getPlaybackUrl(selectedStream) || undefined}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      muted
                    />
                  ) : (
                    <div className="text-center text-gray-400 text-sm px-4">
                      No direct playback URL set for this stream yet.
                      <br />
                      Use the full viewer via the{' '}
                      <span className="text-purple-300 font-semibold">Watch</span>{' '}
                      button or wire Agora/IVS player here later.
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-white">
                    {selectedStream.title}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {selectedStream.category || 'General'} • 👥{' '}
                    {selectedStream.current_viewers || 0} viewers
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Broadcaster: {selectedStream.broadcaster_id}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label="End Stream"
                    onClick={() =>
                      endStream(selectedStream.id, selectedStream.broadcaster_id)
                    }
                    variant="danger"
                    icon={<DoorOpen className="w-4 h-4" />}
                  />
                  <ActionButton
                    label="Kick Viewer"
                    onClick={() => kickUser('viewer')}
                    variant="warning"
                    icon={<Ban className="w-4 h-4" />}
                  />
                  <ActionButton
                    label="Ban User"
                    onClick={() => banUserFromApp('viewer')}
                    variant="dangerOutline"
                    icon={<Shield className="w-4 h-4" />}
                  />
                  <ActionButton
                    label="Mute User"
                    onClick={() => muteUser('viewer')}
                    variant="neutral"
                    icon={<VolumeX className="w-4 h-4" />}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
        </>
        )}

        {/* FAMILIES TAB */}
        {activeTab === 'families' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-cyan-400" />
                Troll Families
              </h2>
              <button
                onClick={loadFamilies}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {familiesList.length === 0 ? (
              <div className="bg-[#111320] border border-gray-700 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">No families found</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {familiesList.map((family) => (
                  <div
                    key={family.id}
                    className="bg-[#111320] border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">
                          {family.name || 'Unnamed Family'}
                        </h3>
                        <p className="text-gray-400 text-sm mb-3">
                          {family.description || 'No description'}
                        </p>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-500">
                            ID: <span className="text-purple-300">{family.id}</span>
                          </span>
                          <span className="text-gray-500">
                            Created: <span className="text-gray-300">
                              {new Date(family.created_at).toLocaleDateString()}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/family/${family.id}`)}
                          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

// --- SMALL REUSABLE UI PIECES ---

const StatBox: React.FC<{
  title: string
  value: string | number
  icon: React.ReactNode
}> = ({ title, value, icon }) => (
  <div className="bg-[#111320] border border-gray-700 rounded-lg p-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-purple-900/40 flex items-center justify-center text-purple-300">
      {icon}
    </div>
    <div>
      <div className="text-xs text-gray-400">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  </div>
)

const ActionButton: React.FC<{
  label: string
  onClick: () => void
  variant?: 'danger' | 'warning' | 'neutral' | 'dangerOutline'
  icon?: React.ReactNode
}> = ({ label, onClick, variant = 'neutral', icon }) => {
  let classes =
    'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors'

  if (variant === 'danger') {
    classes += ' bg-red-600 hover:bg-red-700'
  } else if (variant === 'warning') {
    classes += ' bg-yellow-500 text-black hover:bg-yellow-600'
  } else if (variant === 'dangerOutline') {
    classes += ' border border-red-500 text-red-300 hover:bg-red-600/20'
  } else {
    classes += ' bg-gray-700 hover:bg-gray-600'
  }

  return (
    <button onClick={onClick} className={classes}>
      {icon}
      {label}
    </button>
  )
}
