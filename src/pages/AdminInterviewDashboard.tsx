import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  Video, Clock, 
  Users, Calendar, Trash2
} from 'lucide-react'
import { InterviewSchedulerModal } from '../components/admin/InterviewSchedulerModal'

interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  interviewer_id: string
  scheduled_at: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending' | 'active' | 'hired' | 'rejected'
  notes: string
  applicant_name: string
  applicant_username: string
  room_id: string
}

export default function AdminInterviewDashboard() {
  const navigate = useNavigate()
  const { user: _user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [interviews, setInterviews] = useState<InterviewSession[]>([])
  const [applications, setApplications] = useState<any[]>([])
  
  // Scheduler state
  const [showScheduler, setShowScheduler] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null)

  useEffect(() => {
    fetchInterviews()
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles (
            username,
            full_name,
            avatar_url,
            email
          )
        `)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Filter out approved applications that already have an interview
      const { data: existingInterviews } = await supabase
        .from('interviews')
        .select('applicant_id')
        .in('applicant_id', data.map(a => a.user_id))
      
      const interviewMap = new Set(existingInterviews?.map(i => i.applicant_id))
      
      // Show pending apps, AND approved apps that don't have an interview yet
      // Exclude applications that don't require interviews (Seller, Troll Family)
      const filteredApps = data.filter(app => 
        !['seller', 'troll_family', 'family'].includes(app.type) &&
        (app.status === 'pending' || 
        (app.status === 'approved' && !interviewMap.has(app.user_id)))
      )

      setApplications(filteredApps || [])
    } catch (err) {
      console.error('Error fetching applications:', err)
    }
  }

  const handleApprove = async (appId: string, userId: string, username: string) => {
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'approve_lead_application', applicationId: appId }
      })

      if (error) throw error

      toast.success('Application approved')
      
      // Prompt to schedule
      setSelectedApplicant({
          id: userId, // Pass user_id as applicantId
          name: username
      })
      setShowScheduler(true)
      
      fetchApplications()
    } catch (error: any) {
      console.error('Error approving application:', error)
      toast.error('Failed to approve application')
    }
  }

  const handleReject = async (appId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'reject_lead_application', applicationId: appId }
      })

      if (error) throw error

      toast.success('Application rejected')
      fetchApplications()
    } catch (error: any) {
      console.error('Error rejecting application:', error)
      toast.error('Failed to reject application')
    }
  }

  const handleCancelInterview = async (interviewId: string) => {
    if (!confirm('Are you sure you want to cancel and delete this interview?')) return

    try {
      const { error } = await supabase
        .from('interviews')
        .delete()
        .eq('id', interviewId)

      if (error) throw error

      toast.success('Interview cancelled')
      fetchInterviews()
      fetchApplications()
    } catch (error) {
      console.error('Error cancelling interview:', error)
      toast.error('Failed to cancel interview')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      active: 'bg-green-500/20 text-green-400 border border-green-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
      hired: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
    }
    return colors[status] || colors.active
  }

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      if (!data) {
        setInterviews([])
        return
      }

      // Get user profiles for each interview
      const userIds = [...new Set(data.map((i: any) => i.applicant_id))]
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, full_name')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

      const formattedInterviews = data.map((interview: any) => {
        const profile = profileMap.get(interview.applicant_id)
        return {
          id: interview.id,
          application_id: 'N/A',
          user_id: interview.applicant_id,
          interviewer_id: 'N/A',
          scheduled_at: interview.scheduled_at,
          status: interview.status,
          notes: '',
          applicant_name: profile?.full_name || profile?.username || 'Unknown',
          applicant_username: profile?.username || 'unknown',
          room_id: interview.room_id
        }
      })

      setInterviews(formattedInterviews)
    } catch (error) {
      console.error('Error fetching interviews:', error)
      toast.error('Failed to load interviews')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Video className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Interview Dashboard</h1>
                <p className="text-gray-400">Manage and test interview sessions</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Pending Applications */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden mb-6">
          <div className="p-6 border-b border-[#2C2C2C]">
            <h2 className="text-lg font-semibold text-white">Pending Applications</h2>
            <p className="text-gray-400 text-sm">{applications.length} pending</p>
          </div>
          <div className="divide-y divide-[#2C2C2C]">
            {applications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No pending applications
              </div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xl">
                      {app.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{app.user_profiles?.username || 'Unknown User'}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="capitalize">{app.type.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 max-w-md truncate">{app.motivation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedApplicant({
                            id: app.user_id,
                            name: app.user_profiles?.username
                        })
                        setShowScheduler(true)
                      }}
                      className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </button>
                    <button
                      onClick={() => handleApprove(app.id, app.user_id, app.user_profiles?.username)}
                      className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scheduled Interviews */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
          <div className="p-6 border-b border-[#2C2C2C]">
            <h2 className="text-lg font-semibold text-white">Scheduled Interviews</h2>
            <p className="text-gray-400 text-sm">{interviews.length} interview(s)</p>
          </div>

          {interviews.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Interviews Scheduled</h3>
              <p className="text-gray-400 mb-6">Schedule interviews from the pending applications list</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2C2C2C]">
              {interviews.map((interview) => (
                <div key={interview.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{interview.applicant_name}</h4>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(interview.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusBadge(interview.status)}`}>
                      {interview.status === 'in_progress' ? 'Live' : interview.status}
                    </span>
                    <button
                      onClick={() => navigate(`/interview/${interview.room_id}`)}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      {interview.status === 'scheduled' || interview.status === 'pending' ? 'Start Interview' : 'Rejoin'}
                    </button>
                    <button
                      onClick={() => handleCancelInterview(interview.id)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedApplicant && (
        <InterviewSchedulerModal
          isOpen={showScheduler}
          onClose={() => setShowScheduler(false)}
          applicantId={selectedApplicant.id}
          applicantName={selectedApplicant.name}
          onScheduled={() => {
            fetchInterviews()
            // Also refresh applications if needed
          }}
        />
      )}
    </div>
  )
}
