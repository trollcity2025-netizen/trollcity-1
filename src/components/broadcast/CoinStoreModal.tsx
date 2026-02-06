import { useState } from 'react';
import { X, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface CoinPackage {
  id: string;
  coins: number;
  price: string;
  popular?: boolean;
}

const PACKAGES: CoinPackage[] = [
  { id: 'pkg-300', coins: 300, price: '$1.99' },
  { id: 'pkg-500', coins: 500, price: '$3.49' },
  { id: 'pkg-1000', coins: 1000, price: '$6.99' },
  { id: 'pkg-2500', coins: 2500, price: '$16.99', popular: true },
  { id: 'pkg-5000', coins: 5000, price: '$33.99', popular: true },
  { id: 'pkg-10000', coins: 10000, price: '$64.99', popular: true }, // Using popular for Best Value
  { id: 'pkg-15000', coins: 15000, price: '$89.99' },
  { id: 'pkg-25000', coins: 25000, price: '$149.99' },
  { id: 'pkg-50000', coins: 50000, price: '$279.99' },
];

interface CoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CoinStoreModal({ isOpen, onClose }: CoinStoreModalProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

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
          <div className="grid grid-cols-1 gap-3">
            {PACKAGES.map((pkg) => (
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
          </div>
          
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
            Secure payments processed by Stripe. Coins are non-refundable.
          </div>
        </div>
      </div>
    </div>
  );
}
