// EasterHuntBanner
// Compact banner showing Easter egg hunt progress, shown when hunt is active.

import React from 'react'
import { useEasterEggHunt } from '@/contexts/EasterEggHuntContext'

export default function EasterHuntBanner() {
  const { isActive, eggsFound, maxEggs, canFindMore } = useEasterEggHunt()

  if (!isActive) return null

  const progress = eggsFound / maxEggs

  return (
    <div
      className="mx-3 mb-1 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,182,193,0.15) 0%, rgba(221,160,221,0.12) 50%, rgba(135,206,235,0.10) 100%)',
        border: '1px solid rgba(255,182,193,0.25)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">🥚</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold" style={{ color: '#FF69B4' }}>
              Easter Egg Hunt
            </p>
            <p className="text-[10px] font-semibold" style={{ color: canFindMore ? '#FF69B4' : '#4CAF50' }}>
              {canFindMore ? `${eggsFound}/${maxEggs} found` : 'All found!'}
            </p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,182,193,0.15)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #FF69B4, #DDA0DD, #87CEEB)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
