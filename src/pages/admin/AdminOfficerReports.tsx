import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { FileText, Calendar, User, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import ClickableUsername from '../../components/ClickableUsername'
import '../../styles/LeadOfficerDashboard.css'

interface WeeklyReport {
  id: string
  lead_officer_id: string
  week_start: string
  week_end: string
  title: string
  body: string
  incidents: string[]
  created_at: string
  updated_at: string
  lead_officer: {
    username: string
    avatar_url: string | null
  }
}

export default function AdminOfficerReports() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('weekly_officer_reports')
        .select(`
          *,
          lead_officer:user_profiles!weekly_officer_reports_lead_officer_id_fkey (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformed = (data || []).map((report: any) => ({
        ...report,
        lead_officer: Array.isArray(report.lead_officer) ? report.lead_officer[0] : report.lead_officer,
        incidents: Array.isArray(report.incidents) ? report.incidents : []
      }))

      setReports(transformed)
    } catch (error: any) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-300 mb-2 flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Officer Reports
          </h1>
          <p className="text-sm text-purple-400">
            Weekly reports submitted by Lead Officers
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-purple-800 bg-black/40 p-12 text-center">
            <FileText className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
            <p className="text-purple-400">No reports submitted yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-purple-800 bg-black/40 overflow-hidden hover:border-purple-600 transition-colors"
              >
                {/* Report Header */}
                <div
                  className="p-6 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={report.lead_officer?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${report.lead_officer?.username}`}
                        alt={report.lead_officer?.username}
                        className="w-10 h-10 rounded-full border border-purple-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <ClickableUsername 
                            username={report.lead_officer?.username || 'Unknown'}
                            className="font-semibold text-purple-200"
                          />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-purple-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(report.week_start)} - {formatDate(report.week_end)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-purple-100 mt-2">{report.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="text-purple-400 hover:text-purple-200 transition-colors"
                  >
                    {expandedReport === report.id ? (
                      <ChevronUp className="w-6 h-6" />
                    ) : (
                      <ChevronDown className="w-6 h-6" />
                    )}
                  </button>
                </div>

                {/* Expanded Content */}
                {expandedReport === report.id && (
                  <div className="border-t border-purple-800 p-6 space-y-4">
                    {/* Body */}
                    <div>
                      <h4 className="text-sm font-semibold text-purple-300 mb-2">Report Body</h4>
                      <div className="rounded-xl border border-purple-700 bg-black/40 p-4 text-purple-100 whitespace-pre-wrap font-mono text-sm">
                        {report.body}
                      </div>
                    </div>

                    {/* Incidents */}
                    {report.incidents && report.incidents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-purple-300 mb-2">Incidents</h4>
                        <div className="flex flex-wrap gap-2">
                          {report.incidents.map((incident, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold"
                            >
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              {incident}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-purple-400 pt-2 border-t border-purple-800">
                      Submitted: {formatDateTime(report.created_at)}
                      {report.updated_at !== report.created_at && (
                        <span className="ml-4">Updated: {formatDateTime(report.updated_at)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

