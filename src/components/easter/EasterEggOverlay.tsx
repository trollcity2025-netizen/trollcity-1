// EasterEggOverlay
// Renders hidden Easter eggs over any page during the hunt.
// Drop this component into any page to enable egg hunting there.

import React, { useEffect, useMemo } from 'react'
import { useEasterEggHunt } from '@/contexts/EasterEggHuntContext'
import HiddenEasterEgg, { injectEasterEggStyles } from './HiddenEasterEgg'
import type { EggSpawn } from '@/lib/events/easterEggHunt'

interface EasterEggOverlayProps {
  pageId: string
}

export default function EasterEggOverlay({ pageId }: EasterEggOverlayProps) {
  const { isActive, collectEgg, getSpawnsForPage, isEggFound, canFindMore } = useEasterEggHunt()

  // Inject CSS keyframes once
  useEffect(() => {
    injectEasterEggStyles()
  }, [])

  // Generate spawns for this page
  const spawns = useMemo(() => getSpawnsForPage(pageId), [pageId, getSpawnsForPage])

  // Don't render anything if hunt is not active or user can't find more
  if (!isActive || !canFindMore) return null

  const handleCollect = async (spawn: EggSpawn) => {
    return collectEgg(spawn, pageId)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
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
