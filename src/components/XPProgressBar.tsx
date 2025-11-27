import React from 'react'
import { ArrowUp } from 'lucide-react'
import { getXPForNextLevel, getLevelFromXP } from '../lib/tierSystem'

interface XPProgressBarProps {
  currentXP: number
  className?: string
}

function XPProgressBar({ currentXP, className = '' }: XPProgressBarProps) {
  const { needed, percentage } = getXPForNextLevel(currentXP)
  const currentLevel = getLevelFromXP(currentXP)

  if (currentLevel >= 100) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gold-400 font-bold">MAX LEVEL</span>
          <span className="text-gold-400">👑 Level 100</span>
        </div>
        <div className="h-3 bg-[#1A1A1A] rounded-full overflow-hidden border border-gold-500">
          <div 
            className="h-full bg-gradient-to-r from-yellow-500 via-gold-400 to-yellow-600 animate-pulse"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-400">
          <ArrowUp className="w-4 h-4 inline mr-1" />
          {needed.toLocaleString()} XP to level {currentLevel + 1}
        </span>
        <span className="text-troll-neon-blue font-semibold">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#2C2C2C]">
        <div 
          className="h-full bg-gradient-to-r from-troll-neon-blue to-troll-purple transition-all duration-500 ease-out relative overflow-hidden"
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
        </div>
      </div>
    </div>
  )
}

export default React.memo(XPProgressBar)