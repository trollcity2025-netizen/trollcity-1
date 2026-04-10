import { useState, useEffect, useCallback } from 'react';
import { X, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import SquarePaymentModal from './SquarePaymentModal'

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
  const { user, profile } = useAuthStore();
  const [selectedPack, setSelectedPack] = useState<CoinPackage | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New user state - check if user has made any previous coin purchases
  const [isNewUser, setIsNewUser] = useState(true);
  const [checkingNewUser, setCheckingNewUser] = useState(true);
  const NEW_USER_COIN_DISCOUNT = 0.05; // 5% off for new users
  const MINIMUM_TAX_RATE = 0.03; // 3% minimum tax on all coin packs

  // Square Payment Modal
  const [showSquarePayment, setShowSquarePayment] = useState(false);

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

  const fetchCoinPacks = async () => {
    setLoading(true);
    
    // Standard coin packs for broadcast quick store
    const standardPacks: CoinPackage[] = [
      { id: '1', coins: 300, price: '$3.00' },
      { id: '2', coins: 500, price: '$5.00' },
      { id: '3', coins: 1000, price: '$10.00', popular: true },
      { id: '4', coins: 2500, price: '$25.00' },
      { id: '5', coins: 5000, price: '$50.00' },
      { id: '6', coins: 10000, price: '$100.00' },
    ];
    
    setPackages(standardPacks);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCoinPacks();
      checkNewUserStatus();
      // Reset state when opening
      setSelectedPack(null);
      setShowSquarePayment(false);
    }
  }, [isOpen, checkNewUserStatus]);

  const handlePackageSelect = (pkg: CoinPackage) => {
    const finalPrice = getFinalPrice(pkg.price);
    const pkgWithTax = { ...pkg, price: finalPrice.toFixed(2) };
    setSelectedPack(pkgWithTax);
    setShowSquarePayment(true);
  };

  // Helper to calculate final price with minimum tax
  const getFinalPrice = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return price;
    const tax = numPrice * MINIMUM_TAX_RATE;
    return numPrice + tax;
  };

  const getTaxAmount = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return 0;
    return numPrice * MINIMUM_TAX_RATE;
  };

  const getDisplayPrice = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return price;
    const discounted = numPrice * (1 - NEW_USER_COIN_DISCOUNT);
    const withTax = discounted + (discounted * MINIMUM_TAX_RATE);
    return `$${withTax.toFixed(2)}`;
  };
  
  const handlePaymentSuccess = (data: any) => {
    toast.success(`Successfully purchased ${selectedPack?.coins.toLocaleString()} coins!`);
    setShowSquarePayment(false);
    setSelectedPack(null);
    onClose();
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
              Coin Store
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New User Discount Banner */}
          {isNewUser && !checkingNewUser && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <span className="text-lg">🎉</span>
                <span className="font-bold">New User Special: 5% OFF + 3% Tax Included!</span>
                <span className="text-lg">🎉</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
                    <span className={`font-bold bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800 ${isNewUser ? 'text-green-400' : 'text-white'}`}>
                      {isNewUser ? getDisplayPrice(pkg.price) : getFinalPrice(pkg.price)}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      +${(isNewUser ? getTaxAmount(pkg.price) : getTaxAmount(pkg.price)).toFixed(2)} tax
                    </span>
                  </div>
                </button>
              ))}
            </div>
            )}
            
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
              Secure payments processed via Square. Coins credited instantly after purchase.
            </div>
          </div>
        </div>
      </div>

      <SquarePaymentModal
        isOpen={showSquarePayment}
        onClose={() => {
          setShowSquarePayment(false);
          setSelectedPack(null);
        }}
        pkg={selectedPack}
        userId={user?.id || ''}
        profile={profile}
        onPaymentSuccess={handlePaymentSuccess}
        onSaveCard={true}
      />
    </>
  );
}