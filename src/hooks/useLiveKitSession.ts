import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveKit } from '../contexts/LiveKitContext'

interface SessionOptions {
  roomName: string
  user: any
  role?: string
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
  } = useLiveKit()

  const [sessionError, setSessionError] = useState<string | null>(null)
  const joinStartedRef = useRef(false)

  const maxParticipants = options.maxParticipants ?? 6

  const joinAndPublish = useMemo(
    () => async () => {
      if (joinStartedRef.current) return false
      if (!options.roomName || !options.user?.identity) {
        setSessionError('Missing room or user for LiveKit')
        return false
      }

      joinStartedRef.current = true
      setSessionError(null)

      try {
        const connected = await connect(options.roomName, options.user, {
          autoPublish: options.autoPublish !== false,
        })
        if (!connected) throw new Error('LiveKit connection failed')

        const room = service.getRoom()
        if (!room) throw new Error('LiveKit room missing after connect')

        // Limit room size
        if (participants.size > maxParticipants) {
          disconnect()
          throw new Error('Room is full')
        }

        if (options.autoPublish !== false) {
          await room.localParticipant.setCameraEnabled(true)
          await room.localParticipant.setMicrophoneEnabled(true)
        }

        return true
      } catch (err: any) {
        setSessionError(err?.message || 'Failed to join stream')
        joinStartedRef.current = false
        return false
      }
    },
    [
      connect,
      disconnect,
      startPublishing,
      options.roomName,
      options.user,
      options.autoPublish,
      maxParticipants,
      participants.size,
    ]
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
    resetJoinGuard,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    error: sessionError || error,
    toggleCamera,
    toggleMicrophone,
  }
}
