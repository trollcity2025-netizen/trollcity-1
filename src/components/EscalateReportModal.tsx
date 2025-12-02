import React, { useState } from 'react'
import { X, Shield, AlertTriangle, ArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

interface EscalateReportModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  escalationLevel: 'officer' | 'admin'
  onEscalated: () => void
}

export default function EscalateReportModal({
  isOpen,
  onClose,
  reportId,
  escalationLevel,
  onEscalated
}: EscalateReportModalProps) {
  const { user, profile } = useAuthStore()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleEscalate = async () => {
    if (!user?.id || !reason.trim()) {
      toast.error('Please provide a reason for escalation')
      return
    }

    setLoading(true)
    try {
      if (escalationLevel === 'officer') {
        const { data, error } = await supabase.rpc('escalate_to_officer', {
          p_report_id: reportId,
          p_escalator_id: user.id,
          p_reason: reason.trim(),
          p_description: description.trim() || null
        })

        if (error) throw error

        if (data?.success) {
          toast.success('Report escalated to officer')
          onEscalated()
          onClose()
        } else {
          toast.error(data?.error || 'Failed to escalate report')
        }
      } else if (escalationLevel === 'admin') {
        // Verify user is an officer
        if (!profile?.is_troll_officer && profile?.role !== 'troll_officer') {
          toast.error('Only officers can escalate to admin')
          return
        }

        const { data, error } = await supabase.rpc('escalate_to_admin', {
          p_report_id: reportId,
          p_officer_id: user.id,
          p_reason: reason.trim(),
          p_description: description.trim() || null
        })

        if (error) throw error

        if (data?.success) {
          toast.success('Report escalated to admin')
          onEscalated()
          onClose()
        } else {
          toast.error(data?.error || 'Failed to escalate report')
        }
      }
    } catch (err: any) {
      console.error('Error escalating report:', err)
      toast.error(err?.message || 'Failed to escalate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-2xl w-full p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUp className="w-6 h-6 text-purple-400" />
            Escalate Report to {escalationLevel === 'officer' ? 'Officer' : 'Admin'}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {escalationLevel === 'officer' 
              ? 'This report will be sent to a Troll Officer for review.'
              : 'This report will be sent to an Admin for review.'}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Escalation Reason *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you escalating this report?"
              className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional context..."
              rows={4}
              className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleEscalate}
              disabled={!reason.trim() || loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Escalating...' : `Escalate to ${escalationLevel === 'officer' ? 'Officer' : 'Admin'}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

