import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Shield, CheckCircle, XCircle, Award } from 'lucide-react'

interface VerificationRequest {
  id: string
  user_id: string
  id_photo_url: string
  selfie_url: string
  ai_match_score: number | null
  ai_behavior_score: number | null
  status: string
  influencer_tier: boolean
  created_at: string
  reviewed_at: string | null
  admin_note: string | null
  user_profiles?: {
    username: string | null
    email: string | null
  }
}

export default function AdminVerificationReview() {
  const { profile } = useAuthStore()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'approved' | 'denied'>('all')
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  useEffect(() => {
    if (!isAdmin) return

    loadRequests()

    const channel = supabase
      .channel('verification_requests_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'verification_requests' },
        () => loadRequests()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdmin, filter])

  const loadRequests = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('verification_requests')
        .select(`
          *,
          user_profiles(username, email)
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setRequests((data as any) || [])
    } catch (error: any) {
      console.error('Error loading requests:', error)
      toast.error('Failed to load verification requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string, userId: string, grantInfluencer: boolean = false) => {
    setProcessing(requestId)
    try {
      await supabase
        .from('verification_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          admin_reviewer: profile?.id,
          admin_note: adminNote || null,
          influencer_tier: grantInfluencer
        })
        .eq('id', requestId)

      await supabase
        .from('user_profiles')
        .update({
          is_verified: true,
          verification_date: new Date().toISOString(),
          influencer_tier: grantInfluencer ? 'gold' : null
        })
        .eq('id', userId)

      toast.success('Verification approved')
      setSelectedRequest(null)
      loadRequests()
    } catch (error: any) {
      console.error('Error approving:', error)
      toast.error('Failed to approve verification')
    } finally {
      setProcessing(null)
    }
  }

  const handleDeny = async (requestId: string) => {
    setProcessing(requestId)
    try {
      await supabase
        .from('verification_requests')
        .update({
          status: 'denied',
          reviewed_at: new Date().toISOString(),
          admin_reviewer: profile?.id,
          admin_note: adminNote || null
        })
        .eq('id', requestId)

      toast.success('Verification denied')
      setSelectedRequest(null)
      loadRequests()
    } catch (error: any) {
      console.error('Error denying:', error)
      toast.error('Failed to deny verification')
    } finally {
      setProcessing(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-purple-400" />
        <h1 className="text-3xl font-bold">Verification Review</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'in_review', 'approved', 'denied'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === f
                ? 'bg-purple-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No verification requests</div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-black/60 border border-purple-600 rounded-lg p-4 hover:bg-black/80 transition-colors cursor-pointer"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">
                      {request.user_profiles?.username || request.user_id.substring(0, 8)}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      request.status === 'approved'
                        ? 'bg-green-900 text-green-300'
                        : request.status === 'denied'
                        ? 'bg-red-900 text-red-300'
                        : request.status === 'in_review'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="text-sm opacity-70">
                    Match: {request.ai_match_score?.toFixed(1) || 'N/A'}% | 
                    Behavior: {request.ai_behavior_score?.toFixed(1) || 'N/A'}%
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    {new Date(request.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {request.status === 'pending' || request.status === 'in_review' ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRequest(request)
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                      >
                        Review
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Review: {selectedRequest.user_profiles?.username || selectedRequest.user_id}
              </h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-semibold mb-2">ID Photo</h3>
                <img
                  src={selectedRequest.id_photo_url}
                  alt="ID"
                  className="w-full rounded-lg border border-purple-600"
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Selfie</h3>
                <img
                  src={selectedRequest.selfie_url}
                  alt="Selfie"
                  className="w-full rounded-lg border border-purple-600"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="text-sm opacity-70 mb-1">AI Match Score</div>
                <div className="text-2xl font-bold text-purple-300">
                  {selectedRequest.ai_match_score?.toFixed(1) || 'N/A'}%
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="text-sm opacity-70 mb-1">Behavior Score</div>
                <div className="text-2xl font-bold text-blue-300">
                  {selectedRequest.ai_behavior_score?.toFixed(1) || 'N/A'}%
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Admin Note</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
                rows={3}
                placeholder="Optional note..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleApprove(selectedRequest.id, selectedRequest.user_id, false)}
                disabled={processing === selectedRequest.id}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedRequest.id, selectedRequest.user_id, true)}
                disabled={processing === selectedRequest.id}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Award className="w-5 h-5" />
                Approve + Gold Badge
              </button>
              <button
                onClick={() => handleDeny(selectedRequest.id)}
                disabled={processing === selectedRequest.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

