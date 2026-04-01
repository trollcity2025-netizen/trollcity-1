import { useParams } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import BroadcasterCommandCenter from '../../components/live/BroadcasterCommandCenter'

export default function LiveCommandCenter() {
  const { streamId } = useParams()
  const { user } = useAuthStore()

  if (!streamId || !user?.id) return null

  return (
    <div className="min-h-screen bg-black">
      <BroadcasterCommandCenter streamId={streamId} broadcasterId={user.id} />
    </div>
  )
}
