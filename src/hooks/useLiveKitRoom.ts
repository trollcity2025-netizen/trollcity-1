import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Participant,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from 'livekit-client'
import { LIVEKIT_URL, defaultLiveKitOptions } from '../lib/LiveKitConfig'
import api from '../lib/api'

export type LiveKitParticipantState = {
  identity: string
  name: string
  isLocal: boolean
  isCameraOn: boolean
  isMicrophoneOn: boolean
  isMuted: boolean
  videoTrack?: RemoteVideoTrack | LocalVideoTrack
  audioTrack?: RemoteAudioTrack | LocalAudioTrack
  metadata?: Record<string, unknown>
}

export type LiveKitConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export type LiveKitRoomConfig = {
  roomName?: string
  token?: string
  user?: {
    id: string
    username?: string
    role?: string
    level?: number
  }
  allowPublish?: boolean
  autoPublish?: boolean
  roomOptions?: Partial<typeof defaultLiveKitOptions>
}

export type LiveKitRoomOptions = LiveKitRoomConfig & { enabled?: boolean }

type LiveKitTokenResponse = {
  token: string
  livekitUrl?: string
  room?: string
  allowPublish?: boolean
}

// JWT Token decoding helper function
const decodeJWTPayload = (token: string): Record<string, any> | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.warn('[useLiveKitRoom] Invalid JWT structure - expected 3 parts, got', parts.length)
      return null
    }

    const payload = parts[1]
    // Add padding if needed for base64 decode
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    console.warn('[useLiveKitRoom] Failed to decode JWT payload', { error, tokenLength: token?.length })
    return null
  }
}

const buildTokenBody = (roomName: string, user: LiveKitRoomConfig['user'], allowPublish: boolean) => ({
  room: roomName,
  participantName: user?.username || user?.id,
  identity: user?.id, // Always use user.id for stable identity
  role: user?.role || 'viewer',
  level: user?.level || 1,
  allowPublish,
})

const parseParticipantMetadata = (metadata?: string): Record<string, unknown> | undefined => {
  if (!metadata) return undefined
  try {
    return JSON.parse(metadata)
  } catch (error) {
    console.warn('[useLiveKitRoom] Failed to parse metadata for participant', { metadata, error })
    return undefined
  }
}

export function useLiveKitRoom(config: LiveKitRoomOptions) {
  const { roomName, token: providedToken, user, allowPublish = false, autoPublish = false, roomOptions, enabled = true } = config

  const [room, setRoom] = useState<Room | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<LiveKitConnectionStatus>('idle')
  const [participants, setParticipants] = useState<Record<string, LiveKitParticipantState>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)

  const localTracksRef = useRef<{ video?: LocalVideoTrack; audio?: LocalAudioTrack }>({})
  const roomRef = useRef<Room | null>(null)

  const connectingRef = useRef(false)

  const fetchToken = useCallback(
    async (publish: boolean): Promise<LiveKitTokenResponse> => {
      // If a token is provided directly, use it
      if (providedToken) {
        console.log('[useLiveKitRoom] Using provided token')
        return {
          token: providedToken,
          livekitUrl: LIVEKIT_URL, // Use default URL or one from config if added
          room: roomName,
          allowPublish: publish
        }
      }

      if (!roomName || !user?.id) {
        throw new Error('Missing room or user for LiveKit token')
      }

      const body = buildTokenBody(roomName, user, publish)
      console.log('[useLiveKitRoom] fetching token with body:', body)

      let tokenResponse: any
      let data: LiveKitTokenResponse

      try {
        tokenResponse = await api.post<LiveKitTokenResponse>('/livekit-token', body)
        data = tokenResponse.data || tokenResponse
      } catch (error: any) {
        console.error('[useLiveKitRoom] Token API call failed', {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        })
        throw new Error(`Token API call failed: ${error.message}`)
      }

      // Comprehensive logging of token response
      console.log('[useLiveKitRoom] Full token response received:', {
        success: true,
        tokenLength: data?.token?.length || 0,
        hasToken: !!data?.token,
        livekitUrl: data?.livekitUrl,
        room: data?.room,
        allowPublish: data?.allowPublish,
        rawResponse: data,
        tokenPreview: data?.token ? `${data.token.substring(0, 50)}...` : null
      })

      // Validate token response
      if (!data || !data.token) {
        const errorDetails = {
          hasData: !!data,
          hasToken: !!data?.token,
          tokenLength: data?.token?.length || 0,
          rawResponse: data,
          apiError: (data as any)?.error || tokenResponse?.error
        }
        console.error('[useLiveKitRoom] Invalid token response:', errorDetails)
        throw new Error(`Invalid token response: ${JSON.stringify(errorDetails)}`)
      }

      // Trim token to prevent decoding errors
      data.token = data.token.trim()
      
      // Remove double quotes if present
      if (data.token.startsWith('"') && data.token.endsWith('"')) {
        data.token = data.token.slice(1, -1);
      }

      // Decode and log JWT payload for debugging
      const decodedPayload = decodeJWTPayload(data.token)
      if (decodedPayload) {
        console.log('[useLiveKitRoom] JWT Token decoded payload:', {
          iss: decodedPayload.iss,
          sub: decodedPayload.sub,
          video: decodedPayload.video,
          room: decodedPayload.video?.room,
          roomJoin: decodedPayload.video?.roomJoin,
          canPublish: decodedPayload.video?.canPublish,
          canSubscribe: decodedPayload.video?.canSubscribe,
          exp: decodedPayload.exp,
          iat: decodedPayload.iat
        })

        // Check for potential issues in JWT
        if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
          console.warn('[useLiveKitRoom] Token is expired!', {
            exp: new Date(decodedPayload.exp * 1000).toISOString(),
            now: new Date().toISOString()
          })
        }
      }

      // Attach token to window for debugging in development
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        ; (window as any).__LK_TOKEN = data.token
        console.log('[useLiveKitRoom] Token attached to window.__LK_TOKEN for debugging')
      }

      return data
    },
    [roomName, user, providedToken]
  )

  const updateParticipantState = useCallback((identity: string, patch: Partial<LiveKitParticipantState>) => {
    setParticipants((prev) => {
      const next = { ...prev }
      const existing = next[identity] ?? {
        identity,
        name: identity,
        isLocal: false,
        isCameraOn: false,
        isMicrophoneOn: false,
        isMuted: true,
      }
      const metadata = patch.metadata ?? existing.metadata
      next[identity] = { ...existing, ...patch, metadata }
      return next
    })
  }, [])

  const removeParticipantState = useCallback((identity: string) => {
    setParticipants((prev) => {
      if (!prev[identity]) return prev
      const next = { ...prev }
      delete next[identity]
      return next
    })
  }, [])



  const handleTrackSubscribed = useCallback(
    (
      track: any,
      publication: any,
      participant: any
    ) => {
      const identity = participant.identity
      if (track.kind === 'video') {
        updateParticipantState(identity, {
          videoTrack: track as RemoteVideoTrack,
          isCameraOn: participant.isCameraEnabled,
          metadata: parseParticipantMetadata(participant.metadata),
        })
      }
      if (track.kind === 'audio') {
        updateParticipantState(identity, {
          audioTrack: track as RemoteAudioTrack,
          isMicrophoneOn: participant.isMicrophoneEnabled,
          isMuted: !participant.isMicrophoneEnabled,
          metadata: parseParticipantMetadata(participant.metadata),
        })
      }
    },
    [updateParticipantState]
  )

  const handleTrackUnsubscribed = useCallback(
    (track: any, publication: any, participant: any) => {
      const identity = participant.identity
      if (track.kind === 'video') {
        updateParticipantState(identity, { videoTrack: undefined })
      }
      if (track.kind === 'audio') {
        updateParticipantState(identity, { audioTrack: undefined })
      }
    },
    [updateParticipantState]
  )

  const registerExistingParticipants = useCallback((connectedRoom: Room) => {
    const local = connectedRoom.localParticipant
    if (local) {
      updateParticipantState(local.identity, {
        identity: local.identity,
        name: local.name || local.identity,
        isLocal: true,
        isCameraOn: local.isCameraEnabled,
        isMicrophoneOn: local.isMicrophoneEnabled,
        isMuted: !local.isMicrophoneEnabled,
        metadata: parseParticipantMetadata(local.metadata),
      })
    }

    connectedRoom.remoteParticipants.forEach((participant) => {
      updateParticipantState(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        isCameraOn: participant.isCameraEnabled,
        isMicrophoneOn: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled,
        metadata: parseParticipantMetadata(participant.metadata),
      })
      Array.from(participant.trackPublications.values()).forEach((publication) => {
        if (publication.track) {
          handleTrackSubscribed(publication.track, publication, participant)
        }
      })
    })
  }, [handleTrackSubscribed, updateParticipantState])

  const addParticipant = useCallback(
    async (participant: Participant) => {
      updateParticipantState(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: participant.isLocal,
        isCameraOn: participant.isCameraEnabled,
        isMicrophoneOn: participant.isMicrophoneEnabled,
        isMuted: !participant.isMicrophoneEnabled,
        metadata: parseParticipantMetadata(participant.metadata),
      })

      // Trigger entrance effect for remote participants (not local)
      if (!participant.isLocal && participant.identity) {
        try {
          const { triggerUserEntranceEffect } = await import('../lib/entranceEffects')
          await triggerUserEntranceEffect(participant.identity)
        } catch (error) {
          console.warn('Failed to trigger entrance effect:', error)
        }
      }
    },
    [updateParticipantState]
  )

  const publishLocalTracks = useCallback(async (targetRoom?: Room) => {
    const currentRoom = targetRoom ?? roomRef.current
    if (!currentRoom || !allowPublish) {
      return
    }
    setIsPublishing(true)

    try {
      console.log('[useLiveKitRoom] publishLocalTracks: starting publish')
      
      const [videoTrack, audioTrack] = await Promise.all([
        createLocalVideoTrack({
          facingMode: 'user',
          resolution: { width: 1280, height: 720 }
        }),
        createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        })
      ])

      // Enable camera and microphone
      if (videoTrack?.mediaStreamTrack) {
        videoTrack.mediaStreamTrack.enabled = true
      }
      if (audioTrack?.mediaStreamTrack) {
        audioTrack.mediaStreamTrack.enabled = true
      }

      localTracksRef.current.video = videoTrack
      localTracksRef.current.audio = audioTrack

      const participant = currentRoom.localParticipant
      if (videoTrack) {
        try {
          await participant.publishTrack(videoTrack, {
            name: 'camera',
            simulcast: false
          })
          console.log('[useLiveKitRoom] publishLocalTracks: video published')
        } catch (err) {
          console.error('[useLiveKitRoom] publishLocalTracks: video publish failed', err)
          throw err
        }
      }
      if (audioTrack) {
        try {
          if (audioTrack.mediaStreamTrack) {
             console.log('[useLiveKitRoom] Audio Track Diagnostics:', {
               readyState: audioTrack.mediaStreamTrack.readyState,
               enabled: audioTrack.mediaStreamTrack.enabled,
               muted: audioTrack.mediaStreamTrack.muted,
               settings: audioTrack.mediaStreamTrack.getSettings()
             });
          }

          await participant.publishTrack(audioTrack, {
            name: 'microphone'
          })
          console.log('[useLiveKitRoom] publishLocalTracks: audio published')
        } catch (err) {
          console.error('[useLiveKitRoom] publishLocalTracks: audio publish failed', err)
          throw err
        }
      }
      
      console.log('[useLiveKitRoom] publishLocalTracks: all tracks published successfully')
    } catch (error) {
      console.error('[useLiveKitRoom] publishLocalTracks: failed', error)
      throw error
    } finally {
      setIsPublishing(false)
    }
  }, [allowPublish])

  const stopLocalTracks = useCallback(async () => {
    const roomInstance = roomRef.current
    if (!roomInstance) return

    const { video, audio } = localTracksRef.current
    if (video) {
      try {
        await roomInstance.localParticipant.unpublishTrack(video)
      } catch (err) {
        console.warn('Unpublish video track failed', err)
      }
      video.stop()
    }
    if (audio) {
      try {
        await roomInstance.localParticipant.unpublishTrack(audio)
      } catch (err) {
        console.warn('Unpublish audio track failed', err)
      }
      audio.stop()
    }
    localTracksRef.current = {}
    setIsPublishing(false)
  }, [])

  const cleanupRoom = useCallback(() => {
    const connectedRoom = roomRef.current
    if (!connectedRoom) return
    connectedRoom.removeAllListeners()
  }, [])

  const connect = useCallback(async () => {
    if (!enabled) {
      console.log('[useLiveKitRoom] connect called but enabled=false, skipping')
      return
    }
    if (!roomName || !user) {
      console.log('[useLiveKitRoom] connect missing roomName or user, skipping')
      return
    }
    if (connectingRef.current) {
      console.log('[useLiveKitRoom] Already connecting, skipping duplicate call')
      return
    }
    connectingRef.current = true

    console.log('[useLiveKitRoom] connect start', {
      roomName,
      identity: user?.id, // Using stable identity
      allowPublish,
      autoPublish,
      livekitUrl: LIVEKIT_URL
    })
    setConnectionStatus('connecting')
    setError(null)

    let retryCount = 0
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    while (retryCount <= maxRetries) {
      try {
        console.log(`[useLiveKitRoom] 🔄 Connection attempt ${retryCount + 1}/${maxRetries + 1}`)
        
        const tokenResponse = await fetchToken(allowPublish)
        const targetUrl = tokenResponse.livekitUrl || LIVEKIT_URL

        console.log('[useLiveKitRoom] Connecting to LiveKit:', {
          url: targetUrl,
          tokenLength: tokenResponse.token?.length,
          tokenPreview: tokenResponse.token ? `${tokenResponse.token.substring(0, 50)}...` : null,
          room: tokenResponse.room || roomName
        })

        const newRoom = new Room({ ...defaultLiveKitOptions, ...roomOptions })

        // Set up event handlers
        newRoom.on(RoomEvent.Connected, () => {
          console.log('[useLiveKitRoom] ✅ Room connected successfully')
          setConnectionStatus('connected')
          addParticipant(newRoom.localParticipant)
          registerExistingParticipants(newRoom)
          if (autoPublish && allowPublish) {
            console.log('[useLiveKitRoom] autoPublish enabled, publishing local tracks')
            void publishLocalTracks(newRoom)
          }
        })

        newRoom.on(RoomEvent.Reconnecting, () => {
          console.log('[useLiveKitRoom] 🔄 Reconnecting...')
          setConnectionStatus('reconnecting')
        })

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('[useLiveKitRoom] 📡 Room disconnected')
          setConnectionStatus('disconnected')
          setRoom(null)
          setParticipants({})
        })

        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('[useLiveKitRoom] 👤 Participant connected:', participant.identity)
          addParticipant(participant)
        })

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('[useLiveKitRoom] 👋 Participant disconnected:', participant.identity)
          removeParticipantState(participant.identity)
        })

        newRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        newRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)

        roomRef.current = newRoom

        console.log('[useLiveKitRoom] 🔗 Attempting LiveKit connection...')
        await newRoom.connect(targetUrl, tokenResponse.token)
        setRoom(newRoom)
        
        // Success! Break out of retry loop
        console.log('[useLiveKitRoom] ✅ Connection successful!')
        break
        
      } catch (err: any) {
        // Comprehensive error logging for debugging
        const errorDetails = {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
          code: err?.code,
          reason: err?.reason,
          statusCode: err?.statusCode,
          status: err?.status,
          raw: err,
          // Connection context
          roomName,
          identity: user?.id,
          allowPublish,
          attempt: retryCount + 1,
          maxRetries
        }

        console.error(`[useLiveKitRoom] ❌ Connection attempt ${retryCount + 1} failed:`, errorDetails)

        // Provide specific error analysis
        let errorType = 'unknown'
        let errorSuggestion = ''
        let shouldRetry = true

        if (err?.message?.includes('token') || err?.message?.includes('Token')) {
          errorType = 'invalid_token'
          errorSuggestion = 'Token validation failed - check JWT structure, expiry, and grants'
          shouldRetry = false // Don't retry token errors
        } else if (err?.message?.includes('401') || err?.message?.includes('403')) {
          errorType = 'auth_failed'
          errorSuggestion = 'Authentication failed - verify LiveKit project keys and API credentials'
          shouldRetry = false // Don't retry auth errors
        } else if (err?.message?.includes('room') && err?.message?.includes('not found')) {
          errorType = 'room_not_found'
          errorSuggestion = 'Room does not exist or is not accessible - check room name and permissions'
        } else if (err?.message?.includes('connection') || err?.message?.includes('connect')) {
          errorType = 'connection_failed'
          errorSuggestion = 'Connection failed - check LiveKit URL and network connectivity'
        } else if (err?.message?.includes('timeout') || err?.message?.includes('Timeout')) {
          errorType = 'timeout'
          errorSuggestion = 'Connection timed out - check network connectivity and LiveKit server status'
        }

        console.error(`[useLiveKitRoom] 🔍 Error Analysis: ${errorType} - ${errorSuggestion}`)

        // Decide whether to retry
        if (!shouldRetry || retryCount >= maxRetries) {
          console.log(`[useLiveKitRoom] 🚫 Not retrying - max attempts reached or non-retryable error`)
          setError(err?.message || 'Failed to connect to LiveKit')
          setConnectionStatus('error')
          setRoom(null)
          break
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount)
        console.log(`[useLiveKitRoom] ⏳ Retrying in ${delay}ms...`)
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
        retryCount++
      }
    }
    
    connectingRef.current = false
  }, [
    roomName,
    user,
    allowPublish,
    autoPublish,
    roomOptions,
    fetchToken,
    removeParticipantState,
    addParticipant,
    registerExistingParticipants,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    publishLocalTracks,
    enabled,
  ])

  const disconnect = useCallback(() => {
    stopLocalTracks()
    const connectedRoom = roomRef.current
    if (connectedRoom) {
      cleanupRoom()
      connectedRoom.disconnect()
    }
    setRoom(null)
    setParticipants({})
    setConnectionStatus('disconnected')
    roomRef.current = null
  }, [cleanupRoom, stopLocalTracks])

  useEffect(() => {
    if (!roomName || !user) {
      return
    }

    void connect()

    return () => {
      disconnect()
    }
  }, [roomName, user, connect, disconnect])

  const participantsList = useMemo(() => Object.values(participants), [participants])
  const localParticipant = useMemo(
    () => participants[room?.localParticipant?.identity || ''] ?? null,
    [participants, room]
  )

  return {
    room,
    participants,
    participantsList,
    localParticipant,
    connectionStatus,
    error,
    isPublishing,
    connect,
    disconnect,
    publishLocalTracks,
    stopLocalTracks,
  }
}
