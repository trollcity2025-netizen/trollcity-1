import { Eye, AlertTriangle } from 'lucide-react'
import { useStreamStats } from '../../hooks/useStreamStats'
import { Room } from 'livekit-client'
import { useState } from 'react'
import ReportModal from '../ReportModal'
import { useAuthStore } from '../../lib/store'

interface TopBarProps {
  room: Room | null
  streamerId: string | null
  streamId?: string | null
  popularity?: number
  trollFrequency?: number
}

export default function TopBar({ room, streamerId, streamId, popularity = 0, trollFrequency }: TopBarProps) {
  const { viewerCount, duration, streamerStats } = useStreamStats(room, streamerId)
  const { user } = useAuthStore()
  const [showReportModal, setShowReportModal] = useState(false)

  return (
    <>
      <div
        className="absolute top-4 left-4 flex flex-col gap-2 z-30"
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none' }}
      >
        {/* Main badge row */}
        <div className="flex items-center space-x-4 px-4 py-2 bg-black/80 rounded-full border border-purple-500">
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
      </div>

      {/* Popularity Level - Under LIVE badge */}
      <div className="px-4 py-2 bg-black/80 rounded-full border border-purple-500/50">
        <span className="text-purple-300 font-semibold text-sm">
          Popularity: <span className="text-pink-400 font-bold">{popularity.toLocaleString()}</span> / 1,000,000
        </span>
      </div>

      {/* Live Troll Frequency Setting - Demonstrates realtime updates */}
      {trollFrequency !== undefined && (
        <div className="px-4 py-2 bg-green-900/80 rounded-full border border-green-500/50 animate-pulse">
          <span className="text-green-300 font-semibold text-sm">
            🧌 Troll Frequency: <span className="text-green-400 font-bold">{trollFrequency}</span>
            <span className="text-green-500/70 text-xs ml-2">(Live)</span>
          </span>
        </div>
      )}

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

        {/* Report Stream Button */}
        {user && streamId && (
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 rounded-full border border-red-500/50 flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Stream
          </button>
        )}
      </div>

      {showReportModal && streamId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUserId={null}
          streamId={streamId}
          targetType="stream"
          onSuccess={() => setShowReportModal(false)}
        />
      )}
    </>
  )
}

