import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { X, CheckCircle, XCircle, Award, User, Clock, FileText, AlertTriangle, Calendar } from 'lucide-react'
import ClickableUsername from '../../components/ClickableUsername'
import WeeklyReportForm from '../../components/WeeklyReportForm'
import WeeklyReportsList from '../../components/WeeklyReportsList'
import '../../styles/LeadOfficerDashboard.css'

type Applicant = {
  id: string
  username: string
  email?: string
  role?: string
  score: number | null
  has_passed: boolean | null
  completed_at: string | null
}

type Officer = {
  id: string
  username: string
  email?: string
  is_lead_officer: boolean
  is_troll_officer: boolean
}

type ActionLog = {
  id: string
  officer_id: string
  officer_username: string
  action_type: string
  acted_by: string
  acted_by_username: string
  reason: string | null
  created_at: string
}

type OrientationResult = {
  submitted_answers: Record<string, string>
  score: number
  has_passed: boolean
  completed_at: string
}

type LiveStream = {
  id: string
  title: string
  category?: string
  broadcaster_id: string
  current_viewers?: number
  status: string
  user_profiles?: {
    username: string
    avatar_url: string
  }
}

export function LeadOfficerDashboard() {
  const { user, profile } = useAuthStore()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [officers, setOfficers] = useState<Officer[]>([])
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [streamsLoading, setStreamsLoading] = useState(false)

  const [viewingUser, setViewingUser] = useState<Applicant | Officer | null>(null)
  const [viewResult, setViewResult] = useState<OrientationResult | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Weekly Report State
  const [weekStart, setWeekStart] = useState<string>('')
  const [weekEnd, setWeekEnd] = useState<string>('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportBody, setReportBody] = useState('')
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([])
  const [submittingReport, setSubmittingReport] = useState(false)
  const [lastReportDate, setLastReportDate] = useState<string | null>(null)
  const [weeklyReports, setWeeklyReports] = useState<any[]>([])
  const [showReportForm, setShowReportForm] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setCurrentUserId(authUser?.id ?? null)
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs(), loadLiveStreams(), loadWeeklyReports()])
    }
    init()

    // Subscribe to stream updates
    const channel = supabase
      .channel('lead-officer-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => {
        loadLiveStreams()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadLiveStreams = async () => {
    setStreamsLoading(true)
    try {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          broadcaster_id,
          current_viewers,
          status,
          is_live,
          user_profiles!broadcaster_id (
            username,
            avatar_url
          )
        `)
        .eq('is_live', true)
        .order('start_time', { ascending: false })

      if (error) throw error
      // Transform data to match LiveStream type
      const transformedStreams: LiveStream[] = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        broadcaster_id: s.broadcaster_id,
        current_viewers: s.current_viewers,
        status: s.status,
        user_profiles: Array.isArray(s.user_profiles) && s.user_profiles.length > 0 
          ? s.user_profiles[0] 
          : { username: 'Unknown', avatar_url: '' }
      }))
      setLiveStreams(transformedStreams)
    } catch (err) {
      console.error('Error loading live streams:', err)
      toast.error('Failed to load live streams')
    } finally {
      setStreamsLoading(false)
    }
  }

  const loadApplicants = async () => {
    try {
      // Get users who have taken the quiz but are not yet active officers
      const { data: results, error: resultsError } = await supabase
        .from('officer_orientation_results')
        .select('user_id, score, has_passed, completed_at')

      if (resultsError) throw resultsError

      // Get user profiles for applicants
      const userIds = results?.map(r => r.user_id) || []
      if (userIds.length === 0) {
        setApplicants([])
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, email, role, is_troll_officer, is_officer_active')
        .in('id', userIds)
        .eq('is_troll_officer', true)
        .eq('is_officer_active', false)
        .neq('role', 'admin') // Exclude admin users from applicant list

      if (profilesError) throw profilesError

      // Combine results with profiles
      const applicantsData = (profiles || []).map(profile => {
        const result = results?.find(r => r.user_id === profile.id)
        return {
          id: profile.id,
          username: profile.username,
          email: profile.email,
          role: profile.role,
          score: result?.score ?? null,
          has_passed: result?.has_passed ?? null,
          completed_at: result?.completed_at ?? null
        }
      })

      setApplicants(applicantsData)
    } catch (error: any) {
      console.error('Error loading applicants:', error)
      toast.error('Failed to load applicants')
    }
  }

  const loadPendingApplications = async () => {
    try {
      // Load applications that need Lead Officer approval
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .is('lead_officer_approved', null)
        .neq('user_profiles.role', 'admin') // Exclude admin users from application list
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // For now, we'll handle officer applications in the existing applicants section
      // and show other applications in a separate section below
      return data || []
    } catch (error: any) {
      console.error('Error loading pending applications:', error)
      return []
    }
  }

  const loadOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_lead_officer, is_troll_officer')
        .or('is_troll_officer.eq.true,is_lead_officer.eq.true')
        .eq('is_officer_active', true)
        .neq('role', 'admin') // Exclude admin users from officer list

      if (error) throw error

      setOfficers((data || []).map(o => ({
        id: o.id,
        username: o.username,
        email: o.email,
        is_lead_officer: o.is_lead_officer || false,
        is_troll_officer: o.is_troll_officer || false
      })))
    } catch (error: any) {
      console.error('Error loading officers:', error)
      toast.error('Failed to load officers')
    }
  }

  const loadLogs = async () => {
    try {
      // Load from officer_actions table if it exists
      const { data, error } = await supabase
        .from('officer_actions')
        .select(`
          id,
          officer_id,
          target_user_id,
          action_type,
          reason,
          created_at,
          officer:user_profiles!officer_actions_officer_id_fkey(username),
          acted_by:user_profiles!officer_actions_acted_by_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        // Table might not exist, just set empty array
        setLogs([])
        return
      }

      const logsData = (data || []).map((log: any) => ({
        id: log.id,
        officer_id: log.officer_id,
        officer_username: log.officer?.username || 'Unknown',
        action_type: log.action_type,
        acted_by: log.acted_by || log.officer_id,
        acted_by_username: log.acted_by?.username || log.officer?.username || 'Unknown',
        reason: log.reason,
        created_at: log.created_at
      }))

      setLogs(logsData)
    } catch (error: any) {
      console.error('Error loading logs:', error)
      setLogs([])
    }
  }

  const openResult = async (userId: string, userData: any) => {
    setViewingUser(userData)
    setViewLoading(true)
    setViewResult(null)

    try {
      const { data, error } = await supabase
        .from('officer_orientation_results')
        .select('submitted_answers, score, has_passed, completed_at')
        .eq('user_id', userId)
        .single()

      setViewLoading(false)

      if (error) {
        console.error('Error loading result:', error)
        toast.error('Failed to load test results')
        return
      }

      if (data) {
        setViewResult(data as OrientationResult)
      }
    } catch (error: any) {
      console.error('Error opening result:', error)
      setViewLoading(false)
    }
  }

  const banOfficer = async (id: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('ban_officer', {
        p_user_id: id,
        p_reason: banReason || 'No reason provided',
        p_expires_at: null
      })

      if (error) {
        console.error('RPC error (ban_officer):', error)
        toast.error(`Failed to ban officer: ${error.message || error.code || 'Unknown error'}`)
        return
      }
      
      toast.success('Officer banned successfully')
      setBanReason('')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error in banOfficer:', error)
      toast.error(error.message || 'Failed to ban officer')
    } finally {
      setLoading(false)
    }
  }

  const unbanOfficer = async (id: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('unban_officer', {
        p_user_id: id
      })

      if (error) {
        console.error('RPC error (unban_officer):', error)
        toast.error(`Failed to unban officer: ${error.message || error.code || 'Unknown error'}`)
        return
      }
      
      toast.success('Officer unbanned successfully')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error in unbanOfficer:', error)
      toast.error(error.message || 'Failed to unban officer')
    } finally {
      setLoading(false)
    }
  }

  const act = async (
    actionType: 'hire_officer' | 'fire_officer' | 'promote_to_lead' | 'revoke_lead',
    userId: string
  ) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)

    try {
      let error: any = null

      switch (actionType) {
        case 'hire_officer': {
          // Approve officer application using RPC
          const { data: hireData, error: hireError } = await supabase.rpc('approve_officer_application', {
            p_user_id: userId
          })

          if (hireError) {
            error = hireError
          } else if (!hireData?.success) {
            error = { message: hireData?.error || 'Failed to approve officer application' }
          } else {
            // After approval, activate the officer
            const { error: activateError } = await supabase
              .from('user_profiles')
              .update({
                is_officer_active: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            error = activateError
          }
          break
        }

        case 'fire_officer': {
          // Deactivate officer
          const { error: fireError } = await supabase
            .from('user_profiles')
            .update({
              is_officer_active: false,
              is_troll_officer: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          error = fireError
          break
        }

        case 'promote_to_lead': {
          // Promote to lead officer
          const { error: promoteError } = await supabase
            .from('user_profiles')
            .update({
              is_lead_officer: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          error = promoteError
          break
        }

        case 'revoke_lead': {
          // Revoke lead officer status
          const { error: revokeError } = await supabase
            .from('user_profiles')
            .update({
              is_lead_officer: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
          error = revokeError
          break
        }
      }

      if (error) {
        console.error(`Error performing ${actionType}:`, error)
        toast.error(`Failed to ${actionType}: ${error.message || error.code || 'Unknown error'}`)
        return
      }
      
      toast.success(`Action completed: ${actionType}`)
      setReason('')
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs()])
    } catch (error: any) {
      console.error('Error in act:', error)
      toast.error(error.message || 'Failed to perform action')
    } finally {
      setLoading(false)
    }
  }

  // New functions for Lead Officer application approval
  const approveApplication = async (applicationId: string, userId: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          lead_officer_approved: true,
          lead_officer_reviewed_by: currentUserId,
          lead_officer_reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) throw error

      toast.success('Application approved for admin review')
      await loadApplicants()
    } catch (error: any) {
      console.error('Error approving application:', error)
      toast.error('Failed to approve application')
    } finally {
      setLoading(false)
    }
  }

  const rejectApplication = async (applicationId: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    const rejectReason = prompt('Enter rejection reason:') || 'No reason provided'
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          lead_officer_approved: false,
          lead_officer_reviewed_by: currentUserId,
          lead_officer_reviewed_at: new Date().toISOString(),
          status: 'rejected'
        })
        .eq('id', applicationId)

      if (error) throw error

      toast.success('Application rejected')
      await loadApplicants()
    } catch (error: any) {
      console.error('Error rejecting application:', error)
      toast.error('Failed to reject application')
    } finally {
      setLoading(false)
    }
  }

  // Weekly Report Functions
  const loadWeeklyReports = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_officer_reports')
        .select('*')
        .eq('lead_officer_id', currentUserId)
        .order('week_start', { ascending: false })
        .limit(10)

      if (error) throw error
      setWeeklyReports(data || [])
    } catch (error: any) {
      console.error('Error loading weekly reports:', error)
    }
  }

  const submitWeeklyReport = async (reportData: any) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setSubmittingReport(true)
    try {
      const result = await supabase.rpc('submit_weekly_report', {
        p_lead_officer_id: currentUserId,
        p_week_start: reportData.weekStart,
        p_week_end: reportData.weekEnd,
        p_title: `Weekly Report - ${reportData.weekStart} to ${reportData.weekEnd}`,
        p_body: JSON.stringify({
          work_summary: reportData.workSummary,
          challenges_faced: reportData.challenges,
          achievements: reportData.achievements,
          streams_moderated: reportData.streamsModerated,
          actions_taken: reportData.actionsTaken,
          recommendations: reportData.recommendations
        }),
        p_incidents: selectedIncidents
      })

      if (result.error) throw result.error

      if (result.data?.success) {
        toast.success('Weekly report submitted successfully!')
        setShowReportForm(false)
        setReportTitle('')
        setReportBody('')
        setWeekStart('')
        setWeekEnd('')
        setSelectedIncidents([])
        await loadWeeklyReports()
      } else {
        throw new Error(result.data?.error || 'Failed to submit report')
      }
    } catch (error: any) {
      console.error('Error submitting weekly report:', error)
      toast.error('Failed to submit weekly report')
    } finally {
      setSubmittingReport(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-purple-300 mb-2">
          Troll Officer Command Center
        </h1>
        <p className="text-sm text-purple-400">
          Lead Officers can review tests, hire, fire, and manage ranks. Admin users are excluded from officer management lists.
        </p>
      </div>

      {/* Applicants */}
      <section className="rounded-2xl border border-purple-800 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-purple-200 flex items-center gap-2">
            <User className="w-5 h-5" />
            Pending Applicants
          </h2>
          <button
            type="button"
            onClick={() => Promise.all([loadApplicants(), loadOfficers(), loadLogs()])}
            className="text-sm text-purple-300 hover:text-purple-100"
          >
            Refresh
          </button>
        </div>
        {applicants.length === 0 ? (
          <p className="text-sm text-purple-500">
            No applicants waiting. The trolls are calm… for now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-purple-400">
                <tr className="border-b border-purple-800">
                  <th className="text-left py-2">User</th>
                  <th>Score</th>
                  <th>Passed</th>
                  <th>Completed</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-purple-900/50 hover:bg-purple-900/10"
                  >
                    <td className="py-2">
                      <ClickableUsername userId={a.id} username={a.username} />
                    </td>
                    <td className="text-center">
                      {a.score === null ? '-' : a.score}
                    </td>
                    <td className="text-center">
                      {a.has_passed ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="text-center text-xs">
                      {a.completed_at
                        ? new Date(a.completed_at).toLocaleString()
                        : '-'}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-purple-600 px-3 py-1 text-xs hover:bg-purple-800/60"
                          onClick={() => openResult(a.id, a)}
                        >
                          View Test
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                          disabled={loading}
                          onClick={() => act('hire_officer', a.id)}
                        >
                          Hire
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Application Review Section */}
      <section className="rounded-2xl border border-blue-800 bg-black/40 p-6">
        <h2 className="text-xl font-semibold text-blue-200 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Applications Pending Review
        </h2>
        <PendingApplicationsList
          onApprove={approveApplication}
          onReject={rejectApplication}
        />
      </section>

      {/* Active officers */}
      <section className="rounded-2xl border border-purple-800 bg-black/40 p-6">
        <h2 className="text-xl font-semibold text-purple-200 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5" />
          Active Officers
        </h2>
        {officers.length === 0 ? (
          <p className="text-sm text-purple-500">No active officers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-purple-400">
                <tr className="border-b border-purple-800">
                  <th className="text-left py-2">User</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-purple-900/50 hover:bg-purple-900/10"
                  >
                    <td className="py-2">
                      <ClickableUsername userId={o.id} username={o.username} />
                    </td>
                    <td className="text-center">
                      {o.is_lead_officer ? (
                        <span className="px-2 py-1 bg-purple-600/30 rounded text-xs">Lead Officer</span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-600/30 rounded text-xs">Officer</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-purple-600 px-3 py-1 text-xs hover:bg-purple-800/60"
                          onClick={() => openResult(o.id, o)}
                        >
                          View Test
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-red-700 px-3 py-1 text-xs font-semibold hover:bg-red-800 disabled:opacity-50"
                          disabled={loading}
                          onClick={() => act('fire_officer', o.id)}
                        >
                          Fire
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-red-800 px-3 py-1 text-xs font-semibold hover:bg-red-900 disabled:opacity-50"
                          disabled={loading}
                          onClick={() => banOfficer(o.id)}
                        >
                          Ban
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-green-700 px-3 py-1 text-xs font-semibold hover:bg-green-800 disabled:opacity-50"
                          disabled={loading}
                          onClick={() => unbanOfficer(o.id)}
                        >
                          Unban
                        </button>
                        {!o.is_lead_officer && (
                          <button
                            type="button"
                            className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading}
                            onClick={() => act('promote_to_lead', o.id)}
                          >
                            Promote to Lead
                          </button>
                        )}
                        {o.is_lead_officer && (
                          <button
                            type="button"
                            className="rounded-xl bg-yellow-600 px-3 py-1 text-xs font-semibold hover:bg-yellow-700 disabled:opacity-50"
                            disabled={loading}
                            onClick={() => act('revoke_lead', o.id)}
                          >
                            Revoke Lead
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reason boxes */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-purple-800 bg-black/40 p-4">
          <h3 className="text-sm font-semibold text-purple-300 mb-2">
            Action reason (optional but recommended)
          </h3>
          <textarea
            className="w-full rounded-xl border border-purple-700 bg-black/40 p-3 text-sm text-purple-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={2}
            placeholder="Reason for hiring, firing, promotion, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </section>
        <section className="rounded-2xl border border-red-800 bg-black/40 p-4">
          <h3 className="text-sm font-semibold text-red-300 mb-2">
            Ban reason (required for ban actions)
          </h3>
          <textarea
            className="w-full rounded-xl border border-red-700 bg-black/40 p-3 text-sm text-purple-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={2}
            placeholder="Reason for banning officer..."
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
        </section>
      </div>

      {/* Live Streams */}
      <section className="rounded-2xl border border-purple-800 bg-black/40 p-4">
        <h2 className="text-xl font-semibold text-purple-200 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Live Streams
        </h2>
        {streamsLoading ? (
          <p className="text-sm text-purple-500">Loading streams...</p>
        ) : liveStreams.length === 0 ? (
          <p className="text-sm text-purple-500">No live streams at the moment.</p>
        ) : (
          <div className="space-y-2">
            {liveStreams.map((stream) => (
              <div
                key={stream.id}
                className="flex items-center justify-between border border-purple-700/50 rounded-xl p-3 bg-black/40 hover:bg-purple-900/20 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <div>
                    <div className="font-medium text-purple-100">{stream.title}</div>
                    <div className="text-xs text-purple-400">
                      {stream.user_profiles?.username || 'Unknown'} • {stream.current_viewers || 0} viewers
                    </div>
                  </div>
                </div>
                <a
                  href={`/stream/${stream.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  Watch
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action history */}
      <section className="rounded-2xl border border-purple-800 bg-black/40 p-4">
        <h2 className="text-xl font-semibold text-purple-200 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Action History
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-purple-500">
            No HR events yet. Give it time; trolls are chaotic.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto text-sm space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between border-b border-purple-900/40 py-2"
              >
                <div>
                  <div className="font-medium text-purple-100">
                    {log.officer_username} – {log.action_type}
                  </div>
                  <div className="text-xs text-purple-400">
                    by {log.acted_by_username} • {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.reason && (
                    <div className="mt-1 text-xs text-purple-300">
                      Reason: {log.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Test viewer modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-purple-700 bg-black/90 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-200">
                Orientation Test – {viewingUser.username}
              </h3>
              <button
                className="text-purple-300 hover:text-purple-100"
                onClick={() => {
                  setViewingUser(null)
                  setViewResult(null)
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {viewLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            )}
            {!viewLoading && !viewResult && (
              <p className="text-sm text-purple-400">
                No recorded test found for this user.
              </p>
            )}
            {!viewLoading && viewResult && (
              <div className="space-y-4 text-sm">
                <div className="text-purple-300">
                  Score: <b>{viewResult.score}</b> •{' '}
                  {viewResult.has_passed ? (
                    <span className="text-green-400">✅ Passed</span>
                  ) : (
                    <span className="text-red-400">❌ Not Passed</span>
                  )}{' '}
                  • {new Date(viewResult.completed_at).toLocaleString()}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-3 border-t border-purple-800 pt-4">
                  {Object.entries(viewResult.submitted_answers || {}).map(
                    ([qId, answer], idx) => (
                      <div
                        key={qId}
                        className="rounded-xl border border-purple-800 bg-black/40 p-3"
                      >
                        <div className="text-xs text-purple-400 mb-1">
                          Question ID: {qId}
                        </div>
                        <div className="text-xs font-semibold text-purple-200 mb-1">
                          Answer {idx + 1}:
                        </div>
                        <div className="text-sm text-purple-100">
                          {String(answer)}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Reports Section */}
      <section className="rounded-2xl border border-green-800 bg-black/40 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-green-200 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Reports
          </h2>
          <button
            type="button"
            onClick={() => setShowReportForm(!showReportForm)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold"
          >
            {showReportForm ? 'Cancel' : 'Submit Report'}
          </button>
        </div>

        {showReportForm && (
          <WeeklyReportForm
            onSubmit={submitWeeklyReport}
            onCancel={() => setShowReportForm(false)}
            loading={submittingReport}
          />
        )}

        <WeeklyReportsList reports={weeklyReports} />
      </section>
    </div>
  )
}

// Component for displaying pending applications
function PendingApplicationsList({ onApprove, onReject }: {
  onApprove: (applicationId: string, userId: string) => void
  onReject: (applicationId: string) => void
}) {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .is('lead_officer_approved', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])
    } catch (error: any) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-blue-400">Loading applications...</p>
  }

  if (applications.length === 0) {
    return <p className="text-blue-500">No applications pending review.</p>
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <div key={app.id} className="bg-[#1A1A1A] border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold">
                  {app.user_profiles?.username || "Unknown User"}
                </span>
                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
                  {app.type.toUpperCase().replace("_", " ")}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Applied: {new Date(app.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(app.id, app.user_id)}
                className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => onReject(app.id)}
                className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
              >
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

