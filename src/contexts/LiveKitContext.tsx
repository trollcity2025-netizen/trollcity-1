import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  LiveKitParticipant,
  LiveKitService,
  LiveKitServiceConfig,
} from '../lib/LiveKitService'

interface LiveKitContextValue {
  service: LiveKitService
  isConnected: boolean
  isConnecting: boolean
  participants: Map<string, LiveKitParticipant>
  localParticipant: LiveKitParticipant | null
  error: string | null
  connect: (
    roomName: string,
    user: any,
    options?: Partial<LiveKitServiceConfig>
  ) => Promise<boolean>
  disconnect: () => void
  toggleCamera: () => Promise<boolean>
  toggleMicrophone: () => Promise<boolean>
  startPublishing: () => Promise<void>
  getRoom: () => any | null
}

// Context holds the LiveKitService plus state helpers
const LiveKitContext = createContext<LiveKitContextValue | null>(null)

export const LiveKitProvider = ({ children }: { children: React.ReactNode }) => {
  const serviceRef = useRef<LiveKitService | null>(null)
  const lastInitRef = useRef<string | null>(null)
  const disconnectingRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(
    new Map()
  )
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null)
  const [error, setError] = useState<string | null>(null)

  const syncLocalParticipant = useCallback(() => {
    if (!serviceRef.current) return
    setLocalParticipant(serviceRef.current.getLocalParticipant())
  }, [])

  const connect = useCallback(
    async (
      roomName: string,
      user: any,
      options: Partial<LiveKitServiceConfig> = {}
    ) => {
      if (!roomName || !user) {
        setError('Missing room or user for LiveKit connect')
        return false
      }

      // Hard guard: block ONLY if user id is missing
      if (!user?.id) {
        return false // do NOT set error
      }

      console.log('[LiveKit identity check]', user.id)

      // Determine mode from options
      const mode = options.autoPublish ? 'publisher' : 'viewer'

      // Hard guard against re-init for same room/identity/mode
      const initKey = `${roomName}:${user.id}:${mode}`
      if (lastInitRef.current === initKey) {
        console.log('[CONNECT SKIPPED - already initialized]', initKey)
        return true
      }

      // CONNECT INTENT logging
      console.log('[CONNECT INTENT]', {
        roomName,
        identity: user.id,
        mode
      })

      // Disconnect existing service before creating new one
      if (serviceRef.current) {
        serviceRef.current.disconnect()
      }

      // Create new service instance for each connect to ensure immutability
      serviceRef.current = new LiveKitService({
        roomName,
        identity: user.id || user.identity,
        user,
        autoPublish: options.autoPublish !== false,
        onConnected: () => {
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          setParticipants(new Map(serviceRef.current?.getParticipants()))
          syncLocalParticipant()
          options.onConnected?.()
        },
        onDisconnected: () => {
          setIsConnected(false)
          setIsConnecting(false)
          setParticipants(new Map())
          setLocalParticipant(null)
          options.onDisconnected?.()
        },
        onParticipantJoined: (participant) => {
          setParticipants((prev) => {
            const next = new Map(prev)
            next.set(participant.identity, participant)
            return next
          })
          options.onParticipantJoined?.(participant)
        },
        onParticipantLeft: (participant) => {
          setParticipants((prev) => {
            const next = new Map(prev)
            next.delete(participant.identity)
            return next
          })
          options.onParticipantLeft?.(participant)
        },
        onTrackSubscribed: (track, participant) => {
          setParticipants((prev) => {
            const next = new Map(prev)
            const existing = next.get(participant.identity) || participant
            const updated = { ...existing }
            if (track.kind === 'video') updated.videoTrack = track
            if (track.kind === 'audio') updated.audioTrack = track
            next.set(participant.identity, updated)
            return next
          })
          options.onTrackSubscribed?.(track, participant)
        },
        onTrackUnsubscribed: (track, participant) => {
          setParticipants((prev) => {
            const next = new Map(prev)
            const existing = next.get(participant.identity)
            if (existing) {
              const updated: LiveKitParticipant = { ...existing }
              if (track.kind === 'video') {
                delete (updated as any).videoTrack
              }
              if (track.kind === 'audio') {
                delete (updated as any).audioTrack
              }
              next.set(participant.identity, updated)
            }
            return next
          })
          options.onTrackUnsubscribed?.(track, participant)
        },
        onError: (errorMsg) => {
          // Filter non-errors
          if (
            errorMsg.includes('Client initiated disconnect') ||
            errorMsg.includes('Abort connection attempt') ||
            errorMsg.includes('websocket closed')
          ) {
            console.log('LiveKit non-error:', errorMsg)
            return
          }
          console.error('LiveKit error:', errorMsg)
          setError(errorMsg)
          setIsConnecting(false)
          options.onError?.(errorMsg)
        },
      })

      setError(null)
      setIsConnecting(true)

      // Mark as initialized
      lastInitRef.current = initKey

      try {
        const ok = await serviceRef.current.connect()
        syncLocalParticipant()
        return ok
      } catch (err: any) {
        setIsConnecting(false)
        setError(err?.message || 'Failed to connect to LiveKit')
        // Reset init key on failure
        lastInitRef.current = null
        return false
      }
    },
    [syncLocalParticipant]
  )

  const disconnect = useCallback(() => {
    if (disconnectingRef.current) return
    disconnectingRef.current = true

    if (serviceRef.current) {
      serviceRef.current.disconnect()
    }
    setIsConnected(false)
    setIsConnecting(false)
    setParticipants(new Map())
    setLocalParticipant(null)
    lastInitRef.current = null
    disconnectingRef.current = false
  }, [])

  const toggleCamera = useCallback(async () => {
    if (!serviceRef.current) return false
    const enabled = await serviceRef.current.toggleCamera()
    syncLocalParticipant()
    return enabled
  }, [syncLocalParticipant])

  const toggleMicrophone = useCallback(async () => {
    if (!serviceRef.current) return false
    const enabled = await serviceRef.current.toggleMicrophone()
    syncLocalParticipant()
    return enabled
  }, [syncLocalParticipant])

  const startPublishing = useCallback(async () => {
    if (!serviceRef.current) return
    await serviceRef.current.startPublishing()
    syncLocalParticipant()
  }, [syncLocalParticipant])

  const getRoom = useCallback(() => {
    return serviceRef.current?.getRoom() || null
  }, [])

  // Do not disconnect here; StrictMode/dev unmounts would break active sessions.
  useEffect(() => {
    return () => {
      console.log('LiveKitProvider unmounted (dev / StrictMode) - no disconnect')
    }
  }, [])

  const value: LiveKitContextValue = {
    service: serviceRef.current!,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    startPublishing,
    getRoom,
  }

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  )
}

export function useLiveKit() {
  const ctx = useContext(LiveKitContext)
  if (!ctx) {
    throw new Error('useLiveKit must be used within LiveKitProvider')
  }
  return ctx
}
