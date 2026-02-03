import React, { useMemo } from 'react'
import ClickableUsername from './ClickableUsername'
import { UserProfile } from '../lib/supabase'
import { useTimeStore } from '../hooks/useGlobalTime'

interface UserNameWithAgeProps {
  user: Partial<UserProfile> & { username: string; age_days?: number; created_at?: string }
  className?: string
  showBadges?: boolean
  onClick?: () => void
  prefix?: string
  isBroadcaster?: boolean
  isModerator?: boolean
  streamId?: string
}

export default function UserNameWithAge({
  user,
  className = '',
  showBadges = true,
  onClick,
  prefix,
  isBroadcaster,
  isModerator,
  streamId
}: UserNameWithAgeProps) {
  // Use global time store to ensure updates across the app without manual refresh
  const now = useTimeStore((state) => state.now)

  const age = useMemo(() => {
    if (user.age_days !== undefined) return user.age_days
    if (user.created_at) {
      const created = new Date(user.created_at)
      // Calculate difference in milliseconds using the global 'now'
      const diffTime = now.getTime() - created.getTime()
      // Convert to days, use floor to get whole days
      // Ensure non-negative
      return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
    }
    return 0
  }, [user.age_days, user.created_at, now])

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <ClickableUsername
        username={user.username}
        profile={user}
        onClick={onClick}
        prefix={prefix}
        isBroadcaster={isBroadcaster}
        isModerator={isModerator}
        streamId={streamId}
      />
      <span className="text-gray-500 text-xs select-none font-mono" title={`Account Age: ${age} days`}>
        • {age}d
      </span>
    </span>
  )
}
