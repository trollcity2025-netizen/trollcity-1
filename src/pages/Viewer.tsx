import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Users, Mic, MicOff, Video, VideoOff, Gift, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import ClickableUsername from '../components/ClickableUsername'
import AuthorityPanel from '../components/AuthorityPanel'

import GiftActionPanel from '../components/GiftActionPanel'
import SendGiftModal from '../components/SendGiftModal'
import GiftEventOverlay from './GiftEventOverlay'
import { useGiftEvents } from '../lib/hooks/useGiftEvents'
import { useStreamEarnings } from '../lib/hooks/useStreamEarnings'
import { useLiveKitRoom, LiveKitParticipantState, LiveKitConnectionStatus } from '../hooks/useLiveKitRoom'

export default function ViewerPage() {
  const { user, profile } = useAuthStore()
  const [streamData, setStreamData] = useState<any>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showEntrance, setShowEntrance] = useState(false)
  const liveKitUser = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'Viewer',
      role: profile?.role || (profile as any)?.troll_role || 'viewer',
      level: profile?.level ?? 1,
    }
  }, [user, profile])

  // Load stream
  useEffect(() => {
    const loadStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, category, current_viewers, is_live, broadcaster_id, created_at')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) return
      setStreamData(data)
    }
    loadStream()
  }, [])

  // Entrance trigger
  useEffect(() => {
    if (!user || !streamData) return
    setShowEntrance(true)
    const timer = setTimeout(() => setShowEntrance(false), 3500)
    return () => clearTimeout(timer)
  }, [user, streamData])

  useEffect(() => {
    if (!streamData) return
    supabase.rpc('update_viewer_count', { p_stream_id: streamData.id, p_delta: 1 })
    return () => { supabase.rpc('update_viewer_count', { p_stream_id: streamData.id, p_delta: -1 }) }
  }, [streamData?.id])

  // Viewer count subscription via streams updates
  useEffect(() => {
    if (!streamData) return
    const channel = supabase
      .channel(`streams_${streamData.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${streamData.id}` }, (payload) => {
        const row: any = payload.new
        setViewerCount(Number(row.current_viewers || 0))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [streamData])

  // Load messages with crown badge
  useEffect(() => {
    if (!streamData) return

    supabase
      .from('messages')
      .select(`
        *,
        user_profiles:user_id ( username, has_crown_badge )
      `)
      .eq('stream_id', streamData.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []))

    const subscription = supabase
      .channel(`chat_${streamData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamData.id}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe()

    return () => { void supabase.removeChannel(subscription) }
  }, [streamData])

  const {
    participantsList,
    connectionStatus: liveKitStatus,
    error: liveKitError,
  } = useLiveKitRoom({
    roomName: streamData?.id || '',
    user: liveKitUser,
    allowPublish: false,
    autoPublish: false,
  })

  const sortedParticipants = useMemo(() => {
    if (!participantsList.length) return []
    if (!streamData?.broadcaster_id) return participantsList
    const hostIndex = participantsList.findIndex(
      (participant) => participant.identity === streamData.broadcaster_id
    )
    if (hostIndex === -1) return participantsList
    const host = participantsList[hostIndex]
    const others = participantsList.filter((_, index) => index !== hostIndex)
    return [host, ...others]
  }, [participantsList, streamData?.broadcaster_id])

  const sendMessage = async () => {
    if (!chatInput.trim() || !streamData) return
    await supabase.from('messages').insert({
      user_id: user.id,
      content: chatInput,
      message_type: 'chat',
      stream_id: streamData.id,
    })
    setChatInput('')
  }

  const lastGift = useGiftEvents(streamData?.id)
  const { totalCoins, giftCount, topGifterId, topGifterCoins } = useStreamEarnings(streamData?.id)
  const formatCoins = (coins: number) =>
    coins.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return (
    <div className="flex h-screen bg-black text-white pt-16 lg:pt-0">
      <div className="flex-1 flex flex-col">

      {/* STREAM PLAYER */}
      <div className="relative flex-1 bg-gray-900">
        <ViewerVideoPanel
          participants={sortedParticipants}
          hostIdentity={streamData?.broadcaster_id}
          status={liveKitStatus}
          error={liveKitError}
          participantCount={participantsList.length}
        />

        {/* ENTRANCE EXPLOSION */}
        {showEntrance && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[99]">

            {/* IF CROWNED USER */}
            {(profile as any)?.has_crown_badge ? (
              <div className="animate-fade-in-up bg-black/90 p-6 rounded-2xl border-2 border-[var(--troll-gold-neon)] shadow-[0_0_30px_rgba(255,201,60,0.8)] text-center">
                <div className="neon-pill neon-pill-gold text-[10px] w-max mx-auto mb-2 flex items-center gap-1">
                  👑 Royal Entrance
                </div>
                <div className="text-2xl font-extrabold text-yellow-300 animate-pulse-neon">
                  <ClickableUsername username={profile?.username || 'Unknown'} className="text-yellow-300 font-extrabold" /> has entered — Troll Royalty Has Arrived!
                </div>
                <p className="text-yellow-200 text-sm mt-1">Family Champions Winner</p>

                {/* Crown emoji rain */}
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="crown-rain"
                    style={{ left: `${10 + i * 7}%`, animationDelay: `${i * 0.15}s` }}
                  >
                    👑
                  </div>
                ))}
              </div>
            ) : (
              // Normal entrance
              <div className="bg-black/70 px-8 py-4 rounded-2xl border border-[var(--troll-green-neon)] shadow-troll-glow animate-fade-in-up">
                <div className="neon-pill neon-pill-green mb-2 w-max mx-auto">Entrance</div>
                <div className="text-xl font-extrabold gradient-text-green-pink">
                  <ClickableUsername username={profile?.username || 'Unknown'} className="gradient-text-green-pink" /> joined the stream!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gift animation overlay */}
        {lastGift && <GiftEventOverlay gift={lastGift} />}

        {/* STREAM INFO HEADER */}
        {streamData && (
          <div className="absolute top-3 left-3 bg-black/60 p-3 rounded-lg text-sm troll-card shadow-lg">
            <div className="flex items-center gap-2">
              <span className="font-bold gradient-text-green-pink">{streamData.title}</span>
              <span className="neon-pill neon-pill-red text-[10px] live-indicator">LIVE</span>
            </div>
            <div className="flex gap-3 items-center text-xs mt-1">
              <span className="text-green-400">{streamData.category}</span>
              {streamData.mic_enabled ? <Mic size={16} /> : <MicOff size={16} />}
              {streamData.camera_enabled ? <Video size={16} /> : <VideoOff size={16} />}
              <span className="flex items-center">
                <Users size={16} className="mr-1" /> {viewerCount}
              </span>
            </div>
          </div>
        )}

        {/* EARNINGS HUD */}
        {streamData && (
          <div className="absolute top-3 right-3 bg-black/60 px-4 py-2 rounded-lg text-xs troll-card shadow-lg">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-yellow-400" />
              <span className="font-semibold">Stream Earnings</span>
            </div>
            <div className="flex justify-between mt-1 gap-4">
              <span>Coins: <span className="text-green-400">{formatCoins(totalCoins)}</span></span>
              <span>Gifts: <span className="text-purple-300">{giftCount}</span></span>
            </div>
            {topGifterId && (
              <div className="flex gap-1 items-center text-[10px] mt-1">
                <span className="neon-pill neon-pill-green text-[8px]">Top Gifter</span>
                <span className="text-yellow-300">{formatCoins(topGifterCoins)} coins</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK GIFT PANEL */}
      <div className="bg-gray-900 border-t border-gray-800 p-2">
        {streamData && <GiftActionPanel streamerId={streamData.broadcaster_id} streamId={streamData.id} />}
      </div>

      {/* FULL GIFT MODAL BUTTON */}
      <div className="bg-gray-900 border-t border-gray-800 p-3 text-center">
        <button
          onClick={() => setShowGiftModal(true)}
          className="gaming-button-pink px-4 py-2 flex items-center mx-auto"
        >
          <Gift size={16} className="mr-2" /> Open Full Gift Menu
        </button>
      </div>

      {streamData && (
        <SendGiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          streamerId={streamData.broadcaster_id}
          streamId={streamData.id}
        />
      )}

      {/* CHAT */}
      <div className="h-64 bg-gray-800 flex border-t border-gray-700">
        <div className="flex-1 flex flex-col p-3 overflow-hidden border-r-gray-700">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {messages.map((m: any, i: number) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 font-semibold">{m.user_profiles?.username || ''}</span>
                  {m.user_profiles?.has_crown_badge && (
                    <span className="neon-pill neon-pill-gold text-[9px] flex items-center gap-1">
                      👑 Crowned
                    </span>
                  )}
                </div>
                <span>{m.content}</span>
              </div>
            ))}
          </div>

          <div className="flex mt-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-gray-700 p-2 rounded-l-md text-sm"
              placeholder="Type a message..."
            />
            <button onClick={sendMessage} className="bg-purple-600 px-4 rounded-r-md text-sm">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Authority Panel - Right Side Rail */}
    <div className="hidden lg:block">
      <div className="sticky top-0 h-screen">
        <AuthorityPanel />
      </div>
    </div>
  </div>
)
}

const connectionStatusLabels: Record<LiveKitConnectionStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  connected: 'Live',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
}

const ViewerVideoPanel: React.FC<{
  participants: LiveKitParticipantState[]
  hostIdentity?: string
  status: LiveKitConnectionStatus
  error?: string | null
  participantCount: number
}> = ({ participants, hostIdentity, status, error, participantCount }) => {
  const host = participants.find((participant) => participant.identity === hostIdentity) ?? participants[0]
  const guests = host ? participants.filter((participant) => participant.identity !== host.identity) : []
  const statusLabel = connectionStatusLabels[status] ?? 'Connecting'

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {host ? (
        <div className="absolute inset-0">
          <ParticipantMedia
            participant={host}
            label={host.identity === hostIdentity ? 'Host' : host.name}
            withAudio
            className="h-full w-full"
          />
          {guests.length > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {guests.slice(0, 4).map((guest) => (
                <div key={guest.identity} className="h-16 w-24 overflow-hidden rounded-lg border border-white/10 bg-black/50">
                  <ParticipantMedia participant={guest} className="h-full w-full" label={guest.name} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-6">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-300">{statusLabel}</p>
          <p className="text-2xl font-semibold mt-2">Waiting for the broadcaster</p>
          {error && <p className="mt-2 text-xs text-red-400 uppercase tracking-[0.3em]">{error}</p>}
        </div>
      )}

      <div className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.3em] text-gray-300">
        {statusLabel}
      </div>
      <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-[0.3em] text-gray-400">
        LiveKit participants: {participantCount}
      </div>
    </div>
  )
}

const ParticipantMedia: React.FC<{
  participant: LiveKitParticipantState
  label?: string
  withAudio?: boolean
  className?: string
}> = ({ participant, label, withAudio = false, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const track = participant.videoTrack?.track
    const el = videoRef.current
    if (!track || !el) return
    track.attach(el)
    return () => {
      try {
        track.detach(el)
      } catch {
        //
      }
    }
  }, [participant.videoTrack?.track])

  useEffect(() => {
    if (!withAudio) return
    const track = participant.audioTrack?.track
    const el = audioRef.current
    if (!track || !el) return
    track.attach(el)
    return () => {
      try {
        track.detach(el)
      } catch {
        //
      }
    }
  }, [participant.audioTrack?.track, withAudio])

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {participant.videoTrack?.track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/80 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white">
          Waiting for video
        </div>
      )}
      {withAudio && <audio ref={audioRef} autoPlay muted={participant.isLocal} />}
      <div className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white">
        {label || participant.name || participant.identity}
      </div>
    </div>
  )
}
