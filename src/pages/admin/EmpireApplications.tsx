import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { CheckCircle2, XCircle, Clock, User, Coins, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import ClickableUsername from '../../components/ClickableUsername'

interface EmpireApplication {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  payment_type: 'paid_coins' | 'card_payment'
  amount_paid: number
  payment_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  user: {
    username: string
    avatar_url: string
    troll_coins: number
  }
  reviewer: {
    username: string
  } | null
}

export default function EmpireApplications() {
  const { profile } = useAuthStore()
  const [applications, setApplications] = useState<EmpireApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  useEffect(() => {
    loadApplications()
  }, [filter])

  const loadApplications = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('empire_applications')
        .select(`
          *,
          user:user_profiles!empire_applications_user_id_fkey (
            username,
            avatar_url,
            troll_coin_balance
          ),
          reviewer:user_profiles!empire_applications_reviewed_by_fkey (
            username
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data
      const transformed = (data || []).map((app: any) => ({
        ...app,
        user: Array.isArray(app.user) ? app.user[0] : app.user,
        reviewer: Array.isArray(app.reviewer) ? app.reviewer[0] : app.reviewer
      }))

      setApplications(transformed)
    } catch (error: any) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (applicationId: string) => {
    if (!profile?.id) return

    try {
      const { error } = await supabase.rpc("approve_empire_partner", {
        p_application_id: applicationId,
        p_reviewer_id: profile.id
      })

      if (error) throw error

      toast.success('Application approved! User is now an Empire Partner.')
      
      // Refresh the approved user's profile so they see the update immediately
      // Note: The user will need to refresh their own session, but this helps
      await loadApplications()
    } catch (error: any) {
      console.error('Error approving application:', error)
      toast.error(error.message || 'Failed to approve application')
    }
  }

  const handleReject = async (applicationId: string) => {
    if (!profile?.id) return

    if (!confirm('Are you sure you want to reject this application? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase.rpc('reject_empire_partner', {
        p_application_id: applicationId,
        p_reviewer_id: profile.id
      })

      if (error) throw error

      toast.success('Application rejected.')
      loadApplications()
    } catch (error: any) {
      console.error('Error rejecting application:', error)
      toast.error(error.message || 'Failed to reject application')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length
  const approvedCount = applications.filter(a => a.status === 'approved').length
  const rejectedCount = applications.filter(a => a.status === 'rejected').length

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading applications...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Empire Partner Applications</h2>
        <p className="text-gray-400 text-sm">Review and approve Empire Partner Program applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Total</p>
          <p className="text-2xl font-bold">{applications.length}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Approved</p>
          <p className="text-2xl font-bold text-green-400">{approvedCount}</p>
        </div>
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
          <p className="text-sm text-gray-400">Rejected</p>
          <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#0A0814] text-gray-400 hover:bg-[#1A1A1A]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
        {applications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No applications found</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2C2C2C]">
            {applications.map((app) => (
              <div key={app.id} className="p-6 hover:bg-[#1A1A1A] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <img
                      src={app.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user?.username}`}
                      alt={app.user?.username}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <ClickableUsername username={app.user?.username || 'Unknown'} />
                        {app.status === 'pending' && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                        {app.status === 'approved' && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {app.status === 'rejected' && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Payment Method</p>
                          <p className="font-semibold flex items-center gap-1">
                            {app.payment_type === 'paid_coins' ? (
                              <>
                                <Coins className="w-4 h-4 text-yellow-400" />
                                {app.amount_paid} Coins
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4 text-blue-400" />
                                ${app.amount_paid}
                              </>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Applied</p>
                          <p className="font-semibold">{formatDate(app.created_at)}</p>
                        </div>
                        {app.reviewed_at && (
                          <>
                            <div>
                              <p className="text-gray-400">Reviewed By</p>
                              <p className="font-semibold">{app.reviewer?.username || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Reviewed At</p>
                              <p className="font-semibold">{formatDate(app.reviewed_at)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {app.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleApprove(app.id)
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleReject(app.id)
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

