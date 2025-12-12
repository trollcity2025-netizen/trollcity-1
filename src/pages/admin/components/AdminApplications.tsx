 import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, Shield, RefreshCw, Video, AlertTriangle } from 'lucide-react'

interface Application {
  id: string
  user_id: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  lead_officer_approved: boolean | null
  lead_officer_reviewed_by: string | null
  lead_officer_reviewed_at: string | null
  store_name?: string
  store_description?: string
  product_types?: string
  contact_email?: string
  user_profiles?: {
    username: string
    email?: string
  }
}

interface SellerAppeal {
  id: string
  user_id: string
  type: string
  status: 'denied'
  appeal_requested: boolean
  appeal_reason: string
  appeal_requested_at: string
  appeal_status: 'pending' | 'approved' | 'denied'
  appeal_notes?: string
  store_name?: string
  store_description?: string
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
  const [sellerAppeals, setSellerAppeals] = useState<SellerAppeal[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadApplications = async (skipLoadingState = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (!skipLoadingState) setLoading(true)

    try {
      const { data: filled } = await supabase.rpc('is_lead_officer_position_filled')
      setPositionFilled(filled || false)

      // Load regular applications (only Lead Officer approved ones for admin review)
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .eq('lead_officer_approved', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])

      // Load broadcaster applications
      const { data: bcData, error: bcErr } = await supabase
        .from('broadcaster_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (!bcErr) setBroadcasterApplications(bcData || [])

      // Load seller appeals
      const { data: appealsData, error: appealsErr } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles!user_id (
            username,
            email
          )
        `)
        .eq('type', 'seller')
        .eq('appeal_requested', true)
        .eq('appeal_status', 'pending')
        .order('appeal_requested_at', { ascending: false })

      if (!appealsErr) setSellerAppeals(appealsData || [])
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

      if (app.type === "seller") {
        // Special handling for seller applications
        const { error: appError } = await supabase
          .from('applications')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', app.id)

        if (appError) throw appError

        // Grant seller permissions to user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            seller_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', app.user_id)

        if (profileError) throw profileError

        // Auto-create store for the seller
        const { error: storeError } = await supabase
          .from('stores')
          .insert({
            owner_id: app.user_id,
            name: app.store_name || `${app.user_profiles?.username || 'User'}'s Store`,
            description: app.store_description || 'A new seller store'
          })

        if (storeError) throw storeError

        toast.success("Seller application approved! Store created and user can now manage their shop.")
      }
      else if (app.type === "lead_officer") {
        const { error } = await supabase.rpc('approve_lead_officer_application', {
          p_application_id: app.id,
          p_reviewer_id: user.id
        })
        if (error) throw error
        toast.success("Lead Officer application approved!")
      }
      else if (app.type === "troll_officer") {
        const { error } = await supabase.rpc('approve_officer_application', {
          p_user_id: app.user_id
        })
        if (error) throw error
        toast.success("Troll Officer application approved!")
      }
      else {
        const { error } = await supabase.rpc('approve_application', {
          p_app_id: app.id,
          p_reviewer_id: user.id
        })
        if (error) throw error
        toast.success("Application approved!")
      }

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


  // ⭐ APPROVE BROADCASTER — THE CRITICAL FIX
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

  // APPROVE SELLER APPEAL
  const handleApproveAppeal = async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Optional approval notes:")

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('review_seller_appeal', {
        p_application_id: appeal.id,
        p_action: 'approve',
        p_notes: notes || null
      })

      if (error) throw error

      if (data?.success) {
        toast.success("Seller appeal approved! Application and store created.")
      } else {
        toast.error(data?.error || "Failed to approve appeal")
      }

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to approve appeal")
    } finally {
      setLoading(false)
    }
  }

  // REJECT SELLER APPEAL
  const handleRejectAppeal = async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Rejection reason (required):")
    if (!notes) return

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('review_seller_appeal', {
        p_application_id: appeal.id,
        p_action: 'deny',
        p_notes: notes
      })

      if (error) throw error

      if (data?.success) {
        toast.error("Seller appeal denied")
      } else {
        toast.error(data?.error || "Failed to deny appeal")
      }

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: any) {
      toast.error(err.message || "Failed to deny appeal")
    } finally {
      setLoading(false)
    }
  }


  const totalPending =
    applications.filter(a => a.status === 'pending').length +
    broadcasterApplications.filter(a => a.application_status === 'pending').length +
    sellerAppeals.length

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
        <h3 className="text-blue-300 font-semibold mb-2">📋 New Application Process</h3>
        <p className="text-blue-200 text-sm">
          All applications now require Lead Officer approval first, then admin final approval.
          Only Lead Officer approved applications are shown below.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          Lead Officer Approved Applications
        </h2>

        <button
          onClick={() => loadApplications()}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading applications...</div>
      ) : (
        <>

          {/* USER APPLICATIONS */}
          <div className="space-y-3">
            {applications.map(app => {
              const isLead = app.type === "lead_officer"
              const isSeller = app.type === "seller"
              const disable = isLead && positionFilled

              return (
                <div key={app.id} className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4">

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold">
                          {app.user_profiles?.username || "Unknown User"}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          isSeller
                            ? 'bg-orange-900 text-orange-300'
                            : 'bg-purple-900 text-purple-300'
                        }`}>
                          {app.type.toUpperCase().replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </div>

                      {/* Seller Application Details */}
                      {isSeller && (
                        <div className="space-y-2 text-sm">
                          {app.store_name && (
                            <div>
                              <span className="text-gray-400">Store:</span>
                              <span className="text-white ml-2">{app.store_name}</span>
                            </div>
                          )}
                          {app.store_description && (
                            <div>
                              <span className="text-gray-400">Description:</span>
                              <span className="text-white ml-2">{app.store_description}</span>
                            </div>
                          )}
                          {app.product_types && (
                            <div>
                              <span className="text-gray-400">Products:</span>
                              <span className="text-white ml-2">{app.product_types}</span>
                            </div>
                          )}
                          {app.contact_email && (
                            <div>
                              <span className="text-gray-400">Email:</span>
                              <span className="text-white ml-2">{app.contact_email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {app.status === "pending" && !disable ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(app)} className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg">APPROVE</button>
                          <button onClick={() => handleReject(app)} className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg">DENY</button>
                        </div>
                      ) : app.status === "approved" ? (
                        <div className="text-green-400 text-sm flex items-center gap-1"><Check className="w-4" /> Approved</div>
                      ) : (
                        <div className="text-red-400 text-sm flex items-center gap-1"><X className="w-4" /> Denied</div>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>

          {/* BROADCASTER APPLICATIONS */}
          <div className="space-y-3 mt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              Broadcaster Applications
            </h3>

            {broadcasterApplications.map(app => (
              <div key={app.id} className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4">

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{app.username}</div>
                    <div className="text-gray-400 text-sm">{app.email}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {app.application_status === "pending" ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveBroadcaster(app)} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg flex items-center gap-1">
                        <Check className="w-4" /> Approve
                      </button>
                      <button onClick={() => handleRejectBroadcaster(app)} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg flex items-center gap-1">
                        <X className="w-4" /> Reject
                      </button>
                    </div>
                  ) : app.application_status === "approved" ? (
                    <div className="text-green-400 text-sm flex items-center gap-1"><Check className="w-4" /> Approved</div>
                  ) : (
                    <div className="text-red-400 text-sm flex items-center gap-1"><X className="w-4" /> Rejected</div>
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* SELLER APPEALS */}
          <div className="space-y-3 mt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Seller Appeals {sellerAppeals.length > 0 && `(${sellerAppeals.length})`}
            </h3>

            {sellerAppeals.map(appeal => (
              <div key={appeal.id} className="bg-[#1A1A1A] border border-orange-500/30 rounded-lg p-4">

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold">
                        {appeal.user_profiles?.username || "Unknown User"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-orange-900 text-orange-300">
                        APPEAL PENDING
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      Originally denied: {new Date(appeal.updated_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      Appeal submitted: {new Date(appeal.appeal_requested_at).toLocaleDateString()}
                    </div>

                    {/* Appeal Reason */}
                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-1">Appeal Reason:</div>
                      <div className="text-white text-sm bg-gray-900/50 p-2 rounded">
                        {appeal.appeal_reason}
                      </div>
                    </div>

                    {/* Original Application Details */}
                    <div className="space-y-2 text-sm">
                      {appeal.store_name && (
                        <div>
                          <span className="text-gray-400">Store:</span>
                          <span className="text-white ml-2">{appeal.store_name}</span>
                        </div>
                      )}
                      {appeal.store_description && (
                        <div>
                          <span className="text-gray-400">Description:</span>
                          <span className="text-white ml-2">{appeal.store_description}</span>
                        </div>
                      )}
                      {appeal.contact_email && (
                        <div>
                          <span className="text-gray-400">Email:</span>
                          <span className="text-white ml-2">{appeal.contact_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveAppeal(appeal)}
                        className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-4" /> Approve Appeal
                      </button>
                      <button
                        onClick={() => handleRejectAppeal(appeal)}
                        className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4" /> Deny Appeal
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))}

            {sellerAppeals.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No pending seller appeals</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
