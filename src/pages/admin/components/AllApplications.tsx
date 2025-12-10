import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, Shield, RefreshCw, Video, User, Crown, Skull } from 'lucide-react'

interface Application {
  id: string
  user_id: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  user_profiles?: {
    username: string
    email?: string
  }
}

interface BroadcasterApplication {
  id: string
  user_id: string
  full_name: string
  username: string
  email: string
  application_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export default function AllApplications() {
  const { profile, user, refreshProfile } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [broadcasterApplications, setBroadcasterApplications] = useState<BroadcasterApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadApplications = async (skipLoadingState = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (!skipLoadingState) setLoading(true)

    try {
      const { data: filled } = await supabase.rpc('is_lead_officer_position_filled')
      setPositionFilled(filled || false)

      // Load regular applications
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])

      // Load broadcaster applications
      const { data: bcData, error: bcErr } = await supabase
        .from('broadcaster_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (!bcErr) setBroadcasterApplications(bcData || [])
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

    const channel2 = supabase
      .channel('broadcaster_applications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcaster_applications' }, handleRealtimeUpdate)
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(channel1)
      supabase.removeChannel(channel2)
    }
  }, [])

  // APPROVE REGULAR USER APPLICATIONS
  const handleApprove = async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      let rpcCall

      if (app.type === "lead_officer") {
        rpcCall = supabase.rpc('approve_lead_officer_application', {
          p_application_id: app.id,
          p_reviewer_id: user.id
        })
      } 
      else if (app.type === "troll_officer") {
        rpcCall = supabase.rpc('approve_officer_application', {
          p_user_id: app.user_id
        })
      }
      else {
        rpcCall = supabase.rpc('approve_application', {
          p_app_id: app.id,
          p_reviewer_id: user.id
        })
      }

      const { error } = await rpcCall
      if (error) throw error

      toast.success("Application approved!")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to approve application")
    } finally {
      setLoading(false)
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

  // APPROVE BROADCASTER
  const handleApproveBroadcaster = async (app: BroadcasterApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      // 1) Update broadcaster application
      const { error: appError } = await supabase
        .from('broadcaster_applications')
        .update({
          application_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (appError) throw appError

      // 2) Update user profile so they can Go Live
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({
          is_broadcaster: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', app.user_id)

      if (profileErr) throw profileErr

      toast.success("Broadcaster approved successfully")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to approve broadcaster")
    } finally {
      setLoading(false)
    }
  }

  // REJECT BROADCASTER
  const handleRejectBroadcaster = async (app: BroadcasterApplication) => {
    if (!user) return toast.error("You must be logged in")

    const reason = prompt("Enter rejection reason:") || "Insufficient information"

    try {
      setLoading(true)

      const { error } = await supabase.rpc('reject_broadcaster_application', {
        p_application_id: app.id,
        p_rejection_reason: reason,
        p_admin_notes: null
      })

      if (error) throw error

      toast.error("Broadcaster application denied")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to reject broadcaster")
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
      case 'broadcaster':
        return <Video className="w-4 h-4 text-cyan-400" />
      default:
        return <User className="w-4 h-4 text-gray-400" />
    }
  }

  const getApplicationTypeLabel = (type: string, isBroadcaster = false) => {
    if (isBroadcaster) return 'Broadcaster'
    switch (type) {
      case 'troll_officer':
        return 'Troll Officer'
      case 'lead_officer':
        return 'Lead Officer'
      case 'troller':
        return 'Troller'
      case 'troll_family':
        return 'Troll Family'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')
    }
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: { icon: '⏳', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
      approved: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
      rejected: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
    }
    return configs[status as keyof typeof configs] || configs.pending
  }

  // Filter applications
  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true
    return app.status === filter
  })

  const filteredBroadcasterApplications = broadcasterApplications.filter(app => {
    if (filter === 'all') return true
    return app.application_status === filter
  })

  const totalPending = applications.filter(a => a.status === 'pending').length +
    broadcasterApplications.filter(a => a.application_status === 'pending').length

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
                                  {app.status.toUpperCase()}
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
                          <button 
                            onClick={() => handleApprove(app)} 
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
                        </div>
                      ) : app.status === "approved" ? (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
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

          {/* BROADCASTER APPLICATIONS */}
          {filteredBroadcasterApplications.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                Broadcaster Applications ({filteredBroadcasterApplications.length})
              </h3>

              {filteredBroadcasterApplications.map(app => {
                const statusConfig = getStatusConfig(app.application_status)

                return (
                  <div key={app.id} className="bg-[#1A1A1A] border border-cyan-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Video className="w-4 h-4 text-cyan-400" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">{app.username}</span>
                              <span className="text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded">
                                Broadcaster
                              </span>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.border} border`}>
                                <span className="text-xs">{statusConfig.icon}</span>
                                <span className={`text-xs font-medium ${statusConfig.color}`}>
                                  {app.application_status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="text-gray-400 text-sm">{app.email}</div>
                            <div className="text-xs text-gray-500">
                              Applied: {new Date(app.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {app.application_status === "pending" ? (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproveBroadcaster(app)} 
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg flex items-center gap-1"
                          >
                            <Check className="w-4" /> Approve
                          </button>
                          <button 
                            onClick={() => handleRejectBroadcaster(app)} 
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg flex items-center gap-1"
                          >
                            <X className="w-4" /> Reject
                          </button>
                        </div>
                      ) : app.application_status === "approved" ? (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
                        </div>
                      ) : (
                        <div className="text-red-400 text-sm flex items-center gap-1">
                          <X className="w-4" /> Rejected
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* NO APPLICATIONS */}
          {filteredApplications.length === 0 && filteredBroadcasterApplications.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No applications found with the current filter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}