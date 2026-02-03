 import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { Check, X, Shield, RefreshCw, AlertTriangle } from 'lucide-react'

import UserNameWithAge from '../../../components/UserNameWithAge'

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
    created_at?: string
    rgb_username_expires_at?: string
  }
}

interface SellerAppeal {
  id: string
  user_id: string
  type: string
  status: 'denied'
  updated_at?: string
  appeal_requested: boolean
  appeal_reason: string
  appeal_requested_at: string
  appeal_status: 'pending' | 'approved' | 'denied'
  appeal_notes?: string
  store_name?: string
  store_description?: string
  contact_email?: string
  user_profiles?: {
    username: string
    email?: string
  }
}

export default function AdminApplications() {
  const { user, refreshProfile } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [sellerAppeals, setSellerAppeals] = useState<SellerAppeal[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const loadApplications = useCallback(async (skipLoadingState = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (!skipLoadingState) setLoading(true)

    try {
      const [appRes, appealRes] = await Promise.all([
        supabase.functions.invoke('admin-actions', { body: { action: 'get_applications' } }),
        supabase.functions.invoke('admin-actions', { body: { action: 'get_seller_appeals' } })
      ])

      const { data: appData, error: appError } = appRes
      const { data: appealData, error: appealError } = appealRes

      if (appError) throw appError
      if (appData?.error) throw new Error(appData.error)

      setPositionFilled(appData.positionFilled || false)
      setApplications(appData.applications || [])

      if (!appealError && !appealData?.error) {
        setSellerAppeals(appealData.appeals || [])
      }
    } catch (err: unknown) {
      toast.error("Failed to load applications")
      console.error(err)
    } finally {
      loadingRef.current = false
      if (!skipLoadingState) setLoading(false)
    }
  }, [])

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
  }, [loadApplications])


  // APPROVE REGULAR USER APPLICATIONS
  const handleApprove = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'approve_application',
            applicationId: app.id,
            type: app.type,
            userId: app.user_id
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // Handle specific success messages based on type
      if (app.type === "seller") {
        toast.success("Seller application approved! Store created and user can now manage their shop.")
      } else if (app.type === "lead_officer") {
        toast.success("Lead Officer application approved!")
      } else if (app.type === "troll_officer") {
        toast.success("Troll Officer application approved!")
      } else {
        toast.success("Application approved!")
      }

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // REJECT REGULAR APPLICATIONS
  const handleReject = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'deny_application',
            applicationId: app.id,
            reason: null // Or prompt for reason if needed, current code passed null
        }
      });

      if (error) throw error

      toast.error("Application denied.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deny application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])

  const handleApproveOverride = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    const confirmed = window.confirm('Approve this application even though it was previously rejected?')
    if (!confirmed) return

    await handleApprove(app)
  }, [user, handleApprove])

  const handleDelete = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    const confirmed = window.confirm('Permanently delete this application? This cannot be undone.')
    if (!confirmed) return

    try {
      setLoading(true)

      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'delete_application',
            applicationId: app.id
        }
      });

      if (error) throw error

      toast.success("Application deleted.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])



// APPROVE SELLER APPEAL
  const handleApproveAppeal = useCallback(async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Optional approval notes:")

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'review_seller_appeal',
            applicationId: appeal.id,
            reviewAction: 'approve',
            notes: notes || undefined
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success("Seller appeal approved! Store access restored.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve appeal"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // REJECT SELLER APPEAL
  const handleRejectAppeal = useCallback(async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Rejection reason (required):")
    if (!notes) return

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'review_seller_appeal',
            applicationId: appeal.id,
            reviewAction: 'deny',
            notes: notes
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.error("Seller appeal denied")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to deny appeal"
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  const counts = {
    pending: applications.filter(a => a.status === 'pending').length + sellerAppeals.length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }

  const visibleApplications = applications.filter((a) => a.status === activeTab)

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
        <h3 className="text-blue-300 font-semibold mb-2">📋 Applications</h3>
        <p className="text-blue-200 text-sm">
          View all applications and triage them by status. Pending items are those not approved yet.
        </p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          Applications Admin
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
            {visibleApplications.map(app => {
              const isLead = app.type === "lead_officer"
              const isSeller = app.type === "seller"
              const disable = isLead && positionFilled

              return (
                <div key={app.id} className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4">

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserNameWithAge
                          user={{
                            username: app.user_profiles?.username || "Unknown User",
                            created_at: app.user_profiles?.created_at,
                            rgb_username_expires_at: app.user_profiles?.rgb_username_expires_at
                          }}
                          className="text-white font-semibold"
                        />
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
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      {app.status === "pending" && activeTab === 'pending' && !disable && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(app)} className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg">APPROVE</button>
                          <button onClick={() => handleReject(app)} className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg">DENY</button>
                        </div>
                      )}
                      {app.status === "approved" && (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
                        </div>
                      )}
                      {app.status === "rejected" && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-red-400 text-sm flex items-center gap-1">
                            <X className="w-4" /> Denied
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveOverride(app)}
                              className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                            >
                              APPROVE ANYWAY
                            </button>
                            <button
                              onClick={() => handleDelete(app)}
                              className="px-3 py-2 bg-gray-700 text-white text-xs rounded-lg"
                            >
                              DELETE
                            </button>
                          </div>
                        </div>
                      )}
                      {app.status !== "rejected" && (
                        <button
                          onClick={() => handleDelete(app)}
                          className="px-3 py-1 bg-gray-800 text-gray-200 text-[11px] rounded-lg mt-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>

          {/* SELLER APPEALS */}
          {activeTab === 'pending' && (
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
                        Originally denied: {appeal.updated_at ? new Date(appeal.updated_at).toLocaleDateString() : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        Appeal submitted: {appeal.appeal_requested_at ? new Date(appeal.appeal_requested_at).toLocaleDateString() : '-'}
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
          )}
        </>
      )}
    </div>
  )
}
