import React, { useState, useEffect, useCallback } from 'react';
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

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

interface PurchaseOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  price_paid: number;
  purchased_at: string;
  status: OrderStatus;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  item_name?: string;
  item_image?: string;
  seller_name?: string;
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

export default function MyOrders() {
  const { user } = useAuthStore();
  
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('marketplace_purchases')
        .select('*')
        .eq('buyer_id', user.id)
        .order('purchased_at', { ascending: false });

      if (error) throw error;

      // Enrich with item and seller data
      const enriched = await Promise.all((data || []).map(async (order: any) => {
        let item_name = 'Item';
        let item_image = '';
        let seller_name = 'Seller';

        // Fetch item details
        if (order.item_id) {
          const { data: item } = await supabase
            .from('marketplace_items')
            .select('name, image_url')
            .eq('id', order.item_id)
            .maybeSingle();
          if (item) {
            item_name = item.name;
            item_image = item.image_url || '';
          }
        }

        // Fetch seller name
        if (order.seller_id) {
          const { data: seller } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', order.seller_id)
            .maybeSingle();
          if (seller) seller_name = seller.username;
        }

        return { ...order, item_name, item_image, seller_name };
      }));

      setOrders(enriched);
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
      const { error } = await supabase
        .from('marketplace_purchases')
        .update({ status: 'completed', delivered_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('buyer_id', user!.id);

      if (error) throw error;
      toast.success('Delivery confirmed!');
      fetchOrders();
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      toast.error(err.message || 'Failed to confirm delivery');
    } finally {
      setConfirmingDelivery(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    return (order.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.seller_name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const stats = {
    total: orders.length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    completed: orders.filter(o => o.status === 'completed').length,
    awaitingConfirmation: orders.filter(o => o.status === 'shipped').length,
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
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

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders yet</p>
            <p className="text-gray-500 text-sm mt-2">Purchase items from the marketplace to see them here</p>
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
                    <div className={cn('px-3 py-1 rounded-full text-sm font-medium', STATUS_CONFIG[order.status]?.bg, STATUS_CONFIG[order.status]?.color)}>
                      {STATUS_CONFIG[order.status]?.label}
                    </div>
                    <div>
                      <div className="font-medium text-white">{order.item_name}</div>
                      <div className="text-gray-500 text-xs flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.purchased_at).toLocaleDateString()} - Seller: {order.seller_name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
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

                {expandedOrder === order.id && (
                  <div className="border-t border-gray-700 p-4 bg-gray-850">
                    <div className="mb-4">
                      <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                        {order.item_image ? (
                          <img src={order.item_image} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{order.item_name}</p>
                          <p className="text-gray-400 text-sm">{order.price_paid} TC - Sold by {order.seller_name}</p>
                        </div>
                      </div>
                    </div>

                    {order.tracking_number && (
                      <div className="mb-4">
                        <h4 className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Tracking
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-white text-sm">{order.shipping_carrier?.toUpperCase()}: {order.tracking_number}</p>
                          {order.shipped_at && <p className="text-gray-500 text-xs mt-1">Shipped {new Date(order.shipped_at).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    )}

                    {order.status === 'shipped' && (
                      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4">
                        <p className="text-yellow-400 text-sm">
                          <Clock className="w-4 h-4 inline mr-2" />
                          Your order will auto-confirm after 7 days if you don&apos;t confirm manually.
                        </p>
                      </div>
                    )}

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

                    {order.status === 'completed' && (
                      <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-3">
                        <p className="text-green-400 text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Order completed! Coins released to seller.
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
