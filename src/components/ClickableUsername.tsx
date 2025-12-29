import React, { useEffect, useRef } from 'react'
import VerifiedBadge from './VerifiedBadge'
import OfficerTierBadge from './OfficerTierBadge'
import { EmpireBadge } from './EmpireBadge'
import { useNavigate } from 'react-router-dom'
import { Shield, Crown, Skull, Star } from 'lucide-react'
import { applyGlowingUsername } from '../lib/perkEffects'

interface ClickableUsernameProps {
   username: string
   className?: string
   prefix?: string // like '@'
   onClick?: () => void
   profile?: {
     is_troll_officer?: boolean
     is_admin?: boolean
     is_troller?: boolean
     is_og_user?: boolean
     is_verified?: boolean
     officer_level?: number
     troller_level?: number
     role?: string
     empire_role?: string | null
   }
   royalTitle?: {
     title_type: string
     is_active: boolean
   } | null
   userId?: string // Optional: if provided, will fetch profile
 }

const ClickableUsername: React.FC<ClickableUsernameProps> = ({
   username,
   className = '',
   prefix = '@',
   onClick,
   profile,
   royalTitle,
   userId
 }) => {
  const navigate = useNavigate()
  const usernameRef = useRef<HTMLSpanElement>(null)
  const targetUserId = userId || profile?.id

  useEffect(() => {
    if (!targetUserId || !usernameRef.current) {
      return
    }
    applyGlowingUsername(usernameRef.current, targetUserId)
  }, [targetUserId, username])
  
  // Use profile prop directly (parent component should fetch and pass it)
  const userProfile = profile

  // Determine admin, officer, and troller status from profile
  const isAdmin = userProfile?.is_admin || userProfile?.role === 'admin'
  const isOfficer = !isAdmin && (
    userProfile?.is_troll_officer || 
    userProfile?.role === 'troll_officer'
  )
  const isTroller = !isAdmin && !isOfficer && (
    userProfile?.is_troller || 
    userProfile?.role === 'troller'
  )
  
  const officerLevel = userProfile?.officer_level || 1
  const trollerLevel = userProfile?.troller_level || 1

  const officerRankTitles: Record<number, string> = {
    1: 'Officer',
    2: 'Senior Officer',
    3: 'Commander',
  }

  const trollerTitles: Record<number, string> = {
    1: 'Troller',
    2: 'Chaos Agent',
    3: 'Supreme Troll',
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!username || username.trim() === '') {
      console.error('ClickableUsername: username is empty or undefined')
      return
    }
    
    try {
      if (onClick) {
        onClick()
      }
      navigate(`/profile/${encodeURIComponent(username)}`)
    } catch (error) {
      console.error('Error navigating to profile:', error)
    }
  }

  return (
    <span
      onClick={handleClick}
      ref={usernameRef}
      className={`cursor-pointer hover:text-troll-gold transition-colors username ${isAdmin ? 'admin-user' : isOfficer ? 'officer-user' : isTroller ? 'troller-user' : ''} ${className}`}
      title={`View ${username}'s profile`}
    >
      {prefix}{username}
      
      {/* Admin Badge First Priority */}
      {isAdmin && (
        <span className="badge-icon admin-badge" title="Admin">
          <Crown size={18} />
          <span className="badge-title">Admin</span>
        </span>
      )}

      {/* Officer Badge (if not admin) */}
      {!isAdmin && isOfficer && (
        <>
          <span className="badge-icon officer-badge" title={officerRankTitles[officerLevel] || 'Officer'}>
            <Shield size={16} />
            <span className="badge-title">
              {officerLevel === 3 ? 'Commander' : officerLevel === 2 ? 'Senior Officer' : 'Officer'}
            </span>
          </span>
          <OfficerTierBadge level={officerLevel} size="sm" />
        </>
      )}

      {/* Troller Badge (if not admin or officer) */}
      {!isAdmin && !isOfficer && isTroller && (
        <span className="badge-icon troller-badge" title={trollerTitles[trollerLevel] || 'Troller'}>
          <Skull size={16} />
          <span className="badge-title">
            {trollerTitles[trollerLevel] || 'Troller'}
          </span>
        </span>
      )}

      {/* OG Badge (shows for all OG users, regardless of other badges) */}
      {userProfile?.is_og_user && (
        <span className="badge-icon og-badge" title="OG User - All users until Jan 1, 2026">
          <Star size={14} />
          <span className="badge-title">OG</span>
        </span>
      )}

      {/* Empire Partner Badge (shows for all partners, regardless of other badges) */}
      <EmpireBadge empireRole={userProfile?.empire_role} />

      {/* Royal Family Badge (highest priority, shows for active royal titles) */}
      {royalTitle && royalTitle.is_active && (
        <span className="badge-icon royal-badge" title="Status title earned through gifting. In-app role only.">
          <Crown size={16} className="text-yellow-400" />
          <span className="badge-title">
            {royalTitle.title_type === 'wife' ? 'Wife' : royalTitle.title_type === 'husband' ? 'Husband' : royalTitle.title_type.replace('_', ' ')}
          </span>
        </span>
      )}

      {/* Verified Badge (shows for all verified users) */}
      {userProfile?.is_verified && (
        <VerifiedBadge size="sm" title="Verified User" />
      )}
    </span>
  )
}

export default ClickableUsername
