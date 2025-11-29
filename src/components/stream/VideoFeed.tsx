import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client'
import { useEffect, useRef } from 'react'

interface VideoFeedProps {
  livekitUrl: string
  token: string
  isHost?: boolean
  onRoomReady?: (room: Room) => void
}

export default function VideoFeed({ livekitUrl, token, isHost = false, onRoomReady }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    if (!livekitUrl || !token) return

    let room: Room | null = null

    const connectStream = async () => {
      try {
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })

        // Connect to room
        await room.connect(livekitUrl, token)
        roomRef.current = room

        // If host, publish local tracks
        if (isHost) {
          const [videoTrack, audioTrack] = await Promise.all([
            createLocalVideoTrack(),
            createLocalAudioTrack(),
          ])

          await room.localParticipant.publishTrack(videoTrack)
          await room.localParticipant.publishTrack(audioTrack)

          // Attach video to preview
          if (videoRef.current) {
            videoTrack.attach(videoRef.current)
            videoRef.current.muted = true
            videoRef.current.play()
          }
        }

        // Handle remote tracks
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'video') {
            if (participant.isLocal && videoRef.current) {
              // Local video already attached above
            } else if (!participant.isLocal) {
              // Remote video - attach to parent container
              const element = track.attach()
              if (videoRef.current?.parentElement) {
                const container = videoRef.current.parentElement
                // Clear existing remote videos
                const existingRemote = container.querySelector('.remote-video-container')
                if (existingRemote) {
                  existingRemote.remove()
                }
                // Create container for remote video
                const remoteContainer = document.createElement('div')
                remoteContainer.className = 'remote-video-container absolute inset-0 w-full h-full'
                remoteContainer.appendChild(element)
                container.appendChild(remoteContainer)
              }
            }
          } else if (track.kind === 'audio') {
            track.attach()
          }
        })

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach()
        })

        onRoomReady?.(room)
      } catch (error) {
        console.error('Failed to connect stream:', error)
      }
    }

    connectStream()

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [livekitUrl, token, isHost, onRoomReady])

  return (
    <div className="absolute inset-0 rounded-3xl overflow-hidden">
      {isHost && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      )}
      {!isHost && (
        <div className="w-full h-full bg-black">
          {/* Remote videos will be attached here via TrackSubscribed event */}
        </div>
      )}
    </div>
  )
}

