import React from 'react'

interface UserBadgeProps {
  profile: {
    is_officer?: boolean
    is_og?: boolean
    is_troll_officer?: boolean
    is_og_user?: boolean
    role?: string
    level?: number
    prestige_level?: number
    drivers_license_status?: string
    is_landlord?: boolean
  } | null | undefined
}

export default function UserBadge({ profile }: UserBadgeProps) {
    if (!profile) return null
    return null
}
