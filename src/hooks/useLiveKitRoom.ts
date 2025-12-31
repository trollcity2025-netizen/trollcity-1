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

export type LiveKitConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type LiveKitRoomConfig = {
  roomName?: string
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

type LiveKitTokenResponse = {
  token: string
  livekitUrl?: string
  room?: string
  allowPublish?: boolean
}

const buildTokenBody = (roomName: string, user: LiveKitRoomConfig['user'], allowPublish: boolean) => ({
  room: roomName,
  participantName: user?.username || user?.id,
  identity: user?.id,
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

export function useLiveKitRoom(config: LiveKitRoomConfig) {
  const { roomName, user, allowPublish = false, autoPublish = false, roomOptions } = config

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
      if (!roomName || !user?.id) {
        throw new Error('Missing room or user for LiveKit token')
      }

      const tokenResponse = await api.post<LiveKitTokenResponse>('/livekit-token', buildTokenBody(roomName, user, publish))
      const data = tokenResponse.data || tokenResponse

      if (!data || !data.token) {
        const message = (data as any)?.error || (tokenResponse as any)?.error || 'LiveKit token request failed'
        throw new Error(message)
      }

      return data as LiveKitTokenResponse
    },
    [roomName, user]
  )

  const updateParticipantState = useCallback(
    (identity: string, patch: Partial<LiveKitParticipantState>) => {
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
    },
    []
  )

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
      const [videoTrack, audioTrack] = await Promise.all([
        createLocalVideoTrack(),
        createLocalAudioTrack(),
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
        await participant.publishTrack(videoTrack)
      }
      if (audioTrack) {
        await participant.publishTrack(audioTrack)
      }
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
    if (!roomName || !user) return
    if (connectingRef.current) return
    connectingRef.current = true

    setConnectionStatus('connecting')
    setError(null)

    try {
      const tokenResponse = await fetchToken(allowPublish)
      const targetUrl = tokenResponse.livekitUrl || LIVEKIT_URL
      const newRoom = new Room({ ...defaultLiveKitOptions, ...roomOptions })

      newRoom.on(RoomEvent.Connected, () => {
        setConnectionStatus('connected')
        addParticipant(newRoom.localParticipant)
        registerExistingParticipants(newRoom)
      if (autoPublish && allowPublish) {
        void publishLocalTracks(newRoom)
      }
      })

      newRoom.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus('reconnecting')
      })

      newRoom.on(RoomEvent.Disconnected, () => {
        setConnectionStatus('disconnected')
        setRoom(null)
        setParticipants({})
      })

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        addParticipant(participant)
      })

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeParticipantState(participant.identity)
      })

      newRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      newRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)

      roomRef.current = newRoom
      await newRoom.connect(targetUrl, tokenResponse.token)
      setRoom(newRoom)
    } catch (err: any) {
      console.error('LiveKit connect failed', err)
      setError(err?.message || 'Failed to connect to LiveKit')
      setConnectionStatus('disconnected')
      setRoom(null)
    } finally {
      connectingRef.current = false
    }
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
