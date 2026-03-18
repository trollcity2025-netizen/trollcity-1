import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Shield, FileText, UserPlus, UserMinus, Ban, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { isAdmin } from '../lib/adminCoins'
import ReportModal from './ReportModal'
import UserNameWithAge from './UserNameWithAge'
import AdminProfilePanel from './AdminProfilePanel'
import { toast } from 'sonner'

interface UserProfilePopupProps {
  userId: string
  username: string
  onClose: () => void
  onOpenChat?: (userId: string, username: string) => void
}

export default function UserProfilePopup({ userId, username, onClose, onOpenChat }: UserProfilePopupProps) {
  const { user, profile: userProfile } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setProfile(null)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Check follow and block status
  const checkFollowBlockStatus = useCallback(async () => {
    if (!user) return
    
    // Check follow status
    const { data: followData } = await supabase
      .from('user_follows')
      .select('*')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle()
    setIsFollowing(!!followData)

    // Check block status
    const { data: blockData } = await supabase
      .from('user_blocks')
      .select('*')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .maybeSingle()
    setIsBlocked(!!blockData)
  }, [user, userId])

  useEffect(() => {
    loadProfile()
    setIsAdminUser(isAdmin(user, userProfile))
    checkFollowBlockStatus()
  }, [loadProfile, user, userProfile, checkFollowBlockStatus])

  const handleFollow = async () => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }
    setActionLoading(true)
    try {
      if (isFollowing) {
        await supabase.from('user_follows').delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId)
        setIsFollowing(false)
        toast.success(`Unfollowed @${username}`)
      } else {
        await supabase.from('user_follows').insert({
          follower_id: user.id,
          following_id: userId
        })
        setIsFollowing(true)
        toast.success(`Following @${username}`)
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
      toast.error('Failed to update follow status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }
    const confirmMessage = isBlocked 
      ? `Are you sure you want to unblock @${username}?`
      : `Are you sure you want to block @${username}? They will not be able to message you or view your profile.`
    
    if (!confirm(confirmMessage)) return
    
    setActionLoading(true)
    try {
      if (isBlocked) {
        await supabase.from('user_blocks').delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId)
        setIsBlocked(false)
        toast.success(`Unblocked @${username}`)
      } else {
        await supabase.from('user_blocks').insert({
          blocker_id: user.id,
          blocked_id: userId
        })
        setIsBlocked(true)
        toast.success(`Blocked @${username}`)
      }
    } catch (err) {
      console.error('Error toggling block:', err)
      toast.error('Failed to update block status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMessage = () => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }
    if (onOpenChat) {
      onOpenChat(userId, username)
    } else {
      navigate(`/messages?user=${username}`)
    }
    onClose()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={username} className="w-full h-full object-cover" />
                ) : (
                  username.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  <UserNameWithAge 
                    user={profile || { username, id: userId }} 
                    className="text-white"
                  />
                </h3>
                {profile?.is_officer && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs font-semibold mt-1">
                    <Shield className="w-3 h-3" />
                    Officer
                  </span>
                )}
                {profile?.terms_accepted && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-semibold mt-1 ml-2">
                    <FileText className="w-3 h-3" />
                    Agreement Accepted
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons Grid */}
            {user && user.id !== userId && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={actionLoading}
                  className={`px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    isFollowing 
                      ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleMessage}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
              </div>
            )}

            {/* Second Row: View Profile, Block, Report */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(`/profile/${username}`)
                }}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors text-white border border-zinc-700"
              >
                View Profile
              </button>
              {user && user.id !== userId && (
                <>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={actionLoading}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                      isBlocked
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                        : 'bg-red-900/50 hover:bg-red-900 text-red-400 border border-red-800'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {isAdminUser && user?.id !== userId && (
              <>
                <div className="border-t border-gray-700" />
                <AdminProfilePanel userId={userId} username={username} />
              </>
            )}
          </div>
        </div>
      </div>

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUserId={userId}
          streamId={null}
          targetType="user"
          onSuccess={() => setShowReportModal(false)}
        />
      )}
    </>
  )
}

