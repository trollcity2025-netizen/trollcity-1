import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Loader2
} from 'lucide-react';

interface PayoutRequest {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  requested_coins: number;
  paypal_email: string;
  status: string;
  usd_amount: number;
  paypal_fee: number;
  net_amount: number;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
  rejected_reason: string | null;
  total_earned_coins: number;
  total_paid_out: number;
}

interface PayoutStats {
  total_requested: number;
  total_completed: number;
  total_pending: number;
  total_failed: number;
  pending_count: number;
}

const PayoutAdmin: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async () => {
    try {
      setLoading(true);

      // Load payout requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('payout_dashboard')
        .select('*')
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Load global stats (simplified - would need a proper function)
      const pendingCount = requestsData?.filter(r => ['pending', 'approved'].includes(r.status)).length || 0;

      setRequests(requestsData || []);
      setStats({
        total_requested: requestsData?.reduce((sum, r) => sum + r.requested_coins, 0) || 0,
        total_completed: requestsData?.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.requested_coins, 0) || 0,
        total_pending: requestsData?.filter(r => ['pending', 'approved', 'processing'].includes(r.status)).reduce((sum, r) => sum + r.requested_coins, 0) || 0,
        total_failed: requestsData?.filter(r => r.status === 'failed').reduce((sum, r) => sum + r.requested_coins, 0) || 0,
        pending_count: pendingCount
      });

    } catch (error) {
      console.error('Error loading payout data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      // Check if user has permission (admin or lead_officer)
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user!.id)
        .single();

      if (userError) throw userError;

      if (!['admin', 'lead_officer'].includes(userData.role)) {
        toast.error('Insufficient permissions');
        return;
      }

      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'approved',
          reviewed_by: user!.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Payout request approved');
      loadPayoutData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    }
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    try {
      // Check if user has permission (admin or lead_officer)
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user!.id)
        .single();

      if (userError) throw userError;

      if (!['admin', 'lead_officer'].includes(userData.role)) {
        toast.error('Insufficient permissions');
        return;
      }

      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: 'rejected',
          rejected_reason: reason,
          reviewed_by: user!.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Payout request rejected');
      loadPayoutData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    }
  };

  const processPayout = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data, error } = await supabase.rpc('process_payout', {
        p_request_id: requestId
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Payout sent to PayPal for processing');
        loadPayoutData();
      } else {
        toast.error(data.error || 'Failed to process payout');
      }
    } catch (error: any) {
      console.error('Error processing payout:', error);
      toast.error(error.message || 'Failed to process payout');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-900/20';
      case 'approved': return 'text-blue-400 bg-blue-900/20';
      case 'processing': return 'text-purple-400 bg-purple-900/20';
      case 'completed': return 'text-green-400 bg-green-900/20';
      case 'rejected': return 'text-red-400 bg-red-900/20';
      case 'failed': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesSearch = search === '' ||
      request.username.toLowerCase().includes(search.toLowerCase()) ||
      request.paypal_email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4"></div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-700 rounded"></div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Payout Management</h3>
            <p className="text-sm text-gray-400">Review and process creator payouts</p>
          </div>
        </div>
        <button
          onClick={loadPayoutData}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Total Requested</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.total_requested.toLocaleString()}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Completed</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.total_completed.toLocaleString()}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Pending</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.total_pending.toLocaleString()}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400">Failed</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.total_failed.toLocaleString()}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400">Action Needed</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.pending_count}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username or PayPal email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Payout Requests */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No payout requests found</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={request.avatar_url || '/default-avatar.png'}
                    alt={request.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <h4 className="font-medium text-white">{request.username}</h4>
                    <p className="text-sm text-gray-400">{request.paypal_email}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  <span className="capitalize">{request.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-400">Requested</div>
                  <div className="text-lg font-bold text-white">{request.requested_coins.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">${request.usd_amount?.toFixed(2)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">PayPal Fee</div>
                  <div className="text-lg font-bold text-red-400">${request.paypal_fee?.toFixed(2)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">Net Payment</div>
                  <div className="text-lg font-bold text-green-400">${request.net_amount?.toFixed(2)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">Available Balance</div>
                  <div className="text-lg font-bold text-blue-400">
                    {(request.total_earned_coins - request.total_paid_out).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                <span>Requested: {formatDate(request.requested_at)}</span>
                {request.processed_at && (
                  <span>Processed: {formatDate(request.processed_at)}</span>
                )}
                {request.completed_at && (
                  <span>Completed: {formatDate(request.completed_at)}</span>
                )}
              </div>

              {request.rejected_reason && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-4">
                  <p className="text-red-400 text-sm">
                    <strong>Rejection Reason:</strong> {request.rejected_reason}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {request.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveRequest(request.id)}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason) rejectRequest(request.id, reason);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}

              {request.status === 'approved' && (
                <button
                  onClick={() => processPayout(request.id)}
                  disabled={processing === request.id}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                  {processing === request.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      Send Payout
                    </>
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PayoutAdmin;