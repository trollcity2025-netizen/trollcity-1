import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import { Mic, Video } from 'lucide-react'
import { useSeatRoster, type SeatAssignment } from '../hooks/useSeatRoster'
import { useLiveKit } from '../hooks/useLiveKit'
import { LiveKitParticipant } from '../lib/LiveKitService'
import { useAuthStore } from '../lib/store'

interface OfficerStreamGridProps {
  roomName?: string
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
  roomName = 'officer-stream',
  onSeatClick,
}) => {
  const { seats, claimSeat, releaseSeat } = useSeatRoster(roomName)
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

    // auto-connect to the provided roomName so boxes can be claimed immediately
    connect(roomName, liveKitUser, { allowPublish: true, autoPublish: false })
  }, [liveKitUser, connect, roomName])

  const handleSeatAction = useCallback(async (action: 'claim' | 'release' | 'leave', seatIndex: number, seat?: SeatAssignment) => {
    if (action === 'claim' && profile) {
      // Validate authentication before attempting to connect
      if (!user?.id) {
        alert('Please sign in to join the stream.')
        return
      }

      try {
        console.log('Requesting camera and microphone permissions...')
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Media devices API not available')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        console.log('Permissions granted, claiming seat with active stream...', {
          streamActive: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        })

        await claimSeat(seatIndex, {
          username: profile.username || 'Officer',
          avatarUrl: profile.avatar_url,
          role: 'officer',
        })

        console.log('Claim successful, connecting to LiveKit with stream...')
        
        // ✅ Disconnect if already connected, then reconnect with the media stream as preflightStream
        if (isConnected) {
          console.log('Disconnecting to reconnect with media stream...')
          disconnect()
          // Wait a moment for disconnect to complete
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        // Connect with the media stream as preflightStream
        const connectOk = await connect(roomName, liveKitUser, { 
          allowPublish: true, 
          autoPublish: false,
          preflightStream: stream 
        })
        
        if (!connectOk) {
          throw new Error('Failed to connect to LiveKit with stream')
        }
        
        console.log('Connected to LiveKit, starting to publish...', { startPublishing: typeof startPublishing })
        if (typeof startPublishing === 'function') {
          try {
            await startPublishing()
            console.log('✅ Publishing started successfully')
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
  }, [profile, claimSeat, releaseSeat, disconnect, startPublishing, isConnected, connect, roomName, user, liveKitUser])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-2">
      {seats.map((seat, index) => {
        const participant = participantsList?.find((p) => {
          if (!seat?.user_id) return false
          if (p.identity === seat.user_id) return true
          const metadataUserId = parseLiveKitMetadataUserId(p.metadata)
          return metadataUserId === seat.user_id
        })
        const isSpeaking = Boolean((participant as any)?.audioLevel > 0.05 || (participant as any)?.isSpeaking);
        return (
          <OfficerStreamBox
            key={index}
            seatIndex={index}
            seat={seat}
            participant={participant}
            user={user}
            onClaimClick={() => { if (seat) { onSeatClick?.(index, seat) } }}
            onSeatAction={(action) => handleSeatAction(action, index, seat)}
            data-speaking={isSpeaking}
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
  children?: React.ReactNode
  onClaimClick: () => void
  onSeatAction: (action: 'claim' | 'release' | 'leave') => Promise<void>
}

const OfficerStreamBox: React.FC<OfficerStreamBoxProps & { [k: string]: any }> = ({
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

  const isSpeaking = Boolean((participant as any)?.audioLevel > 0.05 || (participant as any)?.isSpeaking)
  const wrapperClass = `relative w-full aspect-video md:aspect-video rounded-2xl overflow-hidden rgb-border ${isSpeaking ? 'speaking' : ''}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={!seat ? () => onSeatAction('claim') : onClaimClick}
      onKeyDown={handleKeyDown}
      className={wrapperClass}
    >
      <div className="tile-inner relative w-full h-full">
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
            <div className="mb-2 text-lg font-semibold">{seat.username || 'User'}</div>
            <div className="text-xs uppercase tracking-[0.4em]">
              {seat.user_id === user?.id ? 'You' : 'Connected'}
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

        {seat && (
          <div className="absolute top-3 right-3 flex gap-2">
            {seat.user_id === user?.id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSeatAction('leave');
                }}
                className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-bold hover:bg-red-700"
                title="Leave seat"
              >
                ×
              </button>
            ) : (
              <>
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
              </>
            )}
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

        {/* children removed - like button moved to BroadcastPage under the grid */}
      </div>
    </div>
  )
}

export { OfficerStreamGrid }
