import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isAdminEmail } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  Shield, AlertTriangle, Eye, EyeOff, Ban, 
  CheckCircle, XCircle, Clock, Filter, Search
} from 'lucide-react'
import { ModerationReport } from '../types/moderation'
import ReportDetailsModal from '../components/ReportDetailsModal'
import api from '../lib/api'

export default function OfficerModeration() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const isAdmin = profile?.is_admin || profile?.role === 'admin' || (user?.email && isAdminEmail(user.email))
  const isOfficer = profile?.is_troll_officer || profile?.role === 'troll_officer'

  useEffect(() => {
    if (!profile || (!isOfficer && !isAdmin)) {
      toast.error('Access denied. Officer access required.')
      navigate('/', { replace: true })
      return
    }

    loadReports()
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('moderation_reports')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'moderation_reports'
      }, () => {
        loadReports()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, navigate, statusFilter])

  const loadReports = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const response = await api.post('/moderation', {
        action: 'list_reports',
        status_filter: statusFilter === 'all' ? null : statusFilter
      })

      if (response.success) {
        setReports(response.reports || [])
      } else {
        toast.error(response.error || 'Failed to load reports')
      }
    } catch (err: any) {
      console.error('Error loading reports:', err)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        report.reporter_username?.toLowerCase().includes(search) ||
        report.target_username?.toLowerCase().includes(search) ||
        report.reason?.toLowerCase().includes(search) ||
        report.description?.toLowerCase().includes(search)
      )
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-900 text-yellow-300', icon: Clock },
      reviewing: { color: 'bg-blue-900 text-blue-300', icon: Eye },
      resolved: { color: 'bg-green-900 text-green-300', icon: CheckCircle },
      action_taken: { color: 'bg-purple-900 text-purple-300', icon: Shield },
      rejected: { color: 'bg-red-900 text-red-300', icon: XCircle }
    }
    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  if (!profile || (!isOfficer && !isAdmin)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-xl p-8 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300 mb-4">
            This page is restricted to Troll Officers and Administrators.
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              Officer Moderation Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Review and manage moderation reports</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="action_taken">Action Taken</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Reports ({filteredReports.length})
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No reports found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2">Reporter</th>
                    <th className="text-left py-2">Target</th>
                    <th className="text-left py-2">Reason</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-left py-2">Created</th>
                    <th className="text-center py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${report.reporter_username}`)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {report.reporter_username || 'Unknown'}
                        </button>
                      </td>
                      <td className="py-2">
                        {report.target_username ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/profile/${report.target_username}`)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            {report.target_username}
                          </button>
                        ) : report.stream_title ? (
                          <span className="text-gray-300">{report.stream_title}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-300">
                        {report.reason}
                      </td>
                      <td className="text-center py-2">
                        {getStatusBadge(report.status)}
                      </td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-center py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onActionTaken={() => {
            setSelectedReport(null)
            loadReports()
          }}
        />
      )}
    </div>
  )
}

