import { Participant } from 'livekit-client'
import VideoBox from './VideoBox'

interface HostVideoStreamProps {
  participant: Participant | null
  isHost: boolean
}

export default function HostVideoStream({ participant, isHost }: HostVideoStreamProps) {
  if (!participant) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-xl">
        <div className="text-gray-400">Waiting for host...</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <VideoBox
        participant={participant}
        size="full"
        label="🎥 Host"
        isHost={isHost}
      />
    </div>
  )
}

