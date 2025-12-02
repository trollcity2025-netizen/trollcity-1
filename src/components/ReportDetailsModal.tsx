import { useState } from 'react'
import { X, Shield, Ban, EyeOff, AlertTriangle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ModerationReport, TakeActionPayload } from '../types/moderation'
import api from '../lib/api'
import { useAuthStore } from '../lib/store'

interface ReportDetailsModalProps {
  report: ModerationReport
  onClose: () => void
  onActionTaken: () => void
}

export default function ReportDetailsModal({
  report,
  onClose,
  onActionTaken
}: ReportDetailsModalProps) {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [actionType, setActionType] = useState<'warn' | 'suspend_stream' | 'ban_user' | 'reject' | ''>('')
  const [actionReason, setActionReason] = useState('')
  const [actionDetails, setActionDetails] = useState('')
  const [banDurationHours, setBanDurationHours] = useState<number | null>(null)
  const [isPermanentBan, setIsPermanentBan] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)

  const handleTakeAction = async () => {
    if (!actionType || !actionReason.trim()) {
      toast.error('Please select an action and provide a reason')
      return
    }

    if (actionType === 'reject') {
      // Handle reject separately
      setLoading(true)
      try {
        const response = await api.post('/moderation', {
          action: 'reject_report',
          report_id: report.id
        })

        if (response.success) {
          toast.success('Report rejected')
          onActionTaken()
        } else {
          toast.error(response.error || 'Failed to reject report')
        }
      } catch (err: any) {
        console.error('Reject error:', err)
        toast.error('Failed to reject report')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      // Calculate ban expiry if temporary ban
      let expiresAt = null
      if (actionType === 'ban_user' && !isPermanentBan && banDurationHours) {
        const expiryDate = new Date()
        expiryDate.setHours(expiryDate.getHours() + banDurationHours)
        expiresAt = expiryDate.toISOString()
      }

      const payload: TakeActionPayload = {
        report_id: report.id,
        action_type: actionType as 'warn' | 'suspend_stream' | 'ban_user',
        target_user_id: report.target_user_id || null,
        stream_id: report.stream_id || null,
        reason: actionReason,
        action_details: actionDetails.trim() || null,
        expires_at: expiresAt,
        ban_duration_hours: banDurationHours,
        honesty_message_shown: true
      }

      const response = await api.post('/moderation', {
        action: 'take_action',
        ...payload
      })

      if (response.success) {
        toast.success(`Action taken: ${actionType}`)
        onActionTaken()
      } else {
        toast.error(response.error || 'Failed to take action')
      }
    } catch (err: any) {
      console.error('Action error:', err)
      toast.error('Failed to take action')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-2xl w-full p-6 relative my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Report Details
          </h2>
        </div>

        {/* Report Info */}
        <div className="space-y-4 mb-6">
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Reporter:</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(`/profile/${report.reporter_username}`)
                  }}
                  className="ml-2 text-blue-400 hover:text-blue-300"
                >
                  {report.reporter_username || 'Unknown'}
                </button>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>
                <span className="ml-2 text-yellow-400">{report.status}</span>
              </div>
              {report.target_username && (
                <div>
                  <span className="text-gray-400">Target User:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate(`/profile/${report.target_username}`)
                    }}
                    className="ml-2 text-purple-400 hover:text-purple-300"
                  >
                    {report.target_username}
                  </button>
                </div>
              )}
              {report.stream_title && (
                <div>
                  <span className="text-gray-400">Stream:</span>
                  <span className="ml-2 text-gray-300">{report.stream_title}</span>
                </div>
              )}
              <div>
                <span className="text-gray-400">Created:</span>
                <span className="ml-2 text-gray-300">
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Reason</h3>
            <p className="text-white bg-zinc-800 rounded-lg p-3">{report.reason}</p>
          </div>

          {report.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Description</h3>
              <p className="text-gray-300 bg-zinc-800 rounded-lg p-3 whitespace-pre-wrap">
                {report.description}
              </p>
            </div>
          )}
        </div>

        {/* Action Section */}
        {report.status === 'pending' || report.status === 'reviewing' ? (
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-bold text-white mb-4">Take Action</h3>

            {/* Action Type Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setActionType('warn')}
                className={`p-3 rounded-lg border-2 transition ${
                  actionType === 'warn'
                    ? 'border-yellow-500 bg-yellow-900/30'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                <span className="text-xs font-semibold">Warn</span>
              </button>

              {report.stream_id && (
                <button
                  type="button"
                  onClick={() => setActionType('suspend_stream')}
                  className={`p-3 rounded-lg border-2 transition ${
                    actionType === 'suspend_stream'
                      ? 'border-orange-500 bg-orange-900/30'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <EyeOff className="w-5 h-5 mx-auto mb-1 text-orange-400" />
                  <span className="text-xs font-semibold">Suspend Stream</span>
                </button>
              )}

              {report.target_user_id && (
                <button
                  type="button"
                  onClick={() => setActionType('ban_user')}
                  className={`p-3 rounded-lg border-2 transition ${
                    actionType === 'ban_user'
                      ? 'border-red-500 bg-red-900/30'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Ban className="w-5 h-5 mx-auto mb-1 text-red-400" />
                  <span className="text-xs font-semibold">Ban User</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActionType('reject')}
                className={`p-3 rounded-lg border-2 transition ${
                  actionType === 'reject'
                    ? 'border-gray-500 bg-gray-900/30'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <XCircle className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                <span className="text-xs font-semibold">Reject</span>
              </button>
            </div>

            {/* Action Reason */}
            {actionType && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Action Reason * (This will be shown to the user)
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                    className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  {(actionType === 'ban_user' || actionType === 'suspend_stream') && (
                    <p className="text-xs text-yellow-400 mt-2">
                      ⚠️ Being honest about why you were banned/suspended will help you get back on the app. 
                      Please provide a clear, honest reason.
                    </p>
                  )}
                </div>

                {/* Ban Duration (only for bans) */}
                {actionType === 'ban_user' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-300">
                      Ban Duration
                    </label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={isPermanentBan}
                          onChange={() => {
                            setIsPermanentBan(true)
                            setBanDurationHours(null)
                          }}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-300">Permanent</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!isPermanentBan}
                          onChange={() => setIsPermanentBan(false)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-300">Temporary</span>
                      </label>
                    </div>
                    {!isPermanentBan && (
                      <div>
                        <input
                          type="number"
                          min="1"
                          max="8760"
                          value={banDurationHours || ''}
                          onChange={(e) => setBanDurationHours(Number(e.target.value))}
                          placeholder="Hours (1-8760)"
                          className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        {banDurationHours && (
                          <p className="text-xs text-gray-400 mt-1">
                            Ban will expire in {banDurationHours} hours ({Math.round(banDurationHours / 24)} days)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={actionDetails}
                    onChange={(e) => setActionDetails(e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={3}
                    className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTakeAction}
                  disabled={!actionReason.trim() || loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : `Confirm ${actionType.replace('_', ' ').toUpperCase()}`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-gray-700 pt-6">
            <p className="text-gray-400 text-sm">
              This report has been {report.status === 'action_taken' ? 'resolved with action taken' : report.status}.
              {report.reviewer_username && (
                <span className="ml-2">
                  Reviewed by: <span className="text-purple-400">{report.reviewer_username}</span>
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

