import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, Truck, Search, ExternalLink, Coins, 
  MapPin, Calendar, Clock, MessageCircle, X, ChevronDown, ChevronUp,
  Check, RefreshCw, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { type ShippingCarrier } from '../lib/trackingUtils';

const SHIPPING_CARRIERS = [
  { id: 'usps' as ShippingCarrier, name: 'USPS' },
  { id: 'ups' as ShippingCarrier, name: 'UPS' },
  { id: 'fedex' as ShippingCarrier, name: 'FedEx' },
  { id: 'dhl' as ShippingCarrier, name: 'DHL' },
  { id: 'other' as ShippingCarrier, name: 'Other' },
];

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
  cancellation_reason?: string;
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
  buyer_profile?: {
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

type FilterStatus = 'all' | OrderStatus;

export default function MarketplaceSellerOrders() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [orders, setOrders] = useState<MarketplacePurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MarketplacePurchase | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState<ShippingCarrier>('usps');
  const [isShipping, setIsShipping] = useState(false);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_purchases')
        .select(`
          *,
          marketplace_item:marketplace_items(id, title, description, thumbnail_url, type),
          buyer_profile:profiles!buyer_id(id, username, avatar_url)
        `)
        .eq('seller_id', user!.id)
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

  const handleShipOrder = async () => {
    if (!selectedOrder || !trackingNumber.trim()) return;

    setIsShipping(true);
    try {
      const { data, error } = await supabase.rpc('ship_marketplace_order', {
        p_order_id: selectedOrder.id,
        p_tracking_number: trackingNumber,
        p_carrier: carrier,
      });

      if (error) throw error;

      toast.success('Order shipped successfully!');
      setShowShippingModal(false);
      setSelectedOrder(null);
      setTrackingNumber('');
      fetchOrders();
    } catch (err: any) {
      console.error('Error shipping order:', err);
      toast.error(err.message || 'Failed to ship order');
    } finally {
      setIsShipping(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedOrder) return;

    setIsRefunding(true);
    try {
      const { data, error } = await supabase.rpc('refund_marketplace_order', {
        p_order_id: selectedOrder.id,
      });

      if (error) throw error;

      if (data && data.includes('successfully')) {
        toast.success('Order refunded successfully!');
        setShowRefundModal(false);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(data || 'Failed to refund order');
      }
    } catch (err: any) {
      console.error('Error refunding order:', err);
      toast.error(err.message || 'Failed to refund order');
    } finally {
      setIsRefunding(false);
    }
  };

  const openShippingModal = (order: MarketplacePurchase) => {
    setSelectedOrder(order);
    setShowShippingModal(true);
  };

  const openRefundModal = (order: MarketplacePurchase) => {
    setSelectedOrder(order);
    setShowRefundModal(true);
  };

  const handleContactBuyer = (order: MarketplacePurchase) => {
    if (!order.buyer_id || !order.marketplace_item) return;
    navigate(`/tcps?user=${order.buyer_id}&itemId=${order.item_id}&itemTitle=${encodeURIComponent(order.marketplace_item.title)}`);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = 
      order.marketplace_item?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyer_profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shipping_city?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getOrderStats = () => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'paid' || o.status === 'pending').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      refunded: orders.filter(o => o.status === 'refunded' || o.status === 'cancelled').length,
    };
  };

  const stats = getOrderStats();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="w-7 h-7" />
            Marketplace Orders
          </h1>
          <p className="mt-1 text-white/80">Manage and ship your marketplace orders</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-gray-400 text-sm">Total Orders</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-yellow-400 text-sm">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-purple-400 text-sm">Shipped</div>
            <div className="text-2xl font-bold text-purple-400">{stats.shipped}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-red-400 text-sm">Refunded</div>
            <div className="text-2xl font-bold text-red-400">{stats.refunded}</div>
          </div>
        </div>

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
            {(['all', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                )}
              >
                {status === 'all' ? 'All' : STATUS_CONFIG[status as OrderStatus]?.label || status}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
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
                        <span>Buyer: {order.buyer_profile?.username || 'Unknown'}</span>
                        <span>•</span>
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="w-4 h-4" />
                        {order.seller_earnings}
                      </div>
                      {order.cancellation_requested_at && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Cancellation requested
                        </span>
                      )}
                    </div>
                    <div className={cn('px-3 py-1 rounded-full text-sm font-medium', STATUS_CONFIG[order.status]?.bg, STATUS_CONFIG[order.status]?.color)}>
                      {STATUS_CONFIG[order.status]?.label}
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
                    {/* Cancellation Request Alert */}
                    {order.cancellation_requested_at && (
                      <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">Cancellation Requested</span>
                        </div>
                        <p className="text-gray-300 text-sm">{order.cancellation_reason}</p>
                        <p className="text-gray-500 text-xs mt-2">
                          Requested: {new Date(order.cancellation_requested_at).toLocaleString()}
                        </p>
                      </div>
                    )}

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

                    {/* Order Item */}
                    <div className="mb-4">
                      <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Item Details
                      </h4>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {order.marketplace_item?.thumbnail_url ? (
                              <img src={order.marketplace_item.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="text-white text-sm">{order.marketplace_item?.title || 'Product'}</p>
                              <p className="text-gray-500 text-xs">Type: {order.marketplace_item?.type || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-yellow-400 font-medium">{order.price_paid} coins</div>
                            <div className="text-gray-500 text-xs">Your earnings: {order.seller_earnings} coins</div>
                          </div>
                        </div>
                      </div>
                    </div>

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
                                className="text-purple-400 text-xs flex items-center gap-1 hover:underline"
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
                        {order.refunded_at && (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300">Refunded: {new Date(order.refunded_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleContactBuyer(order)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Contact Buyer
                      </button>
                      <div className="flex gap-3">
                        {order.status === 'paid' && (
                          <>
                            <button
                              onClick={() => openRefundModal(order)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Refund
                            </button>
                            <button
                              onClick={() => openShippingModal(order)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                            >
                              <Truck className="w-4 h-4" />
                              Ship Order
                            </button>
                          </>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => openShippingModal(order)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                          >
                            <Truck className="w-4 h-4" />
                            Update Tracking
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

      {/* Shipping Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-400" />
              {selectedOrder?.tracking_number ? 'Update Tracking' : 'Ship Order'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px4 py3 text-white"
                >
                  {SHIPPING_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px4 py3 text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowShippingModal(false);
                  setTrackingNumber('');
                }}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleShipOrder}
                disabled={!trackingNumber.trim() || isShipping}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isShipping ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Shipping...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {selectedOrder?.tracking_number ? 'Update' : 'Confirm Ship'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-red-400" />
              Refund Order
            </h3>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">
                This will refund {selectedOrder?.price_paid} coins to the buyer. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRefundModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={isRefunding}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRefunding ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Refunding...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Confirm Refund
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