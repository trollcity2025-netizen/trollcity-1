import React, { useEffect, useRef, useState } from 'react'
import VerifiedBadge from './VerifiedBadge'
import OfficerTierBadge from './OfficerTierBadge'
import { EmpireBadge } from './EmpireBadge'
import { useNavigate } from 'react-router-dom'
import { Shield, Crown, Skull, Star, UserX, Ban, MicOff, User, LogOut } from 'lucide-react'
import { applyGlowingUsername } from '../lib/perkEffects'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import SummonModal from './SummonModal'

interface ClickableUsernameProps {
  username: string
  className?: string
  prefix?: string // like '@'
  onClick?: () => void
  profile?: {
    id?: string
    is_troll_officer?: boolean
    is_admin?: boolean
    is_troller?: boolean
    is_og_user?: boolean
    is_verified?: boolean
    officer_level?: number
    troller_level?: number
    role?: string
    empire_role?: string | null
    rgb_username_expires_at?: string
  }
  royalTitle?: {
    title_type: string
    is_active: boolean
  } | null
  userId?: string // Optional: if provided, will fetch profile
  isBroadcaster?: boolean
  isModerator?: boolean // Stream moderator
  streamId?: string
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({
  username,
  className = '',
  prefix = '@',
  onClick,
  profile,
  royalTitle,
  userId,
  isBroadcaster,
  isModerator,
  streamId
}) => {
  const navigate = useNavigate()
  const usernameRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showSummonModal, setShowSummonModal] = useState(false)
  const { user: currentUser, profile: currentUserProfile } = useAuthStore()
  
  const targetUserId = userId || profile?.id
  const userProfile = profile

  // Check if current user is staff
  const isStaff = currentUserProfile?.is_admin || 
                 currentUserProfile?.is_troll_officer || 
                 currentUserProfile?.role === 'admin' || 
                 currentUserProfile?.role === 'troll_officer'

  const canModerate = (isStaff || ((isBroadcaster || isModerator) && streamId)) && currentUser?.id !== targetUserId

  useEffect(() => {
    if (!targetUserId || !usernameRef.current) {
      return
    }
    
    // Check profile prop first for instant RGB feedback
    const el = usernameRef.current
    const hasRgb = userProfile?.rgb_username_expires_at && new Date(userProfile.rgb_username_expires_at) > new Date()
    if (hasRgb) {
      el.classList.add('rgb-username')
    } else {
      el.classList.remove('rgb-username')
      applyGlowingUsername(el, targetUserId)
    }
  }, [targetUserId, username, userProfile])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && !usernameRef.current?.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isStaff && targetUserId && targetUserId !== currentUser?.id) {
      setShowSummonModal(true)
    }
  }

  const handleAction = async (action: string) => {
    setShowMenu(false)
    
    if (!targetUserId) {
        toast.error('Cannot perform action: User ID not found')
        return
    }

    switch (action) {
        case 'view_profile':
            if (userId) {
                navigate(`/profile/id/${userId}`)
            } else {
                navigate(`/profile/${encodeURIComponent(username)}`)
            }
            break
            
        case 'ban': {
            const reason = window.prompt('Reason for warrant/ban:', 'Violation of rules')
            if (reason === null) return // Cancelled
            
            // Replaced Ban with Issue Warrant as requested
            try {
                const { data, error } = await supabase.rpc('issue_warrant', {
                    p_user_id: targetUserId,
                    p_reason: reason || 'No reason provided'
                })

                if (error) throw error
                if (data && data.success) {
                   toast.success(`Warrant issued for ${username}. Access restricted until court appearance.`)
                } else {
                   toast.error(data?.error || 'Failed to issue warrant')
                }
            } catch (err: any) {
                console.error('Error issuing warrant:', err)
                toast.error(err.message || 'Failed to issue warrant')
            }
            break
        }

        case 'stream_mute': {
            if (!streamId) return;
            try {
                const { error } = await supabase
                   .from('streams_participants')
                   .update({ can_chat: false })
                   .eq('stream_id', streamId)
                   .eq('user_id', targetUserId);

                if (error) throw error
                toast.success(`User ${username} muted in stream`)
            } catch (err: any) {
                console.error('Error muting user in stream:', err)
                toast.error('Failed to mute user')
            }
            break;
       }

       case 'stream_kick': {
            if (!streamId) return;
            if (!confirm("Kick this user for 100 coins? They will be removed for 24h unless they pay the fee.")) return;

            try {
                // Use the new paid kick RPC
                const { data, error } = await supabase.rpc('kick_user_paid', { 
                    p_stream_id: streamId, 
                    p_target_user_id: targetUserId,
                    p_kicker_id: currentUser?.id 
                });

                if (error) throw error;
                
                if (data && !data.success) {
                    toast.error(data.message || "Failed to kick user");
                } else {
                    toast.success("User kicked (100 coins deducted)");
                }
            } catch (err: any) {
                console.error('Error kicking user from stream:', err)
                toast.error('Failed to kick user')
            }
            break;
       }

        case 'mute': {
            const reason = window.prompt('Reason for mute (optional):', 'Spamming')
            if (reason === null) return // Cancelled
            
            const durationStr = window.prompt('Mute duration in minutes:', '60') // Default 1h
            if (durationStr === null) return
            
            const minutes = parseInt(durationStr)
            if (isNaN(minutes)) {
                toast.error('Invalid duration')
                return
            }

            try {
                const { error } = await supabase.rpc('mute_user', {
                    target: targetUserId,
                    minutes: minutes,
                    reason: reason || 'No reason provided'
                })

                if (error) throw error
                toast.success(`User ${username} has been muted`)
            } catch (err: any) {
                console.error('Error muting user:', err)
                // Fallback if RPC doesn't exist yet or fails
                toast.error(err.message || 'Failed to mute user')
            }
            break
        }

        case 'delete': {
            if (confirm(`Are you sure you want to PERMANENTLY delete user ${username}? This action cannot be undone.`)) {
                try {
                    // Try to use admin API first if available (usually not on client)
                    // Or call a hypothetical delete RPC
                    // For now, we'll try a direct delete if RLS allows, or show error
                    
                    const { error } = await supabase.from('user_profiles').delete().eq('id', targetUserId)
                    
                    if (error) {
                        // If direct delete fails (likely RLS), try ban as fallback or inform user
                        throw error
                    }
                    
                    toast.success(`User ${username} deleted`)
                } catch (err: any) {
                    console.error('Error deleting user:', err)
                    toast.error('Failed to delete user. You may not have permission or need to use the Admin Dashboard.')
                }
            }
            break
        }
    }
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!username || username.trim() === '') {
      console.error('ClickableUsername: username is empty or undefined')
      return
    }

    // If staff/broadcaster and not clicking themselves, toggle menu
    if (canModerate) {
        setShowMenu(!showMenu)
        return
    }
    
    try {
      if (onClick) {
        onClick()
        return
      }
      
      if (userId) {
        navigate(`/profile/id/${userId}`)
      } else {
        navigate(`/profile/${encodeURIComponent(username)}`)
      }
    } catch (error) {
      console.error('Error navigating to profile:', error)
    }
  }

  return (
    <>
    <span className="relative inline-block z-10">
        <span
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
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

        {/* Staff Action Menu */}
        {showMenu && (
            <div 
                ref={menuRef}
                className="absolute z-50 top-full left-0 mt-1 w-48 bg-zinc-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
            >
                <div className="p-1">
                    <button
                        onClick={() => handleAction('view_profile')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-zinc-800 hover:text-white rounded flex items-center gap-2"
                    >
                        <User size={14} />
                        View Profile
                    </button>

                    {/* Stream Specific Actions */}
                    {isBroadcaster && streamId && (
                        <>
                            <button
                                onClick={() => handleAction('stream_mute')}
                                className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-zinc-800 hover:text-yellow-300 rounded flex items-center gap-2"
                            >
                                <MicOff size={14} />
                                Mute in Stream
                            </button>
                            <button
                                onClick={() => handleAction('stream_kick')}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 rounded flex items-center gap-2"
                            >
                                <LogOut size={14} />
                                Kick from Stream
                            </button>
                            <div className="border-t border-gray-800 my-1"></div>
                        </>
                    )}

                    {/* Global Staff Actions */}
                    {isStaff && (
                        <>
                            <button
                                onClick={() => handleAction('mute')}
                                className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-zinc-800 hover:text-yellow-300 rounded flex items-center gap-2"
                            >
                                <MicOff size={14} />
                                Global Mute
                            </button>
                            <button
                                onClick={() => handleAction('ban')}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 rounded flex items-center gap-2"
                            >
                                <Ban size={14} />
                                Global Ban
                            </button>
                            <button
                                onClick={() => handleAction('delete')}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-zinc-800 hover:text-red-500 rounded flex items-center gap-2 border-t border-gray-800 mt-1 pt-2"
                            >
                                <UserX size={14} />
                                Delete User
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}
    </span>
    {targetUserId && (
        <SummonModal
            isOpen={showSummonModal}
            onClose={() => setShowSummonModal(false)}
            userId={targetUserId}
            username={username}
        />
    )}
    </>
  )
}

export default ClickableUsername
