// BattleScoreboard: Display host vs opponent totals
import React from 'react'
import { motion } from 'framer-motion'

interface BattleScoreboardProps {
  hostTotal: number
  opponentTotal: number
  hostUsername?: string
  opponentUsername?: string
  timeRemaining?: number // seconds
}

export default function BattleScoreboard({
  hostTotal,
  opponentTotal,
  hostUsername = 'Host',
  opponentUsername = 'Opponent',
  timeRemaining,
}: BattleScoreboardProps) {
  const total = hostTotal + opponentTotal
  const hostPercentage = total > 0 ? (hostTotal / total) * 100 : 50
  const opponentPercentage = total > 0 ? (opponentTotal / total) * 100 : 50

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-sm rounded-xl p-4 min-w-[400px] border border-purple-500/50">
      {/* Timer */}
      {timeRemaining !== undefined && (
        <div className="text-center mb-3">
          <div className="text-2xl font-bold text-yellow-400">
            {formatTime(timeRemaining)}
          </div>
        </div>
      )}

      {/* Score Bars */}
      <div className="flex gap-4 items-center">
        {/* Host Side */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1">{hostUsername}</div>
          <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${hostPercentage}%` }}
              transition={{ duration: 0.5 }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400"
            />
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
              {hostTotal.toLocaleString()}
            </div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="text-xl font-bold text-purple-400">VS</div>

        {/* Opponent Side */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 text-right">{opponentUsername}</div>
          <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${opponentPercentage}%` }}
              transition={{ duration: 0.5 }}
              className="absolute inset-y-0 right-0 bg-gradient-to-r from-yellow-400 to-yellow-600"
            />
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
              {opponentTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="text-center mt-2 text-xs text-gray-400">
        Total: {(hostTotal + opponentTotal).toLocaleString()} coins
      </div>
    </div>
  )
}

