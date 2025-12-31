import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from '../hooks/useLiveKit'
import { LiveKitParticipant } from '../lib/LiveKitService'
import { UserRole } from './LiveKitRoles'

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

  const visibleParticipants = useMemo(() => {
    const allParticipants = Array.from(participants.values())

    // Local participant first if requested
    if (showLocalVideo && localParticipant) {
      const alreadyInList = allParticipants.some(
        (p) => p.identity === localParticipant.identity
      )
      if (!alreadyInList) {
        allParticipants.unshift(localParticipant)
      }
    }

    return allParticipants.slice(0, maxParticipants)
  }, [participants, localParticipant, showLocalVideo, maxParticipants])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 h-full">
      {visibleParticipants.map((participant) => (
        <ParticipantVideo key={participant.identity} participant={participant} />
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
      try {
        videoTrack.attach(videoRef.current)
      } catch (e) {
        console.warn('Video attach failed:', e)
      }
    }

    if (audioTrack && audioRef.current) {
      try {
        audioTrack.attach(audioRef.current)
      } catch (e) {
        console.warn('Audio attach failed:', e)
      }
    }

    return () => {
      try {
        if (videoTrack && videoRef.current) {
          videoTrack.detach(videoRef.current)
        }
      } catch (e) {
        console.warn('Video detach failed:', e)
      }

      try {
        if (audioTrack && audioRef.current) {
          audioTrack.detach(audioRef.current)
        }
      } catch (e) {
        console.warn('Audio detach failed:', e)
      }
    }
  }, [participant.videoTrack?.track, participant.audioTrack?.track])

  const displayName = participant.name || participant.identity

  return (
    <div className="relative rounded-lg overflow-hidden aspect-video border border-white/10 bg-[#04000b] shadow-[0_0_40px_rgba(0,0,0,0.55)]">
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
            <div className="text-sm font-semibold">{displayName}</div>
            <div className="text-xs opacity-70 mt-1">Waiting for video…</div>
          </div>
        </div>
      )}

      {/* audio always exists as element so remote audio can play */}
      <audio ref={audioRef} autoPlay />

      <div className="absolute bottom-2 left-2 text-white text-xs bg-black/40 px-2 py-1 rounded flex items-center gap-2">
        <span className="font-semibold">{displayName}</span>
        <span>{participant.isMicrophoneEnabled ? '🎤' : '🔇'}</span>
        <span>{participant.isCameraEnabled ? '📷' : '🚫'}</span>
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
  role?: UserRole | 'viewer' | 'broadcaster'
  allowPublish?: boolean
  autoConnect?: boolean
  children?: React.ReactNode
}

/**
 * Drop-in replacement for your existing wrapper.
 *
 * IMPORTANT:
 * - It will connect ONLY when roomName + identity exist.
 * - It will retry connect if those values load later.
 * - It will auto-publish if allowed and autoPublish is enabled.
 */
export function LiveKitRoomWrapper({
  roomName,
  identity,
  children,
  className = '',
  showLocalVideo = true,
  maxParticipants = 6,
  role = 'viewer',
  allowPublish = true,
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
     ROLE CHECK (UI INTENT)
  ======================= */
  const roleAllowsPublish =
    role === UserRole.ADMIN ||
    role === UserRole.MODERATOR ||
    role === UserRole.TROLL_OFFICER ||
    role === UserRole.LEAD_TROLL_OFFICER ||
    role === 'broadcaster'

  /**
   * IMPORTANT:
   * We DO NOT try to read token permissions from localParticipant because
   * LiveKit doesn't expose them that way reliably.
   *
   * TRUE permission enforcement must happen on the token endpoint.
   * If token forbids publishing, startPublishing() will fail.
   */
  const canAttemptPublish = roleAllowsPublish

  const isAlreadyPublishing =
    !!localParticipant?.videoTrack?.track || !!localParticipant?.audioTrack?.track

  const handleStartPublishing = async () => {
    if (!canAttemptPublish || isAlreadyPublishing) return

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
     CONNECT (FIXED)
     - waits for identity+roomName
     - retries if they load after initial render
  ======================= */
  useEffect(() => {
    if (!autoConnect) return
    if (!roomName || !identity) return

    // Only connect once per identity+roomName combo
    const connectKey = `${roomName}:${identity}:${role}`
    if ((didConnectRef.current as any) === connectKey) return

    ;(didConnectRef.current as any) = connectKey

    connect(roomName, identity, {
      allowPublish,
      role,
    } as any).catch((err) => {
      console.error('LiveKit connect failed:', err)
      // allow retry
      didConnectRef.current = false as any
    })
  }, [autoConnect, roomName, identity, role, allowPublish, connect])

  /* =======================
     AUTO-PUBLISH
  ======================= */
  useEffect(() => {
    if (!isConnected) return
    if (!allowPublish) return
    if (!canAttemptPublish) return
    if (isAlreadyPublishing) return
    if (isPublishing) return

    startPublishing().catch((err) => {
      console.error('Auto publish failed:', err)
    })
  }, [isConnected, allowPublish, canAttemptPublish, isAlreadyPublishing])

  /* =======================
     STATES
  ======================= */
  if (!roomName || !identity) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white">
          <div className="text-sm opacity-80">Preparing live room…</div>
          <div className="text-xs opacity-50 mt-2">
            Waiting for room + user identity…
          </div>
        </div>
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2" />
          <div className="text-sm">Connecting to stream…</div>
          <div className="text-xs opacity-60 mt-1">
            Room: {roomName}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-black border-2 border-red-500 ${className}`}
      >
        <div className="text-center text-red-400 p-4">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-sm font-semibold">LiveKit Error</div>
          <div className="text-xs opacity-80 mt-2 max-w-md break-words">
            {error}
          </div>
          <div className="text-xs opacity-60 mt-3">
            Room: {roomName}
          </div>
        </div>
      </div>
    )
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className={className}>
      <VideoGrid showLocalVideo={showLocalVideo} maxParticipants={maxParticipants} />

      {/* Manual publish button if connected, allowed, but not yet publishing */}
      {isConnected && canAttemptPublish && !isAlreadyPublishing && (
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

      {/* Viewer notice */}
      {isConnected && !canAttemptPublish && (
        <div className="mt-4 text-center text-gray-400">
          You are viewing this stream as a spectator.
        </div>
      )}

      {children}
    </div>
  )
}
