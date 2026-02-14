import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { 
  Users, 
  Video, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Calendar,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InterviewSchedulerModal } from '../../../components/admin/InterviewSchedulerModal';

interface InterviewRequest {
  id: string;
  type: string;
  user_id: string;
  created_at: string;
  is_dismissed?: boolean;
  data: {
    reason?: string;
    room_id?: string;
    [key: string]: any;
  };
  user?: {
    username: string;
    avatar_url: string;
  };
}

interface Applicant {
  id: string; // application id
  user_id: string;
  status: string;
  created_at: string;
  type: string;
  user_profiles?: {
    username: string;
    avatar_url: string;
    email?: string;
  };
}

export default function AdminInterviewDashboard() {
  const [requests, setRequests] = useState<InterviewRequest[]>([]);
  const [applications, setApplications] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Scheduler state
  const [showScheduler, setShowScheduler] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<{id: string, name: string} | null>(null);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          user_profiles (
            username,
            avatar_url,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match Applicant interface if needed, or use as is
      setApplications(data || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
      // Don't toast here to avoid spamming if used in parallel
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch notifications that are interview requests
      // We explicitly select columns. If is_dismissed is missing in DB, this might throw.
      // However, we provided the migration to fix this.
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          user_id,
          created_at,
          data,
          is_dismissed
        `)
        .eq('type', 'interview_request')
        .order('created_at', { ascending: false });

      if (error) {
        // If the error is about missing column, we handle it gracefully-ish
        if (error.message?.includes('is_dismissed')) {
          toast.error('Database schema out of date. Please run the migration.');
        } else {
          throw error;
        }
      }

      if (data) {
        // Filter out dismissed ones client-side if we couldn't filter in query
        // (though ideally we'd filter in query: .eq('is_dismissed', false))
        const activeRequests = data.filter(r => !r.is_dismissed);
        
        // Fetch user details for these requests
        const userIds = Array.from(new Set(activeRequests.map(r => r.user_id)));
        
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
            
          if (users) {
            const userMap = new Map(users.map(u => [u.id, u]));
            const requestsWithUsers = activeRequests.map(r => ({
              ...r,
              user: userMap.get(r.user_id)
            }));
            setRequests(requestsWithUsers);
          } else {
            setRequests(activeRequests);
          }
        } else {
          setRequests([]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching interview requests:', err);
      toast.error('Failed to load interview requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchApplications();
    
    // Subscribe to new interview requests
    const channel = supabase
      .channel('admin-interviews')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: "type=eq.interview_request"
      }, () => {
        fetchRequests();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'applications'
      }, () => {
        fetchApplications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleJoin = (roomId: string) => {
    if (!roomId) {
      toast.error('No room ID associated with this request');
      return;
    }
    navigate(`/interview/${roomId}?admin=true`);
  };

  const handleApprove = async (appId: string) => {
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'approve_lead_application', applicationId: appId }
      });

      if (error) throw error;

      toast.success('Application approved');
      
      // Prompt to schedule
      const app = applications.find(a => a.id === appId);
      if (app) {
         setSelectedApplicant({
             id: app.user_id,
             name: app.user_profiles?.username || 'Unknown'
         });
         setShowScheduler(true);
      }
      
      fetchApplications();
    } catch (error: any) {
      console.error('Error approving application:', error);
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (appId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return;
    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'reject_lead_application', applicationId: appId }
      });

      if (error) throw error;

      toast.success('Application rejected');
      fetchApplications();
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      toast.error('Failed to reject application');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_dismissed: true,
          dismissed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Request dismissed');
    } catch (err: any) {
      console.error('Error dismissing request:', err);
      toast.error('Failed to dismiss request');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-zinc-950 min-h-full">
      {/* Pending Applications Section */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-purple-400" />
          Pending Applications
          <span className="text-sm font-normal text-zinc-500 ml-2">
            ({applications.length})
          </span>
        </h2>
        
        {applications.length === 0 ? (
          <p className="text-zinc-500">No pending applications.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="bg-black/40 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                   <img 
                    src={app.user_profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user_id}`} 
                    alt={app.user_profiles?.username} 
                    className="w-10 h-10 rounded-full bg-zinc-800"
                  />
                  <div>
                    <div className="font-semibold text-white">
                      @{app.user_profiles?.username || 'Unknown'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Applied: {new Date(app.created_at).toLocaleDateString()} • {app.type.toUpperCase().replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedApplicant({
                        id: app.user_id,
                        name: app.user_profiles?.username || 'Unknown'
                      });
                      setShowScheduler(true);
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Interview
                  </button>
                  <button
                    onClick={() => handleApprove(app.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Interview Room Queue
          </h2>
          <p className="text-zinc-400 mt-1">
            Manage incoming interview requests from users.
          </p>
        </div>
        <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
          <span className="text-zinc-400 text-sm">Active Requests: </span>
          <span className="text-white font-bold ml-1">{requests.length}</span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl border-dashed">
          <div className="p-4 bg-zinc-800/50 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white">All Caught Up</h3>
          <p className="text-zinc-500 mt-1">No pending interview requests at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => (
            <div 
              key={req.id} 
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={req.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user_id}`} 
                    alt="User" 
                    className="w-10 h-10 rounded-full bg-zinc-800"
                  />
                  <div>
                    <h3 className="font-bold text-white">@{req.user?.username || 'Unknown User'}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {req.data?.reason && (
                   <div className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs text-indigo-300">
                      {req.data.reason}
                   </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300 border border-zinc-800/50">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                    <p className="italic">
                      &quot;{req.data?.message || 'I would like to request an interview.'}&quot;
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => handleDismiss(req.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleJoin(req.data?.room_id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                  >
                    <Video className="w-4 h-4" />
                    Join Room
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedApplicant && (
        <InterviewSchedulerModal
          isOpen={showScheduler}
          onClose={() => {
            setShowScheduler(false);
            setSelectedApplicant(null);
          }}
          applicantId={selectedApplicant.id}
          applicantName={selectedApplicant.name}
          onScheduled={() => {
             fetchApplications();
             fetchRequests();
          }}
        />
      )}
    </div>
  );
}
