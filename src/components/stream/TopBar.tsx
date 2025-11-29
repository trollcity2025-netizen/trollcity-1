import { Eye } from 'lucide-react'
import { useStreamStats } from '../../hooks/useStreamStats'
import { Room } from 'livekit-client'

interface TopBarProps {
  room: Room | null
  streamerId: string | null
}

export default function TopBar({ room, streamerId }: TopBarProps) {
  const { viewerCount, duration, streamerStats } = useStreamStats(room, streamerId)

  return (
    <div className="absolute top-4 left-4 flex items-center space-x-4 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-purple-500 z-30">
      {/* LIVE Badge */}
      <span className="px-3 py-1 rounded-full bg-red-600 text-white font-bold shadow-lg animate-pulse">
        LIVE
      </span>

      {/* Timer */}
      <span className="text-white text-sm font-mono">{duration}</span>

      {/* Viewer Count */}
      <span className="text-cyan-300 font-bold flex items-center gap-1">
        <Eye size={16} />
        {viewerCount}
      </span>

      {/* Streamer Profile */}
      {streamerStats && (
        <div className="flex items-center space-x-2 bg-purple-800/60 px-3 py-1 rounded-full">
          <span className="text-white font-medium">{streamerStats.username}</span>
          {streamerStats.level && (
            <span className="text-yellow-400 font-semibold">Lv {streamerStats.level}</span>
          )}
          <span className="text-green-300 font-semibold">
            {streamerStats.total_earned_coins || 0} 💎
          </span>
        </div>
      )}
    </div>
  )
}

