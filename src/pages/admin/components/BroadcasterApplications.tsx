import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  Eye, Check, X, FileText, User, Building2, 
  CreditCard, Calendar, MapPin, Filter, RefreshCw 
} from 'lucide-react'

interface BroadcasterApplication {
  id: string
  user_id: string
  full_name: string
  username: string
  email: string
  country: string | null
  date_of_birth: string | null
  address: string | null
  ssn_last_four: string | null
  ssn_verified: boolean
  id_verification_submitted: boolean
  id_verification_url: string | null
  tax_form_submitted: boolean
  tax_form_url: string | null
  bank_account_last_four: string | null
  bank_routing_number: string | null
  bank_account_verified: boolean
  ein: string | null
  is_business: boolean
  application_status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export default function BroadcasterApplications() {
  const { profile, user } = useAuthStore()
  const [applications, setApplications] = useState<BroadcasterApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<BroadcasterApplication | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [adminNotes, setAdminNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [officers, setOfficers] = useState<any[]>([])
  
  // Check if user can manage officers (admin or lead officer)
  const canManageOfficers = profile?.is_admin || profile?.role === 'admin' || profile?.is_lead_officer

  const loadApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('broadcaster_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])
    } catch (error: any) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = loadApplications

  const loadOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_troll_officer, is_officer_active, role, created_at')
        .or('is_troll_officer.eq.true,role.eq.troll_officer')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOfficers(data || [])
    } catch (error: any) {
      console.error('Error loading officers:', error)
    }
  }

  useEffect(() => {
    loadApplications()
    if (canManageOfficers) {
      loadOfficers()
    }

    // Real-time subscription
    const channel = supabase
      .channel('broadcaster_applications_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'broadcaster_applications' },
        () => {
          loadApplications()
        }
      )
      .subscribe()

    const officersChannel = supabase
      .channel('officers_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => {
          if (canManageOfficers) loadOfficers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(officersChannel)
    }
  }, [canManageOfficers])

  const handleApprove = async (app: BroadcasterApplication) => {
    try {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      console.log('Approving application:', app.id, 'User:', user.id)

      // Direct UPDATE approach - more reliable than RPC
      // Note: updated_at will be handled by trigger if column exists
      const { error: updateError } = await supabase
        .from('broadcaster_applications')
        .update({
          application_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }

      // Check if this is an officer application
      const { data: officerApp } = await supabase
        .from('applications')
        .select('type, status')
        .eq('user_id', app.user_id)
        .in('type', ['troll_officer', 'officer'])
        .maybeSingle()

      const isOfficerApplication = officerApp?.type === 'troll_officer' || officerApp?.type === 'officer'

      // Grant broadcaster status
      const profileUpdate: any = {
        is_broadcaster: true,
        updated_at: new Date().toISOString()
      }

      // If officer application, grant officer status but NOT active (requires orientation)
      if (isOfficerApplication) {
        profileUpdate.is_troll_officer = true
        profileUpdate.is_officer = true
        profileUpdate.role = 'troll_officer'
        profileUpdate.is_officer_active = false // Must complete orientation first
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', app.user_id)

      if (profileError) {
        console.error('Profile update error:', profileError)
        // Don't fail if this errors - might already be set
      }

      // If officer application, assign orientation and badge
      if (isOfficerApplication) {
        // Assign orientation (required before becoming active)
        const { error: orientationError } = await supabase.rpc('assign_officer_orientation', {
          p_user_id: app.user_id
        })

        if (orientationError) {
          console.error('Error assigning orientation:', orientationError)
          // Non-fatal, continue
        } else {
          // Create notification for orientation assignment
          await supabase.rpc('create_notification', {
            p_user_id: app.user_id,
            p_type: 'officer_update',
            p_title: 'Orientation Assigned',
            p_message: 'To become an active Troll Officer, complete your orientation test.',
            p_metadata: { link: '/officer/orientation' }
          })
        }

        // Check if badge exists
        const { data: badge } = await supabase
          .from('badges')
          .select('id')
          .eq('badge_key', 'troll_officer')
          .maybeSingle()

        if (badge) {
          // Assign badge to user
          await supabase
            .from('user_badges')
            .upsert({
              user_id: app.user_id,
              badge_id: badge.id,
              earned_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,badge_id'
            })
        }
      }

      // Send notification
      await supabase.from('notifications').insert({
        user_id: app.user_id,
        message: '🎉 Your broadcaster application has been approved! You can now Go Live.',
        type: 'success',
        read: false
      })

      toast.success('Application approved!')
      
      // Send email notification
      try {
        await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/sendEmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
          },
          body: JSON.stringify({
            to: app.email,
            subject: '🎉 Approved — You are now a Broadcaster!',
            html: `
              <p>Hi ${app.full_name},</p>
              <p>You're officially approved as a TrollCity broadcaster!</p>
              <p>You can now go live, receive gifts, earn coins, and grow your community.</p>
              <br>
              <p>🚀 Start streaming: ${window.location.origin}/go-live</p>
              <p>– TrollCity Team</p>
            `
          })
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // Don't fail the approval if email fails
      }

      setSelectedApp(null)
      setAdminNotes('')
      loadApplications()
    } catch (error: any) {
      console.error('Approve error:', error)
      const errorMsg = error?.message || error?.error || 'Failed to approve application'
      toast.error(errorMsg)
    }
  }

  const handleFireOfficer = async (officerId: string, officerUsername: string) => {
    if (!user || !canManageOfficers) {
      toast.error('You do not have permission to fire officers')
      return
    }

    const reason = prompt(`Enter reason for firing ${officerUsername}:`)
    if (!reason || !reason.trim()) {
      toast.error('Reason is required')
      return
    }

    if (!confirm(`Are you sure you want to fire ${officerUsername}? This will downgrade them to a regular user.`)) {
      return
    }

    try {
      const { data, error } = await supabase.rpc('fire_officer', {
        p_officer_id: officerId,
        p_fired_by: user.id,
        p_reason: reason.trim()
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Officer ${officerUsername} has been fired`)
        loadOfficers()
      } else {
        toast.error(data?.error || 'Failed to fire officer')
      }
    } catch (error: any) {
      console.error('Fire officer error:', error)
      toast.error(error?.message || 'Failed to fire officer')
    }
  }

  const handleReject = async (app: BroadcasterApplication) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    try {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      console.log('Rejecting application:', app.id, 'Reason:', rejectionReason, 'User:', user.id)

      // Direct UPDATE approach - more reliable than RPC
      // Note: updated_at will be handled by trigger if column exists
      const { error: updateError } = await supabase
        .from('broadcaster_applications')
        .update({
          application_status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          admin_notes: adminNotes || null
        })
        .eq('id', app.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }

      // Send in-app notification
      await supabase.from('notifications').insert({
        user_id: app.user_id,
        message: `⚠️ Your broadcaster application was rejected. Reason: ${rejectionReason}`,
        type: 'warning',
        read: false
      })

      // Send email notification
      try {
        await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/sendEmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
          },
          body: JSON.stringify({
            to: app.email,
            subject: '⚠️ Broadcaster Application Update',
            html: `
              <p>Hi ${app.full_name},</p>
              <p>Your broadcaster application was reviewed.</p>
              <p><strong>Status: Rejected</strong></p>
              <p>Reason: ${rejectionReason}</p>
              <p>You may update your information and reapply anytime.</p>
              <p>– TrollCity Team</p>
            `
          })
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
      }

      toast.success('Application rejected')
      setSelectedApp(null)
      setRejectionReason('')
      setAdminNotes('')
      loadApplications()
    } catch (error: any) {
      console.error('Reject error:', error)
      const errorMsg = error?.message || error?.error || 'Failed to reject application'
      toast.error(errorMsg)
    }
  }

  const filteredApplications = applications.filter(app => {
    if (statusFilter === 'all') return true
    return app.application_status === statusFilter
  })

  const stats = {
    pending: applications.filter(a => a.application_status === 'pending').length,
    approved: applications.filter(a => a.application_status === 'approved').length,
    rejected: applications.filter(a => a.application_status === 'rejected').length,
  }

  const maskSSN = (ssn: string | null) => {
    if (!ssn) return 'N/A'
    return `***-**-${ssn}`
  }

  const maskBankAccount = (account: string | null) => {
    if (!account) return 'N/A'
    return `****${account}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          Broadcaster Applications
        </h2>
        <button
          onClick={loadApplications}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-[#0D0D0D] border border-gray-700 rounded-lg px-3 py-1 text-white text-sm"
        >
          <option value="all">All Applications</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Applications Table */}
      <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
        {loading && applications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Loading applications...</div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No applications found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-[#0D0D0D]">
                  <th className="px-4 py-3 text-left text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-gray-400">Country</th>
                  <th className="px-4 py-3 text-left text-gray-400">ID Verified</th>
                  <th className="px-4 py-3 text-left text-gray-400">Tax Form</th>
                  <th className="px-4 py-3 text-left text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-gray-400">Created</th>
                  <th className="px-4 py-3 text-right text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((app) => (
                  <tr 
                    key={app.id} 
                    className="border-b border-gray-800 hover:bg-[#252525] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {app.is_business && <Building2 className="w-4 h-4 text-purple-400" />}
                        <span className="font-medium text-white">{app.full_name}</span>
                      </div>
                      <div className="text-gray-400 text-[10px]">@{app.username}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{app.email}</td>
                    <td className="px-4 py-3 text-gray-300">{app.country || 'N/A'}</td>
                    <td className="px-4 py-3">
                      {app.id_verification_submitted ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-500">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {app.tax_form_submitted ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-500">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                        app.application_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        app.application_status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {app.application_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-purple-500/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1A1A1A] border-b border-purple-500/30 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Application Details</h3>
              <button
                onClick={() => {
                  setSelectedApp(null)
                  setAdminNotes('')
                  setRejectionReason('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Information */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Full Name</div>
                    <div className="text-white">{selectedApp.full_name}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Username</div>
                    <div className="text-white">@{selectedApp.username}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Email</div>
                    <div className="text-white">{selectedApp.email}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Country</div>
                    <div className="text-white">{selectedApp.country || 'N/A'}</div>
                  </div>
                  {selectedApp.date_of_birth && (
                    <div>
                      <div className="text-gray-400">Date of Birth</div>
                      <div className="text-white">{new Date(selectedApp.date_of_birth).toLocaleDateString()}</div>
                    </div>
                  )}
                  {selectedApp.address && (
                    <div className="col-span-2">
                      <div className="text-gray-400">Address</div>
                      <div className="text-white">{selectedApp.address}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Information */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Verification
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-400">SSN (Last 4)</div>
                    <div className="text-white">{maskSSN(selectedApp.ssn_last_four)}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Personal information is verified securely via third-party provider. Admins cannot view full SSN.
                    </p>
                  </div>
                  <div>
                    <div className="text-gray-400">ID Verification</div>
                    {selectedApp.id_verification_url ? (
                      <a
                        href={selectedApp.id_verification_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline"
                      >
                        View ID Document
                      </a>
                    ) : (
                      <div className="text-gray-500">Not submitted</div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-400">Tax Form</div>
                    {selectedApp.tax_form_url ? (
                      <a
                        href={selectedApp.tax_form_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline"
                      >
                        View Tax Form
                      </a>
                    ) : (
                      <div className="text-gray-500">Not submitted</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Information
                </h4>
                <div className="space-y-3 text-sm">
                  {selectedApp.is_business && (
                    <div>
                      <div className="text-gray-400">Business Account</div>
                      <div className="text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-400" />
                        Yes
                      </div>
                      {selectedApp.ein && (
                        <div className="mt-2">
                          <div className="text-gray-400">EIN</div>
                          <div className="text-white">{selectedApp.ein}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <div className="text-gray-400">Bank Account</div>
                    <div className="text-white">{maskBankAccount(selectedApp.bank_account_last_four)}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Admins cannot view full bank account numbers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              {selectedApp.application_status === 'pending' && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700 space-y-4">
                  <h4 className="text-sm font-semibold text-purple-400">Admin Actions</h4>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Admin Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm"
                      placeholder="Add internal notes about this application..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleApprove(selectedApp)
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:')
                        if (reason) {
                          setRejectionReason(reason)
                          handleReject(selectedApp)
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Status Information */}
              {selectedApp.application_status !== 'pending' && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3">Review Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-gray-400">Status</div>
                      <div className={`font-medium ${
                        selectedApp.application_status === 'approved' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {selectedApp.application_status.toUpperCase()}
                      </div>
                    </div>
                    {selectedApp.reviewed_at && (
                      <div>
                        <div className="text-gray-400">Reviewed At</div>
                        <div className="text-white">{new Date(selectedApp.reviewed_at).toLocaleString()}</div>
                      </div>
                    )}
                    {selectedApp.rejection_reason && (
                      <div>
                        <div className="text-gray-400">Rejection Reason</div>
                        <div className="text-red-400">{selectedApp.rejection_reason}</div>
                      </div>
                    )}
                    {selectedApp.admin_notes && (
                      <div>
                        <div className="text-gray-400">Admin Notes</div>
                        <div className="text-white">{selectedApp.admin_notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

