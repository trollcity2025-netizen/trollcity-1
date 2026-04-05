import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, Shield, RefreshCw, User, Crown, Skull, Radio } from 'lucide-react'

interface Application {
  id: string
  user_id: string
  type: string
  status: 'pending' | 'approved' | 'rejected' | 'interview_scheduled'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  user_profiles?: {
    username: string
    email?: string
  }
}

export default function AllApplications() {
  const { user, refreshProfile } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [attorneyApps, setAttorneyApps] = useState<Application[]>([])
  const [prosecutorApps, setProsecutorApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'interview_scheduled'>('pending')
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  const loadApplications = async (skipLoadingState = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (!skipLoadingState) setLoading(true)

    try {
      const { data: filled } = await supabase.rpc('is_lead_officer_position_filled')
      setPositionFilled(filled || false)

      // Load regular applications (exclude hard-deleted/archived)
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!applications_user_id_fkey (
            username,
            email
          )
        `)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])

      // Load attorney applications
      const { data: attorneyData } = await supabase
        .from('attorney_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (attorneyData && attorneyData.length > 0) {
        const userIds = attorneyData.map(a => a.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', userIds)
          
          const mapped = attorneyData.map((app: any) => ({
            ...app,
            type: 'attorney',
            user_profiles: users?.find((u: any) => u.id === app.user_id) || null
          }))
          setAttorneyApps(mapped)
        } else {
          setAttorneyApps([])
        }
      } else {
        setAttorneyApps([])
      }

      // Load prosecutor applications similarly
      const { data: prosecutorData } = await supabase
        .from('prosecutor_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (prosecutorData && prosecutorData.length > 0) {
        const userIds = prosecutorData.map(p => p.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', userIds)
          
          const mapped = prosecutorData.map((app: any) => ({
            ...app,
            type: 'prosecutor',
            user_profiles: users?.find((u: any) => u.id === app.user_id) || null
          }))
          setProsecutorApps(mapped)
        } else {
          setProsecutorApps([])
        }
      } else {
        setProsecutorApps([])
      }

    } catch (err) {
      toast.error("Failed to load applications")
      console.error(err)
    } finally {
      loadingRef.current = false
      if (!skipLoadingState) setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()

    const handleRealtimeUpdate = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        loadApplications(true)
      }, 500)
    }

    const channel1 = supabase
      .channel('applications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, handleRealtimeUpdate)
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(channel1)
    }
  }, [])

  // Open modal or direct approve
  const initiateApprove = (app: Application) => {
      // Check if this role typically needs an interview
      const interviewRoles = ['troll_officer', 'lead_troll_officer', 'secretary', 'seller', 'lead_officer'];
      if (interviewRoles.includes(app.type)) {
          setSelectedApp(app);
          setShowScheduleModal(true);
          // Default to tomorrow 10am
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setScheduleDate(tomorrow.toISOString().split('T')[0]);
          setScheduleTime('10:00');
      } else {
          // Direct approve for others
          handleApprove(app);
      }
  }

  // APPROVE / SCHEDULE via Edge Function
  const handleApprove = async (app: Application, withInterview = false) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)
      if (withInterview) setIsScheduling(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
          body: {
              action: 'approve_application',
              applicationId: app.id,
              type: app.type,
              userId: app.user_id,
              interviewDate: withInterview ? scheduleDate : undefined,
              interviewTime: withInterview ? scheduleTime : undefined
          }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Failed to approve application");

      toast.success(withInterview ? "Interview scheduled successfully!" : "Application approved!");

      setShowScheduleModal(false);
      setSelectedApp(null);

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to approve application")
    } finally {
      setLoading(false)
      setIsScheduling(false)
    }
  }

  // REJECT REGULAR APPLICATIONS
  const handleReject = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase.rpc('deny_application', {
        p_app_id: app.id,
        p_reviewer_id: user.id,
        p_reason: null
      })

      if (error) throw error

      toast.error("Application denied.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to deny application")
    } finally {
      setLoading(false)
    }
  }

  // APPROVE ATTORNEY APPLICATION
  const handleApproveAttorney = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")
    try {
      setLoading(true)
      const { error } = await supabase.rpc('approve_attorney_application', {
        p_application_id: app.id,
        p_reviewer_id: user.id
      })
      if (error) throw error
      toast.success("Attorney application approved!")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: any) {
      toast.error(err.message || "Failed to approve attorney application")
    } finally {
      setLoading(false)
    }
  }

  // DENY ATTORNEY APPLICATION
  const handleDenyAttorney = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")
    try {
      setLoading(true)
      const { error } = await supabase.rpc('deny_attorney_application', {
        p_application_id: app.id,
        p_reviewer_id: user.id,
        p_reason: null
      })
      if (error) throw error
      toast.error("Attorney application denied.")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: any) {
      toast.error(err.message || "Failed to deny attorney application")
    } finally {
      setLoading(false)
    }
  }

  // APPROVE PROSECUTOR APPLICATION
  const handleApproveProsecutor = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")
    try {
      setLoading(true)
      const { error } = await supabase.rpc('approve_prosecutor_application', {
        p_application_id: app.id,
        p_reviewer_id: user.id
      })
      if (error) throw error
      toast.success("Prosecutor application approved!")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: any) {
      toast.error(err.message || "Failed to approve prosecutor application")
    } finally {
      setLoading(false)
    }
  }

  // DENY PROSECUTOR APPLICATION
  const handleDenyProsecutor = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")
    try {
      setLoading(true)
      const { error } = await supabase.rpc('deny_prosecutor_application', {
        p_application_id: app.id,
        p_reviewer_id: user.id,
        p_reason: null
      })
      if (error) throw error
      toast.error("Prosecutor application denied.")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: any) {
      toast.error(err.message || "Failed to deny prosecutor application")
    } finally {
      setLoading(false)
    }
  }

  const getApplicationIcon = (type: string) => {
    switch (type) {
      case 'troll_officer':
        return <Shield className="w-4 h-4 text-purple-400" />
      case 'lead_officer':
        return <Crown className="w-4 h-4 text-yellow-400" />
      case 'troller':
        return <Skull className="w-4 h-4 text-red-400" />
      case 'troll_station_dj':
        return <Radio className="w-4 h-4 text-pink-400" />
      case 'troll_station_manager':
        return <Crown className="w-4 h-4 text-purple-400" />
      case 'attorney':
        return <User className="w-4 h-4 text-amber-400" />
      case 'prosecutor':
        return <User className="w-4 h-4 text-red-400" />
      default:
        return <User className="w-4 h-4 text-gray-400" />
    }
  }

  const getApplicationTypeLabel = (type: string) => {
    switch (type) {
      case 'troll_officer':
        return 'Troll Officer'
      case 'lead_officer':
        return 'Lead Officer'
      case 'troller':
        return 'Troller'
      case 'troll_family':
        return 'Troll Family'
      case 'troll_station_dj':
        return 'Troll Station DJ'
      case 'troll_station_manager':
        return 'Troll Station Manager'
      case 'attorney':
        return 'Attorney'
      case 'prosecutor':
        return 'Prosecutor'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')
    }
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: { icon: '⏳', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
      approved: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
      rejected: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
      interview_scheduled: { icon: '📅', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' }
    }
    return configs[status as keyof typeof configs] || configs.pending
  }

  // Combine all types of applications
  const allApps = [
    ...applications,
    ...attorneyApps.filter(a => a.status === 'pending'),
    ...prosecutorApps.filter(p => p.status === 'pending')
  ]

  // Filter applications
  const filteredApplications = allApps.filter(app => {
    if (filter === 'all') return true
    return app.status === filter
  })

  const totalPending = allApps.filter(a => a.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          All Applications
          <span className="text-sm font-normal text-gray-400">
            ({totalPending} pending)
          </span>
        </h2>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-3 py-1 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Only</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
          
          <button
            onClick={() => loadApplications()}
            disabled={loading}
            className="px-3 py-1 bg-purple-600 text-white rounded-lg flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading applications...</div>
      ) : (
        <div className="space-y-6">
          {/* USER APPLICATIONS */}
          {filteredApplications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                User Applications ({filteredApplications.length})
              </h3>
              
              {filteredApplications.map(app => {
                const isLead = app.type === "lead_officer"
                const disable = isLead && positionFilled
                const statusConfig = getStatusConfig(app.status)

                return (
                  <div key={app.id} className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getApplicationIcon(app.type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">
                                {app.user_profiles?.username || "Unknown User"}
                              </span>
                              <span className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded">
                                {getApplicationTypeLabel(app.type)}
                              </span>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.border} border`}>
                                <span className="text-xs">{statusConfig.icon}</span>
                                <span className={`text-xs font-medium ${statusConfig.color}`}>
                                  {app.status.toUpperCase().replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Applied: {new Date(app.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {app.status === "pending" && !disable ? (
                        <div className="flex gap-2">
                          {app.type === 'attorney' ? (
                            <>
                              <button 
                                onClick={() => handleApproveAttorney(app)} 
                                className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button 
                                onClick={() => handleDenyAttorney(app)} 
                                className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Deny
                              </button>
                            </>
                          ) : app.type === 'prosecutor' ? (
                            <>
                              <button 
                                onClick={() => handleApproveProsecutor(app)} 
                                className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button 
                                onClick={() => handleDenyProsecutor(app)} 
                                className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Deny
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => initiateApprove(app)} 
                                className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button 
                                onClick={() => handleReject(app)} 
                                className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Deny
                              </button>
                            </>
                          )}
                        </div>
                      ) : app.status === "approved" ? (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
                        </div>
                      ) : app.status === "interview_scheduled" ? (
                         <div className="text-cyan-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Interview Scheduled
                        </div>
                      ) : (
                        <div className="text-red-400 text-sm flex items-center gap-1">
                          <X className="w-4" /> Denied
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* NO APPLICATIONS */}
          {filteredApplications.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No applications found with the current filter.
            </div>
          )}
        </div>
      )}

      {/* SCHEDULE INTERVIEW MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-4">Schedule Interview</h3>
                <p className="text-gray-400 mb-6">
                    Schedule an interview for <span className="text-white">{selectedApp?.user_profiles?.username}</span>.
                </p>
                
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Date</label>
                        <input 
                            type="date" 
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-[#0A0814] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Time</label>
                        <input 
                            type="time" 
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full bg-[#0A0814] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => selectedApp && handleApprove(selectedApp, true)}
                        disabled={isScheduling || !scheduleDate || !scheduleTime}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
                    </button>
                    <button
                        onClick={() => selectedApp && handleApprove(selectedApp, false)}
                        disabled={isScheduling}
                        className="w-full py-3 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-lg font-medium disabled:opacity-50"
                    >
                        Skip Interview (Direct Approve)
                    </button>
                    <button
                        onClick={() => setShowScheduleModal(false)}
                        disabled={isScheduling}
                        className="text-gray-400 text-sm hover:text-white mt-2"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
