import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Video, Mic, MicOff, Settings } from 'lucide-react'
import { LiveKitRoomWrapper } from '../components/LiveKitVideoGrid'
import { useLiveKit } from '../contexts/LiveKitContext'
import { toast } from 'sonner'

const GoLive: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { toggleMicrophone, toggleCamera, isConnected } = useLiveKit()

  // 🔒 HARD-LOCKED identifiers
  const streamUuidRef = useRef<string>(crypto.randomUUID())
  const roomNameRef = useRef<string>(`stream-${streamUuidRef.current}`)
  const identityRef = useRef<string | null>(null)

  if (!identityRef.current && user?.id) {
    identityRef.current = user.id
  }

  const streamUuid = streamUuidRef.current
  const roomName = roomNameRef.current
  const identity = identityRef.current

  const [streamTitle, setStreamTitle] = useState('')
  const [started, setStarted] = useState(false)
  const [creating, setCreating] = useState(false)

  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)

  const createdRef = useRef(false)
  const navigatedRef = useRef(false)

  // Default title
  useEffect(() => {
    if (!streamTitle.trim()) {
      setStreamTitle(`Live with ${profile?.username || 'broadcaster'}`)
    }
  }, [profile?.username])

  const startStream = async () => {
    if (!identity || !profile?.id) {
      toast.error('Not ready to stream')
      return
    }

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title')
      return
    }

    // Browser media permission (required)
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      toast.error('Camera/microphone access required')
      return
    }

    setStarted(true)

    if (createdRef.current) return
    createdRef.current = true
    setCreating(true)

    const { error } = await supabase.from('streams').insert({
      id: streamUuid,
      broadcaster_id: profile.id,
      title: streamTitle,
      room_name: roomName,
      is_live: true,
      status: 'live',
      start_time: new Date().toISOString(),
      viewer_count: 0,
      current_viewers: 0,
      total_gifts_coins: 0,
      popularity: 0,
    })

    setCreating(false)

    if (error) {
      console.error(error)
      toast.error('Failed to create stream')
      createdRef.current = false
      setStarted(false)
      return
    }

    if (!navigatedRef.current) {
      navigatedRef.current = true
      setTimeout(() => {
        navigate(`/stream/${streamUuid}`, { replace: true })
      }, 300)
    }
  }

  // ================= UI =================

  if (!started) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <Video className="w-16 h-16 text-purple-400 mx-auto" />
          <h1 className="text-3xl font-bold text-center">Ready to Go Live</h1>

          <input
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            className="w-full bg-[#1C1C24] border border-purple-500/40 rounded px-4 py-3"
          />

          <button
            onClick={startStream}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded"
          >
            Start Streaming
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h1 className="text-2xl font-bold">LIVE: {streamTitle}</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                toggleCamera()
                setCamEnabled((v) => !v)
              }}
              disabled={!isConnected}
              className={`p-2 rounded-lg ${
                camEnabled ? 'bg-green-600' : 'bg-red-600'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Video />
            </button>

            <button
              onClick={() => {
                toggleMicrophone()
                setMicEnabled((v) => !v)
              }}
              disabled={!isConnected}
              className={`p-2 rounded-lg ${
                micEnabled ? 'bg-green-600' : 'bg-red-600'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {micEnabled ? <Mic /> : <MicOff />}
            </button>

            <Settings />
          </div>
        </div>

        <div className="w-full h-[70vh] bg-black rounded-lg overflow-hidden">
          <LiveKitRoomWrapper
            roomName={roomName}
            identity={identity!}
            role="broadcaster"
            autoConnect
            autoPublish
            maxParticipants={6}
            className="w-full h-full"
          />
        </div>

        <div className="mt-4 text-sm text-gray-400 flex justify-between">
          <span>Room: {roomName}</span>
          <span>{creating ? 'Starting…' : 'Live'}</span>
        </div>
      </div>
    </div>
  )
}

export default GoLive
