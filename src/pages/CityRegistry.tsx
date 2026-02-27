import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { 
  FileText, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Package,
  DollarSign,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Scale,
  Gavel,
  Building2
} from 'lucide-react';
import { trollCityTheme } from '../styles/trollCityTheme';

type AppealCategory = 'non_delivery' | 'not_as_described' | 'damaged_item' | 'seller_issue' | 'buyer_issue' | 'payment_issue' | 'other';
type AppealStatus = 'pending' | 'under_review' | 'approved' | 'denied' | 'escalated' | 'withdrawn';

interface Appeal {
  id: string;
  appeal_number: number;
  order_id: string | null;
  category: AppealCategory;
  description: string;
  status: AppealStatus;
  amount_in_dispute: number;
  created_at: string;
  escrow_release_status: string;
  review_notes?: string;
}

interface WeeklyLimit {
  appeals_filled: number;
  max_appeals: number;
  week_start_date: string;
}

interface Order {
  id: string;
  order_number: string;
  shop_id: string;
  total_coins: number;
  status: string;
  escrow_status: string;
  delivery_status: string;
  created_at: string;
  shop_name?: string;
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

export default function CityRegistry() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'file' | 'history'>('file');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [category, setCategory] = useState<AppealCategory>('non_delivery');
  const [description, setDescription] = useState('');
  const [desiredResolution, setDesiredResolution] = useState('');
  
  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [weeklyLimit, setWeeklyLimit] = useState<WeeklyLimit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's orders that are eligible for appeal (has escrow or issues)
      const { data: ordersData } = await supabase
        .from('shop_orders')
        .select('id, order_number, shop_id, total_coins, status, escrow_status, delivery_status, created_at')
        .eq('buyer_id', user.id)
        .or('status.eq.completed,status.eq.shipped,status.eq.disputed')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Get shop names
      if (ordersData && ordersData.length > 0) {
        const shopIds = [...new Set(ordersData.map(o => o.shop_id))];
        const { data: shopsData } = await supabase
          .from('trollcity_shops')
          .select('id, shop_name')
          .in('id', shopIds);
        
        const shopMap = new Map(shopsData?.map(s => [s.id, s.shop_name]) || []);
        setOrders(ordersData.map(o => ({
          ...o,
          shop_name: shopMap.get(o.shop_id) || 'Unknown Shop'
        })));
      } else {
        setOrders([]);
      }
      
      // Fetch user's appeals
      const { data: appealsData } = await supabase
        .from('transaction_appeals')
        .select('id, appeal_number, order_id, category, description, status, amount_in_dispute, created_at, escrow_release_status, review_notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setAppeals(appealsData || []);
      
      // Fetch weekly limit info
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const { data: limitData, error: limitError } = await supabase
        .from('appeal_weekly_limits')
        .select('appeals_filed, max_appeals, week_start_date')
        .eq('user_id', user.id)
        .gte('week_start_date', weekStart.toISOString().split('T')[0])
        .maybeSingle();
      
      if (limitError) {
        console.error('Error fetching weekly appeal limit:', limitError);
      }

      if (limitData) {
        setWeeklyLimit({
          appeals_filled: limitData.appeals_filed,
          max_appeals: limitData.max_appeals,
          week_start_date: limitData.week_start_date
        });
      } else {
        setWeeklyLimit({ appeals_filled: 0, max_appeals: 5, week_start_date: weekStart.toISOString().split('T')[0] });
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitAppeal = async () => {
    if (!user || !selectedOrder) {
      toast.error('Please select an order');
      return;
    }
    
    if (!description.trim()) {
      toast.error('Please provide a description');
      return;
    }
    
    if (weeklyLimit && weeklyLimit.appeals_filled >= weeklyLimit.max_appeals) {
      toast.error('You have reached your weekly appeal limit (5 per week)');
      return;
    }
    
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_transaction_appeal', {
        p_user_id: user.id,
        p_order_id: selectedOrder.id,
        p_category: category,
        p_description: description,
        p_desired_resolution: desiredResolution || null,
        p_evidence_urls: []
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success('Appeal filed successfully!');
        setSelectedOrder(null);
        setDescription('');
        setDesiredResolution('');
        setActiveTab('history');
        fetchData();
      } else {
        toast.error(data?.error || 'Failed to file appeal');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to file appeal');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: AppealStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'under_review': return <Eye className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'denied': return <XCircle className="w-4 h-4" />;
      case 'escalated': return <AlertTriangle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredOrders = orders.filter(o => 
    searchTerm === '' || 
    o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.shop_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAppeals = appeals.filter(a =>
    searchTerm === '' ||
    a.appeal_number?.toString().includes(searchTerm) ||
    a.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const remainingAppeals = weeklyLimit ? weeklyLimit.max_appeals - weeklyLimit.appeals_filled : 5;

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-4 pb-20 md:pb-4 md:ml-64`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`flex items-center gap-4 border-b ${trollCityTheme.borders.glass} pb-6`}>
          <div className={`p-4 ${trollCityTheme.backgrounds.card} rounded-2xl border ${trollCityTheme.borders.glass}`}>
            <Building2 className="w-10 h-10 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              City Registry - Appeals
            </h1>
            <p className={`${trollCityTheme.text.muted} mt-1`}>
              File appeals for transaction disputes. Coins are held in escrow until delivery is confirmed.
            </p>
          </div>
        </div>

        {/* Weekly Limit Banner */}
        {remainingAppeals <= 2 && (
          <div className={`rounded-xl p-4 flex items-center gap-3 ${
            remainingAppeals === 0 
              ? 'bg-red-500/20 border border-red-500/40' 
              : 'bg-yellow-500/20 border border-yellow-500/40'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${remainingAppeals === 0 ? 'text-red-400' : 'text-yellow-400'}`} />
            <div>
              <div className="font-semibold">
                {remainingAppeals === 0 
                  ? 'Weekly Appeal Limit Reached' 
                  : `${remainingAppeals} Appeal${remainingAppeals > 1 ? 's' : ''} Remaining This Week`
                }
              </div>
              <div className="text-sm opacity-80">
                You can file up to 5 appeals per week (Monday - Sunday)
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'file'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            File Appeal
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Appeal History
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
          </div>
        ) : (
          <>
            {/* File Appeal Tab */}
            {activeTab === 'file' && (
              <div className="space-y-6">
                {/* Order Selection */}
                <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl`}>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-cyan-400" />
                    Select Order to Appeal
                  </h2>
                  
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#171427] border border-purple-500/40 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No orders found eligible for appeal</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {filteredOrders.map(order => (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`p-4 rounded-lg cursor-pointer transition-all ${
                            selectedOrder?.id === order.id
                              ? 'bg-cyan-500/20 border-cyan-500'
                              : 'bg-[#171427] border border-purple-500/20 hover:border-purple-500/40'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">Order #{order.order_number || order.id.slice(0, 8)}</div>
                              <div className="text-sm text-gray-400">{order.shop_name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-cyan-400 font-bold">{order.total_coins?.toLocaleString()} coins</div>
                              <div className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                                order.escrow_status === 'held' 
                                  ? 'bg-yellow-500/20 text-yellow-400' 
                                  : 'bg-green-500/20 text-green-400'
                              }`}>
                                {order.escrow_status === 'held' ? 'In Escrow' : 'Released'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Appeal Form */}
                {selectedOrder && (
                  <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-6 rounded-2xl`}>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-cyan-400" />
                      Appeal Details
                    </h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-2">Category</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as AppealCategory)}
                          className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                        >
                          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm mb-2">Description *</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the issue in detail..."
                          rows={4}
                          className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm mb-2">Desired Resolution</label>
                        <input
                          type="text"
                          value={desiredResolution}
                          onChange={(e) => setDesiredResolution(e.target.value)}
                          placeholder="e.g., Full refund, Replacement, Partial refund..."
                          className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div className="bg-[#171427] p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-400">Amount in Dispute:</span>
                          <span className="text-cyan-400 font-bold">{selectedOrder.total_coins?.toLocaleString()} coins</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Escrow Status:</span>
                          <span className={`px-2 py-0.5 rounded text-sm ${
                            selectedOrder.escrow_status === 'held'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {selectedOrder.escrow_status === 'held' ? 'Held - Will be refunded if approved' : 'Released'}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleSubmitAppeal}
                        disabled={submitting || !description.trim()}
                        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                          submitting || !description.trim()
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-cyan-600 hover:bg-cyan-500'
                        }`}
                      >
                        {submitting ? 'Submitting...' : 'Submit Appeal'}
                      </button>
                      
                      <p className="text-xs text-gray-500 text-center">
                        By submitting, you agree to the appeal process. Admins and Secretaries will review your case.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Your Appeals</h2>
                  <button
                    onClick={fetchData}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {filteredAppeals.length === 0 ? (
                  <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-12 rounded-2xl text-center`}>
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">No Appeals Filed</h3>
                    <p className="text-gray-500 mt-2">You haven&apos;t filed any appeals yet.</p>
                    <button
                      onClick={() => setActiveTab('file')}
                      className="mt-4 px-4 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors"
                    >
                      File Your First Appeal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAppeals.map(appeal => (
                      <div
                        key={appeal.id}
                        className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-2xl`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">Appeal #{appeal.appeal_number}</span>
                              <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[appeal.status]}`}>
                                {appeal.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              {CATEGORY_LABELS[appeal.category]} • {new Date(appeal.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400 font-bold">{appeal.amount_in_dispute?.toLocaleString()} coins</div>
                            <div className={`text-xs ${
                              appeal.escrow_release_status === 'held' ? 'text-yellow-400' :
                              appeal.escrow_release_status === 'released' ? 'text-green-400' :
                              'text-gray-400'
                            }`}>
                              {appeal.escrow_release_status === 'held' ? 'In Escrow' :
                               appeal.escrow_release_status === 'released' ? 'Released' :
                               appeal.escrow_release_status === 'refunded' ? 'Refunded' : 'Pending'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-300 bg-[#171427] p-3 rounded-lg mb-3">
                          {appeal.description.length > 150 
                            ? `${appeal.description.slice(0, 150)}...` 
                            : appeal.description}
                        </div>
                        
                        {appeal.review_notes && (
                          <div className="text-sm bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg">
                            <div className="text-purple-400 font-semibold mb-1">Review Notes:</div>
                            <div className="text-gray-300">{appeal.review_notes}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} p-4 rounded-xl`}>
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            How the Appeal System Works
          </h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• When you buy items with Troll Coins, coins are held in escrow until delivery is confirmed</li>
            <li>• You can file an appeal if there&apos;s an issue with your order</li>
            <li>• Appeals are reviewed by Admins and Secretaries</li>
            <li>• If approved, coins are refunded to your balance</li>
            <li>• If denied, coins are released to the seller</li>
            <li>• Maximum 5 appeals allowed per week (Monday-Sunday)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
