import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../lib/store'
import { notifyAdmins } from '../lib/notifications'
import api from '../lib/api'
import { REPORT_REASONS, type ReportReason } from '../types/moderation'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetUserId?: string | null
  streamId?: string | null
  targetType: 'user' | 'stream'
  onSuccess?: () => void
}

export default function ReportModal({
  isOpen,
  onClose,
  targetUserId,
  streamId,
  targetType,
  onSuccess
}: ReportModalProps) {
  const { user } = useAuthStore()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast.error('You must be logged in to submit a report')
      return
    }

    if (!reason) {
      toast.error('Please select a reason')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/moderation', {
        action: 'submit_report',
        reporter_id: user.id,
        target_user_id: targetUserId || null,
        stream_id: streamId || null,
        reason,
        description: description.trim() || null
      })

      if (response.success) {
        // Notify admins
        await notifyAdmins(
          'New Report Filed',
          `Report filed against ${targetType === 'user' ? 'User' : 'Stream'} for ${reason}`,
          'report_filed',
          { reporterId: user.id, targetId: targetUserId || streamId, type: targetType, reason }
        )

        toast.success('Report submitted. Our Troll Officers will review soon.')
        setReason('')
        setDescription('')
        onSuccess?.()
        onClose()
      } else {
        toast.error(response.error || 'Failed to submit report')
      }
    } catch (err: any) {
      console.error('Report submission error:', err)
      toast.error(err?.message || 'Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-md w-full p-6 relative">
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
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h2 className="text-2xl font-bold text-white">
              Report {targetType === 'user' ? 'User' : 'Stream'}
            </h2>
          </div>
          <p className="text-sm text-gray-400">
            Help us keep Troll City safe by reporting inappropriate behavior
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Reason for Report *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="">Select a reason...</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context..."
              rows={4}
              className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason || loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

