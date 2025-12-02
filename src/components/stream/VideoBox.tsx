import { useEffect, useRef, useState } from 'react'
import {
  Participant,
  TrackPublication,
  Track,
  RemoteTrack,
} from 'livekit-client'
import { Mic, MicOff, Crown, Gift } from 'lucide-react'
import { UserProfile } from '../../lib/supabase'
import { UserBadge } from '../UserBadge'

export interface StreamParticipant {
  participant: Participant | null
  userProfile: UserProfile | null
  userId: string
  role?: 'host' | 'opponent' | 'guest'
}

interface VideoBoxProps {
  participant: StreamParticipant | null
  size: 'full' | 'medium' | 'small'
  label?: string
  isHost?: boolean
  onGiftSend?: (targetId: string) => void
  showBadges?: boolean
}

export default function VideoBox({
  participant,
  size,
  label,
  isHost = false,
  onGiftSend,
  showBadges = true,
}: VideoBoxProps) {
  const videoRef = useRef<HTMLDivElement>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)

  const livekitParticipant = participant?.participant
  const userProfile = participant?.userProfile
  const userId = participant?.userId || ''
  const displayLabel = label || userProfile?.username || 'Unknown'

  useEffect(() => {
    if (!livekitParticipant || !videoRef.current) {
      // Clear container if no participant
      if (videoRef.current) {
        videoRef.current.innerHTML = ''
      }
      return
    }

    const container = videoRef.current
    container.innerHTML = ''

    const publications = Array.from(
      livekitParticipant.trackPublications.values()
    ) as TrackPublication[]

    const videoPub = publications.find(
      (pub) => pub.track && pub.track.kind === 'video'
    )

    const videoTrack = videoPub?.track || null

    if (videoTrack) {
      const videoElement = videoTrack.attach()
      if (videoElement instanceof HTMLVideoElement) {
        videoElement.className = 'w-full h-full object-cover'
        videoElement.autoplay = true
        videoElement.playsInline = true
        if (livekitParticipant.isLocal) videoElement.muted = true
      }
      container.appendChild(videoElement)
    }

    // Check if audio is enabled
    const audioPub = publications.find(
      (pub) => pub.kind === 'audio'
    )
    setAudioEnabled(audioPub?.isEnabled ?? false)

    // Monitor audio level for speaking indicator
    let checkInterval: NodeJS.Timeout | null = null
    if (audioPub?.track) {
      checkInterval = setInterval(() => {
        setIsSpeaking(audioPub.isEnabled && audioPub.isSubscribed)
      }, 100)
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval)
      videoTrack?.detach()
    }
  }, [livekitParticipant])

  const sizeClass =
    size === 'full'
      ? 'w-full h-full'
      : size === 'medium'
      ? 'w-full h-full'
      : 'w-[150px] h-[100px]'

  if (!participant) {
    return (
      <div
        className={`relative ${sizeClass} rounded-xl overflow-hidden border border-gray-700 bg-black/50 flex items-center justify-center`}
      >
        <div className="text-gray-500 text-sm">No participant</div>
      </div>
    )
  }

  return (
    <div
      ref={videoRef}
      className={`relative ${sizeClass} rounded-xl overflow-hidden border 
      ${isSpeaking ? 'border-green-400 shadow-[0_0_25px_rgba(0,255,0,0.5)]' : 'border-purple-500'} 
      bg-black`}
    >
      {/* Username with Badge */}
      <div className="absolute bottom-2 left-2 text-xs bg-black/70 px-2 py-1 rounded-full flex items-center gap-1">
        <span>{displayLabel}</span>
        {showBadges && userProfile && <UserBadge profile={userProfile} />}
      </div>

      {/* Mic Status */}
      {livekitParticipant && (
        <div className="absolute top-2 left-2 p-1 bg-black/50 rounded-full">
          {audioEnabled ? (
            <Mic size={14} className="text-green-400" />
          ) : (
            <MicOff size={14} className="text-red-400" />
          )}
        </div>
      )}

      {/* Host/Opponent Crown */}
      {(isHost || participant.role === 'host') && (
        <div className="absolute top-2 right-2 p-1 bg-yellow-500 rounded-full shadow-lg">
          <Crown size={14} className="text-white" />
        </div>
      )}

      {/* Gift Button */}
      {onGiftSend && userId && (
        <button
          onClick={() => onGiftSend(userId)}
          className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 p-2 rounded-full transition-colors"
          title={`Send gift to ${displayLabel}`}
        >
          <Gift size={16} className="text-white" />
        </button>
      )}
    </div>
  )
}
