import React, { useMemo, useRef, useCallback, useState } from 'react'
import { Mic, Video } from 'lucide-react'
import { useSeatRoster, type SeatAssignment } from '../hooks/useSeatRoster'
import { useLiveKit } from '../hooks/useLiveKit'
import { useLiveKitSession } from '../hooks/useLiveKitSession'
import { LiveKitParticipant } from '../lib/LiveKitService'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

interface OfficerStreamGridProps {
  roomName?: string
  onSeatClick?: (seatIndex: number, seat: SeatAssignment) => void
  streamId?: string
  activeBoxId?: string | null
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
  streamId,
  activeBoxId,
}) => {
  const { seats, claimSeat, releaseSeat } = useSeatRoster(roomName)
  const { user, profile } = useAuthStore()

  // Track claimed seats optimistically
  const [claimedSeats, setClaimedSeats] = useState<Set<number>>(new Set())
  
  // LiveKit integration - same pattern as BroadcastPage
  const liveKit = useLiveKit()
  const liveKitUser = useMemo(() => {
    if (!user) return null
    return {
      ...user,
      identity: (user as any).identity || user.id || profile?.id,
      role: profile?.role || 'broadcaster',
      level: profile?.level ?? 1,
    }
  }, [user, profile])

  // Use useLiveKitSession hook like BroadcastPage - handles token flow properly
  const hasValidRoomName = !!roomName && typeof roomName === 'string' && roomName.trim() !== ''
  const sessionReady = !!user && !!profile && hasValidRoomName

  const {
    joinAndPublish,
    disconnect,
  } = useLiveKitSession({
    roomName: sessionReady && hasValidRoomName ? roomName : '', // Empty roomName prevents connection attempts
    user: sessionReady && liveKitUser ? liveKitUser : null,
    role: 'broadcaster',
    allowPublish: sessionReady,
    maxParticipants: 9, // Officer stream has 9 seats
  })

  const { participants, localParticipant } = liveKit
  const participantsList = useMemo(() => Array.from(participants.values()), [participants])

  // Listen for stream end events and redirect
  React.useEffect(() => {
    if (!streamId) return
    
    const channel = supabase
      .channel(`stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newRecord = payload.new as any
          if (newRecord?.status === 'ended' || newRecord?.is_live === false) {
            console.log('[OfficerStreamGrid] Stream ended detected, redirecting to summary...')
            window.location.href = `/stream-summary/${streamId}`
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [streamId])

  const handleSeatAction = useCallback(async (action: 'claim' | 'release' | 'leave', seatIndex: number, seat?: SeatAssignment) => {
    // ✅ NEW: Prevent multiple box joins
    const boxId = `seat-${seatIndex}`;
    if (action === 'claim' && profile) {
      if (activeBoxId && activeBoxId !== boxId) {
        console.log('[OfficerStreamGrid] User already in box:', activeBoxId, 'blocking join of:', boxId);
        alert('You are already in a box. Please leave first.');
        return;
      }
      
      // If already in this box, don't join again
      if (activeBoxId === boxId) {
        console.log('[OfficerStreamGrid] Already in box:', boxId);
        return;
      }
      
      // Validate authentication before attempting to connect
      if (!user?.id) {
        alert('Please sign in to join the stream.')
        return
      }

      // Optimistically update UI to show claiming state
      setClaimedSeats(prev => new Set([...prev, seatIndex]))
      
      try {
        console.log('[OfficerStreamGrid] Requesting camera and microphone permissions...')
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Media devices API not available')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        console.log('[OfficerStreamGrid] Permissions granted, claiming seat with active stream...', {
          streamActive: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        })

        await claimSeat(seatIndex, {
          username: profile.username || 'Officer',
          avatarUrl: profile.avatar_url,
          role: 'officer',
        })

        console.log('[OfficerStreamGrid] Claim successful, connecting to LiveKit with stream...')
         
        // ✅ Use joinAndPublish from useLiveKitSession (same as BroadcastPage)
        // This handles token flow properly via Vercel
        try {
          // ✅ Check session before joinAndPublish (same pattern as BroadcastPage)
          const { data: sessionData } = await supabase.auth.getSession()
          if (!sessionData.session) {
            console.log("[OfficerStreamGrid] No session yet — skipping joinAndPublish")
            throw new Error('No active session. Please sign in again.')
          }
          
          if (!roomName || !user?.id || !profile?.id) {
            console.log("[OfficerStreamGrid] Missing requirements — skipping joinAndPublish", {
              roomName,
              hasUser: !!user,
              hasProfile: !!profile
            })
            throw new Error('Missing required information to join stream')
          }

          console.log('[OfficerStreamGrid] Calling joinAndPublish with stream', {
            streamActive: stream?.active,
            videoTracks: stream?.getVideoTracks().length || 0,
            audioTracks: stream?.getAudioTracks().length || 0,
            videoTrackEnabled: stream?.getVideoTracks()[0]?.enabled,
            audioTrackEnabled: stream?.getAudioTracks()[0]?.enabled
          })
          await joinAndPublish(stream)
          console.log('[OfficerStreamGrid] ✅ Publishing started successfully')
        } catch (liveKitErr: any) {
          // Extract the real error message from LiveKit join attempt
          const actualError = liveKitErr?.message || 'LiveKit join failed'
          console.error('[OfficerStreamGrid] LiveKit join error details:', actualError)
          
          // Remove optimistic claim on error
          setClaimedSeats(prev => {
            const newSet = new Set(prev)
            newSet.delete(seatIndex)
            return newSet
          })
          
          throw new Error(actualError)
        }
      } catch (err: any) {
        console.error('[OfficerStreamGrid] Permission denied:', err)
        
        // Remove optimistic claim on error
        setClaimedSeats(prev => {
          const newSet = new Set(prev)
          newSet.delete(seatIndex)
          return newSet
        })
        
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
  }, [profile, claimSeat, releaseSeat, disconnect, joinAndPublish, roomName, user, liveKitUser, activeBoxId])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-2">
      {seats.map((seat, index) => {
        // Check if this is the current user's seat
        const isCurrentUserSeat = seat?.user_id === user?.id
        const isClaimingSeat = claimedSeats.has(index)
        
        // Find participant by seat user_id or by local participant for current user
        let participant = participantsList?.find((p) => {
          if (!seat?.user_id) return false
          if (p.identity === seat.user_id) return true
          const metadataUserId = parseLiveKitMetadataUserId(p.metadata)
          return metadataUserId === seat.user_id
        })
        
        // If no participant found but this is the current user's seat, use localParticipant
        if (!participant && isCurrentUserSeat && localParticipant) {
          participant = localParticipant as any
        }
        
        const isSpeaking = Boolean((participant as any)?.audioLevel > 0.05 || (participant as any)?.isSpeaking)
        
        return (
          <OfficerStreamBox
            key={index}
            seatIndex={index}
            seat={seat}
            participant={participant}
            user={user}
            isCurrentUserSeat={isCurrentUserSeat}
            isClaimingSeat={isClaimingSeat}
            onClaimClick={() => {
              handleSeatAction('claim', index, seat)
            }}
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
  isCurrentUserSeat: boolean
  isClaimingSeat: boolean
  children?: React.ReactNode
  onClaimClick: () => void
  onSeatAction: (action: 'claim' | 'release' | 'leave') => Promise<void>
}

const OfficerStreamBox: React.FC<OfficerStreamBoxProps & { [k: string]: any }> = ({
  seatIndex,
  seat,
  participant,
  user,
  isCurrentUserSeat,
  isClaimingSeat,
  onClaimClick,
  onSeatAction,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  React.useEffect(() => {
    if (!participant) return

    const videoTrack = participant.videoTrack?.track
    const audioTrack = participant.audioTrack?.track
    
    // Enhanced logging for debugging track issues
    console.log('OfficerStreamGrid: Participant tracks:', {
      identity: participant.identity,
      isLocal: participant.isLocal,
      videoTrack: videoTrack ? 'available' : 'missing',
      audioTrack: audioTrack ? 'available' : 'missing',
      videoTrackObj: participant.videoTrack,
      audioTrackObj: participant.audioTrack,
      seatIndex
    })

    // For local participant, ensure tracks are properly attached
    if (participant.isLocal) {
      console.log('OfficerStreamGrid: Handling local participant tracks for seat', seatIndex)
      
      // Wait a bit for tracks to be ready, then attach
      const attachLocalTracks = () => {
        if (videoTrack && videoRef.current) {
          try {
            videoTrack.attach(videoRef.current)
            console.log('OfficerStreamGrid: ✅ Local video track attached for seat', seatIndex)
          } catch (e) {
            console.warn('OfficerStreamGrid: Failed to attach local video track:', e)
          }
        }
        
        if (audioTrack && audioRef.current) {
          try {
            audioTrack.attach(audioRef.current)
            console.log('OfficerStreamGrid: ✅ Local audio track attached for seat', seatIndex)
          } catch (e) {
            console.warn('OfficerStreamGrid: Failed to attach local audio track:', e)
          }
        }
      }
      
      // Attach immediately, then try again after a short delay
      attachLocalTracks()
      setTimeout(attachLocalTracks, 500)
    } else {
      // For remote participants, attach normally
      if (videoTrack && videoRef.current) {
        try {
          videoTrack.attach(videoRef.current)
          console.log('OfficerStreamGrid: ✅ Remote video track attached for seat', seatIndex)
        } catch (e) {
          console.warn('OfficerStreamGrid: Failed to attach remote video track:', e)
        }
      }

      if (audioTrack && audioRef.current) {
        try {
          audioTrack.attach(audioRef.current)
          console.log('OfficerStreamGrid: ✅ Remote audio track attached for seat', seatIndex)
        } catch (e) {
          console.warn('OfficerStreamGrid: Failed to attach remote audio track:', e)
        }
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
  }, [participant?.videoTrack?.track, participant?.audioTrack?.track, seatIndex, participant?.isLocal])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClaimClick()
    }
  }

  const isSpeaking = Boolean((participant as any)?.audioLevel > 0.05 || (participant as any)?.isSpeaking)
  const isOccupied = !!seat?.user_id || isClaimingSeat
  const wrapperClass = `relative w-full aspect-video md:aspect-video rounded-2xl overflow-hidden rgb-border ${isSpeaking ? 'speaking' : ''} ${isOccupied ? 'occupied' : ''}`

  const handleClick = () => {
    // Always use onClaimClick which will delegate to parent's onSeatClick
    // This ensures consistent behavior with BroadcastPage's handleSeatClaim
    onClaimClick()
  }

  // Show video if participant exists and has video track, OR if it's the current user's seat
  const shouldShowVideo = (participant && participant.videoTrack?.track) || isCurrentUserSeat

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={wrapperClass}
    >
      <div className="tile-inner relative w-full h-full">
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
        {shouldShowVideo ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={participant?.isLocal || false}
              className="w-full h-full object-cover"
            />
            <audio ref={audioRef} autoPlay />
          </>
        ) : isOccupied ? (
          <div className="text-center text-white">
            <div className="mb-2 text-lg font-semibold">{seat?.username || 'User'}</div>
            <div className="text-xs uppercase tracking-[0.4em]">
              {isCurrentUserSeat ? 'You' : 'Connected'}
            </div>
            {isCurrentUserSeat && (
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
        ) : isClaimingSeat ? (
          <div className="text-white flex flex-col items-center gap-2">
            <div className="text-3xl font-bold animate-pulse">⟳</div>
            <div className="text-sm font-semibold">Joining...</div>
          </div>
        ) : (
          <>
            {/* Video element for this seat */}
            <video
              id={`seat-video-${seatIndex}`}
              autoPlay
              playsInline
              muted
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
            <div className="text-white flex flex-col items-center gap-2">
              <div className="text-3xl font-bold">+</div>
              <div className="text-sm font-semibold">Click to Join</div>
            </div>
          </>
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
            {isCurrentUserSeat ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSeatAction('leave')
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

        {/* children removed - like button moved to BroadcastPage under the grid */}
      </div>
    </div>
  )
}

export { OfficerStreamGrid }
