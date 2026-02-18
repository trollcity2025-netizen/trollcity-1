import { useState, useEffect } from 'react';
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
  
  // Manual Payment State
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'venmo' | 'paypal' | 'cashapp'>('venmo');
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);


  useEffect(() => {
    if (isOpen) {
      fetchCoinPacks();
      // Reset state when opening
      setShowPaymentMethods(false);
      setSelectedPack(null);

    }
  }, [isOpen]);

  const fetchCoinPacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchasable_items')
      .select('*')
      .eq('category', 'coin_pack')
      .eq('is_active', true)
      .order('coin_price', { ascending: true }); // coin_price usually null for packs, maybe order by usd_price or display_name?
      
    if (error) {
      console.error('Error fetching coin packs:', error);
      // Fallback to static if db fails? Or just empty.
    } else if (data) {
       // Transform to CoinPackage format
       const mapped: CoinPackage[] = data.map(item => ({
          id: item.id,
          coins: parseInt(item.display_name.replace(/[^0-9]/g, '')) || 0, // Extract number from name e.g. "1000 Coins"
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
    setSelectedProvider(provider);
    setManualPaymentOpen(true);
  };

  const handleBackToPackages = () => {
    setShowPaymentMethods(false);
    setSelectedPack(null);

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
                    <span className="font-bold text-white text-xl">{selectedPack.price}</span>
                  </div>
                </div>

                <div className="space-y-3">
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
                        <div className="text-xs text-zinc-400">Send via $trollcity95</div>
                      </div>
                    </div>
                    <div className="text-[#00D632] font-medium text-sm">Select</div>
                  </button>

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
                      data-testid={pkg.id}
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
                      
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${selectedPack?.id === pkg.id ? 'bg-yellow-500/20' : 'bg-zinc-700'}`}>
                          <Coins className={`w-5 h-5 ${selectedPack?.id === pkg.id ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white text-lg">{pkg.coins} Coins</div>
                          <div className="text-xs text-zinc-400">Instant delivery</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                          <span className="font-bold text-white bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800">
                              {pkg.price}
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
