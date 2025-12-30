import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import { Mic, Video } from 'lucide-react'
import { useSeatRoster, type SeatAssignment } from '../hooks/useSeatRoster'
import { useLiveKit } from '../hooks/useLiveKit'
import { LiveKitParticipant } from '../lib/LiveKitService'
import { useAuthStore } from '../lib/store'

interface OfficerStreamGridProps {
  onSeatClick?: (seatIndex: number, seat: SeatAssignment) => void
}

const parseLiveKitMetadataUserId = (metadata?: string): string | undefined => {
  if (!metadata) return undefined
  try {
    const parsed = JSON.parse(metadata)
    if (typeof parsed?.user_id === 'string') {
      return parsed.user_id
    }
  } catch {
    // ignore invalid metadata
  }
  return undefined
}

const OfficerStreamGrid: React.FC<OfficerStreamGridProps> = ({
  onSeatClick,
}) => {
  const { seats, claimSeat, releaseSeat } = useSeatRoster()
  const { user, profile } = useAuthStore()

  const liveKitUser = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'Officer',
      role: profile?.role || 'viewer',
      level: profile?.level ?? 1,
    }
  }, [user, profile])

  const { participants, disconnect, startPublishing, connect, isConnected } = useLiveKit()

  const participantsList = useMemo(() => Array.from(participants.values()), [participants])

  useEffect(() => {
    if (!liveKitUser) return

    connect('officer-stream', liveKitUser, { allowPublish: true, autoPublish: false })
  }, [liveKitUser, connect])

  const handleSeatAction = useCallback(async (action: 'claim' | 'release' | 'leave', seatIndex: number, seat?: SeatAssignment) => {
    if (action === 'claim' && profile) {
      if (!isConnected) {
        alert('Please wait for the stream to connect before claiming a seat.')
        return
      }

      try {
        console.log('Requesting camera and microphone permissions...')
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Media devices API not available')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        console.log('Permissions granted, stopping test stream...')
        stream.getTracks().forEach(track => track.stop())
        console.log('Test stream stopped, claiming seat...')

        await claimSeat(seatIndex, {
          username: profile.username || 'Officer',
          avatarUrl: profile.avatar_url,
          role: 'officer',
        })

        console.log('Claim successful, starting to publish...', { startPublishing: typeof startPublishing })
        if (typeof startPublishing === 'function') {
          try {
            await startPublishing()
          } catch (e: any) {
            console.error('Failed to start publishing:', e.message)
            alert('Failed to start publishing. Please try again.')
          }
        } else {
          console.error('startPublishing is not a function', startPublishing)
        }
      } catch (err: any) {
        console.error('Permission denied:', err)
        alert('Camera and microphone access is required to join the officer stream. Please allow permissions and try again.')
        return
      }
    } else if (action === 'release' && seat) {
      await releaseSeat(seatIndex, seat.user_id)
    } else if (action === 'leave') {
      if (seat) {
        await releaseSeat(seatIndex, seat.user_id)
      }
      disconnect()
    }
  }, [profile, claimSeat, releaseSeat, disconnect, startPublishing, isConnected])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {seats.map((seat, index) => {
        const participant = participantsList?.find((p) => {
          if (!seat?.user_id) return false
          if (p.identity === seat.user_id) return true
          const metadataUserId = parseLiveKitMetadataUserId(p.metadata)
          return metadataUserId === seat.user_id
        })
        return (
          <OfficerStreamBox
            key={index}
            seatIndex={index}
            seat={seat}
            participant={participant}
            user={user}
            onClaimClick={() => {
              if (seat) {
                onSeatClick?.(index, seat)
              }
            }}
            onSeatAction={(action) => handleSeatAction(action, index, seat)}
          />
        )
      })}
    </div>
  )
}

interface OfficerStreamBoxProps {
  seatIndex: number
  seat: SeatAssignment
  participant?: LiveKitParticipant
  user?: any
  onClaimClick: () => void
  onSeatAction: (action: 'claim' | 'release' | 'leave') => Promise<void>
}

const OfficerStreamBox: React.FC<OfficerStreamBoxProps> = ({
  seat,
  participant,
  user,
  onClaimClick,
  onSeatAction,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  React.useEffect(() => {
    if (!participant) return

    const videoTrack = participant.videoTrack?.track
    const audioTrack = participant.audioTrack?.track

    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current)
    }

    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current)
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
  }, [participant?.videoTrack?.track, participant?.audioTrack?.track])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClaimClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={!seat ? () => onSeatAction('claim') : onClaimClick}
      onKeyDown={handleKeyDown}
      className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-purple-500/60 bg-gradient-to-br from-purple-900 to-indigo-900 shadow-[0_0_25px_rgba(14,165,233,0.35)]"
    >
      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
        {participant && seat && participant.videoTrack?.track ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <audio ref={audioRef} autoPlay />
          </>
        ) : seat ? (
          <div className="text-center text-white">
            <div className="mb-2 text-lg font-semibold">{seat.username || 'Officer'}</div>
            <div className="text-xs uppercase tracking-[0.4em]">
              Connecting...
            </div>
            {seat.user_id === user?.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSeatAction('leave')
                }}
                className="mt-2 w-8 h-8 rounded-full bg-red-600 text-white text-lg font-bold hover:bg-red-700 transition flex items-center justify-center"
                title="Leave stream"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <div className="text-white flex flex-col items-center gap-2">
            <div className="text-3xl font-bold">+</div>
            <div className="text-sm font-semibold">Click to Join</div>
          </div>
        )}
      </div>

      {seat && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
          <Mic className={`w-4 h-4 ${participant?.isMicrophoneEnabled ? 'text-emerald-400' : 'text-red-500'}`} />
          <Video className={`w-4 h-4 ${participant?.isCameraEnabled ? 'text-cyan-400' : 'text-red-500'}`} />
        </div>
      )}

      {seat && seat.user_id === user?.id && (
        <div className="absolute inset-x-4 bottom-16 flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSeatAction('leave')
            }}
            className="w-full max-w-[160px] rounded-full border border-red-500/60 bg-red-600/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-red-500"
          >
            Leave Seat
          </button>
        </div>
      )}

      {seat && (
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSeatAction('release')
            }}
            className="text-xs font-semibold text-white opacity-0 hover:opacity-100 transition-opacity"
          >
            Release
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSeatAction('leave')
            }}
            className="text-xs font-semibold text-white opacity-0 hover:opacity-100 transition-opacity"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  )
}

export { OfficerStreamGrid }
