import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import UserNameWithAge from './UserNameWithAge'
import ReportModal from './ReportModal'
import { useAuthStore } from '../lib/store'

interface ClickableUsernameWithReportProps {
  username: string
  userId?: string
  className?: string
  prefix?: string
  profile?: {
    is_troll_officer?: boolean
    is_admin?: boolean
    is_troller?: boolean
    is_og_user?: boolean
    rgb_username_expires_at?: string
    officer_level?: number
    troller_level?: number
    role?: string
    created_at?: string
  }
}

const ClickableUsernameWithReport: React.FC<ClickableUsernameWithReportProps> = ({
  username,
  userId,
  className,
  prefix,
  profile
}) => {
  const { user } = useAuthStore()
  const [showReportModal, setShowReportModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Don't show report button if user is reporting themselves
  const canReport = user && userId && user.id !== userId

  // Construct user object for UserNameWithAge
  const userForAge = {
    username,
    ...profile
  }

  return (
    <>
      <div className="relative inline-block">
        <UserNameWithAge
          user={userForAge}
          className={className}
          prefix={prefix}
          onClick={() => setShowMenu(!showMenu)}
        />
        {canReport && showMenu && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-purple-500/30 rounded-lg shadow-lg z-50 min-w-[120px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowReportModal(true)
                setShowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Report User
            </button>
          </div>
        )}
      </div>

      {showReportModal && userId && (
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

export default ClickableUsernameWithReport
