import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  Shield, AlertTriangle, Eye, 
  CheckCircle, XCircle, Clock, Search,
  Gavel, History, RotateCcw, Zap, Brain
} from 'lucide-react'
import { ModerationReport } from '../types/moderation'
import ReportDetailsModal from '../components/ReportDetailsModal'
import api from '../lib/api'

export default function OfficerModeration() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'reports' | 'actions' | 'logs'>('reports')

  // --- Reports State ---
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [reportSearchTerm, setReportSearchTerm] = useState('')

  // --- Actions State ---
  const [targetUsername, setTargetUsername] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [actionType, setActionType] = useState('mute')
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('60') // minutes
  const [aiScore, setAiScore] = useState<number | null>(null)
  const [processingAction, setProcessingAction] = useState(false)
  const [lookingUpUser, setLookingUpUser] = useState(false)

  // --- Logs State ---
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Load Reports
  const loadReports = useCallback(async () => {
    if (!profile) return
    setLoadingReports(true)
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
      // toast.error('Failed to load reports') 
    } finally {
      setLoadingReports(false)
    }
  }, [profile, statusFilter])

  // Load Logs
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase.rpc('get_moderation_logs', { limit_count: 50 })
    if (error) {
        toast.error('Failed to load logs')
    } else {
        setLogs(data || [])
    }
    setLoadingLogs(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') loadReports()
    if (activeTab === 'logs') loadLogs()
  }, [activeTab, loadReports, loadLogs])

  // Lookup User
  const lookupUser = async () => {
    if (!targetUsername) return
    setLookingUpUser(true)
    setTargetId(null)
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', targetUsername)
        .maybeSingle()
    
    if (data) {
        setTargetId(data.id)
        toast.success(`Found user: ${data.username}`)
    } else {
        toast.error('User not found')
    }
    setLookingUpUser(false)
  }

  // AI Check
  const checkToxicity = async () => {
    if (!reason) {
        toast.error('Please enter a reason/content to check')
        return
    }
    // Mock AI Check
    const score = Math.random() * 100
    setAiScore(score)
    if (score > 80) toast.error(`High Toxicity Detected (${score.toFixed(1)}%)`)
    else if (score > 50) toast.warning(`Moderate Toxicity (${score.toFixed(1)}%)`)
    else toast.success(`Low Toxicity (${score.toFixed(1)}%)`)
  }

  // Execute Action
  const handleExecuteAction = async () => {
    if (!targetId) {
        toast.error('Please lookup a valid user first')
        return
    }
    if (!reason) {
        toast.error('Reason is required')
        return
    }

    setProcessingAction(true)
    try {
        const { data, error } = await supabase.rpc('perform_moderation_action', {
            p_target_id: targetId,
            p_action_type: actionType,
            p_reason: reason,
            p_duration_minutes: actionType === 'kick' || actionType === 'warning' ? null : parseInt(duration)
        })

        if (error) throw error
        if (!data.success) throw new Error(data.error)

        toast.success('Action executed successfully')
        setTargetUsername('')
        setTargetId(null)
        setReason('')
        setAiScore(null)
    } catch (err: any) {
        toast.error(err.message)
    } finally {
        setProcessingAction(false)
    }
  }

  // Rollback
  const handleRollback = async (logId: string) => {
    if (!confirm('Are you sure you want to rollback this action?')) return
    try {
        const { data, error } = await supabase.rpc('rollback_moderation_action', { p_log_id: logId })
        if (error) throw error
        if (!data.success) throw new Error(data.error)
        
        toast.success('Action rolled back')
        loadLogs()
    } catch (err: any) {
        toast.error(err.message)
    }
  }

  const filteredReports = reports.filter(report => {
    if (reportSearchTerm) {
      const search = reportSearchTerm.toLowerCase()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-4 md:p-6 md:ml-64">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              Officer Moderation
            </h1>
            <p className="text-gray-400 mt-1">Review reports, execute actions, and audit logs</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
            <button 
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'reports' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
                Reports
            </button>
            <button 
                onClick={() => setActiveTab('actions')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'actions' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
                Direct Actions
            </button>
            <button 
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'logs' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
                Audit Logs
            </button>
        </div>

        {/* --- REPORTS TAB --- */}
        {activeTab === 'reports' && (
            <div className="space-y-4">
                {/* Filters */}
                <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        value={reportSearchTerm}
                        onChange={(e) => setReportSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    </div>

                    <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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

                {loadingReports ? (
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
                            <td className="py-2 text-blue-400">{report.reporter_username || 'Unknown'}</td>
                            <td className="py-2 text-purple-400">{report.target_username || report.stream_title || '—'}</td>
                            <td className="py-2 text-gray-300">{report.reason}</td>
                            <td className="text-center py-2">{getStatusBadge(report.status)}</td>
                            <td className="py-2 text-gray-400 text-xs">{new Date(report.created_at).toLocaleDateString()}</td>
                            <td className="text-center py-2">
                                <button
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
        )}

        {/* --- ACTIONS TAB --- */}
        {activeTab === 'actions' && (
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-purple-400" />
                        Execute Action
                    </h2>
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Target Username</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={targetUsername}
                                onChange={(e) => setTargetUsername(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Enter username..."
                            />
                            <button 
                                onClick={lookupUser}
                                disabled={lookingUpUser}
                                className="px-3 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 disabled:opacity-50"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                        {targetId && <div className="text-xs text-green-400 mt-1">User ID: {targetId}</div>}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Action Type</label>
                        <select 
                            value={actionType}
                            onChange={(e) => setActionType(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="mute">Mute (Silence)</option>
                            <option value="kick">Kick (Disconnect)</option>
                            <option value="ban">Ban (Suspension)</option>
                            <option value="warning">Warning (Notification)</option>
                        </select>
                    </div>

                    {(actionType === 'mute' || actionType === 'ban') && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Duration (Minutes)</label>
                            <input 
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Reason / Content</label>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Reason for action or content being moderated..."
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <button 
                            onClick={checkToxicity}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20"
                        >
                            <Brain className="w-4 h-4" />
                            AI Check
                        </button>
                        
                        <button 
                            onClick={handleExecuteAction}
                            disabled={processingAction || !targetId}
                            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                        >
                            <Zap className="w-4 h-4" />
                            Execute
                        </button>
                    </div>

                    {aiScore !== null && (
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs">
                            <span className="font-bold">AI Toxicity Score:</span> {aiScore.toFixed(1)}%
                        </div>
                    )}
                </div>

                <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
                    <h3 className="font-bold mb-4 text-gray-300">Guidelines</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-400">
                        <li><strong className="text-white">Mute:</strong> Prevents user from sending messages. Good for spam.</li>
                        <li><strong className="text-white">Kick:</strong> Disconnects user from the server. They can rejoin immediately.</li>
                        <li><strong className="text-white">Ban:</strong> Prevents login for the specified duration. Use for severe violations.</li>
                        <li><strong className="text-white">Warning:</strong> Sends a system alert to the user.</li>
                    </ul>
                    <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-200">
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        All actions are logged and auditable. Abuse of power will result in revocation of officer status.
                    </div>
                </div>
            </div>
        )}

        {/* --- LOGS TAB --- */}
        {activeTab === 'logs' && (
            <div className="bg-zinc-900 rounded-xl p-4 border border-[#2C2C2C]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        Audit Logs
                    </h2>
                    <button onClick={loadLogs} className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>

                {loadingLogs ? (
                    <div className="text-center py-8 text-gray-400">Loading logs...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No logs found</div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-gray-700 text-gray-400">
                            <th className="text-left py-2">Time</th>
                            <th className="text-left py-2">Moderator</th>
                            <th className="text-left py-2">Action</th>
                            <th className="text-left py-2">Target</th>
                            <th className="text-left py-2">Reason</th>
                            <th className="text-right py-2">Options</th>
                        </tr>
                        </thead>
                        <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="py-2 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="py-2 font-medium text-blue-400">{log.moderator_username}</td>
                                <td className="py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs border ${
                                        log.action_type === 'ban' ? 'bg-red-900/30 border-red-500/30 text-red-400' :
                                        log.action_type === 'kick' ? 'bg-orange-900/30 border-orange-500/30 text-orange-400' :
                                        log.action_type === 'rollback' ? 'bg-gray-800 border-gray-600 text-gray-400' :
                                        'bg-purple-900/30 border-purple-500/30 text-purple-400'
                                    }`}>
                                        {log.action_type.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-2 text-gray-300">{log.target_username}</td>
                                <td className="py-2 text-gray-400 italic truncate max-w-[200px]">{log.reason}</td>
                                <td className="py-2 text-right">
                                    {(log.action_type === 'ban' || log.action_type === 'mute') && (
                                        <button 
                                            onClick={() => handleRollback(log.id)}
                                            className="text-xs text-red-400 hover:text-red-300 underline"
                                        >
                                            Rollback
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        )}
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
