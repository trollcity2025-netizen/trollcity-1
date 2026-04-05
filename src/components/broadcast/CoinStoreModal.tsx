import { useState, useEffect, useCallback } from 'react';
import { X, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import ManualPaymentModal from './ManualPaymentModal';

interface CoinPackage {
  id: string;
  coins: number;
  price: string;
  popular?: boolean;
}

interface CoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CoinStoreModal({ isOpen, onClose }: CoinStoreModalProps) {
  const { user } = useAuthStore();
  const [selectedPack, setSelectedPack] = useState<CoinPackage | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New user state - check if user has made any previous coin purchases
  const [isNewUser, setIsNewUser] = useState(true);
  const [checkingNewUser, setCheckingNewUser] = useState(true);
  const NEW_USER_COIN_DISCOUNT = 0.05; // 5% off for new users

  // Check if user is a new user (less than 1 week on platform)
  const checkNewUserStatus = useCallback(async () => {
    if (!user?.id) {
      setCheckingNewUser(false);
      return;
    }
    
    try {
      // Check user's account creation date
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      
      if (profileData?.created_at) {
        const createdAt = new Date(profileData.created_at);
        const now = new Date();
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        // User is "new" if less than 7 days since account creation
        setIsNewUser(daysSinceCreation < 7);
      } else {
        setIsNewUser(false);
      }
    } catch (err) {
      console.error('Error checking new user status:', err);
      // Default to false on error to avoid giving discount incorrectly
      setIsNewUser(false);
    } finally {
      setCheckingNewUser(false);
    }
  }, [user?.id]);
  
  // Manual Payment State
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'venmo' | 'paypal' | 'cashapp'>('venmo');
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCoinPacks();
      checkNewUserStatus();
      // Reset state when opening
      setShowPaymentMethods(false);
      setSelectedPack(null);
      setShowPayPal(false);
    }
  }, [isOpen, checkNewUserStatus]);

  const fetchCoinPacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchasable_items')
      .select('*')
      .eq('category', 'coin_pack')
      .eq('is_active', true)
      .order('coin_price', { ascending: true });
       
    if (error) {
      console.error('Error fetching coin packs:', error);
    } else if (data) {
       const mapped: CoinPackage[] = data.map(item => ({
          id: item.id,
          coins: parseInt(item.display_name.replace(/[^0-9]/g, '')) || 0,
          price: item.usd_price ? `$${item.usd_price}` : 'Free',
          popular: item.display_name.includes('Best Value') || item.display_name.includes('Popular')
       })).sort((a, b) => a.coins - b.coins);
       setPackages(mapped);
    }
    setLoading(false);
  };

  const handlePackageSelect = (pkg: CoinPackage) => {
    setSelectedPack(pkg);
    setShowPaymentMethods(true);
  };

  const handleManualPayment = (provider: 'venmo' | 'paypal' | 'cashapp') => {
    if (provider === 'paypal') {
      setShowPayPal(true);
    } else {
      setSelectedProvider(provider);
      setManualPaymentOpen(true);
    }
  };

  const handleBackToPackages = () => {
    setShowPaymentMethods(false);
    setSelectedPack(null);
    setShowPayPal(false);
  };

  // Helper to calculate discounted price
  const getDiscountedPrice = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return price;
    return `$${(numPrice * (1 - NEW_USER_COIN_DISCOUNT)).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              {showPaymentMethods ? 'Select Payment Method' : 'Coin Store'}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New User Discount Banner */}
          {!showPaymentMethods && isNewUser && !checkingNewUser && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <span className="text-lg">🎉</span>
                <span className="font-bold">New User Special: 5% OFF all coin packs!</span>
                <span className="text-lg">🎉</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {showPaymentMethods && selectedPack ? (
              <div className="space-y-6 animate-in slide-in-from-right-10 duration-200">
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400">Selected Package</span>
                    <span className="font-bold text-yellow-400">{selectedPack.coins.toLocaleString()} Coins</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total Price</span>
                    <span className="font-bold text-white text-xl">
                      {isNewUser ? getDiscountedPrice(selectedPack.price) : selectedPack.price}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Show discounted price for new users */}
                  {isNewUser && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                      <span className="text-green-400 font-medium">New User Discount Applied!</span>
                      <div className="text-zinc-400 text-sm mt-1">
                        Was: <span className="line-through">{selectedPack.price}</span>
                        {' → '}
                        <span className="text-green-400 font-bold">
                          {getDiscountedPrice(selectedPack.price)}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Manual Payment Options</p>
                  
                  <button
                    onClick={() => handleManualPayment('venmo')}
                    className="w-full flex items-center justify-between p-4 bg-[#008CFF]/10 border border-[#008CFF]/30 hover:bg-[#008CFF]/20 hover:border-[#008CFF]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📱</span>
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-[#008CFF] transition-colors">Venmo</div>
                        <div className="text-xs text-zinc-400">Send via @trollcityllc</div>
                      </div>
                    </div>
                    <div className="text-[#008CFF] font-medium text-sm">Select</div>
                  </button>

                  <button
                    onClick={() => handleManualPayment('cashapp')}
                    className="w-full flex items-center justify-between p-4 bg-[#00D632]/10 border border-[#00D632]/30 hover:bg-[#00D632]/20 hover:border-[#00D632]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💲</span>
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-[#00D632] transition-colors">Cash App</div>
                        <div className="text-xs text-zinc-400">Send via $trollcity26</div>
                      </div>
                    </div>
                    <div className="text-[#00D632] font-medium text-sm">Select</div>
                  </button>

                  {showPayPal ? (
                    <div className="w-full p-4 bg-[#00457C]/10 border border-[#00457C]/30 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                        <div className="mb-3 text-center text-[#00457C] font-bold">Secure PayPal Checkout</div>
                        <PayPalScriptProvider options={{ 
                            clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
                            currency: "USD",
                            intent: "capture"
                        }}>
                            <PayPalButtons 
                                style={{ layout: "vertical", color: "gold", shape: "pill", label: "paypal", height: 48 }}
                                createOrder={async (_data, _actions) => {
                                  try {
                                      const { data: orderData, error } = await supabase.functions.invoke('paypal-create-order', {
                                        body: {
                                          amount: isNewUser 
                                            ? getDiscountedPrice(selectedPack.price).replace('$', '')
                                            : selectedPack.price.replace('$', ''),
                                          coins: selectedPack.coins,
                                          user_id: user?.id,
                                          package_id: selectedPack.id
                                        }
                                      });
                                      if (error) throw error;
                                      if (!orderData?.orderId) throw new Error("Order creation failed");
                                      return orderData.orderId;
                                  } catch (err: any) {
                                      console.error("PayPal Create Error:", err);
                                      toast.error("Failed to initialize PayPal: " + (err.message || "Unknown error"));
                                      return "";
                                  }
                                }}
                                onApprove={async (data, _actions) => {
                                  try {
                                      const { error } = await supabase.functions.invoke('paypal-complete-order', {
                                        body: {
                                          orderId: data.orderID,
                                          userId: user?.id,
                                          packageId: selectedPack.id
                                        }
                                      });
                                      if (error) throw error;
                                      toast.success(`Successfully purchased ${selectedPack.coins.toLocaleString()} coins!`);
                                      onClose();
                                  } catch (err: any) {
                                      console.error("PayPal Capture Error:", err);
                                      toast.error("Payment verification failed. Please contact support.");
                                  }
                                }}
                                onCancel={() => setShowPayPal(false)}
                                onError={(err) => {
                                    console.error("PayPal Error:", err);
                                    toast.error("PayPal encountered an error");
                                    setShowPayPal(false);
                                }}
                            />
                        </PayPalScriptProvider>
                        <button 
                            onClick={() => setShowPayPal(false)} 
                            className="w-full text-center text-xs text-zinc-400 mt-3 hover:text-white transition-colors"
                        >
                            Cancel PayPal
                        </button>
                    </div>
                  ) : (
                  <button
                    onClick={() => handleManualPayment('paypal')}
                    className="w-full flex items-center justify-between p-4 bg-[#00457C]/10 border border-[#00457C]/30 hover:bg-[#00457C]/20 hover:border-[#00457C]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🅿️</span>
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-[#00457C] transition-colors">PayPal</div>
                        <div className="text-xs text-zinc-400">Secure Checkout</div>
                      </div>
                    </div>
                    <div className="text-[#00457C] font-medium text-sm">Select</div>
                  </button>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <button 
                    onClick={handleBackToPackages}
                    className="w-full py-3 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    ← Back to Packages
                  </button>
                </div>
              </div>
            ) : (
              <>
                {loading ? (
                  <div className="text-center py-8 text-zinc-400">Loading packs...</div>
                ) : (
                <div className="grid grid-cols-1 gap-3">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => handlePackageSelect(pkg)}
                      className={`group relative flex items-center justify-between p-4 rounded-lg border transition-all duration-200
                        ${selectedPack?.id === pkg.id 
                          ? 'bg-yellow-500/10 border-yellow-500/50' 
                          : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                        }
                      `}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                          BEST VALUE
                        </div>
                      )}
                      {/* 5% OFF badge for new users */}
                      {isNewUser && !checkingNewUser && (
                        <div className="absolute -top-2 -right-1 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                          5% OFF
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${selectedPack?.id === pkg.id ? 'bg-yellow-500/20' : 'bg-zinc-700'}`}>
                          <Coins className={`w-5 h-5 ${selectedPack?.id === pkg.id ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white text-lg">{pkg.coins} Coins</div>
                          <div className="text-xs text-zinc-400">Instant delivery</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {isNewUser && !checkingNewUser && (
                          <span className="text-xs text-zinc-500 line-through">{pkg.price}</span>
                        )}
                        <span className={`font-bold bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800 ${isNewUser ? 'text-green-400' : 'text-white'}`}>
                          {isNewUser ? getDiscountedPrice(pkg.price) : pkg.price}
                        </span>
                      </div>
                    </button>
                  ))}
                  {packages.length === 0 && (
                     <div className="text-center py-4 text-zinc-500">No coin packs available at the moment.</div>
                  )}
                </div>
                )}
                
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
                  Secure manual payments processed by our team. Coins credited upon verification.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ManualPaymentModal 
        isOpen={manualPaymentOpen} 
        onClose={() => setManualPaymentOpen(false)} 
        pkg={selectedPack} 
        providerId={selectedProvider} 
      />
    </>
  );
}
