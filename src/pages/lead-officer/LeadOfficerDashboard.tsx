import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Award, User, Clock, FileText, Calendar, Crown, LayoutDashboard } from 'lucide-react'
import UserNameWithAge from '../../components/UserNameWithAge'
import WeeklyReportForm from '../../components/WeeklyReportForm'
import WeeklyReportsList from '../../components/WeeklyReportsList'
import OfficerStreamGrid from '../../components/officer/OfficerStreamGrid'
import OfficerShiftCalendar from '../../components/officer/OfficerShiftCalendar'
import TimeOffRequestsList from './TimeOffRequestsList'
import '../../styles/LeadOfficerDashboard.css'

type Applicant = {
  id: string
  username: string
  email?: string
  role?: string
  created_at?: string
}

type Officer = {
  id: string
  username: string
  email?: string
  is_lead_officer: boolean
  is_troll_officer: boolean
  created_at?: string
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

type AutoClockoutSession = {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
  auto_clocked_out: boolean
  username?: string
  created_at?: string
}



export function LeadOfficerDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [officers, setOfficers] = useState<Officer[]>([])
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [empireApplications, setEmpireApplications] = useState<any[]>([])
  const [autoClockoutSessions, setAutoClockoutSessions] = useState<AutoClockoutSession[]>([])

  const [reason, setReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [loading, setLoading] = useState(false)

  const [weeklyReports, setWeeklyReports] = useState<any[]>([])
  const [showReportForm, setShowReportForm] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'hr' | 'empire' | 'reports'>('dashboard')

  // Load weekly reports when user ID is available
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

  useEffect(() => {
    if (currentUserId) {
      loadWeeklyReports()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setCurrentUserId(authUser?.id ?? null)
      await Promise.all([loadApplicants(), loadOfficers(), loadLogs(), loadEmpireApplications(), loadAutoClockouts()])
    }
    init()
  }, [])

  const loadAutoClockouts = async () => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: sessions, error } = await supabase
        .from('officer_work_sessions')
        .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out')
        .eq('auto_clocked_out', true)
        .gte('clock_in', since)
        .order('clock_out', { ascending: false })
        .limit(50)

      if (error) throw error

      const rows = sessions || []

      if (rows.length === 0) {
        setAutoClockoutSessions([])
        return
      }

      const officerIds = Array.from(new Set(rows.map((s: any) => s.officer_id).filter(Boolean)))

      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', officerIds)

      const map = new Map((profilesData || []).map((p: any) => [p.id, p.username as string | undefined]))

      const hydrated = rows.map((s: any) => ({
        ...s,
        username: map.get(s.officer_id) || s.officer_id
      })) as AutoClockoutSession[]

      setAutoClockoutSessions(hydrated)
    } catch (error: any) {
      console.error('Error loading auto clock-out sessions:', error)
    }
  }

  const loadApplicants = async () => {
    try {
      // Get troll_officer applications that are pending approval
      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select(`
          id,
          user_id,
          experience,
          status,
          created_at,
          user_profiles!user_id (
            username,
            email,
            role,
            is_troll_officer,
            is_officer_active
          )
        `)
        .eq('type', 'troll_officer')
        .eq('status', 'pending')
        .neq('user_profiles.role', 'admin') // Exclude admin users from applicant list

      if (applicationsError) throw applicationsError

      // Transform data to match Applicant type
      const applicantsData = (applications || []).map((app: any) => {
        const up = Array.isArray(app.user_profiles) ? app.user_profiles[0] : app.user_profiles
        return {
          id: app.user_id,
          username: up?.username || 'Unknown',
          email: up?.email || '',
          role: up?.role || 'user',
        }
      })

      setApplicants(applicantsData)
    } catch (error: any) {
      console.error('Error loading applicants:', error)
      toast.error('Failed to load applicants')
    }
  }

// loadPendingApplications removed

  const loadOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_lead_officer, is_troll_officer, created_at')
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
          officer:user_profiles!officer_actions_officer_id_fkey(username)
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
        acted_by: log.officer_id,
        acted_by_username: log.officer?.username || 'Unknown',
        reason: log.reason,
        created_at: log.created_at
      }))

      setLogs(logsData)
    } catch (error: any) {
      console.error('Error loading logs:', error)
      setLogs([])
    }
  }

  const loadEmpireApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('empire_applications')
        .select(`
          *,
          user:user_profiles!user_id (
            username,
            avatar_url,
            created_at
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformed = (data || []).map((app: any) => ({
        ...app,
        user: Array.isArray(app.user) ? app.user[0] : app.user
      }))

      setEmpireApplications(transformed)
    } catch (error: any) {
      console.error('Error loading empire applications:', error)
      toast.error('Failed to load empire applications')
    }
  }

  const approveEmpireApplication = async (appId: string) => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const { error } = await supabase.rpc('approve_empire_partner', {
        p_application_id: appId,
        p_reviewer_id: profile.id
      })

      if (error) throw error

      toast.success('Empire Partner application approved!')
      await loadEmpireApplications()
    } catch (error: any) {
      console.error('Error approving application:', error)
      toast.error(error.message || 'Failed to approve application')
    } finally {
      setLoading(false)
    }
  }

  const rejectEmpireApplication = async (appId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return

    setLoading(true)
    try {
      const { error } = await supabase.rpc('reject_empire_partner', {
        p_application_id: appId,
        p_reviewer_id: profile?.id
      })

      if (error) throw error

      toast.success('Empire Partner application rejected.')
      await loadEmpireApplications()
    } catch (error: any) {
      console.error('Error rejecting application:', error)
      toast.error(error.message || 'Failed to reject application')
    } finally {
      setLoading(false)
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

        case 'promote_to_lead':
        case 'revoke_lead': {
          const { error: setStatusError } = await supabase.rpc('set_lead_officer_status', {
            p_user_id: userId,
            p_make_lead: actionType === 'promote_to_lead'
          })

          error = setStatusError
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
  const approveApplication = async (applicationId: string) => {
    if (!currentUserId) {
      toast.error('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'approve_lead_application', applicationId }
      })

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

    // const _rejectReason = prompt('Enter rejection reason:') || 'No reason provided'
    
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'reject_lead_application', applicationId }
      })

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
  // loadWeeklyReports is defined above


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
        p_incidents: []
      })

      if (result.error) throw result.error

      if (result.data?.success) {
        toast.success('Weekly report submitted successfully!')
        setShowReportForm(false)
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

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-purple-800/50 pb-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-900/20'
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('hr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'hr' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-900/20'
          }`}
        >
          <User size={18} />
          HR & Personnel
        </button>
        <button
          onClick={() => setActiveTab('empire')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'empire' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-900/20'
          }`}
        >
          <Crown size={18} />
          Empire
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'reports' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-purple-900/20'
          }`}
        >
          <FileText size={18} />
          Reports
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <section>
            <OfficerStreamGrid />
          </section>

          <section className="rounded-2xl border border-purple-800 bg-black/40 p-6">
            <OfficerShiftCalendar title="All Officer Shifts" />
          </section>
        </div>
      )}

      {activeTab === 'hr' && (
        <div className="space-y-8">
          {/* Time Off Requests */}
          <section className="rounded-2xl border border-orange-800 bg-black/40 p-6">
            <TimeOffRequestsList />
          </section>

          <section className="rounded-2xl border border-red-800 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-red-200 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            HR Alerts – Auto Clock-outs
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadAutoClockouts}
              className="text-sm text-red-300 hover:text-red-100"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/officer/scheduling')}
              className="text-sm text-purple-300 hover:text-purple-100 underline"
            >
              Open Scheduling
            </button>
          </div>
        </div>
        {autoClockoutSessions.length === 0 ? (
          <p className="text-sm text-red-400">
            No recent auto clock-outs in the last 7 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-red-200">
                <tr className="border-b border-red-800">
                  <th className="text-left py-2">Officer</th>
                  <th className="text-left py-2">Clock In</th>
                  <th className="text-left py-2">Clock Out</th>
                  <th className="text-left py-2">Hours Worked</th>
                </tr>
              </thead>
              <tbody>
                {autoClockoutSessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-red-900/50 hover:bg-red-900/10"
                  >
                    <td className="py-2">
                      <UserNameWithAge 
                        user={{
                            username: s.username || s.officer_id,
                            id: s.officer_id,
                            created_at: s.created_at
                        }}
                      />
                    </td>
                    <td className="py-2">
                      {new Date(s.clock_in).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {s.clock_out ? new Date(s.clock_out).toLocaleString() : 'Active'}
                    </td>
                    <td className="py-2">
                      {s.hours_worked.toFixed(2)} hrs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">

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
                      <UserNameWithAge 
                        user={{
                            username: o.username,
                            id: o.id,
                            created_at: o.created_at
                        }}
                      />
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

        </div>
      )}

      {activeTab === 'empire' && (
      <section className="rounded-2xl border border-purple-800 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-purple-200 flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Empire Partner Applications
          </h2>
          <button
            type="button"
            onClick={loadEmpireApplications}
            className="text-sm text-purple-300 hover:text-purple-100"
          >
            Refresh
          </button>
        </div>
        {empireApplications.length === 0 ? (
          <p className="text-sm text-purple-500">
            No pending Empire Partner applications.
          </p>
        ) : (
          <div className="space-y-4">
            {empireApplications.map((app) => (
              <div
                key={app.id}
                className="border border-purple-700/50 rounded-xl p-4 bg-black/40 hover:bg-purple-900/20 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <img
                      src={app.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user?.username}`}
                      alt={app.user?.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <ClickableUsername userId={app.user_id} username={app.user?.username || 'Unknown'} />
                      <p className="text-xs text-gray-400 mt-1">Applied: {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => approveEmpireApplication(app.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectEmpireApplication(app.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      )}

      {activeTab === 'hr' && (
        <div className="space-y-8">
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

        </div>
      )}

      {/* Test viewer modal removed */}

      {activeTab === 'reports' && (
      <section className="rounded-2xl border border-green-800 bg-black/40 p-6">
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
      )}
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
                  <UserNameWithAge 
                    user={{
                        username: app.user_profiles?.username || "Unknown User",
                        id: app.user_id,
                        created_at: app.user_profiles?.created_at
                    }}
                  />
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
