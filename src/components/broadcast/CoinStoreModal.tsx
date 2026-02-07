import { useState, useEffect } from 'react';
import { X, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchCoinPacks();
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

  if (!isOpen) return null;

  const handlePurchase = (pkg: CoinPackage) => {
    setSelectedPack(pkg.id);
    toast.info(`Purchasing ${pkg.coins} coins... (Mock)`);
    // Implement actual purchase logic here
    setTimeout(() => {
        toast.success("Purchase successful!");
        onClose();
    }, 1500);
  };

  return (
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

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
             <div className="text-center py-8 text-zinc-400">Loading packs...</div>
          ) : (
          <div className="grid grid-cols-1 gap-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                className={`group relative flex items-center justify-between p-4 rounded-lg border transition-all duration-200
                  ${selectedPack === pkg.id 
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
                  <div className={`p-2 rounded-full ${selectedPack === pkg.id ? 'bg-yellow-500/20' : 'bg-zinc-700'}`}>
                    <Coins className={`w-5 h-5 ${selectedPack === pkg.id ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
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
            Secure payments processed by Stripe. Coins are non-refundable.
          </div>
        </div>
      </div>
    </div>
  );
}
