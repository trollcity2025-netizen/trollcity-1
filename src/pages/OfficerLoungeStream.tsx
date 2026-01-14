import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from '../hooks/useLiveKit'
import { useLiveKitSession } from '../hooks/useLiveKitSession'
import { useSeatRoster } from '../hooks/useSeatRoster'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Video,
  Mic,
  Settings,
  Users,
} from 'lucide-react'

const TEXT_ENCODER = new TextEncoder()
const ROOM_NAME = 'officer-stream'
const SEAT_COUNT = 6

type ControlMessage = {
  type: 'admin-action'
  action: 'mute-all' | 'remove'
  seatIndex?: number
  initiatorId?: string
}

const OfficerLoungeStream: React.FC = () => {
  const { user, profile } = useAuthStore()
  const liveKit = useLiveKit()

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null)

  const {
    joinAndPublish,
    toggleCamera,
    toggleMicrophone,
  } = useLiveKitSession({
    roomName: ROOM_NAME,
    user: user ? { ...user, role: profile?.role || 'officer' } : null,
    role: 'officer',
    allowPublish: true,
    maxParticipants: SEAT_COUNT,
  })

  const { participants, localParticipant, service } = liveKit
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { seats, claimSeat, releaseSeat, isClaimingSeat } = useSeatRoster(ROOM_NAME)

  const [currentSeatIndex, setCurrentSeatIndex] = useState<number | null>(null)
  const [claimingSeat, setClaimingSeat] = useState<number | null>(null)
  const [permissionErrorSeat, setPermissionErrorSeat] = useState<number | null>(null)
  const [targetSeatIndex, setTargetSeatIndex] = useState<number | null>(null)
  const [, setEntranceEffectSeat] = useState<number | null>(null)
  const entranceEffectTimer = useRef<number | null>(null)

  const isAdmin = useMemo(
    () => Boolean(profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer),
    [profile]
  )

  const requestMediaAccess = useCallback(async () => {
    if (localMediaStream && localMediaStream.active) {
      return localMediaStream
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media devices API not available')
    }

    if (!window.isSecureContext) {
      throw new Error('Camera/microphone access requires a secure context')
    }

    try {
      console.log('[OfficerLoungeStream] Requesting camera & mic')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true
      })
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setLocalMediaStream(stream)
      return stream
    } catch (err: any) {
      console.error('[OfficerLoungeStream] getUserMedia failed:', err.name, err.message)
      throw err
    }
  }, [localMediaStream])

  const cleanupLocalStream = useCallback(() => {
    if (localMediaStream) {
      localMediaStream.getTracks().forEach((track) => track.stop())
      setLocalMediaStream(null)
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [localMediaStream])

  useEffect(() => {
    return () => {
      cleanupLocalStream()
    }
  }, [cleanupLocalStream])

  const renderSeats = useMemo(() => {
    return seats.map((seat, index) => ({
      seat,
      participant: seat?.user_id ? participants.get(seat.user_id) : undefined,
      index,
    }))
  }, [seats, participants])

  const targetSeatLabel = useMemo(() => {
    if (targetSeatIndex === null) return 'None'
    return `Seat ${targetSeatIndex + 1}`
  }, [targetSeatIndex])

  const handleSeatClaim = useCallback(
    async (index: number) => {
      if (claimingSeat !== null || currentSeatIndex !== null) return
      console.log(`[OfficerLoungeStream] Seat ${index + 1} clicked to join`)
      setClaimingSeat(index)
      setPermissionErrorSeat(null)

      try {
        console.log('[OfficerLoungeStream] Prompting for camera & microphone permissions')
        const stream = await requestMediaAccess()
        console.log('[OfficerLoungeStream] Permissions granted')

        const success = await claimSeat(index, {
          username: profile?.username || 'Anonymous',
          avatarUrl: profile?.avatar_url,
          role: profile?.role || 'officer',
          metadata: {},
        })

        if (!success) {
          throw new Error('Seat claim failed')
        }

        setCurrentSeatIndex(index)
        setEntranceEffectSeat(index)
        if (entranceEffectTimer.current) {
          window.clearTimeout(entranceEffectTimer.current)
        }
        entranceEffectTimer.current = window.setTimeout(() => {
          setEntranceEffectSeat(null)
          entranceEffectTimer.current = null
        }, 2800)

        console.log('[OfficerLoungeStream] Calling joinAndPublish with captured stream')
        const joined = await joinAndPublish(stream)
        if (!joined) {
          throw new Error('LiveKit join/publish failed')
        }
        console.log('[OfficerLoungeStream] LiveKit join/publish succeeded')
      } catch (err: any) {
        console.error('Failed to claim seat:', err)
        const permissionDenied = ['NotAllowedError', 'NotFoundError', 'SecurityError', 'PermissionDeniedError']
        if (permissionDenied.includes(err?.name)) {
          console.log('[OfficerLoungeStream] Permission denied, prompting banner')
          setPermissionErrorSeat(index)
          toast.error('Camera/Microphone blocked. Please enable permissions and try again.')
        } else {
          toast.error('Failed to join seat')
        }
      } finally {
        setClaimingSeat(null)
      }
    },
    [claimingSeat, currentSeatIndex, claimSeat, joinAndPublish, profile, requestMediaAccess]
  )

  const handleLeaveSeat = useCallback(async () => {
    if (currentSeatIndex === null) return
    try {
      await releaseSeat(currentSeatIndex)
      setCurrentSeatIndex(null)
    } catch (error) {
      console.error('Failed to leave seat:', error)
      toast.error('Failed to leave seat')
    }
  }, [currentSeatIndex, releaseSeat])

  const handleMuteAll = useCallback(async () => {
    if (!isAdmin || !service) return
    try {
      const room = service.getRoom()
      if (!room) return
      const data: ControlMessage = {
        type: 'admin-action',
        action: 'mute-all',
        initiatorId: user?.id,
      }
      await room.localParticipant.publishData(TEXT_ENCODER.encode(JSON.stringify(data)), { reliable: true })
      toast.success('Muted all participants')
    } catch (error) {
      console.error('Failed to mute all:', error)
      toast.error('Failed to mute all')
    }
  }, [isAdmin, service, user?.id])

  const handleRemove = useCallback(async () => {
    if (!isAdmin || targetSeatIndex === null || !service) return
    try {
      const room = service.getRoom()
      if (!room) return
      const data: ControlMessage = {
        type: 'admin-action',
        action: 'remove',
        seatIndex: targetSeatIndex,
        initiatorId: user?.id,
      }
      await room.localParticipant.publishData(TEXT_ENCODER.encode(JSON.stringify(data)), { reliable: true })
      toast.success(`Removed participant from seat ${targetSeatIndex + 1}`)
    } catch (error) {
      console.error('Failed to remove participant:', error)
      toast.error('Failed to remove participant')
    }
  }, [isAdmin, targetSeatIndex, service, user?.id])

  const handlePermissionRetry = useCallback(async () => {
    if (permissionErrorSeat === null) return
    const seatToRetry = permissionErrorSeat
    console.log(`[OfficerLoungeStream] Retrying permission prompt for seat ${seatToRetry + 1}`)
    setPermissionErrorSeat(null)
    await handleSeatClaim(seatToRetry)
  }, [permissionErrorSeat, handleSeatClaim])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03010c] via-[#05031a] to-[#110117] text-white">
      {permissionErrorSeat !== null && (
        <div className="fixed top-4 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-red-500/60 bg-red-500/90 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-red-500/50">
            <span className="flex-1 min-w-0 text-left">
              Camera/Microphone blocked. Please enable permissions and try again.
            </span>
            <button
              onClick={handlePermissionRetry}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="flex h-screen flex-col">
        <main className="flex-1 px-6 py-5">
          <section className="h-full rounded-[32px] border border-white/10 bg-gradient-to-b from-[#050113] to-[#0b091f] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Seat roster</p>
                <p className="text-sm text-white/70">Six seats · {participants.size} active</p>
              </div>
              <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white/70">
                Officers only
              </span>
            </div>
            <div className="h-full">
              <SeatGrid
                seats={renderSeats}
                onSeatClaim={handleSeatClaim}
                claimingSeat={claimingSeat}
                currentSeatIndex={currentSeatIndex}
                isAdmin={isAdmin}
                onTargetSeat={(idx) => setTargetSeatIndex(idx)}
                targetedSeatIndex={targetSeatIndex}
              />
              {/* Entrance effect is now rendered per-seat inside each SeatTile when targeted */}
            </div>
          </section>
        </main>

        <BottomControls
          micEnabled={localParticipant?.isMicrophoneEnabled ?? false}
          cameraEnabled={localParticipant?.isCameraEnabled ?? false}
          onToggleMic={toggleMicrophone}
          onToggleCam={toggleCamera}
          onLeaveSeat={handleLeaveSeat}
          currentSeatIndex={currentSeatIndex}
          isAdmin={isAdmin}
          onMuteAll={handleMuteAll}
          onRemove={handleRemove}
          targetLabel={targetSeatLabel}
        />
      </div>

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

type SeatGridProps = {
  seats: Array<{ seat: ReturnType<typeof useSeatRoster>['seats'][number]; participant?: any; index: number }>
  onSeatClaim: (index: number) => void
  claimingSeat: number | null
  currentSeatIndex: number | null
  isAdmin: boolean
  targetedSeatIndex: number | null
  onTargetSeat: (index: number) => void
}

const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  onSeatClaim,
  claimingSeat,
  currentSeatIndex,
  isAdmin,
  targetedSeatIndex,
  onTargetSeat,
}) => {
  return (
    <div className="mt-4 grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {seats.map(({ seat, participant, index }) => (
        <SeatTile
          key={`seat-${index}`}
          index={index}
          assignment={seat}
          participant={participant}
          onClaim={() => onSeatClaim(index)}
          isClaiming={claimingSeat === index}
          isCurrent={currentSeatIndex === index}
          isTargeted={targetedSeatIndex === index}
          isAdmin={isAdmin}
          onTarget={() => (isAdmin && seat ? onTargetSeat(index) : undefined)}
        />
      ))}
    </div>
  )
}

type SeatTileProps = {
  index: number
  assignment: ReturnType<typeof useSeatRoster>['seats'][number]
  participant?: any
  onClaim: () => void
  isClaiming: boolean
  isCurrent: boolean
  isTargeted: boolean
  isAdmin: boolean
  onTarget?: () => void
}

const SeatTile: React.FC<SeatTileProps> = ({
  index,
  assignment,
  participant,
  onClaim,
  isClaiming,
  isCurrent,
  isTargeted,
  isAdmin,
  onTarget,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const vTrack = participant?.videoTrack?.track
    const aTrack = participant?.audioTrack?.track
    const videoEl = videoRef.current
    const audioEl = audioRef.current

    if (vTrack && videoEl) {
      vTrack.attach(videoEl)
    }
    if (aTrack && audioEl) {
      aTrack.attach(audioEl)
    }

    return () => {
      try {
        if (vTrack && videoEl) vTrack.detach(videoEl)
      } catch {}
      try {
        if (aTrack && audioEl) aTrack.detach(audioEl)
      } catch {}
    }
  }, [participant?.videoTrack?.track, participant?.audioTrack?.track])

  const micActive = participant?.isMicrophoneEnabled ?? false
  const camActive = participant?.isCameraEnabled ?? false

  const avatarLabel =
    assignment?.avatar_url ??
    (assignment?.username
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(assignment.username)}&background=2d0c3c&color=ffffff`
      : null)

  const borderState = isCurrent
    ? 'border-cyan-400 shadow-[0_0_35px_rgba(85,244,255,0.35)] ring-1 ring-cyan-200/70'
    : isTargeted
    ? 'border-pink-400 shadow-[0_0_25px_rgba(214,127,255,0.5)]'
    : 'border-purple-500/30'

  const showVideo = Boolean(assignment && participant?.videoTrack?.track)

  return (
    <div
      className={`relative flex h-56 flex-col overflow-hidden rounded-[28px] border ${borderState} bg-gradient-to-br from-white/5 to-black/40 text-white transition`}>
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] uppercase tracking-[0.4em] text-purple-300">
        <span>Seat {index + 1}</span>
      </div>

      {assignment ? (
        <div className="relative flex flex-1 flex-col justify-between">
          <div className="absolute inset-4 overflow-hidden rounded-[22px] border border-white/5 bg-black/60">
            {showVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isCurrent}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/70 text-xs uppercase tracking-[0.3em]">
                Waiting for video...
              </div>
            )}
            <audio ref={audioRef} autoPlay />
          </div>

          {/* Per-seat entrance effect (only visible when this seat is targeted) */}
          {isTargeted && <EntranceEffectScreenOverlay seat={assignment} seatIndex={index} />}

          <div className="relative z-10 flex flex-col gap-2 p-4">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.4em] text-white">
              {avatarLabel ? (
                <img
                  src={avatarLabel}
                  alt={assignment.username}
                  className="h-6 w-6 rounded-full border border-white/30 object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs">
                  {assignment.username?.charAt(0) ?? 'T'}
                </div>
              )}
              <span>{assignment.username}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-gray-300">
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">{assignment.role}</span>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${micActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`h-2 w-2 rounded-full ${camActive ? 'bg-cyan-400' : 'bg-red-400'}`} />
              </div>
            </div>
          </div>

          {isCurrent && (
            <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white">
              You
            </div>
          )}

          {isAdmin && onTarget && (
            <button
              onClick={onTarget}
              className="absolute top-3 right-3 rounded-full border border-white/30 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.4em] text-white transition hover:border-pink-400"
            >
              Target
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onClaim}
          disabled={isClaiming}
          className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-purple-500/40 bg-black/60 px-4 py-6 text-center text-sm uppercase tracking-[0.3em] text-gray-200 transition hover:border-white/50 disabled:opacity-60"
        >
          <Video className="h-6 w-6 text-purple-300" />
          <span>{isClaiming ? 'Joining...' : 'Click to join'}</span>
        </button>
      )}
    </div>
  )
}

const BottomControls: React.FC<{
  micEnabled: boolean
  cameraEnabled: boolean
  onToggleMic?: () => void
  onToggleCam?: () => void
  onLeaveSeat: () => void
  currentSeatIndex: number | null
  isAdmin: boolean
  onMuteAll: () => void
  onRemove: () => void
  targetLabel: string
}> = ({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCam,
  onLeaveSeat,
  currentSeatIndex,
  isAdmin,
  onMuteAll,
  onRemove,
  targetLabel,
}) => {
  const isSeated = currentSeatIndex !== null

  return (
    <div className="border-t border-purple-600/40 bg-black/70 p-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => isSeated && onToggleMic?.()}
          disabled={!isSeated}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition disabled:opacity-50"
        >
          <Mic className={`inline h-4 w-4 ${micEnabled ? 'text-emerald-300' : 'text-red-400'}`} />{' '}
          {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
        </button>

        <button
          onClick={() => isSeated && onToggleCam?.()}
          disabled={!isSeated}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white transition disabled:opacity-50"
        >
          <Video className={`inline h-4 w-4 ${cameraEnabled ? 'text-cyan-300' : 'text-red-400'}`} />{' '}
          {cameraEnabled ? 'Camera On' : 'Camera Off'}
        </button>

        <button
          onClick={onLeaveSeat}
          disabled={!isSeated}
          className="rounded-full border border-red-500/80 bg-red-500/30 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:bg-red-500/50 disabled:opacity-50"
        >
          Leave Seat
        </button>

        {isAdmin && (
          <>
            <button
              onClick={onMuteAll}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white"
            >
              <Users className="inline h-4 w-4 text-white" /> Mute All
            </button>

            <button
              onClick={onRemove}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-white"
            >
              <Settings className="inline h-4 w-4 text-white" /> Remove
            </button>
          </>
        )}
      </div>

      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.3em] text-white/60">
        Target Seat: {targetLabel}
      </p>
    </div>
  )
}

const EntranceEffectScreenOverlay: React.FC<{
  seat: ReturnType<typeof useSeatRoster>['seats'][number]
  seatIndex: number
}> = ({ seat, seatIndex }) => {
  const displayName = seat?.username || `Seat ${seatIndex + 1}`

  return (
    <div className="pointer-events-none absolute inset-4 z-0 flex flex-col items-center justify-center gap-3 rounded-[18px] bg-transparent text-center text-white">
      <div className="text-[10px] uppercase tracking-[0.6em] text-purple-200">Entrance Effects</div>
      <h3 className="text-3xl font-bold uppercase tracking-[0.3em]">{displayName}</h3>
      <div className="text-sm uppercase tracking-[0.4em] text-pink-300">Activated</div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, index) => (
          <span
            key={`entrance-confetti-${index}`}
            className="h-1 w-1 rounded-full bg-gradient-to-r from-purple-300 to-pink-400 animate-[pulse_1.2s_infinite]"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default OfficerLoungeStream
