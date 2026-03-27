import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Search,
  RefreshCw,
  Eye,
  Scale
} from 'lucide-react';
import { trollCityTheme } from '../../styles/trollCityTheme';

type AppealCategory = 'non_delivery' | 'not_as_described' | 'damaged_item' | 'seller_issue' | 'buyer_issue' | 'payment_issue' | 'other';
type AppealStatus = 'pending' | 'under_review' | 'approved' | 'denied' | 'escalated' | 'withdrawn';

interface Appeal {
  id: string;
  appeal_number: number;
  user_id: string;
  order_id: string | null;
  shop_id: string | null;
  category: AppealCategory;
  description: string;
  desired_resolution: string | null;
  evidence_urls: string[] | null;
  status: AppealStatus;
  amount_in_dispute: number;
  escrow_release_status: string;
  created_at: string;
  updated_at: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  related_user_id: string | null;
  user?: {
    username: string;
    avatar_url: string | null;
  };
  related_user?: {
    username: string;
    avatar_url: string | null;
  };
  shop?: {
    shop_name: string;
  };
  order?: {
    order_number: string;
    buyer_id: string;
    seller_id: string;
    total_coins: number;
    status: string;
    escrow_status: string;
  };
  actions?: AppealAction[];
}

interface AppealAction {
  id: string;
  action_type: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
  user_id: string | null;
}

interface AppealStats {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  denied: number;
}

const CATEGORY_LABELS: Record<AppealCategory, string> = {
  non_delivery: 'Non-Delivery',
  not_as_described: 'Not As Described',
  damaged_item: 'Damaged Item',
  seller_issue: 'Seller Issue',
  buyer_issue: 'Buyer Issue',
  payment_issue: 'Payment Issue',
  other: 'Other'
};

const STATUS_COLORS: Record<AppealStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  approved: 'bg-green-500/20 text-green-400 border-green-500/40',
  denied: 'bg-red-500/20 text-red-400 border-red-500/40',
  escalated: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  withdrawn: 'bg-gray-500/20 text-gray-400 border-gray-500/40'
};

export default function AppealManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Data
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [stats, setStats] = useState<AppealStats>({ total: 0, pending: 0, under_review: 0, approved: 0, denied: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const checkAccess = useCallback(async () => {
    if (!user) {
      navigate('/');
      return;
    }

    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single();

      if (!profileData || (!profileData.is_admin && profileData.role !== 'admin' && profileData.role !== 'secretary')) {
        setAccessDenied(true);
        toast.error('Unauthorized access');
        navigate('/');
        return;
      }
    } catch (error) {
      console.error('Access check error:', error);
      navigate('/');
    } finally {
      setCheckingAccess(false);
    }
  }, [user, navigate]);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transaction_appeals')
        .select(`
          *,
          user:user_profiles!user_id(username, avatar_url),
          related_user:user_profiles!related_user_id(username, avatar_url),
          shop:trollcity_shops!shop_id(shop_name),
          order:shop_orders!order_id(order_number, buyer_id, seller_id, total_coins, status, escrow_status)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Fetch actions for selected appeal if we have one
      const appealsWithActions = data || [];
      
      // Calculate stats
      const newStats: AppealStats = {
        total: appealsWithActions.length,
        pending: appealsWithActions.filter((a: Appeal) => a.status === 'pending').length,
        under_review: appealsWithActions.filter((a: Appeal) => a.status === 'under_review').length,
        approved: appealsWithActions.filter((a: Appeal) => a.status === 'approved').length,
        denied: appealsWithActions.filter((a: Appeal) => a.status === 'denied').length
      };
      setStats(newStats);
      
      setAppeals(appealsWithActions);
      
    } catch (error) {
      console.error('Error fetching appeals:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchAppealActions = async (appealId: string) => {
    try {
      const { data } = await supabase
        .from('appeal_actions')
        .select('*')
        .eq('appeal_id', appealId)
        .order('created_at', { ascending: true });
      
      return data || [];
    } catch (error) {
      console.error('Error fetching actions:', error);
      return [];
    }
  };

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!checkingAccess && !accessDenied) {
      fetchAppeals();
    }
  }, [fetchAppeals, checkingAccess, accessDenied]);

  const handleSelectAppeal = async (appeal: Appeal) => {
    const actions = await fetchAppealActions(appeal.id);
    setSelectedAppeal({ ...appeal, actions });
    setReviewNotes('');
  };

  const handleUpdateStatus = async (newStatus: AppealStatus) => {
    if (!user || !selectedAppeal) return;
    
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('review_appeal', {
        p_appeal_id: selectedAppeal.id,
        p_reviewer_id: user.id,
        p_new_status: newStatus,
        p_review_notes: reviewNotes || null,
        p_action: 'status_changed'
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Appeal ${newStatus} successfully!`);
        fetchAppeals();
        
        // Update selected appeal
        if (selectedAppeal) {
          const updatedActions = await fetchAppealActions(selectedAppeal.id);
          setSelectedAppeal({
            ...selectedAppeal,
            status: newStatus,
            reviewer_id: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes,
            actions: updatedActions
          });
        }
        setReviewNotes('');
      } else {
        toast.error(data?.error || 'Failed to update appeal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update appeal');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredAppeals = appeals.filter(a => {
    if (searchTerm === '') return true;
    const search = searchTerm.toLowerCase();
    return (
      a.appeal_number?.toString().includes(search) ||
      a.user?.username?.toLowerCase().includes(search) ||
      a.category?.toLowerCase().includes(search) ||
      a.order?.order_number?.toLowerCase().includes(search)
    );
  });

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 pb-20 md:pb-4 md:ml-64`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`flex items-center gap-4 border-b ${trollCityTheme.borders.glass} pb-6`}>
          <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-2xl border ${trollCityTheme.borders.glass}`}>
            <Scale className="w-10 h-10 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Appeal Management
            </h1>
            <p className={`${trollCityTheme.text.muted} mt-1`}>
              Review and manage transaction disputes. Approve refunds or release escrow to sellers.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Appeals</div>
          </div>
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
            <div className="text-2xl font-bold text-blue-400">{stats.under_review}</div>
            <div className="text-sm text-gray-400">Under Review</div>
          </div>
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
            <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
            <div className="text-sm text-gray-400">Approved</div>
          </div>
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
            <div className="text-2xl font-bold text-red-400">{stats.denied}</div>
            <div className="text-sm text-gray-400">Denied</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search appeals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="escalated">Escalated</option>
          </select>
          <button
            onClick={fetchAppeals}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appeals List */}
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-2xl`}>
            <h2 className="text-lg font-bold mb-4">Appeals</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400"></div>
              </div>
            ) : filteredAppeals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No appeals found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAppeals.map(appeal => (
                  <div
                    key={appeal.id}
                    onClick={() => handleSelectAppeal(appeal)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedAppeal?.id === appeal.id
                        ? 'bg-amber-500/20 border-amber-500'
                        : 'bg-[#171427] border border-purple-500/20 hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">#{appeal.appeal_number}</span>
                          <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[appeal.status]}`}>
                            {appeal.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {appeal.user?.username || 'Unknown User'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 font-bold">{appeal.amount_in_dispute?.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(appeal.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                      {CATEGORY_LABELS[appeal.category]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Appeal Details */}
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-2xl`}>
            <h2 className="text-lg font-bold mb-4">Appeal Details</h2>
            
            {!selectedAppeal ? (
              <div className="text-center py-12 text-gray-500">
                <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select an appeal to view details</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status & Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xl font-bold">Appeal #{selectedAppeal.appeal_number}</div>
                    <div className={`px-2 py-1 rounded text-sm border inline-block mt-1 ${STATUS_COLORS[selectedAppeal.status]}`}>
                      {selectedAppeal.status.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 font-bold text-xl">{selectedAppeal.amount_in_dispute?.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">coins in dispute</div>
                  </div>
                </div>

                {/* User Info */}
                <div className="bg-[#171427] p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center font-bold">
                      {selectedAppeal.user?.username?.slice(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <div className="font-semibold">{selectedAppeal.user?.username || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">Filed Appeal</div>
                    </div>
                  </div>
                </div>

                {/* Related Party */}
                {selectedAppeal.related_user && (
                  <div className="bg-[#171427] p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Other Party</div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold">
                        {selectedAppeal.related_user.username?.slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div className="font-semibold">{selectedAppeal.related_user.username}</div>
                    </div>
                  </div>
                )}

                {/* Order Info */}
                {selectedAppeal.order && (
                  <div className="bg-[#171427] p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">Order Details</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Order:</span> #{selectedAppeal.order.order_number}
                      </div>
                      <div>
                        <span className="text-gray-400">Amount:</span> {selectedAppeal.order.total_coins?.toLocaleString()} coins
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span> {selectedAppeal.order.status}
                      </div>
                      <div>
                        <span className="text-gray-400">Escrow:</span> {selectedAppeal.order.escrow_status}
                      </div>
                    </div>
                  </div>
                )}

                {/* Category & Description */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Category</div>
                  <div className="font-semibold">{CATEGORY_LABELS[selectedAppeal.category]}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="bg-[#171427] p-3 rounded-lg text-sm">
                    {selectedAppeal.description}
                  </div>
                </div>

                {selectedAppeal.desired_resolution && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Desired Resolution</div>
                    <div className="bg-[#171427] p-3 rounded-lg text-sm">
                      {selectedAppeal.desired_resolution}
                    </div>
                  </div>
                )}

                {/* Review Notes Input */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Review Notes</div>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    rows={3}
                    className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                {selectedAppeal.status === 'pending' || selectedAppeal.status === 'under_review' ? (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleUpdateStatus('under_review')}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      Mark Review
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('approved')}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Approve (Refund)
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('denied')}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 inline mr-1" />
                      Deny (Release)
                    </button>
                  </div>
                ) : null}

                {/* Appeal History */}
                {selectedAppeal.actions && selectedAppeal.actions.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Appeal History</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedAppeal.actions.map(action => (
                        <div key={action.id} className="text-xs bg-[#171427] p-2 rounded">
                          <div className="flex justify-between">
                            <span className="text-amber-400">{action.action_type}</span>
                            <span className="text-gray-500">{new Date(action.created_at).toLocaleString()}</span>
                          </div>
                          {action.notes && <div className="text-gray-400 mt-1">{action.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
