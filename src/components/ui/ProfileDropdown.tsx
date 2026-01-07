import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { getTierFromXP } from '../../lib/tierSystem'

interface ProfileDropdownProps {
  onLogout: () => void
  className?: string
}

export default function ProfileDropdown({ onLogout, className }: ProfileDropdownProps) {
  const { profile } = useAuthStore()

  if (!profile) return null

  const tier = profile.tier || getTierFromXP(profile.xp || 0).title

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <Link
        to={`/profile/${profile.username}`}
        className="relative group outline-none"
      >
        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-troll-neon-gold to-troll-neon-orange rounded-full flex items-center justify-center shadow-lg shadow-troll-neon-gold/20 border-2 border-troll-neon-gold/50 overflow-hidden group-hover:scale-105 transition-transform duration-300">
          {profile.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.username} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-troll-dark-bg font-bold text-lg">
              {profile.username?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}
