import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

interface TrollCatchProps {
  streamId?: string
  userId?: string
  onCatch?: (coins: number) => void
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default function TrollCatch({ streamId, userId, onCatch }: TrollCatchProps) {
  const { profile, setProfile } = useAuthStore()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: -150 })
  const animationFrameRef = useRef<number | null>(null)
  const isVisibleRef = useRef(false)
  const coinsRef = useRef(10) // Award 10 coins (can be adjusted)

  // 👹 Troll enters every 40 minutes (2400000 ms) per broadcast
  useEffect(() => {
    if (!streamId) return

    // Track last troll appearance time per stream using sessionStorage
    const storageKey = `troll-last-appearance-${streamId}`
    const lastAppearance = sessionStorage.getItem(storageKey)
    const now = Date.now()
    const fortyMinutes = 40 * 60 * 1000 // 40 minutes in milliseconds

    // Calculate time until next troll appearance
    let timeUntilNext = 0
    if (lastAppearance) {
      const timeSinceLast = now - parseInt(lastAppearance)
      timeUntilNext = Math.max(0, fortyMinutes - timeSinceLast)
    }

    // Function to show troll
    const showTroll = () => {
      isVisibleRef.current = true
      setIsVisible(true)
      coinsRef.current = randomInt(10, 50) // Random 10-50 coins
      sessionStorage.setItem(storageKey, Date.now().toString())

      // Auto hide in 12 seconds if not caught
      setTimeout(() => {
        isVisibleRef.current = false
        setIsVisible(false)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }, 12000)
    }

    let appearTimer: NodeJS.Timeout | null = null
    let recurringTimer: NodeJS.Timeout | null = null

    // Show immediately if enough time has passed (or first time)
    if (timeUntilNext === 0) {
      showTroll()
      // Set up recurring 40-minute intervals starting now
      recurringTimer = setInterval(() => {
        showTroll()
      }, fortyMinutes)
    } else {
      // Set up timer for next appearance
      appearTimer = setTimeout(() => {
        showTroll()
        // Then set up recurring 40-minute intervals
        recurringTimer = setInterval(() => {
          showTroll()
        }, fortyMinutes)
      }, timeUntilNext)
    }

    return () => {
      if (appearTimer) clearTimeout(appearTimer)
      if (recurringTimer) clearInterval(recurringTimer)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [streamId])

  // 🚶 Troll movement logic using requestAnimationFrame
  useEffect(() => {
    if (!isVisible) {
      // Clean up animation frame when hidden
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    let currentLeft = -150 // offscreen start
    const currentTop = randomInt(10, window.innerHeight - 160) // random height
    const speed = 3 // lower = slower | higher = faster (2.5–4 is sweet spot)
    setPosition({ top: currentTop, left: currentLeft })

    const move = () => {
      if (!isVisibleRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      currentLeft += speed
      setPosition({ top: currentTop, left: currentLeft })

      if (currentLeft < window.innerWidth + 150) {
        animationFrameRef.current = requestAnimationFrame(move)
      } else {
        isVisibleRef.current = false
        setIsVisible(false)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(move)
  }, [isVisible])

  const handleCatch = async (e?: React.MouseEvent) => {
    // Prevent default behavior and stop propagation to avoid page refresh
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!userId || !streamId) {
      toast.error('Cannot catch troll: missing user or stream')
      return
    }

    isVisibleRef.current = false
    setIsVisible(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const coins = coinsRef.current

    try {
      // Award coins via RPC
      const { error } = await supabase.rpc('add_free_coins', {
        p_user_id: userId,
        p_amount: coins,
      })

      if (error) {
        console.error('Error awarding coins:', error)
        // Fallback: Direct update
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('free_coin_balance')
          .eq('id', userId)
          .single()

        if (profileData) {
          await supabase
            .from('user_profiles')
            .update({
              free_coin_balance: (profileData.free_coin_balance || 0) + coins,
            })
            .eq('id', userId)
        }
      }

      // Refresh profile from database to get accurate balance
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      } else {
        // Fallback: Instantly update local profile balance if refresh fails
        if (profile) {
          const newBalance = (profile.free_coin_balance || 0) + coins
          setProfile({
            ...profile,
            free_coin_balance: newBalance,
          })
        }
      }

      // Send chat notification
      await supabase.from('stream_messages').insert({
        stream_id: streamId,
        user_id: userId,
        content: `🎉 Caught the Troll and earned ${coins} coins!`,
        message_type: 'system',
      })

      toast.success(`You caught the Troll! 🪙 +${coins} coins`)
      onCatch?.(coins)
    } catch (error) {
      console.error('Error catching troll:', error)
      toast.error('Failed to catch the Troll')
    }
  }

  if (!isVisible) return null

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleCatch(e)
      }}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '100px',
        height: '100px',
        cursor: 'pointer',
        zIndex: 2000,
        animation: 'wiggle 1s infinite ease-in-out',
      }}
      className="troll-catch"
    >
      {/* Troll Emoji (using emoji since no image file) */}
      <div className="text-7xl drop-shadow-[0_0_20px_#00ff66] filter brightness-110">
        🧌
      </div>

      {/* Coin indicator */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg">
        +{coinsRef.current} 💰
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 bg-green-400/30 blur-2xl rounded-full animate-pulse pointer-events-none" />
    </div>
  )
}

