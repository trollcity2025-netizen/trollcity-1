import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Shield, AlertTriangle, Ban, EyeOff, CheckCircle, X } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import ReportDetailsModal from '../components/ReportDetailsModal'

export default function ReportDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      toast.error('Report ID is required')
      navigate('/officer/moderation')
      return
    }

    const loadReport = async () => {
      try {
        const { data, error } = await supabase
          .from('moderation_reports')
          .select(`
            *,
            reporter:user_profiles!reporter_id(username, avatar_url),
            target:user_profiles!target_user_id(username, avatar_url),
            stream:streams(id, title)
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        setReport(data)
      } catch (err: any) {
        console.error('Error loading report:', err)
        toast.error('Failed to load report')
        navigate('/officer/moderation')
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [id, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05030B] text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-purple-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Loading report...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#05030B] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Report not found</p>
          <button
            onClick={() => navigate('/officer/moderation')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
          >
            Back to Moderation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/officer/moderation')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Moderation
        </button>

        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6">
          <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Report Details
          </h1>

          <ReportDetailsModal
            report={report}
            isOpen={true}
            onClose={() => navigate('/officer/moderation')}
            onActionComplete={() => {
              toast.success('Action completed')
              navigate('/officer/moderation')
            }}
          />
        </div>
      </div>
    </div>
  )
}

