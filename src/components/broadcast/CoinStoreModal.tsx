import { X, ShoppingCart } from "lucide-react";
import { useState } from "react";

export interface CoinPackage {
  id: number;
  coins: number;
  price: string;
  emoji: string;
  popular?: boolean;
  bestValue?: boolean;
}

export const coinPackages: CoinPackage[] = [
  { id: 1, coins: 100, price: "$0.99", emoji: "🪙" },
  { id: 2, coins: 500, price: "$4.99", emoji: "💰", popular: true },
  { id: 3, coins: 1000, price: "$9.99", emoji: "💎" },
  { id: 4, coins: 2500, price: "$19.99", emoji: "👑" },
  { id: 5, coins: 5000, price: "$39.99", emoji: "🚀" },
  { id: 6, coins: 10000, price: "$69.99", emoji: "⭐", bestValue: true },
];

interface CoinStoreModalProps {
  onClose: () => void;
  onPurchase?: (coins: number) => void;
}

export default function CoinStoreModal({
  onClose,
  onPurchase,
}: CoinStoreModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(
    null
  );

  const handlePurchase = () => {
    if (!selectedPackage) return;
    onPurchase?.(selectedPackage.coins);
    setSelectedPackage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full purple-neon max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-yellow-400" />
            <h2 className="text-xl font-bold">COIN STORE</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {coinPackages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative p-4 rounded-lg transition-all transform hover:scale-105 ${
                selectedPackage?.id === pkg.id
                  ? "bg-purple-600 ring-2 ring-purple-400"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-2 -right-2 bg-red-600 text-xs px-2 py-1 rounded-full font-bold">
                  POPULAR
                </div>
              )}
              {pkg.bestValue && (
                <div className="absolute -top-2 -right-2 bg-green-600 text-xs px-2 py-1 rounded-full font-bold">
                  BEST VALUE
                </div>
              )}
              <div className="text-4xl mb-2">{pkg.emoji}</div>
              <div className="text-xl font-bold mb-1 text-yellow-400">
                {pkg.coins.toLocaleString()}
              </div>
              <div className="text-sm text-gray-300">coins</div>
              <div className="text-lg font-bold mt-2 text-white">
                {pkg.price}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={handlePurchase}
          disabled={!selectedPackage}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 disabled:opacity-50 rounded-lg font-bold transition-all"
        >
          {selectedPackage
            ? `Purchase ${selectedPackage.coins} coins for ${selectedPackage.price}`
            : "Select a Package"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          This is a demo - no real payment will be processed
        </p>
      </div>
    </div>
  );
}
