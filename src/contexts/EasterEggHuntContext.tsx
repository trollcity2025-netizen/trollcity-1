// Easter Egg Hunt Context
// Provides egg state, found count, and collection actions to all components

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import {
  isEasterHuntActive,
  canUserFindEgg,
  getLocalEggFinds,
  saveLocalEggFind,
  generateRandomEggReward,
  applyEggReward,
  generateEggSpawns,
  EASTER_HUNT_CONFIG,
  type EggReward,
  type EggSpawn,
} from '@/lib/events/easterEggHunt'

// ── Types ───────────────────────────────────────────────────────────────

interface FoundEgg {
  eggId: string
  reward: EggReward
  foundAt: number
}

interface EasterEggHuntContextType {
  isActive: boolean
  eggsFound: number
  eggsRemaining: number
  maxEggs: number
  canFindMore: boolean
  foundEggs: FoundEgg[]
  collectEgg: (spawn: EggSpawn, pageId: string) => Promise<boolean>
  getSpawnsForPage: (pageId: string) => EggSpawn[]
  isEggFound: (eggId: string) => boolean
}

const EasterEggHuntContext = createContext<EasterEggHuntContextType | undefined>(undefined)

// ── Provider ────────────────────────────────────────────────────────────

export function EasterEggHuntProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || ''
  const [foundEggs, setFoundEggs] = useState<FoundEgg[]>([])
  const [isActive, setIsActive] = useState(false)

  // Check if hunt is active
  useEffect(() => {
    const check = () => setIsActive(isEasterHuntActive())
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  // Load found eggs from localStorage on mount / user change
  useEffect(() => {
    if (!userId) {
      setFoundEggs([])
      return
    }
    const localFinds = getLocalEggFinds(userId)
    setFoundEggs(
      localFinds.map((f) => ({
        eggId: f.eggId,
        reward: f.reward,
        foundAt: new Date(f.foundAt).getTime(),
      }))
    )
  }, [userId])

  const eggsFound = foundEggs.length
  const maxEggs = EASTER_HUNT_CONFIG.maxEggsPerUser
  const eggsRemaining = maxEggs - eggsFound
  const canFindMore = userId ? canUserFindEgg(userId) : false

  const isEggFound = useCallback(
    (eggId: string) => foundEggs.some((e) => e.eggId === eggId),
    [foundEggs]
  )

  const getSpawnsForPage = useCallback(
    (pageId: string) => generateEggSpawns(pageId),
    []
  )

  const collectEgg = useCallback(
    async (spawn: EggSpawn, _pageId: string): Promise<boolean> => {
      if (!userId) {
        toast.error('Sign in to collect Easter eggs!')
        return false
      }

      if (!isActive) {
        toast.error('Easter Egg Hunt is not active right now!')
        return false
      }

      if (!canUserFindEgg(userId)) {
        toast.error(`You already found ${maxEggs} eggs! That is the max.`)
        return false
      }

      if (isEggFound(spawn.id)) {
        return false
      }

      // Generate reward
      const reward = generateRandomEggReward()

      // Apply reward
      const result = await applyEggReward(userId, reward)

      if (result.success) {
        // Save locally
        saveLocalEggFind(userId, {
          eggId: spawn.id,
          reward,
          foundAt: new Date().toISOString(),
        })

        setFoundEggs((prev) => [
          ...prev,
          { eggId: spawn.id, reward, foundAt: Date.now() },
        ])

        toast.success(`Easter Egg found! ${result.message}`, {
          duration: 4000,
          icon: getRewardEmoji(reward.type),
        })
        return true
      } else {
        toast.error(result.message)
        return false
      }
    },
    [userId, isActive, isEggFound, maxEggs]
  )

  const value = useMemo(
    () => ({
      isActive,
      eggsFound,
      eggsRemaining,
      maxEggs,
      canFindMore,
      foundEggs,
      collectEgg,
      getSpawnsForPage,
      isEggFound,
    }),
    [isActive, eggsFound, eggsRemaining, maxEggs, canFindMore, foundEggs, collectEgg, getSpawnsForPage, isEggFound]
  )

  return (
    <EasterEggHuntContext.Provider value={value}>
      {children}
    </EasterEggHuntContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useEasterEggHunt() {
  const ctx = useContext(EasterEggHuntContext)
  if (!ctx) {
    throw new Error('useEasterEggHunt must be used within EasterEggHuntProvider')
  }
  return ctx
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getRewardEmoji(type: EggReward['type']): string {
  switch (type) {
    case 'coins': return '🪙'
    case 'trollmonds': return '💎'
    case 'kick_insurance': return '🛡️'
    case 'free_box_price': return '📦'
    case 'ability': return '🎮'
    default: return '🥚'
  }
}
