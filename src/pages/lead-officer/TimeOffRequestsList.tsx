import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sendNotification } from '../../lib/sendNotification'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import UserNameWithAge from '../../components/UserNameWithAge'

interface TimeOffRequest {
  id: string
  officer_id: string
  date: string
  reason: string | null
  status: string
  created_at: string
  officer: {
    username: string
    avatar_url: string | null
    created_at?: string
  }
}

export default function TimeOffRequestsList() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(false)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('officer_time_off_requests')
        .select(`
          *,
          officer:user_profiles!officer_time_off_requests_officer_id_fkey(username, avatar_url, created_at)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      setRequests(data as any || [])
    } catch (err: any) {
      console.error('Error loading time off requests:', err)
      toast.error('Failed to load time off requests')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId: string, action: 'approve' | 'reject', officerId: string, date: string) => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return

    try {
      const { error } = await supabase
        .from('officer_time_off_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      if (action === 'approve') {
        // Try to delete any existing shift for this date
        const { error: deleteError } = await supabase
          .from('officer_shift_slots')
          .delete()
          .eq('officer_id', officerId)
          .eq('shift_date', date)
          .eq('status', 'scheduled') // Only delete scheduled shifts, not active/completed if that logic exists

        if (deleteError) {
          console.error('Error deleting shift:', deleteError)
        }
      }

      // Notify officer
      await sendNotification(
        officerId,
        'officer_update',
        'Time Off Request Update',
        `Your time off request for ${date} has been ${action}d.${action === 'approve' ? ' Any scheduled shift for this date has been removed.' : ''}`
      )
      
      toast.success(`Request ${action}d`)
      loadRequests()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    loadRequests()
    
    // Polling every 30s instead of Realtime to save DB resources
    const interval = setInterval(loadRequests, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading && requests.length === 0) return <div className="text-gray-400 text-sm animate-pulse">Loading requests...</div>

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-400" />
                Pending Time Off Requests
            </h3>
            <button onClick={loadRequests} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
        </div>

      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No pending time off requests.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-black/40 border border-orange-500/20 hover:border-orange-500/40 transition rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                    <UserNameWithAge 
                      user={{
                        id: req.officer_id, 
                        username: req.officer?.username || 'Unknown',
                        created_at: req.officer?.created_at
                      }} 
                    />
                    <span className="text-gray-400 text-sm">requested off for</span>
                    <span className="text-orange-200 font-bold bg-orange-500/10 px-2 py-0.5 rounded">{req.date}</span>
                </div>
                {req.reason && (
                    <p className="text-sm text-gray-400 ml-1 border-l-2 border-gray-700 pl-2">&quot;{req.reason}&quot;</p>
                )}
                <p className="text-xs text-gray-600 mt-2">Requested: {new Date(req.created_at).toLocaleString()}</p>
              </div>
              
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleAction(req.id, 'approve', req.officer_id, req.date)}
                  className="px-3 py-1.5 bg-green-900/30 text-green-400 border border-green-800/50 rounded hover:bg-green-900/50 transition flex items-center gap-2 text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleAction(req.id, 'reject', req.officer_id, req.date)}
                  className="px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/50 rounded hover:bg-red-900/50 transition flex items-center gap-2 text-sm font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
