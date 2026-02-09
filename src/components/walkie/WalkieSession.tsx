import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom'
import { Mic, MicOff, PhoneOff, User, Shield, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { WalkieSession as WalkieSessionType, walkieApi } from '../../lib/walkie'
import { audioManager } from '../../lib/audioManager'
import { toast } from 'sonner'
import { RemoteAudioTrack } from 'livekit-client'

interface WalkieSessionProps {
  session: WalkieSessionType
  onEnd: () => void
}

// Component to handle audio track attachment and registration with AudioManager
const WalkieAudio = ({ track }: { track: RemoteAudioTrack }) => {
  const ref = useRef<HTMLAudioElement>(null)
  
  useEffect(() => {
    if (!track || !ref.current) return
    const el = ref.current
    
    // Attach track to element
    track.attach(el)
    
    // Register with AudioManager so it doesn't get ducked
    audioManager.registerWalkieElement(el)
    
    return () => {
      audioManager.unregisterWalkieElement(el)
      track.detach(el)
    }
  }, [track])

  return <audio ref={ref} />
}

export default function WalkieSession({ session, onEnd }: WalkieSessionProps) {
  const { user, profile } = useAuthStore()
  const [isPTTPressed, setIsPTTPressed] = useState(false)
  const [isAdminSpeaking, setIsAdminSpeaking] = useState(false)
  const [adminIds, setAdminIds] = useState<string[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  // Fetch Admin IDs
  useEffect(() => {
    if (!supabase) {
      console.error('Supabase client missing in WalkieSession')
      return
    }
    supabase.from('user_profiles').select('id').eq('is_admin', true)
      .then(({ data }) => {
        if (data) setAdminIds(data.map(u => u.id))
      })
  }, [])

  // Fetch Walkie Token
  useEffect(() => {
    let mounted = true
    const fetchToken = async () => {
      try {
        const data = await walkieApi.getWalkieToken(session.id)
        if (mounted) {
            setToken(data.token)
        }
      } catch (err: any) {
        if (mounted) {
            setTokenError(err.message || 'Failed to authorize walkie session')
            toast.error('Walkie Authorization Failed', { description: err.message })
        }
      }
    }
    fetchToken()
    return () => { mounted = false }
  }, [session.id])

  // Use the hook to connect
  const {
    room,
    participantsList,
    connectionStatus,
    localParticipant,
    error,
    connect,
    disconnect,
    publishLocalTracks,
    stopLocalTracks
  } = useLiveKitRoom({
    roomName: session.id, 
    token: token || undefined, // Pass the token if available
    user: {
      id: user?.id || '',
      username: profile?.username || 'Officer',
      role: profile?.role || 'officer'
    },
    allowPublish: true,
    autoPublish: false,
    enabled: !!token // Only enable if token is present
  })

  // Connect when token is ready
  useEffect(() => {
    if (token && connectionStatus === 'idle') {
      connect()
    }
  }, [token, connect, connectionStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
      audioManager.unduck() // Ensure audio is restored
    }
  }, [disconnect])

  // Handle Audio Ducking
  useEffect(() => {
    if (connectionStatus === 'connected') {
      audioManager.duck()
    } else {
      audioManager.unduck()
    }
  }, [connectionStatus])

  const isPTTPressedRef = useRef(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    isPTTPressedRef.current = isPTTPressed
  }, [isPTTPressed])

  // Handle Admin Priority (Active Speaker Detection)
  useEffect(() => {
    if (!room) return

    const onActiveSpeakerChange = (speakers: any[]) => {
      // Check if any speaker is admin
      const adminSpeaking = speakers.some(speaker => {
        // Speaker identity is the User ID
        return adminIds.includes(speaker.identity)
      })
      
      if (adminSpeaking && !adminIds.includes(user?.id || '')) {
          // If I am speaking, stop me
          if (isPTTPressedRef.current) {
              handlePTTEnd()
              toast.error('Muted by Admin Override', { icon: <Shield className="w-4 h-4"/> })
          }
       }
      
      setIsAdminSpeaking(adminSpeaking)
    }

    room.on('activeSpeakersChanged', onActiveSpeakerChange)
    return () => {
      room.off('activeSpeakersChanged', onActiveSpeakerChange)
    }
  }, [room, adminIds, user?.id])

  // PTT Logic
  const handlePTTStart = async () => {
    if (isAdminSpeaking && !profile?.is_admin) return // Prevent speaking if admin is speaking
    setIsPTTPressed(true)
    await publishLocalTracks()
  }

  const handlePTTEnd = async () => {
    setIsPTTPressed(false)
    await stopLocalTracks()
  }

  // Keyboard shortcuts for PTT (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isPTTPressed) {
        // Only if not focused on input
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault() // Prevent scrolling
          handlePTTStart()
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handlePTTEnd()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isPTTPressed])


  if (tokenError) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-900 text-red-400 gap-2">
            <Shield className="w-8 h-8" />
            <div className="text-sm font-bold">Access Denied</div>
            <div className="text-xs text-center opacity-70">{tokenError}</div>
            <button onClick={onEnd} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white">Close</button>
        </div>
    )
  }

  if (error) {
    return <div className="p-4 text-red-400 text-center text-sm">Connection Error: {error}</div>
  }

  if (!token || connectionStatus === 'connecting') {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-900 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <div className="text-xs">Securing channel...</div>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Active Header */}
      <div className="bg-red-900/20 p-2 text-center border-b border-red-500/20">
        <div className="text-red-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Live Channel
        </div>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2 content-start">
        {participantsList.map((p) => (
          <div key={p.identity} className="flex flex-col items-center">
            {/* Audio Renderer for Remote Participants */}
            {!p.isLocal && p.audioTrack && (
                <WalkieAudio track={p.audioTrack as RemoteAudioTrack} />
            )}

            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all relative",
              p.isMicrophoneOn ? "border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "border-slate-700 bg-slate-800",
              isAdminSpeaking && !p.isLocal && "opacity-50"
            )}>
              <User className="w-6 h-6 text-slate-400" />
              {/* Status Indicator */}
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center",
                p.isMicrophoneOn ? "bg-green-500" : "bg-slate-600"
              )}>
                {p.isMicrophoneOn ? <Mic className="w-2 h-2 text-white" /> : <MicOff className="w-2 h-2 text-slate-300" />}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate max-w-full px-1">{p.name || p.identity}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800/50 border-t border-white/5 flex flex-col items-center gap-4">
        {/* PTT Button */}
        <button
          onMouseDown={handlePTTStart}
          onMouseUp={handlePTTEnd}
          onMouseLeave={handlePTTEnd}
          onTouchStart={handlePTTStart}
          onTouchEnd={handlePTTEnd}
          disabled={isAdminSpeaking && !profile?.is_admin}
          className={cn(
            "w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all shadow-lg border-4 select-none",
            isPTTPressed 
              ? "bg-green-600 border-green-400 shadow-green-900/50 scale-95" 
              : isAdminSpeaking && !profile?.is_admin
                ? "bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed"
                : "bg-purple-600 border-purple-400 shadow-purple-900/50 hover:bg-purple-500"
          )}
        >
          <Mic className="w-8 h-8 text-white mb-1" />
          <span className="text-[10px] font-bold text-white uppercase">
            {isPTTPressed ? 'Talk' : 'Hold'}
          </span>
        </button>

        <div className="flex w-full justify-between items-center">
           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
              {isAdminSpeaking ? 'ADMIN SPEAKING' : 'Channel Open'}
           </div>

           <button 
             onClick={onEnd}
             className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/30 flex items-center gap-2"
           >
             <PhoneOff className="w-3 h-3" />
             Leave
           </button>
        </div>
      </div>
    </div>
  )
}
