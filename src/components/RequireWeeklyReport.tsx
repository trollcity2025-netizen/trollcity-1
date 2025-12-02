import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { FileText, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

export function RequireWeeklyReport({ children }: Props) {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [lastReportDate, setLastReportDate] = useState<string | null>(null)

  useEffect(() => {
    checkReportStatus()
  }, [profile?.id])

  const checkReportStatus = async () => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    try {
      // Fetch last report's week_end
      const { data, error } = await supabase
        .from('weekly_officer_reports')
        .select('week_end')
        .eq('lead_officer_id', profile.id)
        .order('week_end', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking report:', error)
        setLoading(false)
        return
      }

      if (data) {
        setLastReportDate(data.week_end)
        const lastReport = new Date(data.week_end)
        const now = new Date()
        const daysSince = Math.floor((now.getTime() - lastReport.getTime()) / (1000 * 60 * 60 * 24))
        
        // Block if report is more than 7 days old
        if (daysSince > 7) {
          setBlocked(true)
        }
      } else {
        // No reports found - check if they've been a lead officer for more than 7 days
        const profileCreated = profile?.created_at ? new Date(profile.created_at) : new Date()
        const daysSinceCreation = Math.floor((Date.now() - profileCreated.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceCreation > 7) {
          setBlocked(true)
        }
      }
    } catch (error) {
      console.error('Error in checkReportStatus:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <div className="rounded-2xl border-2 border-red-500 bg-red-500/10 p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-300 mb-4">Weekly Report Required</h1>
            <p className="text-red-200 mb-6">
              You must submit your weekly report before accessing other Lead Officer pages.
            </p>
            <a
              href="/lead-officer"
              className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/50 transition-all"
            >
              <FileText className="w-5 h-5 inline mr-2" />
              Go to Dashboard & Submit Report
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

