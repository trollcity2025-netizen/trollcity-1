import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from './useLiveKit'
import { LIVEKIT_URL } from '../lib/LiveKitConfig'
import { toast } from 'sonner'

interface SessionOptions {
  roomName: string
  user: any
  role?: string
  allowPublish?: boolean
  autoPublish?: boolean
  maxParticipants?: number
}

// Shared join/publish helper used by Go Live, Officer Stream, Troll Court
export function useLiveKitSession(options: SessionOptions) {
  const {
    connect,
    disconnect,
    startPublishing,
    toggleCamera,
    toggleMicrophone,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    service,
    getRoom,
  } = useLiveKit()

  const [sessionError, setSessionError] = useState<string | null>(null)
  const joinStartedRef = useRef(false)

  const maxParticipants = options.maxParticipants ?? 6

  const joinAndPublish = useMemo(
    () => async (mediaStream?: MediaStream, tokenOverride?: string) => {
      if (joinStartedRef.current) throw new Error('Join already in progress')
      if (!options.roomName || !options.user?.identity) {
        const msg = 'Missing room or user for LiveKit'
        setSessionError(msg)
        throw new Error(msg)
      }

      const allowPublish = options.allowPublish !== false
      const autoPublish = options.autoPublish !== false

      console.log('[useLiveKitSession] joinAndPublish triggered', {
        roomName: options.roomName,
        allowPublish,
        autoPublish,
      })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        console.log('[useLiveKitSession] Requesting LiveKit token/connect')
        console.log('[useLiveKitSession] connecting to room', options.roomName)

        // Log quick debug details before attempting connection
        try {
          console.log('[useLiveKitSession] LIVEKIT_URL', LIVEKIT_URL)
          console.log('[useLiveKitSession] roomName', options.roomName)
          console.log('[useLiveKitSession] identity', options.user?.identity)
          if (tokenOverride) {
            console.log('[useLiveKitSession] tokenOverride length', tokenOverride.length)
            try {
              const parts = tokenOverride.split('.')
              if (parts.length >= 2) {
                const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))))
                console.log('[useLiveKitSession] tokenOverride payload', payload)
                console.log('[useLiveKitSession] tokenOverride room/canPublish', {
                  tokenRoom: payload?.room ?? payload?.r ?? null,
                  canPublish: payload?.allowPublish ?? payload?.canPublish ?? null,
                })
              }
            } catch (e) {
              console.warn('[useLiveKitSession] Failed to decode tokenOverride', e)
            }
          } else {
            console.log('[useLiveKitSession] no tokenOverride provided; token details will be logged by service')
          }
        } catch (e) {
          console.warn('[useLiveKitSession] debug logging failed', e)
        }

        const connected = await connect(options.roomName, options.user, {
          allowPublish,
          preflightStream: mediaStream,
          autoPublish: options.autoPublish,
          tokenOverride,
        })

        if (!connected) {
          console.error('[useLiveKitSession] connect returned false — aborting join')
          toast.error('LiveKit connection failed: check LIVEKIT_URL, token, or server availability')
          joinStartedRef.current = false
          setSessionError('LiveKit connection failed')
          return false
        }

        console.log('[useLiveKitSession] LiveKit connected')
        // Prefer provider `getRoom()` (stable accessor) because `service` may have been recreated
        const room = (typeof getRoom === 'function' && getRoom()) || service?.getRoom?.()
        if (!room) throw new Error('LiveKit room missing after connect')

        // Limit room size
        if (participants.size > maxParticipants) {
          disconnect()
          throw new Error('Room is full')
        }

        if (allowPublish && autoPublish) {
          console.log('[useLiveKitSession] Publishing local tracks via LiveKit session')
          try {
            await room.localParticipant.setCameraEnabled(true)
            await room.localParticipant.setMicrophoneEnabled(true)
          } catch (enableErr) {
            console.warn('[useLiveKitSession] auto-enable camera/mic failed, will attempt startPublishing fallback', enableErr)
            try {
              await startPublishing()
            } catch (spErr) {
              console.error('[useLiveKitSession] startPublishing fallback also failed', spErr)
              throw enableErr
            }
          }

          // Wait briefly for the server to acknowledge publication (polling)
          const waitForPublished = async (timeout = 8000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              try {
                const hasVideo = room.localParticipant.videoTrackPublications.size > 0
                const hasAudio = room.localParticipant.audioTrackPublications.size > 0
                if (hasVideo || hasAudio) return true
              } catch {
                // ignore and retry
              }
              // small delay

              await new Promise((r) => setTimeout(r, 250))
            }
            return false
          }

          const published = await waitForPublished()
          if (!published) {
            console.warn('[useLiveKitSession] publication timed out, attempting explicit startPublishing()')
            try {
              await startPublishing()
            } catch (spErr) {
              console.error('[useLiveKitSession] explicit startPublishing failed after timeout', spErr)
              throw new Error('publication timed out')
            }
          }
          console.log('[useLiveKitSession] Local tracks enabled/published')
        } else if (allowPublish && !autoPublish) {
          console.log('[useLiveKitSession] Publishing allowed but autoPublish disabled – skipping local track enable')
        } else {
          console.log('[useLiveKitSession] Joined LiveKit without publishing (viewer mode)')
        }

        return true
      } catch (err: any) {
        console.error('[useLiveKitSession] connect failed', err)
        const errorMsg = err?.message || 'Failed to join stream'
        setSessionError(errorMsg)
        joinStartedRef.current = false
        // Preserve existing behavior for non-connect errors by re-throwing
        throw err
      }
    },
    [
      connect,
      disconnect,
      startPublishing,
      options.roomName,
      options.user,
      options.allowPublish,
      options.autoPublish,
      maxParticipants,
      participants.size,
      service,
    ]
  )

  const joinOnly = useMemo(
    () => async () => {
      if (joinStartedRef.current) throw new Error('Join already in progress')
      if (!options.roomName || !options.user?.identity) {
        const msg = 'Missing room or user for LiveKit'
        setSessionError(msg)
        throw new Error(msg)
      }

      console.log('[useLiveKitSession] joinOnly triggered', { roomName: options.roomName })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        console.log('[useLiveKitSession] connecting (viewer only)')
        const connected = await connect(options.roomName, options.user, {
          allowPublish: false,
          preflightStream: undefined,
          autoPublish: false,
        })
        if (!connected) throw new Error('LiveKit connection failed')

        console.log('[useLiveKitSession] joinOnly connected')
        return true
      } catch (err: any) {
        console.error('[useLiveKitSession] connect failed', err)
        setSessionError(err?.message || 'Failed to join stream')
        joinStartedRef.current = false
        return false
      }
    },
    [connect, options.roomName, options.user]
  )

  const resetJoinGuard = () => {
    joinStartedRef.current = false
  }

  useEffect(() => {
    return () => {
      joinStartedRef.current = false
    }
  }, [])

  return {
    joinAndPublish,
    joinOnly,
    resetJoinGuard,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: sessionError || error,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    disconnect,
  }
}
