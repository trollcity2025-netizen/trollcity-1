import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { 
  Store, 
  Calendar, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter
} from 'lucide-react'

interface PendingItem {
  approval_type: 'business' | 'event' | 'job'
  id: string
  title: string
  description: string | null
  submitted_by: string
  submitted_at: string
  approval_status: string
}

export default function NeighborApprovals() {
  const { user, profile } = useAuthStore()
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [pendingBusinesses, setPendingBusinesses] = useState<any[]>([])
  const [pendingEvents, setPendingEvents] = useState<any[]>([])
  const [pendingJobs, setPendingJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch pending businesses
      const { data: businesses } = await supabase
        .from('neighbors_businesses')
        .select('*, profiles(username)')
        .eq('verified', false)
        .order('created_at', { ascending: false })
      
      // Fetch pending events
      const { data: events } = await supabase
        .from('neighbors_events')
        .select('*, profiles(username)')
        .eq('verified', false)
        .order('created_at', { ascending: false })
      
      // Fetch pending jobs
      const { data: jobs } = await supabase
        .from('neighbors_hiring')
        .select('*, profiles(username), neighbors_businesses(business_name)')
        .eq('verified', false)
        .order('created_at', { ascending: false })
      
      setPendingBusinesses(businesses || [])
      setPendingEvents(events || [])
      setPendingJobs(jobs || [])
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
    } finally {
      setLoading(false)
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals()
  }, [fetchPendingApprovals])

  const handleApprove = async (item: PendingItem) => {
    try {
      setSubmitting(true)
      
      if (item.approval_type === 'business') {
        await supabase.rpc('approve_neighbor_business', {
          p_business_id: item.id,
          p_approved_by: user?.id,
          p_approved: true,
          p_rejection_reason: null
        })
      } else if (item.approval_type === 'event') {
        await supabase.rpc('approve_neighbor_event', {
          p_event_id: item.id,
          p_approved_by: user?.id,
          p_approved: true,
          p_rejection_reason: null
        })
      } else if (item.approval_type === 'job') {
        await supabase.rpc('approve_neighbor_job', {
          p_job_id: item.id,
          p_approved_by: user?.id,
          p_approved: true,
          p_rejection_reason: null
        })
      }
      
      toast.success(`${item.approval_type} approved successfully`)
      setSelectedItem(null)
      fetchPendingApprovals()
    } catch (error) {
      console.error('Error approving:', error)
      toast.error('Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (item: PendingItem) => {
    try {
      setSubmitting(true)
      
      if (item.approval_type === 'business') {
        await supabase.rpc('approve_neighbor_business', {
          p_business_id: item.id,
          p_approved_by: user?.id,
          p_approved: false,
          p_rejection_reason: rejectionReason
        })
      } else if (item.approval_type === 'event') {
        await supabase.rpc('approve_neighbor_event', {
          p_event_id: item.id,
          p_approved_by: user?.id,
          p_approved: false,
          p_rejection_reason: rejectionReason
        })
      } else if (item.approval_type === 'job') {
        await supabase.rpc('approve_neighbor_job', {
          p_job_id: item.id,
          p_approved_by: user?.id,
          p_approved: false,
          p_rejection_reason: rejectionReason
        })
      }
      
      toast.success(`${item.approval_type} rejected`)
      setSelectedItem(null)
      setRejectionReason('')
      fetchPendingApprovals()
    } catch (error) {
      console.error('Error rejecting:', error)
      toast.error('Failed to reject')
    } finally {
      setSubmitting(false)
    }
  }

  const totalPending = pendingBusinesses.length + pendingEvents.length + pendingJobs.length

  const renderItemCard = (item: any, type: 'business' | 'event' | 'job') => {
    const getIcon = () => {
      if (type === 'business') return <Store className="w-5 h-5" />
      if (type === 'event') return <Calendar className="w-5 h-5" />
      return <Briefcase className="w-5 h-5" />
    }

    const getSubmittedBy = () => {
      if (type === 'business') return item.profiles?.username || 'Unknown'
      if (type === 'event') return item.profiles?.username || 'Unknown'
      return item.profiles?.username || 'Unknown'
    }

    const getDetails = () => {
      if (type === 'business') {
        return (
          <div className="space-y-2 text-sm">
            <p className="text-slate-400">Category: <span className="text-white">{item.category}</span></p>
            <p className="text-slate-400">Address: <span className="text-white">{item.address}, {item.city}, {item.state}</span></p>
            {item.phone && <p className="text-slate-400">Phone: <span className="text-white">{item.phone}</span></p>}
            {item.email && <p className="text-slate-400">Email: <span className="text-white">{item.email}</span></p>}
          </div>
        )
      }
      if (type === 'event') {
        return (
          <div className="space-y-2 text-sm">
            <p className="text-slate-400">Category: <span className="text-white">{item.category}</span></p>
            <p className="text-slate-400">Location: <span className="text-white">{item.city}, {item.state}</span></p>
            <p className="text-slate-400">Start: <span className="text-white">{new Date(item.start_time).toLocaleString()}</span></p>
            <p className="text-slate-400">Duration: <span className="text-white">{item.duration_minutes} minutes</span></p>
            {item.max_participants && <p className="text-slate-400">Max Participants: <span className="text-white">{item.max_participants}</span></p>}
          </div>
        )
      }
      // Job
      return (
        <div className="space-y-2 text-sm">
          <p className="text-slate-400">Business: <span className="text-white">{item.neighbors_businesses?.business_name}</span></p>
          <p className="text-slate-400">Location: <span className="text-white">{item.location}</span></p>
          <p className="text-slate-400">Job Type: <span className="text-white">{item.job_type}</span></p>
          {item.salary && <p className="text-slate-400">Salary: <span className="text-white">{item.salary}</span></p>}
        </div>
      )
    }

    return (
      <div 
        key={item.id} 
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
              {getIcon()}
            </div>
            <div>
              <h3 className="font-semibold text-white">{item.title || item.business_name}</h3>
              <p className="text-xs text-slate-400">by {getSubmittedBy()}</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        </div>
        
        {item.description && (
          <p className="text-sm text-slate-300 mb-3">{item.description}</p>
        )}
        
        {getDetails()}
        
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700">
          <button
            onClick={() => handleApprove({ approval_type: type, id: item.id, title: item.title || item.business_name, description: item.description, submitted_by: item.owner_user_id || item.created_by_user_id, submitted_at: item.created_at, approval_status: 'pending' })}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => setSelectedItem({ approval_type: type, id: item.id, title: item.title || item.business_name, description: item.description, submitted_by: item.owner_user_id || item.created_by_user_id, submitted_at: item.created_at, approval_status: 'pending' })}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub Tab Navigation */}
      <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('pending')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === 'pending' 
              ? 'bg-purple-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending
          {totalPending > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {totalPending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('approved')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === 'approved' 
              ? 'bg-green-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Approved
        </button>
        <button
          onClick={() => setActiveSubTab('rejected')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === 'rejected' 
              ? 'bg-red-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <XCircle className="w-4 h-4" />
          Rejected
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : activeSubTab === 'pending' ? (
        <div className="space-y-6">
          {/* Businesses */}
          {pendingBusinesses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Businesses ({pendingBusinesses.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingBusinesses.map(business => renderItemCard(business, 'business'))}
              </div>
            </div>
          )}

          {/* Events */}
          {pendingEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Events ({pendingEvents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingEvents.map(event => renderItemCard(event, 'event'))}
              </div>
            </div>
          )}

          {/* Jobs */}
          {pendingJobs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-400" />
                Job Postings ({pendingJobs.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingJobs.map(job => renderItemCard(job, 'job'))}
              </div>
            </div>
          )}

          {totalPending === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending approvals</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>View {activeSubTab} items in the database view</p>
        </div>
      )}

      {/* Rejection Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Reject {selectedItem.approval_type}</h3>
            <p className="text-slate-400 mb-4">
              You are about to reject: <span className="text-white font-medium">{selectedItem.title}</span>
            </p>
            
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Rejection Reason (optional)</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedItem(null)
                  setRejectionReason('')
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedItem)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
