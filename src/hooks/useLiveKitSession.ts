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

  // ✅ Clear stale session errors from context on mount/update
  useEffect(() => {
    if (error) {
      const isSessionError = error.toLowerCase().includes('session') || 
                           error.toLowerCase().includes('sign in') || 
                           error.toLowerCase().includes('no active session') ||
                           error.toLowerCase().includes('no valid user session')
      if (isSessionError) {
        // Don't treat session errors as real errors - they're expected on load
        console.log('[useLiveKitSession] Detected session error in context (expected on load) — ignoring')
        // Error will be cleared by LiveKitProvider when it detects no session
      }
    }
  }, [error])

  const joinAndPublish = useMemo(
    () => async (mediaStream?: MediaStream, tokenOverride?: string) => {
      if (joinStartedRef.current) throw new Error('Join already in progress')
      
      // ✅ CRITICAL: Early return if roomName is empty (prevents all connection attempts)
      // This prevents the hook from doing anything when not on a broadcast page
      if (!options.roomName || options.roomName.trim() === '') {
        // Silently return - this is expected when not on broadcast page
        return false
      }
      
      // ✅ Check for stale session errors in context FIRST - don't even try if there's a session error
      if (error) {
        const errorLower = error.toLowerCase()
        const isSessionError = errorLower.includes('session') || 
                              errorLower.includes('sign in') || 
                              errorLower.includes('no active session') || 
                              errorLower.includes('no valid user session') ||
                              errorLower.includes('please sign in again')
        if (isSessionError) {
          console.log("[useLiveKitSession] Session error detected in context — skipping connect (will retry after login)")
          return false
        }
      }
      
      // ✅ 1) Add a hard guard before LiveKit ever runs
      // Check session FIRST - use cached user from options if available to avoid auth fetch
      let hasValidSession = false
      if (options.user && options.user.id) {
        hasValidSession = true
      } else {
        const { supabase } = await import('../lib/supabase')
        // Only fetch if we really don't have a user
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) hasValidSession = true
      }
      
      if (!hasValidSession) {
        console.log("[useLiveKitSession] No active session yet — skipping connect")
        return false
      }

      // ✅ 2) Only trigger joinAndPublish when ALL are true
      const roomName = options.roomName
      const identity = options.user?.identity
      const allowPublish = options.allowPublish !== false
      
      if (!roomName || !identity || !allowPublish) {
        console.log("[useLiveKitSession] Skipping connect — missing requirements", { 
          roomName, 
          identity, 
          allowPublish,
          hasUser: !!options.user
        })
        return false
      }

      const autoPublish = options.autoPublish !== false

      console.log('[useLiveKitSession] joinAndPublish triggered', {
        roomName: options.roomName,
        allowPublish,
        autoPublish,
      })
      joinStartedRef.current = true
      setSessionError(null)

      try {
        // ✅ CRITICAL: Check roomName FIRST before any logging or connection attempts
        // This prevents errors on home page or any non-broadcast page
        if (!options.roomName || options.roomName.trim() === '') {
          // Silently return - this is expected when not on broadcast page
          return false
        }

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
          // ✅ CRITICAL: Check for session errors FIRST before any other processing
          // This prevents error logging for expected session conditions
          const serviceError = service?.getLastConnectionError?.() || null
          const rawError = serviceError || error || ''
          const errorToCheck = String(rawError).toLowerCase().trim()
          
          // Comprehensive check for session-related errors (expected on load/refresh)
          // Match ANY variation of "no active session" or "sign in" messages
          const isSessionError = !errorToCheck || // Empty error is fine
                                errorToCheck.includes('session') || 
                                errorToCheck.includes('sign in') || 
                                errorToCheck.includes('no active session') || 
                                errorToCheck.includes('no valid user session') ||
                                errorToCheck.includes('please sign in again') ||
                                errorToCheck.includes('session expired') ||
                                errorToCheck.includes('session validation') ||
                                errorToCheck.includes('no valid user session found') ||
                                errorToCheck.includes('active session')
          
          // ✅ CRITICAL: Only log as error if it's NOT a session error (expected condition)
          // Session errors are expected on app load/refresh - don't spam console
          if (isSessionError) {
            // Early return - do NOT log as error, do NOT access room, do NOT show toast
            console.log('[useLiveKitSession] No session yet — will retry after login')
            joinStartedRef.current = false
            return false
          }
          
          // If we get here, it's a REAL error (not session-related)
          // Only now do we access room and log the error
          const room = (typeof getRoom === 'function' && getRoom()) || service?.getRoom?.()
          const errorMessage = rawError || 'LiveKit connection failed'
          
          // ✅ Capture full connection failure details
          console.error('[useLiveKitSession] ❌ connect returned false. Full failure details:', {
            error: rawError,
            serviceError,
            roomState: room?.state,
            roomConnectionState: room?.connectionState,
            lastDisconnectReason: room?.disconnectReason,
            hasService: !!service,
            roomName: options.roomName,
            identity: options.user?.identity,
            tokenDetails: service?.getLastConnectionError?.() // or any other details exposed
          })
          
          // Show more specific error message for real errors
          let userMessage = 'LiveKit connection failed'
          
          if (errorToCheck.includes('token') || errorToCheck.includes('Token') || errorToCheck.includes('JWT')) {
            userMessage = 'Failed to get LiveKit token. Please try again or contact support.'
          } else if (errorToCheck.includes('network') || errorToCheck.includes('Network') || errorToCheck.includes('fetch')) {
            userMessage = 'Network error connecting to LiveKit. Check your internet connection.'
          } else if (errorToCheck.includes('timeout') || errorToCheck.includes('Timeout')) {
            userMessage = 'Connection timeout. The LiveKit server may be unavailable.'
          } else if (errorToCheck.includes('WebSocket') || errorToCheck.includes('websocket')) {
            userMessage = 'WebSocket connection failed. Check your network or try again.'
          } else {
            userMessage = `Connection failed: ${errorToCheck}`
          }
          
          toast.error(userMessage, { duration: 6000 })
          joinStartedRef.current = false
          setSessionError(errorMessage)
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
          console.log('[useLiveKitSession] Publishing local tracks via LiveKit session', {
            hasPreflightStream: !!mediaStream,
            preflightStreamActive: mediaStream?.active
          })
          
          // ✅ Always call startPublishing - it will use preflight stream if available, otherwise capture new tracks
          try {
            await startPublishing()
            console.log('[useLiveKitSession] ✅ startPublishing completed')
          } catch (spErr: any) {
            console.error('[useLiveKitSession] startPublishing failed', spErr)
            throw new Error(`Failed to publish tracks: ${spErr?.message || 'Unknown error'}`)
          }

          // Wait briefly for the server to acknowledge publication (polling)
          const waitForPublished = async (timeout = 8000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
              try {
                const hasVideo = room.localParticipant.videoTrackPublications.size > 0
                const hasAudio = room.localParticipant.audioTrackPublications.size > 0
                if (hasVideo || hasAudio) {
                  console.log('[useLiveKitSession] ✅ Tracks confirmed published', { hasVideo, hasAudio })
                  return true
                }
              } catch {
                // ignore and retry
              }
              // small delay
              await new Promise((r) => setTimeout(r, 250))
            }
            console.warn('[useLiveKitSession] ⚠️ Publication check timed out')
            return false
          }

          const published = await waitForPublished()
          if (!published) {
            console.warn('[useLiveKitSession] Publication check timed out, but startPublishing was called - tracks may still be publishing')
            // Don't throw error - tracks might still be publishing asynchronously
          }
          console.log('[useLiveKitSession] Local tracks published')
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
