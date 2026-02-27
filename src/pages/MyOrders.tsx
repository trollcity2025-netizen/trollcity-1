import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, Truck, Clock, Search, 
  ExternalLink, Coins, MapPin, Calendar,
  ChevronDown, ChevronUp, CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ShopOrder, OrderStatus } from '../types/liveCommerce';

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

export default function MyOrders() {
  const { user } = useAuthStore();
  
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*, items(*, product(*))')
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

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingDelivery(orderId);
    try {
      const { error } = await supabase.rpc('confirm_delivery', {
        p_order_id: orderId,
        p_user_id: user!.id,
      });

      if (error) throw error;

      toast.success('Delivery confirmed! Coins released to seller.');
      fetchOrders();
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      toast.error(err.message || 'Failed to confirm delivery');
    } finally {
      setConfirmingDelivery(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    return order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      completed: orders.filter(o => o.status === 'completed').length,
      awaitingConfirmation: orders.filter(o => o.status === 'shipped').length,
    };
    return stats;
  };

  const stats = getOrderStats();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="w-7 h-7" />
            My Orders
          </h1>
          <p className="mt-1 text-white/80">Track and manage your purchases</p>
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
            <div className="text-purple-400 text-sm">Shipped</div>
            <div className="text-2xl font-bold text-purple-400">{stats.shipped}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-yellow-400 text-sm">Awaiting Confirmation</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.awaitingConfirmation}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-green-400 text-sm">Completed</div>
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders by number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl10 pr4 py-3 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders yet</p>
            <p className="text-gray-500 text-sm mt-2">Purchase items during live streams to see them here</p>
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
                      <span className="text-xs text-gray-500">
                        {order.items?.length || 0} item(s)
                      </span>
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
                    {/* Order Items */}
                    <div className="mb-4">
                      <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Items Ordered
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

                    {/* Shipping Address */}
                    <div className="mb-4">
                      <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Shipping To
                      </h4>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-white">{order.shipping_name}</p>
                        <p className="text-gray-400 text-sm">
                          {order.shipping_address}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                        </p>
                      </div>
                    </div>

                    {/* Tracking Info */}
                    {order.tracking_number && (
                      <div className="mb-4">
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Tracking Information
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm">{order.carrier?.toUpperCase()}: {order.tracking_number}</p>
                              {order.tracking_url && (
                                <a 
                                  href={order.tracking_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-green-400 text-xs flex items-center gap-1 hover:underline"
                                >
                                  Track Package <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {order.shipped_at && (
                              <div className="text-right">
                                <span className="text-gray-500 text-xs">
                                  Shipped {new Date(order.shipped_at).toLocaleDateString()}
                                </span>
                                {order.estimated_delivery && (
                                  <p className="text-purple-400 text-xs">
                                    Est. delivery: {new Date(order.estimated_delivery).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-confirm notice */}
                    {order.status === 'shipped' && (
                      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4">
                        <p className="text-yellow-400 text-sm">
                          <Clock className="w-4 h-4 inline mr-2" />
                          Your order will be automatically confirmed after 7 days if you don&apos;t confirm manually.
                        </p>
                      </div>
                    )}

                    {/* Confirm Delivery Button */}
                    {order.status === 'shipped' && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleConfirmDelivery(order.id)}
                          disabled={confirmingDelivery === order.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                          {confirmingDelivery === order.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Confirming...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Confirm Item Received
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Completed notice */}
                    {order.status === 'completed' && (
                      <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-3">
                        <p className="text-green-400 text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Order completed! Coins have been released to the seller.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
