import { useParams } from 'react-router-dom'
import StreamEnergyMeter from '../../components/live/StreamEnergyMeter'
import TopFansLeaderboard from '../../components/live/TopFansLeaderboard'
import MilestonesTimeline from '../../components/live/MilestonesTimeline'
import StreamGoalsTracker from '../../components/live/StreamGoalsTracker'

export default function LiveStreamOverlay() {
  const { streamId } = useParams()

  if (!streamId) return null

  return (
    <div className="min-h-screen bg-transparent relative pointer-events-none">
      <div className="pointer-events-auto absolute top-4 right-4">
        <StreamEnergyMeter streamId={streamId} />
      </div>
      <div className="pointer-events-auto absolute top-4 left-4 max-w-xs">
        <TopFansLeaderboard streamId={streamId} compact />
      </div>
      <div className="pointer-events-auto absolute bottom-4 right-4 max-w-sm">
        <StreamGoalsTracker streamId={streamId} compact />
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-4 max-w-xs">
        <MilestonesTimeline streamId={streamId} horizontal />
      </div>
    </div>
  )
}
