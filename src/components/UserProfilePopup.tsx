import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import ReportModal from './ReportModal'
import ClickableUsername from './ClickableUsername'

interface UserProfilePopupProps {
  userId: string
  username: string
  onClose: () => void
}

export default function UserProfilePopup({ userId, username, onClose }: UserProfilePopupProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
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
        <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-md w-full p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold">
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  <ClickableUsername username={username} profile={profile} />
                </h3>
                {profile?.is_officer && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs font-semibold mt-1">
                    <Shield className="w-3 h-3" />
                    Officer
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(`/profile/${username}`)
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
              >
                View Profile
              </button>
              {user && user.id !== userId && (
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Report
                </button>
              )}
            </div>
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

