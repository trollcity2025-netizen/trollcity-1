import React from 'react'

interface UserBadgeProps {
  profile: {
    is_officer?: boolean
    is_og?: boolean
    is_troll_officer?: boolean
    is_og_user?: boolean
    role?: string
  } | null | undefined
}

export function UserBadge({ profile }: UserBadgeProps) {
  if (!profile) return null

  // Check for officer status (multiple ways it might be stored)
  const isOfficer = profile.is_officer || profile.is_troll_officer || profile.role === 'troll_officer' || profile.role === 'officer'
  
  // Check for OG status
  const isOG = profile.is_og || profile.is_og_user

  if (isOfficer) {
    return <span className="ml-1 text-yellow-400">🛡️ Officer</span>
  }

  if (isOG) {
    return <span className="ml-1 text-purple-400">👑 OG</span>
  }

  return null
}

