import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, Shield, User, RefreshCw, Video } from 'lucide-react'

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

export default function AdminApplications() {
  const { profile, user, refreshProfile } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [broadcasterApplications, setBroadcasterApplications] = useState<BroadcasterApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadApplications = async (skipLoadingState = false) => {
    // Prevent concurrent loads
    if (loadingRef.current) {
      console.log('Skipping loadApplications - already loading')
      return
    }

    loadingRef.current = true
    if (!skipLoadingState) {
      setLoading(true)
    }
    
    try {
      // Check if lead officer position is filled
      const { data: filled } = await supabase.rpc('is_lead_officer_position_filled')
      setPositionFilled(filled || false)

      // Load regular applications
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])

      // Load broadcaster applications
      const { data: broadcasterData, error: broadcasterError } = await supabase
        .from('broadcaster_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (broadcasterError) {
        console.warn('Error loading broadcaster applications:', broadcasterError)
      } else {
        setBroadcasterApplications(broadcasterData || [])
      }
    } catch (error: any) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      loadingRef.current = false
      if (!skipLoadingState) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadApplications()

    // Debounced real-time subscription handler
    const handleRealtimeUpdate = () => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      
      // Set new timer to debounce rapid updates
      debounceTimerRef.current = setTimeout(() => {
        console.log('Real-time update triggered - reloading applications')
        loadApplications(true) // Skip loading state to avoid UI flicker
      }, 500) // 500ms debounce
    }

    const channel1 = supabase
      .channel('applications_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'applications' },
        handleRealtimeUpdate
      )
      .subscribe()

    const channel2 = supabase
      .channel('broadcaster_applications_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'broadcaster_applications' },
        handleRealtimeUpdate
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel1)
      supabase.removeChannel(channel2)
    }
  }, [])

  const handleApprove = async (app: Application) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    try {
      setLoading(true)

      // Use appropriate RPC based on application type
      let rpcCall
      if (app.type === 'lead_officer') {
        rpcCall = supabase.rpc('approve_lead_officer_application', {
          p_application_id: app.id,
          p_reviewer_id: user.id
        })
      } else if (app.type === 'troll_officer') {
        rpcCall = supabase.rpc('approve_officer_application', {
          p_user_id: app.user_id
        })
      } else if (app.type === 'troll_family') {
        // For troll family, update user profile and application status
        const appData = app.data as any
        const appReason = (app as any).reason as string | undefined
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            troll_family_name: appData?.family_name || appReason?.split(' ')[0] || 'Troll Family',
            troll_family_role: 'admin',
            is_troll_family_member: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', app.user_id)
        
        if (updateError) throw updateError

        rpcCall = supabase.rpc('approve_application', {
          p_app_id: app.id,
          p_reviewer_id: user.id
        })
      } else {
        rpcCall = supabase.rpc('approve_application', {
          p_app_id: app.id,
          p_reviewer_id: user.id
        })
      }

      const { data, error } = await rpcCall

      if (error) throw error

      toast.success('Application approved!')
      // Prevent scroll by maintaining scroll position
      const scrollY = window.scrollY
      const scrollX = window.scrollX
      await loadApplications()
      // Refresh profile to show new role instantly
      if (refreshProfile) {
        await refreshProfile()
      }
      // Use requestAnimationFrame to restore scroll position smoothly
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY)
      })
    } catch (err: any) {
      console.error('Approve error:', err)
      toast.error(err.message || 'Failed to approve application')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (app: Application) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('deny_application', {
        p_app_id: app.id,
        p_reviewer_id: user.id,
        p_reason: null // Optional - can add prompt if needed
      })

      if (error) throw error

      toast.error('Application denied.')
      // Prevent scroll by maintaining scroll position
      const scrollY = window.scrollY
      await loadApplications()
      // Refresh profile in case role was affected
      if (refreshProfile) {
        await refreshProfile()
      }
      // Restore scroll position after a brief delay to allow DOM updates
      setTimeout(() => window.scrollTo(0, scrollY), 0)
    } catch (err: any) {
      console.error('Reject error:', err)
      toast.error(err.message || 'Failed to reject application')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveBroadcaster = async (app: BroadcasterApplication) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    try {
      console.log('Approving broadcaster application:', app.id)
      
      const { data, error } = await supabase.rpc('approve_broadcaster', {
        p_application_id: app.id
      })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      console.log('RPC response:', data)

      if (data?.success) {
        toast.success('Broadcaster application approved')
        // Prevent scroll by maintaining scroll position
        const scrollY = window.scrollY
        // Wait a bit for database to update
        await new Promise(resolve => setTimeout(resolve, 300))
        await loadApplications()
        // Refresh profile to show new role instantly
        if (refreshProfile) {
          await refreshProfile()
        }
        // Restore scroll position after a brief delay to allow DOM updates
        setTimeout(() => window.scrollTo(0, scrollY), 0)
      } else {
        const errorMsg = data?.error || 'Failed to approve application'
        console.error('Approval failed:', errorMsg)
        toast.error(errorMsg)
      }
    } catch (error: any) {
      console.error('Approve broadcaster error:', error)
      toast.error(error?.message || 'Failed to approve application')
    }
  }

  const handleRejectBroadcaster = async (app: BroadcasterApplication) => {
    if (!user) {
      toast.error('You must be logged in')
      return
    }

    // Prompt for rejection reason
    const reason = prompt('Enter rejection reason (optional):') || 'Not enough information'

    try {
      const { data, error } = await supabase.rpc('reject_broadcaster_application', {
        p_application_id: app.id,
        p_rejection_reason: reason,
        p_admin_notes: null
      })

      if (error) {
        console.error('RPC error:', error)
        toast.error(error.message || 'Failed to reject application')
        return
      }

      if (data?.success) {
        toast.success('Application denied!')
        // Prevent scroll by maintaining scroll position
        const scrollY = window.scrollY
        await loadApplications()
        // Refresh profile in case role was affected
        if (refreshProfile) {
          await refreshProfile()
        }
        // Restore scroll position after a brief delay to allow DOM updates
        setTimeout(() => window.scrollTo(0, scrollY), 0)
      } else {
        const errorMsg = data?.error || 'Failed to reject application'
        console.error('Rejection failed:', errorMsg)
        toast.error(errorMsg)
      }
    } catch (error: any) {
      console.error('Reject broadcaster error:', error)
      toast.error(error?.message || 'Failed to reject application')
    }
  }

  // Show all applications, not just pending ones
  const filteredApplications = applications
  const filteredBroadcasterApplications = broadcasterApplications
  const totalPending = applications.filter(app => app.status === 'pending').length + 
                       broadcasterApplications.filter(app => app.application_status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          All Applications
        </h2>
        <button
          onClick={() => loadApplications()}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading applications...</div>
      ) : totalPending === 0 ? (
        <div className="text-center py-8 text-gray-400">No pending applications</div>
      ) : (
        <div className="space-y-4">
          {/* Regular Applications */}
          {filteredApplications.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">User Applications ({filteredApplications.length})</h3>
              <div className="space-y-3">
                {filteredApplications.map((app) => {
            const isLeadOfficer = app.type === 'lead_officer'
            const isDisabled = isLeadOfficer && positionFilled

            return (
              <div
                key={app.id}
                className={`bg-[#1A1A1A] border rounded-lg p-4 ${
                  isDisabled ? 'opacity-50 border-gray-700' : 'border-purple-500/30'
                }`}
                onClick={(e) => {
                  // Prevent any navigation when clicking on the card
                  e.stopPropagation()
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold">
                        {app.user_profiles?.username || 'Unknown User'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        isLeadOfficer
                          ? 'bg-purple-900 text-purple-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {app.type.replace('_', ' ').toUpperCase()}
                      </span>
                      {isDisabled && (
                        <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400">
                          Position Filled
                        </span>
                      )}
                    </div>
                    {app.user_profiles?.username && (
                      <div className="text-sm text-gray-400">
                        User: {app.user_profiles.username}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {app.status === 'approved' ? (
                      <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2 border border-green-500/30">
                        <Check className="w-4 h-4" />
                        Approved ✓
                      </div>
                    ) : app.status === 'rejected' ? (
                      <div className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-500/30">
                        <X className="w-4 h-4" />
                        Denied ✗
                      </div>
                    ) : isDisabled ? (
                      <div className="text-sm text-gray-500 px-4 py-2">
                        Cannot approve - position filled
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleApprove(app)
                            }}
                            className="px-3 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 rounded-lg"
                          >
                            APPROVE
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleReject(app)
                            }}
                            className="px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 rounded-lg"
                          >
                            DENY
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
              </div>
            </div>
          )}

          {/* Broadcaster Applications */}
          {filteredBroadcasterApplications.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Broadcaster Applications ({filteredBroadcasterApplications.length})
              </h3>
              <div className="space-y-3">
                {filteredBroadcasterApplications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white font-semibold">
                            {app.username || app.full_name || 'Unknown User'}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-purple-900 text-purple-300">
                            BROADCASTER
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {app.full_name && <div>Name: {app.full_name}</div>}
                          {app.email && <div>Email: {app.email}</div>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Applied: {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {app.application_status === 'approved' ? (
                          <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-2 border border-green-500/30">
                            <Check className="w-4 h-4" />
                            Approved ✓
                          </div>
                        ) : app.application_status === 'rejected' ? (
                          <div className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-500/30">
                            <X className="w-4 h-4" />
                            Denied ✗
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleApproveBroadcaster(app)
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRejectBroadcaster(app)
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
