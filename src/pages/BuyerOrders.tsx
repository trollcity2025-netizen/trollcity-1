import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, Truck, Search, ExternalLink, Coins, 
  MapPin, Calendar, Clock, MessageCircle, X, ChevronDown, ChevronUp,
  Check, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

interface MarketplacePurchase {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  price_paid: number;
  platform_fee: number;
  seller_earnings: number;
  status: OrderStatus;
  tracking_number?: string;
  tracking_url?: string;
  shipping_carrier?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancellation_requested_at?: string;
  cancelled_at?: string;
  refunded_at?: string;
  shipping_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  created_at: string;
  marketplace_item?: {
    id: string;
    title: string;
    description: string;
    thumbnail_url?: string;
    type: string;
  };
  seller_profile?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  paid: { label: 'Paid', color: 'text-green-400', bg: 'bg-green-400/10' },
  processing: { label: 'Processing', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  shipped: { label: 'Shipped', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  delivered: { label: 'Delivered', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

export default function BuyerOrders() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [orders, setOrders] = useState<MarketplacePurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MarketplacePurchase | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_purchases')
        .select(`
          *,
          marketplace_item:marketplace_items(id, title, description, thumbnail_url, type),
          seller_profile:profiles!seller_id(id, username, avatar_url)
        `)
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user, fetchOrders]);

  const canCancel = (order: MarketplacePurchase): boolean => {
    if (order.status !== 'paid' && order.status !== 'pending') return false;
    const minutesSincePurchase = (Date.now() - new Date(order.created_at).getTime()) / 60000;
    return minutesSincePurchase <= 30;
  };

  const handleRequestCancellation = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    setIsCancelling(true);
    try {
      const { data, error } = await supabase.rpc('request_marketplace_cancellation', {
        p_order_id: selectedOrder.id,
        p_reason: cancelReason,
      });

      if (error) throw error;

      if (data && data.includes('successfully')) {
        toast.success('Cancellation requested');
        setShowCancelModal(false);
        setSelectedOrder(null);
        setCancelReason('');
        fetchOrders();
      } else {
        toast.error(data || 'Failed to request cancellation');
      }
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      toast.error(err.message || 'Failed to request cancellation');
    } finally {
      setIsCancelling(false);
    }
  };

  const openCancelModal = (order: MarketplacePurchase) => {
    setSelectedOrder(order);
    setShowCancelModal(true);
  };

  const handleContactSeller = (order: MarketplacePurchase) => {
    if (!order.seller_id || !order.marketplace_item) return;
    navigate(`/tcps?user=${order.seller_id}&itemId=${order.item_id}&itemTitle=${encodeURIComponent(order.marketplace_item.title)}`);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = 
      order.marketplace_item?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.seller_profile?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getTimeRemaining = (order: MarketplacePurchase): string => {
    const minutesSincePurchase = (Date.now() - new Date(order.created_at).getTime()) / 60000;
    const minutesRemaining = Math.max(0, 30 - minutesSincePurchase);
    if (minutesRemaining <= 0) return 'Expired';
    return `${Math.floor(minutesRemaining)} min`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="w-7 h-7" />
            My Purchases
          </h1>
          <p className="mt-1 text-white/80">Track your orders and manage purchases</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl10 pr4 py-3 text-white placeholder-gray-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'paid', 'shipped', 'completed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                )}
              >
                {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
              >
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    {order.marketplace_item?.thumbnail_url ? (
                      <img 
                        src={order.marketplace_item.thumbnail_url} 
                        alt={order.marketplace_item.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-white">{order.marketplace_item?.title || 'Item'}</div>
                      <div className="text-gray-500 text-xs flex items-center gap-2">
                        <span>by {order.seller_profile?.username || 'Unknown'}</span>
                        <span>•</span>
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className={cn('px-3 py-1 rounded-full text-sm font-medium', STATUS_CONFIG[order.status]?.bg, STATUS_CONFIG[order.status]?.color)}>
                        {STATUS_CONFIG[order.status]?.label}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="w-4 h-4" />
                        {order.price_paid}
                      </div>
                    </div>
                    {expandedOrder === order.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrder === order.id && (
                  <div className="border-t border-gray-700 p-4 bg-gray-850">
                    {/* Shipping Address */}
                    {order.shipping_address && (
                      <div className="mb-4">
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Shipping Address
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-white">{order.shipping_name}</p>
                          <p className="text-gray-400 text-sm">
                            {order.shipping_address}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tracking Info */}
                    {order.tracking_number && (
                      <div className="mb-4">
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Tracking
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm">{order.shipping_carrier?.toUpperCase()}: {order.tracking_number}</p>
                            {order.tracking_url && (
                              <a 
                                href={order.tracking_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                              >
                                Track Package <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {order.shipped_at && (
                            <span className="text-gray-500 text-xs">
                              Shipped {new Date(order.shipped_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order Timeline */}
                    <div className="mb-4">
                      <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Order Timeline
                      </h4>
                      <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-gray-300">Purchased: {new Date(order.created_at).toLocaleString()}</span>
                        </div>
                        {order.shipped_at && (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-purple-400" />
                            <span className="text-gray-300">Shipped: {new Date(order.shipped_at).toLocaleString()}</span>
                          </div>
                        )}
                        {order.delivered_at && (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-cyan-400" />
                            <span className="text-gray-300">Delivered: {new Date(order.delivered_at).toLocaleString()}</span>
                          </div>
                        )}
                        {order.cancelled_at && (
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-red-400" />
                            <span className="text-gray-300">Cancelled: {new Date(order.cancelled_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                      <div>
                        {canCancel(order) && (
                          <div className="flex items-center gap-2 text-yellow-400 text-sm">
                            <Clock className="w-4 h-4" />
                            Cancel available for {getTimeRemaining(order)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleContactSeller(order)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Contact Seller
                        </button>
                        {canCancel(order) && (
                          <button
                            onClick={() => openCancelModal(order)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Request Cancellation
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                Request Cancellation
              </h3>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Cancellation must be requested within 30 minutes of purchase
              </p>
            </div>

            <div className="mb-4">
              <label className="text-gray-400 text-sm mb-2 block">Reason for cancellation</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please explain why you're requesting cancellation..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px4 py3 text-white placeholder-gray-500 h-24 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Keep Order
              </button>
              <button
                onClick={handleRequestCancellation}
                disabled={!cancelReason.trim() || isCancelling}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    Request Cancellation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}