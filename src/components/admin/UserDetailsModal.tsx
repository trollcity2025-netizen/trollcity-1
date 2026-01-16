import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  X,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  User,
  DollarSign,
  Bell,
  Upload
} from 'lucide-react'

interface UserDetailsModalProps {
  userId: string
  username: string
  onClose: () => void
}

interface UserComprehensiveData {
  // Profile
  profile: {
    id: string
    username: string
    email?: string
    full_name?: string
    phone?: string
    avatar_url?: string
    role: string
    level: number
    troll_coins: number
    free_coin_balance: number
    created_at: string
    onboarding_completed: boolean
    terms_accepted?: boolean
    id_verification_status?: string
    id_document_url?: string
    live_restricted_until?: string
  }

  // Tax Information
  tax_info: {
    w9_status?: string
    legal_full_name?: string
    ssn?: string
    address?: string
    submitted_at?: string
    approved_at?: string
  } | null

  // Agreements
  agreements: Array<{
    id: string
    agreement_version: string
    accepted_at: string
    ip_address?: string
  }>

  // Verification Requests
  verifications: Array<{
    id: string
    status: string
    id_photo_url?: string
    selfie_url?: string
    ai_match_score?: number
    created_at: string
    reviewed_at?: string
  }>

  // Missing Items
  missing_items: Array<{
    category: string
    item: string
    severity: 'critical' | 'warning' | 'info'
  }>

  // Applications (ID verification, etc.)
  applications: Array<{
    id: string
    type: string
    status: string
    created_at: string
    data: any
  }>
}

export default function UserDetailsModal({ userId, username, onClose }: UserDetailsModalProps) {
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserComprehensiveData | null>(null)
  const [sendingPrompt, setSendingPrompt] = useState(false)

  const loadUserData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') throw profileError
      if (!profile) {
        toast.error('User profile not found')
        return
      }

      // Fetch tax info
      const { data: taxInfo } = await supabase
        .from('user_tax_info')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      // Fetch agreements
      const { data: agreements } = await supabase
        .from('user_agreements')
        .select('*')
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false })

      // Fetch verification requests
      const { data: verifications } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Fetch applications
      const { data: applications } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Calculate missing items
      const missing_items: UserComprehensiveData['missing_items'] = []

      if (!profile.full_name) {
        missing_items.push({
          category: 'Profile',
          item: 'Full Name',
          severity: 'critical'
        })
      }

      if (!profile.email) {
        missing_items.push({
          category: 'Profile',
          item: 'Email Address',
          severity: 'critical'
        })
      }

      if (!profile.phone) {
        missing_items.push({
          category: 'Profile',
          item: 'Phone Number',
          severity: 'warning'
        })
      }

      if (!profile.onboarding_completed) {
        missing_items.push({
          category: 'Onboarding',
          item: 'Onboarding Process',
          severity: 'critical'
        })
      }

      if (!taxInfo || taxInfo.w9_status !== 'verified') {
        missing_items.push({
          category: 'Tax',
          item: 'W-9 Form (Verified)',
          severity: 'warning'
        })
      }

      if (!agreements || agreements.length === 0) {
        missing_items.push({
          category: 'Legal',
          item: 'Terms & Conditions Acceptance',
          severity: 'critical'
        })
      }

      if (profile.id_verification_status !== 'approved') {
        missing_items.push({
          category: 'Verification',
          item: 'ID Verification',
          severity: 'warning'
        })
      }

      setUserData({
        profile,
        tax_info: taxInfo || null,
        agreements: agreements || [],
        verifications: verifications || [],
        missing_items,
        applications: applications || []
      })
    } catch (error: any) {
      console.error('Error loading user data:', error)
      toast.error('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  const handlePromptUser = async () => {
    if (!userData || userData.missing_items.length === 0) {
      toast.info('No missing items to prompt for')
      return
    }

    setSendingPrompt(true)
    try {
      const missingList = userData.missing_items.map(item => `${item.category}: ${item.item}`).join(', ')

      const { error } = await supabase.rpc('notify_user_rpc', {
        p_target_user_id: userId,
        p_type: 'system_alert',
        p_title: 'Action Required: Complete Your Profile',
        p_message: `Please complete the following items: ${missingList}. Visit your profile settings to update your information.`
      })

      if (error) throw error

      toast.success('User has been notified')
    } catch (error: any) {
      console.error('Error sending prompt:', error)
      toast.error('Failed to send prompt')
    } finally {
      setSendingPrompt(false)
    }
  }

  const getStatusBadge = (status: string, _type: 'verification' | 'tax' | 'application') => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode }> = {
      // Verification statuses
      approved: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
      verified: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
      // Pending statuses
      pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
      submitted: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Clock className="w-3 h-3" /> },
      in_review: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Clock className="w-3 h-3" /> },
      // Rejected/failed statuses
      rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
      failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
      denied: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
      // Not started
      not_submitted: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <AlertCircle className="w-3 h-3" /> }
    }

    const badge = statusMap[status] || statusMap.pending

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${badge.color}`}>
        {badge.icon}
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
          <div className="text-white">Loading user data...</div>
        </div>
      </div>
    )
  }

  if (!userData) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#1A1A1A] pb-4 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <User className="w-6 h-6 text-purple-400" />
              {username}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Complete User Record</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Missing Items Alert */}
        {userData.missing_items.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Missing Items ({userData.missing_items.length})
                </h3>
                <div className="space-y-2">
                  {userData.missing_items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.severity === 'critical'
                            ? 'bg-red-500'
                            : item.severity === 'warning'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <span className="text-sm text-gray-300">
                        <span className="text-gray-400">{item.category}:</span> {item.item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handlePromptUser}
                disabled={sendingPrompt}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {sendingPrompt ? 'Sending...' : 'Prompt User'}
              </button>
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Information */}
          <div className="bg-zinc-900 rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Profile Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {userData.profile.avatar_url ? (
                  <img
                    src={userData.profile.avatar_url}
                    alt={username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                    {username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-white font-medium">{userData.profile.username}</div>
                  <div className="text-sm text-gray-400">{userData.profile.role || 'user'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Full Name</div>
                  <div className="text-white">{userData.profile.full_name || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Email</div>
                  <div className="text-white truncate">{userData.profile.email || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Phone</div>
                  <div className="text-white">{userData.profile.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Level</div>
                  <div className="text-white">{userData.profile.level || 1}</div>
                </div>
                <div>
                  <div className="text-gray-400">Paid Coins</div>
                  <div className="text-purple-400">{userData.profile.troll_coins?.toLocaleString() || 0}</div>
                </div>
                <div>
                  <div className="text-gray-400">Free Coins</div>
                  <div className="text-green-400">{userData.profile.free_coin_balance?.toLocaleString() || 0}</div>
                </div>
                <div>
                  <div className="text-gray-400">Member Since</div>
                  <div className="text-white">{new Date(userData.profile.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-gray-400">Onboarding</div>
                  <div>
                    {userData.profile.onboarding_completed ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Complete
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="bg-zinc-900 rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Tax Information
            </h3>
            {userData.tax_info ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-400">W-9 Status</div>
                  <div className="mt-1">{getStatusBadge(userData.tax_info.w9_status || 'pending', 'tax')}</div>
                </div>
                <div>
                  <div className="text-gray-400">Legal Name</div>
                  <div className="text-white">{userData.tax_info.legal_full_name || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Address</div>
                  <div className="text-white">{userData.tax_info.address || '—'}</div>
                </div>
                {userData.tax_info.submitted_at && (
                  <div>
                    <div className="text-gray-400">Submitted</div>
                    <div className="text-white">{new Date(userData.tax_info.submitted_at).toLocaleString()}</div>
                  </div>
                )}
                {userData.tax_info.approved_at && (
                  <div>
                    <div className="text-gray-400">Approved</div>
                    <div className="text-white">{new Date(userData.tax_info.approved_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No tax information submitted</div>
            )}
          </div>

          {/* ID Verification */}
          <div className="bg-zinc-900 rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              ID Verification
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400">Status</div>
                <div className="mt-1">
                  {getStatusBadge(userData.profile.id_verification_status || 'not_submitted', 'verification')}
                </div>
              </div>
              {userData.profile.id_document_url && (
                <div>
                  <div className="text-gray-400 mb-1">ID Document</div>
                  <a
                    href={userData.profile.id_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline text-xs"
                  >
                    View Document
                  </a>
                </div>
              )}
              {userData.verifications.length > 0 && (
                <div>
                  <div className="text-gray-400 mb-2">Verification History</div>
                  <div className="space-y-2">
                    {userData.verifications.slice(0, 3).map((ver) => (
                      <div key={ver.id} className="bg-black/30 rounded p-2">
                        <div className="flex justify-between items-center">
                          <span>{getStatusBadge(ver.status, 'verification')}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(ver.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {ver.ai_match_score !== null && ver.ai_match_score !== undefined && (
                          <div className="text-xs text-gray-400 mt-1">
                            Match Score: {(ver.ai_match_score * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Agreements */}
          <div className="bg-zinc-900 rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Agreements ({userData.agreements.length})
            </h3>
            {userData.agreements.length > 0 ? (
              <div className="space-y-2">
                {userData.agreements.map((agreement) => (
                  <div key={agreement.id} className="bg-black/30 rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">Version {agreement.agreement_version}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Accepted: {new Date(agreement.accepted_at).toLocaleString()}
                        </div>
                        {agreement.ip_address && (
                          <div className="text-xs text-gray-500 mt-1">IP: {agreement.ip_address}</div>
                        )}
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No agreements accepted</div>
            )}
          </div>

          {/* Applications */}
          {userData.applications.length > 0 && (
            <div className="bg-zinc-900 rounded-lg border border-white/10 p-4 md:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Applications ({userData.applications.length})
              </h3>
              <div className="grid gap-3">
                {userData.applications.slice(0, 5).map((app) => (
                  <div key={app.id} className="bg-black/30 rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">{app.type.replace(/_/g, ' ').toUpperCase()}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(app.created_at).toLocaleString()}
                        </div>
                      </div>
                      {getStatusBadge(app.status, 'application')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
