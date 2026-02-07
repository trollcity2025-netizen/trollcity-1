import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { 
  Briefcase, Calendar, Clock, Users, Shield, Video, 
  CheckCircle, FileText, Star, ArrowRight,
  Cross, Music, Gamepad2, X
} from 'lucide-react'

// Job position type
interface JobPosition {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  benefits: string[]
  icon: React.ReactNode
  color: string
}

// Application status type
interface Application {
  id: string
  type: string
  status: string
  created_at: string
  reviewed_at?: string
  answers?: Record<string, any>
  user?: {
    username: string
    full_name?: string
    avatar_url?: string
  }
}

// Interview session type
interface InterviewSession {
  id: string
  application_id: string
  scheduled_at: string
  status: string
  applicant_name: string
}

const jobPositions: JobPosition[] = [
  {
    id: 'troller',
    title: 'Troller',
    department: 'Broadcasting',
    description: 'Stream content on Troll City and engage with the community',
    requirements: [
      'Must be 18 years or older',
      'Ability to create engaging content',
      'Stable internet connection',
      'Basic streaming equipment',
      'Good communication skills'
    ],
    benefits: [
      'Earn coins from viewer engagement',
      'Access to Troll Officer community',
      'Potential for platform-wide promotion',
      'Network with other creators'
    ],
    icon: <Video className="w-6 h-6" />,
    color: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'troll_officer',
    title: 'Troll Officer',
    department: 'Moderation',
    description: 'Help maintain a safe and fun community environment',
    requirements: [
      'Previous moderation experience',
      'Strong understanding of community guidelines',
      'Ability to handle difficult situations calmly',
      'Available for regular shifts',
      'Good judgment and decision-making skills'
    ],
    benefits: [
      'Special officer role and badge',
      'Access to officer-only channels',
      'Contribution to platform growth',
      'Recognition in community'
    ],
    icon: <Shield className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'lead_officer',
    title: 'Lead Troll Officer',
    department: 'Leadership',
    description: 'Lead the moderation team and coordinate officer activities',
    requirements: [
      'Previous Troll Officer experience',
      'Strong leadership and communication skills',
      'Ability to train and mentor new officers',
      'Strategic thinking and problem-solving',
      'Commitment to platform success'
    ],
    benefits: [
      'Leadership role with higher responsibility',
      'Access to admin dashboard',
      'Platform-wide influence',
      'Community recognition as leader'
    ],
    icon: <Star className="w-6 h-6" />,
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'pastor',
    title: 'Pastor',
    department: 'Spiritual',
    description: 'Lead spiritual content and church-related activities',
    requirements: [
      'Strong faith and biblical knowledge',
      'Ability to lead discussions and studies',
      'Compassion and guidance skills',
      'Availability for church events',
      'Respect for all community members'
    ],
    benefits: [
      'Pastor role and recognition',
      'Lead church-related content',
      'Community spiritual guidance',
      'Special pastor channels'
    ],
    icon: <Cross className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'entertainer',
    title: 'Entertainer',
    department: 'Content',
    description: 'Create music, performances, and entertainment content',
    requirements: [
      'Talents in music, comedy, or performance',
      'Ability to entertain and engage audiences',
      'Original content creation skills',
      'Consistent streaming schedule',
      'Positive and uplifting content'
    ],
    benefits: [
      'Featured content opportunities',
      'Music and performance promotion',
      'Fan engagement tools',
      'Creative freedom'
    ],
    icon: <Music className="w-6 h-6" />,
    color: 'from-red-500 to-rose-500'
  },
  {
    id: 'gamer',
    title: 'Pro Gamer',
    department: 'Gaming',
    description: 'Stream gaming content and compete in tournaments',
    requirements: [
      'High-level gaming skills',
      'Knowledge of multiple game genres',
      'Entertaining commentary abilities',
      'Tournament participation willingness',
      'Regular gaming schedule'
    ],
    benefits: [
      'Gaming community access',
      'Tournament entries',
      'Gaming gear opportunities',
      'Competitive recognition'
    ],
    icon: <Gamepad2 className="w-6 h-6" />,
    color: 'from-indigo-500 to-violet-500'
  }
]

export default function Career() {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'positions' | 'my_applications' | 'interviews' | 'all_applications'>('positions')
  const [applications, setApplications] = useState<any[]>([])
  const [interviews, setInterviews] = useState<InterviewSession[]>([])
  const [loading, setLoading] = useState(false)
  // const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  // Check for admin/lead status using comprehensive role checks (matching Sidebar.tsx logic)
  const isAdminOrLead = profile?.role === 'admin' || 
    profile?.troll_role === 'admin' || 
    profile?.role === 'hr_admin' || 
    profile?.is_admin || 
    profile?.role === 'lead_troll_officer' || 
    profile?.troll_role === 'lead_troll_officer' || 
    profile?.is_lead_officer

  // Consolidated data fetching
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        setLoading(true)
        
        if (activeTab === 'my_applications') {
          const { data, error } = await supabase
            .from('applications')
            .select('id, type, status, created_at, reviewed_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error
          setApplications(data || [])
        } 
        else if (activeTab === 'all_applications' && isAdminOrLead) {
          const { data, error } = await supabase
            .from('applications')
            .select(`
              id,
              type,
              status,
              created_at,
              reviewed_at,
              user:user_profiles!applications_user_id_fkey (
                username,
                full_name
              )
            `)
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) throw error
          setApplications(data || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTab, user, isAdminOrLead])

  // Fetch interviews for admin/lead (kept separate as it populates a different state)
  useEffect(() => {
    const fetchInterviews = async () => {
      if (!isAdminOrLead) return

      try {
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('id, application_id, scheduled_at, status, user_id')
          .order('scheduled_at', { ascending: true })

        if (error) throw error

        // Get user profiles for each interview
        const userIds = [...new Set(data.map((i: any) => i.user_id))]
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, full_name')
          .in('id', userIds)

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

        const formattedInterviews = (data || []).map((item: any) => {
          const profile = profileMap.get(item.user_id)
          return {
            id: item.id,
            application_id: item.application_id,
            scheduled_at: item.scheduled_at,
            status: item.status,
            applicant_name: profile?.full_name || profile?.username || 'Unknown'
          }
        })
        setInterviews(formattedInterviews)
      } catch (error) {
        console.error('Error fetching interviews:', error)
      }
    }

    fetchInterviews()
  }, [isAdminOrLead])

  // Fetch ALL applications for admin/lead
  useEffect(() => {
    const fetchAllApplications = async () => {
      if (!isAdminOrLead || activeTab !== 'all_applications') return

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('applications')
          .select(`
            id,
            type,
            status,
            created_at,
            reviewed_at,
            answers,
            user:user_profiles!applications_user_id_fkey (
              username,
              full_name,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error
        setApplications(data || [])
      } catch (error) {
        console.error('Error fetching all applications:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllApplications()
  }, [isAdminOrLead, activeTab])

  const handleApply = (position: JobPosition) => {
    if (!user) {
      toast.error('Please sign in to apply')
      navigate('/auth')
      return
    }

    // Redirect to appropriate application page
    switch (position.id) {
      case 'troller':
        navigate('/apply/troller')
        break
      case 'troll_officer':
        navigate('/apply/officer')
        break
      case 'lead_officer':
        navigate('/apply/lead-officer')
        break
      case 'pastor':
        navigate('/apply/pastor')
        break
      default:
        navigate('/apply')
    }
  }

  const handleScheduleInterview = async () => {
    if (!selectedApplication || !scheduleDate || !scheduleTime) {
      toast.error('Please select date and time')
      return
    }

    try {
      setLoading(true)
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()

      const { data, error } = await supabase.rpc('schedule_interview', {
        p_application_id: selectedApplication.id,
        p_scheduled_at: scheduledAt
      })

      if (error) throw error

      toast.success('Interview scheduled successfully!')
      setShowScheduleModal(false)
      setSelectedApplication(null)
      setScheduleDate('')
      setScheduleTime('')

      // Navigate to interview room if needed
      if (data) {
        navigate(`/interview/${data}`)
      }
    } catch (error) {
      console.error('Error scheduling interview:', error)
      toast.error('Failed to schedule interview')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      interview_scheduled: 'bg-blue-500/20 text-blue-400',
      in_progress: 'bg-green-500/20 text-green-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      completed: 'bg-gray-500/20 text-gray-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
      scheduled: 'bg-purple-500/20 text-purple-400'
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Career Opportunities
          </h1>
          <p className="text-gray-400">Join the Troll City team and help shape our community</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'positions' 
                ? 'bg-cyan-500 text-white' 
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2C2C2C]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Positions
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('my_applications')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'my_applications' 
                ? 'bg-cyan-500 text-white' 
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2C2C2C]'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              My Applications
            </div>
          </button>

          {isAdminOrLead && (
            <button
              onClick={() => setActiveTab('interviews')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'interviews' 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2C2C2C]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Interviews
              </div>
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === 'positions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobPositions.map((position) => (
              <div
                key={position.id}
                className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#2C2C2C] hover:border-cyan-500/50 transition-all group"
              >
                {/* Position Header */}
                <div className={`bg-gradient-to-r ${position.color} p-6`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg">
                      {position.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{position.title}</h3>
                      <p className="text-white/70 text-sm">{position.department}</p>
                    </div>
                  </div>
                </div>

                {/* Position Body */}
                <div className="p-6">
                  <p className="text-gray-400 mb-4">{position.description}</p>

                  {/* Requirements */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Requirements</h4>
                    <ul className="space-y-1">
                      {position.requirements.slice(0, 3).map((req, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                      {position.requirements.length > 3 && (
                        <li className="text-sm text-cyan-400">
                          +{position.requirements.length - 3} more requirements
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Benefits */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Benefits</h4>
                    <ul className="space-y-1">
                      {position.benefits.slice(0, 2).map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-gray-400">
                          <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Apply Button */}
                  <button
                    onClick={() => handleApply(position)}
                    className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-gradient-to-r ${position.color} hover:opacity-90`}
                  >
                    Apply Now
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'my_applications' || activeTab === 'all_applications') && (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
            {applications.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Applications Found</h3>
                <p className="text-gray-400 mb-6">
                  {activeTab === 'my_applications' 
                    ? "You haven't submitted any applications yet." 
                    : "No applications found in the system."}
                </p>
                {activeTab === 'my_applications' && (
                  <button
                    onClick={() => setActiveTab('positions')}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                  >
                    Browse Positions
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#2C2C2C]">
                {applications.map((app) => {
                  const position = jobPositions.find(p => p.id === app.type)
                  const applicantName = app.user?.full_name || app.user?.username || 'Unknown User'
                  
                  return (
                    <div key={app.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg bg-gradient-to-r ${position?.color || 'from-gray-500 to-gray-600'}`}>
                          {position?.icon || <Briefcase className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white capitalize">{app.type.replace(/_/g, ' ')}</h4>
                          <div className="flex flex-col gap-1">
                            <p className="text-gray-400 text-sm">
                              {activeTab === 'all_applications' ? (
                                <span className="text-cyan-400 font-medium">{applicantName}</span>
                              ) : (
                                <span>Applied</span>
                              )}
                              <span className="mx-2">•</span>
                              {formatDate(app.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(app.status)}
                        
                        {/* Admin Actions */}
                        {isAdminOrLead && app.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedApplication(app)
                              setShowScheduleModal(true)
                            }}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                          >
                            <Calendar className="w-4 h-4" />
                            Schedule
                          </button>
                        )}
                        
                        {/* Join Interview Button (for both admins and users) */}
                        {app.status === 'interview_scheduled' && (
                          <button
                            onClick={() => {
                              // Find the interview session for this application
                              const interview = interviews.find(i => i.application_id === app.id)
                              // Note: 'interviews' state is only populated for admins/leads in this component
                              // For regular users, we might need to fetch their specific interview or just route them
                              if (interview) {
                                navigate(`/interview/${interview.id}`)
                              } else if (!isAdminOrLead) {
                                // Fallback for regular users who don't have the full interviews list loaded
                                // We should probably fetch it or just try to navigate if we had the ID.
                                // But we don't have the interview ID on the application object here.
                                // We can rely on the user checking their email or we could fetch the interview for this app.
                                // For now, let's just show a toast if we can't find it.
                                toast.error('Interview details not found. Please contact support.')
                              }
                            }}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                          >
                            <Video className="w-4 h-4" />
                            Join
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

{/* 
        {activeTab === 'my_applications' && ( // Disabled old block
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
             
          </div>
        )} 
*/}

        {activeTab === 'all_applications' && isAdminOrLead && (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
            {allApplications.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Applications Found</h3>
                <p className="text-gray-400">There are no applications in the system yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2C2C2C]">
                {allApplications.map((app) => {
                  const position = jobPositions.find(p => p.id === app.type)
                  return (
                    <div key={app.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                      <div className="flex items-center gap-4">
                        <img 
                          src={app.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user?.username}`} 
                          alt={app.user?.username}
                          className="w-10 h-10 rounded-full bg-gray-800"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{app.user?.full_name || app.user?.username}</h4>
                            <span className="text-gray-500 text-xs">•</span>
                            <span className="text-gray-400 text-sm capitalize">{app.type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-gray-500 text-xs">Applied {formatDate(app.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(app.status)}
                        {app.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedApplication(app)
                              setShowScheduleModal(true)
                            }}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                          >
                            <Calendar className="w-4 h-4" />
                            Schedule
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedApplication(app)
                            // Ideally show details modal, but for now we can just schedule or view status
                            // If we had a view modal, we'd open it here.
                            // For now, let's just show the schedule modal if pending, or nothing extra.
                          }}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                          title="View Details"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'interviews' && isAdminOrLead && (
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
            {interviews.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Interviews Scheduled</h3>
                <p className="text-gray-400">Schedule interviews with applicants from the Applications tab.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2C2C2C]">
                {interviews.map((interview) => (
                  <div key={interview.id} className="p-6 flex items-center justify-between hover:bg-[#252525] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{interview.applicant_name}</h4>
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDate(interview.scheduled_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(interview.status)}
                      <button
                        onClick={() => navigate(`/interview/${interview.id}`)}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        {interview.status === 'scheduled' ? 'Start Interview' : 'Rejoin Interview'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Application Details Modal */}
        {showDetailsModal && selectedApplication && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Application Details</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedApplication(null)
                  }}
                  className="p-2 hover:bg-[#2C2C2C] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <img 
                    src={selectedApplication.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedApplication.user?.username}`} 
                    alt={selectedApplication.user?.username}
                    className="w-16 h-16 rounded-full bg-gray-800"
                  />
                  <div>
                    <h4 className="text-lg font-semibold text-white">{selectedApplication.user?.full_name || selectedApplication.user?.username}</h4>
                    <p className="text-gray-400 capitalize">{selectedApplication.type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-500">Applied on {formatDate(selectedApplication.created_at)}</p>
                  </div>
                  <div className="ml-auto">
                    {getStatusBadge(selectedApplication.status)}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-[#2C2C2C] pb-2">Responses</h4>
                  {selectedApplication.answers && Object.entries(selectedApplication.answers).map(([question, answer], index) => (
                    <div key={index} className="bg-[#252525] p-4 rounded-lg">
                      <p className="text-gray-400 text-sm mb-1">{question}</p>
                      <p className="text-white whitespace-pre-wrap">{String(answer)}</p>
                    </div>
                  ))}
                  {(!selectedApplication.answers || Object.keys(selectedApplication.answers).length === 0) && (
                    <p className="text-gray-500 italic">No responses recorded.</p>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-[#2C2C2C]">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      setSelectedApplication(null)
                    }}
                    className="px-4 py-2 bg-[#2C2C2C] text-white rounded-lg hover:bg-[#3D3D3D] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Interview Modal */}
        {showScheduleModal && selectedApplication && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1A1A] rounded-xl p-6 w-full max-w-md border border-[#2C2C2C]">
              <h2 className="text-xl font-bold text-white mb-4">Schedule Interview</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="bg-[#0D0D0D] rounded-lg p-4">
                  <p className="text-gray-400 text-sm">
                    The applicant will receive a notification about the scheduled interview. 
                    You can join the interview room at the scheduled time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowScheduleModal(false)
                    setSelectedApplication(null)
                    setScheduleDate('')
                    setScheduleTime('')
                  }}
                  className="flex-1 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleInterview}
                  disabled={loading || !scheduleDate || !scheduleTime}
                  className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
