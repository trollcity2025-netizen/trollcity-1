import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EntranceBanner from './EntranceEffect'
import ChatOverlay from './ChatOverlay'
import { AnimatePresence } from 'framer-motion'

interface EntranceChatPanelProps {
  streamId: string | undefined
}

interface EntranceEvent {
  id: string
  username: string
  role: 'viewer' | 'troller' | 'officer' | 'vip' | 'donor'
  timestamp: number
}

type UserRole = 'viewer' | 'troller' | 'officer' | 'vip' | 'donor'

function determineUserRole(profile: any): UserRole {
  // Check role field
  if (profile.role === 'troll_officer' || profile.role === 'moderator' || profile.role === 'admin') {
    return 'officer'
  }
  if (profile.role === 'troller' || profile.role === 'troll_family') {
    return 'troller'
  }

  // Check VIP/Donor status (high coin spending or balance)
  const totalSpent = profile.total_spent_coins || 0
  const paidBalance = profile.paid_coin_balance || 0

  if (totalSpent > 100000 || paidBalance > 50000) {
    return 'donor'
  }
  if (totalSpent > 50000 || paidBalance > 20000) {
    return 'vip'
  }

  return 'viewer'
}

export default function EntranceChatPanel({ streamId }: EntranceChatPanelProps) {
  const [entranceEvents, setEntranceEvents] = useState<EntranceEvent[]>([])

  useEffect(() => {
    if (!streamId) return

    const handleEntrance = async (entranceData: any) => {
      try {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, role, total_spent_coins, paid_coin_balance, is_troll_officer, is_og_user, officer_level')
          .eq('id', entranceData.user_id)
          .single()

        if (!profile) return

        const role = determineUserRole(profile)
        const entranceId = `${entranceData.id}-${Date.now()}`

        setEntranceEvents((prev) => [
          ...prev,
          {
            id: entranceId,
            username: profile.username,
            role,
            timestamp: Date.now(),
            profile: {
              is_troll_officer: profile.is_troll_officer,
              is_og_user: profile.is_og_user,
              role: profile.role,
            },
          },
        ])
      } catch (error) {
        console.error('Error handling entrance:', error)
      }
    }

    const channel = supabase
      .channel(`entrance-chat-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_entrances',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => handleEntrance(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

  const handleComplete = (id: string) => {
    setEntranceEvents((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <>
      {/* Entrance Events */}
      <div className="space-y-2 mb-3 max-h-[150px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {entranceEvents.map((event) => (
            <EntranceBanner
              key={event.id}
              username={event.username}
              role={event.role}
              profile={event.profile}
              onComplete={() => handleComplete(event.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Chat Messages - Compact version for sidebar */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatOverlay streamId={streamId} compact={true} />
      </div>
    </>
  )
}

