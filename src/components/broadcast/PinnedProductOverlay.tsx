import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Package, Coins, Check } from 'lucide-react';
import { PinnedProductWithItem, ShopItem } from '../../types/liveCommerce';
import { useAuthStore } from '../../lib/store';
import { useLiveCommerceOrders } from '../../hooks/useLiveCommerceOrders';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface PinnedProductOverlayProps {
  pinnedProducts: PinnedProductWithItem[];
  onClose?: () => void;
}

export default function PinnedProductOverlay({
  pinnedProducts,
  onClose,
}: PinnedProductOverlayProps) {
  const { user, profile } = useAuthStore();
  const { purchaseProduct } = useLiveCommerceOrders({ userId: user?.id });
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState<string | null>(null);
  const [shippingForm, setShippingForm] = useState({
    name: profile?.full_name || profile?.username || '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  const activeProduct = Array.isArray(pinnedProducts) ? pinnedProducts.find((p) => p.is_active && p.product) : undefined;

  if (!activeProduct || !activeProduct.product) return null;

  const product = activeProduct.product as ShopItem;
  const isOutOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
  const canAfford = profile?.troll_coins !== undefined && profile.troll_coins >= product.price;

  const handlePurchase = async (productId: string) => {
    if (!user) {
      toast.error('Please log in to purchase');
      return;
    }

    if (!canAfford) {
      toast.error('Insufficient coins');
      return;
    }

    if (isOutOfStock) {
      toast.error('Product is out of stock');
      return;
    }

    setPurchasing(productId);

    const result = await purchaseProduct({
      productId,
      quantity: 1,
      shippingName: shippingForm.name,
      shippingAddress: shippingForm.address,
      shippingCity: shippingForm.city,
      shippingState: shippingForm.state,
      shippingZip: shippingForm.zip,
    });

    setPurchasing(null);
    setShowPurchaseForm(null);

    if (result.success) {
      toast.success('Purchase successful! Order placed.');
    } else {
      toast.error(result.error || 'Purchase failed');
    }
  };

  return (
    <>
      {/* Compact View - Bottom overlay */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden z-40"
      >
        <div className="flex items-start p-3 gap-3">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-medium text-sm truncate">{product.name}</h4>
            <div className="flex items-center gap-1 mt-1">
              <Coins className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">{product.price}</span>
            </div>
            {product.stock_quantity !== null && (
              <span className="text-xs text-gray-400">
                {product.stock_quantity} left
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowPurchaseForm(product.id)}
            disabled={purchasing === product.id || isOutOfStock || !canAfford}
            className={cn(
              'w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors',
              canAfford && !isOutOfStock
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            {isOutOfStock ? 'Out of Stock' : !canAfford ? `Need More Coins` : 'Buy Now'}
          </button>
        </div>
      </motion.div>

      {/* Purchase Form Modal */}
      <AnimatePresence>
        {showPurchaseForm === product.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPurchaseForm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-900 rounded-xl p-4 w-full max-w-sm border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white font-bold mb-4">Shipping Information</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={shippingForm.name}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, name: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={shippingForm.address}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, address: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={shippingForm.city}
                    onChange={(e) =>
                      setShippingForm({ ...shippingForm, city: e.target.value })
                    }
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={shippingForm.state}
                    onChange={(e) =>
                      setShippingForm({ ...shippingForm, state: e.target.value })
                    }
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={shippingForm.zip}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, zip: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <div className="flex justify-between text-white text-sm">
                  <span>Total:</span>
                  <span className="font-bold text-yellow-400">{product.price} coins</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowPurchaseForm(null)}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurchase(product.id)}
                  disabled={purchasing === product.id || !shippingForm.name || !shippingForm.address}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {purchasing === product.id ? 'Processing...' : 'Confirm Purchase'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
