import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, Truck, Check, Search, 
  ExternalLink, Coins, MapPin, Calendar,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ShopOrder, OrderStatus, ShippingCarrier } from '../types/liveCommerce';

type FilterStatus = 'all' | OrderStatus;

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

const CARRIERS: { id: ShippingCarrier; name: string }[] = [
  { id: 'usps', name: 'USPS' },
  { id: 'ups', name: 'UPS' },
  { id: 'fedex', name: 'FedEx' },
  { id: 'dhl', name: 'DHL' },
  { id: 'other', name: 'Other' },
];

export default function SellerOrders() {
  const { user } = useAuthStore();

  
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  // Shipping modal state
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState<ShippingCarrier>('usps');
  const [isShipping, setIsShipping] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*, items(*, product(*))')
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
      const { error } = await supabase.rpc('ship_order', {
        p_order_id: selectedOrder.id,
        p_tracking_number: trackingNumber,
        p_carrier: carrier,
        p_seller_id: user!.id,
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

  const openShippingModal = (order: ShopOrder) => {
    setSelectedOrder(order);
    setShowShippingModal(true);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shipping_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shipping_city?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'paid').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      completed: orders.filter(o => o.status === 'completed').length,
    };
    return stats;
  };

  const stats = getOrderStats();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="w-7 h-7" />
            Seller Orders
          </h1>
          <p className="mt-1 text-white/80">Manage and ship your orders</p>
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
            <div className="text-green-400 text-sm">Completed</div>
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
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
            {(['all', 'paid', 'shipped', 'completed'] as FilterStatus[]).map((status) => (
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
                {/* Order Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('px-3 py-1 rounded-full text-sm font-medium', STATUS_CONFIG[order.status]?.bg, STATUS_CONFIG[order.status]?.color)}>
                      {STATUS_CONFIG[order.status]?.label}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-gray-300">{order.order_number}</div>
                      <div className="text-gray-500 text-xs flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="w-4 h-4" />
                        {order.total_coins}
                      </div>
                      {order.escrow_status === 'held' && (
                        <span className="text-xs text-yellow-400/70">Escrow held</span>
                      )}
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

                    {/* Order Items */}
                    <div className="mb-4">
                      <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Items
                      </h4>
                      <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {item.product?.image_url ? (
                                <img src={item.product.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="text-white text-sm">{item.product?.name || 'Product'}</p>
                                <p className="text-gray-500 text-xs">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <div className="text-yellow-400 font-medium">
                              {item.total_price} coins
                            </div>
                          </div>
                        ))}
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
                            <p className="text-white text-sm">{order.carrier?.toUpperCase()}: {order.tracking_number}</p>
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

                    {/* Actions */}
                    {order.status === 'paid' && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => openShippingModal(order)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          Ship Order
                        </button>
                      </div>
                    )}
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
              Ship Order
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px4 py3 text-white"
                >
                  {CARRIERS.map((c) => (
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
                onClick={() => setShowShippingModal(false)}
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
                    Confirm Ship
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
