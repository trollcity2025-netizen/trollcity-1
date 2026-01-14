import React, { useEffect, useRef } from 'react'
import { Participant, Track } from 'livekit-client'
import { Gift } from 'lucide-react'

export interface StreamParticipant {
  userId: string
  role: 'host' | 'opponent' | 'guest'
  userProfile?: {
    username: string
    avatar_url?: string
    rgb_username_expires_at?: string
  }
  identity?: string
  // Optional LiveKit participant reference if available
  lkParticipant?: Participant
}

interface VideoBoxProps {
  participant: StreamParticipant | Participant | null
  size?: 'full' | 'small' | 'medium'
  label?: string
  isHost?: boolean
  onGiftSend?: (targetId: string) => void
}

export default function VideoBox({ 
  participant, 
  size: _size = 'medium', 
  label, 
  isHost, 
  onGiftSend 
}: VideoBoxProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!participant || !videoElement) return

    let track: Track | undefined

    // Check if it's a LiveKit Participant
    if ('getTrackPublication' in participant) {
      const p = participant as Participant
      const pub = p.getTrackPublication(Track.Source.Camera)
      if (pub?.track) {
        track = pub.track
      }
    } 
    // Check if it's our custom StreamParticipant with a linked LiveKit participant
    else if ('lkParticipant' in participant && participant.lkParticipant) {
      const p = participant.lkParticipant
      const pub = p.getTrackPublication(Track.Source.Camera)
      if (pub?.track) {
        track = pub.track
      }
    }

    if (track) {
      track.attach(videoElement)
    }

    return () => {
      if (track) {
        track.detach(videoElement)
      }
    }
  }, [participant])

  // Determine display label
  const displayLabel = label || 
    (participant && 'userProfile' in participant ? participant.userProfile?.username : 
     participant && 'identity' in participant ? (participant as Participant).identity : 'Unknown')

  // Determine RGB status
  const hasRgbUsername = participant && 'userProfile' in participant && 
    participant.userProfile?.rgb_username_expires_at && 
    new Date(participant.userProfile.rgb_username_expires_at) > new Date();

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden rounded-xl">
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover" 
        playsInline 
        autoPlay 
        muted={isHost} // Mute if it's the local host to avoid echo
      />
      
      {/* Label Overlay */}
      <div className={`absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm ${hasRgbUsername ? 'rgb-username font-bold' : ''}`}>
        {displayLabel}
      </div>

      {/* Gift Button */}
      {onGiftSend && participant && (
        <button
          onClick={() => {
            const id = 'userId' in participant ? participant.userId : (participant as Participant).identity
            if (id) onGiftSend(id)
          }}
          className="absolute bottom-2 right-2 p-2 bg-pink-500 hover:bg-pink-600 rounded-full text-white transition-colors"
        >
          <Gift className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
