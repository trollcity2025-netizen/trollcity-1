// EasterEggGlobalOverlay
// Fixed-position overlay that renders Easter eggs on ALL pages.
// Placed at the App level to provide eggs across the entire app.

import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useEasterEggHunt } from '@/contexts/EasterEggHuntContext'
import HiddenEasterEgg, { injectEasterEggStyles } from './HiddenEasterEgg'
import type { EggSpawn } from '@/lib/events/easterEggHunt'
import { generateEggSpawns } from '@/lib/events/easterEggHunt'

export default function EasterEggGlobalOverlay() {
  const { isActive, collectEgg, isEggFound, canFindMore } = useEasterEggHunt()
  const location = useLocation()
  const [spawns, setSpawns] = useState<EggSpawn[]>([])

  // Inject CSS keyframes once
  useEffect(() => {
    injectEasterEggStyles()
  }, [])

  // Regenerate spawns when path changes
  useEffect(() => {
    if (!isActive || !canFindMore) {
      setSpawns([])
      return
    }
    // Use the current path as page ID for consistent egg placement
    const pageId = location.pathname.replace(/\//g, '_') || 'root'
    setSpawns(generateEggSpawns(pageId, 2))
  }, [location.pathname, isActive, canFindMore])

  if (!isActive || !canFindMore || spawns.length === 0) return null

  const pageId = location.pathname.replace(/\//g, '_') || 'root'

  const handleCollect = async (spawn: EggSpawn) => {
    return collectEgg(spawn, pageId)
  }

  return (
    <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, zIndex: 45 }}>
      <div className="pointer-events-auto">
        {spawns.map((spawn) => (
          <HiddenEasterEgg
            key={spawn.id}
            spawn={spawn}
            found={isEggFound(spawn.id)}
            onCollect={handleCollect}
          />
        ))}
      </div>
    </div>
  )
}
