import { useState, useEffect, useRef } from 'react'
import { Room, RoomEvent, RemoteParticipant, LocalParticipant } from 'livekit-client'

interface UseRoomOptions {
  url?: string
  token?: string
  onConnected?: (room: Room) => void
  onDisconnected?: () => void
}

export function useRoom({ url, token, onConnected, onDisconnected }: UseRoomOptions = {}) {
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<RemoteParticipant[]>([])
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    if (!url || !token) return

    const connect = async () => {
      try {
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        })

        // Set up event listeners
        newRoom.on(RoomEvent.Connected, () => {
          console.log('Room connected')
          setIsConnected(true)
          setLocalParticipant(newRoom.localParticipant)
          setIsCameraEnabled(newRoom.localParticipant.isCameraEnabled)
          setIsMicrophoneEnabled(newRoom.localParticipant.isMicrophoneEnabled)
          onConnected?.(newRoom)
        })

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('Room disconnected')
          setIsConnected(false)
          setParticipants([])
          setLocalParticipant(null)
          setViewerCount(0)
          onDisconnected?.()
        })

        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity)
          setParticipants((prev) => {
            if (prev.find((p) => p.identity === participant.identity)) return prev
            return [...prev, participant as RemoteParticipant]
          })
          setViewerCount((prev) => prev + 1)
        })

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity)
          setParticipants((prev) => prev.filter((p) => p.identity !== participant.identity))
          setViewerCount((prev) => Math.max(0, prev - 1))
        })

        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('Track subscribed:', track.kind, participant.identity)
        })

        newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
          console.log('Track unsubscribed:', track.kind)
        })

        // Connect to room
        await newRoom.connect(url, token)
        roomRef.current = newRoom
        setRoom(newRoom)
      } catch (error) {
        console.error('Failed to connect to room:', error)
      }
    }

    connect()

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [url, token])

  const toggleCamera = async () => {
    if (!room?.localParticipant) return
    const enabled = !room.localParticipant.isCameraEnabled
    await room.localParticipant.setCameraEnabled(enabled)
    setIsCameraEnabled(enabled)
  }

  const toggleMicrophone = async () => {
    if (!room?.localParticipant) return
    const enabled = !room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(enabled)
    setIsMicrophoneEnabled(enabled)
  }

  return {
    room,
    isConnected,
    participants,
    localParticipant,
    viewerCount,
    isCameraEnabled,
    isMicrophoneEnabled,
    toggleCamera,
    toggleMicrophone,
  }
}

