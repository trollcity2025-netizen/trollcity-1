// TrollEventOverlay: Red/Green Troll walking across stream
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import api from '../../lib/api'

interface TrollEvent {
  id: string
  stream_id: string
  event_type: 'red' | 'green'
  coin_reward: number
  started_at: string
  expires_at: string
}

interface TrollEventOverlayProps {
  streamId: string
  userJoinedAt: Date // When user joined the stream
}

export default function TrollEventOverlay({ streamId, userJoinedAt }: TrollEventOverlayProps) {
  const { user } = useAuthStore()
  const [activeEvent, setActiveEvent] = useState<TrollEvent | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)

  // Load and subscribe to troll events
  useEffect(() => {
    if (!streamId) return

    const loadActiveEvent = async () => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('troll_events')
        .select('*')
        .eq('stream_id', streamId)
        .gte('expires_at', now)
        .lte('started_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error loading troll event:', error)
        return
      }

      if (data) {
        setActiveEvent(data)
        // Check if user can claim (joined before event started)
        const eventStart = new Date(data.started_at)
        if (userJoinedAt <= eventStart) {
          setHasClaimed(false) // User is eligible
        } else {
          setHasClaimed(true) // User joined after event started, can't claim
        }
      } else {
        setActiveEvent(null)
        setHasClaimed(false)
      }
    }

    loadActiveEvent()

    // Subscribe to new events
    const channel = supabase
      .channel(`troll-events-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'troll_events',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const event = payload.new as TrollEvent
          const now = new Date()
          const eventStart = new Date(event.started_at)
          const eventExpires = new Date(event.expires_at)

          if (now >= eventStart && now <= eventExpires) {
            setActiveEvent(event)
            // Check eligibility
            if (userJoinedAt <= eventStart) {
              setHasClaimed(false)
            } else {
              setHasClaimed(true)
            }
          }
        }
      )
      .subscribe()

    // Check expiration every second
    const interval = setInterval(() => {
      if (activeEvent) {
        const now = new Date()
        const expiresAt = new Date(activeEvent.expires_at)
        if (now > expiresAt) {
          setActiveEvent(null)
          setHasClaimed(false)
        }
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [streamId, activeEvent, userJoinedAt])

  const handleTrollClick = async () => {
    if (!activeEvent || !user || hasClaimed || isClaiming) return

    setIsClaiming(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Not authenticated')
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/troll-events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'claim_event',
            event_id: activeEvent.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim event')
      }

      setHasClaimed(true)
      toast.success(`🎉 +${activeEvent.coin_reward} coins!`, {
        description: `${activeEvent.event_type === 'red' ? 'Red' : 'Green'} Troll caught!`,
      })

      // Hide event after 2 seconds
      setTimeout(() => {
        setActiveEvent(null)
      }, 2000)
    } catch (error: any) {
      console.error('Error claiming troll event:', error)
      toast.error(error.message || 'Failed to claim event')
    } finally {
      setIsClaiming(false)
    }
  }

  if (!activeEvent) return null

  const isRed = activeEvent.event_type === 'red'
  const canClick = !hasClaimed && !isClaiming && user

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '-100%', opacity: 0 }}
        animate={{ x: '200%', opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 8, ease: 'linear' }}
        className="fixed top-1/2 left-0 z-[100] pointer-events-auto"
        onClick={canClick ? handleTrollClick : undefined}
        style={{ cursor: canClick ? 'pointer' : 'default' }}
      >
        <div
          className={`text-8xl drop-shadow-[0_0_20px_${isRed ? '#FF0000' : '#00FF00'}] ${
            canClick ? 'hover:scale-110 transition-transform' : 'opacity-50'
          }`}
        >
          {isRed ? '🔴' : '🟢'}
        </div>
        {canClick && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-xs bg-black/70 px-2 py-1 rounded whitespace-nowrap">
            Click for +{activeEvent.coin_reward} coins!
          </div>
        )}
        {hasClaimed && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-xs bg-yellow-500/70 px-2 py-1 rounded whitespace-nowrap">
            Already claimed
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

