import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Video,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Users,
  Clock,
  Play
} from 'lucide-react'

// Application type
interface Application {
  id: string
  type: string
  status: string
  created_at: string
  reviewed_at?: string
}

// Interview session type
interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  scheduled_at: string
  status: 'active' | 'completed' | 'hired' | 'rejected'
  notes: string
  applicant_name: string
}

// Position options for interviews
const interviewPositions = [
  { id: 'troll_officer', title: 'Troll Officer (Moderation)', icon: '🛡️' },
  { id: 'lead_troll_officer', title: 'Lead Troll Officer', icon: '⭐' },
  { id: 'secretary', title: 'Secretary', icon: '📋' },
  { id: 'seller', title: 'Marketplace Seller', icon: '🏪' },
]

export default function InterviewRoomPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [hasApplication, setHasApplication] = useState(false)
  const [application, setApplication] = useState<Application | null>(null)
  const [existingInterview, setExistingInterview] = useState<InterviewSession | null>(null)
  const [selectedPosition, setSelectedPosition] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduling, setScheduling] = useState(false)

  // Admin state
  const [adminInterviews, setAdminInterviews] = useState<any[]>([])
  const [adminApplications, setAdminApplications] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'interviews' | 'applications'>('interviews')

  // Check if user is admin (matching Sidebar.tsx logic)
  const isAdmin = profile?.role === 'admin' || 
    profile?.troll_role === 'admin' || 
    profile?.role === 'hr_admin' || 
    profile?.is_admin ||
    profile?.role === 'lead_troll_officer'

  // Fetch admin data
  useEffect(() => {
    if (isAdmin) {
      const fetchAdminData = async () => {
        // Fetch interviews
        const { data: interviews } = await supabase
          .from('interview_sessions')
          .select(`
            *,
            application:applications!application_id (
              type,
              status
            )
          `)
          .order('scheduled_at', { ascending: true })
        
        if (interviews) {
             // Get user profiles
            const userIds = [...new Set(interviews.map(i => i.user_id))]
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, username, full_name')
                .in('id', userIds)
            
            const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
            
            const formatted = interviews.map(i => ({
                ...i,
                applicant_name: profileMap.get(i.user_id)?.full_name || profileMap.get(i.user_id)?.username || 'Unknown'
            }))
            setAdminInterviews(formatted)
        }

        // Fetch applications
        const { data: apps } = await supabase
          .from('applications')
          .select(`
            *,
            user:user_profiles!user_id (
              username,
              full_name
            )
          `)
          .order('created_at', { ascending: false })
        
        if (apps) setAdminApplications(apps)
      }
      fetchAdminData()
    }
  }, [isAdmin])

  // Roles that don't need interviews - appointed directly (only pastor remains)
  const appointedRoles = ['pastor']
  const hasAppointedRole = appointedRoles.includes(profile?.role) || appointedRoles.includes(profile?.troll_role)

  const checkApplicationAndInterview = useCallback(async () => {
    if (!user) return

    // Admins have direct access
    if (isAdmin) {
      setHasApplication(true)
      setLoading(false)
      return
    }

    // Users with appointed roles don't need interviews
    if (hasAppointedRole) {
      toast.info('As an appointed role, you have direct access. Visit the Admin Applications page to manage interviews.')
      navigate('/admin/applications')
      return
    }

    try {
      // Check for existing application that requires interview
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('id, type, status, created_at, reviewed_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved'])
        .in('type', ['troll_officer', 'lead_troll_officer', 'secretary', 'seller'])
        .maybeSingle()

      if (appError) throw appError

      if (appData) {
        setHasApplication(true)
        setApplication(appData)

        // Check for existing interview session
        const { data: interviewData, error: interviewError } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('application_id', appData.id)
          .in('status', ['active', 'completed'])
          .maybeSingle()

        if (interviewError) throw interviewError

        if (interviewData) {
          setExistingInterview(interviewData)
        }
      } else {
        setHasApplication(false)
      }
    } catch (error) {
      console.error('Error checking application:', error)
      toast.error('Failed to check application status')
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin, hasAppointedRole, navigate])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    checkApplicationAndInterview()
  }, [user, navigate, checkApplicationAndInterview])

  const scheduleInterview = async () => {
    if (!user || !application || !selectedPosition || !scheduleDate || !scheduleTime) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      setScheduling(true)

      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()

      // Create interview session
      const { error } = await supabase
        .from('interview_sessions')
        .insert({
          application_id: application.id,
          user_id: user.id,
          interviewer_id: '', // Will be assigned by admin
          scheduled_at: scheduledAt,
          status: 'scheduled',
          notes: ''
        })
        .select()
        .single()

      if (error) throw error

      // Create notification for admins
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          type: 'interview_scheduled',
          title: 'New Interview Scheduled',
          message: `${profile?.username || 'A user'} has scheduled an interview for ${selectedPosition}`,
          read: false,
          created_at: new Date().toISOString()
        }))

        await supabase.from('notifications').insert(notifications)
      }

      toast.success('Interview scheduled successfully! Admins have been notified.')
      navigate('/career')
    } catch (error: any) {
      console.error('Error scheduling interview:', error)
      toast.error('Failed to schedule interview')
    } finally {
      setScheduling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Admin Dashboard
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0814] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Video className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Interview Dashboard</h1>
                <p className="text-gray-400">Manage interviews and applications</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-[#2C2C2C] pb-4">
               <button
                  onClick={() => setActiveTab('interviews')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'interviews' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-[#141414] text-gray-400 hover:bg-[#2C2C2C]'
                  }`}
                >
                  Scheduled Interviews ({adminInterviews.length})
                </button>
                <button
                  onClick={() => setActiveTab('applications')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'applications' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-[#141414] text-gray-400 hover:bg-[#2C2C2C]'
                  }`}
                >
                  All Applications ({adminApplications.length})
                </button>
            </div>

            {activeTab === 'interviews' && (
              <div className="space-y-4">
                {adminInterviews.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No scheduled interviews found.</p>
                ) : (
                  adminInterviews.map((interview) => (
                    <div key={interview.id} className="bg-[#141414] p-4 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="p-2 bg-purple-500/10 rounded-lg">
                           <Users className="w-5 h-5 text-purple-400" />
                         </div>
                         <div>
                           <h3 className="font-bold text-white">{interview.applicant_name}</h3>
                           <p className="text-sm text-gray-400">
                             {new Date(interview.scheduled_at).toLocaleString()}
                           </p>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                                  {interview.application?.type.replace('_', ' ')}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                  interview.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                  interview.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                  {interview.status}
                              </span>
                           </div>
                         </div>
                      </div>
                      <button
                        onClick={() => navigate(`/interview/${interview.id}`)}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start/Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div className="space-y-4">
                  {adminApplications.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No applications found.</p>
                  ) : (
                      adminApplications.map((app) => (
                          <div key={app.id} className="bg-[#141414] p-4 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                  <div className="p-2 bg-blue-500/10 rounded-lg">
                                      <FileText className="w-5 h-5 text-blue-400" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-white">{app.user?.full_name || app.user?.username || 'Unknown User'}</h3>
                                      <p className="text-sm text-gray-400">
                                          Applied: {new Date(app.created_at).toLocaleDateString()}
                                      </p>
                                      <p className="text-xs text-gray-500 capitalize">{app.type.replace('_', ' ')}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                      app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                      app.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                      {app.status}
                                  </span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // No application found - show prompt (unless admin)
  if (!hasApplication) {
    // Admin view - show admin dashboard
    if (isAdmin) {
      return (
        <div className="min-h-screen bg-[#0A0814] p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Video className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Admin Interview Dashboard</h1>
                  <p className="text-gray-400">Manage all scheduled interviews</p>
                </div>
              </div>

              <div className="bg-[#141414] rounded-lg p-6 mb-6">
                <p className="text-gray-400 mb-4">
                  As an admin, you have full access to the interview system. You can:
                </p>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    View all pending applications
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Join scheduled interviews
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Review and approve applications
                  </li>
                </ul>
              </div>

              <button
                onClick={() => navigate('/admin/applications')}
                className="w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                View All Applications
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Users with appointed roles don't need interviews
    if (hasAppointedRole) {
      return (
        <div className="min-h-screen bg-[#0A0814] p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Appointed Role</h1>
              <p className="text-gray-400 mb-6">
                You have an appointed role and don&apos;t need to go through the interview process. 
                You can access your role-specific features directly.
              </p>
              <button
                onClick={() => navigate('/admin/applications')}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <FileText className="w-5 h-5" />
                Go to Admin Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#0A0814] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Interview Required</h1>
            <p className="text-gray-400 mb-6">
              You need to submit and have an approved application for Troll Officer, Lead Troll Officer, Secretary, or Marketplace Seller before scheduling an interview.
            </p>
            <button
              onClick={() => navigate('/application')}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <FileText className="w-5 h-5" />
              Go to Careers Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Existing interview found
  if (existingInterview) {
    const statusColors = {
      active: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-gray-500/20 text-gray-400',
      hired: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
    }

    return (
      <div className="min-h-screen bg-[#0A0814] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-cyan-500/20 rounded-lg">
                <Video className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Interview Scheduled</h1>
                <p className="text-gray-400">Your interview is scheduled</p>
              </div>
            </div>

            <div className="bg-[#141414] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Status</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusColors[existingInterview.status as keyof typeof statusColors]}`}>
                  {existingInterview.status === 'active' ? 'Active' : 
                   existingInterview.status.charAt(0).toUpperCase() + existingInterview.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Scheduled For</span>
                <span className="text-white font-medium">
                  {new Date(existingInterview.scheduled_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Application Type</span>
                <span className="text-white font-medium capitalize">
                  {application?.type.replace('_', ' ')}
                </span>
              </div>
            </div>

            {existingInterview.status === 'active' && (
              <>
                {(() => {
                  const scheduledTime = new Date(existingInterview.scheduled_at).getTime();
                  const now = new Date().getTime();
                  const tenMinutes = 10 * 60 * 1000;
                  const isWithinWindow = now >= scheduledTime - tenMinutes;
                  
                  if (isWithinWindow) {
                    return (
                      <button
                        onClick={() => navigate(`/interview/${existingInterview.id}`)}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 rounded-lg"
                      >
                        <Video className="w-5 h-5" />
                        Join Interview Room
                      </button>
                    );
                  } else {
                    const diff = scheduledTime - tenMinutes - now;
                    const minutes = Math.ceil(diff / 60000);
                    return (
                      <div className="w-full py-4 bg-[#2C2C2C] text-gray-400 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                        <Video className="w-5 h-5" />
                        Room opens in {minutes} minute{minutes !== 1 ? 's' : ''}
                      </div>
                    );
                  }
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Application exists, no interview yet - show scheduling form
  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-cyan-500/20 rounded-lg">
              <Calendar className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Schedule Interview</h1>
              <p className="text-gray-400">Select a position and schedule your interview</p>
            </div>
          </div>

          {/* Application Status */}
          <div className="bg-[#141414] rounded-lg p-4 mb-6 flex items-center gap-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-white font-medium">Application on File</p>
              <p className="text-gray-400 text-sm">
                {application?.type.replace('_', ' ')} - {application?.status}
              </p>
            </div>
          </div>

          {/* Position Selection */}
          <div className="mb-6">
            <label className="block text-gray-400 mb-3">Select Position</label>
            <div className="grid grid-cols-1 gap-3">
              {interviewPositions.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setSelectedPosition(pos.id)}
                  className={`p-4 rounded-lg border transition-all flex items-center gap-3 ${
                    selectedPosition === pos.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-[#2C2C2C] hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{pos.icon}</span>
                  <span className="text-white font-medium">{pos.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date/Time Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-400 mb-2">Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#141414] border border-[#2C2C2C] rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full bg-[#141414] border border-[#2C2C2C] rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={scheduleInterview}
            disabled={!selectedPosition || !scheduleDate || !scheduleTime || scheduling}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scheduling ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5" />
                Schedule Interview
              </>
            )}
          </button>

          <p className="text-gray-400 text-sm text-center mt-4">
            Admins will be notified and will join your interview at the scheduled time.
          </p>
        </div>
      </div>
    </div>
  )
}
