import React from 'react'
import { Crown, Shield, Skull, Star, Verified, Gem, Award, ClipboardList } from 'lucide-react'

interface NeonGlowUsernameProps {
  username: string
  avatarUrl?: string | null
  profile?: {
    is_admin?: boolean
    role?: string
    is_troll_officer?: boolean
    officer_level?: number
    is_troller?: boolean
    troller_level?: number
    is_og_user?: boolean
    is_verified?: boolean
    is_gold?: boolean
    username_style?: string
    badge?: string
    empire_role?: string | null
    rgb_username_expires_at?: string
    glowing_username_color?: string | null
  }
  size?: 'sm' | 'md' | 'lg'
  showBadges?: boolean
  onClick?: () => void
}

export default function NeonGlowUsername({ 
  username, 
  avatarUrl,
  profile, 
  size = 'md',
  showBadges = true,
  onClick
}: NeonGlowUsernameProps) {
  
  const sizeClasses = {
    sm: { avatar: 'w-8 h-8', text: 'text-sm', badge: 'w-5 h-5', badgeText: 'text-[10px]' },
    md: { avatar: 'w-10 h-10', text: 'text-base', badge: 'w-6 h-6', badgeText: 'text-xs' },
    lg: { avatar: 'w-14 h-14', text: 'text-lg', badge: 'w-7 h-7', badgeText: 'text-sm' },
  }

  const sizes = sizeClasses[size]

  // Check for special username effects
  const now = new Date()
  const hasRgb = profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > now
  const glowingColor = profile?.glowing_username_color

  // Determine primary role for glow color
  const isOfficerProfile = Boolean(profile?.is_troll_officer || profile?.role === 'troll_officer')
  const hasOfficerLevel = isOfficerProfile && profile?.officer_level && profile.officer_level > 0

  const getGlowColor = () => {
    if (profile?.is_admin || profile?.role === 'admin') return 'shadow-[0_0_15px_rgba(248,113,113,0.6)] border-red-500/50'
    if (profile?.role === 'temp_city_admin') return 'shadow-[0_0_15px_rgba(248,113,113,0.5)] border-red-400/50'
    if (hasOfficerLevel) return 'shadow-[0_0_15px_rgba(96,165,250,0.6)] border-blue-500/50'
    if (profile?.is_troller || profile?.role === 'troller') return 'shadow-[0_0_15px_rgba(192,132,252,0.6)] border-purple-500/50'
    if (profile?.is_gold || profile?.username_style === 'gold' || profile?.badge === 'president') return 'shadow-[0_0_15px_rgba(250,204,21,0.6)] border-yellow-500/50'
    return 'shadow-[0_0_10px_rgba(107,114,128,0.3)] border-zinc-500/30'
  }

  const getRoleColor = () => {
    if (profile?.is_admin || profile?.role === 'admin') return 'text-red-400'
    if (profile?.role === 'temp_city_admin') return 'text-red-400'
    if (hasOfficerLevel) return 'text-blue-400'
    if (profile?.is_troller || profile?.role === 'troller') return 'text-purple-400'
    return 'text-white'
  }

  const getUsernameColor = () => {
    if (profile?.is_gold || profile?.username_style === 'gold' || profile?.badge === 'president') 
      return 'text-yellow-400'
    return 'text-white'
  }

  // Get special username classes
  const getSpecialClasses = () => {
    let classes = ''
    if (hasRgb) classes += ' rgb-username'
    if (glowingColor && !hasRgb) classes += ' glowing-username'
    return classes
  }

  // Get role-specific badge
  const getPrimaryBadge = () => {
    if (profile?.is_admin || profile?.role === 'admin') 
      return { icon: Crown, color: 'text-red-400', label: 'Admin' }
    if (profile?.role === 'temp_city_admin') 
      return { icon: Shield, color: 'text-red-400', label: 'City Admin' }
    if (hasOfficerLevel && profile.officer_level === 3) 
      return { icon: Shield, color: 'text-blue-400', label: 'Commander' }
    if (hasOfficerLevel && profile.officer_level === 2) 
      return { icon: Shield, color: 'text-cyan-400', label: 'Sr. Officer' }
    if (hasOfficerLevel && profile.officer_level === 1) 
      return { icon: Shield, color: 'text-sky-400', label: 'Officer' }
    if (profile?.troller_level === 3) 
      return { icon: Skull, color: 'text-purple-400', label: 'Supreme Troll' }
    if (profile?.troller_level === 2) 
      return { icon: Skull, color: 'text-fuchsia-400', label: 'Chaos Agent' }
    if (profile?.troller_level === 1) 
      return { icon: Skull, color: 'text-pink-400', label: 'Troller' }
    return null
  }

  const primaryBadge = getPrimaryBadge()

  if (!showBadges) {
    return (
      <div 
        className={`flex items-center gap-2 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={onClick}
      >
        {avatarUrl && (
          <img src={avatarUrl} alt={username} className={`${sizes.avatar} rounded-full`} />
        )}
        <span className={`font-bold ${sizes.text} ${getUsernameColor()} ${getSpecialClasses()}`}>
          @{username}
        </span>
      </div>
    )
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 border ${getGlowColor()} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt={username} className={`${sizes.avatar} rounded-full ring-2 ring-white/20`} />
      ) : (
        <div className={`${sizes.avatar} rounded-full bg-zinc-800 flex items-center justify-center`}>
          <span className={`${sizes.text} text-white/60`}>{username[0]?.toUpperCase()}</span>
        </div>
      )}

      {/* Username & Badges */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-bold ${sizes.text} ${getUsernameColor()} ${getSpecialClasses()}`}>
            @{username}
          </span>
          
          {/* Primary Role Badge */}
          {primaryBadge && (
            <span 
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${sizes.badgeText} font-medium bg-black/40 border border-white/10 ${primaryBadge.color}`}
              title={primaryBadge.label}
            >
              <primaryBadge.icon size={12} />
              {primaryBadge.label}
            </span>
          )}

          {/* Secondary Badges Row */}
          <div className="flex items-center gap-1 mt-0.5">
            {/* OG Badge */}
            {profile?.is_og_user && (
              <span className="text-yellow-500" title="OG User">
                <Star size={14} fill="currentColor" />
              </span>
            )}
            
            {/* Verified Badge */}
            {profile?.is_verified && (
              <span className="text-cyan-400" title="Verified">
                <Verified size={14} />
              </span>
            )}
            
            {/* Empire Partner Badge */}
            {profile?.empire_role && (
              <span className="text-purple-400" title="Empire Partner">
                <Gem size={14} />
              </span>
            )}
            
            {/* Gold Badge (if not already gold username) */}
            {(profile?.is_gold || profile?.username_style === 'gold') && !profile?.badge && (
              <span className="text-yellow-400" title="Gold Member">
                <Award size={14} />
              </span>
            )}
            
            {/* Secretary Badge */}
            {profile?.role === 'secretary' && (
              <span className="text-pink-400" title="Secretary">
                <ClipboardList size={14} />
              </span>
            )}
          </div>
        </div>

        {/* Role-specific glow effect on text */}
        {primaryBadge && (
          <span className={`${sizes.badgeText} text-white/40`}>
            {primaryBadge.label}
          </span>
        )}
      </div>
    </div>
  )
}
