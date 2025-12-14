import {
  Room,
  RoomEvent,
  createLocalVideoTrack,
  createLocalAudioTrack,
  Track,
  TrackPublication,
  Participant,
} from 'livekit-client'
import { useEffect, useRef } from 'react'

interface VideoFeedProps {
  room: Room | null
  isHost?: boolean
}

export default function VideoFeed({ room, isHost = false }: VideoFeedProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!room) return

    let published = false

    /* ===============================
       HOST: PUBLISH LOCAL TRACKS
    =============================== */
    const publishLocalTracks = async () => {
      if (!isHost || published) return

      try {
        const permissions =
          (room.localParticipant as any)?.permissions ||
          (room.localParticipant as any)?.participantInfo?.permissions

        if (permissions?.canPublish === false) {
          console.warn('[LiveKit] Token blocks publishing')
          return
        }

        const alreadyPublishing =
          room.localParticipant.videoTrackPublications.size > 0 ||
          room.localParticipant.audioTrackPublications.size > 0

        if (alreadyPublishing) {
          published = true
          return
        }

        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack({
            resolution: { width: 1280, height: 720 },
          }),
          createLocalAudioTrack(),
        ])

        await room.localParticipant.publishTrack(videoTrack)
        await room.localParticipant.publishTrack(audioTrack)

        published = true

        if (localVideoRef.current) {
          videoTrack.attach(localVideoRef.current)
          localVideoRef.current.muted = true
          localVideoRef.current.playsInline = true
          await localVideoRef.current.play().catch(() => {})
        }
      } catch (err) {
        console.error('[LiveKit] Publish failed:', err)
      }
    }

    if (isHost) {
      if (room.state === 'connected') publishLocalTracks()
      else room.once(RoomEvent.Connected, publishLocalTracks)
    }

    /* ===============================
       REMOTE TRACK HANDLING
    =============================== */
    const handleTrackSubscribed = (
      track: Track,
      _publication: TrackPublication,
      participant: Participant
    ) => {
      if (!remoteContainerRef.current) return
      if (participant.isLocal) return

      if (track.kind === Track.Kind.Video) {
        const el = track.attach()
        el.className = 'w-full h-full object-cover rounded-3xl'
        remoteContainerRef.current.appendChild(el)
      }

      if (track.kind === Track.Kind.Audio) {
        track.attach()
      }
    }

    const handleTrackUnsubscribed = (track: Track) => {
      track.detach()
    }

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    }
  }, [room, isHost])

  return (
    <div className="absolute inset-0 rounded-3xl overflow-hidden bg-black">
      {isHost && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      <div
        ref={remoteContainerRef}
        className="absolute inset-0 w-full h-full z-0"
      />
    </div>
  )
}
