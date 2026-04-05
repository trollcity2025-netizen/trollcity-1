import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, Truck, Search, ExternalLink, Coins, 
  MapPin, Calendar, Clock, MessageCircle, X, ChevronDown, ChevronUp,
  Check, RefreshCw, AlertCircle, ShieldCheck, Gavel
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

type FulfillmentStatus = 'pending' | 'awaiting_fulfillment' | 'fulfilled' | 'delivered' | 'issue_reported' | 'appeal_open' | 'resolved' | 'lawsuit_filed' | 'cancelled' | 'refunded';

type PayoutStatus = 'held' | 'released' | 'on_hold' | 'refunded' | 'cancelled';

interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location: string;
  event_time: string;
}

interface Shipment {
  id: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  tracking_status: string;
  shipped_date: string;
  delivered_at: string;
  tracking_events?: TrackingEvent[];
}

interface MarketplacePurchase {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  price_paid: number;
  platform_fee: number;
  seller_earnings: number;
  status: OrderStatus;
  fulfillment_status: FulfillmentStatus;
  payout_status: PayoutStatus;
  payout_released_at?: string;
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
  carrier_tracking_status?: string;
  created_at: string;
  appeal_id?: string;
  troll_court_case_id?: string;
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
  shipment?: Shipment;
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

const FULFILLMENT_CONFIG: Record<FulfillmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  awaiting_fulfillment: { label: 'Awaiting Fulfillment', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  fulfilled: { label: 'Fulfilled', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-400/10' },
  issue_reported: { label: 'Issue Reported', color: 'text-red-400', bg: 'bg-red-400/10' },
  appeal_open: { label: 'Appeal Open', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  resolved: { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  lawsuit_filed: { label: 'Lawsuit Filed', color: 'text-red-500', bg: 'bg-red-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const PAYOUT_CONFIG: Record<PayoutStatus, { label: string; color: string; bg: string }> = {
  held: { label: 'Held (Escrow)', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  released: { label: 'Released', color: 'text-green-400', bg: 'bg-green-400/10' },
  on_hold: { label: 'On Hold', color: 'text-red-400', bg: 'bg-red-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const TRACKING_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  label_created: { label: 'Label Created', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  accepted: { label: 'Accepted', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  in_transit: { label: 'In Transit', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-400/10' },
  exception: { label: 'Exception', color: 'text-red-400', bg: 'bg-red-400/10' },
  returned: { label: 'Returned', color: 'text-gray-400', bg: 'bg-gray-400/10' },
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
  const [shippedDate, setShippedDate] = useState<string>('');
  const [isShipping, setIsShipping] = useState(false);

  // Tracking confirmation checkbox
  const [confirmTrackingChecked, setConfirmTrackingChecked] = useState(false);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  const [showAppealModal, setShowAppealModal] = useState(false);
  const [selectedOrderForAppeal, setSelectedOrderForAppeal] = useState<MarketplacePurchase | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_purchases')
        .select(`
          *,
          marketplace_item:marketplace_items(id, title, description, thumbnail_url, type),
          buyer_profile:profiles!buyer_id(id, username, avatar_url),
          shipment:order_shipments(
            id, carrier, tracking_number, tracking_url, tracking_status,
            shipped_date, delivered_at,
            tracking_events(id, status, description, location, event_time)
          )
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
      const shipDate = shippedDate ? new Date(shippedDate).toISOString() : new Date().toISOString();
      
      const { data, error } = await supabase.rpc('fulfill_marketplace_order', {
        p_order_id: selectedOrder.id,
        p_tracking_number: trackingNumber,
        p_carrier: carrier,
        p_shipped_date: shipDate
      });

      if (error) throw error;

      if (data && data.includes('successfully')) {
        toast.success('Order shipped successfully! Payout is now in escrow.');
      } else {
        toast.error(data || 'Failed to ship order');
      }
      
      setShowShippingModal(false);
      setSelectedOrder(null);
      setTrackingNumber('');
      setShippedDate('');
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
    // Pre-fill from existing order data
    if (order.shipping_carrier) {
      setCarrier(order.shipping_carrier as ShippingCarrier);
    }
    if (order.tracking_number || order.shipment?.tracking_number) {
      setTrackingNumber(order.tracking_number || order.shipment?.tracking_number || '');
    }
    // Reset confirmation checkbox for new entry
    setConfirmTrackingChecked(false);
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

  const handleRefreshTracking = async (order: MarketplacePurchase) => {
    const trackingNumber = order.tracking_number || order.shipment?.tracking_number;
    const carrier = order.shipping_carrier || order.shipment?.carrier;

    if (!trackingNumber || !carrier) {
      toast.error('No tracking information available');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('tracking-refresh', {
        body: { order_id: order.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Tracking refreshed successfully');
        fetchOrders(); // Refresh the orders list
      } else {
        toast.error(data.message || 'Failed to refresh tracking');
      }
    } catch (err: any) {
      console.error('Error refreshing tracking:', err);
      toast.error(err.message || 'Failed to refresh tracking');
    }
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
      delivered: orders.filter(o => o.status === 'delivered').length,
      payoutHeld: orders.filter(o => o.payout_status === 'held').length,
      payoutReleased: orders.filter(o => o.payout_status === 'released').length,
      refundIssues: orders.filter(o => o.fulfillment_status === 'appeal_open' || o.fulfillment_status === 'lawsuit_filed').length,
    };
  };

  const stats = getOrderStats();

  const getTrackingStatusLabel = (status: string | undefined): string => {
    if (!status) return 'Unknown';
    return TRACKING_STATUS_CONFIG[status]?.label || status;
  };

  const getTrackingStatusColor = (status: string | undefined): string => {
    if (!status) return 'text-gray-400';
    return TRACKING_STATUS_CONFIG[status]?.color || 'text-gray-400';
  };

  const getCarrierTrackingUrl = (carrierStr: string, trackingNum: string): string => {
    const carrierLower = carrierStr?.toLowerCase();
    const num = trackingNum?.trim() || '';
    if (!num) return '#';
    
    switch (carrierLower) {
      case 'usps': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`;
      case 'ups': return `https://www.ups.com/track?tracknum=${num}`;
      case 'fedex': return `https://www.fedex.com/fedextrack/?trknbr=${num}`;
      case 'dhl': return `https://www.dhl.com/en/express/tracking.html?AWB=${num}`;
      default: return '#';
    }
  };

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
          <p className="mt-2 text-sm text-gray-400">
            💰 Seller earnings are held in escrow until carrier confirms delivery • 📦 Buyers track packages on carrier websites
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-gray-400 text-xs">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-yellow-400 text-xs">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-purple-400 text-xs">Shipped</div>
            <div className="text-2xl font-bold text-purple-400">{stats.shipped}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-green-400 text-xs">Delivered</div>
            <div className="text-2xl font-bold text-green-400">{stats.delivered}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-orange-400 text-xs">Escrow</div>
            <div className="text-2xl font-bold text-orange-400">{stats.payoutHeld}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-emerald-400 text-xs">Released</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.payoutReleased}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-red-400 text-xs">Issues</div>
            <div className="text-2xl font-bold text-red-400">{stats.refundIssues}</div>
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
                    {/* Payout Status Badge */}
                    {order.payout_status && (
                      <div className={cn('px-2 py-1 rounded text-xs font-medium', PAYOUT_CONFIG[order.payout_status]?.bg, PAYOUT_CONFIG[order.payout_status]?.color)}>
                        {PAYOUT_CONFIG[order.payout_status]?.label}
                      </div>
                    )}
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="w-4 h-4" />
                        {order.seller_earnings}
                      </div>
                      {order.payout_released_at && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Paid {new Date(order.payout_released_at).toLocaleDateString()}
                        </span>
                      )}
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

                    {/* Tracking Info with Live Status */}
                    {(order.tracking_number || order.shipment) && (
                      <div className="mb-4">
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Tracking
                          {/* Live tracking status indicator */}
                          {order.shipment?.tracking_status && (
                            <span className={cn('ml-2 px-2 py-0.5 rounded text-xs', TRACKING_STATUS_CONFIG[order.shipment.tracking_status]?.bg, TRACKING_STATUS_CONFIG[order.shipment.tracking_status]?.color)}>
                              {getTrackingStatusLabel(order.shipment.tracking_status)}
                            </span>
                          )}
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-white text-sm">
                                {order.shipping_carrier?.toUpperCase() || order.shipment?.carrier?.toUpperCase()}: {order.tracking_number || order.shipment?.tracking_number}
                              </p>
                              {(order.tracking_url || order.shipment?.tracking_url) && (
                                <a 
                                  href={order.tracking_url || order.shipment?.tracking_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-purple-400 text-xs flex items-center gap-1 hover:underline"
                                >
                                  Track Package <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {(order.shipped_at || order.shipment?.shipped_date) && (
                              <span className="text-gray-500 text-xs">
                                Shipped {new Date(order.shipped_at || order.shipment?.shipped_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {/* Tracking Events Timeline */}
                          {order.shipment?.tracking_events && order.shipment.tracking_events.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-gray-500 text-xs">Tracking History</p>
                                <button
                                  onClick={() => handleRefreshTracking(order)}
                                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                  title="Refresh tracking from carrier"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Refresh
                                </button>
                              </div>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {order.shipment.tracking_events.slice(0, 5).map((event, idx) => (
                                  <div key={event.id || idx} className="flex items-start gap-2 text-xs">
                                    <div className={cn('w-2 h-2 rounded-full mt-1',
                                      event.status === 'delivered' ? 'bg-green-400' :
                                      event.status === 'exception' ? 'bg-red-400' :
                                      event.status === 'out_for_delivery' ? 'bg-orange-400' :
                                      'bg-blue-400'
                                    )} />
                                    <div className="flex-1">
                                      <p className="text-gray-300">{event.description || event.status}</p>
                                      {event.location && <p className="text-gray-500">{event.location}</p>}
                                    </div>
                                    <span className="text-gray-500">{new Date(event.event_time).toLocaleDateString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
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

                    {/* Order Status Summary */}
                    <div className="mb-4 flex items-center gap-4">
                      <div>
                        <h4 className="text-gray-400 text-xs mb-1">Fulfillment</h4>
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', FULFILLMENT_CONFIG[order.fulfillment_status as FulfillmentStatus]?.bg, FULFILLMENT_CONFIG[order.fulfillment_status as FulfillmentStatus]?.color)}>
                          {FULFILLMENT_CONFIG[order.fulfillment_status as FulfillmentStatus]?.label || order.fulfillment_status || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-gray-400 text-xs mb-1">Payout</h4>
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', PAYOUT_CONFIG[order.payout_status as PayoutStatus]?.bg, PAYOUT_CONFIG[order.payout_status as PayoutStatus]?.color)}>
                          {PAYOUT_CONFIG[order.payout_status as PayoutStatus]?.label || order.payout_status || 'Held'}
                        </span>
                      </div>
                      {order.appeal_id && (
                        <div className="flex items-center gap-1 text-orange-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs">Appeal Open</span>
                        </div>
                      )}
                      {order.troll_court_case_id && (
                        <div className="flex items-center gap-1 text-red-400">
                          <Gavel className="w-4 h-4" />
                          <span className="text-xs">In Court</span>
                        </div>
                      )}
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
                        {/* Update tracking button for all orders with tracking */}
                        {(order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed') && (order.tracking_number || order.shipment?.tracking_number) && (
                          <>
                            <button
                              onClick={() => openShippingModal(order)}
                              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                            >
                              <Truck className="w-4 h-4" />
                              Update Tracking
                            </button>
                            <button
                              onClick={() => handleRefreshTracking(order)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Refresh
                            </button>
                          </>
                        )}
                        {/* Escrow Info for Seller */}
                        {order.payout_status === 'held' && (
                          <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Coins held until delivery
                          </div>
                        )}
                        {order.payout_status === 'released' && (
                          <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-400 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Paid to wallet
                          </div>
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
              {selectedOrder?.tracking_number || selectedOrder?.shipment?.tracking_number ? 'Update Tracking' : 'Ship Order'}
            </h3>
            
            {/* Escrow Info */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Coins are held in escrow until delivery is confirmed by the carrier</span>
              </div>
              <p className="text-orange-400 text-xs mt-1">
                Once you ship with tracking, buyers can track their package on the carrier's website.
                You can update tracking information anytime and refresh from carrier data.
              </p>
            </div>
            
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
                
                {/* Preview Link to Carrier Website */}
                {trackingNumber.trim() && (
                  <div className="mt-2 flex items-center justify-between bg-gray-800/50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">
                      Preview: {carrier.toUpperCase()} - {trackingNumber.trim()}
                    </div>
                    <a
                      href={
                        carrier === 'usps' ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber.trim()}` :
                        carrier === 'ups' ? `https://www.ups.com/track?tracknum=${trackingNumber.trim()}` :
                        carrier === 'fedex' ? `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber.trim()}` :
                        carrier === 'dhl' ? `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber.trim()}` :
                        '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      Check on {carrier.toUpperCase()} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">Shipped Date (optional)</label>
                <input
                  type="datetime-local"
                  value={shippedDate}
                  onChange={(e) => setShippedDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px4 py3 text-white"
                />
              </div>

              {/* Confirmation Checkbox */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmTrackingChecked}
                    onChange={(e) => setConfirmTrackingChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-sm">
                    <span className="text-yellow-400 font-medium">Verify tracking number before submitting</span>
                    <p className="text-gray-400 text-xs mt-1">
                      I confirm the tracking number is correct and matches the package I'm shipping. 
                      The buyer will be able to track their package on the carrier's website.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowShippingModal(false);
                  setTrackingNumber('');
                  setShippedDate('');
                  setConfirmTrackingChecked(false);
                }}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleShipOrder}
                disabled={!trackingNumber.trim() || !confirmTrackingChecked || isShipping}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isShipping ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Shipping...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {selectedOrder?.tracking_number || selectedOrder?.shipment?.tracking_number ? 'Update' : 'Confirm Ship'}
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