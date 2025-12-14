import React, { useEffect, useRef, useState } from 'react'
import { useLiveKit } from '../contexts/LiveKitContext'
import { LiveKitParticipant } from '../lib/LiveKitService'

// Fallback UserRole enum in case the module doesn't exist or type declarations are missing.
// If you have a shared UserRole enum elsewhere, replace this with the correct import.
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  TROLL_OFFICER = 'troll_officer',
  LEAD_TROLL_OFFICER = 'lead_troll_officer',
}

/* =======================
   VideoGrid
======================= */

interface VideoGridProps {
  showLocalVideo?: boolean
  maxParticipants?: number
}

const VideoGrid: React.FC<VideoGridProps> = ({
  showLocalVideo = true,
  maxParticipants = 6,
}) => {
  const { participants, localParticipant } = useLiveKit()

  const allParticipants = Array.from(participants.values())

  if (showLocalVideo && localParticipant) {
    allParticipants.unshift(localParticipant)
  }

  const visibleParticipants = allParticipants.slice(0, maxParticipants)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 h-full">
      {visibleParticipants.map((participant) => (
        <ParticipantVideo
          key={participant.identity}
          participant={participant}
        />
      ))}
    </div>
  )
}

/* =======================
   ParticipantVideo
======================= */

interface ParticipantVideoProps {
  participant: LiveKitParticipant
}

const ParticipantVideo: React.FC<ParticipantVideoProps> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const videoTrack = participant.videoTrack?.track
    const audioTrack = participant.audioTrack?.track

    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current)
    }

    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current)
    }

    return () => {
      if (videoTrack && videoRef.current) {
        videoTrack.detach(videoRef.current)
      }
      if (audioTrack && audioRef.current) {
        audioTrack.detach(audioRef.current)
      }
    }
  }, [participant.videoTrack?.track, participant.audioTrack?.track])

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {participant.videoTrack?.track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div className="text-sm">
              {participant.name || participant.identity}
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} autoPlay />

      <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
        {participant.name || participant.identity}
        {participant.isMicrophoneEnabled ? ' 🎤' : ' 🔇'}
      </div>
    </div>
  )
}

/* =======================
   LiveKitRoomWrapper
======================= */

interface LiveKitRoomWrapperProps {
  roomName: string
  identity: string
  className?: string
  showLocalVideo?: boolean
  maxParticipants?: number
  role?: UserRole | 'viewer'
  autoConnect?: boolean
  children?: React.ReactNode
}

export function LiveKitRoomWrapper({
  roomName,
  identity,
  children,
  className = '',
  showLocalVideo = true,
  maxParticipants = 6,
  role = 'viewer',
  autoConnect = true,
}: LiveKitRoomWrapperProps) {
  const {
    connect,
    isConnected,
    isConnecting,
    error,
    startPublishing,
    localParticipant,
  } = useLiveKit()

  const [isPublishing, setIsPublishing] = useState(false)
  const didConnectRef = useRef(false)

  /* =======================
     ROLE INTENT (UI ONLY)
  ======================= */
  const roleAllowsPublish =
    role === UserRole.ADMIN ||
    role === UserRole.MODERATOR ||
    role === UserRole.TROLL_OFFICER ||
    role === UserRole.LEAD_TROLL_OFFICER

  /* =======================
     TOKEN PERMISSION (TRUTH)
  ======================= */
  const tokenAllowsPublish =
    (localParticipant as any)?.permissions?.canPublish !== false &&
    (localParticipant as any)?.participantInfo?.permissions?.canPublish !== false

  const canPublish = roleAllowsPublish && tokenAllowsPublish

  const isAlreadyPublishing =
    !!localParticipant?.videoTrack?.track ||
    !!localParticipant?.audioTrack?.track

  const handleStartPublishing = async () => {
    if (!canPublish || isAlreadyPublishing) return

    setIsPublishing(true)
    try {
      await startPublishing()
    } catch (err) {
      console.error('Failed to start publishing:', err)
    } finally {
      setIsPublishing(false)
    }
  }

  /* =======================
     CONNECT (PASS ROLE)
  ======================= */
  useEffect(() => {
    if (!autoConnect) return
    if (didConnectRef.current) return

    didConnectRef.current = true

    // `role` is not part of the declared LiveKitServiceConfig type; cast options to `any`
    // so the runtime value is still passed through without a type error.
    connect(roomName, identity, {
      autoPublish: true,
      role,
    } as any).catch((err) => {
      console.error('LiveKit connect failed:', err)
      didConnectRef.current = false
    })
  }, [])

  /* =======================
     AUTO-PUBLISH
  ======================= */
  useEffect(() => {
    if (!isConnected) return
    if (!canPublish) return
    if (isAlreadyPublishing) return

    startPublishing().catch(console.error)
  }, [isConnected, canPublish, isAlreadyPublishing])

  /* =======================
     STATES
  ======================= */
  if (isConnecting) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2" />
          <div className="text-sm">Connecting to stream…</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black border-2 border-red-500 ${className}`}>
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className={className}>
      <VideoGrid
        showLocalVideo={showLocalVideo}
        maxParticipants={maxParticipants}
      />

      {isConnected && canPublish && !isAlreadyPublishing && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleStartPublishing}
            disabled={isPublishing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            {isPublishing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Starting…
              </>
            ) : (
              <>📹🎤 Start Camera & Mic</>
            )}
          </button>
        </div>
      )}

      {isConnected && !canPublish && (
        <div className="mt-4 text-center text-gray-400">
          You are viewing this stream as a spectator.
        </div>
      )}

      {children}
    </div>
  )
}
