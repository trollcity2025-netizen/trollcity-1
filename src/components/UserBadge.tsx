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
  } | null | undefined
}

export function UserBadge({ profile }: UserBadgeProps) {
  if (!profile) return null

  // Check for officer status (multiple ways it might be stored)
  const isOfficer = profile.is_officer || profile.is_troll_officer || profile.role === 'troll_officer' || profile.role === 'officer'
  
  // Check for OG status
  const isOG = profile.is_og || profile.is_og_user

  // Check for Prestige
  const prestigeLevel = profile.prestige_level || 0
  const level = profile.level || 1

  return (
    <span className="inline-flex items-center gap-1 ml-1 align-middle">
      {/* Prestige Badge */}
      {prestigeLevel > 0 && (
        <span 
          className="text-yellow-500 font-bold text-[10px] border border-yellow-500/50 rounded px-1 bg-yellow-500/10"
          title={`Prestige ${prestigeLevel}`}
        >
          P{prestigeLevel}
        </span>
      )}

      {/* Level Badge */}
      <span 
        className={`text-[10px] px-1 rounded font-mono ${
          level >= 50 ? 'bg-red-900/50 text-red-300 border border-red-500/30' :
          level >= 25 ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' :
          level >= 10 ? 'bg-blue-900/50 text-blue-300 border border-blue-500/30' :
          'bg-gray-800 text-gray-400 border border-gray-600/30'
        }`}
        title={`Level ${level}`}
      >
        Lvl {level}
      </span>

      {/* Role Badges */}
      {isOfficer && (
        <span className="text-yellow-400 text-xs" title="Troll Officer">🛡️</span>
      )}
      
      {isOG && (
        <span className="text-purple-400 text-xs" title="OG User">👑</span>
      )}
    </span>
  )
}

